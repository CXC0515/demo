/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Eye,
  FileImage,
  FileText,
  Info,
  Layers3,
  LockKeyhole,
  Pause,
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
import { Fragment, useState } from 'react';
import {
  CalibrationResultSource,
  CalibrationSample,
  GradingMode,
  QuestionGradingState,
  ReviewItem,
  SchoolClass,
  SubmissionPage,
  WorkbenchTask,
  WorkflowState
} from '../../domain/types';
import ReviewQueuePage from './ReviewQueuePage';

interface GradingWorkflowProps {
  workflowState: WorkflowState;
  classes: SchoolClass[];
  tasks: WorkbenchTask[];
  selectedTask: WorkbenchTask;
  reviewQueue: ReviewItem[];
  lowConfidenceThreshold: number;
  ocrHumanReviewThreshold: number;
  ocrAutoPassThreshold: number;
  onBack: () => void;
  onSelectTask: (task: WorkbenchTask) => void;
  onUpdateState: (newState: Partial<WorkflowState>) => void;
  onSyncToProfiles: () => void;
  onConfirmReview: (reviewId: string, finalScore: number, changeReason: string) => void;
  onBounceToOcr: (reviewId: string) => void;
  onMarkAsSample: (studentName: string) => void;
  onShowToast: (message: string) => void;
}

type StageId = 'intake' | 'rubric' | 'calibration' | 'grading' | 'review' | 'diagnosis';

const stages: { id: StageId; label: string }[] = [
  { id: 'intake', label: '上传质检' },
  { id: 'rubric', label: '评分依据' },
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

const modeOptions: { id: GradingMode; label: string; description: string }[] = [
  { id: 'per-submission', label: '每份都确认', description: '每份作业完成后等待教师确认' },
  { id: 'batch-checkpoint', label: '每 10 份确认', description: '分批检查，逐步建立本次任务信任' },
  { id: 'auto-continue', label: '自动继续', description: '正常答卷持续处理，异常单独隔离' }
];

const panelClass = 'glass-panel rounded-[24px]';
const inputClass = 'w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 dark:border-zinc-800 dark:bg-zinc-900';

function QuestionSelector({ questions, states, selectedId, onSelect }: { questions: WorkflowState['questions']; states: QuestionGradingState[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-max gap-2" role="tablist" aria-label="选择题号">
        {questions.map((question, index) => {
          const state = states.find(item => item.questionId === question.id);
          const confirmed = state?.calibrationSamples.filter(sample => sample.status === 'confirmed').length ?? 0;
          const target = state?.sampleTarget ?? 3;
          const active = selectedId === question.id;
          return (
            <button key={question.id} type="button" role="tab" aria-selected={active} onClick={() => onSelect(question.id)} className={`min-w-36 rounded-2xl border px-4 py-3 text-left transition-all ${active ? 'border-emerald-700 bg-emerald-700 text-white shadow-md shadow-emerald-700/10' : 'border-slate-200 bg-white/70 text-slate-600 hover:border-emerald-300 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-slate-300'}`}>
              <span className="block text-sm font-black">第 {index + 1} 题</span>
              <span className={`mt-1 block max-w-32 truncate text-xs ${active ? 'text-emerald-50' : 'text-slate-400'}`}>{question.title}</span>
              <span className={`mt-2 block text-[11px] font-bold ${active ? 'text-white' : confirmed >= target ? 'text-emerald-700' : 'text-amber-700'}`}>{confirmed >= target ? '试批已完成' : `试批 ${confirmed}/${target}`}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QuestionContext({ question, number }: { question: WorkflowState['questions'][number]; number: number }) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white/70 p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold"><span className="text-emerald-700">第 {number} 题 · {question.score} 分</span><span className="rounded-xl bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-zinc-800 dark:text-slate-300">{question.aiQuestionType ?? 'AI 待识别题型'}</span><span className="rounded-xl bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">{question.knowledgePoint}</span></div>
      <h2 className="mt-3 text-base font-black text-slate-900 dark:text-white">{question.title}</h2>
      <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-200">{question.stem ?? question.desc}</p>
    </section>
  );
}

function RubricEditor({ questionState, onChange, onSaveDraft, onApply }: { questionState: QuestionGradingState; onChange: (next: QuestionGradingState) => void; onSaveDraft: () => void; onApply: () => void }) {
  const [newRule, setNewRule] = useState('');
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
        <span className="rounded-xl bg-amber-100 px-2.5 py-1.5 text-xs font-bold text-amber-800">试批中</span>
      </div>
      <label className="block space-y-2"><span className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-100"><FileText className="h-4 w-4 text-emerald-700" />标准答案</span><textarea value={questionState.standardAnswer} onChange={event => onChange({ ...questionState, standardAnswer: event.target.value })} rows={5} className={`${inputClass} resize-none leading-6`} /></label>
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
      <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-zinc-800"><button type="button" onClick={onSaveDraft} className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 dark:border-zinc-700 dark:text-slate-300"><Save className="h-4 w-4" />保存草稿</button><button type="button" onClick={onApply} className="flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800"><RefreshCw className="h-4 w-4" />应用到试批</button></div>
    </div>
  );
}

function OcrInlineReview({ page, humanThreshold, autoThreshold, onClose, onConfirm }: { page: SubmissionPage; humanThreshold: number; autoThreshold: number; onClose: () => void; onConfirm: () => void }) {
  const signals = [
    ['学号识别', page.studentNoConfidence ?? page.ocrConfidence],
    ['文字识别', page.textConfidence ?? page.ocrConfidence],
    ['区域完整性', page.regionCompleteness ?? 1],
    ['页面连续性', page.pageContinuity ?? 1]
  ] as const;
  return (
    <div className="m-3 rounded-[24px] border border-emerald-200 bg-emerald-50/40 p-5 dark:border-emerald-900 dark:bg-emerald-950/10">
      <div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-slate-900 dark:text-white">{page.expectedStudentName} · 异常核对</h3><p className="mt-1 text-xs text-rose-700">{page.issueReason ?? '识别结果需要教师确认。'}</p></div><button type="button" title="收起" aria-label="收起" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-white"><X className="h-4 w-4" /></button></div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_260px]">
        <div className="border border-slate-300 bg-[#fffdf7] p-4 shadow-sm"><span className="block text-right font-mono text-[10px] text-slate-500">{page.detectedStudentNo}</span><p className="mt-4 font-serif text-xs leading-6 text-slate-700">驿路梨花既指路边的梨花，也指梨花姑娘，还象征着互相帮助的精神。</p><p className="mt-4 border-t border-dashed border-slate-300 pt-2 text-[10px] text-slate-400">模拟原图</p></div>
        <div><label className="text-xs font-black text-slate-600">OCR 文本</label><textarea defaultValue="驿路梨花既指路边的梨花，也指梨花姑娘，还象征着互相帮助的精神。" rows={5} className={`${inputClass} mt-2 resize-none leading-6`} /><p className="mt-2 text-[11px] leading-5 text-slate-500"><Info className="mr-1 inline h-3 w-3" />{Math.round(humanThreshold * 100)}%–{Math.round(autoThreshold * 100)}% 先由多模态模型核验；缺页和错配始终人工确认。</p></div>
        <div className="grid grid-cols-2 gap-2">{signals.map(([label, value]) => <div key={label} className="rounded-2xl bg-white p-3 dark:bg-zinc-900"><span className="text-[11px] font-bold text-slate-500">{label}</span><strong className="mt-1 block text-lg">{Math.round(value * 100)}%</strong></div>)}</div>
      </div>
      <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold dark:border-zinc-700 dark:bg-zinc-900">收起</button><button type="button" onClick={onConfirm} className="rounded-2xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800">确认归属与文本</button></div>
    </div>
  );
}

export default function GradingWorkflow({
  workflowState,
  classes,
  selectedTask,
  reviewQueue,
  lowConfidenceThreshold,
  ocrHumanReviewThreshold,
  ocrAutoPassThreshold,
  onBack,
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
  const [activeStage, setActiveStage] = useState<StageId>('intake');
  const [questionStates, setQuestionStates] = useState<QuestionGradingState[]>(initialQuestionStates);
  const [selectedQuestionId, setSelectedQuestionId] = useState(workflowState.questions[0]?.id ?? '');
  const [selectedSampleId, setSelectedSampleId] = useState(initialQuestionStates[0]?.calibrationSamples[0]?.id ?? '');
  const [editedOcr, setEditedOcr] = useState(initialQuestionStates[0]?.calibrationSamples[0]?.ocrText ?? '');
  const [gradingAction, setGradingAction] = useState<'none' | 'adjust' | 'manual'>('none');
  const [teacherScore, setTeacherScore] = useState(0);
  const [teacherReason, setTeacherReason] = useState('');
  const [gradingMode, setGradingMode] = useState<GradingMode>(workflowState.gradingMode ?? 'batch-checkpoint');
  const [showModeDialog, setShowModeDialog] = useState(false);
  const [showOnlyOcrIssues, setShowOnlyOcrIssues] = useState(false);
  const [expandedOcrPageId, setExpandedOcrPageId] = useState<string | null>(null);
  const [ruleAddedNotice, setRuleAddedNotice] = useState(false);
  const [gradedCount, setGradedCount] = useState(36);
  const [isPaused, setIsPaused] = useState(false);
  const [diagnosisConfirmed, setDiagnosisConfirmed] = useState(false);

  const currentClass = classes.find(item => item.id === selectedTask.classId) ?? classes[0];
  const currentQuestion = workflowState.questions.find(item => item.id === selectedQuestionId) ?? workflowState.questions[0];
  const currentQuestionState = questionStates.find(item => item.questionId === selectedQuestionId) ?? questionStates[0];
  const selectedSample = currentQuestionState?.calibrationSamples.find(sample => sample.id === selectedSampleId) ?? currentQuestionState?.calibrationSamples[0];
  const matchRows = workflowState.submissionPages ?? [];
  const issueRows = matchRows.filter(row => row.status !== 'matched');
  const displayedRows = showOnlyOcrIssues ? issueRows : matchRows;
  const missingRows = workflowState.missingSubmissions ?? [];
  const pendingReviews = reviewQueue.filter(item => item.status === 'pending').length;
  const allCalibrationComplete = questionStates.length > 0 && questionStates.every(state => state.calibrationSamples.filter(sample => sample.status === 'confirmed').length >= state.sampleTarget);

  const selectQuestion = (questionId: string) => {
    const nextState = questionStates.find(item => item.questionId === questionId);
    const nextSample = nextState?.calibrationSamples.find(sample => sample.status === 'pending') ?? nextState?.calibrationSamples[0];
    setSelectedQuestionId(questionId);
    setSelectedSampleId(nextSample?.id ?? '');
    setEditedOcr(nextSample?.ocrText ?? '');
    setTeacherScore(nextSample?.teacherScore ?? nextSample?.aiScore ?? 0);
    setTeacherReason(nextSample?.teacherReason ?? '');
    setGradingAction('none');
    setRuleAddedNotice(false);
  };

  const updateQuestionState = (next: QuestionGradingState) => setQuestionStates(current => current.map(item => item.questionId === next.questionId ? next : item));

  const setSampleTarget = (target: 3 | 5) => {
    if (!currentQuestionState || !currentQuestion) return;
    let nextSamples = currentQuestionState.calibrationSamples;
    if (target > nextSamples.length) {
      const sourcePool = workflowState.calibrationSamples ?? [];
      const additions = sourcePool.slice(nextSamples.length, target).map((sample, index) => ({ ...sample, id: `${currentQuestion.id}-extra-${index}`, questionId: currentQuestion.id, fullScore: currentQuestion.score, status: 'pending' as const, resultSource: undefined, teacherScore: undefined, isFinal: false }));
      nextSamples = [...nextSamples, ...additions];
    }
    updateQuestionState({ ...currentQuestionState, sampleTarget: target, calibrationSamples: nextSamples });
  };

  const selectSample = (sample: CalibrationSample) => {
    setSelectedSampleId(sample.id);
    setEditedOcr(sample.ocrText);
    setTeacherScore(sample.teacherScore ?? sample.aiScore);
    setTeacherReason(sample.teacherReason ?? '');
    setGradingAction('none');
    setRuleAddedNotice(false);
  };

  const updateSample = (source: CalibrationResultSource, score: number, reason: string) => {
    if (!selectedSample || !currentQuestionState) return;
    const nextState = {
      ...currentQuestionState,
      calibrationSamples: currentQuestionState.calibrationSamples.map(sample => sample.id === selectedSample.id ? { ...sample, ocrText: editedOcr, status: 'confirmed' as const, resultSource: source, teacherScore: score, teacherReason: reason, isFinal: true, rubricVersion: currentQuestionState.rubricVersion } : sample)
    };
    const nextStates = questionStates.map(item => item.questionId === nextState.questionId ? nextState : item);
    setQuestionStates(nextStates);
    setGradingAction('none');
    onShowToast(source === 'teacher-manual' ? `${selectedSample.studentName} 已完成教师终评，并作为本题校准锚点` : `${selectedSample.studentName} 的试批结果已确认`);
    if (nextStates.every(state => state.calibrationSamples.filter(sample => sample.status === 'confirmed').length >= state.sampleTarget)) setShowModeDialog(true);
  };

  const saveRubricDraft = () => {
    onUpdateState({ questionGradingStates: questionStates });
    onShowToast(`第 ${workflowState.questions.findIndex(item => item.id === selectedQuestionId) + 1} 题评分依据草稿已保存`);
  };

  const applyRubric = () => {
    if (!currentQuestionState) return;
    const nextVersion = currentQuestionState.rubricVersion + 1;
    const next = {
      ...currentQuestionState,
      rubricVersion: nextVersion,
      calibrationSamples: currentQuestionState.calibrationSamples.map(sample => sample.resultSource === 'teacher-manual' ? sample : { ...sample, status: 'pending' as const, isFinal: false, rubricVersion: nextVersion })
    };
    const nextStates = questionStates.map(item => item.questionId === next.questionId ? next : item);
    setQuestionStates(nextStates);
    onUpdateState({ questionGradingStates: nextStates });
    onShowToast(`本题评分依据已更新为 V${nextVersion}，教师终评样本保持不变`);
  };

  const lockAndStart = () => {
    onUpdateState({ gradingMode, questionGradingStates: questionStates, jointReviewQuestionIds: questionStates.filter(item => item.jointReviewEnabled).map(item => item.questionId) });
    setShowModeDialog(false);
    setActiveStage('grading');
    onShowToast(`开始按“${modeOptions.find(option => option.id === gradingMode)?.label}”批改`);
  };

  const questionNumber = currentQuestion ? workflowState.questions.findIndex(item => item.id === currentQuestion.id) + 1 : 1;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 items-center gap-3"><button type="button" title="返回批改任务" aria-label="返回批改任务" onClick={onBack} className="rounded-2xl border border-slate-200 bg-white/70 p-2.5 text-slate-500 hover:text-emerald-700 dark:border-zinc-800 dark:bg-zinc-900"><ArrowLeft className="h-4 w-4" /></button><div className="min-w-0"><h1 className="truncate text-xl font-black text-slate-900 dark:text-white">{selectedTask.name}</h1><p className="mt-1 text-xs text-slate-500">{currentClass.name} · {currentClass.studentCount} 人 · {selectedTask.deadline}</p></div></div>
      </header>

      <nav aria-label="任务流程" className="glass-panel grid grid-cols-2 overflow-hidden rounded-[24px] bg-slate-100/60 p-2 sm:grid-cols-3 xl:grid-cols-6 dark:bg-zinc-900/60">
        {stages.map((stage, index) => {
          const active = activeStage === stage.id;
          return <button key={stage.id} type="button" onClick={() => setActiveStage(stage.id)} className={`relative flex min-h-12 items-center justify-center gap-2 rounded-2xl px-3 text-xs font-bold transition-all ${active ? 'bg-white text-slate-900 shadow-sm dark:bg-zinc-800 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}><span className={`flex h-6 w-6 items-center justify-center rounded-xl text-[11px] ${active ? 'bg-emerald-700 text-white' : 'bg-white/80 text-slate-400 dark:bg-zinc-800'}`}>{index + 1}</span>{stage.label}{stage.id === 'review' && pendingReviews ? <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] text-white">{pendingReviews}</span> : null}</button>;
        })}
      </nav>

      {activeStage === 'intake' ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[['应交', currentClass.studentCount, '人'], ['已识别', currentClass.studentCount - missingRows.length, '人'], ['未交', missingRows.length, '人'], ['自动通过', matchRows.filter(row => row.status === 'matched').length, '组'], ['待质检', issueRows.length, '组']].map(([label, value, unit]) => <div key={String(label)} className={`${panelClass} p-4`}><span className="text-xs font-bold text-slate-500">{label}</span><div className="mt-2"><strong className="text-2xl text-slate-900 dark:text-white">{value}</strong><span className="ml-1 text-xs text-slate-400">{unit}</span></div></div>)}
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section className={`${panelClass} overflow-hidden`}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 p-5 dark:border-zinc-800"><div><h2 className="font-black text-slate-900 dark:text-white">上传与识别结果</h2><p className="mt-1 text-xs text-slate-500">按名单顺序上传，同一学生页面连续排列。</p></div><button type="button" onClick={() => { setShowOnlyOcrIssues(value => !value); setExpandedOcrPageId(null); }} disabled={!issueRows.length} className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold disabled:opacity-50 ${showOnlyOcrIssues ? 'border border-slate-200 bg-white text-slate-600 dark:border-zinc-700 dark:bg-zinc-900' : 'bg-rose-600 text-white'}`}><CircleAlert className="h-4 w-4" />{showOnlyOcrIssues ? '查看全部' : `仅看 ${issueRows.length} 项异常`}</button></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-slate-200/70 text-xs font-bold text-slate-400 dark:border-zinc-800"><th className="px-5 py-3">顺序</th><th className="px-3 py-3">名单预期</th><th className="px-3 py-3">识别学号</th><th className="px-3 py-3">页数</th><th className="px-3 py-3">文字识别</th><th className="px-3 py-3">处理方式</th><th className="px-3 py-3" /></tr></thead><tbody>{displayedRows.map(row => <Fragment key={row.id}><tr className="border-b border-slate-200/50 last:border-0 dark:border-zinc-800/70"><td className="px-5 py-4 tabular-nums">{row.sequence}</td><td className="px-3 py-4 font-bold">{row.expectedStudentName}</td><td className="px-3 py-4 font-mono text-xs">{row.detectedStudentNo}</td><td className="px-3 py-4">{row.pageCount}</td><td className="px-3 py-4">{Math.round((row.textConfidence ?? row.ocrConfidence) * 100)}%</td><td className="px-3 py-4"><span className={`rounded-xl px-2.5 py-1.5 text-xs font-bold ${row.status === 'matched' ? 'bg-emerald-100 text-emerald-800' : row.reviewSource === 'multimodal' ? 'bg-sky-100 text-sky-800' : 'bg-rose-100 text-rose-800'}`}>{row.status === 'matched' ? '自动通过' : row.reviewSource === 'multimodal' ? '多模态核验' : '教师复核'}</span></td><td className="px-3 py-4">{row.status !== 'matched' ? <button type="button" onClick={() => setExpandedOcrPageId(current => current === row.id ? null : row.id)} className="rounded-xl p-2 text-emerald-700 hover:bg-emerald-50" title="核对异常" aria-label={`核对 ${row.expectedStudentName} 的异常`}><Eye className="h-4 w-4" /></button> : null}</td></tr>{expandedOcrPageId === row.id ? <tr><td colSpan={7} className="p-0"><OcrInlineReview page={row} humanThreshold={ocrHumanReviewThreshold} autoThreshold={ocrAutoPassThreshold} onClose={() => setExpandedOcrPageId(null)} onConfirm={() => { onShowToast(`${row.expectedStudentName} 的归属与 OCR 文本已确认`); setExpandedOcrPageId(null); }} /></td></tr> : null}</Fragment>)}</tbody></table></div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 p-5 dark:border-zinc-800"><span className="text-xs text-slate-500">高于阈值不代表必然正确，缺页和错配始终拦截。</span><button type="button" onClick={() => setActiveStage('rubric')} className="flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800">进入评分依据<ArrowRight className="h-4 w-4" /></button></div>
            </section>
            <aside className="space-y-4">
              <section className={`${panelClass} p-5`}><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-black"><Users className="h-4 w-4 text-rose-600" />未交作业</h2><span className="text-sm font-black text-rose-700">{missingRows.length} 人</span></div><div className="mt-4 space-y-2">{missingRows.map(student => <div key={student.studentId} className="flex items-center justify-between rounded-2xl bg-rose-50 px-3 py-2.5 text-sm dark:bg-rose-950/20"><div><strong>{student.studentName}</strong><span className="ml-2 font-mono text-xs text-slate-500">{student.studentNo}</span></div><button type="button" onClick={() => onShowToast(`${student.studentName} 已标记为待补交`)} className="text-xs font-bold text-rose-700">待补交</button></div>)}</div></section>
              <section className={`${panelClass} p-5`}><div className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-emerald-700" /><h2 className="font-black">当前 OCR 规则</h2></div><div className="mt-4 space-y-3 text-xs leading-5 text-slate-500"><p><strong className="text-rose-700">低于 {Math.round(ocrHumanReviewThreshold * 100)}%</strong>：人工复核</p><p><strong className="text-sky-700">中间区间</strong>：多模态模型核验</p><p><strong className="text-emerald-700">高于 {Math.round(ocrAutoPassThreshold * 100)}%</strong>：无硬异常时自动通过</p></div><p className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-400 dark:border-zinc-800">阈值在“设置 → AI 参数”中统一调整。</p></section>
            </aside>
          </div>
        </section>
      ) : null}

      {activeStage === 'rubric' && currentQuestionState ? (
        <section className="space-y-4"><QuestionSelector questions={workflowState.questions} states={questionStates} selectedId={selectedQuestionId} onSelect={selectQuestion} /><QuestionContext question={currentQuestion} number={questionNumber} /><div className={`${panelClass} p-6`}><div className="mb-5 flex justify-end border-b border-slate-200 pb-4 dark:border-zinc-800"><button type="button" onClick={() => setActiveStage('calibration')} className="flex items-center gap-1 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold text-emerald-700 dark:border-zinc-700">去试批<ChevronRight className="h-3.5 w-3.5" /></button></div><RubricEditor questionState={currentQuestionState} onChange={updateQuestionState} onSaveDraft={saveRubricDraft} onApply={applyRubric} /></div></section>
      ) : null}

      {activeStage === 'calibration' && currentQuestionState && selectedSample ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3"><QuestionSelector questions={workflowState.questions} states={questionStates} selectedId={selectedQuestionId} onSelect={selectQuestion} /><label className="flex items-center gap-2 text-xs font-bold text-slate-500"><span>本题试批数量</span><select value={currentQuestionState.sampleTarget} onChange={event => setSampleTarget(Number(event.target.value) as 3 | 5)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold dark:border-zinc-800 dark:bg-zinc-900"><option value={3}>3 份</option><option value={5}>5 份</option></select></label></div>
          <QuestionContext question={currentQuestion} number={questionNumber} />
          <div className="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)]">
            <aside className={`${panelClass} overflow-hidden`}><div className="border-b border-slate-200/70 p-4 dark:border-zinc-800"><h2 className="font-black">第 {questionNumber} 题代表样本</h2><p className="mt-1 text-xs text-slate-500">已确认 {currentQuestionState.calibrationSamples.filter(sample => sample.status === 'confirmed').length} / {currentQuestionState.sampleTarget}</p></div>{currentQuestionState.calibrationSamples.slice(0, currentQuestionState.sampleTarget).map(sample => <button key={sample.id} type="button" onClick={() => selectSample(sample)} className={`w-full border-b border-slate-200/60 p-4 text-left last:border-0 dark:border-zinc-800/70 ${sample.id === selectedSample.id ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'hover:bg-slate-50 dark:hover:bg-zinc-900'}`}><div className="flex items-center justify-between gap-2"><strong className="text-sm">{sample.studentName}</strong>{sample.status === 'confirmed' ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : null}</div><div className="mt-2 flex items-center justify-between text-xs"><span className="text-slate-500">{sampleTypeLabel[sample.sampleType]}</span><span className={sample.gradingConfidence < lowConfidenceThreshold ? 'font-bold text-rose-700' : 'text-slate-400'}>{Math.round(sample.gradingConfidence * 100)}%</span></div></button>)}</aside>
            <div className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-3">
                <section className={`${panelClass} min-h-80 p-4`}><div className="flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-black"><FileImage className="h-4 w-4 text-emerald-700" />原始答卷</h3><span className="text-xs text-slate-400">可核对</span></div><div className="relative mx-auto mt-4 min-h-64 max-w-xs rotate-[-0.5deg] border border-slate-300 bg-[#fffdf7] p-5 shadow-sm"><span className="absolute right-4 top-3 font-mono text-xs text-slate-500">{selectedSample.studentNo.slice(-4)}</span><p className="mt-8 font-serif text-sm leading-8 text-slate-700">{selectedSample.ocrText}</p><p className="mt-6 border-t border-dashed border-slate-300 pt-3 text-[11px] leading-5 text-slate-400">模拟原图：{selectedSample.rawImageDescription}</p></div></section>
                <section className={`${panelClass} min-h-80 p-4`}><div className="flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-black"><ScanLine className="h-4 w-4 text-emerald-700" />OCR 文本</h3><span className={`rounded-xl px-2 py-1 text-xs font-bold ${selectedSample.ocrConfidence < ocrHumanReviewThreshold ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'}`}>{Math.round(selectedSample.ocrConfidence * 100)}%</span></div><textarea value={editedOcr} onChange={event => setEditedOcr(event.target.value)} rows={9} className={`${inputClass} mt-4 resize-none leading-7`} /><button type="button" onClick={() => onShowToast('OCR 修正已保存，本题 AI 评分将重新计算')} className="mt-3 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold dark:border-zinc-700">保存 OCR 修正</button></section>
                <section className={`${panelClass} min-h-80 p-4`}><div className="flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-black"><Sparkles className="h-4 w-4 text-emerald-700" />AI 评分</h3><span className="text-xs text-slate-400">置信度 {Math.round(selectedSample.gradingConfidence * 100)}%</span></div><div className="mt-5 flex items-end gap-1"><strong className="text-3xl text-slate-900 dark:text-white">{selectedSample.aiScore}</strong><span className="pb-1 text-sm text-slate-400">/ {selectedSample.fullScore} 分</span></div><div className="mt-5 space-y-2">{selectedSample.matchedPoints.map(point => <div key={point} className="flex gap-2 rounded-xl bg-emerald-50 p-2.5 text-xs text-emerald-800"><Check className="h-3.5 w-3.5 flex-none" />{point}</div>)}{selectedSample.missedPoints.map(point => <div key={point} className="flex gap-2 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-800"><AlertTriangle className="h-3.5 w-3.5 flex-none" />{point}</div>)}</div></section>
              </div>
              <section className={`${panelClass} p-5`}>
                {selectedSample.resultSource === 'teacher-manual' ? <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 h-5 w-5 text-amber-600" /><div><h3 className="font-black">教师终评 {selectedSample.teacherScore} 分，已作为本题锚点</h3><p className="mt-1 text-xs text-slate-500">{selectedSample.teacherReason?.replace(/[。！？.!?]+$/, '')}。后续评分依据变化不会覆盖此结果。</p></div></div><button type="button" onClick={() => setGradingAction('manual')} className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold dark:border-zinc-700">重新打开</button></div> : selectedSample.status === 'confirmed' && gradingAction === 'none' ? <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" /><div><h3 className="font-black">试批结果已确认 · {selectedSample.teacherScore ?? selectedSample.aiScore} 分</h3><p className="mt-1 text-xs text-slate-500">{selectedSample.resultSource === 'teacher-adjusted' ? '教师已调整 AI 结果' : '教师已采用 AI 结果'}，当前结果已计入本题试批进度。</p></div></div><button type="button" onClick={() => setGradingAction('adjust')} className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold dark:border-zinc-700">重新打开</button></div> : gradingAction === 'none' ? <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black">确认这份试批样本</h3><p className="mt-1 text-xs text-slate-500">教师亲批会成为本题最终结果和校准锚点。</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => updateSample('ai-confirmed', selectedSample.aiScore, '教师确认 AI 评分')} className="rounded-2xl border border-slate-200 px-3 py-2.5 text-xs font-bold dark:border-zinc-700">采用 AI 结果</button><button type="button" onClick={() => { setRuleAddedNotice(false); setGradingAction('adjust'); }} className="rounded-2xl border border-slate-200 px-3 py-2.5 text-xs font-bold dark:border-zinc-700">调整 AI 结果</button><button type="button" onClick={() => setGradingAction('manual')} className="flex items-center gap-2 rounded-2xl bg-emerald-700 px-3 py-2.5 text-xs font-bold text-white"><UserCheck className="h-4 w-4" />由我批改</button></div></div> : <div className="space-y-4"><div className="flex items-center justify-between"><div><h3 className="font-black">{gradingAction === 'manual' ? '教师亲自批改' : '调整 AI 结果'}</h3><p className="mt-1 text-xs text-slate-500">保存分数、理由、原图和当前评分依据版本。</p></div><button type="button" title="取消" aria-label="取消" onClick={() => setGradingAction('none')} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div><div className="grid gap-3 sm:grid-cols-[120px_1fr]"><label className="space-y-1"><span className="text-xs font-bold text-slate-500">最终分数</span><input type="number" min={0} max={selectedSample.fullScore} value={teacherScore} onChange={event => setTeacherScore(Number(event.target.value))} className={inputClass} /></label><label className="space-y-1"><span className="text-xs font-bold text-slate-500">评分理由与证据</span><input value={teacherReason} onChange={event => { setTeacherReason(event.target.value); setRuleAddedNotice(false); }} className={inputClass} placeholder="说明采用或调整分数的依据" /></label></div><div className="flex flex-wrap items-center justify-end gap-2">{ruleAddedNotice ? <span className="mr-auto flex items-center gap-1.5 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" />已加入本题评分细则，可继续确认调整</span> : null}{gradingAction === 'adjust' ? <button type="button" disabled={ruleAddedNotice} onClick={() => { updateQuestionState({ ...currentQuestionState, teacherRules: [...currentQuestionState.teacherRules, teacherReason || '从当前边界样本补充的评分规则'] }); setRuleAddedNotice(true); onShowToast('已加入本题评分细则'); }} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-xs font-bold disabled:border-emerald-200 disabled:bg-emerald-50 disabled:text-emerald-700 dark:border-zinc-700">{ruleAddedNotice ? '已加入评分细则' : '加入本题评分细则'}</button> : null}<button type="button" onClick={() => updateSample(gradingAction === 'manual' ? 'teacher-manual' : 'teacher-adjusted', teacherScore, teacherReason || '教师完成分项判断')} className="rounded-2xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white">{gradingAction === 'manual' ? '完成教师批改' : '确认调整'}</button></div></div>}
              </section>
              <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">{allCalibrationComplete ? '所有题目的试批样本均已完成。' : '批改方式将在所有题目的试批样本完成后统一选择。'}</p>{allCalibrationComplete ? <button type="button" onClick={() => setShowModeDialog(true)} className="rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white">选择本次批改方式</button> : null}</div>
            </div>
          </div>
        </section>
      ) : null}

      {activeStage === 'grading' ? (
        <section className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['已完成', `${gradedCount} / ${currentClass.studentCount}`], ['正常结果', Math.max(gradedCount - pendingReviews, 0)], ['异常隔离', pendingReviews], ['批改方式', modeOptions.find(option => option.id === gradingMode)?.label ?? '未选择']].map(([label, value]) => <div key={String(label)} className={`${panelClass} p-5`}><span className="text-xs font-bold text-slate-500">{label}</span><strong className="mt-2 block text-2xl text-slate-900 dark:text-white">{value}</strong></div>)}</div><div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]"><section className={`${panelClass} p-6`}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black">AI 正在继续处理正常答卷</h2><p className="mt-1 text-sm text-slate-500">单份异常已隔离，系统性 OCR 异常才会暂停整批。</p></div><button type="button" onClick={() => setIsPaused(value => !value)} className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold dark:border-zinc-700">{isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}{isPaused ? '继续' : '暂停'}</button></div><div className="mt-8 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.round((gradedCount / currentClass.studentCount) * 100)}%` }} /></div><div className="mt-5 flex justify-end"><button type="button" onClick={() => { setGradedCount(currentClass.studentCount); onShowToast('正常答卷已完成，异常项等待教师复核'); }} className="rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white">完成模拟批改</button></div></section><aside className={`${panelClass} p-5`}><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-black"><ShieldCheck className="h-4 w-4 text-rose-600" />异常复核</h2><span className="text-sm font-black text-rose-700">{pendingReviews} 项</span></div><p className="mt-2 text-xs leading-5 text-slate-500">当前任务的 OCR、评分分歧和抽检项目。</p><button type="button" onClick={() => setActiveStage('review')} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white">进入本任务异常复核<ArrowRight className="h-4 w-4" /></button></aside></div></section>
      ) : null}

      {activeStage === 'review' ? <ReviewQueuePage reviewQueue={reviewQueue} onConfirmReview={onConfirmReview} onBounceToOcr={onBounceToOcr} onMarkAsSample={onMarkAsSample} onShowToast={onShowToast} /> : null}

      {activeStage === 'diagnosis' ? (
        <section className="space-y-4"><div className="grid gap-4 lg:grid-cols-2"><div className={`${panelClass} p-5`}><div className="flex items-start justify-between"><div><h2 className="font-black">班级总体情况</h2><p className="mt-1 text-xs text-slate-500">只呈现支持教学决策的班级信息。</p></div><span className="rounded-xl bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">AI 诊断草稿</span></div><div className="mt-6 grid grid-cols-3 text-center"><div><strong className="text-2xl">78.6</strong><span className="mt-1 block text-xs text-slate-500">班级平均分</span></div><div><strong className="text-2xl">41%</strong><span className="mt-1 block text-xs text-slate-500">象征意义命中率</span></div><div><strong className="text-2xl">35%</strong><span className="mt-1 block text-xs text-slate-500">未结合文本</span></div></div></div><div className={`${panelClass} p-5`}><h2 className="font-black">班级共性问题</h2><div className="mt-4 space-y-3">{['第三个采分点是本次主要失分来源。', '观点正确但缺少文本证据，是最常见的边界情况。', '标题表层含义掌握较好，人物与主旨连接不足。'].map((text, index) => <div key={text} className="flex gap-3"><span className="flex h-6 w-6 flex-none items-center justify-center rounded-xl bg-amber-100 text-xs font-black text-amber-800">{index + 1}</span><p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{text}</p></div>)}</div></div></div><div className="grid gap-4 lg:grid-cols-2"><div className={`${panelClass} p-5`}><h2 className="font-black">典型答卷</h2><div className="mt-4 space-y-2">{[['林子涵', '典型优秀答案', '三层含义完整且结合文本'], ['陈梓睿', '典型共性错误', '停留在景物层面'], ['张雨轩', '典型边界答案', '同义表达是否算分']].map(item => <button key={item[0]} type="button" onClick={() => { const sample = currentQuestionState?.calibrationSamples.find(value => value.studentName === item[0]); if (sample) { selectSample(sample); setActiveStage('calibration'); } }} className="grid w-full grid-cols-[80px_110px_1fr] items-center rounded-2xl border border-slate-200 px-3 py-3 text-left text-xs hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-zinc-900"><strong>{item[0]}</strong><span className="font-bold text-emerald-700">{item[1]}</span><span className="text-slate-500">{item[2]}</span></button>)}</div></div><div className={`${panelClass} p-5`}><h2 className="font-black">重点个体</h2><p className="mt-1 text-xs text-slate-500">同时包括突出优秀和问题严重，只展示有明确证据的偏离。</p><div className="mt-4 space-y-3"><div className="flex gap-3 rounded-2xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-900"><Eye className="h-4 w-4 flex-none text-emerald-700" /><p><strong>林子涵：</strong>高难采分点表达完整，可作为讲评样本。</p></div><div className="flex gap-3 rounded-2xl bg-rose-50 p-3 text-xs leading-5 text-rose-900"><AlertTriangle className="h-4 w-4 flex-none text-rose-700" /><p><strong>陈梓睿：</strong>“主旨理解”已出现第 2 次同类证据，写入薄弱知识点证据记录。</p></div></div></div></div><div className={`${panelClass} flex flex-wrap items-center justify-between gap-4 p-5`}><div><h2 className="font-black">讲评摘要</h2><p className="mt-1 text-sm text-slate-500">优先讲清标题三层含义，并用边界答案讨论评分尺度。</p></div><div className="flex gap-2"><button type="button" onClick={() => onShowToast('已根据班级共性问题生成讲评教案草稿')} className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2.5 text-xs font-bold dark:border-zinc-700"><Layers3 className="h-4 w-4" />生成讲评教案</button><button type="button" disabled={diagnosisConfirmed} onClick={() => { setDiagnosisConfirmed(true); onSyncToProfiles(); onShowToast('本次结果已确认，证据已写入薄弱知识点记录'); }} className="rounded-2xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60">{diagnosisConfirmed ? '结果已确认' : '确认本次结果'}</button></div></div></section>
      ) : null}

      {showModeDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="选择本次批改方式">
          <div className="glass-panel w-full max-w-2xl rounded-[24px] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="text-lg font-black">所有题目试批已完成</h2><p className="mt-1 text-sm text-slate-500">现在决定本次任务需要教师介入的频率。</p></div><button type="button" title="关闭" aria-label="关闭" onClick={() => setShowModeDialog(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div><div className="mt-5 grid gap-3 md:grid-cols-3">{modeOptions.map(option => <button key={option.id} type="button" onClick={() => setGradingMode(option.id)} className={`rounded-2xl border p-4 text-left transition-all ${gradingMode === option.id ? 'border-emerald-700 bg-emerald-50 ring-2 ring-emerald-700/10' : 'border-slate-200 hover:border-emerald-300 dark:border-zinc-800'}`}><strong className="text-sm">{option.label}</strong><span className="mt-2 block text-xs leading-5 text-slate-500">{option.description}</span></button>)}</div><div className="mt-6 flex justify-end"><button type="button" onClick={lockAndStart} className="flex items-center gap-2 rounded-2xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800"><LockKeyhole className="h-4 w-4" />锁定评分依据并开始批改</button></div></div>
        </div>
      ) : null}
    </div>
  );
}
