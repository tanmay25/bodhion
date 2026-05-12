'use client';

import { SettingsSection, SettingsField, SettingsToggleRow } from '@/components/shared/SettingsSection';
import { SensitiveInput } from '@/components/shared/SensitiveInput';
import { Button } from '@/components/ui/Button';

const FIELD  = 'admin-input h-9 w-full rounded-md px-3 text-sm';
const SELECT = 'admin-select h-9 w-full rounded-md px-3 text-sm';

// Default models per engine so the field is pre-filled on engine switch
const DEFAULT_MODEL: Record<string, string> = {
  '':         'cross-encoder/ms-marco-MiniLM-L-6-v2', // Option A — local CrossEncoder
  'external': 'BAAI/bge-reranker-v2-m3',              // Option C — TEI / Cohere
};

interface Props {
  config:  Record<string, unknown>;
  set:     (key: string, value: unknown) => void;
  onSave:  () => void;
  saving:  boolean;
}

export function RagQueryConfig({ config, set, onSave, saving }: Props) {
  const fullContext  = !!config.RAG_FULL_CONTEXT;
  const hybridSearch = !!config.ENABLE_RAG_HYBRID_SEARCH;
  const rerankEngine = String(config.RAG_RERANKING_ENGINE ?? '');
  // Defect 2 fix: use the correct key RAG_HYBRID_BM25_WEIGHT (was HYBRID_BM25_WEIGHT)
  const bm25Weight   = config.RAG_HYBRID_BM25_WEIGHT as number | null ?? null;

  function handleEngineChange(engine: string) {
    set('RAG_RERANKING_ENGINE', engine);
    // Defect 4 fix: pre-fill correct default model per engine
    set('RAG_RERANKING_MODEL', DEFAULT_MODEL[engine] ?? '');
  }

  return (
    <SettingsSection
      title="Retrieval"
      description="Controls how documents are retrieved and ranked during chat."
      onSave={onSave}
      saving={saving}
    >
      {/* Full Context Mode */}
      <SettingsToggleRow
        label="Full Context Mode"
        description="Inject the entire document as context instead of segmented retrieval. Recommended for complex queries."
        checked={fullContext}
        onChange={(v) => set('RAG_FULL_CONTEXT', v)}
      />

      {!fullContext && (
        <>
          {/* ── Hybrid Search ─────────────────────────────────────── */}
          <SettingsToggleRow
            label="Hybrid Search"
            description="Combine semantic (embedding) and lexical (BM25) search."
            checked={hybridSearch}
            onChange={(v) => set('ENABLE_RAG_HYBRID_SEARCH', v)}
          />

          {hybridSearch && (
            <>
              <SettingsToggleRow
                label="Enrich Hybrid Search Text"
                description="Add filenames, titles, sections and snippets to BM25 text to improve lexical recall."
                checked={!!config.ENABLE_RAG_HYBRID_SEARCH_ENRICHED_TEXTS}
                onChange={(v) => set('ENABLE_RAG_HYBRID_SEARCH_ENRICHED_TEXTS', v)}
              />

              {/* Defect 2 fix: key is RAG_HYBRID_BM25_WEIGHT (was HYBRID_BM25_WEIGHT) */}
              <SettingsField label="BM25 Weight" description="0 = more semantic, 1 = more lexical. Default: 0.5.">
                <div className="flex items-center gap-3">
                  {bm25Weight === null ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => set('RAG_HYBRID_BM25_WEIGHT', 0.5)}
                    >
                      Set Custom
                    </Button>
                  ) : (
                    <>
                      <input
                        type="range"
                        min={0} max={1} step={0.05}
                        value={bm25Weight}
                        onChange={(e) => set('RAG_HYBRID_BM25_WEIGHT', parseFloat(e.target.value))}
                        className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
                        style={{ accentColor: 'var(--bodhion-accent)' }}
                      />
                      <input
                        type="number"
                        min={0} max={1} step={0.05}
                        value={bm25Weight}
                        onChange={(e) => set('RAG_HYBRID_BM25_WEIGHT', parseFloat(e.target.value))}
                        className="admin-input w-16 rounded-md px-2 text-sm text-center"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => set('RAG_HYBRID_BM25_WEIGHT', null)}
                      >
                        Reset
                      </Button>
                    </>
                  )}
                </div>
              </SettingsField>

              {/* ── Reranking (requires Hybrid Search) ───────────────── */}
              {/* Defect 5: descriptive label + hint text per engine option */}
              <SettingsField
                label="Reranking Engine"
                description="Reranking re-scores retrieved candidates for better relevance. Requires Hybrid Search."
              >
                <select
                  value={rerankEngine}
                  onChange={(e) => handleEngineChange(e.target.value)}
                  className={SELECT}
                >
                  <option value="">Local — SentenceTransformers CrossEncoder</option>
                  <option value="external">External — HuggingFace TEI / Cohere API</option>
                </select>
              </SettingsField>

              {/* Option C fields: shown only when engine = external */}
              {rerankEngine === 'external' && (
                <>
                  <SettingsField
                    label="Reranker API Base URL"
                    description="Endpoint that accepts POST /rerank with {query, documents}. Compatible with HuggingFace TEI and Cohere."
                  >
                    <input
                      type="url"
                      value={String(config.RAG_EXTERNAL_RERANKER_URL ?? '')}
                      onChange={(e) => set('RAG_EXTERNAL_RERANKER_URL', e.target.value)}
                      placeholder="http://localhost:8080/rerank"
                      className={FIELD}
                    />
                  </SettingsField>

                  <SettingsField label="Reranker API Key">
                    <SensitiveInput
                      value={String(config.RAG_EXTERNAL_RERANKER_API_KEY ?? '')}
                      onChange={(v) => set('RAG_EXTERNAL_RERANKER_API_KEY', v)}
                    />
                  </SettingsField>

                  {/* Defect 3 fix: add missing Timeout field for Option C */}
                  <SettingsField
                    label="Reranker Timeout (seconds)"
                    description="Max seconds to wait for the external reranker. Leave blank to use the system default."
                  >
                    <input
                      type="number"
                      min={1}
                      value={String(config.RAG_EXTERNAL_RERANKER_TIMEOUT ?? '')}
                      onChange={(e) => set('RAG_EXTERNAL_RERANKER_TIMEOUT', e.target.value)}
                      placeholder="30"
                      className={FIELD}
                    />
                  </SettingsField>
                </>
              )}

              <SettingsField
                label="Reranking Model"
                description={
                  rerankEngine === 'external'
                    ? 'Model name sent to the external reranker API (e.g. BAAI/bge-reranker-v2-m3).'
                    : 'HuggingFace model ID auto-downloaded for local CrossEncoder inference.'
                }
              >
                <input
                  type="text"
                  value={String(config.RAG_RERANKING_MODEL ?? DEFAULT_MODEL[rerankEngine] ?? '')}
                  onChange={(e) => set('RAG_RERANKING_MODEL', e.target.value)}
                  placeholder={DEFAULT_MODEL[rerankEngine] ?? ''}
                  className={FIELD}
                />
              </SettingsField>

              {/* Defect 2 fix: key is RAG_TOP_K_RERANKER (was TOP_K_RERANKER) */}
              <SettingsField label="Top K Reranker" description="Final number of documents returned after reranking.">
                <input
                  type="number"
                  min={1}
                  value={Number.isNaN(Number(config.RAG_TOP_K_RERANKER)) ? '' : Number(config.RAG_TOP_K_RERANKER ?? 4)}
                  onChange={(e) => { const v = parseInt(e.target.value); set('RAG_TOP_K_RERANKER', Number.isNaN(v) ? '' : v); }}
                  className={FIELD}
                />
              </SettingsField>

              {/* Defect 2 fix: key is RAG_RELEVANCE_THRESHOLD (was RELEVANCE_THRESHOLD) */}
              <SettingsField label="Relevance Threshold" description="Only return documents with a reranker score ≥ this value (0.0 – 1.0).">
                <input
                  type="number"
                  min={0} max={1} step={0.01}
                  value={Number.isNaN(Number(config.RAG_RELEVANCE_THRESHOLD)) ? '' : Number(config.RAG_RELEVANCE_THRESHOLD ?? 0)}
                  onChange={(e) => { const v = parseFloat(e.target.value); set('RAG_RELEVANCE_THRESHOLD', Number.isNaN(v) ? '' : v); }}
                  className={FIELD}
                />
              </SettingsField>
            </>
          )}

          {/* ── Top K (candidate retrieval pool) ──────────────────── */}
          <SettingsField
            label="Top K"
            description="Number of candidate documents retrieved before reranking. Use a larger value (e.g. 20) when reranking is enabled."
          >
            <input
              type="number"
              min={1}
              value={Number.isNaN(Number(config.RAG_TOP_K)) ? '' : Number(config.RAG_TOP_K ?? 4)}
              onChange={(e) => { const v = parseInt(e.target.value); set('RAG_TOP_K', Number.isNaN(v) ? '' : v); }}
              className={FIELD}
            />
          </SettingsField>
        </>
      )}

      {/* ── RAG Template ──────────────────────────────────────────── */}
      <SettingsField label="RAG Template" description="Leave empty to use the default prompt. Use [context] and [query] placeholders.">
        <textarea
          rows={5}
          value={String(config.RAG_TEMPLATE ?? '')}
          onChange={(e) => set('RAG_TEMPLATE', e.target.value)}
          placeholder="Leave empty to use the default prompt, or enter a custom prompt…"
          className="admin-input w-full rounded-md px-3 py-2 text-sm"
        />
      </SettingsField>
    </SettingsSection>
  );
}

export default RagQueryConfig;
