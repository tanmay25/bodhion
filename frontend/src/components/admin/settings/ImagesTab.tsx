'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getToken } from '@/lib/auth/session';
import { SensitiveInput } from '@/components/shared/SensitiveInput';
import { SettingsSection, SettingsField, SettingsToggleRow } from '@/components/shared/SettingsSection';
import { getImageConfig, updateImageConfig } from '@/lib/api/admin/settings';

const FIELD  = 'admin-input h-9 w-full rounded-[0.85rem] px-3 text-sm';
const SELECT = 'admin-select h-9 w-full rounded-[0.85rem] px-3 text-sm';

// ── State shape mirrors backend ImagesConfig exactly ─────────────────────────

interface ImgState {
  // General
  ENABLE_IMAGE_GENERATION:        boolean;
  ENABLE_IMAGE_PROMPT_GENERATION: boolean;

  // Create Image
  IMAGE_GENERATION_ENGINE: string;
  IMAGE_GENERATION_MODEL:  string;
  IMAGE_SIZE:              string;
  IMAGE_STEPS:             number;

  // OpenAI engine
  IMAGES_OPENAI_API_BASE_URL: string;
  IMAGES_OPENAI_API_KEY:      string;
  IMAGES_OPENAI_API_VERSION:  string;
  IMAGES_OPENAI_API_PARAMS:   string;  // JSON string in UI

  // Automatic1111 engine
  AUTOMATIC1111_BASE_URL:  string;
  AUTOMATIC1111_API_AUTH:  string;
  AUTOMATIC1111_PARAMS:    string;     // JSON string in UI

  // ComfyUI engine
  COMFYUI_BASE_URL:  string;
  COMFYUI_API_KEY:   string;
  COMFYUI_WORKFLOW:  string;           // JSON string in UI
  COMFYUI_WORKFLOW_NODES: { type: string; key: string; node_ids: string }[];

  // Gemini engine
  IMAGES_GEMINI_API_BASE_URL:     string;
  IMAGES_GEMINI_API_KEY:          string;
  IMAGES_GEMINI_ENDPOINT_METHOD:  string;

  // Image Edit
  ENABLE_IMAGE_EDIT:   boolean;
  IMAGE_EDIT_ENGINE:   string;
  IMAGE_EDIT_MODEL:    string;
  IMAGE_EDIT_SIZE:     string;

  IMAGES_EDIT_OPENAI_API_BASE_URL: string;
  IMAGES_EDIT_OPENAI_API_KEY:      string;
  IMAGES_EDIT_OPENAI_API_VERSION:  string;
  IMAGES_EDIT_GEMINI_API_BASE_URL: string;
  IMAGES_EDIT_GEMINI_API_KEY:      string;
  IMAGES_EDIT_COMFYUI_BASE_URL:    string;
  IMAGES_EDIT_COMFYUI_API_KEY:     string;
  IMAGES_EDIT_COMFYUI_WORKFLOW:    string;
  IMAGES_EDIT_COMFYUI_WORKFLOW_NODES: { type: string; key: string; node_ids: string }[];
}

const DEFAULT_WORKFLOW_NODES = [
  { type: 'prompt', key: 'text',      node_ids: '' },
  { type: 'model',  key: 'ckpt_name', node_ids: '' },
  { type: 'width',  key: 'width',     node_ids: '' },
  { type: 'height', key: 'height',    node_ids: '' },
  { type: 'steps',  key: 'steps',     node_ids: '' },
  { type: 'seed',   key: 'seed',      node_ids: '' },
];

const DEFAULT_EDIT_NODES = [
  { type: 'image',  key: 'image',     node_ids: '' },
  { type: 'prompt', key: 'prompt',    node_ids: '' },
  { type: 'model',  key: 'unet_name', node_ids: '' },
  { type: 'width',  key: 'width',     node_ids: '' },
  { type: 'height', key: 'height',    node_ids: '' },
];

const defaultState = (): ImgState => ({
  ENABLE_IMAGE_GENERATION:        false,
  ENABLE_IMAGE_PROMPT_GENERATION: false,
  IMAGE_GENERATION_ENGINE:        'openai',
  IMAGE_GENERATION_MODEL:         '',
  IMAGE_SIZE:                     '512x512',
  IMAGE_STEPS:                    20,
  IMAGES_OPENAI_API_BASE_URL:     '',
  IMAGES_OPENAI_API_KEY:          '',
  IMAGES_OPENAI_API_VERSION:      '',
  IMAGES_OPENAI_API_PARAMS:       '',
  AUTOMATIC1111_BASE_URL:         '',
  AUTOMATIC1111_API_AUTH:         '',
  AUTOMATIC1111_PARAMS:           '',
  COMFYUI_BASE_URL:               '',
  COMFYUI_API_KEY:                '',
  COMFYUI_WORKFLOW:               '',
  COMFYUI_WORKFLOW_NODES:         DEFAULT_WORKFLOW_NODES,
  IMAGES_GEMINI_API_BASE_URL:     '',
  IMAGES_GEMINI_API_KEY:          '',
  IMAGES_GEMINI_ENDPOINT_METHOD:  'predict',
  ENABLE_IMAGE_EDIT:              false,
  IMAGE_EDIT_ENGINE:              'openai',
  IMAGE_EDIT_MODEL:               '',
  IMAGE_EDIT_SIZE:                '512x512',
  IMAGES_EDIT_OPENAI_API_BASE_URL: '',
  IMAGES_EDIT_OPENAI_API_KEY:      '',
  IMAGES_EDIT_OPENAI_API_VERSION:  '',
  IMAGES_EDIT_GEMINI_API_BASE_URL: '',
  IMAGES_EDIT_GEMINI_API_KEY:      '',
  IMAGES_EDIT_COMFYUI_BASE_URL:    '',
  IMAGES_EDIT_COMFYUI_API_KEY:     '',
  IMAGES_EDIT_COMFYUI_WORKFLOW:    '',
  IMAGES_EDIT_COMFYUI_WORKFLOW_NODES: DEFAULT_EDIT_NODES,
});

// Convert node_ids arrays from backend → comma strings for UI
function nodesFromBackend(
  backendNodes: { type: string; key: string; node_ids: string | string[] }[],
  defaults: { type: string; key: string; node_ids: string }[],
) {
  return defaults.map((def) => {
    const found = backendNodes.find((n) => n.type === def.type);
    if (!found) return def;
    return {
      type:     found.type,
      key:      found.key,
      node_ids: Array.isArray(found.node_ids) ? found.node_ids.join(',') : (found.node_ids ?? ''),
    };
  });
}

// ── Main component ────────────────────────────────────────────────────────────

export function ImagesTab() {
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [cfg,     setCfg]     = useState<ImgState>(defaultState());

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    getImageConfig(token)
      .then((res) => {
        const r = res as Record<string, unknown>;
        setCfg({
          ENABLE_IMAGE_GENERATION:        !!r.ENABLE_IMAGE_GENERATION,
          ENABLE_IMAGE_PROMPT_GENERATION: !!r.ENABLE_IMAGE_PROMPT_GENERATION,
          IMAGE_GENERATION_ENGINE:        String(r.IMAGE_GENERATION_ENGINE  ?? 'openai'),
          IMAGE_GENERATION_MODEL:         String(r.IMAGE_GENERATION_MODEL   ?? ''),
          IMAGE_SIZE:                     String(r.IMAGE_SIZE               ?? '512x512'),
          IMAGE_STEPS:                    Number(r.IMAGE_STEPS              ?? 20),
          IMAGES_OPENAI_API_BASE_URL:     String(r.IMAGES_OPENAI_API_BASE_URL ?? ''),
          IMAGES_OPENAI_API_KEY:          String(r.IMAGES_OPENAI_API_KEY    ?? ''),
          IMAGES_OPENAI_API_VERSION:      String(r.IMAGES_OPENAI_API_VERSION ?? ''),
          IMAGES_OPENAI_API_PARAMS:       r.IMAGES_OPENAI_API_PARAMS && typeof r.IMAGES_OPENAI_API_PARAMS === 'object'
                                            ? JSON.stringify(r.IMAGES_OPENAI_API_PARAMS, null, 2)
                                            : String(r.IMAGES_OPENAI_API_PARAMS ?? ''),
          AUTOMATIC1111_BASE_URL:         String(r.AUTOMATIC1111_BASE_URL   ?? ''),
          AUTOMATIC1111_API_AUTH:         r.AUTOMATIC1111_API_AUTH && typeof r.AUTOMATIC1111_API_AUTH === 'object'
                                            ? JSON.stringify(r.AUTOMATIC1111_API_AUTH, null, 2)
                                            : String(r.AUTOMATIC1111_API_AUTH ?? ''),
          AUTOMATIC1111_PARAMS:           r.AUTOMATIC1111_PARAMS && typeof r.AUTOMATIC1111_PARAMS === 'object'
                                            ? JSON.stringify(r.AUTOMATIC1111_PARAMS, null, 2)
                                            : String(r.AUTOMATIC1111_PARAMS ?? ''),
          COMFYUI_BASE_URL:               String(r.COMFYUI_BASE_URL         ?? ''),
          COMFYUI_API_KEY:                String(r.COMFYUI_API_KEY          ?? ''),
          COMFYUI_WORKFLOW:               typeof r.COMFYUI_WORKFLOW === 'string' && r.COMFYUI_WORKFLOW
                                            ? (() => { try { return JSON.stringify(JSON.parse(r.COMFYUI_WORKFLOW as string), null, 2); } catch { return r.COMFYUI_WORKFLOW as string; } })()
                                            : '',
          COMFYUI_WORKFLOW_NODES:         nodesFromBackend(
                                            (r.COMFYUI_WORKFLOW_NODES as { type: string; key: string; node_ids: string | string[] }[]) ?? [],
                                            DEFAULT_WORKFLOW_NODES,
                                          ),
          IMAGES_GEMINI_API_BASE_URL:     String(r.IMAGES_GEMINI_API_BASE_URL    ?? ''),
          IMAGES_GEMINI_API_KEY:          String(r.IMAGES_GEMINI_API_KEY         ?? ''),
          IMAGES_GEMINI_ENDPOINT_METHOD:  String(r.IMAGES_GEMINI_ENDPOINT_METHOD ?? 'predict'),
          ENABLE_IMAGE_EDIT:              !!r.ENABLE_IMAGE_EDIT,
          IMAGE_EDIT_ENGINE:              String(r.IMAGE_EDIT_ENGINE   ?? 'openai'),
          IMAGE_EDIT_MODEL:               String(r.IMAGE_EDIT_MODEL    ?? ''),
          IMAGE_EDIT_SIZE:                String(r.IMAGE_EDIT_SIZE     ?? '512x512'),
          IMAGES_EDIT_OPENAI_API_BASE_URL: String(r.IMAGES_EDIT_OPENAI_API_BASE_URL ?? ''),
          IMAGES_EDIT_OPENAI_API_KEY:      String(r.IMAGES_EDIT_OPENAI_API_KEY      ?? ''),
          IMAGES_EDIT_OPENAI_API_VERSION:  String(r.IMAGES_EDIT_OPENAI_API_VERSION  ?? ''),
          IMAGES_EDIT_GEMINI_API_BASE_URL: String(r.IMAGES_EDIT_GEMINI_API_BASE_URL ?? ''),
          IMAGES_EDIT_GEMINI_API_KEY:      String(r.IMAGES_EDIT_GEMINI_API_KEY      ?? ''),
          IMAGES_EDIT_COMFYUI_BASE_URL:    String(r.IMAGES_EDIT_COMFYUI_BASE_URL    ?? ''),
          IMAGES_EDIT_COMFYUI_API_KEY:     String(r.IMAGES_EDIT_COMFYUI_API_KEY     ?? ''),
          IMAGES_EDIT_COMFYUI_WORKFLOW:    typeof r.IMAGES_EDIT_COMFYUI_WORKFLOW === 'string' && r.IMAGES_EDIT_COMFYUI_WORKFLOW
                                             ? (() => { try { return JSON.stringify(JSON.parse(r.IMAGES_EDIT_COMFYUI_WORKFLOW as string), null, 2); } catch { return r.IMAGES_EDIT_COMFYUI_WORKFLOW as string; } })()
                                             : '',
          IMAGES_EDIT_COMFYUI_WORKFLOW_NODES: nodesFromBackend(
                                               (r.IMAGES_EDIT_COMFYUI_WORKFLOW_NODES as { type: string; key: string; node_ids: string | string[] }[]) ?? [],
                                               DEFAULT_EDIT_NODES,
                                             ),
        });
      })
      .catch(() => toast.error('Failed to load image config'))
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof ImgState>(k: K, v: ImgState[K]) =>
    setCfg((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    const token = getToken();
    if (!token) return;

    // Validate required engine URLs
    const eng = cfg.IMAGE_GENERATION_ENGINE;
    if (cfg.ENABLE_IMAGE_GENERATION) {
      if (eng === 'automatic1111' && !cfg.AUTOMATIC1111_BASE_URL) {
        toast.error('AUTOMATIC1111 Base URL is required'); return;
      }
      if (eng === 'comfyui' && !cfg.COMFYUI_BASE_URL) {
        toast.error('ComfyUI Base URL is required'); return;
      }
      if (eng === 'openai' && !cfg.IMAGES_OPENAI_API_KEY) {
        toast.error('OpenAI API Key is required'); return;
      }
      if (eng === 'gemini' && !cfg.IMAGES_GEMINI_API_KEY) {
        toast.error('Gemini API Key is required'); return;
      }
    }

    // Parse JSON fields
    let openaiParams: Record<string, unknown> = {};
    let a1111Params:  Record<string, unknown> = {};
    let a1111Auth:    Record<string, unknown> | string = '';

    if (cfg.IMAGES_OPENAI_API_PARAMS.trim()) {
      try { openaiParams = JSON.parse(cfg.IMAGES_OPENAI_API_PARAMS); }
      catch { toast.error('Invalid JSON in OpenAI Additional Parameters'); return; }
    }
    if (cfg.AUTOMATIC1111_PARAMS.trim()) {
      try { a1111Params = JSON.parse(cfg.AUTOMATIC1111_PARAMS); }
      catch { toast.error('Invalid JSON in AUTOMATIC1111 Parameters'); return; }
    }
    a1111Auth = cfg.AUTOMATIC1111_API_AUTH.trim() || '';

    // Validate ComfyUI workflow JSON
    if (cfg.COMFYUI_WORKFLOW.trim()) {
      try { JSON.parse(cfg.COMFYUI_WORKFLOW); }
      catch { toast.error('Invalid JSON in ComfyUI Workflow'); return; }
    }

    // Serialize node_ids → arrays
    const serializeNodes = (nodes: { type: string; key: string; node_ids: string }[]) =>
      nodes.map((n) => ({
        type:     n.type,
        key:      n.key,
        node_ids: n.node_ids.trim() ? n.node_ids.split(',').map((s) => s.trim()) : [],
      }));

    setSaving(true);
    try {
      await updateImageConfig(token, {
        ENABLE_IMAGE_GENERATION:        cfg.ENABLE_IMAGE_GENERATION,
        ENABLE_IMAGE_PROMPT_GENERATION: cfg.ENABLE_IMAGE_PROMPT_GENERATION,
        IMAGE_GENERATION_ENGINE:        cfg.IMAGE_GENERATION_ENGINE,
        IMAGE_GENERATION_MODEL:         cfg.IMAGE_GENERATION_MODEL,
        IMAGE_SIZE:                     cfg.IMAGE_SIZE,
        IMAGE_STEPS:                    cfg.IMAGE_STEPS,
        IMAGES_OPENAI_API_BASE_URL:     cfg.IMAGES_OPENAI_API_BASE_URL,
        IMAGES_OPENAI_API_KEY:          cfg.IMAGES_OPENAI_API_KEY,
        IMAGES_OPENAI_API_VERSION:      cfg.IMAGES_OPENAI_API_VERSION,
        IMAGES_OPENAI_API_PARAMS:       openaiParams,
        AUTOMATIC1111_BASE_URL:         cfg.AUTOMATIC1111_BASE_URL,
        AUTOMATIC1111_API_AUTH:         a1111Auth,
        AUTOMATIC1111_PARAMS:           a1111Params,
        COMFYUI_BASE_URL:               cfg.COMFYUI_BASE_URL,
        COMFYUI_API_KEY:                cfg.COMFYUI_API_KEY,
        COMFYUI_WORKFLOW:               cfg.COMFYUI_WORKFLOW,
        COMFYUI_WORKFLOW_NODES:         serializeNodes(cfg.COMFYUI_WORKFLOW_NODES),
        IMAGES_GEMINI_API_BASE_URL:     cfg.IMAGES_GEMINI_API_BASE_URL,
        IMAGES_GEMINI_API_KEY:          cfg.IMAGES_GEMINI_API_KEY,
        IMAGES_GEMINI_ENDPOINT_METHOD:  cfg.IMAGES_GEMINI_ENDPOINT_METHOD,
        ENABLE_IMAGE_EDIT:              cfg.ENABLE_IMAGE_EDIT,
        IMAGE_EDIT_ENGINE:              cfg.IMAGE_EDIT_ENGINE,
        IMAGE_EDIT_MODEL:               cfg.IMAGE_EDIT_MODEL,
        IMAGE_EDIT_SIZE:                cfg.IMAGE_EDIT_SIZE,
        IMAGES_EDIT_OPENAI_API_BASE_URL: cfg.IMAGES_EDIT_OPENAI_API_BASE_URL,
        IMAGES_EDIT_OPENAI_API_KEY:      cfg.IMAGES_EDIT_OPENAI_API_KEY,
        IMAGES_EDIT_OPENAI_API_VERSION:  cfg.IMAGES_EDIT_OPENAI_API_VERSION,
        IMAGES_EDIT_GEMINI_API_BASE_URL: cfg.IMAGES_EDIT_GEMINI_API_BASE_URL,
        IMAGES_EDIT_GEMINI_API_KEY:      cfg.IMAGES_EDIT_GEMINI_API_KEY,
        IMAGES_EDIT_COMFYUI_BASE_URL:    cfg.IMAGES_EDIT_COMFYUI_BASE_URL,
        IMAGES_EDIT_COMFYUI_API_KEY:     cfg.IMAGES_EDIT_COMFYUI_API_KEY,
        IMAGES_EDIT_COMFYUI_WORKFLOW:    cfg.IMAGES_EDIT_COMFYUI_WORKFLOW,
        IMAGES_EDIT_COMFYUI_WORKFLOW_NODES: serializeNodes(cfg.IMAGES_EDIT_COMFYUI_WORKFLOW_NODES),
      });
      toast.success('Image settings saved');
    } catch {
      toast.error('Failed to save image settings');
    } finally {
      setSaving(false);
    }
  };

  const isLocalEngine = ['comfyui', 'automatic1111', ''].includes(cfg.IMAGE_GENERATION_ENGINE);

  if (loading) return <SkeletonCards />;

  return (
    <div className="flex flex-col gap-5">

      {/* ── Image Generation ─────────────────────────────────────────────────── */}
      <SettingsSection
        title="Image Generation"
        eyebrow="Create"
        description="Configure the image generation engine, credentials, and output defaults."
        onSave={handleSave}
        saving={saving}
      >
        <SettingsToggleRow
          label="Enable Image Generation"
          checked={cfg.ENABLE_IMAGE_GENERATION}
          onChange={(v) => set('ENABLE_IMAGE_GENERATION', v)}
        />

        {cfg.ENABLE_IMAGE_GENERATION && (
          <SettingsToggleRow
            label="Enable Image Prompt Generation"
            description="Automatically generate an optimised image prompt from the user's message."
            checked={cfg.ENABLE_IMAGE_PROMPT_GENERATION}
            onChange={(v) => set('ENABLE_IMAGE_PROMPT_GENERATION', v)}
          />
        )}

        <SettingsField label="Engine">
          <select value={cfg.IMAGE_GENERATION_ENGINE} onChange={(e) => set('IMAGE_GENERATION_ENGINE', e.target.value)} className={SELECT}>
            <option value="openai">OpenAI DALL·E</option>
            <option value="automatic1111">Automatic1111</option>
            <option value="comfyui">ComfyUI</option>
            <option value="gemini">Gemini</option>
          </select>
        </SettingsField>

        {/* OpenAI */}
        {cfg.IMAGE_GENERATION_ENGINE === 'openai' && (
          <>
            <SettingsField label="API Base URL">
              <input type="url" value={cfg.IMAGES_OPENAI_API_BASE_URL} onChange={(e) => set('IMAGES_OPENAI_API_BASE_URL', e.target.value)} placeholder="https://api.openai.com/v1" className={FIELD} />
            </SettingsField>
            <SettingsField label="API Key">
              <SensitiveInput value={cfg.IMAGES_OPENAI_API_KEY} onChange={(v) => set('IMAGES_OPENAI_API_KEY', v)} />
            </SettingsField>
            <SettingsField label="API Version" description="Leave empty unless using Azure OpenAI.">
              <input type="text" value={cfg.IMAGES_OPENAI_API_VERSION} onChange={(e) => set('IMAGES_OPENAI_API_VERSION', e.target.value)} placeholder="2024-02-01" className={FIELD} />
            </SettingsField>
            <SettingsField label="Additional Parameters (JSON)" description="Merged into the generation request body.">
              <textarea rows={3} value={cfg.IMAGES_OPENAI_API_PARAMS} onChange={(e) => set('IMAGES_OPENAI_API_PARAMS', e.target.value)} placeholder='{"quality": "hd"}' className="admin-input w-full rounded-[0.85rem] px-3 py-2 text-sm font-mono" />
            </SettingsField>
          </>
        )}

        {/* Automatic1111 */}
        {cfg.IMAGE_GENERATION_ENGINE === 'automatic1111' && (
          <>
            <SettingsField label="AUTOMATIC1111 Base URL" description="Include --api flag when starting stable-diffusion-webui.">
              <input type="url" value={cfg.AUTOMATIC1111_BASE_URL} onChange={(e) => set('AUTOMATIC1111_BASE_URL', e.target.value)} placeholder="http://127.0.0.1:7860/" className={FIELD} />
            </SettingsField>
            <SettingsField label="API Auth String" description="username:password — use --api-auth flag in webui.">
              <SensitiveInput value={cfg.AUTOMATIC1111_API_AUTH} onChange={(v) => set('AUTOMATIC1111_API_AUTH', v)} placeholder="username:password" />
            </SettingsField>
            <SettingsField label="Additional Parameters (JSON)">
              <textarea rows={3} value={cfg.AUTOMATIC1111_PARAMS} onChange={(e) => set('AUTOMATIC1111_PARAMS', e.target.value)} placeholder='{}' className="admin-input w-full rounded-[0.85rem] px-3 py-2 text-sm font-mono" />
            </SettingsField>
          </>
        )}

        {/* ComfyUI */}
        {cfg.IMAGE_GENERATION_ENGINE === 'comfyui' && (
          <>
            <SettingsField label="ComfyUI Base URL">
              <input type="url" value={cfg.COMFYUI_BASE_URL} onChange={(e) => set('COMFYUI_BASE_URL', e.target.value)} placeholder="http://127.0.0.1:8188/" className={FIELD} />
            </SettingsField>
            <SettingsField label="ComfyUI API Key">
              <SensitiveInput value={cfg.COMFYUI_API_KEY} onChange={(v) => set('COMFYUI_API_KEY', v)} />
            </SettingsField>
            <SettingsField label="Workflow (JSON)" description="Export as API format from ComfyUI.">
              <textarea rows={6} value={cfg.COMFYUI_WORKFLOW} onChange={(e) => set('COMFYUI_WORKFLOW', e.target.value)} placeholder="Paste workflow.json content here…" className="admin-input w-full rounded-[0.85rem] px-3 py-2 text-xs font-mono" />
            </SettingsField>
            {cfg.COMFYUI_WORKFLOW && (
              <SettingsField label="Workflow Node Mapping" description="Map workflow node types to their IDs and input keys. Prompt* is required.">
                <div className="flex flex-col gap-1.5">
                  <div className="grid grid-cols-3 gap-2 text-xs font-semibold mb-0.5" style={{ color: 'var(--bodhion-text-secondary)' }}>
                    <span>Type</span><span>Input Key</span><span>Node IDs (comma-sep)</span>
                  </div>
                  {cfg.COMFYUI_WORKFLOW_NODES.map((node, i) => (
                    <div key={node.type} className="grid grid-cols-3 gap-2">
                      <span className="text-xs pt-2 capitalize" style={{ color: 'var(--bodhion-text-secondary)' }}>{node.type}{node.type === 'prompt' ? '*' : ''}</span>
                      <input
                        type="text"
                        value={node.key}
                        onChange={(e) => {
                          const updated = [...cfg.COMFYUI_WORKFLOW_NODES];
                          updated[i] = { ...updated[i], key: e.target.value };
                          set('COMFYUI_WORKFLOW_NODES', updated);
                        }}
                        className="admin-input h-8 rounded-lg px-2 text-xs"
                        placeholder="key"
                      />
                      <input
                        type="text"
                        value={node.node_ids}
                        onChange={(e) => {
                          const updated = [...cfg.COMFYUI_WORKFLOW_NODES];
                          updated[i] = { ...updated[i], node_ids: e.target.value };
                          set('COMFYUI_WORKFLOW_NODES', updated);
                        }}
                        className="admin-input h-8 rounded-lg px-2 text-xs"
                        placeholder="1,2"
                      />
                    </div>
                  ))}
                </div>
              </SettingsField>
            )}
          </>
        )}

        {/* Gemini */}
        {cfg.IMAGE_GENERATION_ENGINE === 'gemini' && (
          <>
            <SettingsField label="Gemini API Base URL">
              <input type="url" value={cfg.IMAGES_GEMINI_API_BASE_URL} onChange={(e) => set('IMAGES_GEMINI_API_BASE_URL', e.target.value)} placeholder="https://generativelanguage.googleapis.com" className={FIELD} />
            </SettingsField>
            <SettingsField label="Gemini API Key">
              <SensitiveInput value={cfg.IMAGES_GEMINI_API_KEY} onChange={(v) => set('IMAGES_GEMINI_API_KEY', v)} />
            </SettingsField>
            <SettingsField label="Endpoint Method">
              <select value={cfg.IMAGES_GEMINI_ENDPOINT_METHOD} onChange={(e) => set('IMAGES_GEMINI_ENDPOINT_METHOD', e.target.value)} className={SELECT}>
                <option value="predict">predict</option>
                <option value="generateContent">generateContent</option>
              </select>
            </SettingsField>
          </>
        )}

        {/* Shared: model, size, steps */}
        <div className="grid grid-cols-2 gap-3">
          <SettingsField label="Default Model">
            <input type="text" value={cfg.IMAGE_GENERATION_MODEL} onChange={(e) => set('IMAGE_GENERATION_MODEL', e.target.value)} placeholder={cfg.IMAGE_GENERATION_ENGINE === 'openai' ? 'dall-e-3' : cfg.IMAGE_GENERATION_ENGINE === 'gemini' ? 'imagen-3.0-generate-002' : 'Select a model'} className={FIELD} />
          </SettingsField>
          <SettingsField label="Default Image Size" description="Format: WxH e.g. 1024x1024">
            <input type="text" value={cfg.IMAGE_SIZE} onChange={(e) => set('IMAGE_SIZE', e.target.value)} placeholder="1024x1024" className={FIELD} />
          </SettingsField>
        </div>

        {isLocalEngine && (
          <SettingsField label="Default Steps" description="Number of diffusion steps.">
            <input type="number" min={1} value={cfg.IMAGE_STEPS} onChange={(e) => set('IMAGE_STEPS', parseInt(e.target.value) || 20)} className={FIELD} />
          </SettingsField>
        )}
      </SettingsSection>

      {/* ── Image Editing ────────────────────────────────────────────────────── */}
      <SettingsSection
        title="Image Editing"
        eyebrow="Edit"
        description="Configure the engine used to edit or inpaint existing images."
        onSave={handleSave}
        saving={saving}
      >
        <SettingsToggleRow
          label="Enable Image Editing"
          checked={cfg.ENABLE_IMAGE_EDIT}
          onChange={(v) => set('ENABLE_IMAGE_EDIT', v)}
        />

        {cfg.ENABLE_IMAGE_EDIT && (
          <>
            <SettingsField label="Edit Engine">
              <select value={cfg.IMAGE_EDIT_ENGINE} onChange={(e) => set('IMAGE_EDIT_ENGINE', e.target.value)} className={SELECT}>
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
                <option value="comfyui">ComfyUI</option>
              </select>
            </SettingsField>

            {cfg.IMAGE_EDIT_ENGINE === 'openai' && (
              <>
                <SettingsField label="API Base URL">
                  <input type="url" value={cfg.IMAGES_EDIT_OPENAI_API_BASE_URL} onChange={(e) => set('IMAGES_EDIT_OPENAI_API_BASE_URL', e.target.value)} placeholder="https://api.openai.com/v1" className={FIELD} />
                </SettingsField>
                <SettingsField label="API Key">
                  <SensitiveInput value={cfg.IMAGES_EDIT_OPENAI_API_KEY} onChange={(v) => set('IMAGES_EDIT_OPENAI_API_KEY', v)} />
                </SettingsField>
                <SettingsField label="API Version">
                  <input type="text" value={cfg.IMAGES_EDIT_OPENAI_API_VERSION} onChange={(e) => set('IMAGES_EDIT_OPENAI_API_VERSION', e.target.value)} placeholder="2024-02-01" className={FIELD} />
                </SettingsField>
              </>
            )}

            {cfg.IMAGE_EDIT_ENGINE === 'gemini' && (
              <>
                <SettingsField label="Gemini API Base URL">
                  <input type="url" value={cfg.IMAGES_EDIT_GEMINI_API_BASE_URL} onChange={(e) => set('IMAGES_EDIT_GEMINI_API_BASE_URL', e.target.value)} placeholder="https://generativelanguage.googleapis.com" className={FIELD} />
                </SettingsField>
                <SettingsField label="Gemini API Key">
                  <SensitiveInput value={cfg.IMAGES_EDIT_GEMINI_API_KEY} onChange={(v) => set('IMAGES_EDIT_GEMINI_API_KEY', v)} />
                </SettingsField>
              </>
            )}

            {cfg.IMAGE_EDIT_ENGINE === 'comfyui' && (
              <>
                <SettingsField label="ComfyUI Base URL">
                  <input type="url" value={cfg.IMAGES_EDIT_COMFYUI_BASE_URL} onChange={(e) => set('IMAGES_EDIT_COMFYUI_BASE_URL', e.target.value)} placeholder="http://127.0.0.1:8188/" className={FIELD} />
                </SettingsField>
                <SettingsField label="ComfyUI API Key">
                  <SensitiveInput value={cfg.IMAGES_EDIT_COMFYUI_API_KEY} onChange={(v) => set('IMAGES_EDIT_COMFYUI_API_KEY', v)} />
                </SettingsField>
                <SettingsField label="Edit Workflow (JSON)">
                  <textarea rows={6} value={cfg.IMAGES_EDIT_COMFYUI_WORKFLOW} onChange={(e) => set('IMAGES_EDIT_COMFYUI_WORKFLOW', e.target.value)} placeholder="Paste edit workflow.json content here…" className="admin-input w-full rounded-[0.85rem] px-3 py-2 text-xs font-mono" />
                </SettingsField>
                {cfg.IMAGES_EDIT_COMFYUI_WORKFLOW && (
                  <SettingsField label="Edit Workflow Node Mapping">
                    <div className="flex flex-col gap-1.5">
                      <div className="grid grid-cols-3 gap-2 text-xs font-semibold mb-0.5" style={{ color: 'var(--bodhion-text-secondary)' }}>
                        <span>Type</span><span>Input Key</span><span>Node IDs</span>
                      </div>
                      {cfg.IMAGES_EDIT_COMFYUI_WORKFLOW_NODES.map((node, i) => (
                        <div key={node.type} className="grid grid-cols-3 gap-2">
                          <span className="text-xs pt-2 capitalize" style={{ color: 'var(--bodhion-text-secondary)' }}>{node.type}</span>
                          <input
                            type="text"
                            value={node.key}
                            onChange={(e) => {
                              const updated = [...cfg.IMAGES_EDIT_COMFYUI_WORKFLOW_NODES];
                              updated[i] = { ...updated[i], key: e.target.value };
                              set('IMAGES_EDIT_COMFYUI_WORKFLOW_NODES', updated);
                            }}
                            className="admin-input h-8 rounded-lg px-2 text-xs"
                            placeholder="key"
                          />
                          <input
                            type="text"
                            value={node.node_ids}
                            onChange={(e) => {
                              const updated = [...cfg.IMAGES_EDIT_COMFYUI_WORKFLOW_NODES];
                              updated[i] = { ...updated[i], node_ids: e.target.value };
                              set('IMAGES_EDIT_COMFYUI_WORKFLOW_NODES', updated);
                            }}
                            className="admin-input h-8 rounded-lg px-2 text-xs"
                            placeholder="1,2"
                          />
                        </div>
                      ))}
                    </div>
                  </SettingsField>
                )}
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <SettingsField label="Edit Model">
                <input type="text" value={cfg.IMAGE_EDIT_MODEL} onChange={(e) => set('IMAGE_EDIT_MODEL', e.target.value)} placeholder="dall-e-2" className={FIELD} />
              </SettingsField>
              <SettingsField label="Edit Image Size">
                <input type="text" value={cfg.IMAGE_EDIT_SIZE} onChange={(e) => set('IMAGE_EDIT_SIZE', e.target.value)} placeholder="512x512" className={FIELD} />
              </SettingsField>
            </div>
          </>
        )}
      </SettingsSection>
    </div>
  );
}

function SkeletonCards() {
  return (
    <div className="flex flex-col gap-5">
      {[5, 3].map((rows, i) => (
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

export default ImagesTab;
