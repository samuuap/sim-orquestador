/**
 * Round-trip check for the system-prompt section editor.
 *
 * The panel lets you edit one section of a 15k-character prompt and PUTs the whole document back.
 * If reassembly is not byte-exact for untouched sections, editing one heading quietly rewrites the
 * agent's entire prompt. Nothing else in the stack would catch that, so it is asserted here
 * against the real files in prompts/.
 *
 *   npm run check:prompt
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { reassemble, splitSections } from '@/lib/promptSections';

const PROMPTS = join(process.cwd(), '..', 'prompts');

let fail = 0;
const check = (label: string, ok: boolean, detail = '') => {
  if (!ok) fail += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${label}${detail ? '  ' + detail : ''}`);
};

const files = readdirSync(PROMPTS).filter((f) => f.endsWith('.md'));
if (files.length === 0) {
  console.log('No prompts found — is this running from frontend/?');
  process.exit(1);
}

for (const file of files) {
  const prompt = readFileSync(join(PROMPTS, file), 'utf8');
  const sections = splitSections(prompt);

  console.log(`\n=== ${file} (${prompt.length} chars, ${sections.length} sections) ===`);

  check('splits into more than one section', sections.length > 1, `${sections.length}`);
  check('no section title is empty', sections.every((s) => s.title.length > 0));

  // The bodies plus the heading lines must account for every line, with no gaps or overlaps.
  const lineCount = prompt.split('\n').length;
  let covered = true;
  sections.forEach((section, index) => {
    const expectedStart = index === 0 ? 1 : sections[index - 1].bodyEnd + 2;
    if (section.bodyStart !== expectedStart) covered = false;
  });
  check('section ranges tile the document', covered);
  check('last section reaches the end', sections[sections.length - 1].bodyEnd === lineCount - 1);

  // The property that matters: no edits must round-trip byte-for-byte.
  const identity = reassemble(prompt, sections, new Map());
  check('round trip with no edits is byte-identical', identity === prompt,
    identity === prompt ? '' : `${identity.length} vs ${prompt.length} chars`);

  // Editing one section must leave every other byte alone.
  const target = Math.min(2, sections.length - 1);
  const edited = reassemble(prompt, sections, new Map([[target, 'REPLACED BODY']]));
  const reparsed = splitSections(edited);
  check(`editing "${sections[target].title}" keeps the other titles`,
    reparsed.length === sections.length &&
      reparsed.every((s, i) => s.title === sections[i].title));
  check('the edit landed in the right section', reparsed[target].body === 'REPLACED BODY',
    JSON.stringify(reparsed[target].body.slice(0, 30)));
  check('untouched sections are unchanged',
    reparsed.every((s, i) => i === target || s.body === sections[i].body));

  // A multi-line edit must not shift the ranges of later sections.
  const multi = reassemble(prompt, sections, new Map([[0, 'line one\nline two\nline three']]));
  const multiParsed = splitSections(multi);
  check('multi-line edit preserves later sections',
    multiParsed.length === sections.length &&
      multiParsed.slice(1).every((s, i) => s.body === sections[i + 1].body));

  // Two simultaneous edits, which is what "expand all and type" produces.
  if (sections.length >= 3) {
    const both = reassemble(prompt, sections, new Map([[0, 'AAA'], [2, 'BBB\nCCC']]));
    const bothParsed = splitSections(both);
    check('two edits at once both land',
      bothParsed[0].body === 'AAA' && bothParsed[2].body === 'BBB\nCCC');
    check('two edits leave the rest intact',
      bothParsed.every((s, i) => i === 0 || i === 2 || s.body === sections[i].body));
  }
}

console.log(fail === 0 ? '\nPROMPT SECTION CHECKS PASSED' : `\nPROMPT SECTION CHECKS FAILED (${fail})`);
process.exit(fail === 0 ? 0 : 1);
