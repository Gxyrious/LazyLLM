#!/usr/bin/env python3
# 汇总一次运行中所有场景的 stats.json 输出为 stats_overview.md
# 只输出原始数据表格，不做任何分析
# LLM 读取 stats_overview.md + references/ 模板后自行生成 report.md
# Usage: python3 dump_stats.py <run_dir>

import json
import sys
from pathlib import Path

SCENARIO_TITLES = {
    "1_multi_section": "从0到1写多章节",
    "2_given_outline": "基于大纲写作",
    "3_revise_given": "局部修改文档",
}


def fmt_cnt(v):
    if v is None:
        return ""
    f = float(v)
    return str(int(f)) if f == int(f) else f"{f:.1f}"


def build_table(s):
    lines = [
        "| 操作 | Input Token | Output Token | 平均耗时 | LLM 调用次数 |",
        "|---|---:|---:|---:|---:|",
    ]
    fl = s["full_link"]
    lines.append(
        f"| 全链路 | {fl['input']:,} | {fl['output']:,} | "
        f"{s['wall']:.3f} s | {fmt_cnt(fl['count'])} |"
    )
    r = s["react"]
    lines.append(
        f"| Agent React | {r['input']:,} | {r['output']:,} | "
        f"{r['latency']:.3f} s | {fmt_cnt(r['count'])} |"
    )
    for name, v in s["steps"].items():
        if name == "writer_generate_draft_blocks":
            continue
        cnt = fmt_cnt(v["count"]) if v["count"] != 1 else ""
        lines.append(
            f"| {name} | {v['input']:,} | {v['output']:,} | "
            f"{v['latency']:.3f} s | {cnt} |"
        )
    if s.get("draft"):
        d = s["draft"]
        cnt = fmt_cnt(d["count"]) if d["count"] else ""
        lines.append(
            f"| writer_generate_draft_blocks | {d['input']:,} | {d['output']:,} | "
            f"{d['latency']:.3f} s | {cnt} |"
        )
        for ch in s.get("chapters", []):
            lines.append(
                f"| draft_block-{ch['index']} | {ch['input']:,} | {ch['output']:,} | "
                f"{ch['latency']:.3f} s |  |"
            )
    return "\n".join(lines)


def main():
    run_dir = Path(sys.argv[1])
    lines = ["# 性能数据汇总\n"]

    for scenario_dir_name in ["1_multi_section", "2_given_outline", "3_revise_given"]:
        stats_path = run_dir / scenario_dir_name / "stats.json"
        if not stats_path.exists():
            continue
        s = json.loads(stats_path.read_text())
        title = SCENARIO_TITLES[scenario_dir_name]
        lines.append(f"## {title}\n")
        lines.append(build_table(s))
        lines.append("")

    out_path = run_dir / "stats_overview.md"
    out_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"数据已汇总: {out_path}")


if __name__ == "__main__":
    main()
