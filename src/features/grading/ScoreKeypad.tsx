/** @license SPDX-License-Identifier: Apache-2.0 */
import { Check } from 'lucide-react';

interface ScoreKeypadProps { value: number; max: number; disabled?: boolean; onChange: (value: number) => void; onConfirm?: () => void; }
const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export default function ScoreKeypad({ value, max, disabled = false, onChange, onConfirm }: ScoreKeypadProps) {
  return <section aria-label="教师最终分数字键盘" className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
    <div className="mb-3 flex items-end justify-between gap-3"><div><span className="block text-xs font-bold text-slate-500">教师最终分</span><strong className="mt-1 block text-2xl tabular-nums">{value}</strong></div><span className="text-xs font-bold text-slate-500">满分 {max}</span></div>
    <div className="grid grid-cols-3 gap-2">{digits.map(digit => <button key={digit} type="button" disabled={disabled || digit > max} onClick={() => onChange(digit)} className="flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-base font-black disabled:opacity-30 dark:border-zinc-700 dark:bg-zinc-950">{digit}</button>)}<button type="button" disabled={disabled} onClick={() => onChange(0)} className="col-span-2 min-h-11 rounded-xl border border-slate-200 bg-white text-base font-black dark:border-zinc-700 dark:bg-zinc-950">0</button><button type="button" disabled={disabled || !onConfirm} aria-label="确认分数" onClick={onConfirm} className="flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 text-white disabled:opacity-40"><Check className="h-5 w-5" /></button></div>
  </section>;
}
