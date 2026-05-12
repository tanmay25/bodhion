'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getToken } from '@/lib/auth/session';
import { SensitiveInput } from '@/components/shared/SensitiveInput';
import { SettingsSection, SettingsField, SettingsToggleRow } from '@/components/shared/SettingsSection';
import { getAudioConfig, updateAudioConfig } from '@/lib/api/admin/settings';

const FIELD  = 'admin-input h-9 w-full rounded-[0.85rem] px-3 text-sm';
const SELECT = 'admin-select h-9 w-full rounded-[0.85rem] px-3 text-sm';

// ── Typed state shapes matching backend AudioConfigUpdateForm ─────────────────

interface TtsState {
  OPENAI_API_BASE_URL:       string;
  OPENAI_API_KEY:            string;
  OPENAI_PARAMS:             string;        // pretty-printed JSON in UI
  API_KEY:                   string;        // ElevenLabs / Azure generic key
  ENGINE:                    string;
  MODEL:                     string;
  VOICE:                     string;
  SPLIT_ON:                  string;
  AZURE_SPEECH_REGION:       string;
  AZURE_SPEECH_BASE_URL:     string;
  AZURE_SPEECH_OUTPUT_FORMAT: string;
}

interface SttState {
  OPENAI_API_BASE_URL:          string;
  OPENAI_API_KEY:               string;
  ENGINE:                       string;
  MODEL:                        string;
  SUPPORTED_CONTENT_TYPES:      string;    // comma-sep in UI, array to backend
  WHISPER_MODEL:                string;
  DEEPGRAM_API_KEY:             string;
  AZURE_API_KEY:                string;
  AZURE_REGION:                 string;
  AZURE_LOCALES:                string;
  AZURE_BASE_URL:               string;
  AZURE_MAX_SPEAKERS:           string;
  MISTRAL_API_KEY:              string;
  MISTRAL_API_BASE_URL:         string;
  MISTRAL_USE_CHAT_COMPLETIONS: boolean;
}

const defaultTts = (): TtsState => ({
  OPENAI_API_BASE_URL:        '',
  OPENAI_API_KEY:             '',
  OPENAI_PARAMS:              '',
  API_KEY:                    '',
  ENGINE:                     '',
  MODEL:                      '',
  VOICE:                      '',
  SPLIT_ON:                   'punctuation',
  AZURE_SPEECH_REGION:        '',
  AZURE_SPEECH_BASE_URL:      '',
  AZURE_SPEECH_OUTPUT_FORMAT: '',
});

const defaultStt = (): SttState => ({
  OPENAI_API_BASE_URL:          '',
  OPENAI_API_KEY:               '',
  ENGINE:                       '',
  MODEL:                        '',
  SUPPORTED_CONTENT_TYPES:      '',
  WHISPER_MODEL:                '',
  DEEPGRAM_API_KEY:             '',
  AZURE_API_KEY:                '',
  AZURE_REGION:                 '',
  AZURE_LOCALES:                '',
  AZURE_BASE_URL:               '',
  AZURE_MAX_SPEAKERS:           '',
  MISTRAL_API_KEY:              '',
  MISTRAL_API_BASE_URL:         '',
  MISTRAL_USE_CHAT_COMPLETIONS: false,
});

// ── Main component ────────────────────────────────────────────────────────────

export function AudioTab() {
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [tts,     setTts]     = useState<TtsState>(defaultTts());
  const [stt,     setStt]     = useState<SttState>(defaultStt());

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    getAudioConfig(token)
      .then((res) => {
        const r = res as { tts: Record<string, unknown>; stt: Record<string, unknown> };
        if (!r?.tts) return;
        setTts({
          OPENAI_API_BASE_URL:        String(r.tts.OPENAI_API_BASE_URL        ?? ''),
          OPENAI_API_KEY:             String(r.tts.OPENAI_API_KEY             ?? ''),
          OPENAI_PARAMS:              r.tts.OPENAI_PARAMS
                                        ? JSON.stringify(r.tts.OPENAI_PARAMS, null, 2)
                                        : '',
          API_KEY:                    String(r.tts.API_KEY                    ?? ''),
          ENGINE:                     String(r.tts.ENGINE                     ?? ''),
          MODEL:                      String(r.tts.MODEL                      ?? ''),
          VOICE:                      String(r.tts.VOICE                      ?? ''),
          SPLIT_ON:                   String(r.tts.SPLIT_ON                   ?? 'punctuation'),
          AZURE_SPEECH_REGION:        String(r.tts.AZURE_SPEECH_REGION        ?? ''),
          AZURE_SPEECH_BASE_URL:      String(r.tts.AZURE_SPEECH_BASE_URL      ?? ''),
          AZURE_SPEECH_OUTPUT_FORMAT: String(r.tts.AZURE_SPEECH_OUTPUT_FORMAT ?? ''),
        });
        setStt({
          OPENAI_API_BASE_URL:          String(r.stt.OPENAI_API_BASE_URL          ?? ''),
          OPENAI_API_KEY:               String(r.stt.OPENAI_API_KEY               ?? ''),
          ENGINE:                       String(r.stt.ENGINE                       ?? ''),
          MODEL:                        String(r.stt.MODEL                        ?? ''),
          SUPPORTED_CONTENT_TYPES:      Array.isArray(r.stt.SUPPORTED_CONTENT_TYPES)
                                          ? (r.stt.SUPPORTED_CONTENT_TYPES as string[]).join(',')
                                          : String(r.stt.SUPPORTED_CONTENT_TYPES ?? ''),
          WHISPER_MODEL:                String(r.stt.WHISPER_MODEL                ?? ''),
          DEEPGRAM_API_KEY:             String(r.stt.DEEPGRAM_API_KEY             ?? ''),
          AZURE_API_KEY:                String(r.stt.AZURE_API_KEY                ?? ''),
          AZURE_REGION:                 String(r.stt.AZURE_REGION                 ?? ''),
          AZURE_LOCALES:                String(r.stt.AZURE_LOCALES                ?? ''),
          AZURE_BASE_URL:               String(r.stt.AZURE_BASE_URL               ?? ''),
          AZURE_MAX_SPEAKERS:           String(r.stt.AZURE_MAX_SPEAKERS           ?? ''),
          MISTRAL_API_KEY:              String(r.stt.MISTRAL_API_KEY              ?? ''),
          MISTRAL_API_BASE_URL:         String(r.stt.MISTRAL_API_BASE_URL         ?? ''),
          MISTRAL_USE_CHAT_COMPLETIONS: !!r.stt.MISTRAL_USE_CHAT_COMPLETIONS,
        });
      })
      .catch(() => toast.error('Failed to load audio config'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const token = getToken();
    if (!token) return;

    // Validate TTS OpenAI PARAMS JSON
    let openaiParams: Record<string, unknown> = {};
    if (tts.OPENAI_PARAMS.trim() !== '') {
      try {
        openaiParams = JSON.parse(tts.OPENAI_PARAMS);
      } catch {
        toast.error('Invalid JSON in TTS Additional Parameters');
        return;
      }
    }

    setSaving(true);
    try {
      await updateAudioConfig(token, {
        tts: {
          OPENAI_API_BASE_URL:        tts.OPENAI_API_BASE_URL,
          OPENAI_API_KEY:             tts.OPENAI_API_KEY,
          OPENAI_PARAMS:              openaiParams,
          API_KEY:                    tts.API_KEY,
          ENGINE:                     tts.ENGINE,
          MODEL:                      tts.MODEL,
          VOICE:                      tts.VOICE,
          SPLIT_ON:                   tts.SPLIT_ON,
          AZURE_SPEECH_REGION:        tts.AZURE_SPEECH_REGION,
          AZURE_SPEECH_BASE_URL:      tts.AZURE_SPEECH_BASE_URL,
          AZURE_SPEECH_OUTPUT_FORMAT: tts.AZURE_SPEECH_OUTPUT_FORMAT,
        },
        stt: {
          OPENAI_API_BASE_URL:          stt.OPENAI_API_BASE_URL,
          OPENAI_API_KEY:               stt.OPENAI_API_KEY,
          ENGINE:                       stt.ENGINE,
          MODEL:                        stt.MODEL,
          SUPPORTED_CONTENT_TYPES:      stt.SUPPORTED_CONTENT_TYPES
                                          .split(',')
                                          .map((s) => s.trim())
                                          .filter(Boolean),
          WHISPER_MODEL:                stt.WHISPER_MODEL,
          DEEPGRAM_API_KEY:             stt.DEEPGRAM_API_KEY,
          AZURE_API_KEY:                stt.AZURE_API_KEY,
          AZURE_REGION:                 stt.AZURE_REGION,
          AZURE_LOCALES:                stt.AZURE_LOCALES,
          AZURE_BASE_URL:               stt.AZURE_BASE_URL,
          AZURE_MAX_SPEAKERS:           stt.AZURE_MAX_SPEAKERS,
          MISTRAL_API_KEY:              stt.MISTRAL_API_KEY,
          MISTRAL_API_BASE_URL:         stt.MISTRAL_API_BASE_URL,
          MISTRAL_USE_CHAT_COMPLETIONS: stt.MISTRAL_USE_CHAT_COMPLETIONS,
        },
      });
      toast.success('Audio settings saved');
    } catch {
      toast.error('Failed to save audio settings');
    } finally {
      setSaving(false);
    }
  };

  const setT = <K extends keyof TtsState>(k: K, v: TtsState[K]) =>
    setTts((p) => ({ ...p, [k]: v }));
  const setS = <K extends keyof SttState>(k: K, v: SttState[K]) =>
    setStt((p) => ({ ...p, [k]: v }));

  if (loading) return <SkeletonCards />;

  return (
    <div className="flex flex-col gap-5">

      {/* ── Text-to-Speech ───────────────────────────────────────────────────── */}
      <SettingsSection
        title="Text-to-Speech (TTS)"
        eyebrow="Voice Output"
        description="Configure the engine and credentials used to synthesise speech from text."
        onSave={handleSave}
        saving={saving}
      >
        <SettingsField label="TTS Engine">
          <select value={tts.ENGINE} onChange={(e) => setT('ENGINE', e.target.value)} className={SELECT}>
            <option value="">Web API (Browser)</option>
            <option value="transformers">Transformers (Local)</option>
            <option value="openai">OpenAI</option>
            <option value="elevenlabs">ElevenLabs</option>
            <option value="azure">Azure AI Speech</option>
          </select>
        </SettingsField>

        {/* OpenAI credentials */}
        {tts.ENGINE === 'openai' && (
          <>
            <SettingsField label="API Base URL">
              <input type="url" value={tts.OPENAI_API_BASE_URL} onChange={(e) => setT('OPENAI_API_BASE_URL', e.target.value)} placeholder="https://api.openai.com/v1" className={FIELD} />
            </SettingsField>
            <SettingsField label="API Key">
              <SensitiveInput value={tts.OPENAI_API_KEY} onChange={(v) => setT('OPENAI_API_KEY', v)} />
            </SettingsField>
          </>
        )}

        {/* ElevenLabs / Azure: generic API key */}
        {(tts.ENGINE === 'elevenlabs' || tts.ENGINE === 'azure') && (
          <SettingsField label="API Key">
            <SensitiveInput value={tts.API_KEY} onChange={(v) => setT('API_KEY', v)} />
          </SettingsField>
        )}

        {/* Azure extra fields */}
        {tts.ENGINE === 'azure' && (
          <>
            <SettingsField label="Azure Speech Region" description="e.g. westus (leave blank for eastus)">
              <input type="text" value={tts.AZURE_SPEECH_REGION} onChange={(e) => setT('AZURE_SPEECH_REGION', e.target.value)} placeholder="eastus" className={FIELD} />
            </SettingsField>
            <SettingsField label="Azure Endpoint URL" description="Leave blank to use the commercial endpoint.">
              <input type="url" value={tts.AZURE_SPEECH_BASE_URL} onChange={(e) => setT('AZURE_SPEECH_BASE_URL', e.target.value)} placeholder="https://…" className={FIELD} />
            </SettingsField>
          </>
        )}

        {/* Voice / Model (engine-specific) */}
        {tts.ENGINE === '' && (
          <SettingsField label="TTS Voice" description="Browser Web Speech API voice.">
            <input type="text" value={tts.VOICE} onChange={(e) => setT('VOICE', e.target.value)} placeholder="Default" className={FIELD} />
          </SettingsField>
        )}

        {tts.ENGINE === 'transformers' && (
          <SettingsField label="TTS Model" description="CMU ARCTIC speaker embedding name.">
            <input type="text" value={tts.MODEL} onChange={(e) => setT('MODEL', e.target.value)} placeholder="e.g. cmu_us_awb_arctic-wav-arctic_a0001" className={FIELD} />
          </SettingsField>
        )}

        {(tts.ENGINE === 'openai' || tts.ENGINE === 'elevenlabs') && (
          <div className="grid grid-cols-2 gap-3">
            <SettingsField label="TTS Voice">
              <input type="text" value={tts.VOICE} onChange={(e) => setT('VOICE', e.target.value)} placeholder={tts.ENGINE === 'openai' ? 'alloy' : 'Select a voice'} className={FIELD} />
            </SettingsField>
            <SettingsField label="TTS Model">
              <input type="text" value={tts.MODEL} onChange={(e) => setT('MODEL', e.target.value)} placeholder={tts.ENGINE === 'openai' ? 'tts-1' : 'Select a model'} className={FIELD} />
            </SettingsField>
          </div>
        )}

        {tts.ENGINE === 'azure' && (
          <div className="grid grid-cols-2 gap-3">
            <SettingsField label="TTS Voice">
              <input type="text" value={tts.VOICE} onChange={(e) => setT('VOICE', e.target.value)} placeholder="e.g. en-US-AvaNeural" className={FIELD} />
            </SettingsField>
            <SettingsField label="Output Format" description="Leave blank for default.">
              <input type="text" value={tts.AZURE_SPEECH_OUTPUT_FORMAT} onChange={(e) => setT('AZURE_SPEECH_OUTPUT_FORMAT', e.target.value)} placeholder="audio-24khz-48kbitrate-mono-mp3" className={FIELD} />
            </SettingsField>
          </div>
        )}

        {/* OpenAI additional params */}
        {tts.ENGINE === 'openai' && (
          <SettingsField label="Additional Parameters (JSON)" description="Leave empty for none. Merged into the TTS request body.">
            <textarea
              rows={3}
              value={tts.OPENAI_PARAMS}
              onChange={(e) => setT('OPENAI_PARAMS', e.target.value)}
              placeholder='{"speed": 1.0}'
              className="admin-input w-full rounded-[0.85rem] px-3 py-2 text-sm font-mono"
            />
          </SettingsField>
        )}

        {/* Response splitting (always visible) */}
        <SettingsField
          label="Response Splitting"
          description="Controls how message text is split for TTS requests. 'Punctuation' splits into sentences, 'paragraphs' into paragraphs, 'none' keeps the full message."
        >
          <select value={tts.SPLIT_ON} onChange={(e) => setT('SPLIT_ON', e.target.value)} className={SELECT}>
            <option value="punctuation">Punctuation</option>
            <option value="paragraphs">Paragraphs</option>
            <option value="none">None</option>
          </select>
        </SettingsField>
      </SettingsSection>

      {/* ── Speech-to-Text ───────────────────────────────────────────────────── */}
      <SettingsSection
        title="Speech-to-Text (STT)"
        eyebrow="Voice Input"
        description="Configure the engine and credentials used to transcribe speech."
        onSave={handleSave}
        saving={saving}
      >
        {/* Supported MIME types (all non-web engines) */}
        {stt.ENGINE !== 'web' && (
          <SettingsField
            label="Supported MIME Types"
            description="Comma-separated. e.g. audio/wav,audio/mpeg,video/* — leave blank for defaults."
          >
            <input type="text" value={stt.SUPPORTED_CONTENT_TYPES} onChange={(e) => setS('SUPPORTED_CONTENT_TYPES', e.target.value)} placeholder="audio/wav,audio/mpeg" className={FIELD} />
          </SettingsField>
        )}

        <SettingsField label="STT Engine">
          <select value={stt.ENGINE} onChange={(e) => setS('ENGINE', e.target.value)} className={SELECT}>
            <option value="">Whisper (Local)</option>
            <option value="openai">OpenAI</option>
            <option value="web">Web API (Browser)</option>
            <option value="deepgram">Deepgram</option>
            <option value="azure">Azure AI Speech</option>
            <option value="mistral">MistralAI</option>
          </select>
        </SettingsField>

        {/* Local Whisper */}
        {stt.ENGINE === '' && (
          <SettingsField label="Whisper Model" description="Model name for faster-whisper. e.g. base, small, medium.">
            <input type="text" value={stt.WHISPER_MODEL} onChange={(e) => setS('WHISPER_MODEL', e.target.value)} placeholder="base" className={FIELD} />
          </SettingsField>
        )}

        {/* OpenAI */}
        {stt.ENGINE === 'openai' && (
          <>
            <SettingsField label="API Base URL">
              <input type="url" value={stt.OPENAI_API_BASE_URL} onChange={(e) => setS('OPENAI_API_BASE_URL', e.target.value)} placeholder="https://api.openai.com/v1" className={FIELD} />
            </SettingsField>
            <SettingsField label="API Key">
              <SensitiveInput value={stt.OPENAI_API_KEY} onChange={(v) => setS('OPENAI_API_KEY', v)} />
            </SettingsField>
            <SettingsField label="STT Model">
              <input type="text" value={stt.MODEL} onChange={(e) => setS('MODEL', e.target.value)} placeholder="whisper-1" className={FIELD} />
            </SettingsField>
          </>
        )}

        {/* Deepgram */}
        {stt.ENGINE === 'deepgram' && (
          <>
            <SettingsField label="API Key">
              <SensitiveInput value={stt.DEEPGRAM_API_KEY} onChange={(v) => setS('DEEPGRAM_API_KEY', v)} />
            </SettingsField>
            <SettingsField label="STT Model" description="Leave empty to use the default model.">
              <input type="text" value={stt.MODEL} onChange={(e) => setS('MODEL', e.target.value)} placeholder="nova-2 (optional)" className={FIELD} />
            </SettingsField>
          </>
        )}

        {/* Azure */}
        {stt.ENGINE === 'azure' && (
          <>
            <SettingsField label="API Key">
              <SensitiveInput value={stt.AZURE_API_KEY} onChange={(v) => setS('AZURE_API_KEY', v)} />
            </SettingsField>
            <div className="grid grid-cols-2 gap-3">
              <SettingsField label="Azure Region" description="e.g. westus (leave blank for eastus)">
                <input type="text" value={stt.AZURE_REGION} onChange={(e) => setS('AZURE_REGION', e.target.value)} placeholder="eastus" className={FIELD} />
              </SettingsField>
              <SettingsField label="Max Speakers" description="Leave blank for default.">
                <input type="text" value={stt.AZURE_MAX_SPEAKERS} onChange={(e) => setS('AZURE_MAX_SPEAKERS', e.target.value)} placeholder="e.g. 3" className={FIELD} />
              </SettingsField>
            </div>
            <SettingsField label="Language Locales" description="Comma-separated. e.g. en-US,ja-JP — leave blank for auto-detect.">
              <input type="text" value={stt.AZURE_LOCALES} onChange={(e) => setS('AZURE_LOCALES', e.target.value)} placeholder="en-US,ja-JP" className={FIELD} />
            </SettingsField>
            <SettingsField label="Endpoint URL" description="Leave blank to use the commercial endpoint.">
              <input type="url" value={stt.AZURE_BASE_URL} onChange={(e) => setS('AZURE_BASE_URL', e.target.value)} placeholder="https://…" className={FIELD} />
            </SettingsField>
          </>
        )}

        {/* Mistral */}
        {stt.ENGINE === 'mistral' && (
          <>
            <SettingsField label="API Base URL">
              <input type="url" value={stt.MISTRAL_API_BASE_URL} onChange={(e) => setS('MISTRAL_API_BASE_URL', e.target.value)} placeholder="https://api.mistral.ai/v1" className={FIELD} />
            </SettingsField>
            <SettingsField label="API Key">
              <SensitiveInput value={stt.MISTRAL_API_KEY} onChange={(v) => setS('MISTRAL_API_KEY', v)} />
            </SettingsField>
            <SettingsField label="STT Model" description="Leave empty for default (voxtral-mini-latest).">
              <input type="text" value={stt.MODEL} onChange={(e) => setS('MODEL', e.target.value)} placeholder="voxtral-mini-latest" className={FIELD} />
            </SettingsField>
            <SettingsToggleRow
              label="Use Chat Completions API"
              description="Use /v1/chat/completions instead of /v1/audio/transcriptions for potentially better accuracy."
              checked={stt.MISTRAL_USE_CHAT_COMPLETIONS}
              onChange={(v) => setS('MISTRAL_USE_CHAT_COMPLETIONS', v)}
            />
          </>
        )}
      </SettingsSection>
    </div>
  );
}

function SkeletonCards() {
  return (
    <div className="flex flex-col gap-5">
      {[4, 5].map((rows, i) => (
        <div key={i} className="rounded-xl p-5" style={{ background: 'var(--bodhion-card-bg)', border: '1px solid var(--bodhion-card-border)' }}>
          <div className="flex flex-col gap-3">
            {Array.from({ length: rows }).map((_, j) => (
              <div key={j} className="h-9 w-full animate-pulse rounded" style={{ background: 'var(--bodhion-search-bg)' }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default AudioTab;
