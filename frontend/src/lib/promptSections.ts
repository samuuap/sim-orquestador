/**
 * Splitting a system prompt into editable sections, and putting it back together.
 *
 * Extracted from the panel so the round trip can be asserted headlessly: a reassembly bug here
 * would silently corrupt an agent's prompt, and that is not something a typecheck can catch.
 */

export interface Section {
  title: string;
  /** Raw body text, excluding the heading line. */
  body: string;
  /** Inclusive line range of the body within the original document. */
  bodyStart: number;
  bodyEnd: number;
}

/**
 * Split on level-1 and level-2 headings. Level 3 stays inside its parent, which keeps the outline
 * at a useful granularity: ~8 bars rather than ~25.
 */
export function splitSections(prompt: string): Section[] {
  const lines = prompt.split('\n');
  const headings: Array<{ title: string; line: number }> = [];

  lines.forEach((line, index) => {
    const match = /^(#{1,2})\s+(.*)$/.exec(line);
    if (match) headings.push({ title: match[2].trim(), line: index });
  });

  if (headings.length === 0) {
    return [{ title: 'Prompt', body: prompt, bodyStart: 0, bodyEnd: lines.length - 1 }];
  }

  return headings.map((heading, index) => {
    const bodyStart = heading.line + 1;
    const bodyEnd = (index + 1 < headings.length ? headings[index + 1].line : lines.length) - 1;
    return {
      title: heading.title,
      body: lines.slice(bodyStart, bodyEnd + 1).join('\n'),
      bodyStart,
      bodyEnd,
    };
  });
}

/** Splice edited bodies back into the original document. Applied last-first to keep indices valid. */
export function reassemble(prompt: string, sections: Section[], drafts: Map<number, string>): string {
  const lines = prompt.split('\n');
  [...drafts.entries()]
    .sort((a, b) => b[0] - a[0])
    .forEach(([index, body]) => {
      const section = sections[index];
      if (!section) return;
      lines.splice(section.bodyStart, section.bodyEnd - section.bodyStart + 1, ...body.split('\n'));
    });
  return lines.join('\n');
}

