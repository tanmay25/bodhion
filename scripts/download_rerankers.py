"""
scripts/download_rerankers.py
Pre-download all supported cross-encoder reranker models to the local
HuggingFace cache so the backend can load them offline / instantly.

Usage:
    python scripts/download_rerankers.py              # download all 3 models
    python scripts/download_rerankers.py --model BAAI/bge-reranker-v2-m3

The cache directory respects the SENTENCE_TRANSFORMERS_HOME env var — the same
variable the backend reads in get_model_path(). Set it in .env to control where
models are stored (e.g. a shared network drive or a persistent Docker volume).
"""

import argparse
import os
import sys
import time


# ── Models catalogue ──────────────────────────────────────────────────────────

MODELS = [
    {
        "id":    "cross-encoder/ms-marco-MiniLM-L-6-v2",
        "size":  "66 MB",
        "notes": "Best CPU default — fast, low memory, good quality",
        "env":   "RAG_RERANKING_MODEL=cross-encoder/ms-marco-MiniLM-L-6-v2",
    },
    {
        "id":    "cross-encoder/ms-marco-MiniLM-L-12-v2",
        "size":  "133 MB",
        "notes": "Better quality — still CPU-friendly, ~2× slower than L-6",
        "env":   "RAG_RERANKING_MODEL=cross-encoder/ms-marco-MiniLM-L-12-v2",
    },
    {
        "id":    "BAAI/bge-reranker-v2-m3",
        "size":  "568 MB",
        "notes": "Best quality, multilingual — GPU recommended for low latency",
        "env":   "RAG_RERANKING_MODEL=BAAI/bge-reranker-v2-m3",
    },
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def hr(char="─", width=70):
    print(char * width)


def download_model(model_id: str, cache_dir: str | None) -> str:
    from huggingface_hub import snapshot_download

    print(f"  Downloading: {model_id}")
    if cache_dir:
        print(f"  Cache dir  : {cache_dir}")
    else:
        print("  Cache dir  : HuggingFace default (~/.cache/huggingface/hub)")

    t0 = time.time()
    path = snapshot_download(
        repo_id=model_id,
        cache_dir=cache_dir,
        local_files_only=False,
    )
    elapsed = time.time() - t0
    print(f"  Cached at  : {path}")
    print(f"  Time       : {elapsed:.1f}s")
    return path


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Pre-download reranker models.")
    parser.add_argument(
        "--model",
        metavar="MODEL_ID",
        help="Download a single model by HuggingFace repo ID instead of all three.",
    )
    args = parser.parse_args()

    # Respect the same cache dir the backend uses
    cache_dir = os.getenv("SENTENCE_TRANSFORMERS_HOME") or None

    try:
        import huggingface_hub  # noqa: F401
    except ImportError:
        print("ERROR: huggingface_hub is not installed.")
        print("       Run: pip install huggingface_hub")
        sys.exit(1)

    targets = MODELS if not args.model else [
        m for m in MODELS if m["id"] == args.model
    ]
    if args.model and not targets:
        # Allow arbitrary model IDs not in the catalogue
        targets = [{"id": args.model, "size": "?", "notes": "custom", "env": f"RAG_RERANKING_MODEL={args.model}"}]

    hr("═")
    print("  Bodhion — Reranker Model Downloader")
    hr("═")
    print()

    results = []
    for i, model in enumerate(targets, 1):
        hr()
        print(f"  [{i}/{len(targets)}] {model['id']}")
        print(f"  Size  : {model['size']}")
        print(f"  Notes : {model['notes']}")
        hr()
        try:
            path = download_model(model["id"], cache_dir)
            results.append({"model": model, "path": path, "ok": True})
        except Exception as e:
            print(f"  ERROR : {e}")
            results.append({"model": model, "path": None, "ok": False})
        print()

    # ── Summary ───────────────────────────────────────────────────────────────
    hr("═")
    print("  Download summary")
    hr("═")
    for r in results:
        status = "OK " if r["ok"] else "ERR"
        print(f"  [{status}] {r['model']['id']}")
    print()

    ok_results = [r for r in results if r["ok"]]
    if not ok_results:
        print("  All downloads failed. Check your network connection.")
        sys.exit(1)

    hr()
    print("  HOW TO CONFIGURE (choose one model)")
    hr()
    print()
    print("  Option 1 — Settings page (recommended):")
    print("    Admin → Settings → Documents → Retrieval")
    print("    Enable Hybrid Search → Reranking Engine: Local — SentenceTransformers CrossEncoder")
    print("    Reranking Model: paste one of the model IDs below")
    print()
    print("  Option 2 — .env file:")
    print("    RAG_RERANKING_ENGINE=           # leave blank for local CrossEncoder")
    for r in ok_results:
        print(f"    {r['model']['env']}   # {r['model']['size']} — {r['model']['notes']}")
    print()
    print("  After changing .env, restart the backend for it to take effect.")
    print()
    print("  Switching models via the settings page takes effect immediately")
    print("  (no restart required — the model is hot-reloaded on save).")
    hr("═")


if __name__ == "__main__":
    main()
