/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  BookOpen, Boxes, GitBranch, Network, Plus, Save, Search, Trash2
} from 'lucide-react';
import { KnowledgeNode } from '../types';

interface KnowledgeLibraryProps {
  nodes: KnowledgeNode[];
  mode: 'graph' | 'editor';
  onSwitchMode: (mode: 'graph' | 'editor') => void;
  onShowToast: (message: string) => void;
}

const typeTone: Record<KnowledgeNode['type'], string> = {
  book: 'bg-slate-900 text-white border-slate-900',
  unit: 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-900/30 dark:text-stone-200',
  lesson: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200',
  question: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200',
  knowledge: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/30 dark:text-violet-200',
  capability: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200',
  error: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200'
};

const typeLabels: Record<KnowledgeNode['type'], string> = {
  book: '课本',
  unit: '单元',
  lesson: '课文',
  question: '题目',
  knowledge: '知识点',
  capability: '能力点',
  error: '错误类型'
};

export default function KnowledgeLibrary({
  nodes,
  mode,
  onSwitchMode,
  onShowToast
}: KnowledgeLibraryProps) {
  const [selectedId, setSelectedId] = useState(nodes[4]?.id ?? nodes[0]?.id);
  const [filterType, setFilterType] = useState<'all' | KnowledgeNode['type']>('all');
  const [query, setQuery] = useState('');

  const selected = nodes.find(n => n.id === selectedId) ?? nodes[0];
  const filtered = useMemo(() => {
    return nodes.filter(node => {
      const typeMatched = filterType === 'all' || node.type === filterType;
      const queryMatched = !query || `${node.name}${node.desc}${node.typeName}`.toLowerCase().includes(query.toLowerCase());
      return typeMatched && queryMatched;
    });
  }, [filterType, nodes, query]);

  const children = nodes.filter(n => n.parentId === selected?.id);
  const parent = nodes.find(n => n.id === selected?.parentId);

  const graphPositions: Record<string, string> = {
    n1: 'left-[6%] top-[42%]',
    n2: 'left-[20%] top-[28%]',
    n3: 'left-[36%] top-[42%]',
    n4: 'left-[52%] top-[26%]',
    n5: 'left-[64%] top-[44%]',
    n6: 'left-[78%] top-[24%]',
    n7: 'left-[78%] top-[49%]',
    n8: 'left-[78%] top-[70%]',
    n9: 'left-[58%] top-[70%]'
  };

  return (
    <div className="space-y-5 animate-fade-in" id="knowledge-library-page">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">资料库</p>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">知识图谱与资料编辑</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">维护课本、课文、题目、知识点、能力点与错误类型之间的拓扑关系。</p>
        </div>
        <div className="glass-panel rounded-2xl p-1 flex items-center gap-1">
          <button
            onClick={() => onSwitchMode('graph')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${mode === 'graph' ? 'bg-emerald-700 text-white shadow-md' : 'text-slate-500 hover:bg-white/70 dark:hover:bg-zinc-800'}`}
          >
            <Network className="w-4 h-4" />
            图谱视图
          </button>
          <button
            onClick={() => onSwitchMode('editor')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${mode === 'editor' ? 'bg-emerald-700 text-white shadow-md' : 'text-slate-500 hover:bg-white/70 dark:hover:bg-zinc-800'}`}
          >
            <Boxes className="w-4 h-4" />
            编辑视图
          </button>
        </div>
      </div>

      {mode === 'graph' ? (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
          <div className="glass-panel rounded-[24px] p-5 min-h-[620px] relative overflow-hidden graph-container">
            <div className="absolute inset-x-6 top-5 flex items-center justify-between z-20">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 dark:bg-zinc-900/70 border border-slate-200/80 dark:border-zinc-800/80 backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">统编版七下 - 第四单元知识链路</span>
              </div>
              <button
                onClick={() => onShowToast('已模拟触发“驿路梨花 标题作用题”资料检索')}
                className="px-3 py-1.5 rounded-full bg-slate-900 text-white text-xs font-bold shadow-lg active:scale-95 transition-all"
              >
                关键词触发检索
              </button>
            </div>

            <div className="absolute left-[12%] top-[47%] w-[16%] graph-line rotate-[-18deg]"></div>
            <div className="absolute left-[27%] top-[36%] w-[15%] graph-line rotate-[18deg]"></div>
            <div className="absolute left-[43%] top-[44%] w-[16%] graph-line rotate-[-24deg]"></div>
            <div className="absolute left-[57%] top-[35%] w-[13%] graph-line rotate-[34deg]"></div>
            <div className="absolute left-[69%] top-[46%] w-[14%] graph-line rotate-[-34deg]"></div>
            <div className="absolute left-[70%] top-[51%] w-[14%] graph-line rotate-[2deg]"></div>
            <div className="absolute left-[70%] top-[56%] w-[15%] graph-line rotate-[30deg]"></div>
            <div className="absolute left-[62%] top-[57%] w-[9%] graph-line rotate-[110deg]"></div>

            {nodes.map(node => (
              <button
                key={node.id}
                onClick={() => setSelectedId(node.id)}
                className={`graph-node absolute ${graphPositions[node.id] ?? 'left-[45%] top-[50%]'} max-w-[170px] rounded-2xl border px-4 py-3 text-left shadow-xl backdrop-blur-xl transition-all hover:-translate-y-1 ${typeTone[node.type]} ${selectedId === node.id ? 'ring-4 ring-emerald-400/25 scale-105' : ''}`}
              >
                <span className="text-[10px] font-black opacity-70">{node.typeName}</span>
                <span className="block text-sm font-black leading-tight mt-1">{node.name}</span>
              </button>
            ))}
          </div>

          <aside className="glass-panel rounded-[24px] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${typeTone[selected.type]}`}>{selected.typeName}</span>
              <span className="text-xs text-slate-400">权重 {selected.weight}</span>
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-50">{selected.name}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{selected.desc}</p>
            </div>
            <div className="rounded-2xl bg-slate-50/80 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-zinc-800/80 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                <GitBranch className="w-4 h-4 text-emerald-700" />
                关系
              </div>
              <div className="text-xs text-slate-500 space-y-2">
                <p>上级：{parent ? parent.name : '无'}</p>
                <p>下级：{children.length ? children.map(c => c.name).join('、') : '暂无'}</p>
              </div>
            </div>
            <button
              onClick={() => onSwitchMode('editor')}
              className="w-full py-3 rounded-2xl bg-emerald-700 text-white text-sm font-bold shadow-lg active:scale-95 transition-all"
            >
              进入编辑形态
            </button>
          </aside>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr_360px] gap-5">
          <aside className="glass-panel rounded-[24px] p-4 space-y-2">
            <p className="text-xs font-black text-slate-400 uppercase px-2 mb-3">对象类型</p>
            {(['all', 'book', 'unit', 'lesson', 'question', 'knowledge', 'capability', 'error'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`w-full px-3 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-between transition-all ${filterType === type ? 'bg-emerald-700 text-white' : 'text-slate-500 hover:bg-white/70 dark:hover:bg-zinc-800'}`}
              >
                <span>{type === 'all' ? '全部对象' : typeLabels[type]}</span>
                <span>{type === 'all' ? nodes.length : nodes.filter(n => n.type === type).length}</span>
              </button>
            ))}
          </aside>

          <section className="glass-panel rounded-[24px] overflow-hidden">
            <div className="p-4 border-b border-slate-200/70 dark:border-zinc-800/80 flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索课文、题目、知识点..."
                  className="w-full pl-9 pr-3 py-2 rounded-2xl bg-slate-50/80 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-zinc-800/80 text-sm focus:outline-none"
                />
              </div>
              <button
                onClick={() => onShowToast('已模拟新增一个知识对象')}
                className="px-3 py-2 rounded-2xl bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                新增
              </button>
            </div>

            <div className="divide-y divide-slate-200/70 dark:divide-zinc-800/80">
              {filtered.map(node => (
                <button
                  key={node.id}
                  onClick={() => setSelectedId(node.id)}
                  className={`w-full px-4 py-3 text-left grid grid-cols-[120px_1fr_80px] gap-3 items-center transition-all ${selectedId === node.id ? 'bg-emerald-700/10' : 'hover:bg-slate-50/80 dark:hover:bg-zinc-900/50'}`}
                >
                  <span className={`w-fit px-2 py-1 rounded-full border text-[11px] font-bold ${typeTone[node.type]}`}>{node.typeName}</span>
                  <span>
                    <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{node.name}</span>
                    <span className="block text-xs text-slate-400 truncate">{node.desc}</span>
                  </span>
                  <span className="text-xs text-slate-400">权重 {node.weight}</span>
                </button>
              ))}
            </div>
          </section>

          <aside className="glass-panel rounded-[24px] p-5 space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-slate-50">详情编辑</h3>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-400">名称</span>
              <input value={selected.name} readOnly className="w-full px-3 py-2 rounded-2xl bg-slate-50/80 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-zinc-800/80 text-sm" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-400">类型</span>
              <input value={selected.typeName} readOnly className="w-full px-3 py-2 rounded-2xl bg-slate-50/80 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-zinc-800/80 text-sm" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-400">描述</span>
              <textarea value={selected.desc} readOnly rows={5} className="w-full px-3 py-2 rounded-2xl bg-slate-50/80 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-zinc-800/80 text-sm resize-none" />
            </label>
            <div className="rounded-2xl bg-slate-50/80 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-zinc-800/80 p-3">
              <p className="text-xs font-bold text-slate-500 mb-2">拓扑关系</p>
              <p className="text-xs text-slate-500">前置：{parent?.name ?? '无'}</p>
              <p className="text-xs text-slate-500 mt-1">后续：{children.map(c => c.name).join('、') || '暂无'}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => onShowToast('关系修改已模拟保存')} className="py-2 rounded-2xl bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all">
                <Save className="w-4 h-4" />
                保存
              </button>
              <button onClick={() => onShowToast('已模拟删除一条拓扑关系')} className="py-2 rounded-2xl bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all">
                <Trash2 className="w-4 h-4" />
                删除关系
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
