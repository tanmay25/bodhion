'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

export interface CodeEditorHandle {
  getValue: () => string;
  setValue: (val: string) => void;
}

interface CodeEditorProps {
  value?:    string;
  language?: 'python' | 'javascript' | 'json';
  onChange?: (val: string) => void;
  onSave?:   () => void;
  height?:   number | string;
  readOnly?: boolean;
}

const isLightTheme = () => {
  if (typeof document === 'undefined') return false;
  const cl = document.documentElement.classList;
  return cl.contains('light') || cl.contains('bodhion-light');
};

const isMidnightTheme = () => {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('bodhion-midnight');
};

/**
 * SSR-safe CodeMirror 6 editor with Python / JS / JSON support.
 * Dynamically switches between dark and light themes based on the
 * Bodhion theme classes on <html> (light / bodhion-light → light theme;
 * dark / bodhion-dark / bodhion-midnight → one-dark theme).
 */
const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(
  (
    {
      value    = '',
      language = 'python',
      onChange,
      onSave,
      height   = '100%',
      readOnly = false,
    },
    ref
  ) => {
    const containerRef       = useRef<HTMLDivElement>(null);
    const viewRef            = useRef<unknown>(null);
    const mountedRef         = useRef(false);
    const themeCompartRef    = useRef<unknown>(null);

    useImperativeHandle(ref, () => ({
      getValue: () => {
        if (!viewRef.current) return value;
        const v = viewRef.current as { state: { doc: { toString(): string } } };
        return v.state.doc.toString();
      },
      setValue: (val: string) => {
        if (!viewRef.current) return;
        const v = viewRef.current as {
          dispatch: (t: unknown) => void;
          state: { doc: { toString(): string }; update(obj: object): unknown };
        };
        v.dispatch(
          v.state.update({
            changes: { from: 0, to: v.state.doc.toString().length, insert: val },
          })
        );
      },
    }));

    useEffect(() => {
      if (!containerRef.current || mountedRef.current) return;
      mountedRef.current = true;

      let cancelled = false;
      let observer: MutationObserver | null = null;

      (async () => {
        const [
          { EditorView, keymap, lineNumbers, highlightActiveLine },
          { defaultKeymap, historyKeymap, history, indentWithTab },
          { python },
          { javascript },
          { json },
          { oneDark },
          { syntaxHighlighting, defaultHighlightStyle, indentOnInput },
          { Compartment },
        ] = await Promise.all([
          import('@codemirror/view'),
          import('@codemirror/commands'),
          import('@codemirror/lang-python'),
          import('@codemirror/lang-javascript'),
          import('@codemirror/lang-json'),
          import('@codemirror/theme-one-dark'),
          import('@codemirror/language'),
          import('@codemirror/state'),
        ]);

        if (cancelled || !containerRef.current) return;

        // ── Light theme definition ──────────────────────────────────────────
        const lightTheme = EditorView.theme(
          {
            '&': {
              background: '#f0f7ff',
              color: '#1a3350',
            },
            '.cm-content': {
              caretColor: '#0f5aa6',
            },
            '.cm-cursor, .cm-dropCursor': {
              borderLeftColor: '#0f5aa6',
            },
            '.cm-activeLine': {
              backgroundColor: 'rgba(15, 90, 166, 0.06)',
            },
            '.cm-gutters': {
              background: '#e6f0fa',
              borderRight: '1px solid rgba(15, 90, 166, 0.12)',
              color: '#7a9ab8',
            },
            '.cm-activeLineGutter': {
              backgroundColor: 'rgba(15, 90, 166, 0.1)',
            },
            '.cm-selectionBackground, ::selection': {
              backgroundColor: 'rgba(15, 90, 166, 0.2) !important',
            },
            '&.cm-editor.cm-focused .cm-selectionBackground': {
              backgroundColor: 'rgba(15, 90, 166, 0.25) !important',
            },
            '.cm-matchingBracket': {
              backgroundColor: 'rgba(15, 90, 166, 0.15)',
              outline: '1px solid rgba(15, 90, 166, 0.3)',
            },
          },
          { dark: false }
        );

        // ── Midnight-specific accent override ───────────────────────────────
        const midnightAccent = EditorView.theme({
          '&.cm-editor.cm-focused': {
            outline: '1px solid rgba(68,200,255,0.45)',
          },
        });

        const themeCompartment = new Compartment();
        themeCompartRef.current = themeCompartment;

        const buildThemeExtensions = () => {
          if (isLightTheme()) {
            return [lightTheme, syntaxHighlighting(defaultHighlightStyle)];
          }
          if (isMidnightTheme()) {
            return [oneDark, midnightAccent];
          }
          return [oneDark];
        };

        const langExtension =
          language === 'python'     ? python()     :
          language === 'javascript' ? javascript() :
          json();

        const saveKeymap = onSave
          ? keymap.of([{
              key: 'Mod-s',
              run: () => { onSave(); return true; },
            }])
          : [];

        const view = new EditorView({
          doc: value,
          extensions: [
            history(),
            lineNumbers(),
            highlightActiveLine(),
            indentOnInput(),
            syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
            keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
            saveKeymap,
            langExtension,
            themeCompartment.of(buildThemeExtensions()),
            EditorView.updateListener.of((update) => {
              if (update.docChanged && onChange) {
                onChange(update.state.doc.toString());
              }
            }),
            EditorView.editable.of(!readOnly),
            EditorView.theme({
              '&': {
                height:     typeof height === 'number' ? `${height}px` : height,
                fontSize:   '13px',
                fontFamily: '"Fira Code", "JetBrains Mono", ui-monospace, monospace',
                borderRadius: '8px',
              },
              '.cm-scroller': {
                overflow: 'auto',
              },
              '.cm-focused': {
                outline: 'none',
              },
            }),
          ],
          parent: containerRef.current,
        });

        viewRef.current = view;

        // ── Watch <html> class changes and swap theme compartment ───────────
        observer = new MutationObserver(() => {
          if (!viewRef.current) return;
          const v = viewRef.current as {
            dispatch: (t: { effects: unknown }) => void;
          };
          v.dispatch({
            effects: themeCompartment.reconfigure(buildThemeExtensions()),
          });
        });
        observer.observe(document.documentElement, {
          attributes:      true,
          attributeFilter: ['class'],
        });
      })();

      return () => {
        cancelled = true;
        mountedRef.current = false;
        observer?.disconnect();
        if (viewRef.current) {
          (viewRef.current as { destroy(): void }).destroy();
          viewRef.current = null;
        }
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [language, readOnly]);

    return (
      <div
        ref={containerRef}
        style={{
          height:       typeof height === 'number' ? `${height}px` : height,
          overflow:     'hidden',
          borderRadius: '8px',
          border:       '1px solid var(--bodhion-card-border)',
        }}
      />
    );
  }
);

CodeEditor.displayName = 'CodeEditor';
export default CodeEditor;
export { CodeEditor };
