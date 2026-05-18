import type { Narration } from "../../registry/types";

export const narrations: Narration[] = [
  "LazyLLM Tracing 解决的不是“多打日志”。它把一次真实请求变成 Trace 树：入口是 root span，Retriever、LLM、Tool 都挂成子节点，最后由 exporter 写到 Langfuse 或本地后端。",
  "这棵树先绑定请求上下文。`trace_id` 串起整条链，`session_id`、`user_id` 和 `request_tags` 用来聚合和筛选。这些字段会沿着组件调用传播，所以跨组件行为不会散成几段孤立日志。",
  "Trace 必须留下拓扑。每个节点有自己的 `span_id`，父节点写在 `parent_span_id`。Pipeline 可以 fan-out 到 retriever、formatter、llm，retriever 内部还能再嵌 TxtReader。",
  "节点还会保存执行快照。核心字段是 input、output、status、exception 和 duration。但完整 payload 受配置控制；`debug_capture_payload=False` 时，结构还在，内容会被裁掉或脱敏。",
  "节点要补语义。同样都是 span，`llm`、`retriever`、`rerank`、`tool`、`agent` 的分析方式完全不同。有了 `semantic_type`，上层系统才知道该读模型字段、召回分数，还是工具调用。",
  "配置和资源也要进 Trace。LLM 带 model、prompt、temperature、token usage。Retriever 带 similarity、Top-K、召回分数。Flow 带分支命中和控制流结果。这样 Trace 才是可分析账本。",
];
