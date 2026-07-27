"""
Pipeline Observability — Lightweight tracing for the rAsh Score pipeline

Tracks per-agent execution time, token estimates, errors, and score distributions.
Exports to console (print_report) and optionally to BigQuery (export_to_bq).

Usage:
    tracer = PipelineTracer(run_id, provider="gemini", mode="agentic-live")

    with tracer.span("research", {"industry": "technology"}):
        # ... agent work ...
        pass

    tracer.record_scores("technology", validated_scores)
    tracer.print_report()
    tracer.export_to_bq()
"""

from __future__ import annotations
import time
from datetime import datetime, timezone


class SpanContext:
    """Context manager for tracing a single operation."""

    def __init__(self, tracer: "PipelineTracer", name: str, metadata: dict | None = None):
        self.tracer = tracer
        self.name = name
        self.metadata = metadata or {}
        self.start = 0.0
        self.duration_ms = 0
        self.success = True
        self.error = None

    def __enter__(self):
        self.start = time.time()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.duration_ms = int((time.time() - self.start) * 1000)
        self.success = exc_type is None
        self.error = str(exc_val)[:200] if exc_val else None

        self.tracer._spans.append({
            "name": self.name,
            "duration_ms": self.duration_ms,
            "success": self.success,
            "error": self.error,
            **self.metadata,
        })

        return False  # Don't suppress exceptions


class PipelineTracer:
    """Lightweight pipeline observability tracer."""

    def __init__(self, run_id: str, provider: str, mode: str):
        self.run_id = run_id
        self.provider = provider
        self.mode = mode
        self.start_time = time.time()
        self._spans: list[dict] = []
        self._errors: list[dict] = []
        self._score_stats: list[dict] = []

    def span(self, name: str, metadata: dict | None = None) -> SpanContext:
        """Create a traced span. Use as context manager."""
        return SpanContext(self, name, metadata)

    def record_error(self, agent: str, industry: str, error: str):
        """Record an error event."""
        self._errors.append({
            "agent": agent,
            "industry": industry,
            "error": error[:300],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    def record_scores(self, industry: str, scores: list[dict]):
        """Record score distribution stats for an industry."""
        if not scores:
            return

        totals = [s.get("score", 0) for s in scores]
        avg = sum(totals) / len(totals)
        self._score_stats.append({
            "industry": industry,
            "count": len(scores),
            "avg": round(avg, 1),
            "min": min(totals),
            "max": max(totals),
            "spread": max(totals) - min(totals),
        })

    def summary(self) -> dict:
        """Get full trace summary."""
        total_duration_ms = int((time.time() - self.start_time) * 1000)

        # Group spans by agent name
        agent_stats = {}
        for sp in self._spans:
            name = sp["name"]
            if name not in agent_stats:
                agent_stats[name] = {"count": 0, "success": 0, "total_ms": 0, "errors": []}
            agent_stats[name]["count"] += 1
            agent_stats[name]["total_ms"] += sp["duration_ms"]
            if sp["success"]:
                agent_stats[name]["success"] += 1
            if sp.get("error"):
                agent_stats[name]["errors"].append(sp["error"])

        # Compute averages
        for name, stats in agent_stats.items():
            stats["avg_ms"] = round(stats["total_ms"] / stats["count"]) if stats["count"] else 0

        # Overall score stats
        all_scores = []
        for ss in self._score_stats:
            all_scores.extend([ss["min"], ss["max"]])

        overall_avg = (
            round(sum(ss["avg"] for ss in self._score_stats) / len(self._score_stats), 1)
            if self._score_stats else 0
        )

        return {
            "run_id": self.run_id,
            "provider": self.provider,
            "mode": self.mode,
            "total_duration_ms": total_duration_ms,
            "total_spans": len(self._spans),
            "total_errors": len(self._errors),
            "agent_stats": agent_stats,
            "score_stats": {
                "industries_scored": len(self._score_stats),
                "overall_avg": overall_avg,
                "min_score": min(all_scores) if all_scores else 0,
                "max_score": max(all_scores) if all_scores else 0,
            },
            "errors": self._errors,
        }

    def print_report(self):
        """Print a formatted trace report to console."""
        s = self.summary()
        duration_s = s["total_duration_ms"] / 1000

        print(f"\n{'═' * 50}")
        print(f"🔍 Pipeline Trace Report")
        print(f"{'═' * 50}")
        print(f"  Run ID:    {s['run_id'][:12]}...")
        print(f"  Provider:  {s['provider']}")
        print(f"  Mode:      {s['mode']}")
        print(f"  Duration:  {duration_s:.1f}s")

        # Agent performance
        if s["agent_stats"]:
            print(f"\n📊 Agent Performance:")
            for name, stats in s["agent_stats"].items():
                avg_s = stats["avg_ms"] / 1000
                success = stats["success"]
                total = stats["count"]
                status = "✅" if success == total else "⚠️"
                print(f"  {name:20s} avg {avg_s:5.1f}s | {success}/{total} success {status}")

        # Score distribution
        ss = s["score_stats"]
        if ss["industries_scored"] > 0:
            print(f"\n📈 Score Distribution:")
            print(f"  Overall avg:  {ss['overall_avg']}/100")
            print(f"  Range:        {ss['min_score']} — {ss['max_score']}")
            print(f"  Industries:   {ss['industries_scored']} scored")

        # Errors
        if s["errors"]:
            print(f"\n⚠️  Errors ({len(s['errors'])}):")
            for e in s["errors"][:5]:
                print(f"  • [{e['agent']}] {e['industry']}: {e['error'][:80]}")
            if len(s["errors"]) > 5:
                print(f"  ... and {len(s['errors']) - 5} more")
        else:
            print(f"\n✅ No errors")

        print(f"{'═' * 50}\n")

    def export_to_bq(self):
        """Write trace data to BigQuery pipeline_traces table."""
        try:
            from google.cloud import bigquery
            from config import BQ_FULL_DATASET, GCP_PROJECT_ID

            client = bigquery.Client(project=GCP_PROJECT_ID)
            table_id = f"{BQ_FULL_DATASET}.pipeline_traces"
            s = self.summary()

            import json
            rows = [{
                "run_id": s["run_id"],
                "provider": s["provider"],
                "mode": s["mode"],
                "total_duration_ms": s["total_duration_ms"],
                "total_spans": s["total_spans"],
                "total_errors": s["total_errors"],
                "industries_scored": s["score_stats"]["industries_scored"],
                "overall_avg_score": s["score_stats"]["overall_avg"],
                "agent_stats_json": json.dumps(s["agent_stats"]),
                "errors_json": json.dumps(s["errors"]),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }]

            errors = client.insert_rows_json(table_id, rows)
            if errors:
                print(f"  ⚠ BQ trace export failed: {errors}")
            else:
                print(f"  📤 Trace exported to BigQuery ({table_id})")

        except Exception as e:
            print(f"  ⚠ Trace export skipped: {e}")
