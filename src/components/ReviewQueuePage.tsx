/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  CheckSquare, ShieldAlert, Sparkles, User, FileText, Check, 
  ArrowLeft, RefreshCw, Star, Share2, HelpCircle 
} from 'lucide-react';
import { ReviewItem } from '../types';

interface ReviewQueuePageProps {
  reviewQueue: ReviewItem[];
  onConfirmReview: (reviewId: string, finalScore: number, changeReason: string) => void;
  onBounceToOcr: (reviewId: string) => void;
  onMarkAsSample: (studentName: string) => void;
  onShowToast: (message: string) => void;
}

export default function ReviewQueuePage({
  reviewQueue,
  onConfirmReview,
  onBounceToOcr,
  onMarkAsSample,
  onShowToast
}: ReviewQueuePageProps) {
  const [activeTab, setActiveTab] = useState<'low-confidence' | 'large-gap' | 'conflict' | 'pending-confirm' | 'completed'>('low-confidence');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  
  // Local form state for editing score/reason in details panel
  const [editedScore, setEditedScore] = useState<number>(4);
  const [reasonInput, setReasonInput] = useState('');

  const tabs = [
    { id: 'low-confidence', label: '低置信度', count: reviewQueue.filter(r => r.type === 'low-confidence' && r.status === 'pending').length },
    { id: 'large-gap', label: '分差过大', count: reviewQueue.filter(r => r.type === 'large-gap' && r.status === 'pending').length },
    { id: 'conflict', label: 'AI 冲突', count: reviewQueue.filter(r => r.type === 'conflict' && r.status === 'pending').length },
    { id: 'pending-confirm', label: '待主批确认', count: reviewQueue.filter(r => r.type === 'pending-confirm' && r.status === 'pending').length },
    { id: 'completed', label: '已完成', count: reviewQueue.filter(r => r.status === 'completed').length }
  ];

  // Filter queue by active tab
  const items = reviewQueue.filter(r => {
    if (activeTab === 'completed') return r.status === 'completed';
    return r.type === activeTab && r.status === 'pending';
  });

  const selectedItem = reviewQueue.find(r => r.id === selectedItemId);

  const handleSelectItem = (item: ReviewItem) => {
    setSelectedItemId(item.id);
    setEditedScore(item.teacherFinalScore);
    setReasonInput('');
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'high': return <span className="px-1.5 py-0.5 bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-400 rounded text-[10px] font-bold">高优先级</span>;
      case 'medium': return <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400 rounded text-[10px] font-semibold">中优先级</span>;
      default: return <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-medium">低优先级</span>;
    }
  };

  const handleConfirmSubmit = () => {
    if (!selectedItemId) return;
    onConfirmReview(selectedItemId, editedScore, reasonInput || '教师核准修改。');
    onShowToast(`🎉 已成功复核并裁决 [${selectedItem?.studentName}] 的分数，最终得分定为 ${editedScore} 分！`);
    setSelectedItemId(null);
  };

  const handleBounceSubmit = () => {
    if (!selectedItemId) return;
    onBounceToOcr(selectedItemId);
    onShowToast(`↩️ 学生 [${selectedItem?.studentName}] 的答卷已退回到第 5 步识别校对队列。`);
    setSelectedItemId(null);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full animate-fade-in" id="review-queue-page">
      
      {/* Left: Interactive list pane */}
      <div className="flex-1 flex flex-col space-y-4 min-w-0">
        
        {/* Tab filters */}
        <div className="glass-panel rounded-2xl p-2 flex flex-wrap gap-1.5 bg-slate-100/60">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setSelectedItemId(null);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-white text-slate-800 dark:bg-zinc-800 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="px-1.5 py-0.2 text-[9px] bg-red-500 text-white rounded-full font-bold">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* List content */}
        <div className="space-y-3">
          {items.map(item => {
            const isSelected = selectedItemId === item.id;
            return (
              <div
                key={item.id}
                id={`review-item-${item.id}`}
                onClick={() => handleSelectItem(item)}
                className={`glass-panel glass-panel-hover rounded-2xl p-4 flex items-center justify-between gap-4 cursor-pointer border-l-4 ${
                  isSelected 
                    ? 'bg-emerald-600/5 dark:bg-emerald-500/5 border-emerald-500 shadow' 
                    : 'border-l-slate-300 dark:border-l-zinc-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-100 dark:bg-zinc-800/60 rounded-xl mt-0.5">
                    <User className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{item.studentName}</h4>
                      <span className="text-xs text-slate-400">{item.className}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium truncate max-w-sm sm:max-w-md mt-0.5">
                      学生手写答卷：{item.studentAnswer}
                    </p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">
                      拦截原因：<span className="text-red-700 dark:text-red-400">{item.differenceReason}</span>
                    </p>
                  </div>
                </div>

                <div className="text-right space-y-1.5 flex flex-col items-end">
                  {getPriorityBadge(item.priority)}
                  <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-300">
                    建议给分：{item.aiSuggestedScore}分
                  </span>
                </div>
              </div>
            );
          })}

          {items.length === 0 && (
            <div className="glass-panel rounded-3xl p-12 text-center text-slate-400">
              <CheckSquare className="w-12 h-12 stroke-1 text-slate-300 mx-auto mb-2" />
              <p className="text-sm">恭喜！本分组队列下暂无积压的待复核试卷。</p>
            </div>
          )}
        </div>

      </div>

      {/* Right: Double comparison details pane */}
      <div className={`w-full lg:w-[440px] flex-shrink-0 flex flex-col ${selectedItem ? '' : 'hidden lg:flex'}`}>
        <div className="flex-1 glass-panel rounded-3xl p-5 flex flex-col justify-between overflow-y-auto space-y-4 max-h-[85vh]">
          {selectedItem ? (
            <div className="space-y-4 animate-fade-in" id="review-details-drawer">
              
              {/* Header profile */}
              <div className="flex justify-between items-start border-b pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    核准：{selectedItem.studentName} 
                  </h3>
                  <p className="text-xs text-slate-400">{selectedItem.taskName} · {selectedItem.className}</p>
                </div>
                {getPriorityBadge(selectedItem.priority)}
              </div>

              {/* Comparison boxes */}
              <div className="space-y-3 text-xs">
                
                {/* Student Answer */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">学生手写原始文本 (OCR 抓取)</span>
                  <div className="p-3 bg-slate-50 dark:bg-zinc-800/80 rounded-xl border font-serif text-slate-800 dark:text-slate-200 leading-relaxed">
                    “{selectedItem.studentAnswer}”
                    {/* Highlighted Evidence marker */}
                    <div className="mt-2 text-[10px] bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      自动抓取的采分点证据：{selectedItem.evidenceText}
                    </div>
                  </div>
                </div>

                {/* Standard Answer & rubrics */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">参考标准答案要点</span>
                  <pre className="p-3 bg-slate-50 dark:bg-zinc-800/40 rounded-xl border font-mono text-[10px] text-slate-500 leading-relaxed whitespace-pre-line">
                    {selectedItem.standardAnswer}
                  </pre>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">判定采分细则</span>
                  <p className="p-2.5 bg-slate-100/50 dark:bg-zinc-800/20 text-[10px] text-slate-400 leading-relaxed rounded-xl">
                    {selectedItem.rubric}
                  </p>
                </div>

              </div>

              {/* Teacher grading tool box */}
              <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 space-y-4">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider block">人工教师仲裁给分控制</span>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold block">AI 推荐给分</span>
                    <p className="text-xl font-black text-slate-500">{selectedItem.aiSuggestedScore} <span className="text-xs font-normal">分</span></p>
                  </div>
                  <div className="space-y-1 text-right">
                    <span className="text-[10px] text-emerald-800 dark:text-emerald-400 font-bold block">教师最终裁定分</span>
                    <input
                      type="number"
                      max={6}
                      min={0}
                      value={editedScore}
                      onChange={(e) => setEditedScore(parseInt(e.target.value) || 0)}
                      className="w-16 text-center text-lg font-bold py-1 bg-white border border-emerald-500 rounded-lg text-emerald-800 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-400 font-bold block">修改/给分原因补充 (选填)</span>
                  <input
                    type="text"
                    placeholder="如：学生提及了雷锋精神象征，采分点完整匹配，额外给予及格上分数。"
                    value={reasonInput}
                    onChange={(e) => setReasonInput(e.target.value)}
                    className="w-full p-2 bg-white dark:bg-zinc-800 text-xs border border-slate-200 dark:border-zinc-700 rounded-lg focus:outline-none"
                  />
                </div>
              </div>

              {/* Multi-action footer */}
              <div className="space-y-2 pt-3 border-t">
                <button
                  onClick={handleConfirmSubmit}
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  确认当前分数，同步画像
                </button>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleBounceSubmit}
                    className="py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-xl flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    退回重新校对
                  </button>
                  <button
                    onClick={() => {
                      onMarkAsSample(selectedItem.studentName);
                      onShowToast(`🌟 学生 [${selectedItem.studentName}] 的高分试卷已被标记为“优秀讲评样例”，自动加入备课范文库！`);
                    }}
                    className="py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-xl flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Star className="w-3.5 h-3.5 text-amber-500" />
                    标记优秀范文
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 space-y-2 h-full">
              <CheckSquare className="w-12 h-12 stroke-1 text-slate-300" />
              <p className="text-sm">未选择复核件</p>
              <p className="text-xs">点击左侧列表中的任意学生拦截卡片，在此处显示手写体切片图像、模型采分高亮匹配、多模型偏差对照，并直接手动仲裁。</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
