import { ChevronDown, GraduationCap, HelpCircle, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import type { SchoolClass } from '../domain/types';
import type { NavGroup, PageId } from './navigation';

interface AppLayoutProps {
  activePage: PageId;
  classes: SchoolClass[];
  expandedGroups: Record<string, boolean>;
  navGroups: NavGroup[];
  pendingReviewCount: number;
  selectedClass?: SchoolClass;
  selectedClassId: string;
  showToast: boolean;
  toastMessage: string | null;
  children: ReactNode;
  onSelectClass: (classId: string) => void;
  onSelectPage: (pageId: PageId) => void;
  onToggleGroup: (groupId: string) => void;
}

export default function AppLayout({
  activePage,
  classes,
  expandedGroups,
  navGroups,
  pendingReviewCount,
  selectedClass,
  selectedClassId,
  showToast,
  toastMessage,
  children,
  onSelectClass,
  onSelectPage,
  onToggleGroup
}: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-zinc-950 text-slate-800 dark:text-slate-100 font-sans flex flex-col antialiased">
      <header className="h-16 bg-white/75 dark:bg-zinc-900/75 backdrop-blur-2xl border-b border-slate-200/70 dark:border-zinc-800/80 px-6 flex items-center justify-between z-30 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[20px] bg-emerald-700 dark:bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-900/10">
            <GraduationCap className="w-5.5 h-5.5" />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
              教师 AI 助手
              <span className="text-[10px] bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold px-1.5 py-0.2 rounded-full border border-emerald-500/10">
                PRO v1.5
              </span>
            </h1>
            <p className="text-[10px] text-slate-400">教学证据采集、作业 AI 批改、学情诊断和学生画像平台</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/65 dark:bg-zinc-800/65 border border-slate-200/70 dark:border-zinc-700/70 text-[11px] text-slate-500 dark:text-slate-400">
            <span>2026 春季学期</span>
            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
            <span>初中语文</span>
            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
            <span>统编版七年级下册</span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-700/10">
            <span className="text-[11px] font-bold text-emerald-900/60 dark:text-emerald-200/70">当前班级</span>
            <select
              value={selectedClassId}
              onChange={(e) => onSelectClass(e.target.value)}
              className="bg-transparent text-xs font-semibold cursor-pointer text-emerald-950 dark:text-emerald-100 focus:outline-none"
            >
              {classes.filter(c => c.status === 'active').map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">王老师</span>
            <div className="w-8 h-8 rounded-full bg-slate-200/90 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center text-xs">
              王
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-72 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-2xl border-r border-slate-200/70 dark:border-zinc-800/80 flex flex-col justify-between p-4 flex-shrink-0 select-none z-20">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-3 block mb-2">导航</span>
            <nav className="space-y-2">
              {navGroups.map(group => {
                const GroupIcon = group.icon;
                const isSingle = group.items.length === 1;
                const isExpanded = isSingle || expandedGroups[group.id];
                const hasActiveChild = group.items.some(item => item.id === activePage);

                return (
                  <div key={group.id} className="rounded-2xl">
                    <button
                      onClick={() => isSingle ? onSelectPage(group.items[0].id) : onToggleGroup(group.id)}
                      className={`w-full px-3 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                        hasActiveChild
                          ? 'bg-emerald-700/10 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200'
                          : 'text-slate-500 hover:bg-white/80 hover:text-slate-800 dark:hover:bg-zinc-800/80 dark:hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <GroupIcon className="w-4.5 h-4.5" />
                        <span>{group.label}</span>
                      </div>
                      {!isSingle && (
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      )}
                    </button>

                    {!isSingle && isExpanded && (
                      <div className="mt-1 ml-5 pl-3 border-l border-slate-200/80 dark:border-zinc-800/80 space-y-1">
                        {group.items.map(item => {
                          const ItemIcon = item.icon;
                          const isActive = activePage === item.id;
                          return (
                            <button
                              key={item.id}
                              id={`sidebar-item-${item.id}`}
                              onClick={() => onSelectPage(item.id)}
                              className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-emerald-700 text-white shadow-md shadow-emerald-700/10'
                                  : 'text-slate-500 hover:bg-white/80 hover:text-slate-800 dark:hover:bg-zinc-800/80 dark:hover:text-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <ItemIcon className="w-4 h-4" />
                                <span>{item.label}</span>
                              </div>
                              {item.badge && item.badge > 0 && (
                                <span className={`px-1.5 py-0.2 text-[9px] rounded-full font-bold ${isActive ? 'bg-white text-emerald-800' : 'bg-red-500 text-white'}`}>
                                  {item.badge}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>

          <div className="p-3 bg-white/65 dark:bg-zinc-850/40 rounded-2xl border border-slate-200/70 dark:border-zinc-800/60 text-[11px] text-slate-500 space-y-1">
            <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" />
              当前班级
            </span>
            <p className="leading-normal">{selectedClass?.name}，{selectedClass?.studentCount} 人。课代表：{selectedClass?.representatives.length || 0} 名。待复核 {pendingReviewCount} 条。</p>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-zinc-950">
          {children}
        </main>
      </div>

      {showToast && (
        <div className="fixed top-4 right-4 bg-slate-900/90 dark:bg-zinc-900/90 text-white backdrop-blur-md px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 z-50 border border-slate-700/50 animate-fade-in">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
