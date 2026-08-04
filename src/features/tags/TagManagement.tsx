/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CheckCircle, Edit3, Plus, Sparkles, Tag, Trash2 } from 'lucide-react';

interface TagGroup {
  id: string;
  name: string;
  desc: string;
  tags: { name: string; color: string; enabled: boolean }[];
}

const initialGroups: TagGroup[] = [
  {
    id: 'family',
    name: '家庭关注标签',
    desc: '用于记录家庭支持、沟通方式和学生成长环境。',
    tags: [
      { name: '留守儿童', color: 'rose', enabled: true },
      { name: '双职工家庭', color: 'blue', enabled: true },
      { name: '隔代教养', color: 'amber', enabled: true },
      { name: '单亲家庭', color: 'rose', enabled: true },
      { name: '重组家庭', color: 'violet', enabled: true },
      { name: '家长期望较高', color: 'emerald', enabled: true },
      { name: '作业陪伴不足', color: 'amber', enabled: true },
      { name: '沟通需谨慎', color: 'slate', enabled: true }
    ]
  },
  {
    id: 'academic',
    name: '学情状态标签',
    desc: '用于记录学生阶段性的学习优势、风险和能力变化。',
    tags: [
      { name: '阅读理解薄弱', color: 'amber', enabled: true },
      { name: '表达组织薄弱', color: 'amber', enabled: true },
      { name: '文言文薄弱', color: 'rose', enabled: true },
      { name: '作文稳定', color: 'emerald', enabled: true },
      { name: '进步明显', color: 'blue', enabled: true },
      { name: '波动较大', color: 'violet', enabled: true }
    ]
  },
  {
    id: 'behavior',
    name: '日常表现标签',
    desc: '用于记录课堂参与、作业习惯、情绪和同伴关系。',
    tags: [
      { name: '课堂积极', color: 'emerald', enabled: true },
      { name: '注意力易分散', color: 'amber', enabled: true },
      { name: '作业拖延', color: 'rose', enabled: true },
      { name: '书写认真', color: 'blue', enabled: true },
      { name: '情绪敏感', color: 'violet', enabled: true },
      { name: '同伴关系良好', color: 'emerald', enabled: true }
    ]
  },
  {
    id: 'risk',
    name: '风险提醒标签',
    desc: '用于进入工作台和班级可视化状态灯的提醒来源。',
    tags: [
      { name: '连续下降', color: 'rose', enabled: true },
      { name: '多次缺交', color: 'rose', enabled: true },
      { name: '低置信度频发', color: 'amber', enabled: true },
      { name: '需面批', color: 'blue', enabled: true },
      { name: '需家校沟通', color: 'violet', enabled: true }
    ]
  }
];

const tone: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200',
  blue: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200',
  amber: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200',
  rose: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200',
  violet: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/30 dark:text-violet-200',
  slate: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-slate-200'
};

interface TagManagementProps {
  onShowToast: (message: string) => void;
}

export default function TagManagement({ onShowToast }: TagManagementProps) {
  const [groups, setGroups] = useState(initialGroups);
  const [activeGroupId, setActiveGroupId] = useState('family');
  const [newTagName, setNewTagName] = useState('');

  const activeGroup = groups.find(g => g.id === activeGroupId) ?? groups[0];

  const addTag = () => {
    if (!newTagName.trim()) return;
    setGroups(groups.map(group => group.id === activeGroupId
      ? { ...group, tags: [...group.tags, { name: newTagName.trim(), color: 'emerald', enabled: true }] }
      : group
    ));
    setNewTagName('');
    onShowToast('标签已添加到当前分类');
  };

  const toggleTag = (name: string) => {
    setGroups(groups.map(group => group.id === activeGroupId
      ? { ...group, tags: group.tags.map(tag => tag.name === name ? { ...tag, enabled: !tag.enabled } : tag) }
      : group
    ));
  };

  const deleteTag = (name: string) => {
    setGroups(groups.map(group => group.id === activeGroupId
      ? { ...group, tags: group.tags.filter(tag => tag.name !== name) }
      : group
    ));
    onShowToast('标签已模拟删除');
  };

  return (
    <div className="space-y-5 animate-fade-in" id="tag-management-page">
      <div>
        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">管理 / 标签管理</p>
        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">标签管理</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">统一维护家庭关注、学情状态、日常表现和风险提醒标签。</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        <aside className="glass-panel rounded-[24px] p-4 space-y-2">
          {groups.map(group => (
            <button
              key={group.id}
              onClick={() => setActiveGroupId(group.id)}
              className={`w-full px-4 py-3 rounded-2xl text-left transition-all ${activeGroupId === group.id ? 'bg-emerald-700 text-white shadow-lg' : 'hover:bg-white/70 dark:hover:bg-zinc-800 text-slate-600 dark:text-slate-300'}`}
            >
              <span className="block text-sm font-black">{group.name}</span>
              <span className={`block text-[11px] mt-1 ${activeGroupId === group.id ? 'text-white/75' : 'text-slate-400'}`}>{group.tags.length} 个标签</span>
            </button>
          ))}
        </aside>

        <section className="glass-panel rounded-[24px] overflow-hidden">
          <div className="p-5 border-b border-slate-200/70 dark:border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-50 flex items-center gap-2">
                <Tag className="w-5 h-5 text-emerald-700" />
                {activeGroup.name}
              </h3>
              <p className="text-xs text-slate-500 mt-1">{activeGroup.desc}</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="输入新标签"
                className="px-3 py-2 rounded-2xl bg-slate-50/80 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-zinc-800/80 text-sm focus:outline-none"
              />
              <button onClick={addTag} className="px-3 py-2 rounded-2xl bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all">
                <Plus className="w-4 h-4" />
                添加
              </button>
            </div>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {activeGroup.tags.map(tag => (
              <div key={tag.name} className="rounded-2xl bg-white/65 dark:bg-zinc-900/50 border border-slate-200/70 dark:border-zinc-800/80 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span className={`px-2.5 py-1 rounded-full border text-xs font-bold ${tone[tag.color]}`}>{tag.name}</span>
                  {tag.enabled ? (
                    <span className="text-[10px] text-emerald-700 flex items-center gap-1"><CheckCircle className="w-3 h-3" />启用</span>
                  ) : (
                    <span className="text-[10px] text-slate-400">停用</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleTag(tag.name)} className="flex-1 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800 text-xs font-bold text-slate-600 dark:text-slate-300 active:scale-95 transition-all">
                    {tag.enabled ? '停用' : '启用'}
                  </button>
                  <button onClick={() => onShowToast('已模拟打开标签编辑面板')} className="p-2 rounded-xl bg-slate-50 dark:bg-zinc-800 text-slate-500 active:scale-95 transition-all">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteTag(tag.name)} className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 active:scale-95 transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mx-5 mb-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 p-4 text-xs text-slate-500 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-emerald-700 mt-0.5" />
            <p>这些标签后续会同步用于学生管理、学生画像、班级可视化状态灯、工作台提醒和家校沟通草稿。</p>
          </div>
        </section>
      </div>
    </div>
  );
}

