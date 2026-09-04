import { RosterStudent } from '../../../src/domain/types';
import { createStudent, listStudents, StudentWriteInput, updateStudent } from '../../repositories/rosterRepository';

export type RosterImportField = 'studentNo' | 'name' | 'gender' | 'parentName' | 'parentPhone' | 'parentRelation' | 'parentRemark';
export type RosterImportMapping = Record<number, RosterImportField | null>;

export interface RosterImportGrid {
  headers: string[];
  rows: string[][];
  mapping?: RosterImportMapping;
}

export interface RosterImportPreviewRow {
  row: number;
  action: 'create' | 'update' | 'conflict' | 'invalid';
  studentNo: string;
  name: string;
  targetStudentId?: string;
  changes: string[];
  message?: string;
  values: Partial<Record<RosterImportField, string>>;
}

const aliases: Record<RosterImportField, string[]> = {
  studentNo: ['学号', '学生编号', '学生学号', '编号'],
  name: ['姓名', '学生姓名', '名字'],
  gender: ['性别'],
  parentName: ['家长姓名', '家长', '联系人', '联系人姓名'],
  parentPhone: ['家长手机号码', '家长手机号', '家长电话', '联系电话', '手机号码', '手机号'],
  parentRelation: ['家长关系', '与学生关系', '关系'],
  parentRemark: ['家长备注', '联系备注', '备注']
};

const normalizeHeader = (value: string) => value.trim().replace(/[\s_（）()：:]/g, '').toLowerCase();
const normalizeName = (value: string) => value.trim().replace(/\s+/g, '');

export const inferRosterImportMapping = (headers: string[]): RosterImportMapping => Object.fromEntries(
  headers.map((header, index) => {
    const normalized = normalizeHeader(header);
    const match = (Object.entries(aliases) as [RosterImportField, string[]][])
      .find(([, names]) => names.some(name => normalizeHeader(name) === normalized));
    return [index, match?.[0] ?? null];
  })
);

const valuesForRow = (row: string[], mapping: RosterImportMapping) => {
  const values: Partial<Record<RosterImportField, string>> = {};
  row.forEach((value, index) => {
    const field = mapping[index];
    if (field && value?.trim()) values[field] = value.trim();
  });
  return values;
};

export const previewRosterImport = (classId: string, grid: RosterImportGrid) => {
  const mapping = grid.mapping ?? inferRosterImportMapping(grid.headers);
  const roster = listStudents(classId);
  const byNo = new Map(roster.map(student => [student.studentNo.trim(), student]));
  const byName = new Map<string, RosterStudent[]>();
  roster.forEach(student => {
    const key = normalizeName(student.name);
    byName.set(key, [...(byName.get(key) ?? []), student]);
  });

  const previewRows: RosterImportPreviewRow[] = grid.rows.map((row, index) => {
    const values = valuesForRow(row, mapping);
    const studentNo = values.studentNo ?? '';
    const name = values.name ?? '';
    const byNumber = studentNo ? byNo.get(studentNo) : undefined;
    const nameMatches = name ? byName.get(normalizeName(name)) ?? [] : [];
    const target = byNumber ?? (nameMatches.length === 1 ? nameMatches[0] : undefined);
    const changes = Object.keys(values).filter(key => !['studentNo', 'name'].includes(key));

    if (!studentNo && !name) return { row: index + 2, action: 'invalid', studentNo, name, changes, values, message: '缺少学号或姓名' };
    if (!byNumber && nameMatches.length > 1) return { row: index + 2, action: 'conflict', studentNo, name, changes, values, message: '班内存在重名学生，请补充学号' };
    if (target) return { row: index + 2, action: 'update', studentNo: studentNo || target.studentNo, name: name || target.name, targetStudentId: target.id, changes, values };
    if (!studentNo || !name) return { row: index + 2, action: 'invalid', studentNo, name, changes, values, message: '新增学生必须同时包含学号和姓名' };
    return { row: index + 2, action: 'create', studentNo, name, changes, values };
  });

  return { mapping, rows: previewRows };
};

const genderValue = (value?: string): StudentWriteInput['gender'] | undefined => {
  if (!value) return undefined;
  if (['女', 'female', 'f'].includes(value.toLowerCase())) return 'female';
  if (['男', 'male', 'm'].includes(value.toLowerCase())) return 'male';
  return undefined;
};

export const applyRosterImport = (classId: string, grid: RosterImportGrid) => {
  const preview = previewRosterImport(classId, grid);
  const created: RosterStudent[] = [];
  const updated: RosterStudent[] = [];
  const rejected: { row: number; studentNo: string; code: string }[] = [];

  preview.rows.forEach(item => {
    if (item.action === 'conflict' || item.action === 'invalid') {
      rejected.push({ row: item.row, studentNo: item.studentNo, code: item.message ?? 'INVALID_IMPORT_ROW' });
      return;
    }
    try {
      if (item.action === 'create') {
        created.push(createStudent({
          classId,
          studentNo: item.studentNo,
          name: item.name,
          gender: genderValue(item.values.gender),
          committeeRoleIds: [],
          parent: {
            name: item.values.parentName ?? '',
            phone: item.values.parentPhone ?? '',
            relation: item.values.parentRelation ?? '',
            remark: item.values.parentRemark ?? ''
          }
        }));
        return;
      }
      const current = listStudents(classId).find(student => student.id === item.targetStudentId);
      if (!current) throw new Error('STUDENT_NOT_FOUND');
      const saved = updateStudent(current.id, {
        ...current,
        studentNo: item.values.studentNo ?? current.studentNo,
        name: item.values.name ?? current.name,
        gender: genderValue(item.values.gender) ?? current.gender,
        parent: {
          name: item.values.parentName ?? current.parent.name,
          phone: item.values.parentPhone ?? current.parent.phone,
          relation: item.values.parentRelation ?? current.parent.relation,
          remark: item.values.parentRemark ?? current.parent.remark
        }
      });
      if (!saved) throw new Error('STUDENT_NOT_FOUND');
      updated.push(saved);
    } catch (error) {
      rejected.push({ row: item.row, studentNo: item.studentNo, code: error instanceof Error ? error.message : 'ROSTER_WRITE_FAILED' });
    }
  });
  return { created, updated, rejected };
};
