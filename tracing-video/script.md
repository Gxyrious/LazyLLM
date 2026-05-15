LazyLLM Tracing 解决的，不是多打一层日志。

它给每次请求，生成一棵结构化 Trace 树。

---

这棵树会绑定 trace_id。

也会带上 session_id 和 request_tags。

这样跨组件行为能归到同一次请求。

---

Trace 里记录节点拓扑。

请求经过哪些节点。

节点之间谁调用谁。

这些都会留下来。

---

每个节点会记录 Input、Output、状态和异常。

但完整 payload 要不要保存。

由运行时配置决定。

---

节点还会补语义。

比如 llm、retriever、rerank、tool、agent。

这让上层分析知道节点在业务里干什么。

---

配置和资源也会进来。

模型名、Top-K、重排分数、控制流结果。

还有耗时、prompt_tokens、completion_tokens。

---

RAG 排障时，这些信息很关键。

链路是 Retriever、Reranker、LLM。

答案错了，要先拆链路。

---

知识没召回，是 retriever 的问题。

上下文有了还答错，再看 LLM。

中间分数异常，再看 reranker。

---

Agent 也是同一套思路。

看模型输出。

看工具调用。

看状态回填。

再看是不是进了无效循环。

---

性能问题看 Waterfall。

总响应慢，会拆成每个节点的耗时。

慢点可能是推理，也可能是检索或控制流。

---

线上分析靠标签。

session、user、request_tags 用来聚合请求。

Prompt 改动、模型切换、流程改动，都能靠 Trace 对比。

---

Logging 看局部事件。

Metrics 看聚合趋势。

Tracing 看一次请求的完整执行视图。

---

接入示例用 Langfuse。

你需要一个项目。

再拿到 LANGFUSE_BASE_URL、PUBLIC_KEY、SECRET_KEY。

---

Cloud 地址按区域选。

EU 常用 cloud.langfuse.com。

US 用 us.cloud.langfuse.com。

---

本地依赖包括 lazyllm、langfuse。

还有 opentelemetry-api、sdk。

以及 OTLP HTTP exporter。

---

环境变量只保留关键三类。

LAZYLLM_TRACE_ENABLED 打开。

LAZYLLM_TRACE_BACKEND 设成 langfuse。

LAZYLLM_TRACE_CONTENT_ENABLED 控制内容采集。

---

如果代码已经用 LazyLLM 编排。

配置好后直接运行。

默认观测会自动生成 Trace。

---

文档里的 RAG 骨架是 Document、Retriever、formatter、LLM、Pipeline。

这个结构跑起来后，Langfuse 里会出现 Pipeline Trace。

---

里面能看到 Pipeline、retriever、llm、lambda、TxtReader。

llm 的 observation type 是 GENERATION。

retriever 是 RETRIEVER。

---

set_trace_context 是请求级上下文 API。

它在真正执行工作流前写入信息。

自己不会创建 Trace。

---

它常用来写 session_id、user_id、request_tags。

也可以写 trace_id、parent_span_id。

还可以写 sampled、debug_capture_payload、module_trace。

---

要记住一个规则。

set_trace_context 后面必须真的调用 LazyLLM 工作流。

否则不会产生新 Trace。

---

enable_trace 管入口边界。

wrapper 适合某一次调用。

decorator 适合服务入口或长期复用函数。

---

包装 Flow 或 Module 时。

enable_trace 主要准备上下文。

内部节点仍然走默认 hook。

---

包装普通 Python callable 时。

如果没有活动父节点。

它会按需要补一个入口 span。

---

Tracing 专用参数会先被消费。

比如 session_id、request_tags。

它们不会继续传给业务函数。

---

采集配置分两层。

进程默认看环境变量。

单次覆盖看 LazyTraceContext。

---

全局开关是三个。

TRACE_ENABLED 控制是否默认开启。

TRACE_CONTENT_ENABLED 控制 payload。

TRACE_BACKEND 控制写入后端。

---

请求级字段更细。

enabled 控制本次是否开启。

sampled 控制是否上报。

debug_capture_payload 控制内容。

module_trace 控制模块。

---

debug_capture_payload 设成 False。

Trace 仍然生成。

只是 input 和 output 不完整保存。

---

module_trace 可以按模块关采集。

比如 by_name 里把 llm 设成 False。

这次请求里 llm 节点就不记录。

---

归属字段用于分析。

session_id 聚合同一会话。

user_id 定位用户。

request_tags 做筛选和对比。

---

trace_id 和 parent_span_id 用来续接链路。

跨系统调用时，它们决定新 span 接到哪里。

---

内部架构可以分成四层。

运行层执行 Flow、Module、callable。

埋点适配层决定怎么接入和补语义。

---

OTEL 标准层管理 span 生命周期。

也管理上下文传播、父子关系和请求聚合。

---

Backend 层构造 exporter。

把 OTel spans 写入 Langfuse 或本地 JSONL。

---

分析适配层从后端读 Trace。

再转换给评估系统和自进化系统消费。

---

核心对象有三个。

LazyTraceContext。

LazySpan。

LazyTrace。

---

LazyTraceContext 很轻。

保存 trace_id、parent_span_id、session、user、tags。

也保存采集控制字段。

---

LazySpan 是单个 observation 快照。

保存 name、span_kind、semantic_type。

也保存 input、output、status、error、config、usage。

---

LazyTrace 是请求级聚合对象。

保存 root_span_id、开始结束时间、整体状态和 metadata。

---

默认接入依赖已有执行链。

Flow 初始化时，会 register_hooks。

hook 列表来自 resolve_builtin_hooks。

---

Flow 调用入口走 execution_with_hooks。

同时用 stack_enter 让运行时知道调用层级。

---

Module 也是同一套。

__call__ 会把 _call_impl 包进 execution_with_hooks。

---

内置 hook provider 集中判断对象要不要进观测。

trace_enabled 关了，就不挂。

模块规则关了，也不挂。

---

通过判断后。

provider 返回 LazyTracingHook。

后续调用就能进入 Tracing 生命周期。

---

一个节点的生命周期很固定。

pre_hook 建 span。

post_hook 写结果。

on_error 写异常。

finalize 关闭 span。

---

pre_hook 会读 globals 里的 trace 配置。

enabled 是 False，直接跳过。

sampled 是 False，也跳过。

---

post_hook 会回写 output。

也会写 usage 和结构化属性。

这些属性后面会映射到后端。

---

retriever 和 reranker 有些结果来得晚。

所以 hook 会提前安装 probe。

在后处理阶段补采。

---

采集控制的顺序是固定的。

先判断这次请求能不能建节点。

再判断当前模块能不能记录。

再决定要不要保存 payload。

---

payload 判断也有优先级。

ctx.debug_capture_payload 优先。

没有请求级覆盖，才看 trace_content_enabled。

---

节点只存 input、output 不够。

collect_trace_config 会补组件配置。

resolve_semantic_type 会补统一语义。

---

在线模型补模型配置。

Retriever 补 similarity 和 Top-K。

Reranker 补重排信息。

Flow 补控制流结构。

---

输出属性也会补。

检索分数、重排分数、分支命中。

还有循环实际迭代次数。

---

OTEL 层最关键的是状态拆分。

globals['trace'] 只放轻量、可序列化信息。

比如 trace_id 和 parent_span_id。

---

当前请求聚合状态放在 _current_trace。

这是 ContextVar。

当前 active span 交给 OTel context。

---

start_span 会先找当前活跃 span。

有就接到它下面。

没有就看 trace_id 和 parent_span_id。

---

如果轻量上下文里有父链路。

start_span 会重建父 SpanContext。

再把新 span 的 id 写回上下文。

---

finish_span 会构造 OTel 属性。

再让 backend 做 map_attributes。

如果有异常，也会 record_exception。

---

enable_trace 内部会保存旧上下文。

覆盖本次入口字段。

执行结束后，再恢复旧上下文。

---

并发传播分线程和进程。

线程路径用 copy_context().run。

ContextVar 和 OTel active context 能一起进 worker。

---

进程路径不能带活跃 span。

它传 globals 数据快照。

worker 侧恢复 sid，再 update global_data。

---

进程里的新 span 不复用父进程对象。

它读取 trace_id 和 parent_span_id。

再接回原 Trace。

---

LazyTrace 负责请求级聚合。

首个活动 span 创建它。

后续 span 登记进去。

---

Backend 层隔离写入目标。

TracingBackend 只抽象两个能力。

build_exporter 和 map_attributes。

---

Langfuse 后端走 OTLP exporter。

Local 后端写 JSONL。

Consume backend 再把已有数据读回来。

---

新增后端时，主要实现这一层适配。

运行层、Hook 层、OTEL 生命周期都不用重写。

---

所以这套 Tracing 的主线很清楚。

Hook 负责接入。

OTEL 负责链路。

Backend 负责落地。
