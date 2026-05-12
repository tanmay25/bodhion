'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getToken } from '@/lib/auth/session';
import { getSkillHubIndex, importSkillFromUrl } from '@/lib/api/workspace';
import type { HubSkill } from '@/lib/api/workspace';
import type { Skill } from '@/types/api';

const DEFAULT_HUB_URL = 'https://github.com/NousResearch/hermes-agent';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

interface Props {
  installedSkills: Skill[];
  onInstalled: (skill: Skill) => void;
}

export function SkillHubBrowser({ installedSkills, onInstalled }: Props) {
  // ── source config ───────────────────────────────────────────────────────────
  const [hubUrl, setHubUrl] = useState(DEFAULT_HUB_URL);
  const [githubToken, setGithubToken] = useState('');
  const [showToken, setShowToken] = useState(false);

  // ── load state ──────────────────────────────────────────────────────────────
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [hubSkills, setHubSkills] = useState<HubSkill[]>([]);

  // ── filter state ────────────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // ── install state ───────────────────────────────────────────────────────────
  const [installing, setInstalling] = useState<string | null>(null);

  const installedNames = useMemo(
    () => new Set(installedSkills.map((s) => s.name)),
    [installedSkills],
  );

  // ── load handler ────────────────────────────────────────────────────────────
  const handleLoad = async () => {
    if (!hubUrl.trim()) {
      toast.error('Enter a hub URL first');
      return;
    }
    const token = getToken();
    if (!token) return;

    setLoadState('loading');
    setErrorMsg('');
    setHubSkills([]);
    setQuery('');
    setSelectedCategory('');

    try {
      const index = await getSkillHubIndex(
        token,
        hubUrl.trim(),
        githubToken.trim() || undefined,
      );
      setHubSkills(index ?? []);
      setLoadState('loaded');
      if (!index?.length) {
        toast.info('No skills found at this hub URL');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load hub';
      setErrorMsg(msg);
      setLoadState('error');
      toast.error(msg);
    }
  };

  // ── install handler ─────────────────────────────────────────────────────────
  const handleInstall = async (skill: HubSkill) => {
    const token = getToken();
    if (!token) return;
    setInstalling(skill.raw_url);
    try {
      const created = await importSkillFromUrl(token, skill.raw_url);
      if (created) {
        toast.success(`"${created.name}" installed`);
        onInstalled(created);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Install failed';
      toast.error(msg);
    } finally {
      setInstalling(null);
    }
  };

  // ── derived ─────────────────────────────────────────────────────────────────
  const categories = useMemo(
    () => ['', ...Array.from(new Set(hubSkills.map((s) => s.category))).sort()],
    [hubSkills],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return hubSkills.filter(
      (s) =>
        (!selectedCategory || s.category === selectedCategory) &&
        (!q ||
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q))),
    );
  }, [hubSkills, query, selectedCategory]);

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Source config panel ── */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        {/* Hub URL */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Hub Source URL
          </label>
          <div className="flex gap-2">
            <Input
              value={hubUrl}
              onChange={(e) => setHubUrl(e.target.value)}
              placeholder="https://github.com/{owner}/{repo} or https://example.com/SKILL.md"
              className="flex-1 font-mono text-sm"
              onKeyDown={(e) => e.key === 'Enter' && void handleLoad()}
              disabled={loadState === 'loading'}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Accepts: GitHub repo URL, a direct SKILL.md URL, or a site with{' '}
            <code className="text-xs">/.well-known/agent-skills/index.json</code>
          </p>
        </div>

        {/* GitHub Token */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            GitHub Token
            <span className="ml-1 font-normal normal-case">
              (optional — overrides server default, raises rate limit to 5 000 req/hr)
            </span>
          </label>
          <div className="flex gap-2">
            <Input
              type={showToken ? 'text' : 'password'}
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="ghp_••••••••••••••••••••••••••••••••••••••"
              className="flex-1 font-mono text-sm"
              disabled={loadState === 'loading'}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowToken((v) => !v)}
              title={showToken ? 'Hide token' : 'Show token'}
            >
              {showToken ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Load button */}
        <div className="flex justify-end">
          <Button
            onClick={() => void handleLoad()}
            disabled={loadState === 'loading' || !hubUrl.trim()}
            className="gap-2"
          >
            {loadState === 'loading' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : loadState === 'loaded' ? (
              <RefreshCw className="h-4 w-4" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {loadState === 'loading'
              ? 'Loading…'
              : loadState === 'loaded'
                ? 'Refresh'
                : 'Load Skills'}
          </Button>
        </div>
      </div>

      {/* ── Idle state ── */}
      {loadState === 'idle' && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-2 text-muted-foreground">
          <Download className="h-8 w-8 opacity-30" />
          <p className="text-sm font-medium">No hub loaded yet</p>
          <p className="text-xs max-w-sm">
            Enter a hub URL above and click <strong>Load Skills</strong> to browse available
            skills. Leave the token blank to use the server's configured GitHub token.
          </p>
        </div>
      )}

      {/* ── Error state ── */}
      {loadState === 'error' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-medium">Failed to load hub</p>
          <p className="mt-1 text-xs break-all">{errorMsg}</p>
        </div>
      )}

      {/* ── Loaded state ── */}
      {loadState === 'loaded' && (
        <div className="space-y-3">
          {/* Filter bar */}
          <div className="flex gap-2">
            <Input
              placeholder="Search skills…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1"
            />
            <select
              className="border rounded-md px-3 py-2 text-sm bg-background"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c ? c.replace(/-/g, ' ') : 'All categories'}
                </option>
              ))}
            </select>
          </div>

          <p className="text-xs text-muted-foreground">
            {filtered.length} of {hubSkills.length} skill
            {hubSkills.length !== 1 ? 's' : ''}
          </p>

          {/* Skill grid */}
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">
              No skills match your search
            </p>
          ) : (
            <div className="grid gap-3">
              {filtered.map((skill) => {
                const installed = installedNames.has(skill.name);
                const isInstalling = installing === skill.raw_url;

                return (
                  <div
                    key={skill.raw_url}
                    className="border rounded-lg p-4 flex items-start justify-between gap-4 bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      {/* Header row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{skill.name}</span>
                        <Badge variant="outline" className="text-xs capitalize">
                          {skill.category.replace(/-/g, ' ')}
                        </Badge>
                        {skill.version && (
                          <span className="text-xs text-muted-foreground">
                            v{skill.version}
                          </span>
                        )}
                        {installed && (
                          <Badge className="text-xs bg-green-100 text-green-700 border border-green-200 gap-1 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                            <CheckCircle className="h-3 w-3" />
                            Installed
                          </Badge>
                        )}
                      </div>

                      {/* Description */}
                      {skill.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {skill.description}
                        </p>
                      )}

                      {/* Tags */}
                      {skill.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {skill.tags.slice(0, 6).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {skill.tags.length > 6 && (
                            <span className="text-xs text-muted-foreground self-center">
                              +{skill.tags.length - 6} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Author */}
                      {skill.author && (
                        <p className="text-xs text-muted-foreground mt-1.5">
                          by {skill.author}
                          {skill.license && (
                            <span className="ml-2 opacity-60">· {skill.license}</span>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 shrink-0">
                      {skill.homepage && (
                        <a
                          href={skill.homepage}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button size="sm" variant="ghost" title="View documentation">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                      <Button
                        size="sm"
                        variant={installed ? 'outline' : 'default'}
                        onClick={() => void handleInstall(skill)}
                        disabled={isInstalling}
                        className="gap-1.5"
                      >
                        {isInstalling ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        {installed ? 'Reinstall' : 'Install'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
