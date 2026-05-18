# 视频大纲

> **主题**：`monochrome-print`（黑白印刷）—— 高密度中文技术架构讲解
> **总时长**：约 24 分钟（口播约 5800 字 ÷ 4 字/秒）
> **章节数**：9 章 / 39 步
> **画面密度原则**：每一步至少包含 1 个主视觉关系 + 3~6 个技术锚点（字段 / 代码符号 / 配置项 / 状态值 / 数据指标），避免一个小概念拆一页
> **动态演示原则**：大纲只标注“要演的关系 / 状态变化 / 数据流转”，不指定具体动画技法；章节实现时每章至少 2 处流程、状态或数据变化演示，清单必须逐项推进
> **中文呈现原则**：页面可见标题、面板名、标签名、解释词全部用中文；英文只保留在代码标识、环境变量、类名、函数名、字段名和产品名里，必要时用“中文（English）”形式作为技术锚点

---

## 1. trace-scope — 追踪记录什么（6 步 · ~181s）

**信息池**（章节实现时按需挂角标 / 副标 / 引用摘录 / 等宽提示）：
- 核心视图：每次真实请求建立统一、结构化、可深度分析的执行视图 —— 来源 article §1 / L7
- 上下文字段：`trace_id`、`session_id`、`request_tags` —— 来源 article §1.2 / L35-L37
- 拓扑结构：所有节点及嵌套父子调用关系 —— 来源 article §1.2 / L35-L37
- 输入输出与状态：输入、输出、成功 / 失败、异常栈，是否保存完整内容受配置控制 —— 来源 article §1.2 / L40-L42
- 节点语义：`llm`、`retriever`、`rerank`、`tool`、`agent` —— 来源 article §1.2 / L45-L48
- 性能与资源：绝对耗时、`prompt_tokens`、`completion_tokens` —— 来源 article §1.2 / L51-L52

**开发计划**：

- step 1 (~30s) — 主视觉“追踪树”从一次请求展开，旁挂 `trace_id`、根节点、写入后端三个锚点
- step 2 (~27s) — 请求上下文横条绑定跨组件行为：`trace_id` / `session_id` / `request_tags` 与 3 个组件节点同步归组
- step 3 (~32s) — 拓扑视图展示流水线、检索器、模型、工具的父子调用关系，并用 `parent_span_id` 标出连接
- step 4 (~31s) — 节点详情面板同时展示输入、输出、状态、异常栈，并演示内容载荷开关影响内容留存
- step 5 (~29s) — 语义分类矩阵展示 `llm` / `retriever` / `rerank` / `tool` / `agent`，每类连到可分析字段
- step 6 (~32s) — 节点账本合并配置与资源：模型、Top-K、分数、分支、耗时、`prompt_tokens`、`completion_tokens`

口播节选：
> 它把一次真实请求变成 Trace 树。节点要补语义；有了 semantic_type，上层系统才知道该读模型字段、召回分数，还是工具调用。

---

## 2. diagnosis-value — 排障价值只讲技术点（4 步 · ~143s）

**信息池**：
- RAG 链路：`Retriever -> Reranker -> LLM`，画面上显示为“检索器 → 重排器 → 大模型” —— 来源 article §1.1 / L15-L18
- 智能体排障对象：模型输出、工具调用、状态回填、无效循环 —— 来源 article §1.1 / L18-L20
- 性能定位：节点级时延瀑布图（Waterfall）—— 来源 article §1.1 / L22-L24
- 聚合维度：会话、用户等标签 —— 来源 article §1.1 / L26-L28
- 回归对象：流程改动、提示词优化、底层模型切换 —— 来源 article §1.1 / L30-L32
- 三类观测：Logging 看事件，Metrics 看趋势，Tracing 看请求链路 —— 来源 article §1.3 / L65-L76

**开发计划**：

- step 1 (~43s) — RAG 三段诊断总图：Retriever / Reranker / LLM 同屏展示输入、输出、耗时、关键判断字段
- step 2 (~27s) — 错误归因矩阵：未召回、上下文未利用、重排分数异常三条证据路径并排
- step 3 (~32s) — Agent 决策链：模型输出、`tool_call_id`、工具参数、工具返回、状态回填、`loop_count` 同屏
- step 4 (~41s) — Waterfall + 线上聚合 + 三类观测对比：节点 duration、标签维度、Prompt / 模型 / 流程版本

口播节选：
> RAG 排障先拆链路，不要先猜模型。Waterfall 把总耗时拆成节点 duration。

---

## 3. langfuse-rag — Langfuse 接入和默认 RAG 追踪（5 步 · ~236s）

**信息池**：
- 必需凭证：`LANGFUSE_BASE_URL`、`LANGFUSE_PUBLIC_KEY`、`LANGFUSE_SECRET_KEY` —— 来源 article §2.1 / L88-L90
- 云服务地址：欧区 `https://cloud.langfuse.com`，美区 `https://us.cloud.langfuse.com` —— 来源 article §2.1 / L94-L100
- 依赖：`lazyllm`、`langfuse`、`opentelemetry-api`、`opentelemetry-sdk`、OTLP HTTP exporter —— 来源 article §2.1 / L103-L110
- 环境变量：`LAZYLLM_TRACE_ENABLED`、`LAZYLLM_TRACE_BACKEND`、`LAZYLLM_TRACE_CONTENT_ENABLED` —— 来源 article §2.1 / L114-L129
- RAG 骨架：`Document -> Retriever -> formatter -> LLM -> Pipeline` —— 来源 article §2.2.1 / L136-L177
- Langfuse 节点：`Pipeline`、`retriever`、`llm`、`<lambda>`、`TxtReader` —— 来源 article §2.2.1 / L193-L198
- 观测类型：生成节点 `GENERATION`、检索节点 `RETRIEVER` —— 来源 article §2.2.1 / L197-L198

**开发计划**：

- step 1 (~51s) — Langfuse 凭证和区域配置：`BASE_URL`、public / secret key、EU / US / self-host 地址同屏
- step 2 (~54s) — 依赖栈 + 运行开关：LazyLLM、Langfuse、OpenTelemetry、OTLP exporter 和三个 `LAZYLLM_TRACE_*`
- step 3 (~33s) — 默认接入路径：业务 pipeline 不改，Flow / Module hook 点亮，Trace 自动生成
- step 4 (~50s) — RAG 代码骨架映射：Document、Retriever、formatter、LLM、Pipeline 对应 Trace 节点
- step 5 (~48s) — Langfuse 观测页面读取：节点名、observation type、`GENERATION` / `RETRIEVER` 语义标记

口播节选：
> 配置好后端和开关，继续运行原来的 pipeline，框架就会自动生成 Trace。

---

## 4. control-api-config — 请求上下文、入口和采集控制（5 步 · ~202s）

**信息池**：
- `set_trace_context(...)`：写入请求上下文，不主动创建追踪 —— 来源 article §2.3 / L204-L242
- `LazyTraceContext` 字段：`session_id`、`user_id`、`request_tags`、`trace_id`、`parent_span_id` —— 来源 article §2.3.2 / L222-L236
- `enable_trace(...)`：显式声明观测入口 —— 来源 article §2.4 / L244-L250
- 包装调用 / 装饰器：一次调用 vs 稳定入口 —— 来源 article §2.4.1-L2.4.2 / L252-L294
- 请求级采集控制：`sampled`、`debug_capture_payload`、`module_trace` —— 来源 article §2.5.2 / L324-L333
- 内容和模块关闭示例：`debug_capture_payload=False`、`module_trace={"by_name":{"llm":False}}` —— 来源 article §2.5.2 / L337-L369

**开发计划**：

- step 1 (~47s) — `set_trace_context` 语义页：只写上下文、不建 Trace；展示归属字段和链路续接字段
- step 2 (~38s) — 请求级采集控制页：`sampled`、`debug_capture_payload`、`module_trace` 的作用和生效范围
- step 3 (~37s) — `enable_trace` 入口边界页：wrapper / decorator、Flow / Module、普通 callable 的差异
- step 4 (~39s) — 参数消费和配置优先级页：Tracing 专用参数被消费，环境变量默认值被 LazyTraceContext 覆盖
- step 5 (~41s) — 采集开关分层页：`enabled` / `sampled` / payload / module 规则如何分别影响节点和内容

口播节选：
> set_trace_context 只写请求上下文，不创建 Trace。enable_trace 管入口边界。

---

## 5. architecture-objects — 分层架构和三类对象（4 步 · ~140s）

**信息池**：
- 分层：运行层、埋点适配层、OpenTelemetry 标准层、追踪后端层、分析适配层 —— 来源 article §3.1.1 / L447-L459
- 运行层对象：`Flow`、`Module`、普通 `callable` —— 来源 article §3.1.1 / L454-L459
- 埋点适配层：默认接入、采集策略、语义补全、结构化输出属性 —— 来源 article §3.1.1 / L456-L459
- OpenTelemetry 层：节点生命周期、上下文传播、父子关系、请求聚合状态 —— 来源 article §3.1.1 / L457-L459
- `LazyTraceContext` 字段 —— 来源 article §3.1.2 / L471-L484
- `LazySpan` 字段 —— 来源 article §3.1.2 / L485-L502
- `LazyTrace` 字段 —— 来源 article §3.1.2 / L503-L521

**开发计划**：

- step 1 (~39s) — 分层数据流总图：运行层、hook 适配层、OpenTelemetry、后端、消费适配层串起来
- step 2 (~38s) — `LazyTraceContext` 页：轻量传播字段和采集控制字段，强调不能依赖 active span
- step 3 (~33s) — `LazySpan` 页：单节点 observation 快照字段，连接后端属性映射
- step 4 (~30s) — `LazyTrace` 页：请求级账本与三对象分工，上下文传播 / 节点事实 / 全局视图分离

口播节选：
> 上下文负责传播，Span 负责事实，Trace 负责全局视图。

---

## 6. auto-attach — 默认观测如何自动挂上去（3 步 · ~125s）

**信息池**：
- 工作流初始化挂 hook：`register_hooks(self, resolve_builtin_hooks(self))` —— 来源 article §3.2.1 / L530-L545
- 工作流调用入口：`@execution_with_hooks` 与 `globals.stack_enter(...)` —— 来源 article §3.2.1 / L530-L545
- 模块调用：`execution_with_hooks(self, ...)(self._call_impl)(...)` —— 来源 article §3.2.1 / L549-L553
- provider 容器：`_builtin_hook_providers` 与 `resolve_builtin_hooks(...)` —— 来源 article §3.3.1 / L560-L576
- `resolve_tracing_hooks(...)`：检查 `trace_enabled` 与模块级规则 —— 来源 article §3.3.1 / L578-L591
- 返回结果：`[LazyTracingHook]` —— 来源 article §3.3.1 / L589-L591

**开发计划**：

- step 1 (~43s) — Flow 初始化接入页：`register_hooks(...)`、`resolve_builtin_hooks(...)`、provider 能力关系
- step 2 (~47s) — Flow / Module 调用边界页：`execution_with_hooks`、`globals.stack_enter(...)`、`_call_impl(...)`
- step 3 (~35s) — provider 判断页：`trace_enabled`、模块规则、返回 `[LazyTracingHook]`、进入生命周期

口播节选：
> 父子关系来自框架调用栈，不靠业务代码手写。

---

## 7. hook-capture-semantics — 生命周期、采集顺序和语义补全（4 步 · ~154s）

**信息池**：
- hook 生命周期：`pre_hook`、`post_hook`、`on_error`、`finalize` —— 来源 article §3.3.2 / L599-L648
- `pre_hook` 判断：`enabled`、`sampled`、运行时模块关闭 —— 来源 article §3.3.2 / L622-L632
- `post_hook`：output、usage、结构化属性 —— 来源 article §3.3.2 / L633-L639
- 探针：检索器 / 重排器后处理补采 —— 来源 article §3.3.2 / L650-L651
- 采集顺序：请求能否建节点、模块能否记录、内容载荷是否保留 —— 来源 article §3.3.3 / L652-L693
- 内容载荷判断：`debug_capture_payload` 覆盖 `trace_content_enabled` —— 来源 article §3.3.3 / L674-L693
- 配置与语义补全：`collect_trace_config(...)`、`resolve_semantic_type_for_target(...)` —— 来源 article §3.3.4 / L703-L723
- 输出属性：检索分数、重排分数、分支命中、循环次数 —— 来源 article §3.3.4 / L699-L726

**开发计划**：

- step 1 (~41s) — 生命周期页：`pre_hook` / `post_hook` / `on_error` / `finalize` 与 span 状态变化
- step 2 (~33s) — Retriever / Reranker 后处理页：probe、nodes、score、source id、召回质量补采
- step 3 (~32s) — 采集门禁页：请求建节点、模块记录、payload 留存的固定顺序和优先级
- step 4 (~48s) — 语义与属性补全页：`collect_trace_config`、`resolve_semantic_type`、score、branch、loop_count

口播节选：
> payload 不应该决定链路是否存在。节点只存 input/output 不够。

---

## 8. otel-runtime — OpenTelemetry 上下文和并发传播（5 步 · ~197s）

**信息池**：
- 状态拆分：`globals['trace']`、`_current_trace`、OpenTelemetry 活跃上下文 —— 来源 article §3.4.1 / L729-L756
- `start_span(...)`：活跃节点优先；否则根据 `trace_id` / `parent_span_id` 重建父链路 —— 来源 article §3.4.2 / L762-L782
- `finish_span(...)`：写属性、后端映射、记录异常、关闭上下文管理器 —— 来源 article §3.4.2 / L784-L797
- `enable_trace(...)` 内部：保存旧上下文、覆盖入口字段、恢复旧上下文 —— 来源 article §3.4.3 / L801-L826
- 线程路径：`copy_context().run(...)` —— 来源 article §3.4.4 / L830-L856
- 进程路径：传 `globals._data` 快照，工作进程恢复 `sid` 和 `global_data` —— 来源 article §3.4.4 / L830-L856
- `LazyTrace` 聚合：首个活动节点创建请求级对象，后续节点登记 —— 来源 article §3.4.5 / L861-L884

**开发计划**：

- step 1 (~44s) — 三层状态拆分页：`globals['trace']`、`_current_trace`、OTel active context 的职责边界
- step 2 (~38s) — `start_span` 父链路决策页：active span 优先，缺失时用 `trace_id` / `parent_span_id` 重建
- step 3 (~35s) — `finish_span` 收尾页：OTel 属性、`map_attributes`、`record_exception`、context manager 关闭
- step 4 (~53s) — `enable_trace` + 并发传播页：状态栈、`copy_context().run(...)`、进程快照与父链路重建
- step 5 (~27s) — `LazyTrace` 聚合页：首个 span 创建、后续登记、Trace 管聚合，OTel 管父子上下文

口播节选：
> Trace 管聚合，OTel 管上下文和父子关系。

---

## 9. backend-close — 后端抽象和收束（3 步 · ~82s）

**信息池**：
- 后端职责：将标准化节点写入具体观测后端，隔离写入目标差异 —— 来源 article §3.5 / L886-L889
- `TracingBackend` 抽象：`build_exporter` 和 `map_attributes` —— 来源 article §3.5.1 / L892-L909
- Langfuse：OTLP 导出器；本地后端：JSONL 文件 —— 来源 article §3.5.1-L3.5.2 / L911-L934
- 消费后端：读取已有观测数据并还原统一载荷 —— 来源 article §3.5.2 / L915-L934

**开发计划**：

- step 1 (~23s) — 后端隔离页：同一组标准 span 分别写到 Langfuse 或本地 JSONL，不影响上游生命周期
- step 2 (~31s) — `TracingBackend` 接口页：`build_exporter` 负责通道，`map_attributes` 负责字段适配
- step 3 (~28s) — 收束总图：Hook 接入、LazySpan 事实、OpenTelemetry 父子关系、Backend 落地

口播节选：
> Hook 负责接入执行链。LazySpan 记录节点事实。OpenTelemetry 负责父子关系和上下文传播。

---

## 素材清单

### 1. trace-scope
- ⚠️ 追踪树与节点字段示意图（代码绘制）
- ⚠️ 语义标签和资源用量卡片（代码绘制）

### 2. diagnosis-value
- ⚠️ RAG 三段归因图（代码绘制，保留 `Retriever -> Reranker -> LLM` 代码锚点）
- ⚠️ Agent 工具调用 / 状态回填 / 循环示意图（代码绘制）
- ⚠️ Waterfall + 标签聚合图（代码绘制）

### 3. langfuse-rag
- ✓ Langfuse 注册/登录界面（`docs/assets/langfuse_signup.png`）
- ✓ Langfuse API Key 创建界面（`docs/assets/langfuse_key.png`）
- ✓ Langfuse 观测界面（`docs/assets/langfuse.png`）
- ⚠️ RAG 代码骨架和环境变量终端片段（代码绘制）

### 4. control-api-config
- ⚠️ `set_trace_context` / `enable_trace` API 卡片（代码绘制）
- ⚠️ 采集控制优先级图（代码绘制）

### 5. architecture-objects
- ⚠️ 五层架构图（代码绘制）
- ⚠️ `LazyTraceContext` / `LazySpan` / `LazyTrace` 三对象关系图（代码绘制）

### 6. auto-attach
- ⚠️ hook 注册与调用边界图（代码绘制）

### 7. hook-capture-semantics
- ⚠️ hook 生命周期环（代码绘制）
- ⚠️ probe 补采和语义补全矩阵（代码绘制）

### 8. otel-runtime
- ⚠️ OTel 三层状态拆分图（代码绘制）
- ⚠️ 线程 / 进程传播对比图（代码绘制）

### 9. backend-close
- ⚠️ 后端接口与导出器分流图（代码绘制）
