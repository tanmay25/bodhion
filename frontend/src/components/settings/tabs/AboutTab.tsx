'use client';

import { useState } from 'react';
import { APP_VERSION, APP_BUILD_HASH } from '@/lib/api/client';
import { getVersion } from '@/lib/api/auth';
import { getToken } from '@/lib/auth/session';
import { RefreshCw, CheckCircle2, AlertCircle, Cpu, MessageSquare, FileText, Globe, Mic } from 'lucide-react';

const FEATURES = [
  { icon: MessageSquare, label: 'Multi-model Chat' },
  { icon: Cpu,           label: 'Local & Cloud AI' },
  { icon: FileText,      label: 'Document RAG' },
  { icon: Mic,           label: 'Voice Interface' },
  { icon: Globe,         label: 'Web Search' },
];

export function AboutTab() {
  const [checking,      setChecking]      = useState(false);
  const [updateStatus,  setUpdateStatus]  = useState<'latest' | 'available' | 'error' | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  const checkForUpdates = async () => {
    const token = getToken();
    if (!token) return;
    setChecking(true);
    setUpdateStatus(null);
    try {
      const data = await getVersion(token);
      const latest = data.version;
      setLatestVersion(latest ?? null);
      setUpdateStatus(latest && latest !== APP_VERSION ? 'available' : 'latest');
    } catch {
      setUpdateStatus('error');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="settings-tab-content">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="about-hero">
        <div className="about-hero-glow" aria-hidden="true" />

        {/* Icon with ring */}
        <div className="about-hero-icon-wrap">
          <img src="/static/bodhion_icon.svg" alt="Bodhion" className="about-hero-logo" />
        </div>

        {/* Info column */}
        <div className="about-hero-info">
          <div className="about-hero-title-row">
            <h2 className="about-hero-name">Bodhion</h2>
            <span className="about-hero-version-badge">v{APP_VERSION}</span>
          </div>
          <p className="about-hero-tagline">Your intelligent AI assistant platform</p>
          <div className="about-hero-maker">
            <span className="about-hero-by">Built by</span>
            <span className="about-hero-creator">Tanmay Mondal</span>
          </div>
        </div>
      </div>

      {/* ── Description ───────────────────────────────────────────────────── */}
      <div className="settings-section">
        <p className="about-desc">
          Bodhion is an enterprise-ready, open-source AI chat platform that brings together
          multiple large language models — local and cloud-hosted — into a single, unified
          interface. Designed for teams and individuals who want full control over their AI
          workflows without compromising on power or privacy.
        </p>
        <div className="about-features">
          {FEATURES.map(({ icon: Icon, label }) => (
            <span key={label} className="about-feature-pill">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Version ───────────────────────────────────────────────────────── */}
      <div className="settings-section">
        <div className="settings-section-title">Version</div>
        <div className="settings-info-row">
          <span className="settings-info-label">Version</span>
          <span className="settings-info-value">v{APP_VERSION}</span>
        </div>
        <div className="settings-info-row">
          <span className="settings-info-label">Build</span>
          <span className="settings-info-value settings-info-mono" title={APP_BUILD_HASH}>
            {APP_BUILD_HASH}
          </span>
        </div>
        <div className="about-update-row">
          <button
            type="button"
            className="about-update-btn"
            onClick={() => void checkForUpdates()}
            disabled={checking}
          >
            <RefreshCw className={`h-3.5 w-3.5${checking ? ' animate-spin' : ''}`} />
            {checking ? 'Checking…' : 'Check for updates'}
          </button>
          {updateStatus === 'latest' && (
            <span className="about-status about-status--ok">
              <CheckCircle2 className="h-3.5 w-3.5" /> You&apos;re up to date
            </span>
          )}
          {updateStatus === 'available' && (
            <span className="about-status about-status--new">
              <CheckCircle2 className="h-3.5 w-3.5" /> v{latestVersion} available
            </span>
          )}
          {updateStatus === 'error' && (
            <span className="about-status about-status--err">
              <AlertCircle className="h-3.5 w-3.5" /> Could not check for updates
            </span>
          )}
        </div>
      </div>

{/* ── Legal ─────────────────────────────────────────────────────────── */}
      <div className="settings-section">
        <div className="settings-section-title">Legal</div>
        <p className="settings-section-desc">
          Emoji graphics provided by{' '}
          <a href="https://github.com/jdecked/twemoji" target="_blank" rel="noreferrer" className="settings-link">
            Twemoji
          </a>
          , licensed under{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="settings-link">
            CC-BY 4.0
          </a>.
        </p>
        <p className="about-copyright">
          &copy; {new Date().getFullYear()}{' '}
          <a href="mailto:t.mondal25@gmail.com" className="settings-link">
            Tanmay Mondal
          </a>{' '}
          All rights reserved.
        </p>
      </div>

    </div>
  );
}
