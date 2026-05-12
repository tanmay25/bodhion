'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/Input';

// ── types ─────────────────────────────────────────────────────────────────────

interface Prerequisites {
  commands: string[];
  env: string[];
}

interface Frontmatter {
  name: string;
  description: string;
  version: string;
  author: string;
  license: string;
  homepage: string;
  tags: string[];
  prerequisites: Prerequisites;
}

// ── frontmatter parser ────────────────────────────────────────────────────────

function parseFrontmatter(mdText: string): { fm: Frontmatter; body: string } {
  const empty: Frontmatter = {
    name: '', description: '', version: '', author: '',
    license: '', homepage: '', tags: [],
    prerequisites: { commands: [], env: [] },
  };

  if (!mdText.startsWith('---')) return { fm: empty, body: mdText };

  const parts = mdText.split('---');
  if (parts.length < 3) return { fm: empty, body: mdText };

  const fm: Frontmatter = {
    ...empty,
    prerequisites: { commands: [], env: [] },
  };

  const yamlLines = parts[1].split('\n');

  type Section =
    | 'root'
    | 'tags'
    | 'prereqs'
    | 'prereq_commands'
    | 'prereq_env';

  let section: Section = 'root';

  for (const raw of yamlLines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Top-level key (no leading whitespace)
    const isTopLevel = /^[a-zA-Z]/.test(line);
    if (isTopLevel) section = 'root';

    // ── list item ────────────────────────────────────────────────────────────
    const listMatch = line.match(/^(\s*)-\s+(.+)$/);
    if (listMatch) {
      const value = listMatch[2].trim();
      if (section === 'tags')            { fm.tags.push(value); continue; }
      if (section === 'prereq_commands') { fm.prerequisites.commands.push(value); continue; }
      if (section === 'prereq_env')      { fm.prerequisites.env.push(value); continue; }
    }

    // ── indented sub-key (prerequisites children) ────────────────────────────
    if (section === 'prereqs') {
      const subKv = line.match(/^\s+(\w[\w-]*):\s*(.*)$/);
      if (subKv) {
        const [, key, val] = subKv;
        const v = val.trim();
        if (key === 'commands') {
          if (v.startsWith('[') && v.endsWith(']')) {
            fm.prerequisites.commands = v.slice(1, -1).split(',').map((t) => t.trim()).filter(Boolean);
          } else if (!v) {
            section = 'prereq_commands';
          }
        } else if (key === 'env') {
          if (v.startsWith('[') && v.endsWith(']')) {
            fm.prerequisites.env = v.slice(1, -1).split(',').map((t) => t.trim()).filter(Boolean);
          } else if (!v) {
            section = 'prereq_env';
          }
        }
        continue;
      }
    }

    // ── top-level key-value ───────────────────────────────────────────────────
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (!kv) continue;
    const [, key, val] = kv;
    const v = val.replace(/^["']|["']$/g, '').trim();

    switch (key) {
      case 'name':        fm.name        = v; break;
      case 'description': fm.description = v; break;
      case 'version':     fm.version     = v; break;
      case 'author':      fm.author      = v; break;
      case 'license':     fm.license     = v; break;
      case 'homepage':    fm.homepage    = v; break;
      case 'tags':
        if (v.startsWith('[') && v.endsWith(']')) {
          fm.tags = v.slice(1, -1).split(',').map((t) => t.trim()).filter(Boolean);
        } else if (!v) {
          section = 'tags';
        }
        break;
      case 'prerequisites':
        section = 'prereqs';
        break;
      // skip metadata/hermes nesting silently
    }
  }

  const body = parts.slice(2).join('---').trim();
  return { fm, body };
}

// ── assembler ─────────────────────────────────────────────────────────────────

function assembleSKILLmd(fm: Frontmatter, body: string): string {
  const lines: string[] = ['---'];

  if (fm.name)        lines.push(`name: ${fm.name}`);
  if (fm.description) lines.push(`description: "${fm.description.replace(/"/g, '\\"')}"`);
  if (fm.version)     lines.push(`version: ${fm.version}`);
  if (fm.author)      lines.push(`author: ${fm.author}`);
  if (fm.license)     lines.push(`license: ${fm.license}`);
  if (fm.homepage)    lines.push(`homepage: ${fm.homepage}`);

  if (fm.tags.length) {
    lines.push('tags:');
    fm.tags.forEach((t) => lines.push(`  - ${t}`));
  }

  const hasCmds = fm.prerequisites.commands.length > 0;
  const hasEnv  = fm.prerequisites.env.length > 0;
  if (hasCmds || hasEnv) {
    lines.push('prerequisites:');
    if (hasCmds) {
      lines.push('  commands:');
      fm.prerequisites.commands.forEach((c) => lines.push(`    - ${c}`));
    }
    if (hasEnv) {
      lines.push('  env:');
      fm.prerequisites.env.forEach((e) => lines.push(`    - ${e}`));
    }
  }

  lines.push('---', '', body.trim());
  return lines.join('\n');
}

// ── chip input helper ─────────────────────────────────────────────────────────

interface ChipInputProps {
  chips: string[];
  placeholder: string;
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
}

function ChipInput({ chips, placeholder, onAdd, onRemove }: ChipInputProps) {
  const [input, setInput] = useState('');

  const commit = (raw: string) => {
    const v = raw.trim();
    if (v && !chips.includes(v)) onAdd(v);
    setInput('');
  };

  return (
    <div className="flex flex-wrap gap-1.5 min-h-9 rounded-md border bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
      {chips.map((chip) => (
        <span
          key={chip}
          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium"
        >
          {chip}
          <button
            type="button"
            onClick={() => onRemove(chip)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Remove ${chip}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        placeholder={chips.length ? '' : placeholder}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commit(input);
          } else if (e.key === 'Backspace' && !input && chips.length) {
            onRemove(chips[chips.length - 1]);
          }
        }}
        onBlur={() => { if (input) commit(input); }}
      />
    </div>
  );
}

// ── component ─────────────────────────────────────────────────────────────────

interface Props {
  initialContent?: string;
  onChange: (assembled: string) => void;
  onFmChange?: (fm: { name: string; description: string }) => void;
}

export function SkillMarkdownEditor({ initialContent = '', onChange, onFmChange }: Props) {
  const parsed = useRef(parseFrontmatter(initialContent));

  const [fm, setFm] = useState<Frontmatter>(parsed.current.fm);
  const [body, setBody] = useState(parsed.current.body);

  const prevContent = useRef(initialContent);
  useEffect(() => {
    if (initialContent !== prevContent.current) {
      prevContent.current = initialContent;
      const p = parseFrontmatter(initialContent);
      setFm(p.fm);
      setBody(p.body);
    }
  }, [initialContent]);

  const notify = useCallback(
    (nextFm: Frontmatter, nextBody: string) => {
      onChange(assembleSKILLmd(nextFm, nextBody));
    },
    [onChange],
  );

  const updateFm = (patch: Partial<Frontmatter>) => {
    const next = { ...fm, ...patch };
    setFm(next);
    notify(next, body);
    if ('name' in patch || 'description' in patch) {
      onFmChange?.({ name: next.name, description: next.description });
    }
  };

  const updatePrereqs = (patch: Partial<Prerequisites>) => {
    updateFm({ prerequisites: { ...fm.prerequisites, ...patch } });
  };

  const updateBody = (val: string) => {
    setBody(val);
    notify(fm, val);
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="skill-md-editor flex flex-col gap-4 pb-2">

      {/* ── Frontmatter section ── */}
      <div className="rounded-md border bg-muted/30 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Skill Metadata (YAML frontmatter)
        </p>

        {/* Name */}
        <div className="skill-md-field">
          <label className="skill-md-label">
            Name <span className="text-red-400">*</span>
          </label>
          <Input
            placeholder="e.g. himalaya"
            value={fm.name}
            onChange={(e) => updateFm({ name: e.target.value })}
            maxLength={64}
          />
        </div>

        {/* Description */}
        <div className="skill-md-field">
          <label className="skill-md-label">
            Description <span className="text-red-400">*</span>
          </label>
          <Input
            placeholder="What this skill does and when to use it"
            value={fm.description}
            onChange={(e) => updateFm({ description: e.target.value })}
            maxLength={300}
          />
        </div>

        {/* Version + Author */}
        <div className="grid grid-cols-2 gap-3">
          <div className="skill-md-field">
            <label className="skill-md-label">Version</label>
            <Input
              placeholder="1.0.0"
              value={fm.version}
              onChange={(e) => updateFm({ version: e.target.value })}
              maxLength={20}
            />
          </div>
          <div className="skill-md-field">
            <label className="skill-md-label">Author</label>
            <Input
              placeholder="Your name or team"
              value={fm.author}
              onChange={(e) => updateFm({ author: e.target.value })}
              maxLength={80}
            />
          </div>
        </div>

        {/* License + Homepage */}
        <div className="grid grid-cols-2 gap-3">
          <div className="skill-md-field">
            <label className="skill-md-label">License</label>
            <Input
              placeholder="MIT"
              value={fm.license}
              onChange={(e) => updateFm({ license: e.target.value })}
              maxLength={40}
            />
          </div>
          <div className="skill-md-field">
            <label className="skill-md-label">Homepage</label>
            <Input
              placeholder="https://example.com"
              value={fm.homepage}
              onChange={(e) => updateFm({ homepage: e.target.value })}
              maxLength={200}
              type="url"
            />
          </div>
        </div>

        {/* Tags */}
        <div className="skill-md-field">
          <label className="skill-md-label">
            Tags
            <span className="ml-1 font-normal text-muted-foreground">— Enter or comma to add</span>
          </label>
          <ChipInput
            chips={fm.tags}
            placeholder="e.g. productivity, api, code-review"
            onAdd={(v) => updateFm({ tags: [...fm.tags, v] })}
            onRemove={(v) => updateFm({ tags: fm.tags.filter((t) => t !== v) })}
          />
        </div>

        {/* Prerequisites */}
        <div className="rounded-md border border-dashed bg-background/60 p-3 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Prerequisites
            <span className="ml-1 font-normal normal-case">
              (optional — tools or env vars this skill requires)
            </span>
          </p>

          <div className="skill-md-field">
            <label className="skill-md-label">
              Commands
              <span className="ml-1 font-normal text-muted-foreground">— CLI tools (e.g. himalaya, jq, curl)</span>
            </label>
            <ChipInput
              chips={fm.prerequisites.commands}
              placeholder="e.g. himalaya"
              onAdd={(v) => updatePrereqs({ commands: [...fm.prerequisites.commands, v] })}
              onRemove={(v) => updatePrereqs({ commands: fm.prerequisites.commands.filter((c) => c !== v) })}
            />
          </div>

          <div className="skill-md-field">
            <label className="skill-md-label">
              Environment Variables
              <span className="ml-1 font-normal text-muted-foreground">— required env vars (e.g. OPENAI_API_KEY)</span>
            </label>
            <ChipInput
              chips={fm.prerequisites.env}
              placeholder="e.g. OPENAI_API_KEY"
              onAdd={(v) => updatePrereqs({ env: [...fm.prerequisites.env, v] })}
              onRemove={(v) => updatePrereqs({ env: fm.prerequisites.env.filter((e) => e !== v) })}
            />
          </div>
        </div>
      </div>

      {/* ── Body editor ── */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <label className="skill-md-label">
            Skill Instructions
            <span className="ml-1 font-normal text-muted-foreground">(Markdown)</span>
          </label>
          <span className="text-xs text-muted-foreground">
            Body of your SKILL.md — describe what the agent should know and do.
          </span>
        </div>
        <textarea
          className="
            w-full min-h-[360px] resize-y rounded-md border bg-background
            px-3 py-2.5 font-mono text-sm leading-relaxed
            placeholder:text-muted-foreground
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          "
          placeholder={`# ${fm.name || 'Skill Name'}\n\nDescribe what the agent should do step by step.\n\n## Usage\n\n- When to invoke this skill\n- What context is needed\n\n## Instructions\n\n1. First step...\n2. Second step...`}
          value={body}
          onChange={(e) => updateBody(e.target.value)}
          spellCheck={false}
        />
      </div>

      {/* ── Live preview ── */}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
          Preview assembled SKILL.md
        </summary>
        <pre className="mt-2 rounded-md border bg-muted/50 p-3 overflow-x-auto whitespace-pre-wrap break-words text-xs font-mono">
          {assembleSKILLmd(fm, body)}
        </pre>
      </details>
    </div>
  );
}
