import type { Narration } from "../../registry/types";

export const narrations: Narration[] = [
  "OpenTelemetry 层最关键的是状态拆分。\n\n`globals['trace']` 只放可序列化轻量字段，比如 `trace_id`、`parent_span_id`、tags 和采集控制。\n\n`_current_trace` 是 ContextVar，保存请求级 `LazyTrace`。\n\n当前 active span 则交给 OpenTelemetry active context。\n\n这三层分开以后，跨边界传播、请求级聚合和运行时嵌套才不会互相污染。",
  "`start_span` 先找当前活跃 span。\n\n有 active span，就把新节点挂到它下面。\n\n没有 active span 时，才看轻量上下文里的 `trace_id` / `parent_span_id`。\n\n如果有父链路字段，就重建父 `SpanContext`，把新 span 接回原 Trace。\n\n创建完成后，再把新的 `trace_id` 和 `parent_span_id` 写回 `globals['trace']`。",
  "`finish_span` 负责收尾。\n\n它先构造通用 OpenTelemetry 属性，再交给 backend 做 `map_attributes`。\n\n如果节点抛异常，就调用 `record_exception`。\n\n最后关闭 context manager，避免 OpenTelemetry active context 泄漏到后面的调用里。\n\n所以收尾不是简单结束，而是属性、异常和运行栈一起收干净。",
  "`enable_trace` 内部像状态栈。\n\n进入时保存旧上下文，覆盖本次入口字段，执行结束后恢复旧上下文。\n\n线程传播走 `copy_context().run(...)`，ContextVar、`_current_trace` 和 OpenTelemetry active context 能一起进 worker。\n\n进程传播不能带 active span，只传 `globals._data` 的进程快照，再用 `trace_id` 和 `parent_span_id` 重建父链路。",
  "`LazyTrace` 负责请求级聚合。\n\n首个活动 span 创建它，后续 span 登记进去。\n\n它记录 `root_span_id`、整体状态、metadata，以及是否由父链路重建。\n\n这样一次请求会有完整账本，但它不替代 OpenTelemetry 的父子上下文；Trace 管聚合，OpenTelemetry 管父子关系和上下文传播。",
];
