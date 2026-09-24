/**
 * System prompt viewer and editor.
 *
 * Opens when a character is clicked. The prompts are the substance of the whole simulation — the
 * Developer's alone is 15.5k characters — and were previously only visible by opening files in
 * the repository.
 *
 * Rendered as collapsible section bars: these documents have a clean heading structure, so
 * collapsing to the outline makes a 15k-character prompt skimmable. Everything starts closed.
 *
 * Editing is per section and applies live — agents read their prompt at call time, so a saved
 * edit changes the next task with no restart. Edits live in the server process only; the files in
 * prompts/ stay the source of truth and "revert" reloads from them.
 *
 * Sections are tracked by line range, so saving a single section leaves every other byte of the
 * document untouched rather than reformatting the whole prompt.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Brain,
  Check,
  ChevronRight,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCcw,
  Undo2,
  X,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { ACCENT } from '@/assets/materials';
import { appearanceFor } from './character/appearance';
import type { AgentRole } from '@/types';
import { reassemble, splitSections } from '@/lib/promptSections';

interface PromptResponse {
  agent_id: string;
  role: AgentRole;
  characters: number;
  prompt: string;
  modified: boolean;
}

const cache = new Map<string, PromptResponse>();

export function SystemPromptPanel() {
  const selectedAgent = useAppStore((state) => state.selectedAgent);
  const selectAgent = useAppStore((state) => state.selectAgent);
  const agents = useAppStore((state) => state.agents);

  const [data, setData] = useState<PromptResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [drafts, setDrafts] = useState<Map<number, string>>(new Map());
  const bodyRef = useRef<HTMLDivElement>(null);

  const apply = (payload: PromptResponse) => {
    cache.set(payload.agent_id, payload);
    setData(payload);
    setDrafts(new Map());
  };

  useEffect(() => {
    if (!selectedAgent) {
      setData(null);
      setError(null);
      return;
    }

    setOpen(new Set());
    setDrafts(new Map());
    bodyRef.current?.scrollTo({ top: 0 });

    const cached = cache.get(selectedAgent);
    if (cached) {
      setData(cached);
      setError(null);
      return;
    }

    // Guards against a stale response landing after the user selected someone else.
    let active = true;
    setLoading(true);
    setError(null);

    fetch(`/api/agents/${selectedAgent}/prompt`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return (await response.json()) as PromptResponse;
      })
      .then((payload) => {
        if (!active) return;
        cache.set(payload.agent_id, payload);
        setData(payload);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Request failed');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedAgent]);

  const sections = useMemo(() => (data ? splitSections(data.prompt) : []), [data]);
  const dirty = drafts.size > 0;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Never close out from under unsaved edits.
      if (event.key === 'Escape' && !dirty) selectAgent(undefined);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectAgent, dirty]);

  if (!selectedAgent) return null;

  const agent = agents[selectedAgent];
  const role = (agent?.role ?? data?.role ?? 'ceo') as AgentRole;
  const accent = ACCENT[role];
  const name = appearanceFor(role).name;
  const allOpen = sections.length > 0 && open.size === sections.length;

  const toggle = (index: number) => {
    setOpen((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const edit = (index: number, value: string) => {
    setDrafts((previous) => {
      const next = new Map(previous);
      if (value === sections[index].body) next.delete(index);
      else next.set(index, value);
      return next;
    });
  };

  const send = async (url: string, init?: RequestInit) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(url, init);
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.detail ?? `HTTP ${response.status}`);
      }
      apply((await response.json()) as PromptResponse);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (!data) return;
    void send(`/api/agents/${data.agent_id}/prompt`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: reassemble(data.prompt, sections, drafts) }),
    });
  };

  const revert = () => {
    if (!data) return;
    void send(`/api/agents/${data.agent_id}/prompt/reset`, { method: 'POST' });
  };

  const iconButton =
    'rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100 disabled:opacity-40';

  return (
    <div className="absolute top-24 right-8 z-40 flex w-[26rem] max-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/90 shadow-2xl backdrop-blur-xl">
      <header className="flex items-center gap-2.5 border-b border-slate-800/50 px-4 py-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${accent}22`, color: accent }}
        >
          <Brain size={20} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 truncate text-sm font-semibold text-slate-100">
            {name}
            <span className="text-xs font-normal uppercase tracking-wide" style={{ color: accent }}>
              {role}
            </span>
            {data?.modified && !dirty && (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-400">
                edited
              </span>
            )}
            {dirty && (
              <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-sky-400">
                unsaved
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400">
            {data ? `${data.characters.toLocaleString()} chars · ${sections.length} sections` : 'System prompt'}
          </div>
        </div>

        {dirty ? (
          <>
            <button type="button" onClick={save} disabled={saving} className={iconButton} title="Save and apply">
              {saving ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Check size={16} style={{ color: accent }} />
              )}
            </button>
            <button
              type="button"
              onClick={() => setDrafts(new Map())}
              disabled={saving}
              className={iconButton}
              title="Discard unsaved edits"
            >
              <Undo2 size={15} />
            </button>
          </>
        ) : (
          <>
            {data?.modified && (
              <button
                type="button"
                onClick={revert}
                disabled={saving}
                className={iconButton}
                title="Reload from prompts/ on disk"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
              </button>
            )}
            {sections.length > 0 && (
              <button
                type="button"
                onClick={() => setOpen(allOpen ? new Set() : new Set(sections.map((_, i) => i)))}
                className={iconButton}
                title={allOpen ? 'Collapse all' : 'Expand all'}
              >
                {allOpen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
            )}
          </>
        )}
        <button
          type="button"
          onClick={() => selectAgent(undefined)}
          disabled={dirty}
          className={iconButton}
          title={dirty ? 'Save or discard your edits first' : 'Close'}
        >
          <X size={16} />
        </button>
      </header>

      <div ref={bodyRef} className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-400">
            <Loader2 size={15} className="animate-spin" />
            Loading prompt…
          </div>
        )}

        {error && (
          <div className="m-3 rounded-lg border border-rose-800 bg-rose-950/50 px-3 py-2 text-sm text-rose-300">
            {error}
            <div className="mt-1 text-xs text-rose-400/80">Is the backend running on port 8000?</div>
          </div>
        )}

        {sections.map((section, index) => {
          const isOpen = open.has(index);
          const draft = drafts.get(index);
          const value = draft ?? section.body;
          const chars = value.trim().length;
          return (
            <div key={`${section.title}-${section.bodyStart}`} className="border-b border-slate-800/40 last:border-b-0">
              <button
                type="button"
                onClick={() => toggle(index)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-slate-800/50"
              >
                <ChevronRight
                  size={14}
                  className={`shrink-0 text-slate-500 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
                />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-200">
                  {section.title}
                </span>
                {draft !== undefined && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" title="Edited" />
                )}
                <span className="shrink-0 font-mono text-[10px] text-slate-500">
                  {chars > 999 ? `${(chars / 1000).toFixed(1)}k` : chars}
                </span>
              </button>

              {isOpen && (
                <div className="border-l-2 px-3 pb-3" style={{ borderLeftColor: `${accent}55` }}>
                  <textarea
                    value={value}
                    onChange={(event) => edit(index, event.target.value)}
                    spellCheck={false}
                    rows={Math.min(26, value.split('\n').length + 1)}
                    className="w-full resize-y rounded-md border border-slate-800 bg-slate-950/60 px-2.5 py-2 font-mono text-[10.5px] leading-relaxed text-slate-300 outline-none transition focus:border-slate-600"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <footer className="border-t border-slate-800/50 px-4 py-2 text-[10px] text-slate-500">
        {dirty
          ? 'Unsaved edits · save to apply to the next task'
          : 'Edits apply live, in memory only · revert reloads prompts/'}
      </footer>
    </div>
  );
}
