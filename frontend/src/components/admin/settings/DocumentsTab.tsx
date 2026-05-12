'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getToken } from '@/lib/auth/session';
import {
  getRAGConfig,
  updateRAGConfig,
  getEmbeddingConfig,
  updateEmbeddingConfig,
  defaultEmbeddingConfig,
  getRerankerStatus,
  getProcessors,
  getStrategies,
  type EmbeddingConfig,
} from '@/lib/api/admin/settings';
import { DocumentProcessingConfig } from './documents/DocumentProcessingConfig';
import { EmbeddingConfigSection }   from './documents/EmbeddingConfig';
import { RagQueryConfig }           from './documents/RagQueryConfig';
import { FilesConfig }              from './documents/FilesConfig';
import { AdminLoadingSplash }       from '@/components/admin/AdminLoadingSplash';

export function DocumentsTab() {
  const [loading,  setLoading]   = useState(true);
  const [saving,   setSaving]    = useState(false);
  const rerankerPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop any in-flight poll when the component unmounts
  useEffect(() => () => {
    if (rerankerPollRef.current) clearInterval(rerankerPollRef.current);
  }, []);

  function startRerankerPolling(token: string, model: string) {
    if (rerankerPollRef.current) clearInterval(rerankerPollRef.current);

    const loadingToastId = toast.loading(`Downloading reranker model: ${model}…`);

    rerankerPollRef.current = setInterval(async () => {
      try {
        const s = await getRerankerStatus(token);
        if (s?.status === 'ready') {
          clearInterval(rerankerPollRef.current!);
          rerankerPollRef.current = null;
          toast.dismiss(loadingToastId);
          toast.success(`Reranker ready: ${s.model}`);
        } else if (s?.status === 'error') {
          clearInterval(rerankerPollRef.current!);
          rerankerPollRef.current = null;
          toast.dismiss(loadingToastId);
          toast.error(`Reranker failed to load: ${s.error ?? s.model}`);
        }
        // status === 'loading' → keep polling
      } catch {
        // network hiccup — keep polling silently
      }
    }, 2000);
  }

  const [ragConfig,       setRagConfig]       = useState<Record<string, unknown>>({});
  const [embeddingConfig, setEmbeddingConfig] = useState<EmbeddingConfig>(defaultEmbeddingConfig());
  const [processors,      setProcessors]      = useState<string[]>([]);
  const [strategies,      setStrategies]      = useState<string[]>([]);

  // ── Load all configs on mount ─────────────────────────────────────────────
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    Promise.all([
      getRAGConfig(token).then((c) => {
        const cfg = (c as Record<string, unknown>) ?? {};
        // Normalise arrays → comma-separated strings for the UI
        if (Array.isArray(cfg.ALLOWED_FILE_EXTENSIONS)) {
          cfg.ALLOWED_FILE_EXTENSIONS = (cfg.ALLOWED_FILE_EXTENSIONS as string[]).join(', ');
        }
        // Normalise JSON objects → pretty-printed strings
        if (cfg.DOCLING_PARAMS && typeof cfg.DOCLING_PARAMS === 'object') {
          cfg.DOCLING_PARAMS = JSON.stringify(cfg.DOCLING_PARAMS, null, 2);
        }
        if (cfg.MINERU_PARAMS && typeof cfg.MINERU_PARAMS === 'object') {
          cfg.MINERU_PARAMS = JSON.stringify(cfg.MINERU_PARAMS, null, 2);
        }
        setRagConfig(cfg);
      }),
      getEmbeddingConfig(token).then((c) => {
        if (c) setEmbeddingConfig(c);
      }),
      getProcessors(token).then((r) => setProcessors(r?.processors ?? [])),
      getStrategies(token).then((r) => setStrategies(r?.strategies ?? [])),
    ])
      .catch(() => toast.error('Failed to load Documents config'))
      .finally(() => setLoading(false));
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const setRag = (key: string, value: unknown) =>
    setRagConfig((prev) => ({ ...prev, [key]: value }));

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const token = getToken();
    if (!token) return;

    // Validate content-extraction engine required fields
    const engine = String(ragConfig.CONTENT_EXTRACTION_ENGINE ?? '');
    if (engine === 'external' && !ragConfig.EXTERNAL_DOCUMENT_LOADER_URL) {
      toast.error('External Document Loader URL is required');
      return;
    }
    if (engine === 'tika' && !ragConfig.TIKA_SERVER_URL) {
      toast.error('Tika Server URL is required');
      return;
    }
    if (engine === 'docling' && !ragConfig.DOCLING_SERVER_URL) {
      toast.error('Docling Server URL is required');
      return;
    }
    if (engine === 'document_intelligence' && !ragConfig.DOCUMENT_INTELLIGENCE_ENDPOINT) {
      toast.error('Document Intelligence Endpoint is required');
      return;
    }
    if (engine === 'mistral_ocr' && !ragConfig.MISTRAL_OCR_API_KEY) {
      toast.error('Mistral OCR API Key is required');
      return;
    }
    if (engine === 'mineru' && ragConfig.MINERU_API_MODE === 'cloud' && !ragConfig.MINERU_API_KEY) {
      toast.error('MinerU API Key is required for Cloud API mode');
      return;
    }

    // Validate JSON fields
    for (const field of ['DOCLING_PARAMS', 'MINERU_PARAMS', 'DATALAB_MARKER_ADDITIONAL_CONFIG'] as const) {
      const val = ragConfig[field];
      if (typeof val === 'string' && val.trim() !== '') {
        try { JSON.parse(val); } catch {
          toast.error(`Invalid JSON in ${field}`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      // Build normalised RAG config payload
      const ragPayload = { ...ragConfig };

      // Convert comma-separated extensions back to array
      if (typeof ragPayload.ALLOWED_FILE_EXTENSIONS === 'string') {
        ragPayload.ALLOWED_FILE_EXTENSIONS = (ragPayload.ALLOWED_FILE_EXTENSIONS as string)
          .split(',').map((ext) => ext.trim()).filter(Boolean);
      }
      // Convert JSON strings back to objects
      for (const field of ['DOCLING_PARAMS', 'MINERU_PARAMS'] as const) {
        if (typeof ragPayload[field] === 'string') {
          const str = (ragPayload[field] as string).trim();
          ragPayload[field] = str !== '' ? JSON.parse(str) : {};
        }
      }

      // Save both configs concurrently (embedding first per Svelte pattern)
      await updateEmbeddingConfig(token, embeddingConfig);
      await updateRAGConfig(token, ragPayload);

      toast.success('Documents settings saved');

      // If a local reranker model is configured, kick off status polling so the
      // UI shows download/load progress without blocking the save response.
      const hybridOn = !!ragConfig.ENABLE_RAG_HYBRID_SEARCH;
      const engine   = String(ragConfig.RAG_RERANKING_ENGINE ?? '');
      const model    = String(ragConfig.RAG_RERANKING_MODEL  ?? '');
      if (hybridOn && engine !== 'external' && model) {
        startRerankerPolling(token, model);
      }
    } catch {
      toast.error('Failed to save Documents settings');
    } finally {
      setSaving(false);
    }
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) return <AdminLoadingSplash title="Loading documents config…" subtitle="Fetching RAG and embedding settings" minHeight="380px" />;

  // ── Only show Embedding and Retrieval when not bypassing ──────────────────
  const bypass = !!ragConfig.BYPASS_EMBEDDING_AND_RETRIEVAL;

  return (
    <div className="flex flex-col gap-5">
      <DocumentProcessingConfig
        config={ragConfig}
        set={setRag}
        onSave={handleSave}
        saving={saving}
        processors={processors}
        strategies={strategies}
      />

      {!bypass && (
        <>
          <EmbeddingConfigSection
            config={embeddingConfig}
            onChange={setEmbeddingConfig}
            onSave={handleSave}
            saving={saving}
          />

          <RagQueryConfig
            config={ragConfig}
            set={setRag}
            onSave={handleSave}
            saving={saving}
          />
        </>
      )}

      <FilesConfig
        config={ragConfig}
        set={setRag}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
}


export default DocumentsTab;
