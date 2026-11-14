import type { ReactNode } from 'react';

// Tiny, dependency-free Markdown renderer for our own docs (headings, paragraphs, lists, tables,
// **bold**, `code`, [links](url)). Server-only use; input is a file from this repo, never user input.

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (t.startsWith('**')) out.push(<strong key={k} className="font-semibold text-fg">{t.slice(2, -2)}</strong>);
    else if (t.startsWith('`')) out.push(<code key={k} className="rounded bg-surface-3 px-1 font-mono text-[0.85em]">{t.slice(1, -1)}</code>);
    else {
      const [, label, href] = /\[([^\]]+)\]\(([^)]+)\)/.exec(t)!;
      const external = /^https?:/.test(href!);
      out.push(
        <a key={k} href={href} className="text-accent underline-offset-2 hover:underline" {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
          {label}
        </a>,
      );
    }
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (row: string) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

export function Markdown({ source, skipTitle = false }: { source: string; skipTitle?: boolean }) {
  const lines = source.replace(/<!--[\s\S]*?-->/g, '').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let b = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const key = `b${b++}`;
    if (!line.trim()) { i++; continue; }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1]!.length;
      if (!(skipTitle && level === 1)) {
        const cls = level <= 2 ? 'mt-5 mb-2 text-sm font-semibold text-fg' : 'mt-4 mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-fg-dim';
        blocks.push(level <= 2 ? <h3 key={key} className={cls}>{inline(h[2]!, key)}</h3> : <h4 key={key} className={cls}>{inline(h[2]!, key)}</h4>);
      }
      i++;
      continue;
    }
    if (line.trim().startsWith('|')) {
      const rows: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('|')) rows.push(lines[i++]!);
      const [head, , ...body] = rows;
      blocks.push(
        <div key={key} className="my-3 overflow-x-auto rounded-md border border-line">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 font-mono text-[10px] uppercase tracking-[0.1em] text-fg-dim">
              <tr>{cells(head ?? '').map((c, j) => <th key={j} className="px-2.5 py-2 font-semibold">{inline(c, `${key}h${j}`)}</th>)}</tr>
            </thead>
            <tbody className="tabular font-mono">
              {body.map((r, ri) => (
                <tr key={ri} className="border-t border-line">
                  {cells(r).map((c, j) => <td key={j} className="px-2.5 py-1.5 align-top">{inline(c, `${key}r${ri}c${j}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i]!)) items.push(lines[i++]!.replace(/^\s*[-*]\s+/, ''));
      blocks.push(
        <ul key={key} className="my-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-fg-muted">
          {items.map((t, j) => <li key={j}>{inline(t, `${key}l${j}`)}</li>)}
        </ul>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^(#{1,4}\s|\s*[-*]\s|\s*\|)/.test(lines[i]!)) para.push(lines[i++]!.trim());
    blocks.push(<p key={key} className="my-2 text-sm leading-relaxed text-fg-muted">{inline(para.join(' '), key)}</p>);
  }
  return <>{blocks}</>;
}
