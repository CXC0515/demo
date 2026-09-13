/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Fragment, useEffect, useState } from 'react';
import 'katex/dist/katex.min.css';

let katexModulePromise: Promise<typeof import('katex')> | undefined;

const renderOcrUnderline = (expression: string) => {
  const match = expression.trim().match(/^\\underline\s*\{\s*\\text\s*\{([\s\S]*)\}\s*\}$/);
  if (!match) return null;
  const content = match[1].trim();
  const leadingChoice = content.match(/^([（(][^）)]{1,80}[）)])([\s\S]*)$/);
  return leadingChoice
    ? <><span className="underline decoration-1 underline-offset-4">{leadingChoice[1]}</span>{leadingChoice[2]}</>
    : <span className="underline decoration-1 underline-offset-4">{content}</span>;
};

function Formula({ expression, block }: { expression: string; block: boolean; key?: number }) {
  const underline = renderOcrUnderline(expression);
  const [html, setHtml] = useState('');
  useEffect(() => {
    if (renderOcrUnderline(expression)) return undefined;
    let active = true;
    katexModulePromise ??= import('katex');
    void katexModulePromise.then(({ default: katex }) => {
      if (active) setHtml(katex.renderToString(expression, { displayMode: block, throwOnError: false, strict: 'ignore', output: 'html' }));
    });
    return () => { active = false; };
  }, [block, expression]);
  if (underline) return <span className="whitespace-pre-wrap break-words">{underline}</span>;
  return html
    ? <span className={`${block ? 'block overflow-x-auto py-1' : 'inline max-w-full break-words align-baseline'} [&_.katex]:max-w-full`} dangerouslySetInnerHTML={{ __html: html }} />
    : <span>{expression}</span>;
}

export default function RichOcrText({ text, className = '' }: { text: string; className?: string }) {
  const pattern = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+\$)/g;
  return (
    <span className={`whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${className}`}>
      {text.split(pattern).filter(Boolean).map((part, index) => {
        const block = part.startsWith('$$') || part.startsWith('\\[');
        const delimiterLength = block || part.startsWith('\\(') ? 2 : 1;
        const isFormula = (part.startsWith('$$') && part.endsWith('$$'))
          || (part.startsWith('$') && part.endsWith('$'))
          || (part.startsWith('\\(') && part.endsWith('\\)'))
          || (part.startsWith('\\[') && part.endsWith('\\]'));
        return isFormula
          ? <Formula key={index} expression={part.slice(delimiterLength, -delimiterLength).trim()} block={block} />
          : <Fragment key={index}>{part}</Fragment>;
      })}
    </span>
  );
}
