import type { CSSProperties, ReactNode } from "react";
import type { ChapterStepProps } from "../../registry/types";
import "./OtelRuntime.css";

const indexed = (index: number): CSSProperties => ({ "--i": index } as CSSProperties);
const weighted = (index: number, width: string): CSSProperties =>
  ({ "--i": index, "--w": width } as CSSProperties);

type Anchor = [string, string, string];

function SceneTitle({
  kicker,
  title,
  note,
  meta,
}: {
  kicker: string;
  title: string;
  note: string;
  meta?: ReactNode;
}) {
  return (
    <div className="or-title">
      <div>
        <div className="or-kicker">{kicker}</div>
        <h2>{title}</h2>
      </div>
      <aside>
        <p>{note}</p>
        {meta ? <div className="or-title-meta">{meta}</div> : null}
      </aside>
    </div>
  );
}

function AnchorGrid({ anchors }: { anchors: Anchor[] }) {
  return (
    <div className="or-anchor-grid">
      {anchors.map(([label, code, detail], index) => (
        <section className="or-anchor card" style={indexed(index)} key={`${label}-${code}`}>
          <span>{label}</span>
          <code>{code}</code>
          <p>{detail}</p>
        </section>
      ))}
    </div>
  );
}

function CodeStack({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="or-code-stack">
      {rows.map(([label, code], index) => (
        <div className="or-code-row" style={indexed(index)} key={`${label}-${code}`}>
          <span>{label}</span>
          <code>{code}</code>
        </div>
      ))}
    </div>
  );
}

function StateSplitSvg() {
  const columns = [
    {
      title: "globals['trace']",
      tag: "轻量字段包",
      x: 78,
      chips: ["trace_id", "parent_span_id", "request_tags", "enabled / sampled"],
      footer: "可序列化 · 可恢复 · 可跨进程",
    },
    {
      title: "_current_trace",
      tag: "ContextVar",
      x: 480,
      chips: ["LazyTrace", "root_span_id", "status / metadata", "is_active"],
      footer: "请求级聚合状态",
    },
    {
      title: "OpenTelemetry active context",
      tag: "运行栈",
      x: 882,
      chips: ["current span", "span context", "嵌套调用栈", "context manager"],
      footer: "跟随当前执行栈",
    },
  ];

  return (
    <svg className="or-state-svg" viewBox="0 0 1220 560" role="img" aria-label="OTel runtime 三层状态拆分">
      <path className="or-state-bus or-bus-serial" d="M202 458 C202 512 344 512 420 472" />
      <path className="or-state-bus or-bus-context" d="M606 458 C606 512 748 512 824 472" />
      <path className="or-state-bus or-bus-stack" d="M1008 458 C1008 506 1114 506 1148 454" />
      {columns.map((column, columnIndex) => (
        <g className="or-state-column" style={indexed(columnIndex)} key={column.title}>
          <rect x={column.x} y="66" width="260" height="398" />
          <text className="or-svg-title" x={column.x + 130} y="116" textAnchor="middle">
            {column.title}
          </text>
          <text className="or-svg-code" x={column.x + 130} y="154" textAnchor="middle">
            {column.tag}
          </text>
          <line className="or-svg-rule" x1={column.x + 42} y1="182" x2={column.x + 218} y2="182" />
          {column.chips.map((chip, index) => (
            <g className="or-chip-node" style={indexed(index)} key={chip}>
              <rect x={column.x + 38} y={214 + index * 54} width="184" height="36" />
              <text className="or-svg-chip" x={column.x + 130} y={238 + index * 54} textAnchor="middle">
                {chip}
              </text>
            </g>
          ))}
          <text className="or-svg-copy" x={column.x + 130} y="424" textAnchor="middle">
            {column.footer}
          </text>
        </g>
      ))}
      <g className="or-state-labels">
        <text className="or-flow-label" x="312" y="532" textAnchor="middle">
          跨边界传播
        </text>
        <text className="or-flow-label" x="720" y="532" textAnchor="middle">
          线程复制 ContextVar
        </text>
        <text className="or-flow-label" x="1078" y="532" textAnchor="middle">
          不写进 globals
        </text>
      </g>
    </svg>
  );
}

function StateSplitStep() {
  return (
    <div className="or-scene or-scene-state">
      <SceneTitle
        kicker="OTEL 标准层 · 状态拆分"
        title="Tracing 运行时先把三类状态分开"
        note="可传播字段、请求级账本、当前 active span 分别落在不同容器里，后面父链路和并发传播才不会混在一起。"
        meta={<code>{"get_trace_context() -> LazyTraceContext.from_dict(...)"}</code>}
      />
      <div className="or-state-layout">
        <div className="or-state-visual card">
          <StateSplitSvg />
        </div>
        <AnchorGrid
          anchors={[
            ["跨边界", "globals['trace']", "只放 trace_id、parent_span_id、tags、采集控制等可序列化字段"],
            ["请求聚合", "_current_trace", "ContextVar 绑定 LazyTrace，保存 root_span_id、status、metadata"],
            ["运行嵌套", "OpenTelemetry active context", "当前 span 交给 OTel context，不塞进 globals"],
            ["设计结果", "三层拆分", "同时满足跨边界传播、请求级聚合、运行时嵌套"],
          ]}
        />
      </div>
    </div>
  );
}

function StartSpanDecisionSvg() {
  const nodes = [
    ["start_span(...)", "读 LazyTraceContext", 68, 62, "or-node-start"],
    ["active span?", "get_current_span().is_valid", 388, 62, "or-node-decision"],
    ["复用当前父节点", "set_span_in_context(active)", 732, 40, "or-node-pass"],
    ["ctx 父字段?", "trace_id + parent_span_id", 388, 246, "or-node-decision"],
    ["重建父 SpanContext", "trace + parent -> context", 732, 246, "or-node-rebuild"],
    ["作为 root span", "no parent_context", 68, 246, "or-node-root"],
    ["start_as_current_span", "context=parent_context", 388, 420, "or-node-create"],
    ["回写轻量上下文", "trace_id / parent_span_id", 732, 420, "or-node-write"],
  ];

  return (
    <svg className="or-start-svg" viewBox="0 0 1040 560" role="img" aria-label="start_span 父链路决策">
      <path className="or-start-path or-path-a" d="M288 112 H388" />
      <path className="or-start-path or-path-b" d="M628 112 H732" />
      <path className="or-start-path or-path-c" d="M508 164 V246" />
      <path className="or-start-path or-path-d" d="M628 296 H732" />
      <path className="or-start-path or-path-e" d="M388 296 H288" />
      <path className="or-start-path or-path-f" d="M188 348 C188 430 288 470 388 470" />
      <path className="or-start-path or-path-g" d="M852 164 C852 342 726 470 628 470" />
      <path className="or-start-path or-path-h" d="M852 348 C852 412 754 470 628 470" />
      <path className="or-start-path or-path-i" d="M628 470 H732" />
      {nodes.map(([title, code, x, y, cls], index) => (
        <g className={`or-start-node ${cls}`} style={indexed(index)} key={title}>
          <rect x={Number(x)} y={Number(y)} width="220" height="104" />
          <text className="or-svg-title" x={Number(x) + 110} y={Number(y) + 42} textAnchor="middle">
            {title}
          </text>
          <text className="or-svg-code" x={Number(x) + 110} y={Number(y) + 74} textAnchor="middle">
            {code}
          </text>
        </g>
      ))}
      <g className="or-branch-labels">
        <text className="or-flow-label" x="680" y="96">优先</text>
        <text className="or-flow-label" x="530" y="218">否则</text>
        <text className="or-flow-label" x="680" y="280">续接</text>
        <text className="or-flow-label" x="300" y="280">缺失</text>
      </g>
    </svg>
  );
}

function StartSpanStep() {
  return (
    <div className="or-scene or-scene-start">
      <SceneTitle
        kicker="节点生命周期 · 创建"
        title="start_span 先找运行栈，再看轻量父链路"
        note="这一步不是单纯 new 一个 span，而是在三种父链路里做顺序决策，并把新标识写回可传播上下文。"
        meta={<code>{"active span -> trace_id / parent_span_id -> root"}</code>}
      />
      <div className="or-start-layout">
        <div className="or-start-visual card">
          <StartSpanDecisionSvg />
        </div>
        <div className="or-start-side">
          <CodeStack
            rows={[
              ["门禁", "_trace_enabled(ctx) && _ensure_runtime()"],
              ["优先级一", "get_current_span().get_span_context().is_valid"],
              ["优先级二", "ctx.trace_id && ctx.parent_span_id"],
              ["创建", "tracer.start_as_current_span(span_name, context=...)"],
              ["回写", "set_trace_context(ctx)"],
            ]}
          />
          <AnchorGrid
            anchors={[
              ["活跃父节点", "OpenTelemetry active context", "避免打断已有调用栈里的父子关系"],
              ["轻量重建", "trace_id / parent_span_id", "无 active span 时仍接回原 Trace"],
              ["根节点", "parent_context = None", "没有父链路字段才开启新根"],
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function FinishSpanSvg() {
  const stages = [
    ["LazySpan", "name / status / error", 70],
    ["构建属性", "_build_otel_attributes", 300],
    ["后端映射", "map_attributes", 530],
    ["写入 OTel", "set_attribute", 760],
    ["异常同步", "record_exception", 990],
    ["关闭句柄", "__exit__", 1220],
  ];

  return (
    <svg className="or-finish-svg" viewBox="0 0 1500 420" role="img" aria-label="finish_span 收尾流程">
      <path className="or-finish-rail" d="M86 210 H1412" />
      {stages.map(([title, code, x], index) => (
        <g className="or-finish-stage" style={indexed(index)} key={title}>
          <rect x={Number(x)} y="112" width="190" height="132" />
          <text className="or-svg-title" x={Number(x) + 95} y="164" textAnchor="middle">
            {title}
          </text>
          <text className="or-svg-code" x={Number(x) + 95} y="202" textAnchor="middle">
            {code}
          </text>
          <circle cx={Number(x) + 95} cy="276" r="18" />
        </g>
      ))}
      <path className="or-finish-exception" d="M850 112 C952 40 1092 40 1184 112" />
      <text className="or-flow-label" x="1016" y="58" textAnchor="middle">
        if span.error
      </text>
      <g className="or-leak-stop">
        <rect x="1220" y="292" width="190" height="54" />
        <text className="or-svg-code" x="1315" y="326" textAnchor="middle">
          避免 active span 泄漏
        </text>
      </g>
    </svg>
  );
}

function FinishSpanStep() {
  return (
    <div className="or-scene or-scene-finish">
      <SceneTitle
        kicker="节点生命周期 · 收尾"
        title="finish_span 把 LazySpan 收成标准 OTel span"
        note="它先把节点事实整理成通用属性，再交给 backend 映射；异常和 context manager 都在同一个出口处理。"
        meta={<code>{"map_attributes -> record_exception -> __exit__"}</code>}
      />
      <div className="or-finish-layout">
        <div className="or-finish-visual card">
          <FinishSpanSvg />
        </div>
        <div className="or-finish-bottom">
          <CodeStack
            rows={[
              ["属性源", "span.name / input / output / status / usage"],
              ["聚合态", "trace=_current_trace.get()"],
              ["后端适配", "backend.map_attributes(attrs)"],
              ["异常路径", "otel_span.record_exception(span.error)"],
              ["收尾保障", "span._otel_span_cm.__exit__(...)"],
            ]}
          />
          <AnchorGrid
            anchors={[
              ["标准化", "set_attribute", "所有后端先接收 OTel 属性"],
              ["后端语义", "map_attributes", "Langfuse / JSONL 可以有不同字段名"],
              ["错误保真", "record_exception", "异常不只写 status，也同步到底层 span"],
              ["栈清理", "context manager", "关闭当前 span，避免污染后续调用"],
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function EnableTraceStack() {
  const rows = [
    ["保存旧值", "old_ctx = get_trace_context()", "进入前的调用环境"],
    ["复制并覆盖", "new_ctx_data.update(...)", "trace_id / parent_span_id / tags / module"],
    ["设置入口", "set_trace_context(LazyTraceContext(...))", "后续默认 hook 读取本次配置"],
    ["执行函数", "LazyLLM 组件走默认 hook", "普通 callable 可补入口 span"],
    ["恢复旧值", "finally: set_trace_context(old_ctx)", "避免入口字段泄漏到下一次调用"],
  ];

  return (
    <div className="or-enable-stack">
      {rows.map(([label, code, detail], index) => (
        <section className="or-stack-frame card" style={indexed(index)} key={label}>
          <span>{label}</span>
          <code>{code}</code>
          <p>{detail}</p>
        </section>
      ))}
    </div>
  );
}

function ConcurrencySvg() {
  return (
    <svg className="or-concurrency-svg" viewBox="0 0 1180 560" role="img" aria-label="线程和进程 tracing 上下文传播">
      <rect className="or-worker-box" x="52" y="72" width="236" height="150" />
      <text className="or-svg-title" x="170" y="126" textAnchor="middle">入口请求</text>
      <text className="or-svg-code" x="170" y="166" textAnchor="middle">enable_trace(...)</text>
      <text className="or-svg-copy" x="170" y="198" textAnchor="middle">globals + ContextVar + active span</text>

      <path className="or-thread-line" d="M288 136 H514 C610 136 610 94 706 94 H1030" />
      <path className="or-process-line" d="M288 184 H514 C610 184 610 340 706 340 H1030" />

      <g className="or-lane-node or-thread-node" style={indexed(0)}>
        <rect x="514" y="50" width="226" height="88" />
        <text className="or-svg-code" x="627" y="88" textAnchor="middle">copy_context().run(...)</text>
        <text className="or-svg-copy" x="627" y="118" textAnchor="middle">复制 ContextVar 链路</text>
      </g>
      <g className="or-lane-node or-thread-node" style={indexed(1)}>
        <rect x="820" y="50" width="226" height="88" />
        <text className="or-svg-title" x="933" y="88" textAnchor="middle">线程 worker</text>
        <text className="or-svg-copy" x="933" y="118" textAnchor="middle">active context 一起进入</text>
      </g>

      <g className="or-lane-node or-process-node" style={indexed(0)}>
        <rect x="514" y="296" width="226" height="92" />
        <text className="or-svg-code" x="627" y="334" textAnchor="middle">globals._data</text>
        <text className="or-svg-copy" x="627" y="364" textAnchor="middle">进程快照 global_data</text>
      </g>
      <g className="or-lane-node or-process-node" style={indexed(1)}>
        <rect x="820" y="296" width="226" height="92" />
        <text className="or-svg-title" x="933" y="334" textAnchor="middle">进程 worker</text>
        <text className="or-svg-copy" x="933" y="364" textAnchor="middle">恢复 sid + global_data</text>
      </g>

      <g className="or-process-rebuild">
        <rect x="730" y="430" width="320" height="72" />
        <text className="or-svg-code" x="890" y="458" textAnchor="middle">start_span(trace_id / parent_span_id)</text>
        <text className="or-svg-copy" x="890" y="488" textAnchor="middle">不能带 active span，就重建父链路</text>
      </g>

      <text className="or-flow-label" x="438" y="112" textAnchor="middle">线程路径</text>
      <text className="or-flow-label" x="438" y="316" textAnchor="middle">进程路径</text>
    </svg>
  );
}

function EnableConcurrencyStep() {
  return (
    <div className="or-scene or-scene-enable">
      <SceneTitle
        kicker="显式入口与并发传播"
        title="enable_trace 像状态栈，并发时分两条传播路径"
        note="入口只准备上下文，不替代默认 hook；线程复制 ContextVar，进程只能带可序列化快照再续接父链路。"
        meta={<code>copy_context().run(...) · globals._data · trace_id / parent_span_id</code>}
      />
      <div className="or-enable-layout">
        <EnableTraceStack />
        <div className="or-concurrency-card card">
          <ConcurrencySvg />
        </div>
        <AnchorGrid
          anchors={[
            ["入口栈", "enable_trace(...)", "保存 old_ctx，覆盖本次字段，finally 恢复"],
            ["组件分流", "hasattr(_module_id / _flow_id)", "LazyLLM 组件继续走默认 hook，普通 callable 可补入口 span"],
            ["线程传播", "copy_context().run(...)", "OpenTelemetry active context 与 _current_trace 一起进入 worker"],
            ["进程传播", "进程快照", "传 globals._data / global_data，worker 恢复 sid 和会话数据"],
            ["父链路续接", "trace_id / parent_span_id", "进程侧不能复用 active span，只能重建父 SpanContext"],
          ]}
        />
      </div>
    </div>
  );
}

function LazyTraceSvg() {
  const spans = [
    ["root", "Pipeline", 82, 92],
    ["child", "Retriever", 336, 220],
    ["child", "Reranker", 590, 220],
    ["child", "LLM", 844, 220],
  ];
  const ledger = [
    ["trace_id", "同一请求"],
    ["root_span_id", "入口锚点"],
    ["status", "整体状态"],
    ["metadata", "请求附加信息"],
    ["is_reconstructed", "是否续接"],
  ];

  return (
    <svg className="or-lazytrace-svg" viewBox="0 0 1240 590" role="img" aria-label="LazyTrace 请求级聚合">
      <path className="or-tree-line or-tree-a" d="M202 138 C294 138 294 266 336 266" />
      <path className="or-tree-line or-tree-b" d="M202 138 C456 138 456 266 590 266" />
      <path className="or-tree-line or-tree-c" d="M202 138 C618 138 618 266 844 266" />
      {spans.map(([role, name, x, y], index) => (
        <g className="or-span-node" style={indexed(index)} key={name}>
          <rect x={Number(x)} y={Number(y)} width="210" height="92" />
          <text className="or-svg-code" x={Number(x) + 105} y={Number(y) + 38} textAnchor="middle">
            {role}
          </text>
          <text className="or-svg-title" x={Number(x) + 105} y={Number(y) + 70} textAnchor="middle">
            {name}
          </text>
        </g>
      ))}

      <rect className="or-trace-ledger" x="336" y="382" width="606" height="154" />
      <text className="or-svg-title" x="639" y="424" textAnchor="middle">LazyTrace 聚合账本</text>
      <text className="or-svg-code" x="639" y="462" textAnchor="middle">_current_trace.set(new_trace)</text>
      <text className="or-svg-copy" x="639" y="498" textAnchor="middle">active_trace._record_span_start(lazy_span)</text>

      {ledger.map(([field, detail], index) => (
        <g className="or-ledger-chip" style={indexed(index)} key={field}>
          <rect x={1020} y={92 + index * 72} width="164" height="48" />
          <text className="or-svg-code" x="1102" y={112 + index * 72} textAnchor="middle">
            {field}
          </text>
          <text className="or-svg-copy" x="1102" y={132 + index * 72} textAnchor="middle">
            {detail}
          </text>
        </g>
      ))}

      <path className="or-aggregate-line" d="M442 312 C442 360 484 382 532 382" />
      <path className="or-aggregate-line or-aggregate-b" d="M696 312 C696 360 690 382 674 382" />
      <path className="or-aggregate-line or-aggregate-c" d="M950 312 C950 360 842 382 746 382" />
      <text className="or-flow-label" x="544" y="566" textAnchor="middle">
        OTel 管父子上下文；LazyTrace 管整条请求的聚合状态
      </text>
    </svg>
  );
}

function LazyTraceStep() {
  return (
    <div className="or-scene or-scene-lazytrace">
      <SceneTitle
        kicker="请求级聚合状态"
        title="LazyTrace 是账本，不是 OTel 父子链路的替代品"
        note="首个活动 span 创建请求级对象，后续节点登记进去；节点结束后 runtime 再用它统一更新请求状态。"
        meta={<code>{"first active span -> LazyTrace -> _record_span_start"}</code>}
      />
      <div className="or-lazytrace-layout">
        <div className="or-lazytrace-visual card">
          <LazyTraceSvg />
        </div>
        <div className="or-lazytrace-bottom">
          <AnchorGrid
            anchors={[
              ["创建条件", "active_trace is None", "没有活动账本、trace_id 不同、或账本已 inactive 时创建"],
              ["入口锚点", "root_span_id", "首个 root span 绑定整条请求的入口"],
              ["续接标记", "is_reconstructed", "由轻量父链路重建出来的请求会被标记"],
              ["登记动作", "_record_span_start(lazy_span)", "后续节点进入同一个请求级聚合对象"],
            ]}
          />
          <div className="or-responsibility-strip">
            {[
              ["OpenTelemetry", "父子关系、active context、跨线程传播", "86%"],
              ["LazyTrace", "请求级账本、状态收口、metadata", "72%"],
              ["LazySpan", "单节点事实、属性来源、异常详情", "64%"],
            ].map(([name, detail, width], index) => (
              <section className="or-responsibility card" style={weighted(index, width)} key={name}>
                <strong>{name}</strong>
                <p>{detail}</p>
                <i />
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OtelRuntimeChapter({ step }: ChapterStepProps) {
  if (step === 0) {
    return <StateSplitStep />;
  }

  if (step === 1) {
    return <StartSpanStep />;
  }

  if (step === 2) {
    return <FinishSpanStep />;
  }

  if (step === 3) {
    return <EnableConcurrencyStep />;
  }

  if (step === 4) {
    return <LazyTraceStep />;
  }

  return <StateSplitStep />;
}
