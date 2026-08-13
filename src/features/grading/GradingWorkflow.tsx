/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Eye,
  FileImage,
  FileText,
  Info,
  Layers3,
  Link2,
  LockKeyhole,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  ScanLine,
  Settings2,
  ShieldCheck,
  Sparkles,
  Upload,
  UserCheck,
  Users,
  X
} from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AnalyzedQuestionUnit,
  CalibrationResultSource,
  CalibrationSample,
  DocumentAsset,
  FirstSectionAnalysis,
  GradingBatch,
  GradingDiagnosis,
  GradingMode,
  GradingQuestion,
  KnowledgeNode,
  QuestionGradingState,
  ReviewItem,
  RosterStudent,
  SchoolClass,
  SourceEvidence,
  SubmissionPage,
  TaskQuestionRubric,
  TrialGradingResult,
  VisionValidationItem,
  VisionValidationResult,
  WorkbenchTask,
  WorkflowState
} from '../../domain/types';
import { orderCalibrationSamplesForTrial } from '../../domain/calibrationSamples';
import SourceEvidenceViewer from './SourceEvidenceViewer';
import { analyzeTaskMaterials, correctTrialOcr, getBatchGrading, getGradingDiagnosis, getTaskAnalysis, getTaskMaterials, getTaskRubrics, getTaskTrialGrading, getVisionValidation, gradeTaskTrial, runVisionValidation, saveTaskQuestionCorrection, saveTaskRubric, saveTeacherReview, setBatchGradingAction, startBatchGrading, uploadTaskMaterials, waitForTaskMaterials } from '../../services/gradingApi';
import { listRosterClasses, listRosterStudents, matchRosterSubmissions } from '../../services/rosterApi';
import { buildSubmissionPages, getReadableStudentNos, reconcileSubmissionRoster } from '../../domain/submissionRoster';

interface GradingWorkflowProps {
  workflowState: WorkflowState;
  classes: SchoolClass[];
  tasks: WorkbenchTask[];
  selectedTask: WorkbenchTask;
  knowledgeNodes: KnowledgeNode[];
  reviewQueue: ReviewItem[];
  lowConfidenceThreshold: number;
  ocrHumanReviewThreshold: number;
  ocrAutoPassThreshold: number;
  onBack: () => void;
  onSelectTask: (task: WorkbenchTask) => void;
  onUpdateTask: (task: WorkbenchTask) => Promise<void>;
  onUpdateState: (newState: Partial<WorkflowState>) => void;
  onSyncToProfiles: (aiResults: WorkflowState['aiResults']) => void;
  onConfirmReview: (reviewId: string, finalScore: number, changeReason: string) => void;
  onBounceToOcr: (reviewId: string) => void;
  onMarkAsSample: (studentName: string) => void;
  onShowToast: (message: string) => void;
}

type StageId = 'assignment' | 'rubric' | 'intake' | 'calibration' | 'grading' | 'review' | 'diagnosis';

const stages: { id: StageId; label: string }[] = [
  { id: 'assignment', label: '作业内容' },
  { id: 'rubric', label: '评分依据' },
  { id: 'intake', label: '上传质检' },
  { id: 'calibration', label: '试批校准' },
  { id: 'grading', label: '批量批改' },
  { id: 'review', label: '异常复核' },
  { id: 'diagnosis', label: '结果诊断' }
];

const sampleTypeLabel: Record<CalibrationSample['sampleType'], string> = {
  high: '高分样本',
  middle: '中间样本',
  low: '低分样本',
  boundary: '边界样本',
  'ocr-risk': 'OCR 风险'
};

const getEffectiveOcrText = (sample: CalibrationSample) => sample.teacherCorrectedText ?? sample.rawOcrText ?? sample.ocrText;

const modeOptions: { id: GradingMode; label: string; description: string }[] = [
  { id: 'per-submission', label: '每份都确认', description: '每份作业完成后等待教师确认' },
  { id: 'batch-checkpoint', label: '每 10 份确认', description: '分批检查，逐步建立本次任务信任' },
  { id: 'auto-continue', label: '自动继续', description: '正常答卷持续处理，异常单独隔离' }
];

const panelClass = 'glass-panel rounded-[24px]';
const inputClass = 'w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 dark:border-zinc-800 dark:bg-zinc-900';

const getFiles = (files: FileList | null) => {
  if (!files) return [];
  const result: File[] = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files.item(index);
    if (file) result.push(file);
  }
  return result;
};

const getSubmissionStatus = (page: SubmissionPage) => {
  if (page.rosterMatchStatus === 'ambiguous-student-name') return { label: '同名待确认', className: 'bg-rose-100 text-rose-800' };
  if (page.rosterMatchStatus === 'duplicate-student-no') return { label: '重复学号', className: 'bg-rose-100 text-rose-800' };
  if (page.rosterMatchStatus === 'unknown-student-no') return { label: '名册无此学号', className: 'bg-rose-100 text-rose-800' };
  if (page.rosterMatchStatus === 'unreadable-student-no') return { label: '学号待确认', className: 'bg-rose-100 text-rose-800' };
  if (page.rosterMatchStatus === 'pending') return { label: '正在匹配', className: 'bg-amber-100 text-amber-800' };
  if (page.status === 'matched') return { label: '自动通过', className: 'bg-emerald-100 text-emerald-800' };
  if (page.reviewSource === 'multimodal') return { label: '多模态核验', className: 'bg-sky-100 text-sky-800' };
  return { label: '教师复核', className: 'bg-rose-100 text-rose-800' };
};

function VisionItemCard({ item }: { item: VisionValidationItem; key?: string }) {
  const choiceEvidenceUnits = item.evidenceUnits?.filter(unit => unit.kind === 'choice') ?? [];
  return (
    <article className="grid gap-3 border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-sm">第 {item.displayNo} 题</strong>
        <span className={`rounded-lg px-2 py-1 text-[11px] font-bold ${item.needsReview ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
          {item.needsReview ? '需核验' : `置信度 ${Math.round(item.confidence * 100)}%`}
        </span>
      </div>
      <img src={item.cropUrl} alt={`第 ${item.displayNo} 题完整区域`} className="max-h-48 w-full border border-slate-200 object-contain" />
      {choiceEvidenceUnits.length ? (
        <div className="grid grid-cols-2 gap-2">
          {choiceEvidenceUnits.map(unit => (
            <figure key={unit.evidenceId} className="min-w-0">
              <img src={unit.cropUrl} alt={`${unit.evidenceId} 学生作答证据`} className="h-20 w-full border border-slate-200 bg-white object-contain" />
              <figcaption className={`mt-1 truncate text-[10px] ${unit.needsReview ? 'font-bold text-amber-700' : 'text-slate-500'}`} title={unit.reviewReasons.join('；')}>
                {unit.evidenceId}{unit.needsReview ? ' · 待核验' : ''}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
      {item.locationStatus !== 'located' ? <p className="text-[11px] font-bold text-rose-700">题目区域待确认：{item.locationReasons.join('；')}</p> : null}
      {item.answerFields?.length ? (
        <div className="space-y-1">{item.answerFields.map(field => <p key={field.fieldId} className="text-xs leading-5"><strong>{field.label}：</strong>{field.text || '未填写'}{field.needsReview ? <span className="ml-1 text-amber-700">待核验</span> : null}</p>)}</div>
      ) : <p className="text-xs leading-5"><strong>{item.needsReview ? '识别草稿（待核验）' : '有效答案'}：</strong>{item.lunaText || item.selectedOption || '未识别'}{item.selectedOption && item.lunaText && item.lunaText !== item.selectedOption ? `（选项 ${item.selectedOption}）` : ''}</p>}
      {item.crossedOutText.length ? <p className="text-[11px] leading-5 text-slate-500">已划去：{item.crossedOutText.join('；')}</p> : null}
      {item.existingMarkings.length ? <p className="text-[11px] leading-5 text-amber-700">已有批改痕迹：{item.existingMarkings.join('；')}</p> : null}
    </article>
  );
}

const buildWorkflowFromAnalysis = (taskId: string, analysis: FirstSectionAnalysis, savedRubrics: TaskQuestionRubric[] = []) => {
  const sourceEvidence = analysis.questions.flatMap(question => {
    const questionEvidenceId = `${taskId}-question-${question.displayNo}`;
    const answerEvidenceId = `${taskId}-answer-${question.displayNo}`;
    return [{
      id: questionEvidenceId,
      assetId: question.questionSource.assetId,
      assetKind: question.questionSource.assetKind,
      fileName: question.questionSource.fileName,
      pageNumber: question.questionSource.pageNumber ?? 1,
      boundingBox: question.questionSource.boundingBox ?? { x: 0, y: 0, width: 1, height: 1 },
      ocrText: question.questionSource.quote,
      confidence: question.confidence,
      imageUrl: question.questionSource.imageUrl,
      sourcePageUrl: question.questionSource.sourcePageUrl,
      evidenceMode: question.questionSource.evidenceMode ?? 'native-text',
      locatorStatus: question.questionSource.locatorStatus ?? 'located',
      locatorReasons: question.questionSource.locatorReasons ?? []
    }, ...(question.answerSource ? [{
      id: answerEvidenceId,
      assetId: question.answerSource.assetId,
      assetKind: question.answerSource.assetKind,
      fileName: question.answerSource.fileName,
      pageNumber: question.answerSource.pageNumber ?? 1,
      boundingBox: question.answerSource.boundingBox ?? { x: 0, y: 0, width: 1, height: 1 },
      ocrText: question.answerSource.quote,
      confidence: question.confidence,
      imageUrl: question.answerSource.imageUrl,
      sourcePageUrl: question.answerSource.sourcePageUrl,
      evidenceMode: question.answerSource.evidenceMode ?? 'native-text',
      locatorStatus: question.answerSource.locatorStatus ?? 'located',
      locatorReasons: question.answerSource.locatorReasons ?? []
    }] : [])];
  });
  const questions: WorkflowState['questions'] = analysis.questions.map(question => {
    const authoritativeStem = question.questionSource.quote.trim() || question.stem;
    return {
    id: `${taskId}-q-${question.displayNo}`,
    displayNo: question.displayNo,
    title: question.title || `第 ${question.displayNo} 题`,
    score: question.score ?? 0,
    knowledgePoint: question.knowledgeCandidates.map(candidate => candidate.nodeName).join('、') || '待关联知识点',
    knowledgeLinks: question.knowledgeCandidates.map(candidate => ({ ...candidate, status: 'suggested' as const })),
    desc: authoritativeStem,
    stem: authoritativeStem,
    aiQuestionType: question.questionType,
    answerRequirement: question.answerRequirement,
    parseConfidence: question.confidence,
    sourceEvidenceIds: [`${taskId}-question-${question.displayNo}`]
  };
  });
  const rubricByQuestionId = new Map(savedRubrics.map(rubric => [rubric.questionId, rubric]));
  const questionGradingStates: QuestionGradingState[] = analysis.questions.map(question => {
    const questionId = `${taskId}-q-${question.displayNo}`;
    const savedRubric = rubricByQuestionId.get(questionId);
    return {
    questionId,
    standardAnswer: savedRubric?.standardAnswer ?? question.standardAnswer,
    standardAnswerSourceIds: question.answerSource ? [`${taskId}-answer-${question.displayNo}`] : [],
    gradingRubric: savedRubric?.gradingRubric ?? question.rubricPoints.map(point => ({ point: point.point, score: point.score ?? 0, description: point.description })),
    teacherRules: savedRubric?.teacherRules ?? [],
    rubricVersion: savedRubric?.rubricVersion ?? 1,
    sampleTarget: 3,
    calibrationSamples: [],
    jointReviewEnabled: false
  };});
  return {
    questions,
    sourceEvidence,
    questionGradingStates,
    standardAnswer: questionGradingStates[0]?.standardAnswer ?? '',
    gradingRubric: questionGradingStates[0]?.gradingRubric ?? []
  };
};

const applyTrialSamples = (states: QuestionGradingState[], result: TrialGradingResult | null) => {
  if (!result) return states;
  return states.map(state => ({
    ...state,
    calibrationSamples: orderCalibrationSamplesForTrial(result.samples.filter(sample => sample.questionId === state.questionId))
  }));
};

function AnalysisEvidenceDetails({ unit, scopeLabel }: { unit: AnalyzedQuestionUnit; scopeLabel: '整题' | '本小题' }) {
  const toEvidence = (reference: AnalyzedQuestionUnit['questionSource'], id: string): SourceEvidence => ({
    id,
    assetId: reference.assetId,
    assetKind: reference.assetKind,
    fileName: reference.fileName,
    pageNumber: reference.pageNumber ?? 1,
    boundingBox: reference.boundingBox ?? { x: 0, y: 0, width: 1, height: 1 },
    ocrText: reference.quote,
    confidence: unit.confidence,
    imageUrl: reference.imageUrl,
    sourcePageUrl: reference.sourcePageUrl,
    evidenceMode: reference.evidenceMode ?? 'native-text',
    locatorStatus: reference.locatorStatus ?? 'located',
    locatorReasons: reference.locatorReasons ?? []
  });
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-xs font-bold text-slate-500">查看{scopeLabel}题目与参考答案原文</summary>
      <div className="mt-2 grid gap-3 lg:grid-cols-2">
        <SourceEvidenceViewer evidence={toEvidence(unit.questionSource, `${unit.displayNo}-question-source`)} label="题目原文" />
        {unit.answerSource ? <SourceEvidenceViewer evidence={toEvidence(unit.answerSource, `${unit.displayNo}-answer-source`)} label="参考答案原文" /> : <section className="border-l-2 border-sky-600 bg-slate-50 p-3 text-xs text-slate-500 dark:bg-zinc-950">参考答案中没有匹配到可引用内容。</section>}
      </div>
    </details>
  );
}

function AnalysisQuestionCard({ question, standardAnswer, onSave }: { question: FirstSectionAnalysis['questions'][number]; standardAnswer: string; onSave: (correction: { title: string; stem: string; answerRequirement: string; standardAnswer: string }) => Promise<void> }) {
  const authoritativeStem = question.questionSource.quote.trim() || question.stem;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ title: question.title, stem: authoritativeStem, answerRequirement: question.answerRequirement, standardAnswer });
  useEffect(() => {
    setEditing(false);
    setDraft({ title: question.title, stem: authoritativeStem, answerRequirement: question.answerRequirement, standardAnswer });
  }, [question.displayNo, question.title, authoritativeStem, question.answerRequirement, standardAnswer]);
  const cancel = () => {
    setDraft({ title: question.title, stem: authoritativeStem, answerRequirement: question.answerRequirement, standardAnswer });
    setEditing(false);
  };
  const save = async () => {
    if (!draft.title.trim() || !draft.stem.trim()) return;
    setSaving(true);
    try {
      await onSave({ title: draft.title.trim(), stem: draft.stem.trim(), answerRequirement: draft.answerRequirement.trim(), standardAnswer: draft.standardAnswer.trim() });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };
  return (
    <article className="min-w-0 rounded-lg border border-slate-200 p-4 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><strong className="text-base">第 {question.displayNo} 题</strong><span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 dark:bg-zinc-800 dark:text-slate-300">{question.questionType}</span><span className="text-xs font-bold text-emerald-700">{question.score ?? '待确认'} 分</span><span className={`text-xs ${question.confidence < 0.8 ? 'font-bold text-rose-700' : 'text-slate-400'}`}>置信度 {Math.round(question.confidence * 100)}%</span></div>
          {editing ? <div className="mt-4 space-y-3"><label className="block space-y-1"><span className="text-xs font-bold text-slate-500">题目标题</span><input value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} className={inputClass} /></label><label className="block space-y-1"><span className="text-xs font-bold text-slate-500">题干</span><textarea rows={6} value={draft.stem} onChange={event => setDraft(current => ({ ...current, stem: event.target.value }))} className={`${inputClass} resize-y leading-6`} /></label><label className="block space-y-1"><span className="text-xs font-bold text-slate-500">作答要求</span><input value={draft.answerRequirement} onChange={event => setDraft(current => ({ ...current, answerRequirement: event.target.value }))} className={inputClass} /></label><label className="block space-y-1"><span className="text-xs font-bold text-slate-500">标准答案</span><textarea rows={5} value={draft.standardAnswer} onChange={event => setDraft(current => ({ ...current, standardAnswer: event.target.value }))} className={`${inputClass} resize-y leading-6`} /></label><div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={cancel} className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-500 dark:border-zinc-700">取消</button><button type="button" disabled={saving || !draft.title.trim() || !draft.stem.trim()} onClick={() => void save()} className="flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><Save className="h-3.5 w-3.5" />{saving ? '保存中...' : '保存'}</button></div></div> : <><h4 className="mt-3 text-sm font-black text-slate-900 dark:text-white">{question.title}</h4><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{authoritativeStem}</p>{question.answerRequirement ? <p className="mt-2 text-xs leading-5 text-slate-500">作答要求：{question.answerRequirement}</p> : null}</>}
        </div>
        {!editing ? <button type="button" title="编辑本题" aria-label={`编辑第 ${question.displayNo} 题`} onClick={() => setEditing(true)} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:border-emerald-600 hover:text-emerald-700 dark:border-zinc-700"><Pencil className="h-4 w-4" /></button> : null}
      </div>
      {!editing ? <>{!question.subquestions.length ? <div className="mt-4 grid gap-3 lg:grid-cols-2"><div><span className="text-xs font-bold text-slate-400">标准答案</span><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{standardAnswer || '待教师补充'}</p></div><div><span className="text-xs font-bold text-slate-400">解析</span><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{question.explanation || '暂无'}</p></div></div> : null}{question.subquestions.length ? <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200 dark:divide-zinc-800 dark:border-zinc-800">{question.subquestions.map(subquestion => <div key={subquestion.displayNo} className="py-4"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">小题 {subquestion.displayNo}</strong><span className="text-xs text-slate-500">{subquestion.questionType} · {subquestion.score === null ? '分值待确认' : `${subquestion.score} 分`}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{subquestion.stem}</p><p className="mt-2 text-sm leading-6"><span className="mr-2 text-xs font-bold text-slate-400">答案</span>{subquestion.standardAnswer || '待教师补充'}</p>{subquestion.rubricPoints.length ? <p className="mt-2 text-xs leading-5 text-emerald-800">采分点：{subquestion.rubricPoints.map(point => `${point.point}（${point.score ?? '待确认'}分）`).join('；')}</p> : null}{subquestion.reviewReasons.length ? <p className="mt-2 text-xs leading-5 text-amber-800"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" />{subquestion.reviewReasons.join('；')}</p> : null}<AnalysisEvidenceDetails unit={subquestion} scopeLabel="本小题" /></div>)}</div> : null}{!question.subquestions.length && question.rubricPoints.length ? <p className="mt-3 text-xs leading-5 text-emerald-800">采分点：{question.rubricPoints.map(point => `${point.point}（${point.score ?? '待确认'}分）`).join('；')}</p> : null}{question.reviewReasons.length ? <p className="mt-3 text-xs leading-5 text-amber-800"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" />{question.reviewReasons.join('；')}</p> : null}<AnalysisEvidenceDetails unit={question} scopeLabel="整题" /></> : null}
    </article>
  );
}

function MaterialDocumentDetails({ document, asset }: { document: NonNullable<WorkflowState['assignment']['documents']>[number]; asset?: WorkflowState['assignment']['assets'][number] }) {
  const visibleImages = document.resources.filter(resource => resource.role !== 'source-page' && resource.mimeType.startsWith('image/') && !/\.(?:wmf|emf)$/i.test(resource.fileName));
  return (
    <details className="border-t border-slate-200 py-3 dark:border-zinc-800">
      <summary className="cursor-pointer text-sm font-bold text-slate-800 dark:text-slate-100">查看解析内容 · {asset?.fileName ?? document.sourceFormat.toUpperCase()}</summary>
      {document.warnings.length ? <div className="mt-3 space-y-1 text-xs text-amber-800">{document.warnings.map((warning, index) => <p key={`${warning.code}-${index}`}><AlertTriangle className="mr-1 inline h-3.5 w-3.5" />{warning.message}</p>)}</div> : null}
      {visibleImages.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2">{visibleImages.map(resource => <figure key={resource.id} className="overflow-hidden border border-slate-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950"><img src={resource.publicUrl} alt="文档中的图片" className="max-h-80 w-full object-contain" /></figure>)}</div> : null}
      {!visibleImages.length && document.resources.length && document.sourcePreviewUrl ? <div className="mt-3"><img src={document.sourcePreviewUrl} alt="原版页面预览" className="max-h-96 w-full border border-slate-200 bg-white object-contain dark:border-zinc-800" /><a href={document.sourcePreviewUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><Eye className="h-3.5 w-3.5" />查看完整原版页面</a></div> : null}
      <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words bg-slate-50 p-4 text-xs leading-6 text-slate-700 dark:bg-zinc-950 dark:text-slate-200">{document.markdown}</pre>
    </details>
  );
}

const analysisStatusLabel: Record<WorkflowState['assignment']['analysisStatus'], string> = {
  idle: '等待材料', uploading: '上传中', parsing: '材料解析中', 'needs-review': '需要检查', ready: '材料已解析', failed: '解析失败'
};

const materialStatusLabel: Record<WorkflowState['assignment']['assets'][number]['status'], string> = {
  uploaded: '等待解析', processing: '解析中', ready: '已解析', 'needs-review': '需检查', failed: '失败'
};

const materialAccept = '.docx,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/pdf,image/*';
const formatElapsed = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const getInitialStage = (node: WorkbenchTask['node']): StageId => {
  if (node === 'setup' || node === 'collection') return 'assignment';
  if (node === 'upload' || node === 'ocr') return 'intake';
  if (node === 'grading') return 'grading';
  if (node === 'verify') return 'review';
  return 'diagnosis';
};

function QuestionSelector({ questions, states, selectedId, onSelect }: { questions: WorkflowState['questions']; states: QuestionGradingState[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-max gap-2" role="tablist" aria-label="选择题号">
        {questions.map(question => {
          const state = states.find(item => item.questionId === question.id);
          const confirmed = state?.calibrationSamples.filter(sample => sample.status === 'confirmed').length ?? 0;
          const target = state?.sampleTarget ?? 3;
          const active = selectedId === question.id;
          return (
            <button key={question.id} type="button" role="tab" aria-selected={active} onClick={() => onSelect(question.id)} className={`min-w-36 rounded-2xl border px-4 py-3 text-left transition-all ${active ? 'border-emerald-700 bg-emerald-700 text-white shadow-md shadow-emerald-700/10' : 'border-slate-200 bg-white/70 text-slate-600 hover:border-emerald-300 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-slate-300'}`}>
              <span className="block text-sm font-black">第 {question.displayNo} 题</span>
              <span className={`mt-1 block max-w-32 truncate text-xs ${active ? 'text-emerald-50' : 'text-slate-400'}`}>{question.title}</span>
              <span className={`mt-2 block text-[11px] font-bold ${active ? 'text-white' : confirmed >= target ? 'text-emerald-700' : 'text-amber-700'}`}>{confirmed >= target ? '试批已完成' : `试批 ${confirmed}/${target}`}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QuestionContext({ question, number, evidence, onConfirmKnowledge, onSaveCorrection }: { question: GradingQuestion; number: number; evidence?: WorkflowState['sourceEvidence'][number]; onConfirmKnowledge?: (nodeId: string) => void; onSaveCorrection?: (correction: { title: string; stem: string; answerRequirement: string }) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ title: question.title, stem: question.stem ?? question.desc, answerRequirement: question.answerRequirement ?? '' });
  useEffect(() => {
    setEditing(false);
    setDraft({ title: question.title, stem: question.stem ?? question.desc, answerRequirement: question.answerRequirement ?? '' });
  }, [question.id, question.title, question.stem, question.desc, question.answerRequirement]);
  const saveCorrection = async () => {
    if (!onSaveCorrection || !draft.title.trim() || !draft.stem.trim()) return;
    setSaving(true);
    try {
      await onSaveCorrection({ title: draft.title.trim(), stem: draft.stem.trim(), answerRequirement: draft.answerRequirement.trim() });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="grid gap-4 rounded-[24px] border border-slate-200 bg-white/70 p-5 lg:grid-cols-[minmax(0,1fr)_230px] dark:border-zinc-800 dark:bg-zinc-900/70">
      <div><div className="flex flex-wrap items-center gap-2 text-xs font-bold"><span className="text-emerald-700">第 {question.displayNo || number} 题 · {question.score} 分</span><span className="rounded-xl bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-zinc-800 dark:text-slate-300">{question.aiQuestionType ?? 'AI 待识别题型'}</span><span className="text-slate-400">解析 {Math.round(question.parseConfidence * 100)}%</span>{onSaveCorrection && !editing ? <button type="button" onClick={() => setEditing(true)} className="ml-auto rounded-xl border border-slate-200 px-2.5 py-1.5 text-slate-600 dark:border-zinc-700">修正题干</button> : null}</div>
      {editing ? <div className="mt-3 space-y-3"><label className="block space-y-1"><span className="text-xs font-bold text-slate-500">题目标题</span><input value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} className={inputClass} /></label><label className="block space-y-1"><span className="text-xs font-bold text-slate-500">题干</span><textarea value={draft.stem} onChange={event => setDraft(current => ({ ...current, stem: event.target.value }))} rows={5} className={`${inputClass} resize-y leading-6`} /></label><label className="block space-y-1"><span className="text-xs font-bold text-slate-500">作答要求</span><input value={draft.answerRequirement} onChange={event => setDraft(current => ({ ...current, answerRequirement: event.target.value }))} className={inputClass} /></label><div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => { setDraft({ title: question.title, stem: question.stem ?? question.desc, answerRequirement: question.answerRequirement ?? '' }); setEditing(false); }} className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 dark:border-zinc-700">取消</button><button type="button" disabled={saving || !draft.title.trim() || !draft.stem.trim()} onClick={() => void saveCorrection()} className="flex items-center gap-2 rounded-2xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Save className="h-3.5 w-3.5" />{saving ? '保存中...' : '保存题干修正'}</button></div></div> : <><h2 className="mt-3 text-base font-black text-slate-900 dark:text-white">{question.title}</h2><p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-200">{question.stem ?? question.desc}</p>{question.answerRequirement ? <p className="mt-2 text-xs text-slate-500">作答要求：{question.answerRequirement}</p> : null}</>}
      <div className="mt-4 flex flex-wrap gap-2">{question.knowledgeLinks.length ? question.knowledgeLinks.map(link => <button key={link.nodeId} type="button" disabled={link.status === 'confirmed' || !onConfirmKnowledge} onClick={() => onConfirmKnowledge?.(link.nodeId)} className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold ${link.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-violet-100 text-violet-800 hover:bg-violet-200'}`}><Link2 className="h-3.5 w-3.5" />{link.nodeName}{link.status === 'suggested' ? ` · ${Math.round(link.confidence * 100)}%` : ' · 已关联'}</button>) : <span className="text-xs text-slate-400">资源库中暂无匹配知识点</span>}</div></div>
      {evidence ? <SourceEvidenceViewer evidence={evidence} label={`第 ${question.displayNo || number} 题题干`} /> : null}
    </section>
  );
}

function RubricEditor({ questionState, answerEvidence, dirty, savePhase, canEnterTrial, onChange, onCancel, onSaveDraft, onApply, onEnterTrial, onCompleteIntake }: { questionState: QuestionGradingState; answerEvidence?: WorkflowState['sourceEvidence'][number]; dirty: boolean; savePhase: 'idle' | 'saving' | 'saved' | 'error'; canEnterTrial: boolean; onChange: (next: QuestionGradingState) => void; onCancel: () => void; onSaveDraft: () => Promise<void>; onApply: () => void; onEnterTrial: () => void; onCompleteIntake: () => void }) {
  const [newRule, setNewRule] = useState('');
  const [editingAnswer, setEditingAnswer] = useState(false);
  const [answerSnapshot, setAnswerSnapshot] = useState(questionState.standardAnswer);
  useEffect(() => {
    setEditingAnswer(false);
    setAnswerSnapshot(questionState.standardAnswer);
  }, [questionState.questionId]);
  const addRule = () => {
    const value = newRule.trim();
    if (!value) return;
    onChange({ ...questionState, teacherRules: [...questionState.teacherRules, value] });
    setNewRule('');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div><h3 className="text-base font-black text-slate-900 dark:text-white">评分依据 V{questionState.rubricVersion}</h3><p className="mt-1 text-xs text-slate-500">当前题目的标准答案、采分点和教师补充规则。</p></div>
        <span className={`rounded-xl px-2.5 py-1.5 text-xs font-bold ${dirty ? 'bg-amber-100 text-amber-800' : savePhase === 'error' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>{dirty ? '有未保存修改' : savePhase === 'saving' ? '正在保存' : savePhase === 'error' ? '保存失败' : '已保存'}</span>
      </div>
      <div className="space-y-2"><div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-100"><FileText className="h-4 w-4 text-emerald-700" />标准答案</span>{!editingAnswer ? <button type="button" title="编辑标准答案" aria-label="编辑标准答案" onClick={() => { setAnswerSnapshot(questionState.standardAnswer); setEditingAnswer(true); }} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:text-emerald-700 dark:border-zinc-700"><Pencil className="h-4 w-4" /></button> : null}</div><div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_230px]"><div>{editingAnswer ? <><label><span className="sr-only">标准答案文本</span><textarea value={questionState.standardAnswer} onChange={event => onChange({ ...questionState, standardAnswer: event.target.value })} rows={7} className={`${inputClass} resize-y leading-6`} /></label><div className="mt-3 flex justify-end gap-2"><button type="button" disabled={savePhase === 'saving'} onClick={() => { onChange({ ...questionState, standardAnswer: answerSnapshot }); setEditingAnswer(false); }} className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-500 dark:border-zinc-700">取消</button><button type="button" disabled={savePhase === 'saving'} onClick={() => void onSaveDraft().then(() => { setAnswerSnapshot(questionState.standardAnswer); setEditingAnswer(false); })} className="flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><Save className="h-3.5 w-3.5" />{savePhase === 'saving' ? '保存中...' : '保存标准答案'}</button></div></> : <p className="min-h-28 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-slate-200">{questionState.standardAnswer || '待教师补充'}</p>}</div>{answerEvidence ? <SourceEvidenceViewer evidence={answerEvidence} label="标准答案来源" /> : null}</div>{questionState.standardAnswerOcrText ? <p className="text-[11px] text-slate-400">OCR 原文：{questionState.standardAnswerOcrText}</p> : null}</div>
      <div className="space-y-3">
        <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-100"><Sparkles className="h-4 w-4 text-emerald-700" />AI 识别的采分点</span><span className="text-xs text-slate-400">可直接编辑</span></div>
        {questionState.gradingRubric.map((point, index) => (
          <div key={`${point.point}-${index}`} className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-[minmax(0,1fr)_80px_36px] dark:border-zinc-800 dark:bg-zinc-900/60">
            <div className="space-y-2"><input value={point.point} onChange={event => onChange({ ...questionState, gradingRubric: questionState.gradingRubric.map((item, itemIndex) => itemIndex === index ? { ...item, point: event.target.value } : item) })} className="w-full bg-transparent text-sm font-bold outline-none" /><input value={point.description} onChange={event => onChange({ ...questionState, gradingRubric: questionState.gradingRubric.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item) })} className="w-full bg-transparent text-xs text-slate-500 outline-none" /></div>
            <label className="flex items-center gap-1 text-xs font-bold text-slate-500"><input type="number" value={point.score} onChange={event => onChange({ ...questionState, gradingRubric: questionState.gradingRubric.map((item, itemIndex) => itemIndex === index ? { ...item, score: Number(event.target.value) } : item) })} className="w-14 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-right dark:border-zinc-700 dark:bg-zinc-800" />分</label>
            <button type="button" title="删除采分点" aria-label="删除采分点" onClick={() => onChange({ ...questionState, gradingRubric: questionState.gradingRubric.filter((_, itemIndex) => itemIndex !== index) })} className="rounded-xl p-2 text-slate-400 hover:bg-rose-100 hover:text-rose-700"><X className="h-4 w-4" /></button>
          </div>
        ))}
        <button type="button" onClick={() => onChange({ ...questionState, gradingRubric: [...questionState.gradingRubric, { point: '新采分点', score: 2, description: '补充命中条件' }] })} className="flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50"><Plus className="h-3.5 w-3.5" />添加采分点</button>
      </div>
      <div className="space-y-3">
        <div><span className="text-sm font-black text-slate-800 dark:text-slate-100">教师评分细则</span><p className="mt-1 text-xs text-slate-500">可直接补充同义表达、扣分、封顶和特殊答案规则。</p></div>
        {questionState.teacherRules.map((rule, index) => <div key={`${rule}-${index}`} className="flex items-start gap-2 rounded-2xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-100"><BookOpenCheck className="mt-0.5 h-4 w-4 flex-none" /><span className="flex-1 leading-5">{rule}</span><button type="button" title="删除评分细则" aria-label="删除评分细则" onClick={() => onChange({ ...questionState, teacherRules: questionState.teacherRules.filter((_, itemIndex) => itemIndex !== index) })} className="rounded-xl p-1 text-amber-600 hover:bg-amber-100"><X className="h-3.5 w-3.5" /></button></div>)}
        <div className="flex gap-2"><input value={newRule} onChange={event => setNewRule(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') addRule(); }} placeholder="例如：“好人好事代代相传”也算分" className={inputClass} /><button type="button" onClick={addRule} className="rounded-2xl border border-slate-200 px-4 text-sm font-bold hover:bg-slate-50 dark:border-zinc-700">添加</button></div>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-zinc-800"><button type="button" disabled={!dirty || savePhase === 'saving'} onClick={onCancel} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-500 disabled:opacity-40 dark:border-zinc-700">取消修改</button><button type="button" disabled={savePhase === 'saving'} onClick={onSaveDraft} className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 disabled:opacity-50 dark:border-zinc-700 dark:text-slate-300"><Save className="h-4 w-4" />{savePhase === 'saving' ? '保存中...' : '保存草稿'}</button><button type="button" disabled={savePhase === 'saving'} onClick={onApply} className="flex items-center gap-2 rounded-2xl border border-emerald-700 px-4 py-2.5 text-sm font-bold text-emerald-700 disabled:opacity-50"><RefreshCw className="h-4 w-4" />保存并应用到试批</button><button type="button" onClick={canEnterTrial ? onEnterTrial : onCompleteIntake} className="flex items-center gap-1 rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800">{canEnterTrial ? '进入试批' : '先完成上传质检'}<ChevronRight className="h-4 w-4" /></button></div>
    </div>
  );
}

function SubmissionPreview({ page, asset, document, validation, validationPhase, validationError, humanThreshold, autoThreshold, onClose, onConfirm, onRunVision }: { page: SubmissionPage; asset?: DocumentAsset; document?: NonNullable<WorkflowState['assignment']['documents']>[number]; validation?: VisionValidationResult; validationPhase: 'idle' | 'loading' | 'ready' | 'error'; validationError?: string; humanThreshold: number; autoThreshold: number; onClose: () => void; onConfirm: (studentNo: string) => void; onRunVision: () => void }) {
  const [studentNo, setStudentNo] = useState(page.detectedStudentNo);
  const previewUrl = asset ? `/api/grading-tasks/${encodeURIComponent(asset.taskId)}/materials/${encodeURIComponent(asset.id)}/content` : undefined;
  const needsIdentityReview = page.rosterMatchStatus !== 'matched';
  const visionReady = document?.resources.some(resource => resource.role === 'source-page') ?? false;
  const signals = [
    ['学号识别', page.studentNoConfidence ?? page.ocrConfidence],
    ['文字识别', page.textConfidence ?? page.ocrConfidence],
    ['区域完整性', page.regionCompleteness ?? 1],
    ['页面连续性', page.pageContinuity ?? 1]
  ] as const;
  return (
    <div className="m-3 rounded-[24px] border border-emerald-200 bg-emerald-50/40 p-5 dark:border-emerald-900 dark:bg-emerald-950/10">
      <div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-slate-900 dark:text-white">{page.expectedStudentName} · 原始答卷</h3><p className={`mt-1 text-xs ${needsIdentityReview ? 'text-rose-700' : 'text-slate-500'}`}>{page.rosterIssueReason ?? page.issueReason ?? asset?.fileName ?? '已匹配当前班级名册。'}</p></div><button type="button" title="收起" aria-label="收起" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-white"><X className="h-4 w-4" /></button></div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-h-[480px] overflow-hidden border border-slate-300 bg-white shadow-sm">{previewUrl ? (asset?.mimeType === 'application/pdf' ? <object data={previewUrl} type="application/pdf" className="h-[620px] w-full"><a href={previewUrl} target="_blank" rel="noreferrer" className="p-4 text-sm font-bold text-emerald-700">打开原始 PDF</a></object> : <img src={previewUrl} alt={`${page.expectedStudentName} 原始答卷`} className="max-h-[620px] w-full object-contain" />) : <div className="flex h-full items-center justify-center text-sm text-slate-400">原文件不可用</div>}</div>
        <div><div className="grid grid-cols-2 gap-2">{signals.map(([label, value]) => <div key={label} className="rounded-2xl bg-white p-3 dark:bg-zinc-900"><span className="text-[11px] font-bold text-slate-500">{label}</span><strong className="mt-1 block text-lg">{value > 0 ? `${Math.round(value * 100)}%` : '未提供'}</strong></div>)}</div>{needsIdentityReview ? <><label className="mt-4 block text-xs font-black text-slate-600">确认班内学号</label><input value={studentNo} onChange={event => setStudentNo(event.target.value)} className={`${inputClass} mt-2 font-mono`} /></> : <div className="mt-4 rounded-lg bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-800">已按姓名匹配：{page.expectedStudentName}（{page.detectedStudentNo}）</div>}<p className="mt-3 text-[11px] leading-5 text-slate-500"><Info className="mr-1 inline h-3 w-3" />{Math.round(humanThreshold * 100)}%–{Math.round(autoThreshold * 100)}% 先由多模态模型核验；缺页和错配始终人工确认。</p></div>
      </div>
      <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold dark:border-zinc-700 dark:bg-zinc-900">收起</button>{needsIdentityReview ? <button type="button" onClick={() => onConfirm(studentNo)} className="rounded-2xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800">重新匹配</button> : null}</div>
      <section className="mt-5 border-t border-emerald-200 pt-5 dark:border-emerald-900">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="text-sm font-black">逐题答案识别</h4><p className="mt-1 text-xs text-slate-500">按当前评分题目裁图识别，结果作为试批的首选答案。</p></div><button type="button" disabled={!visionReady || validationPhase === 'loading'} onClick={onRunVision} className="rounded-2xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{validationPhase === 'loading' ? 'Luna 正在逐字识别...' : validation ? '重新识别' : '开始识别'}</button></div>
        {!visionReady ? <p className="mt-3 text-xs font-bold text-amber-700">这份答卷尚未保留 Paddle 原始坐标，需要重新解析后才能裁图。</p> : null}
        {validationPhase === 'error' ? <p className="mt-3 text-xs font-bold text-rose-700">逐题识别失败（{validationError}）</p> : null}
        {validation ? <div className="mt-4 grid gap-3 lg:grid-cols-2">{validation.items.map(item => <VisionItemCard key={item.displayNo} item={item} />)}</div> : null}
      </section>
    </div>
  );
}

export default function GradingWorkflow({
  workflowState,
  classes,
  selectedTask,
  knowledgeNodes,
  reviewQueue,
  lowConfidenceThreshold,
  ocrHumanReviewThreshold,
  ocrAutoPassThreshold,
  onBack,
  onUpdateTask,
  onUpdateState,
  onSyncToProfiles,
  onConfirmReview,
  onBounceToOcr,
  onMarkAsSample,
  onShowToast
}: GradingWorkflowProps) {
  const initialQuestionStates = workflowState.questionGradingStates ?? workflowState.questions.map(question => ({
    questionId: question.id,
    standardAnswer: workflowState.standardAnswer,
    gradingRubric: workflowState.gradingRubric,
    teacherRules: workflowState.teacherRules ?? [],
    rubricVersion: workflowState.rubricVersion ?? 1,
    sampleTarget: 3 as const,
    calibrationSamples: (workflowState.calibrationSamples ?? []).map(sample => ({ ...sample, questionId: question.id, fullScore: question.score })),
    jointReviewEnabled: (workflowState.jointReviewQuestionIds ?? []).includes(question.id)
  }));
  const [activeStage, setActiveStage] = useState<StageId>(() => getInitialStage(selectedTask.node));
  const [questionStates, setQuestionStates] = useState<QuestionGradingState[]>(initialQuestionStates);
  const [selectedQuestionId, setSelectedQuestionId] = useState(workflowState.questions[0]?.id ?? '');
  const [selectedSampleId, setSelectedSampleId] = useState(initialQuestionStates[0]?.calibrationSamples[0]?.id ?? '');
  const [editedOcr, setEditedOcr] = useState(initialQuestionStates[0]?.calibrationSamples[0] ? getEffectiveOcrText(initialQuestionStates[0].calibrationSamples[0]) : '');
  const [gradingAction, setGradingAction] = useState<'none' | 'adjust' | 'manual'>('none');
  const [teacherScore, setTeacherScore] = useState(0);
  const [teacherReason, setTeacherReason] = useState('');
  const [gradingMode, setGradingMode] = useState<GradingMode>(workflowState.gradingMode ?? 'batch-checkpoint');
  const [showModeDialog, setShowModeDialog] = useState(false);
  const [showOnlyOcrIssues, setShowOnlyOcrIssues] = useState(false);
  const [expandedOcrPageId, setExpandedOcrPageId] = useState<string | null>(null);
  const [ruleAddedNotice, setRuleAddedNotice] = useState(false);
  const [rubricSavePhase, setRubricSavePhase] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [gradedCount, setGradedCount] = useState(() => workflowState.aiResults.length ? 36 : 0);
  const [isPaused, setIsPaused] = useState(false);
  const [diagnosisConfirmed, setDiagnosisConfirmed] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisQuestionNo, setAnalysisQuestionNo] = useState(workflowState.assignment.firstSectionAnalysis?.questions[0]?.displayNo ?? '');
  const [questionSelectionDraft, setQuestionSelectionDraft] = useState<string[]>(selectedTask.selectedQuestionIds ?? workflowState.assignment.selectedQuestionIds ?? workflowState.questions.map(question => question.id));
  const [questionSelectionSaving, setQuestionSelectionSaving] = useState(false);
  const [questionSelectionEditing, setQuestionSelectionEditing] = useState(!selectedTask.selectedQuestionIds?.length);
  const [analysisStartedAt, setAnalysisStartedAt] = useState<number | null>(null);
  const [analysisElapsedSeconds, setAnalysisElapsedSeconds] = useState(0);
  const [rosterClass, setRosterClass] = useState<SchoolClass | null>(null);
  const [classRoster, setClassRoster] = useState<RosterStudent[]>([]);
  const [rosterMatchPhase, setRosterMatchPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [rosterMatchError, setRosterMatchError] = useState<string | null>(null);
  const [rosterRefreshKey, setRosterRefreshKey] = useState(0);
  const [submissionFiles, setSubmissionFiles] = useState<File[]>([]);
  const [submissionUploadPhase, setSubmissionUploadPhase] = useState<'idle' | 'uploading' | 'parsing' | 'error'>('idle');
  const [submissionUploadError, setSubmissionUploadError] = useState<string | null>(null);
  const [trialGradingPhase, setTrialGradingPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [trialGradingError, setTrialGradingError] = useState<string | null>(null);
  const [trialProgress, setTrialProgress] = useState<{ phase: 'idle' | 'recognition' | 'grading' | 'complete' | 'error'; completed: number; total: number; currentLabel: string; startedAt: number | null; elapsedSeconds: number }>({ phase: 'idle', completed: 0, total: 0, currentLabel: '', startedAt: null, elapsedSeconds: 0 });
  const [visionValidationByAsset, setVisionValidationByAsset] = useState<Record<string, VisionValidationResult>>({});
  const [visionValidationPhase, setVisionValidationPhase] = useState<Record<string, 'idle' | 'loading' | 'ready' | 'error'>>({});
  const [visionValidationError, setVisionValidationError] = useState<Record<string, string>>({});
  const [batch, setBatch] = useState<GradingBatch | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchQuestionId, setBatchQuestionId] = useState('');
  const [batchStudentId, setBatchStudentId] = useState('');
  const [diagnosis, setDiagnosis] = useState<GradingDiagnosis | null>(null);
  const [reviewStage, setReviewStage] = useState<'all' | 'intake' | 'calibration' | 'grading' | 'teacher' | 'resolved'>('all');
  const [reviewSampleId, setReviewSampleId] = useState<string | null>(null);
  const [ocrCorrectionPhase, setOcrCorrectionPhase] = useState<'idle' | 'saving'>('idle');
  const [reviewEditedOcr, setReviewEditedOcr] = useState('');
  const [reviewScore, setReviewScore] = useState(0);
  const [reviewReason, setReviewReason] = useState('');
  const [reviewSaving, setReviewSaving] = useState<'idle' | 'ocr' | 'decision'>('idle');

  const currentClass = rosterClass ?? classes.find(item => item.id === selectedTask.classId) ?? null;
  const selectedQuestionIds = selectedTask.selectedQuestionIds ?? workflowState.assignment.selectedQuestionIds ?? workflowState.questions.map(question => question.id);
  const selectedQuestions = workflowState.questions.filter(question => selectedQuestionIds.includes(question.id));
  const selectedQuestionStates = questionStates.filter(state => selectedQuestionIds.includes(state.questionId));
  const currentQuestion = selectedQuestions.find(item => item.id === selectedQuestionId) ?? selectedQuestions[0] ?? workflowState.questions[0];
  const currentQuestionState = selectedQuestionStates.find(item => item.questionId === selectedQuestionId) ?? selectedQuestionStates[0] ?? questionStates[0];
  const persistedCurrentQuestionState = workflowState.questionGradingStates?.find(item => item.questionId === currentQuestionState?.questionId);
  const questionEvidence = currentQuestion?.sourceEvidenceIds.map(id => workflowState.sourceEvidence.find(item => item.id === id)).find(Boolean);
  const answerEvidence = currentQuestionState?.standardAnswerSourceIds?.map(id => workflowState.sourceEvidence.find(item => item.id === id)).find(Boolean);
  const currentTrialSamples = currentQuestionState?.calibrationSamples.slice(0, currentQuestionState.sampleTarget) ?? [];
  const selectedSample = currentTrialSamples.find(sample => sample.id === selectedSampleId) ?? currentTrialSamples[0];
  const matchRows = workflowState.submissionPages ?? [];
  const issueRows = matchRows.filter(row => row.status !== 'matched' || row.rosterMatchStatus !== 'matched');
  const displayedRows = showOnlyOcrIssues ? issueRows : matchRows;
  const missingRows = workflowState.missingSubmissions ?? [];
  const trialSamples = selectedQuestionStates.flatMap(state => state.calibrationSamples);
  const reviewSamples = trialSamples.filter(sample => sample.needsTeacherReview || sample.recognitionConflict || sample.gradingConfidence < lowConfidenceThreshold);
  const pendingReviewSamples = reviewSamples.filter(sample => sample.status !== 'confirmed');
  const resolvedReviewSamples = reviewSamples.filter(sample => sample.status === 'confirmed');
  const visibleReviewSamples = reviewStage === 'resolved' ? resolvedReviewSamples : reviewStage === 'all' || reviewStage === 'calibration' ? pendingReviewSamples : [];
  const selectedReviewSample = reviewSamples.find(sample => sample.id === reviewSampleId) ?? null;
  const pendingReviews = pendingReviewSamples.length;
  const allCalibrationComplete = selectedQuestionStates.length > 0 && selectedQuestionStates.every(state => state.calibrationSamples.slice(0, state.sampleTarget).every(sample => sample.status === 'confirmed'));
  const batchSamples = selectedQuestionStates.flatMap(state => state.calibrationSamples);
  const activeBatchQuestionId = batchQuestionId || selectedQuestionStates[0]?.questionId || '';
  const batchStudents = [...batchSamples.reduce((students, sample) => students.set(sample.studentId, sample), new Map<string, CalibrationSample>()).values()];
  const activeBatchStudentId = batchStudentId || batchStudents[0]?.studentId || '';
  const selectedBatchSample = batchSamples.find(sample => sample.questionId === activeBatchQuestionId && sample.studentId === activeBatchStudentId);
  const assignmentReady = workflowState.assignment.status === 'assigned';
  const gradingDataReady = selectedQuestions.length > 0 && matchRows.length > 0 && rosterMatchPhase === 'ready' && !issueRows.some(row => row.rosterMatchStatus !== 'matched');
  const normalizedDocuments = workflowState.assignment.documents ?? [];
  const assignmentAssets = workflowState.assignment.assets.filter(asset => asset.kind === 'assignment' || asset.kind === 'reference-answer');
  const assignmentAssetIds = new Set(assignmentAssets.map(asset => asset.id));
  const assignmentDocuments = normalizedDocuments.filter(document => assignmentAssetIds.has(document.assetId));
  const activeClassRoster = classRoster.filter(student => student.enrollmentStatus === 'active');
  const expectedStudentCount = rosterMatchPhase === 'ready' ? activeClassRoster.length : currentClass?.studentCount ?? 0;
  const currentClassName = currentClass?.name ?? selectedTask.className;
  const matchedStudentCount = new Set(matchRows.filter(row => row.rosterMatchStatus === 'matched').map(row => row.studentId).filter(Boolean)).size;
  const submissionRosterInputKey = matchRows.map(page => `${page.id}:${page.detectedStudentNo}`).join('|');
  const submissionAssets = workflowState.assignment.assets.filter(asset => asset.kind === 'student-submission');
  const questionSelectionLocked = Boolean(selectedTask.questionScopeConfirmedAt || submissionAssets.length > 0);
  const allQuestionsSelected = workflowState.questions.length > 0 && questionSelectionDraft.length === workflowState.questions.length;
  const questionSelectionDirty = JSON.stringify([...questionSelectionDraft].sort()) !== JSON.stringify([...selectedQuestionIds].sort());
  const submissionMaterialKey = submissionAssets.map(asset => `${asset.id}:${asset.status}`).join('|');
  const rubricDirty = Boolean(currentQuestionState && persistedCurrentQuestionState && JSON.stringify({ standardAnswer: currentQuestionState.standardAnswer, gradingRubric: currentQuestionState.gradingRubric, teacherRules: currentQuestionState.teacherRules }) !== JSON.stringify({ standardAnswer: persistedCurrentQuestionState.standardAnswer, gradingRubric: persistedCurrentQuestionState.gradingRubric, teacherRules: persistedCurrentQuestionState.teacherRules }));

  const updateAssignment = (updated: Partial<WorkflowState['assignment']>) => {
    onUpdateState({ assignment: { ...workflowState.assignment, ...updated } });
  };

  const gradingQuestions = () => selectedQuestions.map(question => {
    const state = questionStates.find(item => item.questionId === question.id);
    return { questionId: question.id, displayNo: question.displayNo, stem: question.stem ?? question.desc, fullScore: question.score, standardAnswer: state?.standardAnswer ?? '', rubricPoints: state?.gradingRubric ?? [], teacherRules: [...(state?.teacherRules ?? []), ...(workflowState.assignment.note.trim() ? [`本次批改补充要求：${workflowState.assignment.note.trim()}`] : [])], rubricVersion: state?.rubricVersion ?? 1 };
  });

  const gradingSubmissions = () => matchRows.filter(page => page.rosterMatchStatus === 'matched' && page.studentId).map(page => ({ assetId: page.id, studentId: page.studentId!, studentName: page.expectedStudentName, studentNo: page.detectedStudentNo }));

  useEffect(() => {
    if (!isAnalyzing || !analysisStartedAt) return;
    const timer = window.setInterval(() => setAnalysisElapsedSeconds(Math.floor((Date.now() - analysisStartedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [isAnalyzing, analysisStartedAt]);

  useEffect(() => {
    if (trialProgress.phase !== 'recognition' && trialProgress.phase !== 'grading') return;
    const timer = window.setInterval(() => setTrialProgress(current => current.startedAt ? { ...current, elapsedSeconds: Math.floor((Date.now() - current.startedAt) / 1000) } : current), 1000);
    return () => window.clearInterval(timer);
  }, [trialProgress.phase]);

  useEffect(() => {
    let active = true;
    void Promise.all([getTaskMaterials(selectedTask.id), getTaskAnalysis(selectedTask.id), getTaskTrialGrading(selectedTask.id), getTaskRubrics(selectedTask.id)]).then(([materials, analysis, trialResult, savedRubrics]) => {
      if (!active || (!materials.assets.length && !analysis)) return;
      const questionFileNames = materials.assets.filter(asset => asset.kind === 'assignment').map(asset => asset.fileName);
      const answerFileNames = materials.assets.filter(asset => asset.kind === 'reference-answer').map(asset => asset.fileName);
      const assignmentAssets = materials.assets.filter(asset => asset.kind !== 'student-submission');
      const needsReview = assignmentAssets.some(asset => asset.status === 'needs-review');
      const derivedWorkflow = analysis ? buildWorkflowFromAnalysis(selectedTask.id, analysis, savedRubrics) : undefined;
      if (derivedWorkflow) {
        const usableTrialResult = trialResult?.samples.every(sample => sample.sourcePreviewType === 'image') ? trialResult : null;
        const restoredStates = applyTrialSamples(derivedWorkflow.questionGradingStates, usableTrialResult);
        const firstSample = restoredStates[0]?.calibrationSamples[0];
        setQuestionStates(restoredStates);
        setSelectedQuestionId(derivedWorkflow.questions[0]?.id ?? '');
        setSelectedSampleId(firstSample?.id ?? '');
        setEditedOcr(firstSample ? getEffectiveOcrText(firstSample) : '');
        setTrialGradingPhase(usableTrialResult ? 'ready' : 'idle');
      }
      onUpdateState({
        assignment: {
          ...workflowState.assignment,
          status: selectedTask.questionScopeConfirmedAt || materials.assets.some(asset => asset.kind === 'student-submission') ? 'assigned' : workflowState.assignment.status,
          questionFileNames,
          answerFileNames,
          assets: materials.assets,
          documents: materials.documents,
          firstSectionAnalysis: analysis ?? undefined,
          selectedQuestionIds: selectedTask.selectedQuestionIds ?? workflowState.assignment.selectedQuestionIds,
          analysisStatus: needsReview ? 'needs-review' : assignmentAssets.length ? 'ready' : workflowState.assignment.analysisStatus
        },
        ...(derivedWorkflow ?? {})
      });
      if (derivedWorkflow) {
        setQuestionSelectionDraft(selectedTask.selectedQuestionIds ?? workflowState.assignment.selectedQuestionIds ?? derivedWorkflow.questions.map(question => question.id));
        setQuestionSelectionEditing(!selectedTask.selectedQuestionIds?.length && !selectedTask.questionScopeConfirmedAt);
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [selectedTask.id]);

  useEffect(() => {
    void getBatchGrading(selectedTask.id).then(result => {
      setBatch(result);
      if (result.status !== 'idle') setGradingMode(result.mode);
    }).catch(() => undefined);
  }, [selectedTask.id]);

  useEffect(() => {
    if (activeStage !== 'diagnosis') return;
    void getGradingDiagnosis(selectedTask.id, selectedQuestions).then(setDiagnosis).catch(() => setDiagnosis(null));
  }, [activeStage, selectedTask.id, workflowState.questions, workflowState.assignment.selectedQuestionIds]);

  useEffect(() => {
    if (!selectedReviewSample) return;
    const previousOverflow = document.body.style.overflow;
    const main = document.querySelector('main');
    const previousMainOverflow = main instanceof HTMLElement ? main.style.overflow : '';
    document.body.style.overflow = 'hidden';
    if (main instanceof HTMLElement) main.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      if (main instanceof HTMLElement) main.style.overflow = previousMainOverflow;
    };
  }, [selectedReviewSample]);

  useEffect(() => {
    let active = true;
    setRosterMatchPhase('loading');
    setRosterMatchError(null);
    void Promise.all([
      listRosterClasses(),
      listRosterStudents(selectedTask.classId)
    ]).then(([schoolClasses, students]) => {
      if (!active) return;
      const selectedClass = schoolClasses.find(item => item.id === selectedTask.classId);
      if (!selectedClass) throw new Error('CLASS_NOT_FOUND');
      setRosterClass(selectedClass);
      setClassRoster(students);
      setRosterMatchPhase('ready');
    }).catch(error => {
      if (!active) return;
      setRosterClass(null);
      setClassRoster([]);
      setRosterMatchPhase('error');
      setRosterMatchError(error instanceof Error ? error.message : 'ROSTER_MATCH_FAILED');
    });
    return () => { active = false; };
  }, [selectedTask.id, selectedTask.classId, rosterRefreshKey]);

  useEffect(() => {
    if (rosterMatchPhase !== 'ready') return;
    let active = true;
    const submissionAssetIds = new Set(submissionAssets.map(asset => asset.id));
    const storedDocuments = normalizedDocuments.filter(document => submissionAssetIds.has(document.assetId));
    const rowsMatchStoredAssets = matchRows.length === submissionAssets.length
      && matchRows.every(page => submissionAssetIds.has(page.id));
    const pagesToMatch = submissionAssets.length && !rowsMatchStoredAssets
      ? buildSubmissionPages(submissionAssets, storedDocuments, classRoster)
      : matchRows;
    if (submissionAssets.length && !rowsMatchStoredAssets) {
      onUpdateState({ submissionPages: pagesToMatch });
    }
    void matchRosterSubmissions(selectedTask.classId, getReadableStudentNos(pagesToMatch)).then(match => {
      if (!active) return;
      const reconciled = reconcileSubmissionRoster(pagesToMatch, match);
      onUpdateState({
        submissionPages: reconciled.pages,
        missingSubmissions: reconciled.missingSubmissions
      });
    }).catch(error => {
      if (!active) return;
      setRosterMatchPhase('error');
      setRosterMatchError(error instanceof Error ? error.message : 'ROSTER_MATCH_FAILED');
    });
    return () => { active = false; };
  }, [selectedTask.id, selectedTask.classId, submissionRosterInputKey, submissionMaterialKey, normalizedDocuments.length, rosterMatchPhase, rosterRefreshKey]);

  const confirmSubmissionStudentNo = (pageId: string, studentNo: string) => {
    onUpdateState({
      submissionPages: matchRows.map(page => page.id === pageId
        ? { ...page, detectedStudentNo: studentNo.trim(), rosterMatchStatus: 'pending', rosterIssueReason: undefined }
        : page)
    });
    setExpandedOcrPageId(null);
    onShowToast('学号已更新，正在按当前班级名册重新匹配');
  };

  const currentQuestionNos = [...new Set(selectedQuestions
    .map(question => question.displayNo.match(/^\d+/)?.[0])
    .filter((value): value is string => Boolean(value)))];

  const openSubmissionPreview = (assetId: string) => {
    setExpandedOcrPageId(current => current === assetId ? null : assetId);
    if (visionValidationByAsset[assetId]) return;
    void getVisionValidation(selectedTask.id, assetId).then(result => {
      if (result) {
        setVisionValidationByAsset(current => ({ ...current, [assetId]: result }));
        setVisionValidationPhase(current => ({ ...current, [assetId]: 'ready' }));
        return;
      }
      void validateSubmissionVision(assetId, false);
    }).catch(() => undefined);
  };

  const validateSubmissionVision = async (assetId: string, notify = true) => {
    setVisionValidationPhase(current => ({ ...current, [assetId]: 'loading' }));
    setVisionValidationError(current => ({ ...current, [assetId]: '' }));
    try {
      const result = await runVisionValidation(selectedTask.id, assetId, currentQuestionNos);
      setVisionValidationByAsset(current => ({ ...current, [assetId]: result }));
      setVisionValidationPhase(current => ({ ...current, [assetId]: 'ready' }));
      if (notify) onShowToast('Luna 已完成当前题目的原图识别');
    } catch (error) {
      const code = error instanceof Error ? error.message : 'VISION_VALIDATION_FAILED';
      setVisionValidationPhase(current => ({ ...current, [assetId]: 'error' }));
      setVisionValidationError(current => ({ ...current, [assetId]: code }));
      if (notify) onShowToast(code === 'VISION_VALIDATION_INPUT_NOT_READY' ? '该答卷需要重新解析后才能按题识别' : '原图识别失败，请检查模型服务');
    }
  };

  const selectSubmissionFiles = (fileList: FileList | null) => {
    const files = getFiles(fileList);
    if (!files.length) return;
    if (files.length > 20) {
      onShowToast('单次最多上传 20 个答卷文件');
      return;
    }
    setSubmissionFiles(files);
    setSubmissionUploadPhase('idle');
    setSubmissionUploadError(null);
    onUpdateState({ uploadedCount: files.length });
  };

  const submitStudentSubmissions = async () => {
    if (!submissionFiles.length) return;
    setSubmissionUploadPhase('uploading');
    setSubmissionUploadError(null);
    try {
      const uploaded = await uploadTaskMaterials(selectedTask.id, 'student-submission', submissionFiles);
      const assets = [...workflowState.assignment.assets, ...uploaded];
      onUpdateState({
        assignment: { ...workflowState.assignment, assets },
        submissionPages: [],
        missingSubmissions: []
      });
      setSubmissionUploadPhase('parsing');
      const result = await waitForTaskMaterials(selectedTask.id, uploaded.map(asset => asset.id));
      onUpdateState({
        assignment: {
          ...workflowState.assignment,
          assets: result.assets,
          documents: result.documents
        },
        submissionPages: [],
        uploadedCount: uploaded.length
      });
      setSubmissionFiles([]);
      setSubmissionUploadPhase('idle');
      onShowToast(`已上传并解析 ${uploaded.length} 个答卷文件，正在匹配五班名册`);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'SUBMISSION_UPLOAD_FAILED';
      setSubmissionUploadPhase('error');
      setSubmissionUploadError(code);
      onShowToast('答卷上传或解析失败，请检查文件后重试');
    }
  };

  const handleMaterialFiles = async (kind: 'assignment' | 'reference-answer', fileList: FileList | null) => {
    const files = getFiles(fileList);
    if (!files.length) return;
    const names = files.map(file => file.name);
    updateAssignment({ analysisStatus: 'uploading', ...(kind === 'assignment' ? { questionFileNames: names } : { answerFileNames: names }) });
    try {
      const uploaded = await uploadTaskMaterials(selectedTask.id, kind, files);
      const assets = [...workflowState.assignment.assets.filter(asset => asset.kind !== kind), ...uploaded];
      updateAssignment({ assets, analysisStatus: 'parsing' });
      const result = await waitForTaskMaterials(selectedTask.id, uploaded.map(asset => asset.id));
      const needsReview = result.documents.some(document => document.warnings.length > 0);
      onUpdateState({
        assignment: {
          ...workflowState.assignment,
          ...(kind === 'assignment' ? { questionFileNames: names } : { answerFileNames: names }),
          assets: result.assets,
          documents: result.documents,
          analysisStatus: needsReview ? 'needs-review' : 'ready'
        }
      });
      onShowToast(needsReview ? '材料解析完成，存在需要检查的内容' : `已解析 ${result.documents.length} 份材料`);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'MATERIAL_PARSE_FAILED';
      updateAssignment({ analysisStatus: 'failed' });
      const messageByCode: Record<string, string> = {
        DOCX_PARSER_NOT_INSTALLED: 'DOCX 解析环境尚未安装',
        PADDLEOCR_NOT_CONFIGURED: 'PaddleOCR API 尚未配置',
        PADDLEOCR_AUTH_FAILED: 'PaddleOCR Token 无效',
        PADDLEOCR_INVALID_REQUEST: 'PaddleOCR 无法处理当前文件',
        PADDLEOCR_RATE_LIMITED: 'PaddleOCR API 当前额度或频率受限',
        PADDLEOCR_TIMEOUT: 'PaddleOCR 解析超时，请稍后重试',
        MATERIAL_PARSE_TIMEOUT: '材料解析等待超时，请稍后重试'
      };
      onShowToast(messageByCode[code] ?? '材料解析失败，请检查文件后重试');
    }
  };

  const completeAssignment = async () => {
    if (!workflowState.assignment.questionFileNames.length && !workflowState.assignment.note.trim()) {
      onShowToast('请先上传作业题目，或填写作业内容');
      return;
    }
    if (workflowState.assignment.assets.some(asset => asset.kind === 'assignment') && !workflowState.assignment.firstSectionAnalysis) {
      onShowToast('请先完成整份作业拆题，再确认本次批改范围');
      return;
    }
    if (workflowState.assignment.firstSectionAnalysis && !selectedQuestionIds.length) {
      onShowToast('请至少选择一道本次需要批改的题目');
      return;
    }
    if (questionSelectionDirty) {
      onShowToast('题目范围有未保存修改，请先保存');
      return;
    }
    const confirmedAt = new Date().toISOString();
    try {
      await onUpdateTask({ ...selectedTask, node: 'collection', nodeName: '等待收取作业', questionScopeConfirmedAt: confirmedAt });
      updateAssignment({ status: 'assigned' });
      setQuestionSelectionEditing(false);
      onShowToast('作业已布置，题目范围已锁定');
    } catch {
      onShowToast('确认布置失败，请重试');
    }
  };

  const analyzeAssignment = async () => {
    const hasQuestion = workflowState.assignment.assets.some(asset => asset.kind === 'assignment' && (asset.status === 'ready' || asset.status === 'needs-review'));
    const hasAnswer = workflowState.assignment.assets.some(asset => asset.kind === 'reference-answer' && (asset.status === 'ready' || asset.status === 'needs-review'));
    if (!hasQuestion || !hasAnswer) {
      onShowToast('请先完成题目和参考答案解析');
      return;
    }
    setIsAnalyzing(true);
    const startedAt = Date.now();
    setAnalysisStartedAt(startedAt);
    setAnalysisElapsedSeconds(0);
    try {
      const analysis = await analyzeTaskMaterials(selectedTask.id, knowledgeNodes);
      const savedRubrics = await getTaskRubrics(selectedTask.id);
      const derivedWorkflow = buildWorkflowFromAnalysis(selectedTask.id, analysis, savedRubrics);
      setQuestionStates(derivedWorkflow.questionGradingStates);
      setSelectedQuestionId(derivedWorkflow.questions[0]?.id ?? '');
      setAnalysisQuestionNo(analysis.questions[0]?.displayNo ?? '');
      onUpdateState({ assignment: { ...workflowState.assignment, firstSectionAnalysis: analysis, selectedQuestionIds: derivedWorkflow.questions.map(question => question.id) }, ...derivedWorkflow });
      await onUpdateTask({ ...selectedTask, selectedQuestionIds: derivedWorkflow.questions.map(question => question.id), questionScopeConfirmedAt: undefined });
      setQuestionSelectionEditing(true);
      onShowToast(`拆题完成，共识别 ${analysis.questions.length} 道一级题`);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'ANALYSIS_FAILED';
      const messageByCode: Record<string, string> = {
        MODEL_NOT_CONFIGURED: 'AI 模型尚未配置',
        MODEL_OUTPUT_INVALID: '模型返回结构不完整，请重新分析',
        ASSIGNMENT_MATERIAL_REQUIRED: '缺少已解析的题目材料',
        REFERENCE_ANSWER_REQUIRED: '缺少已解析的参考答案',
        MATERIALS_NOT_READY: '材料仍在解析，请稍后再试'
      };
      onShowToast(messageByCode[code] ?? 'AI 拆题失败，请检查模型配置');
    } finally {
      setIsAnalyzing(false);
      setAnalysisStartedAt(null);
    }
  };

  const startSubmissionUpload = () => {
    onUpdateTask({ ...selectedTask, node: 'upload', nodeName: '待上传作业' });
    setActiveStage('intake');
  };

  const selectQuestion = (questionId: string) => {
    const nextState = questionStates.find(item => item.questionId === questionId);
    const trialSamples = nextState?.calibrationSamples.slice(0, nextState.sampleTarget) ?? [];
    const nextSample = trialSamples.find(sample => sample.status === 'pending') ?? trialSamples[0];
    setSelectedQuestionId(questionId);
    setSelectedSampleId(nextSample?.id ?? '');
    setEditedOcr(nextSample?.ocrText ?? '');
    setTeacherScore(nextSample?.teacherScore ?? nextSample?.aiScore ?? 0);
    setTeacherReason(nextSample?.teacherReason ?? '');
    setGradingAction('none');
    setRuleAddedNotice(false);
    setRubricSavePhase('idle');
  };

  const updateQuestionState = (next: QuestionGradingState) => {
    setQuestionStates(current => current.map(item => item.questionId === next.questionId ? next : item));
    setRubricSavePhase('idle');
  };

  const toggleQuestionSelection = (displayNo: string) => {
    const question = workflowState.questions.find(item => item.displayNo === displayNo);
    if (!question) return;
    setQuestionSelectionDraft(current => current.includes(question.id)
      ? current.filter(id => id !== question.id)
      : [...current, question.id]);
  };

  const toggleAllQuestions = () => {
    const allQuestionIds = workflowState.questions.map(question => question.id);
    setQuestionSelectionDraft(questionSelectionDraft.length === allQuestionIds.length ? [] : allQuestionIds);
  };

  const saveQuestionSelection = async () => {
    if (!questionSelectionDraft.length) {
      onShowToast('请至少选择一道本次批改题目');
      return;
    }
    setQuestionSelectionSaving(true);
    try {
      const updatedTask = { ...selectedTask, selectedQuestionIds: questionSelectionDraft };
      await onUpdateTask(updatedTask);
      updateAssignment({ selectedQuestionIds: questionSelectionDraft });
      setQuestionSelectionEditing(false);
      const nextQuestionId = questionSelectionDraft.includes(selectedQuestionId) ? selectedQuestionId : questionSelectionDraft[0];
      setSelectedQuestionId(nextQuestionId);
      onShowToast(`已保存 ${questionSelectionDraft.length} 道本次批改题目`);
    } catch {
      onShowToast('题目范围保存失败，请重试');
    } finally {
      setQuestionSelectionSaving(false);
    }
  };

  const saveAnalysisQuestion = async (displayNo: string, correction: { title: string; stem: string; answerRequirement: string; standardAnswer: string }) => {
    const question = workflowState.questions.find(item => item.displayNo === displayNo);
    const state = questionStates.find(item => item.questionId === question?.id);
    if (!question || !state) throw new Error('QUESTION_NOT_FOUND');
    try {
      const [analysis] = await Promise.all([
        saveTaskQuestionCorrection(selectedTask.id, displayNo, correction),
        saveTaskRubric(selectedTask.id, { questionId: state.questionId, standardAnswer: correction.standardAnswer, gradingRubric: state.gradingRubric, teacherRules: state.teacherRules, rubricVersion: state.rubricVersion })
      ]);
      const questions = workflowState.questions.map(item => item.id === question.id ? { ...item, title: correction.title, desc: correction.stem, stem: correction.stem, answerRequirement: correction.answerRequirement } : item);
      const nextStates = questionStates.map(item => item.questionId === state.questionId ? { ...item, standardAnswer: correction.standardAnswer, calibrationSamples: [] } : item);
      setQuestionStates(nextStates);
      onUpdateState({ questions, questionGradingStates: nextStates, assignment: { ...workflowState.assignment, firstSectionAnalysis: analysis } });
      setTrialGradingPhase('idle');
      setBatch(null);
      onShowToast(`第 ${displayNo} 题已保存`);
    } catch (error) {
      onShowToast(`第 ${displayNo} 题保存失败`);
      throw error;
    }
  };

  const saveQuestionCorrection = async (correction: { title: string; stem: string; answerRequirement: string }) => {
    if (!currentQuestion) return;
    try {
      const analysis = await saveTaskQuestionCorrection(selectedTask.id, currentQuestion.displayNo, correction);
      const questions = workflowState.questions.map(question => question.id === currentQuestion.id ? { ...question, title: correction.title, desc: correction.stem, stem: correction.stem, answerRequirement: correction.answerRequirement } : question);
      onUpdateState({
        questions,
        assignment: { ...workflowState.assignment, firstSectionAnalysis: analysis }
      });
      setTrialGradingPhase('idle');
      setBatch(null);
      onShowToast('题干修正已保存；后续试批会按修正后的题目重新运行');
    } catch (error) {
      onShowToast(`题干修正保存失败（${error instanceof Error ? error.message : '未知错误'}）`);
      throw error;
    }
  };

  const cancelRubricChanges = () => {
    if (!persistedCurrentQuestionState) return;
    setQuestionStates(current => current.map(item => item.questionId === persistedCurrentQuestionState.questionId ? persistedCurrentQuestionState : item));
    setRubricSavePhase('idle');
    onShowToast('已撤销本题尚未保存的修改');
  };

  const confirmKnowledgeLink = (nodeId: string) => {
    if (!currentQuestion || !knowledgeNodes.some(node => node.id === nodeId)) return;
    const questions = workflowState.questions.map(question => question.id === currentQuestion.id ? { ...question, knowledgeLinks: question.knowledgeLinks.map(link => link.nodeId === nodeId ? { ...link, status: 'confirmed' as const } : link) } : question);
    onUpdateState({ questions });
    onShowToast('已将本题与资源库知识点关联');
  };

  const setSampleTarget = (target: 3 | 5) => {
    if (!currentQuestionState || !currentQuestion) return;
    updateQuestionState({ ...currentQuestionState, sampleTarget: target });
  };

  const selectSample = (sample: CalibrationSample) => {
    setSelectedSampleId(sample.id);
    setEditedOcr(getEffectiveOcrText(sample));
    setTeacherScore(sample.teacherScore ?? sample.aiScore ?? 0);
    setTeacherReason(sample.teacherReason ?? '');
    setGradingAction('none');
    setRuleAddedNotice(false);
  };

  const prepareTrialCalibration = async (force = false) => {
    const matchedSubmissions = matchRows.filter(page => page.rosterMatchStatus === 'matched' && page.studentId);
    if (!matchedSubmissions.length || !selectedQuestions.length) {
      onShowToast('缺少已匹配答卷或评分依据，暂时不能开始试批');
      return;
    }
    setActiveStage('calibration');
    setTrialGradingPhase('loading');
    setTrialGradingError(null);
    const startedAt = Date.now();
    setTrialProgress({ phase: 'recognition', completed: 0, total: matchedSubmissions.length, currentLabel: '准备逐份核对答卷', startedAt, elapsedSeconds: 0 });
    try {
      setTrialProgress(current => ({ ...current, currentLabel: `${matchedSubmissions.length} 份答卷正在并行核对` }));
      await Promise.all(matchedSubmissions.map(async submission => {
        try {
          const stored = visionValidationByAsset[submission.id] ?? await getVisionValidation(selectedTask.id, submission.id);
          const missingQuestionNos = currentQuestionNos.filter(displayNo => !stored?.items.some(item => item.displayNo === displayNo));
          if (!missingQuestionNos.length && stored) {
            setVisionValidationByAsset(current => ({ ...current, [submission.id]: stored }));
            return;
          }
          setVisionValidationPhase(current => ({ ...current, [submission.id]: 'loading' }));
          const result = await runVisionValidation(selectedTask.id, submission.id, missingQuestionNos);
          setVisionValidationByAsset(current => ({ ...current, [submission.id]: result }));
          setVisionValidationPhase(current => ({ ...current, [submission.id]: 'ready' }));
        } catch (error) {
          const code = error instanceof Error ? error.message : 'VISION_VALIDATION_FAILED';
          setVisionValidationPhase(current => ({ ...current, [submission.id]: 'error' }));
          setVisionValidationError(current => ({ ...current, [submission.id]: code }));
          throw new Error(`${submission.expectedStudentName}：${code}`);
        } finally {
          setTrialProgress(current => ({ ...current, completed: current.completed + 1 }));
        }
      }));
      setTrialProgress(current => ({ ...current, phase: 'grading', completed: matchedSubmissions.length, currentLabel: `AI 正在依据评分细则逐份评分` }));
      const result = await gradeTaskTrial(
        selectedTask.id,
        selectedQuestions.map(question => {
          const state = questionStates.find(item => item.questionId === question.id);
          return {
            questionId: question.id,
            displayNo: question.displayNo,
            stem: question.stem ?? question.desc,
            fullScore: question.score,
            standardAnswer: state?.standardAnswer ?? '',
            rubricPoints: state?.gradingRubric ?? [],
            teacherRules: [...(state?.teacherRules ?? []), ...(workflowState.assignment.note.trim() ? [`本次批改补充要求：${workflowState.assignment.note.trim()}`] : [])],
            rubricVersion: state?.rubricVersion ?? 1
          };
        }),
        matchedSubmissions.map(page => ({
          assetId: page.id,
          studentId: page.studentId!,
          studentName: page.expectedStudentName,
          studentNo: page.detectedStudentNo
        }))
      );
      const nextStates = applyTrialSamples(questionStates, result);
      const firstState = nextStates.find(state => selectedQuestionIds.includes(state.questionId));
      const firstSample = firstState?.calibrationSamples[0];
      setQuestionStates(nextStates);
      setSelectedQuestionId(firstState?.questionId ?? '');
      setSelectedSampleId(firstSample?.id ?? '');
      setEditedOcr(firstSample ? getEffectiveOcrText(firstSample) : '');
      setTeacherScore(firstSample?.aiScore ?? 0);
      setTrialGradingPhase('ready');
      setTrialProgress(current => ({ ...current, phase: 'complete', currentLabel: `已生成 ${result.samples.length} 条试批结果`, elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000) }));
      onUpdateState({ questionGradingStates: nextStates, calibrationSamples: firstState?.calibrationSamples ?? [] });
      onShowToast(`Luna 已完成 ${result.samples.length} 条试批结果`);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'TRIAL_GRADING_FAILED';
      setTrialGradingPhase('error');
      setTrialGradingError(code);
      setTrialProgress(current => ({ ...current, phase: 'error', currentLabel: code, elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000) }));
      const messageByCode: Record<string, string> = {
        'MODEL_REQUEST_FAILED:502': 'Luna 服务暂时不可用，已保留完成的识别结果，可直接重试',
        TRIAL_GRADING_OUTPUT_INVALID: 'AI 返回格式异常，已保留答卷识别结果，可直接重试',
        VISION_VALIDATION_OUTPUT_INVALID: '当前答卷视觉结果格式异常，可重试该步骤'
      };
      onShowToast(messageByCode[code] ?? '试批没有完成，已保留前序结果，可直接重试');
    }
  };

  const replaceSample = (updated: CalibrationSample) => {
    const nextStates = questionStates.map(state => state.questionId === updated.questionId
      ? { ...state, calibrationSamples: state.calibrationSamples.map(sample => sample.id === updated.id ? updated : sample) }
      : state);
    setQuestionStates(nextStates);
    onUpdateState({ questionGradingStates: nextStates });
    setDiagnosis(null);
    return nextStates;
  };

  const updateSample = async (source: CalibrationResultSource, score: number, reason: string) => {
    if (!selectedSample || !currentQuestionState) return;
    try {
      const finalText = source === 'ai-confirmed' ? selectedSample.ocrText : editedOcr;
      const updated = await saveTeacherReview(selectedTask.id, selectedSample.id, score, reason, source, finalText);
      const nextStates = replaceSample(updated);
      setGradingAction('none');
      onShowToast(source === 'teacher-manual' ? `${selectedSample.studentName} 已完成教师终评，并作为本题校准锚点` : `${selectedSample.studentName} 的试批结果已确认`);
      if (nextStates.every(state => state.calibrationSamples.slice(0, state.sampleTarget).every(sample => sample.status === 'confirmed'))) setShowModeDialog(true);
    } catch { onShowToast('教师评分保存失败'); }
  };

  const goToNextTrialStep = () => {
    if (!currentQuestionState || !selectedSample) return;
    const trialSamples = currentQuestionState.calibrationSamples.slice(0, currentQuestionState.sampleTarget);
    const currentIndex = trialSamples.findIndex(sample => sample.id === selectedSample.id);
    const nextSample = trialSamples.slice(currentIndex + 1).find(sample => sample.status !== 'confirmed')
      ?? trialSamples.find(sample => sample.status !== 'confirmed');
    if (nextSample) {
      selectSample(nextSample);
      return;
    }
    const questionIndex = selectedQuestionStates.findIndex(state => state.questionId === currentQuestionState.questionId);
    const nextQuestion = selectedQuestionStates.slice(questionIndex + 1).find(state => state.calibrationSamples.slice(0, state.sampleTarget).some(sample => sample.status !== 'confirmed'));
    if (nextQuestion) selectQuestion(nextQuestion.questionId);
    else setShowModeDialog(true);
  };

  const openReviewSample = (sample: CalibrationSample) => {
    setReviewSampleId(sample.id);
    setReviewEditedOcr(getEffectiveOcrText(sample));
    setReviewScore(sample.teacherScore ?? sample.aiScore ?? 0);
    setReviewReason(sample.teacherReason ?? sample.gradingReason ?? '教师根据原图和识别证据完成复核');
  };

  const saveReviewOcrCorrection = async () => {
    if (!selectedReviewSample) return;
    const question = gradingQuestions().find(item => item.questionId === selectedReviewSample.questionId);
    const submission = gradingSubmissions().find(item => item.studentId === selectedReviewSample.studentId);
    if (!question || !submission) { onShowToast('无法找到当前题目或学生答卷'); return; }
    setReviewSaving('ocr');
    try {
      const updated = await correctTrialOcr(selectedTask.id, selectedReviewSample.id, reviewEditedOcr, question, submission);
      replaceSample(updated);
      setReviewScore(updated.aiScore ?? 0);
      setReviewReason(updated.gradingReason ?? '教师根据原图和识别证据完成复核');
      onShowToast(`OCR 修正已保存，AI 已重新评分为 ${updated.aiScore ?? '待定'} 分`);
    } catch { onShowToast('OCR 修正保存或重新评分失败'); }
    finally { setReviewSaving('idle'); }
  };

  const confirmReviewDecision = async (source: CalibrationResultSource) => {
    if (!selectedReviewSample) return;
    const finalScore = source === 'ai-confirmed' ? selectedReviewSample.aiScore : reviewScore;
    if (finalScore === null) { onShowToast('AI 尚未给出可确认分数'); return; }
    setReviewSaving('decision');
    try {
      const finalText = source === 'ai-confirmed' ? selectedReviewSample.ocrText : reviewEditedOcr;
      const updated = await saveTeacherReview(selectedTask.id, selectedReviewSample.id, finalScore, reviewReason || '教师根据原图和识别证据完成复核', source, finalText);
      replaceSample(updated);
      setReviewSampleId(null);
      onShowToast(`${updated.studentName} 已完成异常复核，最终得分 ${finalScore} 分`);
    } catch { onShowToast('教师裁定保存失败'); }
    finally { setReviewSaving('idle'); }
  };

  const saveOcrCorrection = async () => {
    if (!selectedSample || !currentQuestionState) return;
    const rawOcrText = selectedSample.rawOcrText ?? selectedSample.ocrText;
    const teacherCorrectedText = editedOcr === rawOcrText ? undefined : editedOcr;
    const question = gradingQuestions().find(item => item.questionId === selectedSample.questionId);
    const submission = gradingSubmissions().find(item => item.studentId === selectedSample.studentId);
    if (!question || !submission) { onShowToast('无法找到当前题目或学生答卷'); return; }
    setOcrCorrectionPhase('saving');
    try {
      const updated = await correctTrialOcr(selectedTask.id, selectedSample.id, teacherCorrectedText ?? rawOcrText, question, submission);
      const nextStates = questionStates.map(state => state.questionId === updated.questionId ? { ...state, calibrationSamples: state.calibrationSamples.map(sample => sample.id === updated.id ? updated : sample) } : state);
      setQuestionStates(nextStates);
      setTeacherScore(updated.aiScore ?? 0);
      onUpdateState({ questionGradingStates: nextStates });
      onShowToast(`OCR 修正已保存，AI 已重新评分为 ${updated.aiScore ?? '待定'} 分`);
    } catch { onShowToast('OCR 修正保存或重新评分失败'); }
    finally { setOcrCorrectionPhase('idle'); }
  };

  const runBatch = async () => {
    setBatchError(null);
    try {
      const result = await startBatchGrading(selectedTask.id, gradingMode, gradingQuestions(), gradingSubmissions());
      setBatch(result.batch);
      const nextStates = applyTrialSamples(questionStates, result.result);
      setQuestionStates(nextStates);
      setBatchQuestionId(nextStates[0]?.questionId ?? '');
      setBatchStudentId(result.result.samples[0]?.studentId ?? '');
      onUpdateState({ questionGradingStates: nextStates });
      onShowToast(result.batch.status === 'completed' ? '批量批改已完成' : '批量批改完成，部分答卷需要处理');
    } catch (error) { setBatchError(error instanceof Error ? error.message : 'BATCH_GRADING_FAILED'); }
  };

  const controlBatch = async (action: 'pause' | 'resume') => {
    try { setBatch(await setBatchGradingAction(selectedTask.id, action)); }
    catch { onShowToast(action === 'pause' ? '暂停失败' : '继续失败'); }
  };

  const persistRubric = (state: QuestionGradingState) => saveTaskRubric(selectedTask.id, {
    questionId: state.questionId,
    standardAnswer: state.standardAnswer,
    gradingRubric: state.gradingRubric,
    teacherRules: state.teacherRules,
    rubricVersion: state.rubricVersion
  });

  const saveRubricDraft = async () => {
    if (!currentQuestionState) return;
    setRubricSavePhase('saving');
    onUpdateState({ questionGradingStates: questionStates });
    try {
      await persistRubric(currentQuestionState);
      setRubricSavePhase('saved');
      onShowToast(`第 ${currentQuestion?.displayNo ?? '-'} 题评分依据草稿已保存`);
    } catch (error) {
      setRubricSavePhase('error');
      onShowToast('评分依据保存失败');
      throw error;
    }
  };

  const applyRubric = () => {
    if (!currentQuestionState) return;
    setRubricSavePhase('saving');
    const nextVersion = currentQuestionState.rubricVersion + 1;
    const next = {
      ...currentQuestionState,
      rubricVersion: nextVersion,
      calibrationSamples: currentQuestionState.calibrationSamples.map(sample => sample.resultSource === 'teacher-manual' ? sample : { ...sample, status: 'pending' as const, isFinal: false, rubricVersion: nextVersion })
    };
    const nextStates = questionStates.map(item => item.questionId === next.questionId ? next : item);
    setQuestionStates(nextStates);
    onUpdateState({ questionGradingStates: nextStates });
    void persistRubric(next)
      .then(() => { setRubricSavePhase('saved'); onShowToast(`本题评分依据已更新为 V${nextVersion}，教师终评样本保持不变`); })
      .catch(() => { setRubricSavePhase('error'); onShowToast('评分依据保存失败'); });
  };

  const lockAndStart = () => {
    onUpdateState({ gradingMode, questionGradingStates: questionStates, jointReviewQuestionIds: questionStates.filter(item => item.jointReviewEnabled).map(item => item.questionId) });
    setShowModeDialog(false);
    setActiveStage('grading');
    onShowToast(`开始按“${modeOptions.find(option => option.id === gradingMode)?.label}”批改`);
    void runBatch();
  };

  const questionNumber = Number(currentQuestion?.displayNo) || 1;
  const assignmentAnalysis = workflowState.assignment.firstSectionAnalysis;
  const selectedAnalysisQuestion = assignmentAnalysis?.questions.find(question => question.displayNo === analysisQuestionNo) ?? assignmentAnalysis?.questions[0];
  const submissionFilePicker = (
    <label className="cursor-pointer rounded-2xl border border-emerald-700 px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50">
      {matchRows.length ? '继续上传答卷' : '选择答卷文件'}
      <input type="file" multiple accept="application/pdf,image/*" className="sr-only" disabled={submissionUploadPhase === 'uploading' || submissionUploadPhase === 'parsing'} onChange={event => selectSubmissionFiles(event.currentTarget.files)} />
    </label>
  );
  const pendingSubmissionUpload = (
    <>
      {submissionFiles.length ? <div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-4 text-left dark:border-zinc-800 dark:bg-zinc-900"><div className="flex items-center justify-between gap-3"><strong className="text-sm">待提交 {submissionFiles.length} 个文件</strong><span className="text-xs text-slate-400">单次最多 20 个</span></div><div className="mt-3 space-y-1.5">{submissionFiles.slice(0, 5).map(file => <div key={`${file.name}-${file.size}`} className="truncate text-xs text-slate-600 dark:text-slate-300">{file.name}</div>)}{submissionFiles.length > 5 ? <div className="text-xs text-slate-400">另有 {submissionFiles.length - 5} 个文件</div> : null}</div><button type="button" disabled={submissionUploadPhase === 'uploading' || submissionUploadPhase === 'parsing'} onClick={() => void submitStudentSubmissions()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60">{submissionUploadPhase === 'uploading' ? '正在上传...' : submissionUploadPhase === 'parsing' ? '正在 OCR 解析...' : '提交并开始质检'}<Upload className="h-4 w-4" /></button></div> : null}
      {submissionUploadPhase === 'error' ? <div className="w-full text-xs font-bold text-rose-700">处理失败（{submissionUploadError}），可直接重新提交。</div> : null}
    </>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 items-center gap-3"><button type="button" title="返回批改任务" aria-label="返回批改任务" onClick={onBack} className="rounded-2xl border border-slate-200 bg-white/70 p-2.5 text-slate-500 hover:text-emerald-700 dark:border-zinc-800 dark:bg-zinc-900"><ArrowLeft className="h-4 w-4" /></button><div className="min-w-0"><h1 className="truncate text-xl font-black text-slate-900 dark:text-white">{selectedTask.name}</h1><p className="mt-1 text-xs text-slate-500">{currentClassName} · {expectedStudentCount} 人 · 收作业 {selectedTask.deadline}</p></div></div>
      </header>

      <nav aria-label="任务流程" className="glass-panel grid grid-cols-2 overflow-hidden rounded-[24px] bg-slate-100/60 p-2 sm:grid-cols-4 xl:grid-cols-7 dark:bg-zinc-900/60">
        {stages.map((stage, index) => {
          const active = activeStage === stage.id;
          const disabled = (stage.id === 'rubric' || stage.id === 'intake') ? !assignmentReady : (stage.id === 'calibration' || stage.id === 'grading' || stage.id === 'review' || stage.id === 'diagnosis') ? !gradingDataReady : false;
          return <button key={stage.id} type="button" disabled={disabled} onClick={() => setActiveStage(stage.id)} className={`relative flex min-h-12 items-center justify-center gap-2 rounded-2xl px-3 text-xs font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'bg-white text-slate-900 shadow-sm dark:bg-zinc-800 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}><span className={`flex h-6 w-6 items-center justify-center rounded-xl text-[11px] ${active ? 'bg-emerald-700 text-white' : 'bg-white/80 text-slate-400 dark:bg-zinc-800'}`}>{index + 1}</span>{stage.label}{stage.id === 'review' && pendingReviews ? <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] text-white">{pendingReviews}</span> : null}</button>;
        })}
      </nav>

      {activeStage === 'assignment' ? (
        <section>
          <div className={`${panelClass} p-6`}>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-5 dark:border-zinc-800"><div><h2 className="font-black text-slate-900 dark:text-white">作业材料</h2><p className="mt-1 text-xs text-slate-500">先确定学生收到的题目和本次评分参考。</p></div><div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-xs"><span className="flex items-center gap-1.5 text-slate-500"><CalendarClock className="h-4 w-4 text-emerald-700" /><strong className="text-slate-700 dark:text-slate-200">收作业提醒</strong>{selectedTask.deadline}</span><span className="text-slate-500"><strong className="mr-1.5 text-slate-700 dark:text-slate-200">当前班级</strong>{currentClassName} · 应交 {expectedStudentCount} 人</span><span className="rounded-xl bg-slate-100 px-2.5 py-1.5 font-bold text-slate-600 dark:bg-zinc-800 dark:text-slate-300">{analysisStatusLabel[workflowState.assignment.analysisStatus]}</span><span className={`rounded-xl px-2.5 py-1.5 font-bold ${assignmentReady ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{assignmentReady ? '已布置' : '待准备'}</span></div></div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center border border-dashed border-slate-300 bg-slate-50/60 p-5 text-center transition-colors hover:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900/50"><Upload className="h-6 w-6 text-emerald-700" /><strong className="mt-3 text-sm">作业题目或试卷</strong><span className="mt-1 max-w-full truncate text-xs text-slate-400">{workflowState.assignment.questionFileNames.join('、') || 'DOCX、PDF、图片或文本'}</span><input type="file" multiple accept={materialAccept} className="sr-only" onChange={event => void handleMaterialFiles('assignment', event.currentTarget.files)} /></label>
              <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center border border-dashed border-slate-300 bg-slate-50/60 p-5 text-center transition-colors hover:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900/50"><FileText className="h-6 w-6 text-emerald-700" /><strong className="mt-3 text-sm">参考答案</strong><span className="mt-1 max-w-full truncate text-xs text-slate-400">{workflowState.assignment.answerFileNames.join('、') || 'DOCX、PDF、图片或文本'}</span><input type="file" multiple accept={materialAccept} className="sr-only" onChange={event => void handleMaterialFiles('reference-answer', event.currentTarget.files)} /></label>
            </div>
            {assignmentAssets.length ? <section className="mt-5 border-y border-slate-200 dark:border-zinc-800"><div className="flex flex-wrap items-center gap-2 py-3">{assignmentAssets.map(asset => <span key={asset.id} className={`inline-flex max-w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-bold ${asset.status === 'failed' ? 'bg-rose-100 text-rose-800' : asset.status === 'needs-review' ? 'bg-amber-100 text-amber-800' : asset.status === 'ready' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-slate-300'}`}><span className="max-w-56 truncate">{asset.fileName}</span><span>{materialStatusLabel[asset.status]}</span></span>)}</div>{assignmentDocuments.map(document => <Fragment key={document.assetId}><MaterialDocumentDetails document={document} asset={assignmentAssets.find(item => item.id === document.assetId)} /></Fragment>)}</section> : null}
            {workflowState.assignment.assets.length ? <section className="mt-5 border-y border-slate-200 py-4 dark:border-zinc-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h3 className="text-sm font-black">AI 拆题</h3><p className="mt-1 text-xs text-slate-500">识别题目后，选择本次需要批改的范围。</p></div>
                <button type="button" disabled={isAnalyzing} onClick={() => void analyzeAssignment()} className="flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"><Sparkles className="h-4 w-4" />{isAnalyzing ? '正在拆题' : assignmentAnalysis ? '重新拆题' : '开始拆题'}</button>
              </div>
              {isAnalyzing ? <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/20"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-emerald-900 dark:text-emerald-100">AI 正在识别作业结构</strong><span className="text-xs font-bold text-emerald-700">已用时 {formatElapsed(analysisElapsedSeconds)}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950"><div className="h-full w-1/2 animate-pulse rounded-full bg-emerald-600" /></div><div className="mt-3 grid gap-2 text-xs sm:grid-cols-3"><span className="font-bold text-emerald-800">1. 题目与答案材料已就绪</span><span className="font-bold text-emerald-800">2. 正在核对题号、题干和答案</span><span className="text-slate-400">3. 生成评分依据</span></div></div> : null}
              {assignmentAnalysis && selectedAnalysisQuestion ? <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4 lg:grid-cols-[220px_minmax(0,1fr)] dark:border-zinc-800">
                <aside className="space-y-2"><div className="flex items-center justify-between gap-2 text-xs">{questionSelectionEditing && !questionSelectionLocked ? <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={allQuestionsSelected} onChange={toggleAllQuestions} aria-label="全选本次批改题目" className="h-4 w-4 accent-emerald-700" />全选</label> : <strong className="text-slate-700 dark:text-slate-200">本次批改题目</strong>}<span className="font-medium text-slate-600 dark:text-slate-300">已选 {questionSelectionDraft.length} / {assignmentAnalysis.questions.length}</span></div>{assignmentAnalysis.questions.map(question => { const questionId = `${selectedTask.id}-q-${question.displayNo}`; const included = questionSelectionDraft.includes(questionId); const active = selectedAnalysisQuestion.displayNo === question.displayNo; return <div key={question.displayNo} className={`flex items-center gap-2 rounded-lg border p-2 ${active ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-zinc-800'}`}>{questionSelectionEditing && !questionSelectionLocked ? <input type="checkbox" checked={included} onChange={() => toggleQuestionSelection(question.displayNo)} aria-label={`选择第 ${question.displayNo} 题`} className="h-4 w-4 accent-emerald-700" /> : <span aria-hidden="true" className={`h-2 w-2 rounded-full ${included ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-zinc-700'}`} />}<button type="button" onClick={() => setAnalysisQuestionNo(question.displayNo)} className="min-w-0 flex-1 text-left"><strong className="block text-xs">第 {question.displayNo} 题</strong><span className="mt-0.5 block truncate text-[11px] text-slate-500">{question.title || question.stem}</span></button></div>; })}{questionSelectionLocked ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">{submissionAssets.length ? '已上传答卷，题目范围已锁定' : '已确认布置，题目范围已锁定'}</div> : questionSelectionEditing ? <div className="grid grid-cols-2 gap-2"><button type="button" disabled={questionSelectionSaving} onClick={() => { setQuestionSelectionDraft(selectedQuestionIds); setQuestionSelectionEditing(false); }} className="rounded-lg border border-slate-300 px-3 py-2.5 text-xs font-bold text-slate-700 dark:border-zinc-700 dark:text-slate-200">取消</button><button type="button" disabled={!questionSelectionDirty || questionSelectionSaving} onClick={() => void saveQuestionSelection()} className="rounded-lg bg-emerald-700 px-3 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600">{questionSelectionSaving ? '正在保存...' : '保存题目范围'}</button></div> : <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-900 dark:bg-emerald-950/30"><strong className="text-xs text-emerald-900 dark:text-emerald-100">题目范围已保存</strong><button type="button" onClick={() => setQuestionSelectionEditing(true)} className="text-xs font-bold text-emerald-800 underline underline-offset-2 dark:text-emerald-200">修改</button></div>}</aside>
                <AnalysisQuestionCard question={selectedAnalysisQuestion} standardAnswer={questionStates.find(state => state.questionId === `${selectedTask.id}-q-${selectedAnalysisQuestion.displayNo}`)?.standardAnswer ?? selectedAnalysisQuestion.standardAnswer} onSave={correction => saveAnalysisQuestion(selectedAnalysisQuestion.displayNo, correction)} />
                <label className="space-y-2 border-t border-slate-200 pt-4 lg:col-span-2 dark:border-zinc-800"><span className="text-xs font-bold text-slate-500">本次批改补充要求 <span className="font-normal text-slate-400">（应用于所有已选题目）</span></span><textarea value={workflowState.assignment.note} onChange={event => updateAssignment({ note: event.target.value })} rows={3} placeholder="例如：开放题允许意思相近；明显划掉的内容不计入答案" className={`${inputClass} resize-none leading-6`} /></label>
              </div> : !isAnalyzing ? <p className="mt-4 text-sm text-slate-500">材料解析完成后，点击“开始拆题”识别作业结构。</p> : null}
            </section> : null}
            {!assignmentAnalysis ? <label className="mt-5 block space-y-2"><span className="text-xs font-bold text-slate-500">作业内容补充</span><textarea value={workflowState.assignment.note} onChange={event => updateAssignment({ note: event.target.value })} rows={3} placeholder="没有电子题目时，可在这里补充作业内容" className={`${inputClass} resize-none leading-6`} /></label> : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-5 dark:border-zinc-800">{assignmentReady ? <><button type="button" onClick={() => setActiveStage('rubric')} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-emerald-700 dark:border-zinc-700">查看评分依据</button><button type="button" onClick={startSubmissionUpload} className="flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white"><Upload className="h-4 w-4" />上传学生作业</button></> : <button type="button" onClick={completeAssignment} className="rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white">确认已布置</button>}</div>
          </div>
        </section>
      ) : null}

      {activeStage === 'intake' ? matchRows.length ? (
        <section className="space-y-4">
          {rosterMatchPhase === 'loading' ? <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-800">正在读取当前班级名册并核对学号...</div> : null}
          {rosterMatchPhase === 'error' ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><span>名册核对失败（{rosterMatchError}），当前答卷不能进入自动批改。</span><button type="button" onClick={() => setRosterRefreshKey(value => value + 1)} className="font-bold underline">重新核对</button></div> : null}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[['应交', expectedStudentCount, '人'], ['已匹配', matchedStudentCount, '人'], ['未交', missingRows.length, '人'], ['自动通过', matchRows.filter(row => row.status === 'matched' && row.rosterMatchStatus === 'matched').length, '组'], ['待质检', issueRows.length, '组']].map(([label, value, unit]) => <div key={String(label)} className={`${panelClass} p-4`}><span className="text-xs font-bold text-slate-500">{label}</span><div className="mt-2"><strong className="text-2xl text-slate-900 dark:text-white">{value}</strong><span className="ml-1 text-xs text-slate-400">{unit}</span></div></div>)}
          </div>
          <section className={`${panelClass} flex flex-wrap items-center justify-between gap-3 px-5 py-3`}>
            <div className="flex min-w-0 flex-wrap items-center gap-2"><span className="flex items-center gap-1.5 text-xs font-black text-slate-700 dark:text-slate-200"><Users className="h-4 w-4 text-rose-600" />未交 {missingRows.length} 人</span>{missingRows.length ? missingRows.map(student => <button key={student.studentId} type="button" onClick={() => onShowToast(`${student.studentName} 已标记为待补交`)} className="rounded-xl bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 dark:bg-rose-950/20">{student.studentName} · {student.studentNo}</button>) : <span className="text-xs text-emerald-700">全员已交</span>}</div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500"><span className="flex items-center gap-1.5 font-black text-slate-700 dark:text-slate-200"><Settings2 className="h-4 w-4 text-emerald-700" />当前 OCR 规则</span><span><strong className="text-rose-700">低于 {Math.round(ocrHumanReviewThreshold * 100)}%</strong> 人工复核</span><span><strong className="text-sky-700">中间区间</strong> 视觉核验</span><span><strong className="text-emerald-700">高于 {Math.round(ocrAutoPassThreshold * 100)}%</strong> 自动通过</span></div>
          </section>
          <div>
            <section className={`${panelClass} overflow-hidden`}>
              <div className="border-b border-slate-200/70 p-5 dark:border-zinc-800"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black text-slate-900 dark:text-white">上传与识别结果</h2><p className="mt-1 text-xs text-slate-500">按名单顺序上传，同一学生页面连续排列。</p></div><div className="flex flex-wrap items-center gap-2">{submissionFilePicker}<button type="button" onClick={() => { setShowOnlyOcrIssues(value => !value); setExpandedOcrPageId(null); }} disabled={!issueRows.length} className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold disabled:opacity-50 ${showOnlyOcrIssues ? 'border border-slate-200 bg-white text-slate-600 dark:border-zinc-700 dark:bg-zinc-900' : 'bg-rose-600 text-white'}`}><CircleAlert className="h-4 w-4" />{showOnlyOcrIssues ? '查看全部' : `仅看 ${issueRows.length} 项异常`}</button></div></div>{submissionFiles.length || submissionUploadPhase === 'error' ? <div className="mt-4">{pendingSubmissionUpload}</div> : null}</div>
              <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-slate-200/70 text-xs font-bold text-slate-400 dark:border-zinc-800"><th className="px-5 py-3">顺序</th><th className="px-3 py-3">名单匹配</th><th className="px-3 py-3">识别学号</th><th className="px-3 py-3">页数</th><th className="px-3 py-3">文字识别</th><th className="px-3 py-3">处理状态</th><th className="px-3 py-3" /></tr></thead><tbody>{displayedRows.map(row => { const status = getSubmissionStatus(row); const asset = submissionAssets.find(item => item.id === row.id); const document = normalizedDocuments.find(item => item.assetId === row.id); const textConfidence = row.textConfidence ?? row.ocrConfidence; return <Fragment key={row.id}><tr className="border-b border-slate-200/50 last:border-0 dark:border-zinc-800/70"><td className="px-5 py-4 tabular-nums">{row.sequence}</td><td className="px-3 py-4 font-bold">{row.expectedStudentName}</td><td className="px-3 py-4 font-mono text-xs">{row.detectedStudentNo}</td><td className="px-3 py-4">{row.pageCount}</td><td className="px-3 py-4">{textConfidence > 0 ? `${Math.round(textConfidence * 100)}%` : '未提供'}</td><td className="px-3 py-4"><span className={`rounded-xl px-2.5 py-1.5 text-xs font-bold ${status.className}`}>{status.label}</span></td><td className="px-3 py-4"><button type="button" onClick={() => openSubmissionPreview(row.id)} className="rounded-xl p-2 text-emerald-700 hover:bg-emerald-50" title="查看答卷" aria-label={`查看 ${row.expectedStudentName} 的答卷`}><Eye className="h-4 w-4" /></button></td></tr>{expandedOcrPageId === row.id ? <tr><td colSpan={7} className="p-0"><SubmissionPreview page={row} asset={asset} document={document} validation={visionValidationByAsset[row.id]} validationPhase={visionValidationPhase[row.id] ?? 'idle'} validationError={visionValidationError[row.id]} humanThreshold={ocrHumanReviewThreshold} autoThreshold={ocrAutoPassThreshold} onClose={() => setExpandedOcrPageId(null)} onConfirm={studentNo => confirmSubmissionStudentNo(row.id, studentNo)} onRunVision={() => void validateSubmissionVision(row.id)} /></td></tr> : null}</Fragment>; })}</tbody></table></div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 p-5 dark:border-zinc-800"><span className="text-xs text-slate-500">未知、重复或无法识别的学号必须处理后才能进入试批。</span><button type="button" disabled={!gradingDataReady || trialGradingPhase === 'loading'} onClick={() => void prepareTrialCalibration()} className="flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40">{trialGradingPhase === 'loading' ? 'Luna 正在试批...' : '进入试批校准'}<ArrowRight className="h-4 w-4" /></button></div>
            </section>
          </div>
        </section>
      ) : (
        <section className={`${panelClass} flex min-h-96 flex-col items-center justify-center p-8 text-center`}>
          <Upload className="h-8 w-8 text-emerald-700" />
          <h2 className="mt-4 font-black text-slate-900 dark:text-white">上传学生作业</h2>
          <p className="mt-2 text-sm text-slate-500">选择 {currentClassName} 的答卷图片或 PDF，系统优先按姓名匹配，重名时再核对学号。</p>
          {rosterMatchPhase === 'loading' ? <span className="mt-3 text-xs font-bold text-sky-700">正在读取班级名册...</span> : null}
          {rosterMatchPhase === 'ready' ? <span className="mt-3 text-xs font-bold text-emerald-700">名册已连接，应交 {expectedStudentCount} 人</span> : null}
          {rosterMatchPhase === 'error' ? <div className="mt-3 flex items-center gap-3 text-xs font-bold text-rose-700"><span>名册连接失败（{rosterMatchError}）</span><button type="button" onClick={() => setRosterRefreshKey(value => value + 1)} className="underline">重试</button></div> : null}
          <div className="mt-5 flex w-full max-w-xl flex-col items-center gap-4">{submissionFilePicker}{pendingSubmissionUpload}</div>
        </section>
      ) : null}

      {activeStage === 'rubric' && currentQuestionState ? (
        <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><QuestionSelector questions={selectedQuestions} states={questionStates} selectedId={selectedQuestionId} onSelect={selectQuestion} /><button type="button" onClick={() => { setAnalysisQuestionNo(currentQuestion?.displayNo ?? ''); setActiveStage('assignment'); }} className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 dark:border-zinc-700">返回题目确认</button></div><QuestionContext question={currentQuestion} number={questionNumber} evidence={questionEvidence} onConfirmKnowledge={confirmKnowledgeLink} onSaveCorrection={saveQuestionCorrection} /><div className={`${panelClass} p-6`}><RubricEditor questionState={currentQuestionState} answerEvidence={answerEvidence} dirty={rubricDirty} savePhase={rubricSavePhase} canEnterTrial={gradingDataReady} onChange={updateQuestionState} onCancel={cancelRubricChanges} onSaveDraft={saveRubricDraft} onApply={applyRubric} onEnterTrial={() => void prepareTrialCalibration(true)} onCompleteIntake={() => setActiveStage('intake')} /></div></section>
      ) : null}

      {activeStage === 'rubric' && !currentQuestionState ? (
        <section className={`${panelClass} flex min-h-80 flex-col items-center justify-center p-8 text-center`}><Sparkles className="h-8 w-8 text-emerald-700" /><h2 className="mt-4 font-black text-slate-900 dark:text-white">尚未生成评分依据</h2><p className="mt-2 text-sm text-slate-500">题目和参考答案解析完成后，各题采分点会出现在这里。</p><button type="button" onClick={() => setActiveStage('assignment')} className="mt-5 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-emerald-700 dark:border-zinc-700">返回作业内容</button></section>
      ) : null}

      {activeStage === 'calibration' && (!currentQuestionState || !selectedSample) ? (
        <section className={`${panelClass} flex min-h-96 flex-col items-center justify-center p-8 text-center`}>
          <Sparkles className={`h-8 w-8 text-emerald-700 ${trialGradingPhase === 'loading' ? 'animate-pulse' : ''}`} />
          <h2 className="mt-4 font-black text-slate-900 dark:text-white">{trialGradingPhase === 'loading' ? trialProgress.phase === 'grading' ? 'AI 正在逐份评分' : '正在核对逐题答卷证据' : trialGradingPhase === 'error' ? '试批没有完成' : '尚未生成试批样本'}</h2>
          {trialGradingPhase === 'loading' ? <div className="mt-4 w-full max-w-xl text-left"><div className="flex items-center justify-between text-xs"><strong className="text-emerald-800">{trialProgress.currentLabel}</strong><span className="text-slate-500">已用时 {formatElapsed(trialProgress.elapsedSeconds)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800"><div className={`h-full rounded-full bg-emerald-600 transition-all ${trialProgress.phase === 'grading' ? 'w-1/2 animate-pulse' : ''}`} style={trialProgress.phase === 'grading' ? undefined : { width: `${trialProgress.total ? Math.max(8, Math.round(trialProgress.completed / trialProgress.total * 100)) : 8}%` }} /></div><div className="mt-3 grid gap-2 text-xs sm:grid-cols-3"><span className={trialProgress.completed >= trialProgress.total && trialProgress.total ? 'font-bold text-emerald-800' : 'font-bold text-sky-700'}>1. 逐题区域与 OCR 核对 {trialProgress.completed}/{trialProgress.total}</span><span className={trialProgress.phase === 'grading' ? 'font-bold text-sky-700' : 'text-slate-400'}>2. 依据评分细则逐份评分</span><span className="text-slate-400">3. 校验并保存试批结果</span></div><p className="mt-3 text-[11px] text-slate-500">评分阶段耗时取决于题目和样本数量，因此只显示真实阶段与用时，不伪造百分比或模型内部思维。</p></div> : <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">{trialGradingPhase === 'error' ? `处理失败（${trialGradingError}）。已完成的答卷识别会保留，重试时继续使用。` : '请先完成答卷匹配，再运行真实试批。'}</p>}
          {trialGradingPhase !== 'loading' ? <button type="button" onClick={() => void prepareTrialCalibration(true)} className="mt-5 rounded-2xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white">重新运行试批</button> : null}
        </section>
      ) : null}

      {activeStage === 'calibration' && currentQuestionState && selectedSample ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3"><QuestionSelector questions={selectedQuestions} states={questionStates} selectedId={selectedQuestionId} onSelect={selectQuestion} /><label className="flex items-center gap-2 text-xs font-bold text-slate-500"><span>本题试批数量</span><select value={currentQuestionState.sampleTarget} onChange={event => setSampleTarget(Number(event.target.value) as 3 | 5)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold dark:border-zinc-800 dark:bg-zinc-900"><option value={3}>3 份</option><option value={5}>5 份</option></select></label></div>
          <QuestionContext question={currentQuestion} number={questionNumber} evidence={questionEvidence} />
          <div className="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)]">
            <aside className={`${panelClass} overflow-hidden`}><div className="border-b border-slate-200/70 p-4 dark:border-zinc-800"><h2 className="font-black">第 {questionNumber} 题代表样本</h2><p className="mt-1 text-xs text-slate-500">已确认 {currentQuestionState.calibrationSamples.filter(sample => sample.status === 'confirmed').length} / {currentQuestionState.sampleTarget}</p></div>{currentQuestionState.calibrationSamples.slice(0, currentQuestionState.sampleTarget).map(sample => <button key={sample.id} type="button" onClick={() => selectSample(sample)} className={`w-full border-b border-slate-200/60 p-4 text-left last:border-0 dark:border-zinc-800/70 ${sample.id === selectedSample.id ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'hover:bg-slate-50 dark:hover:bg-zinc-900'}`}><div className="flex items-center justify-between gap-2"><strong className="text-sm">{sample.studentName}</strong>{sample.status === 'confirmed' ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : null}</div><div className="mt-2 flex items-center justify-between text-xs"><span className="text-slate-500">{sampleTypeLabel[sample.sampleType]}</span><span className={sample.gradingConfidence < lowConfidenceThreshold ? 'font-bold text-rose-700' : 'text-slate-400'}>{Math.round(sample.gradingConfidence * 100)}%</span></div></button>)}</aside>
            <div className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-2">
                <section className={`${panelClass} min-h-80 p-4`}><div className="flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-black"><FileImage className="h-4 w-4 text-emerald-700" />本题答卷截图</h3>{selectedSample.sourcePreviewUrl ? <span className="text-xs font-bold text-emerald-700">点击图片放大</span> : <span className="text-xs text-slate-400">可核对</span>}</div>{selectedSample.sourcePreviewUrl ? selectedSample.sourcePreviewType === 'image' ? <a href={selectedSample.sourcePreviewUrl} target="_blank" rel="noreferrer" className="mt-4 flex min-h-56 cursor-zoom-in items-center justify-center overflow-auto bg-slate-50 p-3 dark:bg-zinc-950"><img src={selectedSample.sourcePreviewUrl} alt={`${selectedSample.studentName} 本题答卷截图`} className="min-w-72 max-h-[520px] max-w-full border border-slate-200 bg-white object-contain" /></a> : <object data={selectedSample.sourcePreviewUrl} type="application/pdf" className="mt-4 h-[520px] w-full border border-slate-200 bg-white"><a href={selectedSample.sourcePreviewUrl} target="_blank" rel="noreferrer" className="p-4 text-sm font-bold text-emerald-700">打开 {selectedSample.sourceFileName}</a></object> : <div className="relative mx-auto mt-4 min-h-64 max-w-xs border border-slate-300 bg-[#fffdf7] p-5 shadow-sm"><span className="absolute right-4 top-3 font-mono text-xs text-slate-500">{selectedSample.studentNo.slice(-4)}</span><p className="mt-8 font-serif text-sm leading-8 text-slate-700">{selectedSample.ocrText}</p></div>}</section>
                <section className={`${panelClass} min-h-80 p-4`}><div className="flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-black"><ScanLine className="h-4 w-4 text-emerald-700" />{selectedSample.ocrSource === 'choice-vision' ? '视觉识别结果' : selectedSample.ocrSource === 'luna' ? 'Luna 主识别' : 'PaddleOCR 主识别'}</h3><span className={`rounded-xl px-2 py-1 text-xs font-bold ${selectedSample.needsTeacherReview || selectedSample.ocrConfidence < ocrHumanReviewThreshold ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'}`}>{selectedSample.needsTeacherReview ? '待核验 · ' : ''}{Math.round(selectedSample.ocrConfidence * 100)}%</span></div><textarea value={editedOcr} onChange={event => setEditedOcr(event.target.value)} rows={9} className={`${inputClass} mt-4 resize-none leading-7`} />{selectedSample.ocrSource !== 'choice-vision' && selectedSample.lunaReviewText ? <div className={`mt-3 rounded-lg border p-3 text-xs leading-5 ${selectedSample.recognitionConflict ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-700'}`}><strong>Luna 视觉复核{selectedSample.recognitionConflict ? ' · 与 PaddleOCR 有差异' : ''}</strong><p className="mt-1 whitespace-pre-line">{selectedSample.lunaReviewText}</p></div> : null}<button type="button" disabled={ocrCorrectionPhase === 'saving'} onClick={() => void saveOcrCorrection()} className="mt-3 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-50 dark:border-zinc-700">{ocrCorrectionPhase === 'saving' ? '正在保存并重新评分...' : '保存修正并重新评分'}</button></section>
              </div>
              <section className={`${panelClass} p-5`}>
                <div className="grid items-start gap-5 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]"><div className="xl:border-r xl:border-slate-200 xl:pr-5 dark:xl:border-zinc-800"><div className="flex flex-wrap items-center gap-2"><h3 className="flex items-center gap-2 text-sm font-black"><Sparkles className="h-4 w-4 text-emerald-700" />AI 评分</h3><strong className="text-xl text-slate-900 dark:text-white">{selectedSample.aiScore ?? '待定'} <span className="text-xs font-normal text-slate-400">/ {selectedSample.fullScore} 分</span></strong><span className="text-xs text-slate-400">置信度 {Math.round(selectedSample.gradingConfidence * 100)}%</span></div>{selectedSample.gradingReason ? <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">{selectedSample.gradingReason}</p> : null}{selectedSample.matchedPoints.length || selectedSample.missedPoints.length ? <div className="mt-3 flex flex-wrap gap-2">{selectedSample.matchedPoints.map(point => <span key={point} className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-2 py-1.5 text-xs text-emerald-800"><Check className="h-3.5 w-3.5" />{point}</span>)}{selectedSample.missedPoints.map(point => <span key={point} className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-2 py-1.5 text-xs text-amber-800"><AlertTriangle className="h-3.5 w-3.5" />{point}</span>)}</div> : null}</div><div>{selectedSample.resultSource === 'teacher-manual' ? <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 h-5 w-5 text-amber-600" /><div><h3 className="font-black">教师终评 {selectedSample.teacherScore} 分，已作为本题锚点</h3><p className="mt-1 text-xs text-slate-500">{selectedSample.teacherReason?.replace(/[。！？.!?]+$/, '')}。后续评分依据变化不会覆盖此结果。</p></div></div><button type="button" onClick={() => setGradingAction('manual')} className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold dark:border-zinc-700">重新打开</button></div> : selectedSample.status === 'confirmed' && gradingAction === 'none' ? <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" /><div><h3 className="font-black">试批结果已确认 · {selectedSample.teacherScore ?? selectedSample.aiScore} 分</h3><p className="mt-1 text-xs text-slate-500">{selectedSample.resultSource === 'teacher-adjusted' ? '教师已调整 AI 结果' : '教师已采用 AI 结果'}，当前结果已计入本题试批进度。</p></div></div><button type="button" onClick={() => setGradingAction('adjust')} className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold dark:border-zinc-700">重新打开</button></div> : gradingAction === 'none' ? <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black">确认这份试批样本</h3><p className="mt-1 text-xs text-slate-500">教师亲批会成为本题最终结果和校准锚点。</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={selectedSample.aiScore === null} onClick={() => { if (selectedSample.aiScore !== null) updateSample('ai-confirmed', selectedSample.aiScore, '教师确认 AI 评分'); }} className="rounded-2xl border border-slate-200 px-3 py-2.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700">采用 AI 结果</button><button type="button" onClick={() => { setRuleAddedNotice(false); setGradingAction('adjust'); }} className="rounded-2xl border border-slate-200 px-3 py-2.5 text-xs font-bold dark:border-zinc-700">调整 AI 结果</button><button type="button" onClick={() => setGradingAction('manual')} className="flex items-center gap-2 rounded-2xl bg-emerald-700 px-3 py-2.5 text-xs font-bold text-white"><UserCheck className="h-4 w-4" />由我批改</button></div></div> : <div className="space-y-4"><div className="flex items-center justify-between"><div><h3 className="font-black">{gradingAction === 'manual' ? '教师亲自批改' : '调整 AI 结果'}</h3><p className="mt-1 text-xs text-slate-500">保存分数、理由、原图和当前评分依据版本。</p></div><button type="button" title="取消" aria-label="取消" onClick={() => setGradingAction('none')} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div><div className="grid gap-3 sm:grid-cols-[120px_1fr]"><label className="space-y-1"><span className="text-xs font-bold text-slate-500">最终分数</span><input type="number" min={0} max={selectedSample.fullScore} value={teacherScore} onChange={event => setTeacherScore(Number(event.target.value))} className={inputClass} /></label><label className="space-y-1"><span className="text-xs font-bold text-slate-500">评分理由与证据</span><input value={teacherReason} onChange={event => { setTeacherReason(event.target.value); setRuleAddedNotice(false); }} className={inputClass} placeholder="说明采用或调整分数的依据" /></label></div><div className="flex flex-wrap items-center justify-end gap-2">{ruleAddedNotice ? <span className="mr-auto flex items-center gap-1.5 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" />已加入本题评分细则，可继续确认调整</span> : null}{gradingAction === 'adjust' ? <button type="button" disabled={ruleAddedNotice} onClick={() => { updateQuestionState({ ...currentQuestionState, teacherRules: [...currentQuestionState.teacherRules, teacherReason || '从当前边界样本补充的评分规则'] }); setRuleAddedNotice(true); onShowToast('已加入本题评分细则'); }} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-xs font-bold disabled:border-emerald-200 disabled:bg-emerald-50 disabled:text-emerald-700 dark:border-zinc-700">{ruleAddedNotice ? '已加入评分细则' : '加入本题评分细则'}</button> : null}<button type="button" onClick={() => updateSample(gradingAction === 'manual' ? 'teacher-manual' : 'teacher-adjusted', teacherScore, teacherReason || '教师完成分项判断')} className="rounded-2xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white">{gradingAction === 'manual' ? '完成教师批改' : '确认调整'}</button></div></div>}</div></div>
              </section>
              {selectedSample.status === 'confirmed' ? <div className="flex justify-end"><button type="button" onClick={goToNextTrialStep} className="flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white">{currentTrialSamples.some(sample => sample.status !== 'confirmed') ? '下一份' : '下一题'}<ChevronRight className="h-4 w-4" /></button></div> : null}
              <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">{allCalibrationComplete ? '所有题目的试批样本均已完成。' : '批改方式将在所有题目的试批样本完成后统一选择。'}</p>{allCalibrationComplete ? <button type="button" onClick={() => setShowModeDialog(true)} className="rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white">选择本次批改方式</button> : null}</div>
            </div>
          </div>
        </section>
      ) : null}

      {activeStage === 'grading' ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['已匹配答卷', `${matchedStudentCount} 份`],
              ['已完成批改', `${batch?.processedStudents ?? 0} / ${batch?.totalStudents || matchedStudentCount}`],
              ['待复核证据', `${pendingReviews} 项`],
              ['批改方式', modeOptions.find(option => option.id === gradingMode)?.label ?? '未选择']
            ].map(([label, value]) => <div key={label} className={`${panelClass} p-5`}><span className="text-xs font-bold text-slate-500">{label}</span><strong className="mt-2 block text-2xl text-slate-900 dark:text-white">{value}</strong></div>)}
          </div>
          <section className={`${panelClass} p-6`}><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-black text-slate-900 dark:text-white">{batch?.status === 'completed' ? '批量批改已完成' : batch?.status === 'running' ? 'AI 正在批量批改' : batch?.status === 'paused' ? '批量批改已暂停' : batch?.status === 'failed' ? '批量批改有未完成项' : '准备批量批改'}</h2><p className="mt-1 text-sm text-slate-500">已完成结果会复用；单份异常隔离后进入本任务复核。</p></div><div className="flex gap-2">{batch?.status === 'running' ? <button type="button" onClick={() => void controlBatch('pause')} className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold"><Pause className="h-4 w-4" />暂停</button> : null}{batch?.status === 'paused' ? <button type="button" onClick={() => void runBatch()} className="flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white"><Play className="h-4 w-4" />继续</button> : null}{!batch || batch.status === 'idle' || batch.status === 'failed' ? <button type="button" onClick={() => void runBatch()} className="rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white">开始批量批改</button> : null}</div></div><div className="mt-7 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800"><div className="h-full bg-emerald-600 transition-all" style={{ width: `${batch?.totalStudents ? Math.round(batch.processedStudents / batch.totalStudents * 100) : 0}%` }} /></div><div className="mt-3 flex justify-between text-xs text-slate-500"><span>{batch?.processedStudents ?? 0} 人已处理</span><span>{batch?.failedStudentIds.length ?? 0} 人处理失败</span></div>{batchError ? <p className="mt-4 text-xs font-bold text-rose-700">批改失败：{batchError}</p> : null}</section>
          {batchSamples.length ? <section className={`${panelClass} p-5`}><div className="flex flex-wrap gap-3"><label className="space-y-1"><span className="block text-xs font-bold text-slate-500">学生</span><select value={activeBatchStudentId} onChange={event => setBatchStudentId(event.target.value)} className={inputClass}>{batchStudents.map(sample => <option key={sample.studentId} value={sample.studentId}>{sample.studentName}</option>)}</select></label><label className="space-y-1"><span className="block text-xs font-bold text-slate-500">题目</span><select value={activeBatchQuestionId} onChange={event => setBatchQuestionId(event.target.value)} className={inputClass}>{selectedQuestionStates.map(state => <option key={state.questionId} value={state.questionId}>第 {selectedQuestions.find(question => question.id === state.questionId)?.displayNo} 题</option>)}</select></label></div>{selectedBatchSample ? <div className="mt-5 grid gap-4 lg:grid-cols-2"><div className="border border-slate-200 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">{selectedBatchSample.sourcePreviewUrl ? <img src={selectedBatchSample.sourcePreviewUrl} alt={`${selectedBatchSample.studentName} 答卷截图`} className="max-h-[520px] w-full object-contain" /> : null}</div><div className="space-y-3"><section className="rounded-lg border border-slate-200 p-4 dark:border-zinc-800"><strong>PaddleOCR 主识别</strong><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{selectedBatchSample.ocrText || '未识别到作答'}</p></section>{selectedBatchSample.lunaReviewText ? <section className="rounded-lg bg-amber-50 p-4 text-amber-900"><strong>Luna 视觉复核</strong><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{selectedBatchSample.lunaReviewText}</p></section> : null}<section className="rounded-lg bg-emerald-50 p-4 text-emerald-900"><strong>AI 评分：{selectedBatchSample.aiScore ?? '待定'} / {selectedBatchSample.fullScore}</strong><p className="mt-2 text-sm leading-6">{selectedBatchSample.gradingReason}</p></section></div></div> : null}</section> : null}
        </section>
      ) : null}

      {activeStage === 'review' ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black text-slate-900 dark:text-white">本任务异常证据</h2><p className="mt-1 text-xs text-slate-500">先按发生环节筛选，再查看具体原因和原图。</p></div><span className="rounded-xl bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-800">{pendingReviews} 项待复核</span></div>
          <div className="flex flex-wrap gap-2">{([['all','全部'],['intake','上传质检'],['calibration','试批校准'],['grading','批量批改'],['teacher','教师复核'],['resolved','已处理']] as const).map(([id,label]) => <button key={id} type="button" onClick={() => setReviewStage(id)} className={`rounded-2xl px-4 py-2 text-xs font-bold ${reviewStage === id ? 'bg-emerald-700 text-white' : 'border border-slate-200 text-slate-500 dark:border-zinc-800'}`}>{label}</button>)}</div>
          {visibleReviewSamples.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visibleReviewSamples.map(sample => {
            const question = workflowState.questions.find(item => item.id === sample.questionId);
            const shownScore = sample.status === 'confirmed' ? sample.teacherScore ?? sample.aiScore : sample.aiScore;
            return <button type="button" onClick={() => openReviewSample(sample)} key={sample.id} className={`${panelClass} overflow-hidden text-left`}><div className="h-36 bg-slate-100 dark:bg-zinc-900">{sample.sourcePreviewUrl ? <img src={sample.sourcePreviewUrl} alt={`${sample.studentName} 第 ${question?.displayNo} 题`} className="h-full w-full object-contain" /> : null}</div><div className="p-4"><div className="flex items-start justify-between gap-3"><div><strong className="text-base">{sample.studentName}</strong><p className="mt-1 text-xs text-slate-500">第 {question?.displayNo ?? '-'} 题 · {shownScore ?? '待定'} / {sample.fullScore} 分</p></div><span className={`rounded-xl px-2 py-1 text-[10px] font-bold ${sample.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{sample.status === 'confirmed' ? '已完成复核' : sample.recognitionConflict ? '两次识别不一致' : sample.gradingConfidence < lowConfidenceThreshold ? '评分把握较低' : '等待老师确认'}</span></div><p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">{sample.status === 'confirmed' ? sample.teacherReason : sample.gradingReason}</p></div></button>;
          })}</div> : <section className={`${panelClass} flex min-h-56 flex-col items-center justify-center p-8 text-center`}><CheckCircle2 className="h-9 w-9 text-emerald-500" /><p className="mt-3 text-sm font-bold text-slate-600">当前环节没有异常</p></section>}
          {selectedReviewSample ? createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-2 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label={`${selectedReviewSample.studentName} 异常复核`}><div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] dark:bg-zinc-950"><header className="flex flex-none items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-zinc-800"><div><h2 className="text-lg font-black">{selectedReviewSample.studentName} · 异常复核</h2><p className="mt-1 text-xs text-slate-500">原图、识别文本和评分在同一处完成裁定。</p></div><button type="button" aria-label="关闭异常详情" onClick={() => setReviewSampleId(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button></header><div className="min-h-0 flex-1 overflow-y-auto p-4"><div className="grid gap-4 lg:grid-cols-2"><section className="border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">{selectedReviewSample.sourcePreviewUrl ? <img src={selectedReviewSample.sourcePreviewUrl} alt="答卷原图依据" className="max-h-[620px] w-full object-contain" /> : <p className="p-8 text-center text-sm text-slate-400">暂无原图</p>}</section><div className="space-y-3 text-sm"><section className="rounded-lg border border-slate-200 p-4 dark:border-zinc-800"><div className="flex items-center justify-between gap-3"><strong>PaddleOCR 主识别</strong><span className="text-xs text-slate-400">可按原图修正</span></div><textarea value={reviewEditedOcr} onChange={event => setReviewEditedOcr(event.target.value)} rows={6} className={`${inputClass} mt-3 h-auto resize-y py-3 leading-6`} /><button type="button" disabled={reviewSaving !== 'idle' || selectedReviewSample.resultSource === 'teacher-manual'} onClick={() => void saveReviewOcrCorrection()} className="mt-3 rounded-2xl border border-slate-200 px-3 py-2.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700">{selectedReviewSample.resultSource === 'teacher-manual' ? '教师终评已锁定识别文本' : reviewSaving === 'ocr' ? '正在重新评分...' : '保存修正并重新评分'}</button></section>{selectedReviewSample.lunaReviewText ? <section className="rounded-lg bg-amber-50 p-4 text-amber-900"><strong>Luna 视觉复核</strong><p className="mt-2 whitespace-pre-wrap leading-6">{selectedReviewSample.lunaReviewText}</p></section> : null}<section className="rounded-lg bg-emerald-50 p-4 text-emerald-900"><strong>AI 评分：{selectedReviewSample.aiScore ?? '待定'} / {selectedReviewSample.fullScore}</strong><p className="mt-2 leading-6">{selectedReviewSample.gradingReason}</p></section></div></div></div><footer className="flex-none border-t border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"><div className="grid items-end gap-3 lg:grid-cols-[120px_minmax(0,1fr)_auto]"><label className="space-y-1"><span className="text-xs font-bold text-slate-500">教师最终分</span><input type="number" min={0} max={selectedReviewSample.fullScore} value={reviewScore} onChange={event => setReviewScore(Math.min(selectedReviewSample.fullScore, Math.max(0, Number(event.target.value))))} className={inputClass} /></label><label className="space-y-1"><span className="text-xs font-bold text-slate-500">复核理由</span><input value={reviewReason} onChange={event => setReviewReason(event.target.value)} placeholder="说明采用或调整分数的证据" className={inputClass} /></label><div className="flex flex-wrap gap-2"><button type="button" disabled={selectedReviewSample.aiScore === null || reviewSaving !== 'idle'} onClick={() => void confirmReviewDecision('ai-confirmed')} className="h-11 rounded-2xl border border-slate-200 px-4 text-xs font-bold disabled:opacity-50 dark:border-zinc-700">采用 AI 评分</button><button type="button" disabled={!reviewReason.trim() || reviewSaving !== 'idle'} onClick={() => void confirmReviewDecision('teacher-manual')} className="h-11 rounded-2xl bg-emerald-700 px-4 text-xs font-bold text-white disabled:opacity-50">{reviewSaving === 'decision' ? '正在保存...' : '确认教师裁定'}</button></div></div></footer></div></div>, document.body) : null}
        </section>
      ) : null}

      {activeStage === 'diagnosis' && diagnosis ? <section className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><div className={`${panelClass} p-5`}><span className="text-xs font-bold text-slate-500">完成批改</span><strong className="mt-2 block text-2xl">{diagnosis.gradedStudentCount} 人</strong></div><div className={`${panelClass} p-5`}><span className="text-xs font-bold text-slate-500">班级平均分</span><strong className="mt-2 block text-2xl">{diagnosis.averageScore?.toFixed(1) ?? '-'} / {diagnosis.averageFullScore}</strong></div><div className={`${panelClass} p-5`}><span className="text-xs font-bold text-slate-500">待复核证据</span><strong className="mt-2 block text-2xl">{pendingReviews} 项</strong></div></div><div className="grid gap-4 lg:grid-cols-2"><section className={`${panelClass} p-5`}><h2 className="font-black">各题表现</h2><div className="mt-4 space-y-3">{diagnosis.questionPerformance.map(item => <div key={item.questionId}><div className="flex justify-between text-xs"><strong>第 {item.displayNo} 题</strong><span>{Math.round(item.scoreRate * 100)}%</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-600" style={{width:`${Math.round(item.scoreRate * 100)}%`}} /></div></div>)}</div></section><section className={`${panelClass} p-5`}><h2 className="font-black">主要失分点</h2><div className="mt-4 space-y-2">{diagnosis.commonIssues.length ? diagnosis.commonIssues.map(item => <div key={item.label} className="flex items-start justify-between gap-4 rounded-2xl bg-amber-50 p-3 text-xs text-amber-900"><span>{item.label}</span><strong>{item.count} 人次</strong></div>) : <p className="text-sm text-slate-500">暂无明确共性失分点。</p>}</div></section></div><section className={`${panelClass} p-5`}><h2 className="font-black">典型学生</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{diagnosis.typicalStudents.map(item => <div key={`${item.role}-${item.studentId}`} className="rounded-2xl border border-slate-200 p-4"><span className="text-xs font-bold text-emerald-700">{item.role}</span><strong className="mt-1 block">{item.studentName}</strong><span className="mt-1 block text-xs text-slate-500">总分 {item.totalScore} / {diagnosis.averageFullScore}</span></div>)}</div></section></section> : null}
      {activeStage === 'diagnosis' && !diagnosis ? <section className={`${panelClass} flex min-h-80 flex-col items-center justify-center p-8 text-center`}><BookOpenCheck className="h-10 w-10 text-emerald-700" /><h2 className="mt-4 font-black">正在汇总真实批改结果</h2></section> : null}

      {showModeDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="选择本次批改方式">
          <div className="glass-panel w-full max-w-2xl rounded-[24px] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="text-lg font-black">所有题目试批已完成</h2><p className="mt-1 text-sm text-slate-500">现在决定本次任务需要教师介入的频率。</p></div><button type="button" title="关闭" aria-label="关闭" onClick={() => setShowModeDialog(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div><div className="mt-5 grid gap-3 md:grid-cols-3">{modeOptions.map(option => <button key={option.id} type="button" onClick={() => setGradingMode(option.id)} className={`rounded-2xl border p-4 text-left transition-all ${gradingMode === option.id ? 'border-emerald-700 bg-emerald-50 ring-2 ring-emerald-700/10' : 'border-slate-200 hover:border-emerald-300 dark:border-zinc-800'}`}><strong className="text-sm">{option.label}</strong><span className="mt-2 block text-xs leading-5 text-slate-500">{option.description}</span></button>)}</div><div className="mt-6 flex justify-end"><button type="button" onClick={lockAndStart} className="flex items-center gap-2 rounded-2xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800"><LockKeyhole className="h-4 w-4" />锁定评分依据并开始批改</button></div></div>
        </div>
      ) : null}
    </div>
  );
}
