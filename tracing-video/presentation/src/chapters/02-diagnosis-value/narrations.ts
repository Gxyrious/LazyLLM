import type { Narration } from "../../registry/types";

export const narrations: Narration[] = [
  "RAG 排障先拆链路，不要先猜模型。 Retriever 看 query、Top-K、similarity、召回 chunk 和 source_id。 Reranker 看候选是否被重新排坏。 LLM 看 prompt、context_str、answer 和 token usage。 一条 Trace 把这三段的输入、输出、耗时放在同一棵树里。",
  "错误归因要看证据路径。 没召回正确知识，先查索引、切块和检索参数。 知识进了上下文还答错，再查 prompt 和模型输出。 候选有了但顺序异常，再查 reranker score。 这比只看最终 answer 更接近真实问题。",
  "Agent 排障看决策链。 Trace 里要同时看模型输出、tool_call_id、工具参数、工具返回和状态回填。 如果 `loop_count` 不断上涨，就检查上一轮 observation 有没有写回，以及下一步 action 为什么又选了同一个工具。",
  "性能和线上回归也靠 Trace。 Waterfall 把总耗时拆成节点 duration：LLM 慢看推理和 token，Retriever 慢看文档读取或向量库，控制流慢看分支重复。 再用 `session_id`、`user_id`、`request_tags`、Prompt 版本和模型版本聚合，才能比较一批请求的共同退化。",
];
