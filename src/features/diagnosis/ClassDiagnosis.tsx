/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  BarChart2, ShieldAlert, Award, FileText, Download, Sparkles, 
  ChevronRight, TrendingDown, BookOpen, Clock, RefreshCw 
} from 'lucide-react';
import { Student, SchoolClass } from '../../domain/types';

interface ClassDiagnosisProps {
  students: Student[];
  classes: SchoolClass[];
  selectedClassId: string;
  onSelectClass: (classId: string) => void;
  onNavigate: (pageId: string, subPageId?: string) => void;
  onShowToast: (message: string) => void;
}

export default function ClassDiagnosis({
  students,
  classes,
  selectedClassId,
  onSelectClass,
  onNavigate,
  onShowToast
}: ClassDiagnosisProps) {
  // Filter students for active class
  const classStudents = students.filter(s => s.classId === selectedClassId);
  const activeClass = classes.find(c => c.id === selectedClassId) || classes[0];

  // Derive simple class averages
  const averageScore = Math.round(
    classStudents.reduce((acc, curr) => {
      const lastScore = curr.recentHomeworkTrend[curr.recentHomeworkTrend.length - 1] || 85;
      return acc + lastScore;
    }, 0) / (classStudents.length || 1)
  );

  // Group status counts
  const riskCount = classStudents.filter(s => s.status === 'risk').length;
  const warningCount = classStudents.filter(s => s.status === 'warning').length;
  const outstandingCount = classStudents.filter(s => s.status === 'outstanding').length;

  // Weakest knowledge point stats (Morandi charts mock)
  const weakPointsRank = [
    { name: '标题作用题 (双关与多重含义)', failRate: 42, iconColor: 'bg-red-500' },
    { name: '修辞手法鉴赏 (象征与比喻拟人结合)', failRate: 28, iconColor: 'bg-amber-500' },
    { name: '文言文虚词辨析 (“之”、“而”等用法)', failRate: 25, iconColor: 'bg-amber-500' },
    { name: '说明文结构分析 (逻辑顺序划分)', failRate: 15, iconColor: 'bg-slate-400' }
  ];

  return (
    <div className="space-y-6 animate-fade-in" id="class-diagnosis-page">
      
      {/* Top statistics overview bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Class name / selector */}
        <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">诊断班级</span>
          <div className="mt-2">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{activeClass.name}</h3>
            <p className="text-xs text-slate-400">人数：{classStudents.length}人 · {activeClass.textbookVersion}</p>
          </div>
          <div className="mt-3">
            <select
              value={selectedClassId}
              onChange={(e) => onSelectClass(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-800 border rounded-xl text-xs font-semibold cursor-pointer focus:outline-none"
            >
              {classes.filter(c => c.status === 'active').map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Avg score block */}
        <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">班级最近作业均分</span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-slate-800 dark:text-slate-100 font-mono">{averageScore}</span>
            <span className="text-xs text-slate-400 font-semibold">/ 100分</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            整体表现：<span className="text-emerald-700 dark:text-emerald-400 font-bold">良好稳定</span> (较上周 +1.2分)
          </p>
        </div>

        {/* Risk warning students block */}
        <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between border-l-4 border-l-red-500">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">异常学情预警</span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-red-600 dark:text-red-400 font-mono">{riskCount}</span>
            <span className="text-xs text-slate-400 font-medium">人处于高危预警</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            另有 <span className="font-bold text-amber-600">{warningCount}</span> 人处于边缘起伏状态。
          </p>
        </div>

        {/* Action triggers */}
        <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between bg-gradient-to-br from-emerald-500/5 to-teal-500/10">
          <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider block">诊断控制台</span>
          <div className="space-y-1.5 mt-3">
            <button
              onClick={() => {
                onShowToast('📄 正在导出班级诊断报告 PDF 存档件并保存到教务盘...导出成功！');
              }}
              className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              导出诊断报告
            </button>
            <button
              onClick={() => {
                onShowToast('✏️ 已为您一键定制生成《标题作用题专项提分补弱训练卷》（含林子涵高分讲解范文、陈梓睿提纲式引导卷），请前往资料库查看！');
              }}
              className="w-full py-2 bg-white/80 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 border text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              定制个性化巩固练习
            </button>
          </div>
        </div>

      </div>

      {/* Main grids: Weakest Knowledge Rank VS Warning Students List */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left: Weakest Knowledge points list */}
        <div className="xl:col-span-2 glass-panel rounded-3xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-emerald-600 rounded-full"></span>
              失分率最高的知识点排行（教学薄弱点）
            </h3>
            <span className="text-xs text-slate-400">基于最新 3 次阅读与字词测验</span>
          </div>

          <div className="space-y-5">
            {weakPointsRank.map((wp, idx) => (
              <div key={idx} className="space-y-1 text-xs">
                <div className="flex justify-between font-medium">
                  <span className="text-slate-700 dark:text-slate-200">{idx + 1}. {wp.name}</span>
                  <span className="font-bold text-red-600 dark:text-red-400">平均失分率：{wp.failRate}%</span>
                </div>
                <div className="w-full h-3 bg-slate-100 dark:bg-zinc-900 rounded-full overflow-hidden flex">
                  <div 
                    className={`h-full ${wp.iconColor} rounded-full transition-all duration-500`}
                    style={{ width: `${wp.failRate}%` }}
                  ></div>
                </div>
                <p className="text-[10px] text-slate-400 pt-0.5">
                  失分共性错因：{idx === 0 ? '漏答象征哈尼姑娘梨花的一层；多属于审题盲区' : 
                                   idx === 1 ? '鉴赏修辞时未能深入契合哀牢山大自然温馨环境，泛泛谈论象征雷锋精神' :
                                   '“其”字在指代主语及表推测语气时的用法辨析多有混淆'}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Students with warning state */}
        <div className="glass-panel rounded-3xl p-6 space-y-4">
          <div className="border-b pb-3 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <ShieldAlert className="w-4.5 h-4.5 text-red-600 dark:text-red-400" />
              高危预警与起伏学生 
            </h3>
            <span className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.2 rounded font-semibold">
              共 {classStudents.filter(s => s.status === 'risk' || s.status === 'warning').length} 人
            </span>
          </div>

          <div className="space-y-3">
            {classStudents.filter(s => s.status === 'risk' || s.status === 'warning').map(student => (
              <div 
                key={student.id}
                onClick={() => onNavigate('diagnosis', 'profile')}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/20 border border-slate-100 dark:border-zinc-800 flex items-start justify-between gap-2.5 cursor-pointer hover:bg-slate-100/50 transition-all"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm">{student.name}</span>
                    <span className={`px-1.5 py-0.2 text-[9px] font-semibold rounded ${
                      student.status === 'risk' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {student.status === 'risk' ? '近期风险' : '需要关注'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    学号：{student.studentNo} · 最近成绩：{student.recentHomeworkTrend[student.recentHomeworkTrend.length - 1]}分
                  </p>
                  
                  {/* Detailed downward trend text as requested */}
                  <div className="mt-2 text-[10px] text-red-700 dark:text-red-400 font-semibold flex items-center gap-1 bg-red-500/5 p-1.5 rounded-lg border border-red-500/10">
                    <TrendingDown className="w-3.5 h-3.5" />
                    诊断：{student.status === 'risk' ? '成绩连续三次呈现递减趋势，笔误频发，文言文虚词严重混淆' : '古诗词默写严重漏交落后'}
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-300 mt-0.5" />
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* AI recommendation detailed block */}
      <div className="glass-panel rounded-3xl p-6 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 relative overflow-hidden">
        <div className="flex items-center gap-2 mb-3">
          <span className="p-1.5 bg-emerald-100 dark:bg-emerald-950/45 rounded-xl text-emerald-800 dark:text-emerald-400">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </span>
          <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base">Gemini 1.5 Pro 学情诊断建议与授课导语 (王老师专属建议)</h4>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-5xl font-sans">
          鉴于本次《驿路梨花》阅读诊断中 <b>七年级 3 班</b> 暴露出对“标题象征义”漏答的共性问题，建议您在下节课伊始，设计 5 分钟的<b>“三花聚顶”微课导语环节</b>：<br />
          1. <b>第一层（自然之花）：</b> 展示哀牢山洁白如雪的梨花高拍仪扫描件，引导周宇洋、徐昊然描述其给路人带来的心理温度。<br />
          2. <b>第二层（青春之花）：</b> 引导学生回顾照顾驿站哈尼姑娘梨花的具体无私善行，使张雨轩等同学理解什么是双关写法。<br />
          3. <b>第三层（精神之花）：</b> 升华至“雷锋精神处处开花”的主旨，让陈梓睿谈谈雷锋故事，给其提供展示和自尊心增强的契机，温和对齐全班核心素养。<br />
          ※ 已在<b>[资料库]</b>中为您同步解锁了此微课配套的 <b>三花聚顶 PPT 切片课件和课前5分钟提问导向导语卡片</b>，您可以直接投影授课。
        </p>
      </div>

    </div>
  );
}

