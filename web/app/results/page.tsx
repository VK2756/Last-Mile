import type { Metadata } from 'next';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Markdown } from '@/components/story/Markdown';
import { ResultsView } from '@/components/story/ResultsView';

export const metadata: Metadata = {
  title: 'Results · Last Mile',
  description: 'Monte Carlo comparison of alerts-only vs Last Mile evacuation dispatch, with 95% confidence intervals. Simulation with synthetic people.',
};

/**
 * docs/submission/SENSITIVITY.md is read at build time (the page is static), so the note ships with each deploy.
 * Only its "## On the results page" section is shown; the rest of the file is the full write-up.
 */
async function sensitivityNote() {
  const candidates = [path.join(process.cwd(), '..', 'docs', 'submission', 'SENSITIVITY.md'), path.join(process.cwd(), 'docs', 'submission', 'SENSITIVITY.md')];
  for (const p of candidates) {
    try {
      const md = await readFile(p, 'utf8');
      const start = md.indexOf('## On the results page');
      if (start < 0) return <Markdown source={md} skipTitle />;
      const rest = md.slice(start + '## On the results page'.length);
      const end = rest.search(/\n## /);
      return <Markdown source={end < 0 ? rest : rest.slice(0, end)} skipTitle />;
    } catch {
      /* try the next location */
    }
  }
  return null;
}

export default async function ResultsPage() {
  return <ResultsView sensitivity={await sensitivityNote()} />;
}
