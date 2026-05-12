'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Volume2, Info } from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useAuthStore } from '@/store/authStore';
import { getToken } from '@/lib/auth/session';
import { updateUserSettings } from '@/lib/api/users';
import { getAudioVoices } from '@/lib/api/configs';
import { cn } from '@/lib/utils/cn';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="iface-row">
      <div className="iface-row-text">
        <span className="iface-row-label">{label}</span>
        {desc && <span className="iface-row-desc">{desc}</span>}
      </div>
      {children}
    </div>
  );
}

// Inline select that matches the style of other settings dropdowns
function SettingSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      className="audio-inline-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {children}
    </select>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function AudioTab({ onRegisterSave }: { onRegisterSave: (fn: () => Promise<void>) => void }) {
  const settings      = useWorkspaceStore((s) => s.settings);
  const patchSettings = useWorkspaceStore((s) => s.patchSettings);
  const config        = useAuthStore((s) => s.config);

  // Flatten stored nested audio structure for easy state management
  const sttStored = settings.audio?.stt as Record<string, unknown> | undefined;
  const ttsStored = settings.audio?.tts as Record<string, unknown> | undefined;

  // STT state
  const [sttEngine,   setSTTEngine]   = useState<string>((sttStored?.engine as string) ?? '');
  const [sttLanguage, setSTTLanguage] = useState<string>((sttStored?.language as string) ?? '');
  const [speechAutoSend, setSpeechAutoSend] = useState(settings.speechAutoSend ?? false);

  // TTS state
  const [ttsEngine,       setTTSEngine]       = useState<string>((ttsStored?.engine as string) ?? '');
  const [ttsEngineConfig, setTTSEngineConfig] = useState<Record<string, unknown>>((ttsStored?.engineConfig as Record<string, unknown>) ?? {});
  const [playbackRate,    setPlaybackRate]    = useState<number>((ttsStored?.playbackRate as number) ?? 1);
  const [voice,           setVoice]           = useState<string>((ttsStored?.voice as string) ?? '');
  const [nonLocalVoices,  setNonLocalVoices]  = useState<boolean>((ttsStored?.nonLocalVoices as boolean) ?? false);
  const [responseAutoPlayback, setResponseAutoPlayback] = useState(settings.responseAutoPlayback ?? false);

  // Voice lists
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [apiVoices,     setApiVoices]     = useState<{ id: string; name: string }[]>([]);

  // Backend-configured engine (what the admin set up)
  const configTTSEngine = config?.audio?.tts?.engine ?? '';
  const configTTSVoice  = config?.audio?.tts?.voice  ?? '';
  const configSTTEngine = config?.audio?.stt?.engine ?? '';

  // Load browser voices (async on some browsers)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const load = () => setBrowserVoices(window.speechSynthesis?.getVoices() ?? []);
    load();
    window.speechSynthesis?.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', load);
  }, []);

  // Load API voices when backend TTS engine is set
  useEffect(() => {
    if (configTTSEngine === '') return;
    const token = getToken();
    if (!token) return;
    getAudioVoices(token)
      .then((res) => setApiVoices(res.voices ?? []))
      .catch(() => {}); // silent — backend may not support voices endpoint
  }, [configTTSEngine]);

  // Sync from store on modal open
  useEffect(() => {
    const stt = settings.audio?.stt as Record<string, unknown> | undefined;
    const tts = settings.audio?.tts as Record<string, unknown> | undefined;
    setSTTEngine((stt?.engine as string) ?? '');
    setSTTLanguage((stt?.language as string) ?? '');
    setSpeechAutoSend(settings.speechAutoSend ?? false);
    setTTSEngine((tts?.engine as string) ?? '');
    setTTSEngineConfig((tts?.engineConfig as Record<string, unknown>) ?? {});
    setPlaybackRate((tts?.playbackRate as number) ?? 1);
    setVoice((tts?.voice as string) ?? '');
    setNonLocalVoices((tts?.nonLocalVoices as boolean) ?? false);
    setResponseAutoPlayback(settings.responseAutoPlayback ?? false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.audio, settings.speechAutoSend, settings.responseAutoPlayback]);

  // Latest-ref — keeps save handler current without re-registering
  const latestRef = useRef({
    sttEngine, sttLanguage, speechAutoSend,
    ttsEngine, ttsEngineConfig, playbackRate, voice, nonLocalVoices,
    responseAutoPlayback, settings, configTTSEngine, configTTSVoice,
  });
  latestRef.current = {
    sttEngine, sttLanguage, speechAutoSend,
    ttsEngine, ttsEngineConfig, playbackRate, voice, nonLocalVoices,
    responseAutoPlayback, settings, configTTSEngine, configTTSVoice,
  };

  useEffect(() => {
    onRegisterSave(async () => {
      const token = getToken();
      if (!token) throw new Error('Not authenticated');
      const {
        sttEngine: se, sttLanguage: sl, speechAutoSend: ssa,
        ttsEngine: te, ttsEngineConfig: tec, playbackRate: pr, voice: v,
        nonLocalVoices: nlv, responseAutoPlayback: rap,
        settings: s, configTTSEngine: cte, configTTSVoice: ctv,
      } = latestRef.current;

      const audio = {
        stt: { engine: se || undefined, language: sl || undefined },
        tts: {
          engine: te || undefined,
          engineConfig: tec,
          playbackRate: pr,
          voice: v || undefined,
          defaultVoice: ctv,
          nonLocalVoices: cte === '' ? nlv : undefined,
        },
      };

      await updateUserSettings(token, {
        ui: { ...s, speechAutoSend: ssa, responseAutoPlayback: rap, audio },
      });
      patchSettings({ speechAutoSend: ssa, responseAutoPlayback: rap, audio });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterSave]);

  // Displayed browser voices (filtered by localService flag)
  const displayedBrowserVoices = nonLocalVoices
    ? browserVoices
    : browserVoices.filter((v) => v.localService);

  return (
    <div className="settings-tab-content">

      {/* ── Speech to Text ─────────────────────────────────────────────────── */}
      <div className="settings-section">
        <div className="audio-section-heading">
          <Mic className="h-4 w-4 audio-section-icon" />
          <span className="settings-section-title" style={{ marginBottom: 0 }}>Speech to Text</span>
        </div>

        {/* STT Engine — hidden when admin forced the engine to 'web' */}
        {configSTTEngine !== 'web' && (
          <Row label="Speech-to-Text Engine">
            <SettingSelect value={sttEngine} onChange={setSTTEngine}>
              <option value="">Default</option>
              <option value="web">Web API</option>
            </SettingSelect>
          </Row>
        )}

        {/* Language */}
        {configSTTEngine !== 'web' && (
          <div className="iface-row">
            <div className="iface-row-text">
              <div className="audio-label-with-tip">
                <span className="iface-row-label">Language</span>
                <div className="audio-tooltip-wrap" title="Supply the input language in ISO-639-1 format (e.g. en) to improve accuracy and latency. Leave blank to auto-detect.">
                  <Info className="h-3.5 w-3.5 audio-tip-icon" />
                  <span className="audio-tooltip-text">
                    Supply the input language in ISO-639-1 format (e.g.&nbsp;en) to improve accuracy and latency.
                    Leave blank to auto-detect.
                  </span>
                </div>
              </div>
            </div>
            <input
              type="text"
              className="audio-inline-input"
              value={sttLanguage}
              onChange={(e) => setSTTLanguage(e.target.value)}
              placeholder="e.g. en"
            />
          </div>
        )}

        {/* Auto-send */}
        <Row
          label="Instant Auto-Send After Voice Transcription"
          desc="Automatically send the transcribed text without pressing send."
        >
          <Toggle checked={speechAutoSend} onChange={setSpeechAutoSend} />
        </Row>
      </div>

      {/* ── Text to Speech ─────────────────────────────────────────────────── */}
      <div className="settings-section">
        <div className="audio-section-heading">
          <Volume2 className="h-4 w-4 audio-section-icon" />
          <span className="settings-section-title" style={{ marginBottom: 0 }}>Text to Speech</span>
        </div>

        {/* TTS Engine */}
        <Row label="Text-to-Speech Engine">
          <SettingSelect value={ttsEngine} onChange={(v) => { setTTSEngine(v); setTTSEngineConfig({}); }}>
            <option value="">Default</option>
            <option value="browser-kokoro">Kokoro.js (Browser)</option>
          </SettingSelect>
        </Row>

        {/* Kokoro dtype — only when Kokoro engine selected */}
        {ttsEngine === 'browser-kokoro' && (
          <Row label="Kokoro.js Dtype" desc="Precision format for the in-browser Kokoro model.">
            <SettingSelect
              value={(ttsEngineConfig.dtype as string) ?? ''}
              onChange={(v) => setTTSEngineConfig((prev) => ({ ...prev, dtype: v }))}
            >
              <option value="" disabled>Select dtype</option>
              <option value="fp32">fp32</option>
              <option value="fp16">fp16</option>
              <option value="q8">q8</option>
              <option value="q4">q4</option>
            </SettingSelect>
          </Row>
        )}

        {/* Auto-playback */}
        <Row label="Auto-playback Response" desc="Automatically read AI responses aloud when received.">
          <Toggle checked={responseAutoPlayback} onChange={setResponseAutoPlayback} />
        </Row>

        {/* Playback Speed */}
        <div className="iface-row">
          <div className="iface-row-text">
            <span className="iface-row-label">Speech Playback Speed</span>
          </div>
          <div className="audio-speed-wrap">
            <input
              type="number"
              className="audio-speed-input"
              min={0}
              step={0.25}
              value={playbackRate}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v >= 0) setPlaybackRate(v);
              }}
            />
            <span className="audio-speed-unit">×</span>
          </div>
        </div>
      </div>

      {/* ── Voice ──────────────────────────────────────────────────────────── */}
      <div className="settings-section">
        <div className="settings-section-title" style={{ marginBottom: '0.5rem' }}>Set Voice</div>

        {/* Kokoro voices (datalist input) */}
        {ttsEngine === 'browser-kokoro' ? (
          <div className="audio-voice-row">
            <input
              list="audio-kokoro-voices"
              className="audio-voice-input"
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              placeholder="Select a voice"
            />
            <datalist id="audio-kokoro-voices">
              {/* Kokoro voices would be populated when the model loads in-browser */}
            </datalist>
            <p className="audio-voice-hint">
              Kokoro.js voices load in the browser when a chat uses TTS.
            </p>
          </div>

        /* Backend engine voices (datalist input from API) */
        ) : configTTSEngine !== '' ? (
          <div className="audio-voice-row">
            <input
              list="audio-api-voices"
              className="audio-voice-input"
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              placeholder="Select a voice"
            />
            <datalist id="audio-api-voices">
              {apiVoices.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </datalist>
          </div>

        /* Default / Web API voices (select from browser speechSynthesis) */
        ) : (
          <div className="audio-voice-row">
            <select
              className="audio-voice-select"
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              disabled={displayedBrowserVoices.length === 0}
            >
              <option value="">Default</option>
              {displayedBrowserVoices.map((v) => (
                <option key={v.name} value={v.name}>{v.name}</option>
              ))}
            </select>
            {browserVoices.length === 0 && (
              <p className="audio-voice-hint">
                No voices found. Your browser may not support the Web Speech API.
              </p>
            )}
            <div className="audio-non-local-row">
              <span className="iface-row-label" style={{ fontSize: '0.8rem' }}>Allow non-local voices</span>
              <Toggle checked={nonLocalVoices} onChange={setNonLocalVoices} />
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
