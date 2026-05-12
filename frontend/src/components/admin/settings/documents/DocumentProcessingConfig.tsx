'use client';

import { SettingsSection, SettingsField, SettingsToggleRow } from '@/components/shared/SettingsSection';
import { SensitiveInput } from '@/components/shared/SensitiveInput';

const FIELD      = 'admin-input h-9 w-full rounded-md px-3 text-sm';
const SELECT     = 'admin-select h-9 w-full rounded-md px-3 text-sm';
const SUB_PANEL  = 'rounded-lg border border-border/60 bg-muted/20 p-4 space-y-4';
const SUB_HEAD   = 'text-xs font-semibold uppercase tracking-wider text-muted-foreground';
const DIVIDER    = 'border-t border-border/40 pt-4';

function toLabel(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const PROCESSOR_META: Record<string, string> = {
  filter_cover_toc:         'Removes cover pages and table-of-contents chunks before indexing.',
  strip_image_placeholders: 'Strips [IMAGE] placeholder tokens left by the extractor.',
  deduplicate_tables:       'Eliminates duplicate table blocks that appear across multiple pages.',
  normalize_tables:         'Collapses PDF-fragmented tables where words are split across many narrow columns into readable plain text.',
  filter_min_content:       'Drops chunks below a minimum character threshold to reduce noise.',
  inject_context_prefix:    'Prepends document title and section heading to each chunk for richer retrieval.',
};

interface Props {
  config:     Record<string, unknown>;
  set:        (key: string, value: unknown) => void;
  onSave:     () => void;
  saving:     boolean;
  processors: string[];
  strategies: string[];
}

export function DocumentProcessingConfig({ config, set, onSave, saving, processors, strategies }: Props) {
  const engine       = String(config.CONTENT_EXTRACTION_ENGINE ?? '');
  const bypass       = !!config.BYPASS_EMBEDDING_AND_RETRIEVAL;
  const mdHeader     = !!config.ENABLE_MARKDOWN_HEADER_TEXT_SPLITTER;
  const textSplitter = String(config.TEXT_SPLITTER ?? '');

  // Pipeline variables — hoisted so all three cards can read them
  const engineKey = engine || 'default';
  const profiles  = (config.RAG_PROCESSOR_PROFILES   as Record<string, string[]> | undefined) ?? {};
  const stratMap  = (config.RAG_CHUNKING_STRATEGY_MAP as Record<string, string>   | undefined) ?? {};
  const active    = profiles[engineKey] ?? [];
  const strategy  = stratMap[engineKey] ?? '';

  return (
    <>
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          Card 1 — Extraction Engine
          Engine picker + engine-specific connection / behaviour
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <SettingsSection
        title="Extraction Engine"
        description="How documents are parsed before embedding."
        onSave={onSave}
        saving={saving}
      >
        <SettingsField label="Content Extraction Engine">
          <select
            value={engine}
            onChange={(e) => set('CONTENT_EXTRACTION_ENGINE', e.target.value)}
            className={SELECT}
          >
            <option value="">Default</option>
            <option value="external">External</option>
            <option value="tika">Tika</option>
            <option value="docling">Docling</option>
            <option value="datalab_marker">Datalab Marker API</option>
            <option value="document_intelligence">Document Intelligence</option>
            <option value="mistral_ocr">Mistral OCR</option>
            <option value="mineru">MinerU</option>
            <option value="bodhion-native-extractor">Bodhion Native Extractor</option>
            <option value="bodhion-secgem-extractor">Bodhion SecGEM Extractor (SEMI/GEM/SECS)</option>
          </select>
        </SettingsField>

        {/* Default ── PDF options */}
        {engine === '' && (
          <div className={SUB_PANEL}>
            <SettingsToggleRow
              label="PDF Extract Images (OCR)"
              checked={!!config.PDF_EXTRACT_IMAGES}
              onChange={(v) => set('PDF_EXTRACT_IMAGES', v)}
            />
            <SettingsField
              label="PDF Loader Mode"
              description="Page mode: one document per page. Single mode: all pages as one document."
            >
              <select
                value={String(config.PDF_LOADER_MODE ?? 'page')}
                onChange={(e) => set('PDF_LOADER_MODE', e.target.value)}
                className={SELECT}
              >
                <option value="page">Page</option>
                <option value="single">Single</option>
              </select>
            </SettingsField>
          </div>
        )}

        {/* External */}
        {engine === 'external' && (
          <div className={SUB_PANEL}>
            <p className={SUB_HEAD}>Connection</p>
            <SettingsField label="External Document Loader URL">
              <input type="url" value={String(config.EXTERNAL_DOCUMENT_LOADER_URL ?? '')} onChange={(e) => set('EXTERNAL_DOCUMENT_LOADER_URL', e.target.value)} placeholder="https://loader.example.com" className={FIELD} />
            </SettingsField>
            <SettingsField label="API Key">
              <SensitiveInput value={String(config.EXTERNAL_DOCUMENT_LOADER_API_KEY ?? '')} onChange={(v) => set('EXTERNAL_DOCUMENT_LOADER_API_KEY', v)} />
            </SettingsField>
          </div>
        )}

        {/* Tika */}
        {engine === 'tika' && (
          <div className={SUB_PANEL}>
            <p className={SUB_HEAD}>Connection</p>
            <SettingsField label="Tika Server URL">
              <input type="url" value={String(config.TIKA_SERVER_URL ?? '')} onChange={(e) => set('TIKA_SERVER_URL', e.target.value)} placeholder="http://localhost:9998" className={FIELD} />
            </SettingsField>
          </div>
        )}

        {/* Docling */}
        {engine === 'docling' && (
          <div className={SUB_PANEL}>
            <p className={SUB_HEAD}>Connection</p>
            <SettingsField label="Docling Server URL">
              <input type="url" value={String(config.DOCLING_SERVER_URL ?? '')} onChange={(e) => set('DOCLING_SERVER_URL', e.target.value)} placeholder="http://localhost:5001" className={FIELD} />
            </SettingsField>
            <SettingsField label="API Key">
              <SensitiveInput value={String(config.DOCLING_API_KEY ?? '')} onChange={(v) => set('DOCLING_API_KEY', v)} />
            </SettingsField>
            <div className={DIVIDER}>
              <p className={`${SUB_HEAD} mb-3`}>Parameters</p>
              <SettingsField label="Docling Parameters" description="Additional parameters in JSON format.">
                <textarea rows={4} value={String(config.DOCLING_PARAMS ?? '')} onChange={(e) => set('DOCLING_PARAMS', e.target.value)} placeholder='{"key": "value"}' className="admin-input w-full rounded-md px-3 py-2 text-sm font-mono" />
              </SettingsField>
            </div>
          </div>
        )}

        {/* Datalab Marker */}
        {engine === 'datalab_marker' && (
          <div className={SUB_PANEL}>
            <p className={SUB_HEAD}>Connection</p>
            <SettingsField label="API Base URL">
              <input type="url" value={String(config.DATALAB_MARKER_API_BASE_URL ?? '')} onChange={(e) => set('DATALAB_MARKER_API_BASE_URL', e.target.value)} placeholder="https://www.datalab.to/api/v1/marker" className={FIELD} />
            </SettingsField>
            <SettingsField label="API Key">
              <SensitiveInput value={String(config.DATALAB_MARKER_API_KEY ?? '')} onChange={(v) => set('DATALAB_MARKER_API_KEY', v)} />
            </SettingsField>
            <SettingsField label="Output Format">
              <select value={String(config.DATALAB_MARKER_OUTPUT_FORMAT ?? 'markdown')} onChange={(e) => set('DATALAB_MARKER_OUTPUT_FORMAT', e.target.value)} className={SELECT}>
                <option value="markdown">Markdown</option>
                <option value="json">JSON</option>
                <option value="html">HTML</option>
              </select>
            </SettingsField>
            <SettingsField label="Additional Config" description='JSON string, e.g. {"disable_links": true}'>
              <textarea rows={3} value={String(config.DATALAB_MARKER_ADDITIONAL_CONFIG ?? '')} onChange={(e) => set('DATALAB_MARKER_ADDITIONAL_CONFIG', e.target.value)} placeholder='{"disable_links": false}' className="admin-input w-full rounded-md px-3 py-2 text-sm font-mono" />
            </SettingsField>
            <div className={DIVIDER}>
              <p className={`${SUB_HEAD} mb-3`}>Behaviour</p>
              <div className="space-y-1">
                <SettingsToggleRow label="Use LLM"                  description="Improves tables, forms, inline math detection. Increases latency."        checked={!!config.DATALAB_MARKER_USE_LLM}                  onChange={(v) => set('DATALAB_MARKER_USE_LLM', v)} />
                <SettingsToggleRow label="Skip Cache"               description="Skip cache and re-run inference."                                          checked={!!config.DATALAB_MARKER_SKIP_CACHE}               onChange={(v) => set('DATALAB_MARKER_SKIP_CACHE', v)} />
                <SettingsToggleRow label="Force OCR"                description="Force OCR on all pages. May reduce quality if PDF has good text."         checked={!!config.DATALAB_MARKER_FORCE_OCR}                onChange={(v) => set('DATALAB_MARKER_FORCE_OCR', v)} />
                <SettingsToggleRow label="Paginate"                 description="Separate pages with a horizontal rule and page number."                   checked={!!config.DATALAB_MARKER_PAGINATE}                 onChange={(v) => set('DATALAB_MARKER_PAGINATE', v)} />
                <SettingsToggleRow label="Strip Existing OCR"       description="Strip existing OCR text and re-run OCR. Ignored if Force OCR is enabled." checked={!!config.DATALAB_MARKER_STRIP_EXISTING_OCR}       onChange={(v) => set('DATALAB_MARKER_STRIP_EXISTING_OCR', v)} />
                <SettingsToggleRow label="Disable Image Extraction" description="Disable image extraction from PDF."                                       checked={!!config.DATALAB_MARKER_DISABLE_IMAGE_EXTRACTION} onChange={(v) => set('DATALAB_MARKER_DISABLE_IMAGE_EXTRACTION', v)} />
                <SettingsToggleRow label="Format Lines"             description="Detect inline math and styles within lines."                               checked={!!config.DATALAB_MARKER_FORMAT_LINES}             onChange={(v) => set('DATALAB_MARKER_FORMAT_LINES', v)} />
              </div>
            </div>
          </div>
        )}

        {/* Document Intelligence */}
        {engine === 'document_intelligence' && (
          <div className={SUB_PANEL}>
            <p className={SUB_HEAD}>Connection</p>
            <SettingsField label="Endpoint">
              <input type="url" value={String(config.DOCUMENT_INTELLIGENCE_ENDPOINT ?? '')} onChange={(e) => set('DOCUMENT_INTELLIGENCE_ENDPOINT', e.target.value)} placeholder="https://your-resource.cognitiveservices.azure.com/" className={FIELD} />
            </SettingsField>
            <SettingsField label="Key">
              <SensitiveInput value={String(config.DOCUMENT_INTELLIGENCE_KEY ?? '')} onChange={(v) => set('DOCUMENT_INTELLIGENCE_KEY', v)} />
            </SettingsField>
            <SettingsField label="Model">
              <input type="text" value={String(config.DOCUMENT_INTELLIGENCE_MODEL ?? '')} onChange={(e) => set('DOCUMENT_INTELLIGENCE_MODEL', e.target.value)} placeholder="prebuilt-layout" className={FIELD} />
            </SettingsField>
          </div>
        )}

        {/* Mistral OCR */}
        {engine === 'mistral_ocr' && (
          <div className={SUB_PANEL}>
            <p className={SUB_HEAD}>Connection</p>
            <SettingsField label="API Base URL">
              <input type="url" value={String(config.MISTRAL_OCR_API_BASE_URL ?? '')} onChange={(e) => set('MISTRAL_OCR_API_BASE_URL', e.target.value)} placeholder="https://api.mistral.ai/v1" className={FIELD} />
            </SettingsField>
            <SettingsField label="API Key">
              <SensitiveInput value={String(config.MISTRAL_OCR_API_KEY ?? '')} onChange={(v) => set('MISTRAL_OCR_API_KEY', v)} />
            </SettingsField>
          </div>
        )}

        {/* MinerU */}
        {engine === 'mineru' && (
          <div className={SUB_PANEL}>
            <p className={SUB_HEAD}>Connection</p>
            <SettingsField label="API Mode">
              <select value={String(config.MINERU_API_MODE ?? 'local')} onChange={(e) => set('MINERU_API_MODE', e.target.value)} className={SELECT}>
                <option value="local">Local</option>
                <option value="cloud">Cloud</option>
              </select>
            </SettingsField>
            <SettingsField label="API URL">
              <input type="url" value={String(config.MINERU_API_URL ?? '')} onChange={(e) => set('MINERU_API_URL', e.target.value)} placeholder={config.MINERU_API_MODE === 'cloud' ? 'https://mineru.net/api/v4' : 'http://localhost:8000'} className={FIELD} />
            </SettingsField>
            <SettingsField label="API Key">
              <SensitiveInput value={String(config.MINERU_API_KEY ?? '')} onChange={(v) => set('MINERU_API_KEY', v)} />
            </SettingsField>
            <SettingsField label="Timeout (seconds)">
              <input type="number" min={1} value={Number(config.MINERU_API_TIMEOUT ?? 60)} onChange={(e) => set('MINERU_API_TIMEOUT', parseInt(e.target.value))} className={FIELD} />
            </SettingsField>
            <div className={DIVIDER}>
              <p className={`${SUB_HEAD} mb-3`}>Parameters</p>
              <SettingsField label="Parameters" description="Advanced parameters: enable_ocr, enable_formula, enable_table, language, model_version, page_ranges.">
                <textarea rows={4} value={String(config.MINERU_PARAMS ?? '')} onChange={(e) => set('MINERU_PARAMS', e.target.value)} placeholder={`{\n  "enable_ocr": false,\n  "enable_formula": true,\n  "enable_table": true\n}`} className="admin-input w-full rounded-md px-3 py-2 text-sm font-mono" />
              </SettingsField>
            </div>
          </div>
        )}

        {/* Bodhion Native Extractor */}
        {engine === 'bodhion-native-extractor' && (
          <div className={SUB_PANEL}>
            <p className={SUB_HEAD}>Document Parsing</p>
            <SettingsToggleRow
              label="Extract Tables"
              description="Detect and convert complex tables to Markdown format using pdfplumber."
              checked={config.BODHION_NATIVE_EXTRACT_TABLES !== false}
              onChange={(v) => set('BODHION_NATIVE_EXTRACT_TABLES', v)}
            />
            <div className={DIVIDER}>
              <p className={`${SUB_HEAD} mb-3`}>Image Extraction</p>
              <div className="space-y-3">
                <SettingsToggleRow label="Extract Images" description="Detect raster images embedded in the PDF." checked={config.BODHION_NATIVE_EXTRACT_IMAGES !== false} onChange={(v) => set('BODHION_NATIVE_EXTRACT_IMAGES', v)} />
                <SettingsToggleRow label="OCR Images" description="Run Tesseract OCR on extracted images. Requires Extract Images and the Tesseract binary on the server." checked={config.BODHION_NATIVE_OCR_IMAGES !== false} onChange={(v) => set('BODHION_NATIVE_OCR_IMAGES', v)} />
                <div className="grid grid-cols-2 gap-3">
                  <SettingsField label="Min Width (px)" description="Images narrower than this are skipped.">
                    <input type="number" min={1} value={Number(config.BODHION_NATIVE_IMAGE_MIN_WIDTH ?? 50)} onChange={(e) => set('BODHION_NATIVE_IMAGE_MIN_WIDTH', parseInt(e.target.value))} className={FIELD} />
                  </SettingsField>
                  <SettingsField label="Min Height (px)" description="Images shorter than this are skipped.">
                    <input type="number" min={1} value={Number(config.BODHION_NATIVE_IMAGE_MIN_HEIGHT ?? 50)} onChange={(e) => set('BODHION_NATIVE_IMAGE_MIN_HEIGHT', parseInt(e.target.value))} className={FIELD} />
                  </SettingsField>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bodhion SecGEM Extractor */}
        {engine === 'bodhion-secgem-extractor' && (
          <div className={SUB_PANEL}>
            <p className={SUB_HEAD}>Document Parsing</p>
            <div className="space-y-1">
              <SettingsToggleRow label="Extract Tables"           description="Detect and convert SEMI attribute, state, CEID, VID, and ALID tables to annotated Markdown."    checked={config.BODHION_SECGEM_EXTRACT_TABLES !== false}           onChange={(v) => set('BODHION_SECGEM_EXTRACT_TABLES', v)} />
              <SettingsToggleRow label="Detect SECS Message Blocks" description="Detect S#F# message definitions and wrap them in fenced ```secs code blocks."              checked={config.BODHION_SECGEM_DETECT_SECS_BLOCKS !== false}       onChange={(v) => set('BODHION_SECGEM_DETECT_SECS_BLOCKS', v)} />
              <SettingsToggleRow label="Annotate SEMI Table Types"  description="Classify tables as attribute / state / CEID / VID / ALID / error and add HTML comments."   checked={config.BODHION_SECGEM_ANNOTATE_SEMI_TABLES !== false}     onChange={(v) => set('BODHION_SECGEM_ANNOTATE_SEMI_TABLES', v)} />
              <SettingsToggleRow label="Preserve Section Context"   description="Track section hierarchy across pages and add section_path metadata to each chunk."         checked={config.BODHION_SECGEM_PRESERVE_SECTION_CONTEXT !== false} onChange={(v) => set('BODHION_SECGEM_PRESERVE_SECTION_CONTEXT', v)} />
            </div>
            <div className={DIVIDER}>
              <p className={`${SUB_HEAD} mb-3`}>Image Extraction</p>
              <div className="space-y-3">
                <SettingsToggleRow label="Extract Images" description="Detect raster images embedded in the PDF." checked={config.BODHION_SECGEM_EXTRACT_IMAGES !== false} onChange={(v) => set('BODHION_SECGEM_EXTRACT_IMAGES', v)} />
                <SettingsToggleRow label="OCR Images" description="Run Tesseract OCR on extracted images. Requires Extract Images and the Tesseract binary on the server." checked={config.BODHION_SECGEM_OCR_IMAGES !== false} onChange={(v) => set('BODHION_SECGEM_OCR_IMAGES', v)} />
                <div className="grid grid-cols-2 gap-3">
                  <SettingsField label="Min Width (px)" description="Images narrower than this are skipped.">
                    <input type="number" min={1} value={Number(config.BODHION_SECGEM_IMAGE_MIN_WIDTH ?? 50)} onChange={(e) => set('BODHION_SECGEM_IMAGE_MIN_WIDTH', parseInt(e.target.value))} className={FIELD} />
                  </SettingsField>
                  <SettingsField label="Min Height (px)" description="Images shorter than this are skipped.">
                    <input type="number" min={1} value={Number(config.BODHION_SECGEM_IMAGE_MIN_HEIGHT ?? 50)} onChange={(e) => set('BODHION_SECGEM_IMAGE_MIN_HEIGHT', parseInt(e.target.value))} className={FIELD} />
                  </SettingsField>
                </div>
              </div>
            </div>
          </div>
        )}
      </SettingsSection>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          Card 2 — Post-Processing Pipeline
          Per-engine processor checklist + chunking strategy
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {(processors.length > 0 || strategies.length > 0) && (
        <SettingsSection
          title="Post-Processing Pipeline"
          description="Steps applied after extraction, and the chunking strategy for the active engine."
          onSave={onSave}
          saving={saving}
        >
          {processors.length > 0 && (
            <div className="space-y-3">
              {/* Pipeline label + active badge */}
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Pipeline for{' '}
                  <code className="bg-muted px-1 py-0.5 rounded text-[11px]">{engineKey}</code>
                  {' '}— enabled steps run left-to-right in order.
                </p>
                {active.length > 0 && (
                  <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {active.length} active
                  </span>
                )}
              </div>

              {/* Active pipeline flow visualisation */}
              {active.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5 rounded-lg bg-muted/50 border border-border">
                  {active.map((proc, i) => (
                    <div key={proc} className="flex items-center gap-1.5">
                      {i > 0 && <span className="text-muted-foreground text-xs select-none">→</span>}
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/20">
                        <span className="text-[10px] font-bold opacity-50">{i + 1}</span>
                        {toLabel(proc)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Processor checklist */}
              <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
                {processors.map((proc) => {
                  const isActive   = active.includes(proc);
                  const stepNum    = active.indexOf(proc) + 1;
                  const isEnricher = proc === 'secgem_llm_enricher' && engineKey === 'bodhion-secgem-extractor';
                  return (
                    <div key={proc}>
                      <label
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none transition-colors hover:bg-muted/40 ${isActive ? 'bg-primary/5' : 'bg-background'}`}
                      >
                        {/* Step badge */}
                        <div className={`shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                          {isActive ? stepNum : '·'}
                        </div>
                        {/* Label + description */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground">{toLabel(proc)}</span>
                            <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded hidden sm:inline">{proc}</code>
                          </div>
                          {PROCESSOR_META[proc] && (
                            <p className="text-xs text-muted-foreground mt-0.5">{PROCESSOR_META[proc]}</p>
                          )}
                        </div>
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          className="shrink-0 h-4 w-4 rounded border-border accent-primary"
                          checked={isActive}
                          onChange={(e) => {
                            const updated = e.target.checked
                              ? [...active, proc]
                              : active.filter((p) => p !== proc);
                            set('RAG_PROCESSOR_PROFILES', { ...profiles, [engineKey]: updated });
                          }}
                        />
                      </label>

                      {/* Inline enricher settings — expands when secgem_llm_enricher is checked */}
                      {isEnricher && isActive && (
                        <div className="px-4 pb-4 pt-3 border-t border-border/50 bg-primary/5 space-y-3">
                          <SettingsField label="Ollama Base URL" description="Base URL of the Ollama instance.">
                            <input type="text" value={String(config.SECGEM_LLM_ENRICHER_OLLAMA_BASE_URL ?? 'http://localhost:11434')} onChange={(e) => set('SECGEM_LLM_ENRICHER_OLLAMA_BASE_URL', e.target.value)} className={FIELD} placeholder="http://localhost:11434" />
                          </SettingsField>
                          <SettingsField label="Model" description="Ollama model name for enrichment prompts.">
                            <input type="text" value={String(config.SECGEM_LLM_ENRICHER_MODEL ?? 'mistral')} onChange={(e) => set('SECGEM_LLM_ENRICHER_MODEL', e.target.value)} className={FIELD} placeholder="mistral" />
                          </SettingsField>
                          <SettingsField label="Timeout (seconds)" description="Per-call timeout. Enrichment is skipped if exceeded.">
                            <input type="number" min={1} value={Number(config.SECGEM_LLM_ENRICHER_TIMEOUT ?? 30)} onChange={(e) => set('SECGEM_LLM_ENRICHER_TIMEOUT', parseInt(e.target.value))} className={FIELD} />
                          </SettingsField>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chunking strategy — moved here from the old IIFE, belongs with the pipeline */}
          {strategies.length > 0 && (
            <SettingsField
              label="Chunking Strategy"
              description={`Strategy used to split extracted text for the "${engineKey}" engine. Overrides the global Text Splitter setting.`}
            >
              <select
                value={strategy}
                onChange={(e) => set('RAG_CHUNKING_STRATEGY_MAP', { ...stratMap, [engineKey]: e.target.value })}
                className={SELECT}
              >
                <option value="">Use global Text Splitter setting</option>
                {strategies.map((s) => (
                  <option key={s} value={s}>{toLabel(s)}</option>
                ))}
              </select>
            </SettingsField>
          )}
        </SettingsSection>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          Card 3 — Chunking & Splitting
          Bypass toggle (primary) + global splitter settings
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <SettingsSection
        title="Chunking & Splitting"
        description="How extracted text is divided into chunks before embedding."
        onSave={onSave}
        saving={saving}
      >
        {/* Bypass toggle — most impactful setting, placed first */}
        <SettingsToggleRow
          label="Bypass Embedding and Retrieval"
          description="Inject the entire document as context (Full Context Mode). Recommended for complex queries over short documents."
          checked={bypass}
          onChange={(v) => set('BYPASS_EMBEDDING_AND_RETRIEVAL', v)}
        />

        {!bypass && (
          <>
            <SettingsField label="Text Splitter">
              <select value={textSplitter} onChange={(e) => set('TEXT_SPLITTER', e.target.value)} className={SELECT}>
                <option value="">Default (Character)</option>
                <option value="token">Token (Tiktoken)</option>
              </select>
            </SettingsField>

            <SettingsToggleRow
              label="Markdown Header Text Splitter"
              description="Split documents by markdown headers before applying character/token splitting."
              checked={mdHeader}
              onChange={(v) => set('ENABLE_MARKDOWN_HEADER_TEXT_SPLITTER', v)}
            />

            <div className="grid grid-cols-2 gap-3">
              <SettingsField label="Chunk Size">
                <input type="number" min={0} value={Number(config.CHUNK_SIZE ?? 1500)} onChange={(e) => set('CHUNK_SIZE', parseInt(e.target.value))} className={FIELD} />
              </SettingsField>
              <SettingsField label="Chunk Overlap">
                <input type="number" min={0} value={Number(config.CHUNK_OVERLAP ?? 100)} onChange={(e) => set('CHUNK_OVERLAP', parseInt(e.target.value))} className={FIELD} />
              </SettingsField>
            </div>

            {mdHeader && (
              <SettingsField label="Chunk Min Size Target" description="Chunks smaller than this will be merged with neighbours. Set 0 to disable.">
                <input type="number" min={0} value={Number(config.CHUNK_MIN_SIZE_TARGET ?? 0)} onChange={(e) => set('CHUNK_MIN_SIZE_TARGET', parseInt(e.target.value))} className={FIELD} />
              </SettingsField>
            )}
          </>
        )}
      </SettingsSection>
    </>
  );
}

export default DocumentProcessingConfig;
