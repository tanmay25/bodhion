'use client';

// Slide-over drawer that renders the ModelEditorPanel.
// Opened from the admin ModelsTab when a model row is clicked.

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { ModelEditorPanel } from '@/components/workspace/models/ModelEditorPanel';

interface ModelEditorDrawerProps {
  modelId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function ModelEditorDrawer({ modelId, onClose, onSaved }: ModelEditorDrawerProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="med-backdrop"
        aria-hidden
        onClick={onClose}
      />

      {/* Panel */}
      <div className="med-panel" role="dialog" aria-modal aria-label="Edit Model">
        {/* Drawer header */}
        <div className="med-panel-header">
          <span className="med-panel-eyebrow">MODEL EDITOR</span>
          <button type="button" className="med-close" onClick={onClose} aria-label="Close editor">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="med-panel-body">
          <ModelEditorPanel
            modelId={modelId}
            showHeader={false}
            onSaved={onSaved}
            onClose={onClose}
          />
        </div>
      </div>

      <style>{`
        .med-backdrop {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(2px);
          animation: med-fade-in 0.15s ease;
        }
        @keyframes med-fade-in { from { opacity: 0; } to { opacity: 1; } }

        .med-panel {
          position: fixed; top: 0; right: 0; bottom: 0; z-index: 201;
          width: min(680px, 100vw);
          display: flex; flex-direction: column;
          background: var(--bodhion-bg, #0d1117);
          border-left: 1px solid var(--bodhion-card-border);
          box-shadow: -8px 0 48px rgba(0,0,0,0.55);
          animation: med-slide-in 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        @keyframes med-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }

        .med-panel-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.9rem 1.25rem;
          border-bottom: 1px solid var(--bodhion-card-border);
          flex-shrink: 0;
        }
        .med-panel-eyebrow {
          font-size: 0.65rem; font-weight: 700; letter-spacing: 0.13em;
          text-transform: uppercase; color: var(--bodhion-accent, #25d7ff);
        }
        .med-close {
          background: none; border: none; cursor: pointer; padding: 0.3rem;
          border-radius: 0.4rem; color: var(--bodhion-text-secondary);
          display: flex; align-items: center;
        }
        .med-close:hover { color: var(--bodhion-text-primary); background: rgba(255,255,255,0.07); }

        .med-panel-body {
          flex: 1; overflow-y: auto; padding: 1rem 1.25rem 2rem;
          scrollbar-width: thin;
          scrollbar-color: var(--bodhion-card-border) transparent;
        }
      `}</style>
    </>
  );
}

export default ModelEditorDrawer;
