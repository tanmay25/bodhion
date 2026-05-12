'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Download, Upload, Trash2, ChevronDown } from 'lucide-react';
import { getToken } from '@/lib/auth/session';
import { SettingsSection, SettingsField } from '@/components/shared/SettingsSection';
import { Button } from '@/components/ui/Button';
import {
  getPipelinesList,
  getPipelines,
  getPipelineValvesSpec,
  getPipelineValves,
  updatePipelineValves,
  downloadPipeline,
  deletePipeline,
  uploadPipeline,
  type Pipeline,
} from '@/lib/api/admin/pipelines';

const FIELD = 'admin-input h-9 w-full rounded-md px-3 text-sm';

export function PipelinesTab() {
  const [loading,        setLoading]        = useState(true);
  const [pipelineUrls,   setPipelineUrls]   = useState<string[]>([]);
  const [selectedUrlIdx, setSelectedUrlIdx] = useState('');
  const [pipelines,      setPipelines]      = useState<Pipeline[]>([]);
  const [selectedPipe,   setSelectedPipe]   = useState<Pipeline | null>(null);
  const [valvesSpec,     setValvesSpec]      = useState<Record<string, unknown> | null>(null);
  const [valves,         setValves]          = useState<Record<string, unknown>>({});
  const [savingValves,   setSavingValves]    = useState(false);
  const [downloadUrl,    setDownloadUrl]     = useState('');
  const [downloading,    setDownloading]     = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    getPipelinesList(token)
      .then((res) => {
        const urls = (res?.pipelines ?? []).map((p: { url: string }) => p.url);
        setPipelineUrls(urls);
        if (urls.length > 0) setSelectedUrlIdx(urls[0]);
      })
      .catch(() => toast.error('Failed to load pipeline servers'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedUrlIdx) return;
    const token = getToken();
    if (!token) return;
    getPipelines(token, selectedUrlIdx)
      .then((res) => setPipelines(res?.data ?? []))
      .catch(() => setPipelines([]));
  }, [selectedUrlIdx]);

  const loadValves = async (pipe: Pipeline) => {
    setSelectedPipe(pipe);
    setValvesSpec(null);
    setValves({});
    const token = getToken();
    if (!token || !pipe.valves) return;
    const [spec, vals] = await Promise.all([
      getPipelineValvesSpec(token, pipe.id, selectedUrlIdx).catch(() => null),
      getPipelineValves(token, pipe.id, selectedUrlIdx).catch(() => ({})),
    ]);
    setValvesSpec(spec);
    setValves((vals as Record<string, unknown>) ?? {});
  };

  const saveValves = async () => {
    if (!selectedPipe) return;
    const token = getToken();
    if (!token) return;
    setSavingValves(true);
    try {
      await updatePipelineValves(token, selectedPipe.id, valves, selectedUrlIdx);
      toast.success('Valves saved');
    } catch {
      toast.error('Failed to save valves');
    } finally {
      setSavingValves(false);
    }
  };

  const handleDownload = async () => {
    if (!downloadUrl) return;
    const token = getToken();
    if (!token) return;
    setDownloading(true);
    try {
      await downloadPipeline(token, downloadUrl, selectedUrlIdx);
      toast.success('Pipeline downloaded');
      setDownloadUrl('');
      const res = await getPipelines(token, selectedUrlIdx);
      setPipelines(res?.data ?? []);
    } catch {
      toast.error('Failed to download pipeline');
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async (pipe: Pipeline) => {
    const token = getToken();
    if (!token) return;
    try {
      await deletePipeline(token, pipe.id, selectedUrlIdx);
      toast.success('Pipeline deleted');
      setPipelines((prev) => prev.filter((p) => p.id !== pipe.id));
      if (selectedPipe?.id === pipe.id) setSelectedPipe(null);
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = getToken();
    if (!token) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      await uploadPipeline(token, fd, selectedUrlIdx);
      toast.success('Pipeline uploaded');
      const res = await getPipelines(token, selectedUrlIdx);
      setPipelines(res?.data ?? []);
    } catch {
      toast.error('Failed to upload');
    }
    e.target.value = '';
  };

  if (loading) return <SkeletonCard />;

  if (pipelineUrls.length === 0) {
    return (
      <div className="rounded-xl p-8 text-center" style={{ background: 'var(--bodhion-card-bg)', border: '1px solid var(--bodhion-card-border)' }}>
        <p className="text-sm" style={{ color: 'var(--bodhion-text-secondary)' }}>
          No pipeline servers configured. Add a Pipelines server URL in Connections first.
        </p>
      </div>
    );
  }

  const properties = (valvesSpec as { properties?: Record<string, { type?: string; title?: string; description?: string }> })?.properties ?? {};

  return (
    <div className="flex flex-col gap-5">
      {/* Server selector */}
      {pipelineUrls.length > 1 && (
        <SettingsSection title="Pipeline Server">
          <div className="relative">
            <select
              value={selectedUrlIdx}
              onChange={(e) => setSelectedUrlIdx(e.target.value)}
              className="admin-select h-9 w-full rounded-md px-3 text-sm"
            >
              {pipelineUrls.map((url) => (
                <option key={url} value={url}>{url}</option>
              ))}
            </select>
          </div>
        </SettingsSection>
      )}

      {/* Pipeline list */}
      <SettingsSection
        title="Installed Pipelines"
        action={
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors" style={{ background: 'var(--bodhion-search-bg)', color: 'var(--bodhion-text-secondary)', border: '1px solid var(--bodhion-search-border)' }}>
            <Upload className="h-3.5 w-3.5" /> Upload
            <input type="file" accept=".py" className="hidden" onChange={handleUpload} />
          </label>
        }
      >
        {pipelines.length === 0 ? (
          <p className="py-2 text-sm" style={{ color: 'var(--bodhion-text-secondary)' }}>No pipelines installed.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {pipelines.map((pipe) => (
              <div
                key={pipe.id}
                className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 transition-colors ${selectedPipe?.id === pipe.id ? 'bg-[rgba(37,215,255,0.08)]' : 'hover:bg-[rgba(255,255,255,0.03)]'}`}
                onClick={() => loadValves(pipe)}
              >
                <span className="text-sm font-medium" style={{ color: 'var(--bodhion-text-primary)' }}>{pipe.name}</span>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {pipe.valves && <ChevronDown className="h-3.5 w-3.5" style={{ color: 'var(--bodhion-text-secondary)' }} />}
                  <button onClick={() => handleDelete(pipe)} className="rounded p-1 transition-colors hover:text-[rgba(248,113,113,0.9)]" style={{ color: 'var(--bodhion-text-secondary)' }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsSection>

      {/* Valves editor */}
      {selectedPipe?.valves && (
        <SettingsSection title={`Valves — ${selectedPipe.name}`} onSave={saveValves} saving={savingValves}>
          {Object.entries(properties).map(([key, spec]) => (
            <SettingsField key={key} label={spec.title ?? key} description={spec.description}>
              {spec.type === 'boolean' ? (
                <input type="checkbox" checked={!!valves[key]} onChange={(e) => setValves((p) => ({ ...p, [key]: e.target.checked }))} className="h-4 w-4 rounded" />
              ) : (
                <input
                  type={spec.type === 'integer' || spec.type === 'number' ? 'number' : 'text'}
                  value={String(valves[key] ?? '')}
                  onChange={(e) => setValves((p) => ({ ...p, [key]: e.target.value }))}
                  className={FIELD}
                />
              )}
            </SettingsField>
          ))}
        </SettingsSection>
      )}

      {/* Download pipeline */}
      <SettingsSection title="Download Pipeline from URL">
        <SettingsField label="Pipeline URL">
          <div className="flex gap-2">
            <input type="url" value={downloadUrl} onChange={(e) => setDownloadUrl(e.target.value)} placeholder="https://…/pipeline.py" className={`${FIELD} flex-1`} />
            <Button onClick={handleDownload} disabled={downloading || !downloadUrl} size="sm">
              {downloading ? '…' : <Download className="h-4 w-4" />}
            </Button>
          </div>
        </SettingsField>
      </SettingsSection>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--bodhion-card-bg)', border: '1px solid var(--bodhion-card-border)' }}>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 w-full animate-pulse rounded" style={{ background: 'var(--bodhion-search-bg)' }} />
        ))}
      </div>
    </div>
  );
}

export default PipelinesTab;
