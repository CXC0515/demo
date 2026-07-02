/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Calendar, Clock, Plus, Bell, X, Trash2, Edit, AlertCircle, Check 
} from 'lucide-react';
import { ScheduleItem, TimerReminder, SchoolClass } from '../types';

interface ScheduleReminderProps {
  schedule: ScheduleItem[];
  reminders: TimerReminder[];
  classes: SchoolClass[];
  onAddScheduleItem: (item: ScheduleItem) => void;
  onUpdateScheduleItem: (item: ScheduleItem) => void;
  onDeleteScheduleItem: (itemId: string) => void;
  onAddReminder: (reminder: TimerReminder) => void;
  onToggleReminderStatus: (reminderId: string) => void;
  onDeleteReminder: (reminderId: string) => void;
}

export default function ScheduleReminder({
  schedule,
  reminders,
  classes,
  onAddScheduleItem,
  onUpdateScheduleItem,
  onDeleteScheduleItem,
  onAddReminder,
  onToggleReminderStatus,
  onDeleteReminder
}: ScheduleReminderProps) {
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ day: number; period: number } | null>(null);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);

  // Forms states
  const [scheduleForm, setScheduleForm] = useState<Partial<ScheduleItem>>({
    title: '',
    classId: 'c1',
    type: 'class',
    time: '08:00 - 08:45'
  });

  const [reminderForm, setReminderForm] = useState<Partial<TimerReminder>>({
    name: '',
    classId: 'c1',
    time: '每周一 08:00',
    repeatRule: '每周一',
    status: 'active'
  });

  const weekdays = ['周一', '周二', '周三', '周四', '周五'];
  const periods = [
    { num: 1, name: '第一节', time: '08:00 - 08:45' },
    { num: 2, name: '第二节', time: '08:55 - 09:40' },
    { num: 3, name: '第三节', time: '10:00 - 10:45' },
    { num: 4, name: '第四节', time: '10:55 - 11:40' },
    { num: 5, name: '第五节', time: '13:30 - 14:15' },
    { num: 6, name: '第六节', time: '14:25 - 15:10' },
    { num: 7, name: '第七节', time: '15:20 - 16:05' },
    { num: 8, name: '第八节', time: '16:15 - 17:00' }
  ];

  // Filter schedule by class
  const filteredSchedule = schedule.filter(item => {
    return selectedClassId === 'all' || item.classId === selectedClassId || item.classId === '';
  });

  // Get item in a cell
  const getItemInCell = (day: number, period: number) => {
    return filteredSchedule.find(item => item.day === day && item.period === period);
  };

  const handleCellClick = (day: number, period: number) => {
    const existing = getItemInCell(day, period);
    setSelectedCell({ day, period });

    if (existing) {
      setEditingItem(existing);
      setScheduleForm({ ...existing });
    } else {
      setEditingItem(null);
      const periodTime = periods.find(p => p.num === period)?.time || '08:00 - 08:45';
      setScheduleForm({
        title: '',
        classId: selectedClassId === 'all' ? 'c1' : selectedClassId,
        type: 'class',
        time: periodTime
      });
    }
    setShowScheduleModal(true);
  };

  const handleSaveScheduleItem = () => {
    if (!scheduleForm.title) {
      alert('请填写活动内容名称！');
      return;
    }

    const selectedClass = classes.find(c => c.id === scheduleForm.classId);
    const itemData = {
      ...scheduleForm,
      className: selectedClass ? selectedClass.name : (scheduleForm.classId === '' ? '全体教师' : ''),
      day: selectedCell?.day || 1,
      period: selectedCell?.period || 1
    } as ScheduleItem;

    if (editingItem) {
      onUpdateScheduleItem(itemData);
    } else {
      onAddScheduleItem({
        ...itemData,
        id: 'sch_gen_' + Date.now()
      });
    }
    setShowScheduleModal(false);
  };

  const handleDeleteScheduleItem = () => {
    if (editingItem) {
      onDeleteScheduleItem(editingItem.id);
      setShowScheduleModal(false);
    }
  };

  const handleCreateReminder = () => {
    if (!reminderForm.name) {
      alert('请填写提醒名称！');
      return;
    }
    const selectedClass = classes.find(c => c.id === reminderForm.classId);
    onAddReminder({
      ...reminderForm,
      id: 'rem_gen_' + Date.now(),
      className: selectedClass ? selectedClass.name : '',
      status: 'active'
    } as TimerReminder);

    setShowReminderModal(false);
    // Reset
    setReminderForm({
      name: '',
      classId: 'c1',
      time: '每周一 08:00',
      repeatRule: '每周一',
      status: 'active'
    });
  };

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'class':
        return 'bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 border-emerald-500/20';
      case 'meeting':
        return 'bg-rose-500/10 hover:bg-rose-500/15 text-rose-800 dark:text-rose-400 border-rose-500/20';
      case 'research':
        return 'bg-blue-500/10 hover:bg-blue-500/15 text-blue-800 dark:text-blue-400 border-blue-500/20';
      case 'reminder':
        return 'bg-amber-500/10 hover:bg-amber-500/15 text-amber-800 dark:text-amber-400 border-amber-500/20';
      case 'parent-comm':
        return 'bg-purple-500/10 hover:bg-purple-500/15 text-purple-800 dark:text-purple-400 border-purple-500/20';
      case 'grading':
        return 'bg-indigo-500/10 hover:bg-indigo-500/15 text-indigo-800 dark:text-indigo-400 border-indigo-500/20';
      default:
        return 'bg-slate-500/10 hover:bg-slate-500/15 text-slate-800 dark:text-slate-400 border-slate-500/20';
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'class': return '语文课';
      case 'meeting': return '校内会议';
      case 'research': return '语文教研';
      case 'reminder': return '收作业提醒';
      case 'parent-comm': return '家校沟通';
      case 'grading': return 'AI 批改任务';
      default: return '普通事件';
    }
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 h-full animate-fade-in" id="schedule-page">
      
      {/* Week Schedule Grid */}
      <div className="flex-1 flex flex-col space-y-4 min-w-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 glass-panel rounded-2xl p-4">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              课表日程
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              点击空白单元格即可手动录入课程、研讨会或学生预约；支持直接修改。
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              id="schedule-class-filter"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs text-slate-600 dark:text-slate-300 font-medium cursor-pointer"
            >
              <option value="all">全课程与教研</option>
              {classes.filter(c => c.status === 'active').map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Calendar Grid Container */}
        <div className="glass-panel rounded-3xl overflow-hidden shadow-inner">
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              
              {/* Header: Days */}
              <div className="grid grid-cols-6 bg-slate-50 dark:bg-zinc-800/40 border-b border-slate-100 dark:border-zinc-800 font-bold text-center text-[11px] text-slate-400 uppercase tracking-wider py-3">
                <div className="text-left pl-4">课节 / 时段</div>
                {weekdays.map((day, idx) => (
                  <div key={idx} className="border-l border-slate-100 dark:border-zinc-800">{day}</div>
                ))}
              </div>

              {/* Grid Rows: 8 Periods */}
              <div className="divide-y divide-slate-100 dark:divide-zinc-800/40">
                {periods.map(p => (
                  <div key={p.num} className="grid grid-cols-6 items-stretch min-h-[64px]">
                    
                    {/* Time cell */}
                    <div className="p-3 bg-slate-50/40 dark:bg-zinc-850/10 flex flex-col justify-center">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{p.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono mt-0.5">{p.time}</span>
                    </div>

                    {/* Weekdays cell */}
                    {[1, 2, 3, 4, 5].map(day => {
                      const item = getItemInCell(day, p.num);
                      return (
                        <div
                          key={day}
                          id={`sch-cell-${day}-${p.num}`}
                          onClick={() => handleCellClick(day, p.num)}
                          className={`p-1.5 border-l border-slate-100 dark:border-zinc-850 cursor-pointer transition-all flex flex-col justify-center min-h-[64px] ${
                            item 
                              ? 'bg-transparent' 
                              : 'hover:bg-slate-50/60 dark:hover:bg-zinc-800/10'
                          }`}
                        >
                          {item ? (
                            <div className={`h-full p-2 rounded-xl border text-[11px] flex flex-col justify-between font-medium ${getTypeStyle(item.type)}`}>
                              <div className="space-y-0.5">
                                <span className="text-[9px] opacity-75 block font-semibold">{getTypeName(item.type)}</span>
                                <span className="font-bold leading-tight block">{item.title}</span>
                              </div>
                              <span className="text-[9px] opacity-60 self-end truncate max-w-full">{item.className}</span>
                            </div>
                          ) : (
                            <span className="text-[9px] text-slate-300 hover:text-emerald-500 text-center opacity-0 hover:opacity-100">
                              + 安排
                            </span>
                          )}
                        </div>
                      );
                    })}

                  </div>
                ))}
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Right Reminders List */}
      <div className="w-full xl:w-[320px] flex-shrink-0 flex flex-col space-y-4">
        <div className="flex items-center justify-between glass-panel rounded-2xl p-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <Bell className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
            定时提醒与闹钟
          </h3>
          <button
            onClick={() => setShowReminderModal(true)}
            className="px-2.5 py-1 bg-emerald-700/10 hover:bg-emerald-700 hover:text-white dark:bg-emerald-500/10 dark:hover:bg-emerald-500 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-semibold cursor-pointer"
          >
            添加提醒
          </button>
        </div>

        {/* Reminders layout */}
        <div className="glass-panel rounded-3xl p-5 flex-1 space-y-4">
          <div className="space-y-3">
            {reminders.map(rem => (
              <div 
                key={rem.id}
                id={`rem-card-${rem.id}`}
                className={`p-3.5 rounded-2xl border transition-all ${
                  rem.status === 'active' 
                    ? 'bg-slate-50 dark:bg-zinc-800/40 border-slate-200 dark:border-zinc-800' 
                    : 'bg-slate-100/30 dark:bg-zinc-900/10 border-slate-100 dark:border-zinc-900 opacity-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono font-bold text-slate-400 block tracking-wider uppercase">
                      {rem.repeatRule} · {rem.className}
                    </span>
                    <h5 className="text-xs font-semibold text-slate-700 dark:text-slate-200">{rem.name}</h5>
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      触发时间：{rem.time}
                    </p>
                  </div>

                  {/* Toggle switch */}
                  <div 
                    onClick={() => onToggleReminderStatus(rem.id)}
                    className={`w-9 h-5 rounded-full p-0.5 cursor-pointer transition-colors flex items-center ${
                      rem.status === 'active' ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-sm"></span>
                  </div>
                </div>

                {/* Delete button on hover/footer */}
                <div className="flex justify-end mt-2 pt-2 border-t border-dashed border-slate-200/60 dark:border-zinc-800/60">
                  <button
                    onClick={() => onDeleteReminder(rem.id)}
                    className="p-1 text-slate-400 hover:text-red-500 rounded cursor-pointer transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {reminders.length === 0 && (
              <span className="text-xs text-slate-400 italic block text-center pt-8">暂无配置收发作业等定时闹钟。</span>
            )}
          </div>
        </div>

      </div>

      {/* Schedule Item Add/Edit Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl border">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {editingItem ? '修改日程' : '安排时段事件'}
              </h3>
              <button onClick={() => setShowScheduleModal(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 block uppercase">时段与单元格</label>
                <div className="px-3 py-2 bg-slate-50 dark:bg-zinc-800 rounded-lg font-mono">
                  周{selectedCell?.day} · 第{selectedCell?.period}节课 ({scheduleForm.time})
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 block uppercase">事项内容/名称</label>
                <input
                  type="text"
                  value={scheduleForm.title || ''}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })}
                  placeholder="如：初中语文 - 3 班"
                  className="w-full px-3 py-1.5 border rounded-lg focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 block uppercase">类型</label>
                  <select
                    value={scheduleForm.type || 'class'}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, type: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 border rounded-lg"
                  >
                    <option value="class">语文课</option>
                    <option value="meeting">校内会议</option>
                    <option value="research">语文教研</option>
                    <option value="reminder">收作业提醒</option>
                    <option value="parent-comm">家校沟通</option>
                    <option value="grading">AI 批改任务</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 block uppercase">关联班级</label>
                  <select
                    value={scheduleForm.classId || ''}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, classId: e.target.value })}
                    className="w-full px-2.5 py-1.5 border rounded-lg"
                  >
                    <option value="">无 / 全体教师</option>
                    {classes.filter(c => c.status === 'active').map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-between gap-2 pt-2 border-t text-xs">
              <div>
                {editingItem && (
                  <button 
                    onClick={handleDeleteScheduleItem}
                    className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-700 rounded-lg cursor-pointer"
                  >
                    删除
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowScheduleModal(false)} className="px-3 py-1.5 bg-slate-100 rounded-lg">
                  取消
                </button>
                <button onClick={handleSaveScheduleItem} className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg">
                  保存事项
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reminder Add Modal */}
      {showReminderModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl border">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                新建定时收作业提醒
              </h3>
              <button onClick={() => setShowReminderModal(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 block uppercase">提醒事宜</label>
                <input
                  type="text"
                  value={reminderForm.name || ''}
                  onChange={(e) => setReminderForm({ ...reminderForm, name: e.target.value })}
                  placeholder="例如：周二下午收取现代文随堂小练"
                  className="w-full px-3 py-1.5 border rounded-lg focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 block uppercase">关联班级</label>
                <select
                  value={reminderForm.classId || 'c1'}
                  onChange={(e) => setReminderForm({ ...reminderForm, classId: e.target.value })}
                  className="w-full px-2.5 py-1.5 border rounded-lg"
                >
                  {classes.filter(c => c.status === 'active').map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 block uppercase">定时设置描述</label>
                  <input
                    type="text"
                    value={reminderForm.time || ''}
                    onChange={(e) => setReminderForm({ ...reminderForm, time: e.target.value })}
                    placeholder="如：每周二 16:00"
                    className="w-full px-3 py-1.5 border rounded-lg focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 block uppercase">周期规则</label>
                  <select
                    value={reminderForm.repeatRule || '每周二'}
                    onChange={(e) => setReminderForm({ ...reminderForm, repeatRule: e.target.value })}
                    className="w-full px-2.5 py-1.5 border rounded-lg"
                  >
                    <option>每周一</option>
                    <option>每周二</option>
                    <option>每周三</option>
                    <option>每周四</option>
                    <option>每周五</option>
                    <option>一次性</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t text-xs">
              <button onClick={() => setShowReminderModal(false)} className="px-3 py-1.5 bg-slate-100 rounded-lg">
                取消
              </button>
              <button onClick={handleCreateReminder} className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg">
                创建提醒闹钟
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
