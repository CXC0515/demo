import { useState } from 'react';
import { dailyBehaviorTags } from '../../domain/behaviorTags';

interface BehaviorTagEditorProps {
  selectedTags: string[];
  onChange: (tags: string[]) => Promise<boolean>;
  compact?: boolean;
}

export default function BehaviorTagEditor({ selectedTags, onChange, compact = false }: BehaviorTagEditorProps) {
  const [savingTag, setSavingTag] = useState<string | null>(null);

  const toggle = async (tag: string) => {
    if (savingTag) return;
    const next = selectedTags.includes(tag)
      ? selectedTags.filter(item => item !== tag)
      : [...selectedTags, tag];
    setSavingTag(tag);
    try {
      await onChange(next);
    } finally {
      setSavingTag(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5" aria-label="日常表现标签">
      {dailyBehaviorTags.map(tag => {
        const selected = selectedTags.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            disabled={Boolean(savingTag)}
            onClick={() => void toggle(tag)}
            aria-pressed={selected}
            className={`${compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs'} rounded-full border font-bold transition-colors disabled:cursor-wait disabled:opacity-60 ${selected ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-300'}`}
          >
            {savingTag === tag ? '保存中…' : tag}
          </button>
        );
      })}
    </div>
  );
}
