'use client';

import { useTheme } from 'next-themes';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Bell, BellOff } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

// ─── Theme application (mirrors Svelte applyTheme) ───────────────────────────

type ThemePreset = { classes: string[]; meta: string };

const THEME_PRESETS: Record<string, ThemePreset> = {
  dark:             { classes: ['dark', 'bodhion-dark'],     meta: '#0b1220' },
  'bodhion-light':   { classes: ['light', 'bodhion-light'],   meta: '#f5f9fc' },
  'bodhion-midnight':{ classes: ['dark', 'bodhion-midnight'], meta: '#050814' },
  system:           { classes: [],                          meta: '#0b1220' },
};

function applyTheme(themeId: string) {
  // Resolve 'system' to the OS preference
  let resolved = themeId;
  if (themeId === 'system') {
    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'bodhion-light';
  }
  const preset = THEME_PRESETS[resolved] ?? THEME_PRESETS['dark'];

  // Remove all theme classes then add the correct ones
  document.documentElement.classList.remove('dark', 'light', 'bodhion-dark', 'bodhion-light', 'bodhion-midnight');
  preset.classes.forEach((c) => document.documentElement.classList.add(c));

  // Update meta theme-color
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', preset.meta);

  // Persist to localStorage (same key as Svelte app)
  localStorage.setItem('theme', themeId);
}

// ─── Language list ────────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: 'en-US', title: 'English (US)' },
  { code: 'en-GB', title: 'English (GB)' },
  { code: 'ar', title: 'Arabic (العربية)' },
  { code: 'ar-BH', title: 'Arabic (Bahrain)' },
  { code: 'eu-ES', title: 'Basque (Euskara)' },
  { code: 'bn-BD', title: 'Bengali (বাংলা)' },
  { code: 'bs-BA', title: 'Bosanski Latinica' },
  { code: 'bo-TB', title: 'Tibetan (བོད)' },
  { code: 'bg-BG', title: 'Bulgarian (български)' },
  { code: 'ca-ES', title: 'Catalan (català)' },
  { code: 'ceb-PH', title: 'Cebuano (Filipino)' },
  { code: 'hr-HR', title: 'Croatian (Hrvatski)' },
  { code: 'cs-CZ', title: 'Czech (čeština)' },
  { code: 'da-DK', title: 'Danish (Denmark)' },
  { code: 'nl-NL', title: 'Dutch (Netherlands)' },
  { code: 'et-EE', title: 'Estonian (Eesti)' },
  { code: 'fi-FI', title: 'Finnish (Suomalainen)' },
  { code: 'fr-CA', title: 'French (Canada)' },
  { code: 'fr-FR', title: 'French (France)' },
  { code: 'gl-ES', title: 'Galician (Galego)' },
  { code: 'ka-GE', title: 'Georgian (ქართული)' },
  { code: 'de-DE', title: 'German (Deutsch)' },
  { code: 'el-GR', title: 'Greek (Ἑλλάδα)' },
  { code: 'he-IL', title: 'Hebrew (עברית)' },
  { code: 'hi-IN', title: 'Hindi (हिंदी)' },
  { code: 'hu-HU', title: 'Hungarian (Magyar)' },
  { code: 'id-ID', title: 'Indonesian (Bahasa Indonesia)' },
  { code: 'ie-GA', title: 'Irish (Gaeilge)' },
  { code: 'it-IT', title: 'Italian (Italiano)' },
  { code: 'ja-JP', title: 'Japanese (日本語)' },
  { code: 'kab-DZ', title: 'Kabyle (Taqbaylit)' },
  { code: 'ko-KR', title: 'Korean (한국어)' },
  { code: 'lt-LT', title: 'Lithuanian (Lietuvių)' },
  { code: 'lv-LV', title: 'Latvian (Latviešu)' },
  { code: 'ms-MY', title: 'Malay (Bahasa Malaysia)' },
  { code: 'nb-NO', title: 'Norwegian Bokmål (Norway)' },
  { code: 'fa-IR', title: 'Persian (فارسی)' },
  { code: 'pl-PL', title: 'Polish (Polski)' },
  { code: 'pt-BR', title: 'Portuguese (Brazil)' },
  { code: 'pt-PT', title: 'Portuguese (Portugal)' },
  { code: 'pa-IN', title: 'Punjabi (India)' },
  { code: 'ro-RO', title: 'Romanian (Romania)' },
  { code: 'ru-RU', title: 'Russian (Russia)' },
  { code: 'sr-RS', title: 'Serbian (Српски)' },
  { code: 'sk-SK', title: 'Slovak (Slovenčina)' },
  { code: 'es-ES', title: 'Spanish (Español)' },
  { code: 'sv-SE', title: 'Swedish (Svenska)' },
  { code: 'th-TH', title: 'Thailand (ไทย)' },
  { code: 'tr-TR', title: 'Turkish (Türkçe)' },
  { code: 'tk-TM', title: 'Turkmen (Türkmençe)' },
  { code: 'uk-UA', title: 'Ukrainian (Українська)' },
  { code: 'ur-PK', title: 'Urdu (اردو)' },
  { code: 'ug-CN', title: 'Uyghur (ئۇيغۇرچە)' },
  { code: 'uz-Cyrl-UZ', title: 'Uzbek (Cyrillic)' },
  { code: 'uz-Latn-UZ', title: 'Uzbek (Latin)' },
  { code: 'vi-VN', title: 'Vietnamese (Tiếng Việt)' },
  { code: 'zh-CN', title: 'Chinese (简体中文)' },
  { code: 'zh-TW', title: 'Chinese (繁體中文)' },
];

// ─── Theme options ────────────────────────────────────────────────────────────

const THEME_OPTIONS = [
  {
    id: 'system',
    label: 'System',
    description: 'Automatically switch between Bodhion dark and light based on your device.',
    previewVariant: 'system' as const,
  },
  {
    id: 'dark',
    label: 'Bodhion Dark',
    description: 'Deep navy glass surfaces with cyan and lime highlights.',
    previewVariant: 'dark' as const,
  },
  {
    id: 'bodhion-light',
    label: 'Bodhion Light',
    description: 'Logo-inspired light surfaces with blue, green, and soft cloud accents.',
    previewVariant: 'light' as const,
  },
  {
    id: 'bodhion-midnight',
    label: 'Bodhion Midnight',
    description: 'A richer, higher-contrast command-center take on the dark theme.',
    previewVariant: 'midnight' as const,
  },
];

// ─── Advanced parameters ──────────────────────────────────────────────────────

type AdvParams = {
  stream_response: boolean | null;
  temperature: number | null;
  seed: number | null;
  stop: string | null;
  top_k: number | null;
  top_p: number | null;
  min_p: number | null;
  max_tokens: number | null;
  frequency_penalty: number | null;
  presence_penalty: number | null;
  repeat_penalty: number | null;
  repeat_last_n: number | null;
  mirostat: number | null;
  mirostat_eta: number | null;
  mirostat_tau: number | null;
  tfs_z: number | null;
  num_ctx: number | null;
  num_batch: number | null;
  num_keep: number | null;
  num_gpu: number | null;
};

const DEFAULT_PARAMS: AdvParams = {
  stream_response: null, temperature: null, seed: null, stop: null,
  top_k: null, top_p: null, min_p: null, max_tokens: null,
  frequency_penalty: null, presence_penalty: null, repeat_penalty: null, repeat_last_n: null,
  mirostat: null, mirostat_eta: null, mirostat_tau: null, tfs_z: null,
  num_ctx: null, num_batch: null, num_keep: null, num_gpu: null,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ThemePreview({ variant }: { variant: 'system' | 'dark' | 'light' | 'midnight' }) {
  return (
    <div className={`theme-card-preview theme-card-preview--${variant}`} aria-hidden>
      <div className="theme-card-preview__badge" />
      <div className="theme-card-preview__bar" />
      <div className="theme-card-preview__tiles">
        <span /><span /><span />
      </div>
    </div>
  );
}

interface ParamRowProps {
  label: string;
  description?: string;
  value: number | null;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number | null) => void;
}

function ParamRow({ label, description, value, min, max, step = 0.01, onChange }: ParamRowProps) {
  const isCustom = value !== null;
  return (
    <div className="adv-param-row">
      <div className="adv-param-header">
        <div>
          <div className="adv-param-label">{label}</div>
          {description && <div className="adv-param-desc">{description}</div>}
        </div>
        <button
          type="button"
          className={`adv-param-toggle${isCustom ? ' adv-param-toggle--active' : ''}`}
          onClick={() => onChange(isCustom ? null : (min + max) / 2)}
        >
          {isCustom ? 'Custom' : 'Default'}
        </button>
      </div>
      {isCustom && (
        <div className="adv-param-input-row">
          <input
            type="range"
            className="adv-param-slider"
            min={min} max={max} step={step} value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
          />
          <input
            type="number"
            className="adv-param-number"
            min={min} max={max} step={step} value={value}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  onRegisterSave: (fn: () => Promise<void>) => void;
}

export function GeneralTab({ onRegisterSave }: Props) {
  const { theme, setTheme } = useTheme();
  const user = useAuthStore((s) => s.user);

  const [selectedTheme, setSelectedTheme] = useState(theme ?? 'system');
  const [lang, setLang] = useState('en-US');
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [params, setParams] = useState<AdvParams>({ ...DEFAULT_PARAMS });

  // Always-current ref — updated synchronously on every render.
  // The save handler reads from this so it never captures stale state.
  const latestRef = useRef({ selectedTheme, lang, notificationEnabled, systemPrompt, params });
  latestRef.current = { selectedTheme, lang, notificationEnabled, systemPrompt, params };

  // Load saved settings once on mount
  useEffect(() => {
    const stored = localStorage.getItem('bodhion-general-settings');
    if (stored) {
      try {
        const p = JSON.parse(stored) as {
          notificationEnabled?: boolean;
          systemPrompt?: string;
          params?: Partial<AdvParams>;
          lang?: string;
        };
        if (p.notificationEnabled !== undefined) setNotificationEnabled(p.notificationEnabled);
        if (p.systemPrompt !== undefined) setSystemPrompt(p.systemPrompt);
        if (p.params) setParams((prev) => ({ ...prev, ...p.params }));
        if (p.lang) setLang(p.lang);
      } catch { /* ignore */ }
    } else {
      // Fallback: read locale from storage
      const storedLang = localStorage.getItem('locale');
      if (storedLang) setLang(storedLang);
    }
  }, []); // runs once

  // Sync local selectedTheme when next-themes resolves
  useEffect(() => {
    if (theme && theme !== selectedTheme) setSelectedTheme(theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]); // intentionally exclude selectedTheme to avoid loop

  // Register save handler ONCE — reads latest values via ref
  useEffect(() => {
    onRegisterSave(async () => {
      const { selectedTheme: t, lang: l, notificationEnabled: n, systemPrompt: s, params: pa } = latestRef.current;
      // Apply theme directly to DOM (mirrors Svelte applyTheme) + sync next-themes
      applyTheme(t);
      setTheme(t);
      localStorage.setItem('locale', l);
      localStorage.setItem('bodhion-general-settings', JSON.stringify({ notificationEnabled: n, systemPrompt: s, params: pa, lang: l }));
    });
  // onRegisterSave and setTheme are stable refs; latestRef is a ref so it's stable too
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterSave, setTheme]);

  const toggleNotification = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'denied') {
      alert('Notifications are blocked. Please update your browser site permissions.');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setNotificationEnabled((v) => !v);
    } else {
      alert('Notification permission was not granted. Please allow notifications in your browser settings.');
    }
  }, []);

  const setParam = useCallback(<K extends keyof AdvParams>(key: K, val: AdvParams[K]) => {
    setParams((p) => ({ ...p, [key]: val }));
  }, []);

  const chatPerms = user?.permissions?.chat as Record<string, unknown> | undefined;
  const canSeeSystemPrompt =
    user?.role === 'admin' ||
    ((chatPerms?.controls ?? true) && chatPerms?.system_prompt !== false);
  const canSeeAdvanced =
    user?.role === 'admin' ||
    ((chatPerms?.controls ?? true) && chatPerms?.params !== false);

  return (
    <div className="settings-tab-content">
      {/* ── WebUI Settings ── */}
      <div className="settings-section">
        <div className="settings-section-title">WebUI Settings</div>

        {/* Theme */}
        <div className="gen-subsection">
          <div className="gen-field-label">Theme</div>
          <div className="theme-card-grid">
            {THEME_OPTIONS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`theme-card${selectedTheme === t.id ? ' theme-card--active' : ''}`}
                onClick={() => setSelectedTheme(t.id)}
                aria-pressed={selectedTheme === t.id}
              >
                <ThemePreview variant={t.previewVariant} />
                <div className="theme-card-copy">
                  <div className="theme-card__label">{t.label}</div>
                  <div className="theme-card__desc">{t.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <div className="gen-row">
          <div className="gen-field-label" style={{ marginBottom: 0 }}>Language</div>
          <select
            className="gen-select"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.title}</option>
            ))}
          </select>
        </div>
        {lang === 'en-US' && (
          <div className="gen-help-text">
            {`Couldn't find your language? `}
            <a
              className="settings-link"
              href="https://github.com/open-webui/open-webui/blob/main/docs/CONTRIBUTING.md#-translations-and-internationalization"
              target="_blank"
              rel="noreferrer"
            >
              Help us translate Open WebUI!
            </a>
          </div>
        )}

        {/* Notifications */}
        <div className="gen-row">
          <div className="gen-field-label" style={{ marginBottom: 0 }}>Notifications</div>
          <button
            type="button"
            className={`gen-toggle-btn${notificationEnabled ? ' gen-toggle-btn--on' : ''}`}
            onClick={() => void toggleNotification()}
            role="switch"
            aria-checked={notificationEnabled}
          >
            {notificationEnabled
              ? <><Bell className="h-3.5 w-3.5" /><span>On</span></>
              : <><BellOff className="h-3.5 w-3.5" /><span>Off</span></>
            }
          </button>
        </div>
      </div>

      {/* ── System Prompt ── */}
      {canSeeSystemPrompt && (
        <div className="settings-section">
          <div className="settings-section-title">System Prompt</div>
          <div className="settings-section-desc">Default system prompt applied to all new chats.</div>
          <textarea
            className="settings-input settings-textarea gen-system-prompt"
            rows={4}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Enter system prompt here"
          />
        </div>
      )}

      {/* ── Advanced Parameters ── */}
      {canSeeAdvanced && (
        <div className="settings-section">
          <div className="gen-row" style={{ paddingTop: 0, paddingBottom: 0 }}>
            <div className="settings-section-title" style={{ marginBottom: 0 }}>Advanced Parameters</div>
            <button
              type="button"
              className="settings-toggle-btn"
              onClick={() => setShowAdvanced((v) => !v)}
              aria-expanded={showAdvanced}
            >
              {showAdvanced
                ? <><ChevronUp className="h-3.5 w-3.5" /><span>Hide</span></>
                : <><ChevronDown className="h-3.5 w-3.5" /><span>Show</span></>
              }
            </button>
          </div>

          {showAdvanced && (
            <div className="adv-params-body">
              {/* Stream response */}
              <div className="adv-param-row">
                <div className="adv-param-header">
                  <div>
                    <div className="adv-param-label">Stream Response</div>
                    <div className="adv-param-desc">Enable real-time streaming of model output.</div>
                  </div>
                  <select
                    className="gen-select gen-select--sm"
                    value={params.stream_response === null ? 'default' : params.stream_response ? 'on' : 'off'}
                    onChange={(e) => {
                      const v = e.target.value;
                      setParam('stream_response', v === 'default' ? null : v === 'on');
                    }}
                  >
                    <option value="default">Default</option>
                    <option value="on">On</option>
                    <option value="off">Off</option>
                  </select>
                </div>
              </div>

              <ParamRow label="Temperature" description="Controls randomness. Higher = more creative."
                value={params.temperature} min={0} max={2} step={0.05} onChange={(v) => setParam('temperature', v)} />
              <ParamRow label="Top-P" description="Nucleus sampling threshold."
                value={params.top_p} min={0} max={1} step={0.01} onChange={(v) => setParam('top_p', v)} />
              <ParamRow label="Top-K" description="Limits token pool per step."
                value={params.top_k} min={0} max={1000} step={1} onChange={(v) => setParam('top_k', v)} />
              <ParamRow label="Min-P" description="Alternative to Top-P; filters low-probability tokens."
                value={params.min_p} min={0} max={1} step={0.01} onChange={(v) => setParam('min_p', v)} />
              <ParamRow label="Max Tokens" description="Maximum response length in tokens."
                value={params.max_tokens} min={1} max={131072} step={1} onChange={(v) => setParam('max_tokens', v)} />
              <ParamRow label="Frequency Penalty" description="Penalizes tokens based on usage frequency."
                value={params.frequency_penalty} min={-2} max={2} step={0.05} onChange={(v) => setParam('frequency_penalty', v)} />
              <ParamRow label="Presence Penalty" description="Flat penalty for any token that has appeared."
                value={params.presence_penalty} min={-2} max={2} step={0.05} onChange={(v) => setParam('presence_penalty', v)} />
              <ParamRow label="Repeat Penalty" description="Controls token sequence repetition."
                value={params.repeat_penalty} min={-2} max={2} step={0.05} onChange={(v) => setParam('repeat_penalty', v)} />
              <ParamRow label="Repeat Last N" description="Lookback window for repeat penalty."
                value={params.repeat_last_n} min={-1} max={128} step={1} onChange={(v) => setParam('repeat_last_n', v)} />
              <ParamRow label="Seed" description="Fixed seed for reproducible outputs."
                value={params.seed} min={0} max={2147483647} step={1} onChange={(v) => setParam('seed', v)} />

              {/* Stop sequences */}
              <div className="adv-param-row">
                <div className="adv-param-header">
                  <div>
                    <div className="adv-param-label">Stop Sequences</div>
                    <div className="adv-param-desc">Comma-separated tokens that stop generation.</div>
                  </div>
                  <button
                    type="button"
                    className={`adv-param-toggle${params.stop !== null ? ' adv-param-toggle--active' : ''}`}
                    onClick={() => setParam('stop', params.stop !== null ? null : '')}
                  >
                    {params.stop !== null ? 'Custom' : 'Default'}
                  </button>
                </div>
                {params.stop !== null && (
                  <input
                    type="text"
                    className="settings-input adv-param-text-input"
                    placeholder="e.g.  <end>,</s>"
                    value={params.stop}
                    onChange={(e) => setParam('stop', e.target.value)}
                  />
                )}
              </div>

              <ParamRow label="Mirostat" description="Adaptive sampling mode (0 = off, 1, 2)."
                value={params.mirostat} min={0} max={2} step={1} onChange={(v) => setParam('mirostat', v)} />
              <ParamRow label="Mirostat ETA" description="Learning rate for Mirostat."
                value={params.mirostat_eta} min={0} max={1} step={0.01} onChange={(v) => setParam('mirostat_eta', v)} />
              <ParamRow label="Mirostat TAU" description="Coherence target for Mirostat."
                value={params.mirostat_tau} min={0} max={10} step={0.1} onChange={(v) => setParam('mirostat_tau', v)} />
              <ParamRow label="TFS-Z" description="Tail-free sampling strength."
                value={params.tfs_z} min={0} max={2} step={0.05} onChange={(v) => setParam('tfs_z', v)} />
              <ParamRow label="Context Length (num_ctx)" description="Context window size in tokens."
                value={params.num_ctx} min={512} max={131072} step={512} onChange={(v) => setParam('num_ctx', v)} />
              <ParamRow label="Batch Size (num_batch)" description="Prompt processing batch size."
                value={params.num_batch} min={256} max={8192} step={256} onChange={(v) => setParam('num_batch', v)} />
              <ParamRow label="Keep Tokens (num_keep)" description="Tokens kept from prompt for context shift."
                value={params.num_keep} min={-1} max={10240000} step={1} onChange={(v) => setParam('num_keep', v)} />
              <ParamRow label="GPU Layers (num_gpu)" description="Number of model layers offloaded to GPU."
                value={params.num_gpu} min={0} max={256} step={1} onChange={(v) => setParam('num_gpu', v)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
