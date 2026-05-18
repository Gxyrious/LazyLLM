LazyLLM Tracing 解决的不是“多打日志”。

它把一次真实请求变成 Trace 树：入口是 root span，Retriever、LLM、Tool 都挂成子节点，最后由 exporter 写到 Langfuse 或本地后端。

---

这棵树先绑定请求上下文。

`trace_id` 串起整条链，`session_id`、`user_id` 和 `request_tags` 用来聚合和筛选。

这些字段会沿着组件调用传播，所以跨组件行为不会散成几段孤立日志。

---

Trace 必须留下拓扑。

每个节点有自己的 `span_id`，父节点写在 `parent_span_id`。

Pipeline 可以 fan-out 到 retriever、formatter、llm，retriever 内部还能再嵌 TxtReader。

---

节点还会保存执行快照。

核心字段是 input、output、status、exception 和 duration。

但完整 payload 受配置控制；`debug_capture_payload=False` 时，结构还在，内容会被裁掉或脱敏。

---

节点要补语义。

同样都是 span，`llm`、`retriever`、`rerank`、`tool`、`agent` 的分析方式完全不同。

有了 `semantic_type`，上层系统才知道该读模型字段、召回分数，还是工具调用。

---

配置和资源也要进 Trace。

LLM 带 model、prompt、temperature、token usage。

Retriever 带 similarity、Top-K、召回分数。

Flow 带分支命中和控制流结果。

这样 Trace 才是可分析账本。

---

RAG 排障先拆链路，不要先猜模型。

Retriever 看 query、Top-K、similarity、召回 chunk 和 source_id。

Reranker 看候选是否被重新排坏。

LLM 看 prompt、context_str、answer 和 token usage。

一条 Trace 把这三段的输入、输出、耗时放在同一棵树里。

---

错误归因要看证据路径。

没召回正确知识，先查索引、切块和检索参数。

知识进了上下文还答错，再查 prompt 和模型输出。

候选有了但顺序异常，再查 reranker score。

这比只看最终 answer 更接近真实问题。

---

Agent 排障看决策链。

Trace 里要同时看模型输出、tool_call_id、工具参数、工具返回和状态回填。

如果 `loop_count` 不断上涨，就检查上一轮 observation 有没有写回，以及下一步 action 为什么又选了同一个工具。

---

性能和线上回归也靠 Trace。

Waterfall 把总耗时拆成节点 duration：LLM 慢看推理和 token，Retriever 慢看文档读取或向量库，控制流慢看分支重复。

再用 `session_id`、`user_id`、`request_tags`、Prompt 版本和模型版本聚合，才能比较一批请求的共同退化。

---

接入 Langfuse 先准备后端凭证。

`LANGFUSE_BASE_URL` 是写入地址，Cloud 常见是 EU 的 `https://cloud.langfuse.com` 或 US 的 `https://us.cloud.langfuse.com`。

`LANGFUSE_PUBLIC_KEY` 和 `LANGFUSE_SECRET_KEY` 负责认证。

这些变量只应该服务观测后端，不应该写进业务逻辑。

---

依赖和运行开关分开看。

`lazyllm` 提供编排和内置 hook，`langfuse` 提供后端集成，OpenTelemetry API、SDK 和 OTLP HTTP exporter 负责标准 span 与导出。

运行时再用 `LAZYLLM_TRACE_ENABLED`、`LAZYLLM_TRACE_BACKEND`、`LAZYLLM_TRACE_CONTENT_ENABLED` 控制是否追踪、写到哪里、是否保存内容。

---

如果业务已经用 LazyLLM 编排，默认接入通常不改调用代码。

Flow 和 Module 的执行路径里已经有 hook 入口。

你配置好后端和开关，继续运行原来的 pipeline，框架就会自动生成 Trace。

观测逻辑留在执行边界，而不是散落在每个业务函数里。

---

RAG 示例的结构是 `Document -> Retriever -> formatter -> LLM -> Pipeline`。

`Document` 建知识源，`Retriever` 用 `bm25_chinese` 和 `topk=3` 召回。

formatter 把 nodes 合成 `context_str`，LLM 再基于上下文回答。

这个业务结构会直接映射成 Trace 里的节点拓扑。

---

跑起来后，Langfuse 里会看到 Pipeline Trace。

关键节点包括 `Pipeline`、`retriever`、`llm`、`<lambda>` 和 `TxtReader`。

`llm` 的 observation type 是 `GENERATION`，`retriever` 是 `RETRIEVER`。

这些类型来自 LazyLLM 的语义补全，不是页面临时猜出来的。

---

`set_trace_context` 只写请求上下文，不创建 Trace。

它适合在真正执行工作流前写入 `session_id`、`user_id`、`request_tags`，也可以写 `trace_id` 和 `parent_span_id` 来续接链路。

只调用它不会出现新节点；后面必须真的执行 `rag_ppl(question)`，hook 才会读到这些字段。

---

请求级上下文也能控制采集。

`sampled` 决定是否上报，`debug_capture_payload` 决定本次是否保留 input/output，`module_trace` 可以按模块名关闭采集。

比如本次把 llm 关掉，或者只在 debug 请求里打开完整 payload，都不需要改全局服务。

---

`enable_trace` 管入口边界。

wrapper 适合包住某一次调用，decorator 适合服务入口或长期复用函数。

包装 Flow 或 Module 时，内部节点仍然走默认 hook。

包装普通 Python callable 时，如果没有活动父节点，它会按需要补一个入口 span。

---

Tracing 专用参数会先被消费。

`session_id`、`request_tags`、`trace_id` 会进入 LazyTraceContext，不会继续传给业务函数。

采集配置也分两层：进程默认值来自环境变量，单次覆盖来自 LazyTraceContext。

这样线上默认策略和单次 debug 可以共存。

---

采集开关要按层理解。

`enabled` 控制这次是否建节点。

`sampled` 控制建了以后是否上报。

`debug_capture_payload=False` 只影响内容留存，不会让 Trace 消失。

`module_trace={"by_name":{"llm":False}}` 则会让本次请求里的 llm 节点不记录。

---

内部架构按数据流看最清楚。

运行层执行 Flow、Module、callable。

埋点适配层负责 hook 接入、采集策略和语义补全。

OpenTelemetry 层管理 span 生命周期和上下文传播。

后端层把标准 span 写到 Langfuse 或 JSONL，消费适配层再把 Trace 读回评估和自进化系统。

---

核心对象分三类。

`LazyTraceContext` 很轻，只放 `trace_id`、`parent_span_id`、session、user、tags，以及 enabled、sampled、payload、module 规则。

它要能跨线程和进程传播，所以不能依赖 active span 对象。

---

`LazySpan` 是单节点 observation 快照。

它保存 name、span_kind、semantic_type、input、output、status、error、config、usage。

页面上的节点详情，大部分都来自这个对象，再映射成后端属性。

---

`LazyTrace` 是请求级账本。

它记录 root_span_id、开始结束时间、整体状态和 metadata。

首个活动 span 创建它，后续节点登记进去，结束时统一收口。

上下文负责传播，Span 负责事实，Trace 负责全局视图。

---

默认观测能自动挂上去，是因为 LazyLLM 已经有统一执行链。

Flow 初始化时会调用 `register_hooks(self, resolve_builtin_hooks(self))`。

`resolve_builtin_hooks` 根据对象和运行配置返回内置 hook 列表，Tracing 只是其中一种 provider 能力。

---

Flow 和 Module 的调用边界会统一进 hook。

Flow 执行走 `execution_with_hooks`，同时 `globals.stack_enter(...)` 维护调用层级。

Module 的 `__call__` 也会把 `_call_impl` 包进 `execution_with_hooks(...)`。

所以父子关系来自框架调用栈，不靠业务代码手写。

---

provider 会先判断要不要挂 Tracing。

全局 `trace_enabled` 关了，不返回 hook。

模块规则命中关闭，也不返回。

通过判断后才返回 `[LazyTracingHook]`，后续调用才会进入 pre、post、error、finalize 生命周期。

---

LazyTracingHook 的生命周期很固定。

`pre_hook` 读 LazyTraceContext，检查 `enabled`、`sampled` 和模块规则，能记录才创建 span。

`post_hook` 写 output、usage、耗时和模型信息。

`on_error` 记录异常。

`finalize` 关闭上下文。

---

Retriever 和 Reranker 要补后处理数据。

有些候选节点、source id、召回分数和重排分数不是调用开始时就有。

所以 hook 会先安装 probe，等 nodes 或 score 出来后再补采。

否则只能知道“检索器被调用过”，看不到召回质量。

---

采集控制的顺序不能乱。

先判断请求能不能建节点，再判断当前模块能不能记录，最后才判断 payload 要不要保存。

请求级 `ctx.debug_capture_payload` 优先；没有单次覆盖时，才看全局 `trace_content_enabled`。

---

节点只存 input/output 不够。

`collect_trace_config(...)` 会补组件配置，`resolve_semantic_type_for_target(...)` 会补统一语义。

Retriever 写召回分数和 source id，Reranker 写重排分数，Flow 写分支命中，Agent 写循环次数和工具调用。

这些字段决定后面能不能做批量分析。

---

OpenTelemetry 层最关键的是状态拆分。

`globals['trace']` 只放可序列化轻量字段，比如 `trace_id`、`parent_span_id`、tags 和采集控制。

`_current_trace` 是 ContextVar，保存请求级 LazyTrace。

当前 active span 则交给 OTel context。

---

`start_span` 先找当前活跃 span。

有 active span，就把新节点挂到它下面。

没有 active span 时，才看轻量上下文里的 `trace_id` 和 `parent_span_id`。

如果有父链路字段，就重建父 `SpanContext`，把新 span 接回原 Trace。

---

`finish_span` 负责收尾。

它构造通用 OTel 属性，再交给 backend 做 `map_attributes`。

如果节点抛异常，就 `record_exception`。

最后关闭 context manager，避免 active span 泄漏到后面的调用里。

---

`enable_trace` 内部像状态栈。

进入时保存旧上下文，覆盖本次入口字段，执行结束后恢复旧上下文。

线程传播走 `copy_context().run(...)`，ContextVar 和 OTel active context 能一起进 worker。

进程传播不能带 active span，只传 `globals._data` 快照，再用 `trace_id` 和 `parent_span_id` 重建父链路。

---

`LazyTrace` 负责请求级聚合。

首个活动 span 创建它，后续 span 登记进去。

它让一次请求有完整账本，但不替代 OTel 的父子上下文。

这个边界很重要：Trace 管聚合，OTel 管上下文和父子关系。

---

Backend 层隔离写入目标。

上游只产出标准 span 和属性。

写到 Langfuse，还是写到本地 JSONL，不应该影响 Hook、LazySpan 和 OTel 生命周期。

---

`TracingBackend` 主要抽象两个能力。

`build_exporter` 构造写入通道，`map_attributes` 把 LazyLLM 字段适配成后端字段。

新增后端时，核心改动应该集中在这里，而不是回头改运行层和 hook 层。

---

最后把主线收回来。

Hook 负责接入执行链。

LazySpan 记录节点事实。

OpenTelemetry 负责父子关系和上下文传播。

Backend 负责落地和字段映射。

这四层不混，排障、评估和回归对比才能共用同一套 Trace。
