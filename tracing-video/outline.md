# Video Outline

> **主题**：`待选定`（Checkpoint Plan 选择）—— 高密度技术架构 walkthrough
> **总时长**：约 13 分钟（口播约 3100 字 ÷ 4 字/秒）
> **章节数**：9 章 / 63 步
> **画面密度原则**：每个 step 至少包含 1 个主视觉关系 + 2~4 个技术锚点（字段 / 代码符号 / 配置项 / 状态值 / 数据指标），避免单句大字页
> **动态演示原则**：outline 只标注“要演的关系 / 状态变化 / 数据流转”，不指定具体动画技法；章节实现时每章至少 2 处流程、状态或数据变化演示，清单必须逐项推进

---

## 1. trace-scope — Trace 记录什么（6 steps · ~75s）

**信息池**（chapter agent 按需挂角标 / 副标 / pull-quote / mono cue）：
- 核心视图：每次真实请求建立统一、结构化、可深度分析的执行视图 —— 来源 article §1 / L7
- 上下文字段：`trace_id`、`session_id`、`request_tags` —— 来源 article §1.2 / L35-L37
- 拓扑结构：所有节点及嵌套父子调用关系 —— 来源 article §1.2 / L35-L37
- I/O 与状态：Input、Output、成功 / 失败、异常栈，是否保存完整内容受配置控制 —— 来源 article §1.2 / L40-L42
- 节点语义：`llm`、`retriever`、`rerank`、`tool`、`agent` —— 来源 article §1.2 / L45-L48
- 性能与资源：绝对耗时、`prompt_tokens`、`completion_tokens` —— 来源 article §1.2 / L51-L52

**开发计划**：

- step 1 (~11s) — 主视觉 Trace 树从一次 request 展开，旁挂 `trace_id`、root span、backend 三个锚点
- step 2 (~11s) — 请求上下文横条绑定跨组件行为：`trace_id` / `session_id` / `request_tags` 与 3 个组件节点同步归组
- step 3 (~10s) — 拓扑视图展示 Pipeline、retriever、llm、tool 的父子调用关系和 `parent_span_id` 连接
- step 4 (~12s) — 节点详情面板同时展示 Input、Output、status、error stack，并演示 payload 开关影响内容留存
- step 5 (~14s) — 语义分类矩阵展示 `llm` / `retriever` / `rerank` / `tool` / `agent`，每类连到可分析字段
- step 6 (~17s) — 节点账本合并配置与资源：model、Top-K、score、branch、latency、prompt_tokens、completion_tokens

口播节选：
> 它给每次请求，生成一棵结构化 Trace 树。节点还会补语义，比如 llm、retriever、rerank、tool、agent。

---

## 2. diagnosis-value — 排障价值只讲技术点（6 steps · ~70s）

**信息池**：
- RAG 链路：`Retriever -> Reranker -> LLM` —— 来源 article §1.1 / L15-L18
- Agent 排障对象：模型输出、工具调用、状态回填、无效循环 —— 来源 article §1.1 / L18-L20
- 性能定位：节点级时延瀑布图 Waterfall —— 来源 article §1.1 / L22-L24
- 聚合维度：会话、用户等标签 —— 来源 article §1.1 / L26-L28
- 回归对象：流程改动、Prompt 优化、底层模型切换 —— 来源 article §1.1 / L30-L32
- Tracing 定位能力：请求途经节点、父子关系、哪层决定最终结果 —— 来源 article §1.3 / L65-L68

**开发计划**：

- step 1 (~12s) — RAG 链路拆成 Retriever、Reranker、LLM 三段，每段显示输入、输出和关键判断字段
- step 2 (~12s) — 错误归因面板同时对比未召回、上下文未利用、rerank 分数异常三条证据路径
- step 3 (~11s) — Agent 轨迹展示模型输出、工具调用、状态回填和循环计数，突出无效循环定位
- step 4 (~12s) — Waterfall 以节点耗时条定位慢点，旁挂 LLM 推理、检索等待、控制流膨胀三个候选原因
- step 5 (~12s) — 聚合视图用 session、user、request_tags 把同类请求分组，并并排放 Prompt / model / flow 版本标签
- step 6 (~11s) — 三视角对比：Logging 事件、Metrics 趋势、Tracing 请求链路，同屏展示各自能回答的问题

口播节选：
> Logging 看局部事件。Metrics 看聚合趋势。Tracing 看一次请求的完整执行视图。

---

## 3. langfuse-rag — Langfuse 接入和默认 RAG Trace（7 steps · ~85s）

**信息池**：
- 必需凭证：`LANGFUSE_BASE_URL`、`LANGFUSE_PUBLIC_KEY`、`LANGFUSE_SECRET_KEY` —— 来源 article §2.1 / L88-L90
- Cloud 地址：EU `https://cloud.langfuse.com`，US `https://us.cloud.langfuse.com` —— 来源 article §2.1 / L94-L100
- 依赖：`lazyllm`、`langfuse`、`opentelemetry-api`、`opentelemetry-sdk`、OTLP HTTP exporter —— 来源 article §2.1 / L103-L110
- 环境变量：`LAZYLLM_TRACE_ENABLED`、`LAZYLLM_TRACE_BACKEND`、`LAZYLLM_TRACE_CONTENT_ENABLED` —— 来源 article §2.1 / L114-L129
- RAG 骨架：`Document -> Retriever -> formatter -> LLM -> Pipeline` —— 来源 article §2.2.1 / L136-L177
- Langfuse 节点：`Pipeline`、`retriever`、`llm`、`<lambda>`、`TxtReader` —— 来源 article §2.2.1 / L193-L198
- observation type：`GENERATION`、`RETRIEVER` —— 来源 article §2.2.1 / L197-L198

**开发计划**：

- step 1 (~11s) — Langfuse 凭证面板显示 `BASE_URL`、`PUBLIC_KEY`、`SECRET_KEY`，配项目设置截图占位
- step 2 (~10s) — 区域选择表对比 EU / US Base URL，并把最终 URL 写入运行环境槽位
- step 3 (~11s) — 依赖栈分层展示 `lazyllm`、`langfuse`、OTel API / SDK / OTLP exporter 的职责
- step 4 (~13s) — 环境变量终端区展示 `TRACE_ENABLED`、`TRACE_BACKEND`、`TRACE_CONTENT_ENABLED` 三个开关如何影响链路
- step 5 (~12s) — 业务代码与观测接入并排：LazyLLM 编排代码不改，Trace 输出路径点亮
- step 6 (~15s) — RAG 骨架把 Document、Retriever、formatter、LLM、Pipeline 连成可执行数据流
- step 7 (~13s) — Langfuse Trace 页面叠加 Pipeline、retriever、llm、lambda、TxtReader 与 `GENERATION` / `RETRIEVER` 类型标记

口播节选：
> 如果代码已经用 LazyLLM 编排，配置好后直接运行。默认观测会自动生成 Trace。

---

## 4. control-api-config — 请求上下文、入口和采集控制（8 steps · ~105s）

**信息池**：
- `set_trace_context(...)`：写入请求上下文，不主动创建 Trace —— 来源 article §2.3 / L204-L242
- `LazyTraceContext` 示例字段：`session_id`、`user_id`、`request_tags` —— 来源 article §2.3.2 / L222-L236
- `enable_trace(...)`：显式声明观测入口 —— 来源 article §2.4 / L244-L250
- wrapper / decorator：一次调用 vs 稳定入口 —— 来源 article §2.4.1-L2.4.2 / L252-L294
- Flow / Module 与普通 callable 的差异 —— 来源 article §2.4 / L249-L250
- 请求级采集控制：`enabled`、`sampled`、`debug_capture_payload`、`module_trace` —— 来源 article §2.5.2 / L324-L333
- payload 关闭示例：`debug_capture_payload=False` —— 来源 article §2.5.2 / L337-L353
- 模块关闭示例：`module_trace={"by_name": {"llm": False}}` —— 来源 article §2.5.2 / L355-L369

**开发计划**：

- step 1 (~13s) — `set_trace_context` 调用卡片写入 `LazyTraceContext`，同时标出“只写上下文，不建 Trace”
- step 2 (~13s) — 字段面板高密度列出 session、user、tags、trace_id、parent_span_id、sampled、module_trace 的去向
- step 3 (~10s) — 两段执行对照：只 set 无 Trace，set 后执行 `rag_ppl(question)` 才生成链路
- step 4 (~13s) — `enable_trace` 入口边界图对比 wrapper 和 decorator，标出一次调用与稳定服务入口
- step 5 (~13s) — 分流图展示 Flow / Module 继续走默认 hook，普通 callable 在无父节点时补入口 span
- step 6 (~10s) — 参数消费面板展示 `session_id`、`request_tags` 被 Tracing 消费，业务函数参数列表保持干净
- step 7 (~17s) — 配置优先级图对比环境变量默认值和 `LazyTraceContext` 单次覆盖字段
- step 8 (~16s) — 控制台同时演示 `debug_capture_payload=False`、`module_trace.by_name.llm=False`、链路续接字段生效位置

口播节选：
> set_trace_context 是请求级上下文 API。enable_trace 管入口边界。

---

## 5. architecture-objects — 分层架构和三类对象（8 steps · ~95s）

**信息池**：
- 分层：运行层、埋点适配层、OTEL 标准层、Tracing Backend、分析适配层 —— 来源 article §3.1.1 / L447-L459
- 运行层：`Flow`、`Module`、`callable` —— 来源 article §3.1.1 / L454-L459
- 埋点适配层：默认接入、采集策略、语义补全、结构化输出属性 —— 来源 article §3.1.1 / L456-L459
- OTEL 标准层：span 生命周期、上下文传播、父子关系、请求级聚合状态 —— 来源 article §3.1.1 / L457-L459
- Backend：构造 exporter，把 OTel spans 写入后端 —— 来源 article §3.1.1 / L458-L459
- `LazyTraceContext` 字段 —— 来源 article §3.1.2 / L471-L484
- `LazySpan` 字段 —— 来源 article §3.1.2 / L485-L502
- `LazyTrace` 字段 —— 来源 article §3.1.2 / L503-L521

**开发计划**：

- step 1 (~12s) — 四层采集链纵向展开：运行层、hook 适配、OTEL、Backend，每层挂关键文件路径
- step 2 (~11s) — 分析消费路径从 backend 读 Trace，分流到评估系统和自进化系统的数据结构
- step 3 (~10s) — 三对象关系板同时放 `LazyTraceContext`、`LazySpan`、`LazyTrace` 的最小字段快照
- step 4 (~13s) — `LazyTraceContext` 高亮 trace_id、parent_span_id、session、user、tags、sampled、module_trace
- step 5 (~13s) — `LazySpan` 展示 name、span_kind、semantic_type、input、output、status、error、config、usage
- step 6 (~11s) — `LazyTrace` 展示 root_span_id、start_time、end_time、status、metadata 和 span 登记区域
- step 7 (~12s) — 分工图把传播、节点快照、请求聚合三类状态分别接到对应对象
- step 8 (~13s) — Trace 树拆解为多层状态协作：轻量上下文驱动连接，span 快照填内容，trace 聚合收尾

口播节选：
> 核心对象有三个。LazyTraceContext、LazySpan、LazyTrace。

---

## 6. auto-attach — 默认观测如何自动挂上去（6 steps · ~75s）

**信息池**：
- Flow 初始化挂 hook：`register_hooks(self, resolve_builtin_hooks(self))` —— 来源 article §3.2.1 / L530-L545
- Flow 调用入口：`@execution_with_hooks` 与 `globals.stack_enter(...)` —— 来源 article §3.2.1 / L530-L545
- Module 调用：`execution_with_hooks(self, ...)(self._call_impl)(...)` —— 来源 article §3.2.1 / L549-L553
- provider 容器：`_builtin_hook_providers` 与 `resolve_builtin_hooks(...)` —— 来源 article §3.3.1 / L560-L576
- `resolve_tracing_hooks(...)`：检查 `trace_enabled` 与模块级规则 —— 来源 article §3.3.1 / L578-L591
- 返回结果：`[LazyTracingHook]` —— 来源 article §3.3.1 / L589-L591

**开发计划**：

- step 1 (~12s) — 执行链总览展示业务 API 不变，观测能力附着在已有 `Flow` / `Module` 调用路径
- step 2 (~12s) — Flow 初始化代码片段突出 `register_hooks(self, resolve_builtin_hooks(self))`
- step 3 (~13s) — Flow 调用路径展示 `@execution_with_hooks`、`globals.stack_enter(...)`、真实 `_run(...)`
- step 4 (~11s) — Module 调用路径展示 `__call__`、`execution_with_hooks(...)`、`_call_impl(...)` 三段
- step 5 (~15s) — provider 判断流程同时显示 `trace_enabled`、`_module_id`、默认模块规则、运行时关闭条件
- step 6 (~12s) — 返回 `[LazyTracingHook]` 后进入节点生命周期，旁挂将要触发的 pre / post / error / finalize

口播节选：
> 默认接入依赖已有执行链。Flow 初始化时，会 register_hooks。

---

## 7. hook-capture-semantics — 节点生命周期、采集顺序和语义补全（8 steps · ~105s）

**信息池**：
- hook 生命周期：`pre_hook`、`post_hook`、`on_error`、`finalize` —— 来源 article §3.3.2 / L599-L648
- `pre_hook` 判断：`enabled`、`sampled`、运行时模块关闭 —— 来源 article §3.3.2 / L622-L632
- `post_hook`：output、usage、结构化属性 —— 来源 article §3.3.2 / L633-L639
- probe：retriever / reranker 后处理补采 —— 来源 article §3.3.2 / L650-L651
- 采集顺序：请求能否建节点、模块能否记录、payload 是否保留 —— 来源 article §3.3.3 / L652-L693
- payload 判断：`debug_capture_payload` 覆盖 `trace_content_enabled` —— 来源 article §3.3.3 / L674-L693
- 配置与语义补全：`collect_trace_config(...)`、`resolve_semantic_type_for_target(...)` —— 来源 article §3.3.4 / L703-L723
- 输出属性：检索分数、重排分数、分支命中、循环次数 —— 来源 article §3.3.4 / L699-L726

**开发计划**：

- step 1 (~13s) — 生命周期环展示 pre_hook、post_hook、on_error、finalize 四段与 span 状态变化
- step 2 (~13s) — pre_hook 决策表逐项检查 `enabled`、`sampled`、module_trace，并显示跳过 / 创建 span 两条路径
- step 3 (~12s) — post_hook 写回面板展示 output、usage、structured attrs 到 LazySpan 和 OTel attrs 的流向
- step 4 (~12s) — retriever / reranker 后处理路径展示 probe 先安装、结果后补采、分数回填
- step 5 (~15s) — 三段采集门禁展示请求是否建节点、模块是否记录、payload 是否保存的先后顺序
- step 6 (~13s) — payload 优先级面板展示 `ctx.debug_capture_payload` 覆盖 `trace_content_enabled`
- step 7 (~13s) — 语义补全图展示 `collect_trace_config(...)`、`resolve_semantic_type_for_target(...)` 到统一节点语义
- step 8 (~14s) — 输出属性网格展示 retrieval score、rerank score、branch hit、loop iterations 如何变成可分析字段

口播节选：
> 采集控制的顺序是固定的。先判断这次请求能不能建节点，再判断当前模块能不能记录，再决定要不要保存 payload。

---

## 8. otel-runtime — OTEL 上下文、span 生命周期和并发传播（10 steps · ~130s）

**信息池**：
- 状态拆分：`globals['trace']`、`_current_trace`、OTel active context —— 来源 article §3.4.1 / L729-L756
- `start_span(...)`：活跃 span 优先；否则根据 `trace_id` / `parent_span_id` 重建父链路 —— 来源 article §3.4.2 / L762-L782
- `finish_span(...)`：写属性、backend 映射、记录异常、关闭上下文管理器 —— 来源 article §3.4.2 / L784-L797
- `enable_trace(...)` 内部：保存旧上下文、覆盖入口字段、组件 / callable 分流、恢复旧上下文 —— 来源 article §3.4.3 / L801-L826
- 线程路径：`copy_context().run(...)` —— 来源 article §3.4.4 / L830-L856
- 进程路径：传 `globals._data` 快照，worker 恢复 `sid` 和 `global_data` —— 来源 article §3.4.4 / L830-L856
- 进程续接：用 `trace_id` / `parent_span_id` 接回原 Trace，不复用活跃 span 实例 —— 来源 article §3.4.4 / L834-L837
- `LazyTrace` 聚合：首个活动 span 创建请求级对象，后续 span 登记 —— 来源 article §3.4.5 / L861-L884

**开发计划**：

- step 1 (~13s) — 三层状态板并排：`globals['trace']`、`_current_trace`、OTel active context，各自只显示负责字段
- step 2 (~12s) — `globals['trace']` 展示轻量可序列化快照：trace_id、parent_span_id、tags、采集控制
- step 3 (~12s) — `_current_trace` 与 OTel active span 分离展示：请求聚合状态不存放 active span 实例
- step 4 (~14s) — `start_span` 父链路决策：优先 current active span，再看显式父链路字段
- step 5 (~15s) — 无活跃 span 场景展示用 trace_id / parent_span_id 重建父 SpanContext 并回写新 span id
- step 6 (~13s) — `finish_span` 收尾面板展示通用 attrs、backend mapped attrs、exception、context manager close
- step 7 (~13s) — `enable_trace` 内部状态栈展示保存旧 ctx、覆盖入口字段、执行函数、恢复旧 ctx
- step 8 (~15s) — 线程传播路径展示 `copy_context().run(...)` 携带 ContextVar、`_current_trace` 和 OTel active context
- step 9 (~15s) — 进程传播路径展示 globals 快照、worker `_init_sid`、`_update(global_data)`、父链路重建
- step 10 (~8s) — `LazyTrace` 聚合视图展示首个 span 创建 trace、后续 span 登记、结束状态更新

口播节选：
> globals['trace'] 只放轻量、可序列化信息。当前请求聚合状态放在 _current_trace。当前 active span 交给 OTel context。

---

## 9. backend-close — Backend 抽象和收束（4 steps · ~45s）

**信息池**：
- Backend 职责：将标准化 span 写入具体观测后端，隔离写入目标差异 —— 来源 article §3.5 / L886-L889
- `TracingBackend` 抽象：`build_exporter` 和 `map_attributes` —— 来源 article §3.5.1 / L892-L909
- Langfuse：OTLP exporter；Local：JSONL 文件 —— 来源 article §3.5.1-L3.5.2 / L911-L934
- Consume backend：读取已有观测数据并还原统一 payload —— 来源 article §3.5.2 / L915-L934

**开发计划**：

- step 1 (~12s) — Backend 分流图把同一组 OTel spans 分别指向 Langfuse 和 Local JSONL
- step 2 (~12s) — `TracingBackend` 接口卡展示 `build_exporter` 负责写入通道，`map_attributes` 负责字段适配
- step 3 (~11s) — Langfuse OTLP exporter、Local JSONL writer、Consume backend reader 三段并列
- step 4 (~10s) — 收束总图把 Hook 接入、OTEL 父链路、Backend 写入目标合成一条技术主线

口播节选：
> 新增后端时，主要实现这一层适配。运行层、Hook 层、OTEL 生命周期都不用重写。

---

## 素材清单

### 1. trace-scope
- ⚠️ Trace 树与节点字段示意图（代码绘制）
- ⚠️ 语义标签和资源用量卡片（代码绘制）

### 2. diagnosis-value
- ⚠️ RAG `Retriever -> Reranker -> LLM` 归因图（代码绘制）
- ⚠️ Agent 工具调用 / 状态回填 / 循环示意图（代码绘制）
- ⚠️ Waterfall 耗时图（代码绘制）

### 3. langfuse-rag
- ✓ Langfuse 注册/登录界面（`docs/assets/langfuse_signup.png`）
- ✓ Langfuse API Key 创建界面（`docs/assets/langfuse_key.png`）
- ✓ Langfuse 观测界面（`docs/assets/langfuse.png`）
- ⚠️ RAG 代码骨架和环境变量终端片段（代码绘制）

### 4. control-api-config
- ⚠️ `set_trace_context` / `enable_trace` 对比图（代码绘制）
- ⚠️ LazyTraceContext 字段面板（代码绘制）
- ⚠️ module_trace / debug_capture_payload 控制面板（代码绘制）

### 5. architecture-objects
- ✓ LazyLLM 观测系统整体架构（`docs/assets/trace_system.png`）
- ⚠️ LazyTraceContext / LazySpan / LazyTrace 三对象关系图（代码绘制）

### 6. auto-attach
- ⚠️ Flow / Module / execution_with_hooks 接入链路图（代码绘制）
- ⚠️ hook provider 判断流程图（代码绘制）

### 7. hook-capture-semantics
- ⚠️ LazyTracingHook 生命周期图（代码绘制）
- ⚠️ 三层采集控制图（代码绘制）
- ⚠️ 语义补全和输出属性补全图（代码绘制）

### 8. otel-runtime
- ⚠️ `globals['trace']` / `_current_trace` / OTel active context 三层状态图（代码绘制）
- ⚠️ `start_span` / `finish_span` 父链路图（代码绘制）
- ⚠️ 线程与进程上下文传播对比图（代码绘制）

### 9. backend-close
- ⚠️ Langfuse / Local backend 写入分流图（代码绘制）
- ⚠️ Hook / OTEL / Backend 三段主线收束图（代码绘制）
