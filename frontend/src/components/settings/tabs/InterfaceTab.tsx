'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils/cn';

// ── Types & defaults ──────────────────────────────────────────────────────────

interface InterfaceSettings {
  widescreenMode: boolean;
  chatBubble: boolean;
  showUsername: boolean;
  chatDirection: 'LTR' | 'RTL' | 'auto';
  titleAutoGenerate: boolean;
  autoFollowUps: boolean;
  chatFadeStreamingText: boolean;
  collapseCodeBlocks: boolean;
  expandDetails: boolean;
  renderMarkdownInPreviews: boolean;
  detectArtifacts: boolean;
  displayMultiModelTabs: boolean;
  responseAutoCopy: boolean;
  ctrlEnterToSend: boolean;
  richTextInput: boolean;
  largeTextAsFile: boolean;
  copyFormatted: boolean;
}

const DEFAULTS: InterfaceSettings = {
  widescreenMode: false,
  chatBubble: true,
  showUsername: false,
  chatDirection: 'auto',
  titleAutoGenerate: true,
  autoFollowUps: true,
  chatFadeStreamingText: true,
  collapseCodeBlocks: false,
  expandDetails: false,
  renderMarkdownInPreviews: true,
  detectArtifacts: true,
  displayMultiModelTabs: false,
  responseAutoCopy: false,
  ctrlEnterToSend: false,
  richTextInput: true,
  largeTextAsFile: false,
  copyFormatted: false,
};

function loadSettings(): InterfaceSettings {
  try {
    const stored = localStorage.getItem('bodhion-interface-settings');
    if (stored) return { ...DEFAULTS, ...JSON.parse(stored) };
  } catch {}
  return { ...DEFAULTS };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn('iface-toggle', checked && 'iface-toggle--on')}
    >
      <span className="iface-toggle-thumb" />
    </button>
  );
}

function BtnGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="iface-btn-group">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn('iface-btn-group-item', value === opt.value && 'iface-btn-group-item--active')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Row({
  label,
  description,
  children,
  indent,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  indent?: boolean;
}) {
  return (
    <div className={cn('iface-row', indent && 'iface-row--indent')}>
      <div className="iface-row-text">
        <span className="iface-row-label">{label}</span>
        {description && <span className="iface-row-desc">{description}</span>}
      </div>
      <div className="iface-row-control">{children}</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function InterfaceTab({ onRegisterSave }: { onRegisterSave: (fn: () => Promise<void>) => void }) {
  const [s, setS] = useState<InterfaceSettings>(DEFAULTS);

  // Load persisted settings on mount
  useEffect(() => {
    setS(loadSettings());
  }, []);

  const set = useCallback(<K extends keyof InterfaceSettings>(key: K, val: InterfaceSettings[K]) => {
    setS((prev) => ({ ...prev, [key]: val }));
  }, []);

  // Latest-ref pattern — save handler registered once, reads current state from ref
  const latestRef = useRef(s);
  latestRef.current = s;

  useEffect(() => {
    onRegisterSave(async () => {
      localStorage.setItem('bodhion-interface-settings', JSON.stringify(latestRef.current));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterSave]);

  return (
    <div className="settings-tab-content">

      {/* ── Section 1: Layout & Display ─────────────────────────── */}
      <div className="settings-section">
        <div className="settings-section-title">Layout &amp; Display</div>

        <Row label="Widescreen Mode" description="Expand the chat area to use more horizontal space.">
          <Toggle checked={s.widescreenMode} onChange={(v) => set('widescreenMode', v)} />
        </Row>

        <Row label="Chat Bubble UI" description="Display messages in speech-bubble style instead of a flat list.">
          <Toggle checked={s.chatBubble} onChange={(v) => set('chatBubble', v)} />
        </Row>

        {!s.chatBubble && (
          <Row label={'Show username instead of \u201cYou\u201d'} indent>
            <Toggle checked={s.showUsername} onChange={(v) => set('showUsername', v)} />
          </Row>
        )}

        <Row label="Chat Direction" description="Text direction for messages.">
          <BtnGroup
            options={[
              { label: 'LTR', value: 'LTR' },
              { label: 'RTL', value: 'RTL' },
              { label: 'Auto', value: 'auto' },
            ]}
            value={s.chatDirection}
            onChange={(v) => set('chatDirection', v)}
          />
        </Row>
      </div>

      {/* ── Section 2: Chat Behaviour ────────────────────────────── */}
      <div className="settings-section">
        <div className="settings-section-title">Chat Behaviour</div>

        <Row label="Title Auto-Generation" description="Automatically generate a title for new chats.">
          <Toggle checked={s.titleAutoGenerate} onChange={(v) => set('titleAutoGenerate', v)} />
        </Row>

        <Row label="Follow-Up Auto-Generation" description="Suggest follow-up prompts after each response.">
          <Toggle checked={s.autoFollowUps} onChange={(v) => set('autoFollowUps', v)} />
        </Row>

        <Row label="Fade Effect for Streaming Text" description="Gently fade in tokens while the model is responding.">
          <Toggle checked={s.chatFadeStreamingText} onChange={(v) => set('chatFadeStreamingText', v)} />
        </Row>

        <Row label="Render Markdown in Previews" description="Render markdown formatting in chat message previews.">
          <Toggle checked={s.renderMarkdownInPreviews} onChange={(v) => set('renderMarkdownInPreviews', v)} />
        </Row>

        <Row label="Always Collapse Code Blocks" description="Collapse code blocks by default; expand on click.">
          <Toggle checked={s.collapseCodeBlocks} onChange={(v) => set('collapseCodeBlocks', v)} />
        </Row>

        <Row label="Always Expand Details" description="Automatically expand collapsible detail sections.">
          <Toggle checked={s.expandDetails} onChange={(v) => set('expandDetails', v)} />
        </Row>

        <Row label="Detect Artifacts Automatically" description="Identify and render code artifacts inline.">
          <Toggle checked={s.detectArtifacts} onChange={(v) => set('detectArtifacts', v)} />
        </Row>

        <Row label="Multi-Model Responses in Tabs" description="Show responses from multiple models side-by-side in tabs.">
          <Toggle checked={s.displayMultiModelTabs} onChange={(v) => set('displayMultiModelTabs', v)} />
        </Row>

        <Row label="Auto-Copy Response to Clipboard" description="Automatically copy the latest response after it finishes.">
          <Toggle checked={s.responseAutoCopy} onChange={(v) => set('responseAutoCopy', v)} />
        </Row>
      </div>

      {/* ── Section 3: Input & Editing ───────────────────────────── */}
      <div className="settings-section">
        <div className="settings-section-title">Input &amp; Editing</div>

        <Row label="Enter Key Behaviour" description="Choose what pressing Enter does in the chat input.">
          <BtnGroup<'enter' | 'ctrl'>
            options={[
              { label: 'Enter to send', value: 'enter' },
              { label: 'Ctrl+Enter to send', value: 'ctrl' },
            ]}
            value={s.ctrlEnterToSend ? 'ctrl' : 'enter'}
            onChange={(v) => set('ctrlEnterToSend', v === 'ctrl')}
          />
        </Row>

        <Row label="Rich Text Input" description="Enable rich text formatting in the message composer.">
          <Toggle checked={s.richTextInput} onChange={(v) => set('richTextInput', v)} />
        </Row>

        <Row label="Paste Large Text as File" description="When pasting a large block of text, attach it as a file instead.">
          <Toggle checked={s.largeTextAsFile} onChange={(v) => set('largeTextAsFile', v)} />
        </Row>

        <Row label="Copy Formatted Text" description="Preserve markdown formatting when copying message text.">
          <Toggle checked={s.copyFormatted} onChange={(v) => set('copyFormatted', v)} />
        </Row>
      </div>

    </div>
  );
}
