import type { Narration } from "../../registry/types";

export const narrations: Narration[] = [
  "接入 Langfuse 先准备后端凭证。 `LANGFUSE_BASE_URL` 是写入地址，Cloud 常见是 EU 的 `https://cloud.langfuse.com` 或 US 的 `https://us.cloud.langfuse.com`。 `LANGFUSE_PUBLIC_KEY` 和 `LANGFUSE_SECRET_KEY` 负责认证。 这些变量只应该服务观测后端，不应该写进业务逻辑。",
  "依赖和运行开关分开看。 `lazyllm` 提供编排和内置 hook，`langfuse` 提供后端集成，OpenTelemetry API、SDK 和 OTLP HTTP exporter 负责标准 span 与导出。 运行时再用 `LAZYLLM_TRACE_ENABLED`、`LAZYLLM_TRACE_BACKEND`、`LAZYLLM_TRACE_CONTENT_ENABLED` 控制是否追踪、写到哪里、是否保存内容。",
  "如果业务已经用 LazyLLM 编排，默认接入通常不改调用代码。 Flow 和 Module 的执行路径里已经有 hook 入口。 你配置好后端和开关，继续运行原来的 pipeline，框架就会自动生成 Trace。 观测逻辑留在执行边界，而不是散落在每个业务函数里。",
  "RAG 示例的结构是 `Document -> Retriever -> formatter -> LLM -> Pipeline`。 `Document` 建知识源，`Retriever` 用 `bm25_chinese` 和 `topk=3` 召回。 formatter 把 nodes 合成 `context_str`，LLM 再基于上下文回答。 这个业务结构会直接映射成 Trace 里的节点拓扑。",
  "跑起来后，Langfuse 里会看到 Pipeline Trace。 关键节点包括 `Pipeline`、`retriever`、`llm`、`<lambda>` 和 `TxtReader`。 `llm` 的 observation type 是 `GENERATION`，`retriever` 是 `RETRIEVER`。 这些类型来自 LazyLLM 的语义补全，不是页面临时猜出来的。",
];
