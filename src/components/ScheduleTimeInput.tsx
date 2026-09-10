import React, { useEffect, useState } from 'react';
import { normalizeScheduleTime } from '../domain/scheduleTime';

interface ScheduleTimeInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onInvalid: (message: string) => void;
}

export default function ScheduleTimeInput({ id, label, value, onChange, onInvalid }: ScheduleTimeInputProps) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(value);
  }, [focused, value]);

  const commit = () => {
    const normalized = normalizeScheduleTime(draft);
    if (!normalized) {
      setDraft(value);
      onInvalid(`${label}格式不正确，请输入如 08:00`);
      return;
    }
    setDraft(normalized);
    onChange(normalized);
  };

  return (
    <label htmlFor={id} className="min-w-0 space-y-1">
      <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">{label}</span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        enterKeyHint="done"
        value={draft}
        placeholder="08:00"
        aria-describedby={`${id}-hint`}
        onFocus={() => setFocused(true)}
        onChange={(event) => setDraft(event.target.value.replace(/[^0-9:]/g, '').slice(0, 5))}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        className="min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-base font-semibold tabular-nums outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <span id={`${id}-hint`} className="sr-only">可输入四位数字，例如 0800 会自动转换为 08:00</span>
    </label>
  );
}
