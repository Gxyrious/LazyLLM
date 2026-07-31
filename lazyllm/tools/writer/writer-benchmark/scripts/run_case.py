#!/usr/bin/env python3
# 发送写作请求并等待完成
# 宿主机运行，登录后发送等价于前端"按需审批 + 思考深度高 + 新任务"的流式请求
# Usage: python3 run_case.py <prompt_file> [--base-url http://localhost:8090]

import argparse
import json
import sys
import time
import urllib.request

BASE_URL_DEFAULT = "http://localhost:8090"
USERNAME = "admin"
PASSWORD = "admin"


def login(base_url):
    url = f"{base_url}/api/authservice/auth/login"
    body = json.dumps({"username": USERNAME, "password": PASSWORD}).encode()
    req = urllib.request.Request(url, data=body,
                                 headers={"Content-Type": "application/json"}, method="POST")
    resp = urllib.request.urlopen(req, timeout=15)
    data = json.loads(resp.read().decode())
    return data["data"]["access_token"]


def send_chat(base_url, token, prompt_text):
    # 发送流式聊天请求，返回 conversation_id, elapsed_s, finish_reason
    url = f"{base_url}/api/core/conversations:chat"
    body = json.dumps({
        "input": [{"input_type": "text", "text": prompt_text}],
        "stream": True,
        "thinking_depth": "high",
        "mode": "auto",
        "initial_plugin_settings": {"enable_plugin": True, "plugin_mode": "dynamic"},
    }).encode()

    req = urllib.request.Request(url, data=body, headers={
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "Authorization": f"Bearer {token}",
    }, method="POST")

    conversation_id = None
    finish_reason = None
    start = time.time()

    resp = urllib.request.urlopen(req, timeout=3600)
    for raw_line in resp:
        line = raw_line.decode("utf-8", errors="replace").strip()
        if not line.startswith("data:"):
            continue
        payload = line[5:].strip()
        if not payload:
            continue
        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            continue
        result = data.get("result", data)
        if result.get("conversation_id"):
            conversation_id = result["conversation_id"]
        fr = result.get("finish_reason", "")
        if fr and fr != "FINISH_REASON_UNSPECIFIED":
            finish_reason = fr
        if finish_reason and "FINISH_REASON_STOP" in str(finish_reason):
            break

    elapsed = time.time() - start
    return conversation_id, elapsed, finish_reason


def main():
    parser = argparse.ArgumentParser(description="运行 Writer 基准测试用例")
    parser.add_argument("prompt_file", help="提示词 markdown 文件路径")
    parser.add_argument("--base-url", default=BASE_URL_DEFAULT)
    args = parser.parse_args()

    with open(args.prompt_file, encoding="utf-8") as f:
        prompt_text = f.read().strip()

    print(f"登录 {args.base_url} ...", file=sys.stderr)
    token = login(args.base_url)

    print(f"发送请求 ({len(prompt_text)} 字符) ...", file=sys.stderr)
    conv_id, elapsed, finish_reason = send_chat(args.base_url, token, prompt_text)

    result = {
        "conversation_id": conv_id,
        "elapsed_s": round(elapsed, 3),
        "finish_reason": finish_reason or "UNKNOWN",
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
