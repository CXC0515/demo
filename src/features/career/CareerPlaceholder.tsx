/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BriefcaseBusiness, CalendarClock, FileText, Plus } from 'lucide-react';

interface CareerPlaceholderProps {
  title: string;
  description: string;
  onShowToast: (message: string) => void;
}

export default function CareerPlaceholder({
  title,
  description,
  onShowToast
}: CareerPlaceholderProps) {
  return (
    <div className="space-y-5 animate-fade-in" id="career-placeholder-page">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">个人职业</p>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">{title}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>
        </div>
        <button
          onClick={() => onShowToast(`${title} 目前作为职业发展模块占位，后续再展开工作流`)}
          className="px-4 py-2.5 rounded-2xl bg-emerald-700 text-white text-sm font-bold flex items-center gap-1.5 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          新建材料
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {[
          ['材料池', '沉淀教案、课例、反思、证明材料。', FileText],
          ['时间线', '记录申报、比赛、公开展示等节点。', CalendarClock],
          ['成果档案', '后续汇总为职业成长档案。', BriefcaseBusiness]
        ].map(([name, text, Icon]) => {
          const IconComponent = Icon as React.ElementType;
          return (
            <div key={name as string} className="glass-panel rounded-[24px] p-5 min-h-44">
              <IconComponent className="w-6 h-6 text-emerald-700 dark:text-emerald-300 mb-4" />
              <h3 className="text-base font-black text-slate-900 dark:text-slate-50">{name as string}</h3>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">{text as string}</p>
              <span className="inline-flex mt-5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-[11px] font-bold text-slate-500">
                占位待实现
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

