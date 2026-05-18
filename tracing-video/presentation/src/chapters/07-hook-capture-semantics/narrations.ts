import type { Narration } from "../../registry/types";

export const narrations: Narration[] = [
  "LazyTracingHook 的生命周期很固定。`pre_hook` 读 LazyTraceContext，检查 `enabled`、`sampled` 和模块规则，能记录才创建 span。`post_hook` 写 output、usage、耗时和模型信息。`on_error` 记录异常。`finalize` 关闭上下文。",
  "Retriever 和 Reranker 要补后处理数据。有些候选节点、source id、召回分数和重排分数不是调用开始时就有。所以 hook 会先安装 Retriever/Reranker probe，等 nodes 或 score 出来后再补采。否则只能知道“检索器被调用过”，看不到召回质量。",
  "采集控制的顺序不能乱。先判断请求能不能建节点，再判断当前模块能不能记录，最后才判断 payload 要不要保存。请求级 `ctx.debug_capture_payload` 优先；没有单次覆盖时，才看全局 `trace_content_enabled`。",
  "节点只存 input/output 不够。`collect_trace_config(...)` 会补组件配置，`resolve_semantic_type_for_target(...)` 会补统一语义。Retriever 写召回分数和 source id，Reranker 写重排分数，Flow 写分支命中，Agent 写循环次数和工具调用。这些 score/branch/loop_count 字段决定后面能不能做批量分析。",
];
