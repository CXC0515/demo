/** @license SPDX-License-Identifier: Apache-2.0 */
import { Delete } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ScoreKeypadProps {
  value: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'] as const;

export default function ScoreKeypad({ value, max, disabled = false, onChange }: ScoreKeypadProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => setDraft(String(value)), [value]);

  const applyKey = (key: typeof keys[number]) => {
    let next = draft;
    if (key === 'backspace') next = draft.length > 1 ? draft.slice(0, -1) : '0';
    else if (key === '.') {
      if (draft.includes('.')) return;
      next = `${draft}.`;
    } else next = draft === '0' ? key : `${draft}${key}`;
    const numeric = Number(next);
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > max) return;
    setDraft(next);
    onChange(numeric);
  };

  return (
    <section aria-label="教师最终分数字键盘" className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div><span className="block text-xs font-bold text-slate-500">教师最终分</span><strong className="mt-1 block text-2xl tabular-nums text-slate-900 dark:text-white">{draft.endsWith('.') ? draft : value}</strong></div>
        <span className="text-xs font-bold text-slate-500">满分 {max}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {keys.map(key => <button key={key} type="button" disabled={disabled} aria-label={key === 'backspace' ? '退格' : key === '.' ? '小数点' : `数字 ${key}`} onClick={() => applyKey(key)} className="flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-base font-black text-slate-800 shadow-sm active:bg-slate-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-slate-100">{key === 'backspace' ? <Delete className="h-5 w-5" /> : key}</button>)}
      </div>
    </section>
  );
}
