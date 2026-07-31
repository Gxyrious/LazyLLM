---
name: writer-benchmark
description: >
  对写作插件（Writer Plugin）进行端到端性能基准测试，覆盖三个场景：从零撰写多章节文档、
  基于飞书大纲撰写全文、局部修改已有飞书文档。通过 LaMind Chat API 发送等价于前端
  "按需审批 + 思考深度高 + 新任务"的请求，从 Langfuse 拉取完整 trace，
  计算自洽的性能统计并生成报告。当用户要求评估 Writer Agent 性能、运行写作基准测试、
  或分析写作流程耗时时使用此 Skill。
---

# Writer Plugin 性能基准测试

## 概述

本 Skill 用于对 Writer Plugin 进行端到端性能基准测试。核心思路是通过直接调用后端 API
来模拟用户在前端对话框中发送写作请求的行为，利用 Langfuse 捕获完整执行 trace，
然后从 trace 中提取 LLM 调用的 Token 数和耗时数据，计算自洽的统计指标，最终生成一份结构化报告。

三个测试场景：

- 场景一（1_multi_section）：从零撰写多章节文档，不需要飞书 URL
- 场景二（2_given_outline）：基于已有飞书大纲撰写全文，prompt 中包含飞书 wiki URL
- 场景三（3_revise_given）：局部修改已有飞书文档，prompt 中包含飞书 wiki URL，
  运行前需用配套的 document_N.md 重置飞书文档内容

## 前置条件

- Docker 服务已启动（make up）。验证方式：
  curl -sf http://localhost:8090/api/authservice/auth/health
- Langfuse 运行在 http://localhost:3000
- 场景三需要 admin 用户已绑定飞书 OAuth 连接

所有前置条件均为强制要求。运行前必须逐一检查，如果任何一项不满足，
必须停下来向用户说明缺失的条件和解决方案，等待用户处理后再继续。

## 目录结构

./
├── SKILL.md                        本文件
├── cases/                          测试用例
│   ├── 1_multi_section/            场景一：prompt_1~5.md
│   ├── 2_given_outline/            场景二：prompt_1~5.md（prompt 中含飞书 URL）
│   └── 3_revise_given/             场景三：prompt_1~5.md + document_1~5.md（配对使用）
├── scripts/
│   ├── full_run.sh                 全量运行编排脚本
│   ├── run_case.py                 发送单条聊天请求（宿主机运行）
│   ├── reset_feishu_doc.py         重置飞书文档内容（chat 容器内运行）
│   ├── fetch_trace.py              从 Langfuse 获取 trace（宿主机运行）
│   ├── compute_stats.py            计算 Token/耗时统计（宿主机运行）
│   └── dump_stats.py               汇总原始数据到 stats_overview.md（宿主机运行）
├── references/
│   ├── report_template_full_info.md   报告模板（含完整流程描述和原因分析）
│   └── report_template_only_time.md   报告模板（仅步骤名和耗时表）
└── reports/                        输出目录（首次运行时自动创建）
    └── <时间戳>/                   如 20260731_111510
        ├── 1_multi_section/
        │   ├── traces/case_N.json
        │   └── stats.json
        ├── 2_given_outline/
        ├── 3_revise_given/
        ├── stats_overview.md       各场景原始数据表格（脚本自动生成）
        └── report.md               汇总报告（由 Codex 分析后手动撰写）

## 请求链路

前端的请求经 Go Core 中转到 Python 服务：

前端 → POST /api/core/conversations:chat → Kong(8090) → Go Core → Python Chat(8046)

Go Core 负责创建会话、加载历史、动态注入飞书 OAuth token。
脚本通过 /api/core/conversations:chat 发送请求，与前端行为完全等价。

认证流程：先用 POST /api/authservice/auth/login（admin/admin）获取 JWT，
再以 Authorization: Bearer <token> 发送聊天请求。

请求体中的关键字段：

- thinking_depth: "high" — 等价于前端思考深度设为"高"
- initial_plugin_settings: { enable_plugin: true, plugin_mode: "dynamic" } — 等价于"按需审批"
- 不携带 conversation_id — 等价于"新任务"

## 飞书文档操作

场景三中每个用例运行前需要重置飞书文档内容。reset_feishu_doc.py 在 chat 容器内执行，
流程如下：

1. 通过 auth-service 内部 API 获取飞书 OAuth token
   （/api/authservice/v1/cloud/connections/internal/chat-enabled）
   使用内部 token 认证（X-LazyMind-Internal-Token: dev-internal-service-token）
2. 用 LazyLLM 的 dynamic_fs_config 注入 token
3. 通过 FS 解析 wiki URL 获取 document_id
4. 使用内置 markdown_to_blocks 将 Markdown 转为飞书 docx block 结构
   因当前用户 OAuth token 的 scope 未包含 docx:document.block:convert，
   无法调用飞书 Convert API，改用本地解析
5. 将新 block 插入文档，再删除旧 block，完成内容覆写

场景三的 prompt 和 document 必须配对使用：prompt 中引用的章节标题应存在于 document 中，
否则定位步骤会失败。每个 prompt 开头包含飞书 URL，脚本用正则从 prompt 中提取 URL。

## 执行流程

### 1. 同步文件到 chat 容器

docker exec lazymind-chat-1 mkdir -p /opt/benchmark/cases
docker cp scripts/reset_feishu_doc.py lazymind-chat-1:/opt/benchmark/
docker cp cases/. lazymind-chat-1:/opt/benchmark/cases/

### 2. 运行基准测试

运行全部场景：

bash scripts/full_run.sh

运行指定场景：

bash scripts/full_run.sh 1_multi_section 2_given_outline

运行指定用例：

bash scripts/full_run.sh 1_multi_section --cases 1,3

每个用例的执行步骤：

1. （仅场景三）从 prompt 中正则提取飞书 URL，用 document_N.md 重置文档内容
2. 发送聊天请求（SSE 流式），等待完成
3. 从 Langfuse 拉取完整 trace

全部用例完成后，按场景计算统计数据（多 trace 取平均），dump_stats.py 汇总原始数据
到 stats_overview.md。Codex 读取该文件和 references/ 模板后撰写 report.md。

### 3. trace 搜索机制

Langfuse trace 的 sessionId 格式为 <conversation_id>_<timestamp>，
脚本通过 conversation_id 前缀匹配 sessionId 来查找对应的 trace。

Langfuse traces API 不支持 orderBy 参数（会导致 400 错误），
脚本使用默认排序加前缀匹配查找。

## 错误处理

所有脚本坚持快速失败原则，遇到错误立即终止并报错，不做任何静默降级或兜底。

遇到不符合预期的现象时，必须先排查根因再决定如何处理。
例如如果 Langfuse 中某些 trace 的 sessionId 为 null，
应当排查代码中 session_id 是如何设置和传播的，
而不是在 fetch_trace 中加 fallback 兜底。

如果在某次测试过程中，关键函数（如 run_case、reset_feishu_doc、fetch_trace）
反复出错导致链路不可用，应当：

1. 分析出错原因并停下来向用户报告，附上错误信息和初步判断
2. 等待用户确认后再修复问题并重新运行整套流程
3. 不要跳过出错的用例继续后续步骤，以免产生不完整或误导性的报告

## 统计计算规则（compute_stats.py）

compute_stats.py 从 trace JSON 中提取以下数据：

- OpenAIChat 类型的 observation：实际的 LLM 调用，按其父 span 名称分组
  （如 writer_generate_outline、writer_generate_draft_blocks 等）
- llm 类型的 GENERATION observation：Agent React 的 LLM 调用
  MiniMax 流式请求已上报 usage，包含 input/output Token

### 数据自洽规则

这些规则由 compute_stats.py 自动保证，报告中的所有数值必须满足：

- 全链路 Token = Agent React Token + 各步骤 Token 之和
- writer_generate_draft_blocks Token = 各 draft_block-N Token 之和
- 全链路调用次数 = Agent React 次数 + 所有步骤调用次数之和
  所有步骤都要计入，包括调用次数为 1 的步骤
- Agent React 的 Input/Output Token 可以正常采集，因为 llm observation 携带 usageDetails

### 耗时统计口径

- 耗时取 observation 的 latency 字段（单位：秒）
- 多 trace 时取算术平均，Token 取算术平均后四舍五入
- writer_generate_draft_blocks 的耗时为各章节 OpenAIChat 耗时之和
- 全链路耗时取 trace 顶层 latency（wall time），各步骤耗时之和会小于此值，
  因为步骤间存在非 LLM 的处理时间，且 React 耗时与步骤耗时有重叠

## 报告生成

报告由 Codex 手动撰写，不是脚本自动生成的。流程如下：

1. full_run.sh 跑完所有用例后，调用 dump_stats.py 汇总各场景的 stats.json
   到 reports/<时间戳>/stats_overview.md，其中只包含原始数据表格
2. Codex 读取 stats_overview.md 获取实际数据
3. Codex 读取 references/report_template_full_info.md 作为格式和内容参考
4. Codex 结合数据和对 Writer 代码的理解，撰写 report.md 写入 reports/<时间戳>/

报告包含三个场景，每个场景三个部分：

### 核心流程

按业务语义列出该场景的完整步骤链路，排除 get_artifact、read_user_attachment、
save_artifacts 等通用工具函数。格式为：

1. trigger_writer_plugin：理解用户写作请求，匹配并启动 Writer Plugin，返回可执行的工作流和首个步骤信息。
2. writer_build_writing_task：将自然语言写作需求标准化为 WritingTask，包含任务类型、主题和目标文档约束。

步骤名和描述之间用中文冒号连接，整行不换行。步骤的语义描述需要结合 Writer Plugin
的实际代码和 trace 中的调用关系来理解，不应机械复制模板。

### 耗时统计

表格列顺序：操作、Input Token、Output Token、平均耗时、LLM 调用次数。
数据直接从 stats_overview.md 中抄录，必须与原始数据完全一致。

表格内容规则：

- 第一行为全链路总统计
- 第二行为 Agent React 统计
- 之后为各语义步骤
- writer_generate_draft_blocks 单独一行展示汇总数据
- 调用次数为 1 的步骤该列留空

### 原因分析

每个表格中出现的操作都对应一段耗时原因。场景一的分析可以详细一些，
后续场景中相同的步骤用简短的短语或名词概括即可，不要使用完整的重复句子。
原因分析中不引用表格中的具体数值。

## 三个场景的特点

场景一（1_multi_section）：从零撰写多章节文档。
核心步骤包括 writer_generate_outline（生成大纲）。
最大瓶颈是 writer_generate_draft_blocks 的串行章节生成，
每章携带前序正文导致输入随章节推进持续增长。

场景二（2_given_outline）：基于已有飞书大纲撰写全文。
用 writer_load_document + writer_prepare_outline 替代 writer_generate_outline。
writer_prepare_outline 是纯 IR 转换，不调用 LLM。
给定大纲内容越详细，每章输入基数越大。

场景三（3_revise_given）：局部修改已有飞书文档。
核心步骤包括 locate → modify_plan → patch_set → apply → publish。
modify_plan 和 patch_set 两次读取完整原文档是主要瓶颈。
运行前必须先用 document_N.md 重置飞书文档。

## 注意事项

- 场景二的 prompt_4.md 和 prompt_5.md 可能为空，脚本会自动跳过
- 每个场景的用例数后续可能增加，新增文件遵循 prompt_N.md / document_N.md 命名即可
- 一次完整运行（3 场景 × 5 用例 = 15 条）可能需要数小时，建议按需选择场景和用例
- 场景三每次运行前必须重置飞书文档，否则修改的是上次运行后的文档内容
