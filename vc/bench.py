"""Benchmark script running performance and validation tests across image sizes."""
import statistics
import time
from pathlib import Path
from typing import List, Dict, Any
import numpy as np

from vc.overlay import generate_overlay_shares, reconstruct_overlay
from vc.xor import generate_xor_shares, reconstruct_xor
from vc.metrics import compute_metrics


def get_base_circle() -> np.ndarray:
    """Generate 64x64 filled circle pattern with radius 24."""
    y, x = np.ogrid[:64, :64]
    dist_sq = (y - 31.5) ** 2 + (x - 31.5) ** 2
    return (dist_sq <= 24.0 ** 2).astype(np.uint8)


def scale_pattern(base: np.ndarray, target_size: int) -> np.ndarray:
    """Scale square pattern using nearest-neighbour scaling."""
    factor = target_size // base.shape[0]
    return np.repeat(np.repeat(base, factor, axis=0), factor, axis=1)


def run_benchmark() -> List[Dict[str, Any]]:
    sizes = [64, 128, 256, 512]
    configs = [
        ("overlay", 2),
        ("xor", 2),
        ("xor", 4),
        ("xor", 6),
    ]

    base_circle = get_base_circle()
    results = []

    for size in sizes:
        S = scale_pattern(base_circle, size)
        for mode, n in configs:
            durations: List[float] = []
            last_shares = None
            for _ in range(5):
                t_start = time.perf_counter()
                if mode == "overlay":
                    shares = generate_overlay_shares(S)
                else:
                    shares = generate_xor_shares(S, n)
                durations.append((time.perf_counter() - t_start) * 1000.0)
                last_shares = shares

            median_ms = statistics.median(durations)

            if mode == "overlay":
                rec = reconstruct_overlay(last_shares)
            else:
                rec = reconstruct_xor(last_shares)

            metrics = compute_metrics(S, last_shares, rec, mode, n, median_ms, median_ms)

            worst_dev = max(sh["max_deviation"] for sh in metrics["leakage"]["shares"])
            leakage_passed = metrics["leakage"]["all_passed"]
            rel_diff = metrics["contrast"]["relative_difference"]
            theoretical = metrics["contrast"]["theoretical"]
            expansion = metrics["pixel_expansion"]

            results.append({
                "size": f"{size}x{size}",
                "mode": mode,
                "n": n,
                "pixel_expansion": expansion,
                "relative_difference": rel_diff,
                "theoretical": theoretical,
                "worst_leakage_max_deviation": round(worst_dev, 5),
                "leakage_all_passed": leakage_passed,
                "median_processing_ms": round(median_ms, 2),
            })

    return results


def format_markdown_table(results: List[Dict[str, Any]]) -> str:
    lines = [
        "# Phase 1 Benchmark Results",
        "",
        "| Size | Mode | n | Pixel Expansion | Relative Difference | Theoretical | Worst Leakage Max Deviation | Leakage All Passed | Median Processing (ms) |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for r in results:
        lines.append(
            f"| {r['size']} | {r['mode']} | {r['n']} | {r['pixel_expansion']:.1f} | "
            f"{r['relative_difference']:.1f} | {r['theoretical']:.1f} | "
            f"{r['worst_leakage_max_deviation']:.5f} | {r['leakage_all_passed']} | "
            f"{r['median_processing_ms']:.2f} |"
        )
    lines.append("")
    lines.append("Processing time is reported, not targeted (NFR-5).")
    lines.append("")
    return "\n".join(lines)


def main():
    results = run_benchmark()
    md_content = format_markdown_table(results)
    print(md_content)

    output_path = Path("PHASE1_RESULTS.md")
    output_path.write_text(md_content, encoding="utf-8")


if __name__ == "__main__":
    main()
