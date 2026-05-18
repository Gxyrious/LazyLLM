import type { Narration } from "../../registry/types";

export const narrations: Narration[] = [
  "内部架构按数据流看最清楚。\n\n运行层执行 Flow、Module、callable。\n\n埋点适配层负责 hook 接入、采集策略和语义补全。\n\nOpenTelemetry 层管理 span 生命周期和上下文传播。\n\n后端层把标准 span 写到 Langfuse 或 JSONL，消费适配层再把 Trace 读回评估和自进化系统。",
  "核心对象分三类。\n\nLazyTraceContext 很轻，只放 trace_id、parent_span_id、session、user、tags，以及 enabled、sampled、payload、module 规则。\n\n它要能跨线程和进程传播，所以不能依赖 active span 对象。",
  "LazySpan 是单节点 observation 快照。\n\n它保存 name、span_kind、semantic_type、input、output、status、error、config、usage。\n\n页面上的节点详情，大部分都来自这个对象，再映射成后端属性。",
  "LazyTrace 是请求级账本。\n\n它记录 root_span_id、开始结束时间、整体状态和 metadata。\n\n首个活动 span 创建它，后续节点登记进去，结束时统一收口。\n\n上下文负责传播，Span 负责事实，Trace 负责全局视图。",
];
