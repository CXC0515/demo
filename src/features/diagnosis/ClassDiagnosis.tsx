/** @license SPDX-License-Identifier: Apache-2.0 */

import { BarChart2, BookOpen, ShieldAlert, Users } from 'lucide-react';
import { SchoolClass, Student } from '../../domain/types';

interface ClassDiagnosisProps {
  students: Student[];
  classes: SchoolClass[];
  selectedClassId: string;
}

export default function ClassDiagnosis({ students, classes, selectedClassId }: ClassDiagnosisProps) {
  const activeClass = classes.find(item => item.id === selectedClassId && item.status === 'active')
    ?? classes.find(item => item.status === 'active');

  if (!activeClass) return (
    <section className="grid min-h-[280px] place-items-center rounded-3xl border border-slate-200 bg-white/80 px-4 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900/70">
      <div><BarChart2 className="mx-auto h-10 w-10 text-emerald-700" /><h2 className="mt-4 text-lg font-black">暂无班级</h2><p className="mt-2 text-sm text-slate-500">创建班级后再查看学情诊断。</p></div>
    </section>
  );

  const classStudents = students.filter(student => student.classId === activeClass.id);
  if (!classStudents.length) return (
    <section className="grid min-h-[280px] place-items-center rounded-3xl border border-slate-200 bg-white/80 px-4 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900/70" id="class-diagnosis-page">
      <div className="max-w-sm"><Users className="mx-auto h-10 w-10 text-emerald-700" /><h2 className="mt-4 text-lg font-black">{activeClass.name}还没有学生</h2><p className="mt-2 text-sm leading-6 text-slate-500">导入学生并完成真实批改后，这里会汇总成绩、预警和薄弱知识点。</p></div>
    </section>
  );

  const studentsWithScores = classStudents.filter(student => student.recentHomeworkTrend.length > 0);
  const averageScore = studentsWithScores.length
    ? Math.round(studentsWithScores.reduce((sum, student) => sum + student.recentHomeworkTrend.at(-1)!, 0) / studentsWithScores.length)
    : null;
  const warningStudents = classStudents.filter(student => student.status === 'risk' || student.status === 'warning');
  const weakPointCounts = new Map<string, number>();
  classStudents.forEach(student => student.weakKnowledge.forEach(point => weakPointCounts.set(point, (weakPointCounts.get(point) ?? 0) + 1)));
  const weakPoints = [...weakPointCounts.entries()]
    .map(([name, count]) => ({ name, count, rate: Math.round(count / classStudents.length * 100) }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, 'zh-CN'))
    .slice(0, 6);
  const hasEvidence = studentsWithScores.length > 0 || weakPoints.length > 0 || warningStudents.length > 0;

  return <div className="space-y-5 animate-fade-in" id="class-diagnosis-page">
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="诊断班级" value={activeClass.name} detail={`${classStudents.length} 名学生`} />
      <Metric label="最近作业均分" value={averageScore === null ? '—' : String(averageScore)} detail={averageScore === null ? '尚无成绩记录' : `${studentsWithScores.length} 人有记录`} />
      <Metric label="近期风险" value={String(classStudents.filter(student => student.status === 'risk').length)} detail="需要优先关注" tone="red" />
      <Metric label="一般关注" value={String(classStudents.filter(student => student.status === 'warning').length)} detail="继续观察变化" tone="amber" />
    </section>

    {!hasEvidence ? <section className="grid min-h-56 place-items-center rounded-3xl border border-slate-200 bg-white/80 px-4 py-8 text-center dark:border-zinc-800 dark:bg-zinc-900/70"><div className="max-w-md"><BookOpen className="mx-auto h-9 w-9 text-emerald-700" /><h2 className="mt-3 text-lg font-black">暂无真实学情数据</h2><p className="mt-2 text-sm leading-6 text-slate-500">完成作业批改或补充学生学情记录后再生成诊断。本页面不会用演示数据填充空白。</p></div></section> : <div className="grid gap-5 xl:grid-cols-3">
      <section className="rounded-3xl border border-slate-200 bg-white/80 p-5 xl:col-span-2 dark:border-zinc-800 dark:bg-zinc-900/70"><h2 className="flex items-center gap-2 font-black"><BarChart2 className="h-5 w-5 text-emerald-700" />薄弱知识点</h2><div className="mt-4 space-y-4">{weakPoints.length ? weakPoints.map(point => <div key={point.name}><div className="flex justify-between gap-4 text-sm"><span className="font-semibold">{point.name}</span><span className="shrink-0 text-slate-500">{point.count} 人 · {point.rate}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800"><div className="h-full rounded-full bg-amber-500" style={{ width: `${point.rate}%` }} /></div></div>) : <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-zinc-800/60">尚未记录薄弱知识点。</p>}</div></section>
      <section className="rounded-3xl border border-slate-200 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/70"><h2 className="flex items-center gap-2 font-black"><ShieldAlert className="h-5 w-5 text-red-600" />需要关注的学生</h2><div className="mt-4 space-y-3">{warningStudents.length ? warningStudents.map(student => <div key={student.id} className="rounded-2xl bg-slate-50 p-4 dark:bg-zinc-800/60"><div className="flex items-center justify-between gap-3"><strong>{student.name}</strong><span className={`rounded-full px-2 py-1 text-xs font-bold ${student.status === 'risk' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{student.status === 'risk' ? '近期风险' : '需要关注'}</span></div><p className="mt-2 text-xs text-slate-500">学号：{student.studentNo}{student.recentHomeworkTrend.length ? ` · 最近成绩：${student.recentHomeworkTrend.at(-1)} 分` : ''}</p></div>) : <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-zinc-800/60">当前没有风险或关注状态的学生。</p>}</div></section>
    </div>}
  </div>;
}

function Metric({ label, value, detail, tone = 'emerald' }: { label: string; value: string; detail: string; tone?: 'emerald' | 'red' | 'amber' }) {
  const valueTone = tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : 'text-slate-900 dark:text-slate-100';
  return <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/70"><span className="text-xs font-bold text-slate-500">{label}</span><strong className={`mt-2 block text-2xl font-black ${valueTone}`}>{value}</strong><p className="mt-2 text-xs text-slate-500">{detail}</p></div>;
}
