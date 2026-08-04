/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { BookOpen, Database, Palette, Save, Settings2, Sliders, UserRound } from 'lucide-react';
import { SchoolClass } from '../../domain/types';

interface SystemSettingsPanelProps {
  lowConfidenceThreshold: number;
  onUpdateThreshold: (val: number) => void;
  ocrHumanReviewThreshold: number;
  ocrAutoPassThreshold: number;
  onUpdateOcrThresholds: (humanReview: number, autoPass: number) => void;
  classes: SchoolClass[];
  selectedClassId: string;
  onSelectClass: (classId: string) => void;
  onShowToast: (message: string) => void;
}

type SettingsTab = 'teacher' | 'teaching' | 'ai' | 'storage' | 'appearance';

const tabs: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: 'teacher', label: '教师信息', icon: UserRound },
  { id: 'teaching', label: '教学设置', icon: BookOpen },
  { id: 'ai', label: 'AI 参数', icon: Sliders },
  { id: 'storage', label: '数据与存储', icon: Database },
  { id: 'appearance', label: '外观', icon: Palette }
];

const themeOptions = [
  ['morandi-green', '莫兰迪绿'],
  ['fog-blue', '雾蓝'],
  ['dusty-pink', '豆沙粉'],
  ['warm-gray', '暖灰'],
  ['dark-graphite', '深色石墨']
];

export default function SystemSettingsPanel({
  lowConfidenceThreshold,
  onUpdateThreshold,
  ocrHumanReviewThreshold,
  ocrAutoPassThreshold,
  onUpdateOcrThresholds,
  classes,
  selectedClassId,
  onSelectClass,
  onShowToast
}: SystemSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('teacher');
  const [nickname, setNickname] = useState('王老师');
  const [realName, setRealName] = useState('王明');
  const [schoolName, setSchoolName] = useState('江城实验中学');
  const [title, setTitle] = useState('一级教师');
  const [term, setTerm] = useState('2026 春季学期');
  const [subject, setSubject] = useState('初中语文');
  const [grade, setGrade] = useState('七年级');
  const [textbook, setTextbook] = useState('统编版七年级下册');
  const [localThreshold, setLocalThreshold] = useState(lowConfidenceThreshold);
  const [localOcrHumanThreshold, setLocalOcrHumanThreshold] = useState(ocrHumanReviewThreshold);
  const [localOcrAutoThreshold, setLocalOcrAutoThreshold] = useState(ocrAutoPassThreshold);
  const [scoreGapThreshold, setScoreGapThreshold] = useState(1);
  const [resourceSource, setResourceSource] = useState('国家中小学智慧教育平台');
  const [lessonReferenceSite, setLessonReferenceSite] = useState('学科网 / 语文报教研资源');
  const [imageSavePolicy, setImageSavePolicy] = useState('保存原图与裁剪图');
  const [archivePolicy, setArchivePolicy] = useState('按学期归档');
  const [exportFormat, setExportFormat] = useState('PDF + Excel');
  const [theme, setTheme] = useState('morandi-green');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'morandi-green') {
      root.removeAttribute('data-theme');
      root.removeAttribute('data-theme-forced');
      root.classList.remove('dark-theme-active');
      return;
    }

    root.setAttribute('data-theme', theme);
    root.setAttribute('data-theme-forced', 'true');
    if (theme === 'dark-graphite') {
      root.classList.add('dark-theme-active');
    } else {
      root.classList.remove('dark-theme-active');
    }
  }, [theme]);

  const handleSaveSettings = () => {
    onUpdateThreshold(localThreshold);
    onUpdateOcrThresholds(localOcrHumanThreshold, localOcrAutoThreshold);
    onShowToast('系统设置已保存');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in" id="system-settings-page">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">设置</p>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">系统设置</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">配置教师信息、教学默认项、AI 参数、数据存储和外观偏好。</p>
        </div>
        <button
          onClick={handleSaveSettings}
          className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl text-sm font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-700/10 active:scale-95 transition-all"
        >
          <Save className="w-4 h-4" />
          保存设置
        </button>
      </div>

      <div className="glass-panel rounded-2xl p-2 flex flex-wrap gap-1.5 bg-slate-100/60 dark:bg-zinc-900/60">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 dark:bg-zinc-800 dark:text-slate-50 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="glass-panel rounded-[24px] p-6">
        {activeTab === 'teacher' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <SettingInput label="昵称" value={nickname} onChange={setNickname} />
            <SettingInput label="姓名" value={realName} onChange={setRealName} />
            <SettingInput label="学校" value={schoolName} onChange={setSchoolName} />
            <SettingInput label="职称" value={title} onChange={setTitle} />
          </div>
        )}

        {activeTab === 'teaching' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <SettingSelect label="当前学期" value={term} onChange={setTerm} options={['2026 春季学期', '2026 秋季学期', '2025 秋季学期']} />
            <SettingSelect label="学科" value={subject} onChange={setSubject} options={['初中语文', '初中数学', '初中英语']} />
            <SettingSelect label="年级" value={grade} onChange={setGrade} options={['七年级', '八年级', '九年级']} />
            <SettingSelect label="教材版本" value={textbook} onChange={setTextbook} options={['统编版七年级下册', '统编版七年级上册', '统编版八年级上册', '统编版八年级下册']} />
            <label className="space-y-1.5 md:col-span-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">默认显示班级</span>
              <select
                value={selectedClassId}
                onChange={(event) => onSelectClass(event.target.value)}
                className="w-full px-3 py-2 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-sm focus:outline-none"
              >
                {classes.filter(c => c.status === 'active').map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">作业图像与 OCR 质检</label>
              <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-900/60">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm font-bold">
                    <span>人工复核阈值</span>
                    <span className="font-mono text-rose-700 dark:text-rose-300">{localOcrHumanThreshold.toFixed(2)}</span>
                  </div>
                  <input type="range" min="0.50" max="0.80" step="0.05" value={localOcrHumanThreshold} onChange={(event) => setLocalOcrHumanThreshold(Math.min(parseFloat(event.target.value), localOcrAutoThreshold - 0.05))} className="w-full cursor-pointer accent-rose-600" />
                  <p className="text-xs leading-5 text-slate-500">低于该值，或出现缺页、学号冲突等硬异常，直接交给教师。</p>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm font-bold">
                    <span>自动通过阈值</span>
                    <span className="font-mono text-emerald-700 dark:text-emerald-300">{localOcrAutoThreshold.toFixed(2)}</span>
                  </div>
                  <input type="range" min="0.75" max="0.98" step="0.01" value={localOcrAutoThreshold} onChange={(event) => setLocalOcrAutoThreshold(Math.max(parseFloat(event.target.value), localOcrHumanThreshold + 0.05))} className="w-full cursor-pointer accent-emerald-700" />
                  <p className="text-xs leading-5 text-slate-500">两个阈值之间先由多模态模型核验，高于该值且无硬异常才自动通过。</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">AI 评分置信度</label>
              <div className="p-4 bg-slate-50 dark:bg-zinc-900/60 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
                <div className="flex justify-between text-sm font-bold">
                  <span>评分异常拦截</span>
                  <span className="text-emerald-700 dark:text-emerald-300 font-mono">{localThreshold.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.50"
                  max="0.95"
                  step="0.05"
                  value={localThreshold}
                  onChange={(event) => setLocalThreshold(parseFloat(event.target.value))}
                  className="w-full accent-emerald-700 cursor-pointer"
                />
              </div>
            </div>
            <SettingSelect label="分差复核阈值" value={`${scoreGapThreshold} 分`} onChange={(value) => setScoreGapThreshold(parseInt(value, 10))} options={['1 分', '2 分', '3 分']} />
            <SettingInput label="首选资料源" value={resourceSource} onChange={setResourceSource} />
            <SettingInput label="参考教案网站" value={lessonReferenceSite} onChange={setLessonReferenceSite} />
          </div>
        )}

        {activeTab === 'storage' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <SettingSelect label="原图保存策略" value={imageSavePolicy} onChange={setImageSavePolicy} options={['保存原图与裁剪图', '仅保存原图', '仅保存裁剪图']} />
            <SettingSelect label="诊断报告导出格式" value={exportFormat} onChange={setExportFormat} options={['PDF + Excel', 'PDF', 'Excel', 'CSV']} />
            <SettingSelect label="数据归档策略" value={archivePolicy} onChange={setArchivePolicy} options={['按学期归档', '按学年归档', '手动归档']} />
          </div>
        )}

        {activeTab === 'appearance' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">主题色</label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {themeOptions.map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
                      theme === value
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-slate-50 dark:bg-zinc-900/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-zinc-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 flex items-start gap-3">
              <Settings2 className="w-5 h-5 text-slate-400 mt-0.5" />
              <p className="text-sm text-slate-500 leading-relaxed">
                深色模式默认跟随系统。选择“深色石墨”会强制切换为深色主题。
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full px-3 py-2 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-sm focus:outline-none"
      />
    </label>
  );
}

function SettingSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full px-3 py-2 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-sm focus:outline-none"
      >
        {options.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

