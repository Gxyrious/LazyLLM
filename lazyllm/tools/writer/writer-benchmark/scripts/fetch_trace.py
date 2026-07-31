#!/usr/bin/env python3
# 按 conversation_id 从 Langfuse 获取 trace 并保存为 JSON
# sessionId 格式为 <conversation_id>_<timestamp>，通过前缀匹配查找
# Usage: python3 fetch_trace.py <conversation_id> [--out <file.json>]
#        [--base-url http://localhost:3000] [--max-wait 60]

import argparse
import base64
import json
import sys
import time
import urllib.request

LANGFUSE_BASE = "http://localhost:3000"
LANGFUSE_PUBLIC_KEY = "pk-lf-c8b0ef3f-a776-482b-9c1e-e8a6a0161d0e"
LANGFUSE_SECRET_KEY = "sk-lf-2b3c1d0a-de29-4aa8-8628-9310a9ea2900"


def langfuse_get(url, timeout=30):
    raw = f"{LANGFUSE_PUBLIC_KEY}:{LANGFUSE_SECRET_KEY}"
    auth = "Basic " + base64.b64encode(raw.encode()).decode()
    req = urllib.request.Request(url, headers={"Authorization": auth})
    resp = urllib.request.urlopen(req, timeout=timeout)
    return json.loads(resp.read().decode())


def find_trace_id(conversation_id, base_url, max_wait=60):
    deadline = time.time() + max_wait
    while time.time() < deadline:
        url = f"{base_url}/api/public/traces?limit=50"
        data = langfuse_get(url)
        for trace in data.get("data", []):
            sid = trace.get("sessionId") or ""
            if sid.startswith(conversation_id):
                return trace["id"]
        time.sleep(3)
    return None


def main():
    parser = argparse.ArgumentParser(description="获取 Langfuse trace")
    parser.add_argument("conversation_id")
    parser.add_argument("--out", default=None, help="输出文件路径")
    parser.add_argument("--base-url", default=LANGFUSE_BASE)
    parser.add_argument("--max-wait", type=int, default=60)
    args = parser.parse_args()

    print(f"搜索 conversation_id={args.conversation_id} 的 trace ...", file=sys.stderr)
    trace_id = find_trace_id(args.conversation_id, args.base_url, args.max_wait)
    if not trace_id:
        print(f"错误: {args.max_wait}s 内未找到 {args.conversation_id} 的 trace", file=sys.stderr)
        sys.exit(1)

    print(f"找到 trace_id={trace_id}，下载中 ...", file=sys.stderr)
    trace = langfuse_get(f"{args.base_url}/api/public/traces/{trace_id}", timeout=60)

    output = json.dumps(trace, ensure_ascii=False, indent=2)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"已保存到 {args.out}", file=sys.stderr)
    else:
        print(output)


if __name__ == "__main__":
    main()
