import type { Narration } from "../../registry/types";

export const narrations: Narration[] = [
  "`set_trace_context` 只写请求上下文，不创建 Trace。 它适合在真正执行工作流前写入 `session_id`、`user_id`、`request_tags`，也可以写 `trace_id` 和 `parent_span_id` 来续接链路。 只调用它不会出现新节点；后面必须真的执行 `rag_ppl(question)`，hook 才会读到这些字段。",
  "请求级上下文也能控制采集。 `sampled` 决定是否上报，`debug_capture_payload` 决定本次是否保留 input/output，`module_trace` 可以按模块名关闭采集。 比如本次把 llm 关掉，或者只在 debug 请求里打开完整 payload，都不需要改全局服务。",
  "`enable_trace` 管入口边界。 wrapper 适合包住某一次调用，decorator 适合服务入口或长期复用函数。 包装 Flow 或 Module 时，内部节点仍然走默认 hook。 包装普通 Python callable 时，如果没有活动父节点，它会按需要补一个入口 span。",
  "Tracing 专用参数会先被消费。 `session_id`、`request_tags`、`trace_id` 会进入 LazyTraceContext，不会继续传给业务函数。 采集配置也分两层：进程默认值来自环境变量，单次覆盖来自 LazyTraceContext。 这样线上默认策略和单次 debug 可以共存。",
  "采集开关要按层理解。 `enabled` 控制这次是否建节点。 `sampled` 控制建了以后是否上报。 `debug_capture_payload=False` 只影响内容留存，不会让 Trace 消失。 `module_trace={\"by_name\":{\"llm\":False}}` 则会让本次请求里的 llm 节点不记录。",
];
