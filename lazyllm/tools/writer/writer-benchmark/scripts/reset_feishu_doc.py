#!/usr/bin/env python3
# 覆写飞书文档内容，在 lazymind-chat-1 容器内运行
# 因当前飞书 token 缺少 docx:document.block:convert 权限，
# 使用本地 markdown 转 block 逻辑替代飞书 Convert API
# Usage: python3 reset_feishu_doc.py <wiki_url> <markdown_file>
import sys
import json
import re
import urllib.request

AUTH_BASE = "http://auth-service:8000/api/authservice"
INTERNAL_TOKEN = "dev-internal-service-token"
ADMIN_USER_ID = "278c8877-3aa1-4ef3-b6a3-b9aa79994434"

_HEADING_TYPES = {1: 3, 2: 4, 3: 5, 4: 6, 5: 7, 6: 8}
_HEADING_FIELD = {3: 'heading1', 4: 'heading2', 5: 'heading3',
                  6: 'heading4', 7: 'heading5', 8: 'heading6'}


def _internal_get(path):
    url = f"{AUTH_BASE}{path}"
    req = urllib.request.Request(url,
                                 headers={"X-LazyMind-Internal-Token": INTERNAL_TOKEN})
    resp = urllib.request.urlopen(req, timeout=10)
    return json.loads(resp.read().decode())["data"]


def get_feishu_token():
    items = _internal_get(
        f"/v1/cloud/connections/internal/chat-enabled"
        f"?provider=feishu&owner_user_id={ADMIN_USER_ID}"
    ).get("items", [])
    if not items:
        raise RuntimeError("未找到可用的飞书连接")
    conn_id = items[0]["connection_id"]
    token_data = _internal_get(f"/v1/cloud/connections/{conn_id}/token?user_id={ADMIN_USER_ID}")
    token = token_data["access_token"]
    if not token:
        raise RuntimeError("飞书 access_token 为空")
    return token


def _text_run(content):
    return {'text_run': {'content': content}}


def markdown_to_blocks(md_text):
    # 将 markdown 转换为飞书 docx block 列表
    blocks = []
    paragraph = []

    def flush():
        if paragraph:
            blocks.append({'block_type': 2, 'text': {'elements': [_text_run('\n'.join(paragraph))]}})
            paragraph.clear()

    for line in md_text.split('\n'):
        s = line.strip()
        if not s:
            flush()
            continue
        m = re.match(r'^(#{1,6})\s+(.*)', s)
        if m:
            flush()
            level = len(m.group(1))
            bt = _HEADING_TYPES[level]
            blocks.append({'block_type': bt, _HEADING_FIELD[bt]: {'elements': [_text_run(m.group(2))]}})
            continue
        m = re.match(r'^[-*]\s+(.*)', s)
        if m:
            flush()
            blocks.append({'block_type': 12, 'bullet': {'elements': [_text_run(m.group(1))]}})
            continue
        m = re.match(r'^\d+\.\s+(.*)', s)
        if m:
            flush()
            blocks.append({'block_type': 13, 'ordered': {'elements': [_text_run(m.group(1))]}})
            continue
        paragraph.append(s)
    flush()
    return blocks


def reset_doc(wiki_url, markdown_content):
    from lazyllm.tools.fs.client import FS as _FS
    from lazyllm.tools.fs import dynamic_fs_config

    token = get_feishu_token()
    with dynamic_fs_config({"feishu": token}):
        protocol, space_id, real_path = _FS._parse(wiki_url)
        fs = _FS._get_or_create_fs(protocol, space_id, real_path)
        document_id = fs.get_document_id(real_path)

        blocks = markdown_to_blocks(markdown_content)
        if not blocks:
            raise RuntimeError("markdown 转换结果为空")

        existing = fs._get_docx_children(document_id, document_id)
        existing_count = len(existing)

        fs._append_docx_blocks(document_id, blocks)

        if existing_count > 0:
            fs._batch_delete_child_blocks(
                document_id, document_id, 0, existing_count)

    print(f"已重置 {wiki_url} (document_id={document_id})")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python3 reset_feishu_doc.py <wiki_url> <markdown_file>")
        sys.exit(1)
    wiki_url = sys.argv[1]
    with open(sys.argv[2], encoding="utf-8") as f:
        content = f.read()
    reset_doc(wiki_url, content)
