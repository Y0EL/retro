#!/usr/bin/env python3
"""
RETRO — Autonomous B2B Intelligence Pipeline
Entry point: python main.py [--input companies.csv]
"""
import argparse
import sys
import time
from datetime import datetime
from pathlib import Path


def parse_args():
    p = argparse.ArgumentParser(description="RETRO B2B Intelligence Pipeline")
    p.add_argument("--input", "-i", default=None, help="CSV/Excel input file (overrides .env INPUT_FILE)")
    p.add_argument("--theme", "-t", choices=["light", "dark"], default=None, help="PDF theme")
    p.add_argument("--author", "-a", default=None, help="Proposal author name")
    p.add_argument("--output", "-o", default=None, help="Output directory")
    return p.parse_args()


def main():
    args = parse_args()

    # Apply CLI overrides to env before loading settings
    import os
    if args.input:
        os.environ["INPUT_FILE"] = args.input
    if args.theme:
        os.environ["PROPOSAL_THEME"] = args.theme
    if args.author:
        os.environ["PROPOSAL_AUTHOR"] = args.author
    if args.output:
        os.environ["OUTPUT_DIR"] = args.output

    from retro.config import get_settings
    from retro.tools import get_logger, log_summary, init_db
    from retro.agents.pipeline import run_pipeline

    cfg = get_settings()
    log = get_logger("retro.main")

    print("\n" + "═" * 60)
    print("  RETRO — B2B Intelligence Pipeline")
    print(f"  Author: {cfg.proposal_author}  |  Theme: {cfg.proposal_theme}")
    print(f"  Input:  {cfg.input_file}")
    print(f"  Output: {cfg.output_dir}")
    print("═" * 60 + "\n")

    if not cfg.is_groq_configured:
        log.warning(
            "groq_not_configured",
            hint="Set GROQ_API_KEY in .env for LLM profiling. Running in fallback mode.",
        )

    # Ensure DB + output dir ready
    Path(cfg.output_dir).mkdir(parents=True, exist_ok=True)
    init_db(cfg.db_path)

    if not Path(cfg.input_file).exists():
        print(f"[ERROR] Input file not found: {cfg.input_file}")
        print("  Run: cp .env.example .env  and edit INPUT_FILE, or use --input flag")
        sys.exit(1)

    start = time.time()
    log.info("pipeline_start", input=cfg.input_file)

    try:
        final_state = run_pipeline()
    except KeyboardInterrupt:
        print("\n[INTERRUPTED] Pipeline stopped by user.")
        sys.exit(0)
    except Exception as e:
        print(f"\n[FATAL] Pipeline crashed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    duration = round(time.time() - start, 1)

    # ── Summary ───────────────────────────────────────────────────────────
    profiles = final_state.get("company_profiles", [])
    crawl = final_state.get("crawl_results", [])
    synthesis = final_state.get("synthesis_result", {})
    paths = final_state.get("output_paths", {})
    errors = final_state.get("error_log", [])

    success_crawl = sum(1 for r in crawl if r.get("success"))
    top_matches = synthesis.get("top_matches", [])

    print("\n" + "─" * 60)
    print("  PIPELINE COMPLETE")
    print("─" * 60)
    print(f"  Duration     : {duration}s")
    print(f"  Companies    : {len(profiles)}")
    print(f"  Crawl OK     : {success_crawl}/{len(crawl)}")
    print(f"  Errors       : {len(errors)}")
    if top_matches:
        print(f"  Top Match    : {top_matches[0].get('company_name', '—')}")
    if paths.get("outbound_pdf"):
        print(f"  Outbound PDF : {paths['outbound_pdf']}")
    if paths.get("internal_pdf"):
        print(f"  Internal PDF : {paths['internal_pdf']}")
    print(f"  DB           : {cfg.db_path}")

    if errors:
        print("\n  Errors:")
        for e in errors[:10]:
            print(f"    • {e}")

    print("─" * 60 + "\n")

    log_summary({
        "companies_count": len(profiles),
        "success_count": success_crawl,
        "duration_seconds": duration,
        "error_count": len(errors),
    })


if __name__ == "__main__":
    main()
