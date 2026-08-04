/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, ChevronRight, Check, Upload, FileText, Image, CheckCircle, 
  RefreshCw, Sliders, AlertTriangle, Play, BookOpen, BarChart2, Share2, Plus, Trash2, ShieldAlert
} from 'lucide-react';
import { WorkflowState, SchoolClass, WorkbenchTask } from '../../domain/types';

interface GradingWorkflowProps {
  workflowState: WorkflowState;
  classes: SchoolClass[];
  tasks: WorkbenchTask[];
  onSelectTask: (task: WorkbenchTask) => void;
  onUpdateState: (newState: Partial<WorkflowState>) => void;
  onSyncToProfiles: () => void;
  onShowToast: (message: string) => void;
  lowConfidenceThreshold: number;
}

export default function GradingWorkflow({
  workflowState,
  classes,
  tasks,
  onSelectTask,
  onUpdateState,
  onSyncToProfiles,
  onShowToast,
  lowConfidenceThreshold
}: GradingWorkflowProps) {
  const [currentStep, setCurrentStep] = useState(6); // Default on Step 6 (AI Grading)
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(100);
  const [ocrCorrectedTexts, setOcrCorrectedTexts] = useState<string[]>(
    workflowState.ocrResults.map(r => r.ocrText)
  );
  
  const steps = [
    { num: 1, label: '设置任务', desc: '基本属性' },
    { num: 2, label: '设置题目', desc: '题组结构' },
    { num: 3, label: '标准答案', desc: '评分细则' },
    { num: 4, label: '上传作业', desc: '图片采集' },
    { num: 5, label: '识别校对', desc: 'OCR核准' },
    { num: 6, label: 'AI 评分', desc: '大模型打分' },
    { num: 7, label: '置信度复核', desc: '低置信拦截' },
    { num: 8, label: '人工复核', desc: '教师仲裁' },
    { num: 9, label: '作业诊断', desc: '学情透视' },
    { num: 10, label: '同步画像', desc: '档案写入' }
  ];

  const currentClass = classes.find(c => c.id === workflowState.classId) || classes[0];

  const handleStartSimulatedUpload = () => {
    setIsUploading(true);
    setUploadProgress(0);
    onUpdateState({ isUploading: true, uploadProgress: 0, uploadedCount: 0 });
    
    let current = 0;
    const interval = setInterval(() => {
      current += 10;
      setUploadProgress(current);
      if (current >= 100) {
        clearInterval(interval);
        setIsUploading(false);
        onUpdateState({ isUploading: false, uploadProgress: 100, uploadedCount: 42 });
        onShowToast('作业扫描件批量上传并OCR识别完成：成功上传 42 份学生手写答卷图片！');
        setCurrentStep(5); // Jump to step 5 (OCR verify)
      }
    }, 150);
  };

  const handleSaveOcrCorrection = (idx: number, newText: string) => {
    const updated = [...ocrCorrectedTexts];
    updated[idx] = newText;
    setOcrCorrectedTexts(updated);
    onShowToast(`成功手动修正学生 [${workflowState.ocrResults[idx].studentName}] 的手写答题文本识别！`);
  };

  const handleNextStep = () => {
    if (currentStep < 10) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const getStepStatusClass = (stepNum: number) => {
    if (stepNum === currentStep) {
      return 'bg-emerald-700 text-white dark:bg-emerald-600 ring-4 ring-emerald-500/20';
    }
    if (stepNum < currentStep) {
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-500/30';
    }
    return 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-slate-600 border border-slate-200/50 dark:border-zinc-800';
  };

  return (
    <div className="space-y-6 animate-fade-in" id="grading-workflow-page">
      <div className="glass-panel rounded-3xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">AI 批改 / 作业工作流</p>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-50">{workflowState.taskName}</h2>
          <p className="text-xs text-slate-500 mt-1">{currentClass?.name} · 截止 {workflowState.deadline}</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-500">
          切换任务
          <select
            value={tasks.find(t => t.name === workflowState.taskName)?.id || ''}
            onChange={(e) => {
              const task = tasks.find(t => t.id === e.target.value);
              if (task) onSelectTask(task);
            }}
            className="min-w-64 px-3 py-2 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="">当前模拟任务</option>
            {tasks.map(task => <option key={task.id} value={task.id}>{task.name}</option>)}
          </select>
        </label>
      </div>
      
      {/* 10-step horizontal wizard stepper, beautiful and fully interactive */}
      <div className="glass-panel rounded-3xl p-5 overflow-x-auto">
        <div className="flex items-center justify-between min-w-[1000px] px-2">
          {steps.map((step, idx) => (
            <React.Fragment key={step.num}>
              <div 
                id={`step-node-${step.num}`}
                onClick={() => setCurrentStep(step.num)}
                className="flex items-center gap-2.5 cursor-pointer group flex-1"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${getStepStatusClass(step.num)}`}>
                  {step.num < currentStep ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    step.num
                  )}
                </div>
                <div>
                  <h4 className={`text-xs font-bold whitespace-nowrap ${
                    step.num === currentStep ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500'
                  }`}>
                    {step.label}
                  </h4>
                  <p className="text-[10px] text-slate-400 whitespace-nowrap">{step.desc}</p>
                </div>
              </div>
              {idx < steps.length - 1 && (
                <ChevronRight className="w-4 h-4 text-slate-200 dark:text-zinc-800 flex-shrink-0 mx-2" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Steps Workspace Card */}
      <div className="glass-panel rounded-3xl p-6 min-h-[460px] flex flex-col justify-between">
        
        {/* Render Step detail conditional */}
        <div className="flex-1 pb-6">
          
          {/* STEP 1: Setup Task */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div className="border-b pb-3 mb-4">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">第 1 步：设置作业任务基本信息</h3>
                <p className="text-xs text-slate-400">设定需要进行 AI 智能批改的作业属性，以便系统精准加载相适配的教学大纲。</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 block uppercase">作业任务名称</label>
                  <input
                    type="text"
                    value={workflowState.taskName}
                    onChange={(e) => onUpdateState({ taskName: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 block">所属授课班级</label>
                  <select
                    value={workflowState.classId}
                    onChange={(e) => onUpdateState({ classId: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border cursor-pointer"
                  >
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 block">截止时间</label>
                  <input
                    type="text"
                    value={workflowState.deadline}
                    onChange={(e) => onUpdateState({ deadline: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 block">关联教材课文</label>
                  <input
                    type="text"
                    value={workflowState.relatedText}
                    onChange={(e) => onUpdateState({ relatedText: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 border"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Setup Questions */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="border-b pb-3 mb-4 flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">第 2 步：设置题目结构</h3>
                  <p className="text-xs text-slate-400">配置本份作业的所有题目，关联对应知识图谱的能力点与分数权重。</p>
                </div>
                <button
                  onClick={() => {
                    const updated = [...workflowState.questions, {
                      id: 'q' + (workflowState.questions.length + 1),
                      title: '新添加能力题',
                      score: 10,
                      knowledgePoint: '文言文虚词',
                      desc: '自定义新建题目'
                    }];
                    onUpdateState({ questions: updated });
                  }}
                  className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  手动添加题目
                </button>
              </div>

              <div className="space-y-3 max-w-4xl">
                {workflowState.questions.map((q, idx) => (
                  <div key={q.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 border flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 bg-slate-200 dark:bg-zinc-850 text-slate-700 dark:text-slate-300 rounded-lg flex items-center justify-center font-bold text-xs">{idx + 1}</span>
                      <div>
                        <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-sm">{q.title}</h4>
                        <p className="text-[10px] text-slate-400">
                          关联知识点：<span className="text-emerald-700 dark:text-emerald-400 font-semibold">{q.knowledgePoint}</span> · 题干简述：{q.desc}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-400 block uppercase">题目满分</span>
                        <input
                          type="number"
                          value={q.score}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            const copy = [...workflowState.questions];
                            copy[idx].score = val;
                            onUpdateState({ questions: copy });
                          }}
                          className="w-16 text-center text-xs font-semibold py-1 bg-white border rounded"
                        />
                      </div>
                      <button
                        onClick={() => {
                          const updated = workflowState.questions.filter((_, i) => i !== idx);
                          onUpdateState({ questions: updated });
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: Rubrics */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div className="border-b pb-3 mb-4">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">第 3 步：上传标准答案与评分细则</h3>
                <p className="text-xs text-slate-400">上传官方提供的标准答案。AI 自动提取出结构化采分点细则并建立智能判定逻辑。</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">大文本标准答案（支持图片/文档解析）</span>
                  <textarea
                    value={workflowState.standardAnswer}
                    onChange={(e) => onUpdateState({ standardAnswer: e.target.value })}
                    className="w-full h-56 p-3 text-xs font-mono bg-slate-50 dark:bg-zinc-800/80 rounded-2xl border"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">采分点评分点细则拆解 (AI 辅助生成)</span>
                    <button
                      onClick={() => onShowToast('正在利用 AI 大模型重新深度对齐采分点...对齐成功！')}
                      className="text-xs text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      重新对齐评分点
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {workflowState.gradingRubric.map((rubric, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 dark:bg-zinc-800/20 border rounded-xl space-y-1 text-xs">
                        <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
                          <span>{rubric.point}</span>
                          <span className="text-emerald-700 dark:text-emerald-400">权重：{rubric.score}分</span>
                        </div>
                        <p className="text-[11px] text-slate-400">{rubric.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Upload student papers */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-fade-in text-center py-6">
              <div className="max-w-md mx-auto space-y-4">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow">
                  <Upload className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">第 4 步：批量采集学生手写答题卡</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    支持高拍仪多页扫描、手机拍照打包 ZIP 上传。系统将对图像自动进行纠偏、降噪、红墨水印过滤和学生姓名考号切割。
                  </p>
                </div>

                {isUploading ? (
                  <div className="space-y-2 p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl">
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 animate-pulse">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        批量上传与智能切片识别中...
                      </span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-zinc-900 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                    <p className="text-[10px] text-slate-400">正在传输：林子涵、张雨轩、陈梓睿等42人答题切片...</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <button
                      id="sim-upload-btn"
                      onClick={handleStartSimulatedUpload}
                      className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-700/10 cursor-pointer"
                    >
                      <Image className="w-4 h-4" />
                      模拟扫描仪批量高速上传 (42张图片)
                    </button>
                    <span className="text-[10px] text-slate-400 block">系统已配置过滤黑边和手写笔迹自增强。</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 5: OCR Verify side-by-side */}
          {currentStep === 5 && (
            <div className="space-y-4 animate-fade-in">
              <div className="border-b pb-3 mb-4">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">第 5 步：OCR 字符识别校验</h3>
                <p className="text-xs text-slate-400">将学生手写笔迹提取为结构化文本。对于识别置信度偏低或混淆的局部词汇，教师可直接点击修正。</p>
              </div>

              <div className="space-y-5">
                {workflowState.ocrResults.map((r, idx) => (
                  <div key={idx} className="grid grid-cols-1 lg:grid-cols-3 gap-4 border border-slate-100 dark:border-zinc-800 rounded-2xl p-4 bg-slate-50/50 dark:bg-zinc-900/40">
                    {/* Left: Handwritten cut image mock */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">手写笔迹切片 ({r.studentName})</span>
                      <div className="h-28 bg-white dark:bg-zinc-800 rounded-xl border border-dashed flex flex-col items-center justify-center p-3 relative overflow-hidden select-none">
                        <span className="text-xs text-slate-400 font-serif italic line-clamp-3">
                          {idx === 0 ? '“驿路梨花既是指大山里开的梨花，也指照顾驿站的哈尼姑娘。象征雷锋精神。”' : 
                           idx === 1 ? '“就是梨花开在路边很好看，指那个叫梨花的小姑娘，她们都很好。雷锋在整条路上传递着。”' :
                           '“路边开满梨花，象征好人好事。”'}
                        </span>
                        <div className="absolute right-1 bottom-1 px-1.5 py-0.5 bg-black/60 text-[9px] text-white rounded font-mono">
                          Image Cut_0{idx + 1}.png
                        </div>
                      </div>
                    </div>

                    {/* Center: OCR Text Output editable */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">OCR 识别出的文本 (双击/文本框直接编辑纠正)</span>
                      <textarea
                        value={ocrCorrectedTexts[idx] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const copy = [...ocrCorrectedTexts];
                          copy[idx] = val;
                          setOcrCorrectedTexts(copy);
                        }}
                        className="w-full h-28 text-xs p-2.5 bg-white dark:bg-zinc-800 border rounded-xl font-mono focus:outline-none"
                      />
                    </div>

                    {/* Right: Confidence analysis */}
                    <div className="flex flex-col justify-between p-1">
                      <div className="space-y-1 text-xs">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">字迹置信度度量</span>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            r.matchScore >= 90 ? 'bg-emerald-100 text-emerald-800' :
                            r.matchScore >= 80 ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            置信度：{(r.matchScore / 100).toFixed(2)}
                          </span>
                          {r.matchScore < 80 && (
                            <span className="text-[10px] text-amber-600 flex items-center gap-0.5 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              建议人工确认
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">自动识别：匹配题干 第 3 题 (100% 对齐系数)</p>
                      </div>

                      <button
                        onClick={() => handleSaveOcrCorrection(idx, ocrCorrectedTexts[idx])}
                        className="mt-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold rounded-lg self-end px-4 cursor-pointer"
                      >
                        确认此卡无误
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 6: AI Grading */}
          {currentStep === 6 && (
            <div className="space-y-4 animate-fade-in">
              <div className="border-b pb-3 mb-4 flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <Sparkles className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                    第 6 步：AI 大模型自动综合评分结果
                  </h3>
                  <p className="text-xs text-slate-400">大模型根据标准答案、采分点细则及多模型交叉验证得出的第一批评分情况。</p>
                </div>
                <button
                  onClick={() => onShowToast('正在调用后台 Gemini 1.5 Pro 进行深度校验批改...校验无误！')}
                  className="px-3 py-1.5 bg-white border rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  重新一键智能批改
                </button>
              </div>

              <div className="space-y-4">
                {workflowState.aiResults.map((res, idx) => (
                  <div key={idx} className="p-4 border border-slate-100 dark:border-zinc-800 rounded-2xl bg-slate-50/50 dark:bg-zinc-900/40 text-xs">
                    <div className="flex justify-between items-start gap-3 flex-wrap">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">{res.studentName}</h4>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px]">考号切片匹配良好</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {res.hitPoints.map((h, i) => (
                            <span key={i} className="px-2 py-0.5 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400 rounded-full text-[10px] font-medium">
                              ✓ 命中：{h}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">AI 建议得分</span>
                        <p className="text-xl font-black text-emerald-800 dark:text-emerald-400">{res.score} <span className="text-xs text-slate-400 font-medium">/ 100</span></p>
                      </div>
                    </div>

                    {/* Deductions and details */}
                    {res.deductions.length > 0 ? (
                      <div className="mt-3 p-3 bg-red-500/5 rounded-xl border border-red-500/10 space-y-1 text-xs">
                        <span className="font-bold text-red-800 dark:text-red-400 block">扣分项详情：</span>
                        {res.deductions.map((d, i) => (
                          <p key={i} className="text-slate-600 dark:text-slate-300">
                            <b>{d.point} (扣{d.score}分):</b> {d.reason}
                          </p>
                        ))}
                        <p className="text-[10px] text-slate-400 pt-1">匹配错误归因：<span className="font-bold text-red-600 dark:text-red-400">{res.errorType}</span></p>
                      </div>
                    ) : (
                      <div className="mt-3 p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-400 font-semibold">
                        本张答卷采分点完整匹配，无扣分，满分过审。
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 7: Confidence Threshold */}
          {currentStep === 7 && (
            <div className="space-y-4 animate-fade-in">
              <div className="border-b pb-3 mb-4">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">第 7 步：AI 置信度拦截设置</h3>
                <p className="text-xs text-slate-400">设定大模型自动提取笔迹与采分判定时的敏感度阈值。凡是低于此置信度的试卷将被自动拦截并送入复核队列。</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start max-w-4xl">
                <div className="space-y-4 p-5 bg-slate-50 dark:bg-zinc-800/40 border rounded-2xl">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">置信度敏感度阈值设置</span>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm font-bold">
                      <span>拦截判定置信度：</span>
                      <span className="text-emerald-700 dark:text-emerald-400 font-mono">{lowConfidenceThreshold}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">松散 (0.5)</span>
                      <input
                        type="range"
                        min="0.5"
                        max="0.95"
                        step="0.05"
                        value={lowConfidenceThreshold}
                        disabled // Controlled by Settings as requested
                        className="flex-1 accent-emerald-700"
                      />
                      <span className="text-xs text-slate-400">严格 (0.95)</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block pt-1">※ 如需修改此敏感度数值，请前往左侧侧边栏的 <b>[设置]</b> 统一变更。</span>
                  </div>

                  <div className="p-3 bg-amber-500/5 rounded-xl text-[11px] text-slate-500 space-y-1">
                    <span className="font-semibold block text-amber-800">当前拦截预测评估：</span>
                    <p>在 0.75 严格阀值下，42 份学生卷中会有约 4 份被送入复核队列。能够安全放行 90% 的优秀且清晰答卷。</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">受该拦截器影响，进入复核的学生：</span>
                  <div className="space-y-2">
                    {workflowState.aiResults.filter(r => r.confidence < lowConfidenceThreshold).map((res, i) => (
                      <div key={i} className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/10 flex justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{res.studentName}</span>
                          <p className="text-[10px] text-slate-400">大模型判定置信系数：{res.confidence}</p>
                        </div>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold text-[10px]">待人工复核</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 8: Human Review trigger */}
          {currentStep === 8 && (
            <div className="space-y-4 animate-fade-in text-center py-6">
              <div className="max-w-md mx-auto space-y-4">
                <div className="w-16 h-16 bg-indigo-100 text-indigo-800 rounded-full flex items-center justify-center mx-auto shadow">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">第 8 步：人工教师复核确认</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    有部分大分值阅读题目存在置信度过低、多模型给分偏差过大（超过 1 分阈值）等情况，已安全暂扣。
                  </p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl text-xs space-y-2 text-left">
                  <div className="flex justify-between">
                    <span>置信度偏低答卷：</span>
                    <span className="font-bold text-amber-700">2 份</span>
                  </div>
                  <div className="flex justify-between">
                    <span>模型给分偏差过大卷：</span>
                    <span className="font-bold text-red-700">1 份</span>
                  </div>
                  <div className="flex justify-between">
                    <span>高分卷抽样质检：</span>
                    <span className="font-bold text-blue-700">1 份</span>
                  </div>
                </div>
                <button
                  onClick={() => setCurrentStep(7)} // Dummy nav or trigger settings
                  className="px-4 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer w-full"
                >
                  去复核队列处理这些拦截试卷
                </button>
              </div>
            </div>
          )}

          {/* STEP 9: Generate Diagnostic report */}
          {currentStep === 9 && (
            <div className="space-y-4 animate-fade-in">
              <div className="border-b pb-3 mb-4">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">第 9 步：生成班级学情诊断与讲评建议</h3>
                <p className="text-xs text-slate-400">大模型根据全班 42 份真实评分数据，一键产出的班级共性错因、薄弱排行以及定制化讲评大纲建议。</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 共性问题 */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 space-y-2 text-xs">
                    <span className="font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1">
                      <BookOpen className="w-4 h-4" />
                      大模型推荐讲评方案
                    </span>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                      针对本次《驿路梨花》阅读测试，全班在 <b>[标题作用与象征含义]</b> 知识点失分严重（共性失分率 42.8%）。
                      讲评时建议重点拆解自然界的梨花、小姑娘梨花以及雷锋精神的<b>三重双关关系</b>。
                      推荐将 <b>林子涵</b> 答案作为优秀答卷进行范文投屏；调取 <b>陈梓睿</b> 的漏答切片进行隐名审题纠偏。
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border space-y-2 text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">班级高频错因汇总</span>
                    <ul className="space-y-1.5 list-disc pl-4 text-slate-600 dark:text-slate-400">
                      <li><b>审题不清导致漏答：</b> 28% 的学生未提及自然界景物写景背景。</li>
                      <li><b>雷锋象征概念生搬硬套：</b> 15% 的同学仅口号式写下“体现了雷锋精神”，缺少文学细节。</li>
                      <li><b>字词默写粗心笔误：</b> 听写部分如“修葺”的“葺”字，12位同学在草字头下写成别字。</li>
                    </ul>
                  </div>
                </div>

                {/* Score stats chart mock */}
                <div className="p-5 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border space-y-4 text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">成绩分布统计</span>
                  <div className="space-y-2.5">
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>优秀 (90分以上)</span>
                        <span>14人 (33%)</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 dark:bg-zinc-900 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: '33%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>良好 (80-89分)</span>
                        <span>20人 (48%)</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 dark:bg-zinc-900 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: '48%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>待提高 (80分以下)</span>
                        <span>8人 (19%)</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 dark:bg-zinc-900 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: '19%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* STEP 10: Sync Profiles */}
          {currentStep === 10 && (
            <div className="space-y-4 animate-fade-in text-center py-6">
              <div className="max-w-md mx-auto space-y-4">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">第 10 步：同步数据至班级与学生画像</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    审核无误。点击下方同步按钮，将“某学生在某次作业某题某知识点错误”等精细化教学证据实时写入每一位学生的电子画像和班级数据库。
                  </p>
                </div>
                <button
                  id="sync-profiles-btn"
                  onClick={() => {
                    onSyncToProfiles();
                    onShowToast('🎉 成功将本次《驿路梨花》测验的所有知识点缺陷、笔误与课堂建议同步写入42位同学的学生电子画像！');
                  }}
                  className="px-5 py-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-emerald-700/10 cursor-pointer w-full"
                >
                  <Share2 className="w-4 h-4" />
                  确认同步到班级与学生电子画像
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Stepper bottom navigation footer */}
        <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-zinc-800/80">
          <button
            onClick={handlePrevStep}
            disabled={currentStep === 1}
            className={`px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-all ${
              currentStep === 1 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            上一步
          </button>
          
          <span className="text-xs text-slate-400">步骤进度: {currentStep} / 10</span>

          <button
            onClick={handleNextStep}
            disabled={currentStep === 10}
            className={`px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg transition-all ${
              currentStep === 10 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            下一步
          </button>
        </div>

      </div>

    </div>
  );
}

