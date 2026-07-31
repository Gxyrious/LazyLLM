#!/usr/bin/env python3
# 从 Langfuse trace JSON 计算性能统计
# 按 parent span 分组 OpenAIChat 调用，聚合 Agent React 的 Token 和耗时
# Usage: python3 compute_stats.py trace1.json [trace2.json ...] [--scenario multi|outline|revise]

import argparse
import json
import math
from pathlib import Path


def r1(x):
    return int(math.floor(x + 0.5))


def extract(trace_data):
    obs = trace_data["observations"]
    idx = {o["id"]: o for o in obs}

    chat_groups = {}
    chapters = []
    for o in obs:
        if o["name"] != "OpenAIChat":
            continue
        parent = idx.get(o.get("parentObservationId"), {})
        if parent.get("level", "DEFAULT") == "ERROR":
            continue
        parent_name = parent.get("name", "?")
        u = o.get("usageDetails") or {}
        entry = {
            "input": u.get("input", 0),
            "output": u.get("output", 0),
            "latency": o.get("latency", 0),
            "startTime": o.get("startTime", ""),
        }
        chat_groups.setdefault(parent_name, []).append(entry)
        if parent_name == "writer_generate_draft_blocks":
            chapters.append(entry)
    chapters.sort(key=lambda x: x["startTime"])

    llms = [o for o in obs if o["type"] == "GENERATION" and o["name"] == "llm"]
    react_input = sum((o.get("usageDetails") or {}).get("input", 0) for o in llms)
    react_output = sum((o.get("usageDetails") or {}).get("output", 0) for o in llms)
    react_latency = sum(o.get("latency", 0) for o in llms)

    return {
        "wall": trace_data.get("latency", 0),
        "chat_groups": chat_groups,
        "chapters": [(c["input"], c["output"], c["latency"]) for c in chapters],
        "react": {"input": react_input, "output": react_output,
                  "latency": react_latency, "count": len(llms)},
    }


def avg_traces(traces_data, scenario):
    n = len(traces_data)
    if n == 0:
        return {}

    all_step_names = set()
    per_trace = []
    for td in traces_data:
        d = extract(td)
        steps = {}
        for name, entries in d["chat_groups"].items():
            steps[name] = {
                "input": sum(e["input"] for e in entries),
                "output": sum(e["output"] for e in entries),
                "latency": sum(e["latency"] for e in entries),
                "count": len(entries),
            }
            all_step_names.add(name)
        per_trace.append({"steps": steps, "data": d})

    # 各步骤取平均
    step_avgs = {}
    for name in sorted(all_step_names):
        vals = [pts["steps"][name] for pts in per_trace if name in pts["steps"]]
        if not vals:
            continue
        step_avgs[name] = {
            "input": r1(sum(v["input"] for v in vals) / len(vals)),
            "output": r1(sum(v["output"] for v in vals) / len(vals)),
            "latency": round(sum(v["latency"] for v in vals) / len(vals), 3),
            "count": round(sum(v["count"] for v in vals) / len(vals), 1),
        }

    # 各章节取平均
    all_chapters = [pts["data"]["chapters"] for pts in per_trace]
    max_ch = max((len(c) for c in all_chapters), default=0)
    chapter_avgs = []
    for i in range(max_ch):
        present = [c[i] for c in all_chapters if i < len(c)]
        single = len(present) == 1
        a = present[0] if single else tuple(
            sum(p[j] for p in present) / len(present) for j in range(3))
        chapter_avgs.append({
            "index": i + 1, "single": single,
            "input": r1(a[0]), "output": r1(a[1]), "latency": round(a[2], 3),
        })

    draft = None
    if chapter_avgs:
        draft = {
            "input": sum(c["input"] for c in chapter_avgs),
            "output": sum(c["output"] for c in chapter_avgs),
            "latency": round(sum(c["latency"] for c in chapter_avgs), 3),
            "count": round(sum(len(c) for c in all_chapters) / len(all_chapters), 1),
        }

    react_avg = {
        "input": r1(sum(pts["data"]["react"]["input"] for pts in per_trace) / n),
        "output": r1(sum(pts["data"]["react"]["output"] for pts in per_trace) / n),
        "latency": round(sum(pts["data"]["react"]["latency"] for pts in per_trace) / n, 3),
        "count": round(sum(pts["data"]["react"]["count"] for pts in per_trace) / n, 1),
    }

    wall_avg = sum(pts["data"]["wall"] for pts in per_trace) / n

    # 全链路 = React + 所有步骤
    step_in = sum(v["input"] for v in step_avgs.values())
    step_out = sum(v["output"] for v in step_avgs.values())
    full_count = react_avg["count"] + sum(v["count"] for v in step_avgs.values())

    return {
        "scenario": scenario,
        "n_traces": n,
        "wall": round(wall_avg, 3),
        "react": react_avg,
        "full_link": {"input": react_avg["input"] + step_in,
                      "output": react_avg["output"] + step_out,
                      "count": round(full_count, 1)},
        "steps": step_avgs,
        "draft": draft,
        "chapters": chapter_avgs if chapter_avgs else None,
    }


def main():
    parser = argparse.ArgumentParser(description="计算 Writer 性能统计")
    parser.add_argument("traces", nargs="+", help="trace JSON 文件路径")
    parser.add_argument("--scenario", default="multi",
                        choices=["multi", "outline", "revise"])
    args = parser.parse_args()
    traces_data = [json.loads(Path(p).read_text()) for p in args.traces]
    stats = avg_traces(traces_data, args.scenario)
    print(json.dumps(stats, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
