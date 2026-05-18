import type { CSSProperties, ReactNode } from "react";
import type { ChapterStepProps } from "../../registry/types";
import "./ArchitectureObjects.css";

const indexed = (index: number): CSSProperties => ({ "--i": index } as CSSProperties);

type Layer = {
  name: string;
  code: string;
  role: string;
  files: string[];
};

type FieldGroup = {
  title: string;
  fields: Array<[string, string]>;
};

function CodeStack({ lines }: { lines: Array<[string, string]> }) {
  return (
    <div className="ao-code-stack">
      {lines.map(([label, value], index) => (
        <div className="ao-code-line" style={indexed(index)} key={`${label}-${value}`}>
          <span>{label}</span>
          <code>{value}</code>
        </div>
      ))}
    </div>
  );
}

function FieldGrid({ groups }: { groups: FieldGroup[] }) {
  return (
    <div className="ao-field-grid">
      {groups.map((group, groupIndex) => (
        <section className="ao-field-group card" style={indexed(groupIndex)} key={group.title}>
          <h3>{group.title}</h3>
          {group.fields.map(([name, detail], index) => (
            <div className="ao-field-row" style={indexed(index)} key={name}>
              <code>{name}</code>
              <span>{detail}</span>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function MiniLedger({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string, string]>;
}) {
  return (
    <section className="ao-mini-ledger card">
      <h3>{title}</h3>
      {rows.map(([field, value, use], index) => (
        <div className="ao-ledger-row" style={indexed(index)} key={field}>
          <code>{field}</code>
          <strong>{value}</strong>
          <span>{use}</span>
        </div>
      ))}
    </section>
  );
}

function SceneTitle({ kicker, title, aside }: { kicker: string; title: string; aside?: ReactNode }) {
  return (
    <div className="ao-scene-title">
      <div>
        <div className="ao-kicker">{kicker}</div>
        <h2>{title}</h2>
      </div>
      {aside ? <aside>{aside}</aside> : null}
    </div>
  );
}

function LayerFlowSvg() {
  const layers: Layer[] = [
    {
      name: "运行层",
      code: "Flow / Module / callable",
      role: "真实执行链",
      files: ["lazyllm/flow/flow.py", "lazyllm/module/module.py"],
    },
    {
      name: "埋点适配层",
      code: "hook + trace_config",
      role: "接入、策略、语义补全",
      files: ["lazyllm/hook.py", "collect/output_attrs.py"],
    },
    {
      name: "OpenTelemetry 层",
      code: "runtime + context + span",
      role: "生命周期、父子、传播",
      files: ["collect/runtime.py", "collect/context.py"],
    },
    {
      name: "后端层",
      code: "exporter + map_attributes",
      role: "写入 Langfuse / JSONL",
      files: ["backends/langfuse/*", "local JSONL"],
    },
    {
      name: "消费适配层",
      code: "ConsumeBackend",
      role: "Trace 读回分析系统",
      files: ["RawTracePayload", "eval / self-evolution"],
    },
  ];

  return (
    <svg className="ao-layer-svg" viewBox="0 0 1480 550" role="img" aria-label="LazyLLM Tracing 分层数据流">
      <path className="ao-flow-line ao-flow-line-main" d="M116 258 H1350" />
      <path className="ao-flow-line ao-flow-line-return" d="M1180 116 C980 28 620 28 398 116" />
      <path className="ao-flow-line ao-flow-line-drop" d="M1230 292 C1230 386 1066 428 894 428" />
      {layers.map((layer, index) => {
        const x = 92 + index * 278;
        const y = index === 4 ? 178 : 144;
        return (
          <g className="ao-layer-node" style={indexed(index)} key={layer.name}>
            <rect x={x} y={y} width="230" height="230" />
            <text className="ao-svg-title" x={x + 115} y={y + 54} textAnchor="middle">
              {layer.name}
            </text>
            <text className="ao-svg-code" x={x + 115} y={y + 91} textAnchor="middle">
              {layer.code}
            </text>
            <text className="ao-svg-role" x={x + 115} y={y + 128} textAnchor="middle">
              {layer.role}
            </text>
            <line className="ao-svg-rule" x1={x + 36} y1={y + 150} x2={x + 194} y2={y + 150} />
            <text className="ao-svg-file" x={x + 115} y={y + 181} textAnchor="middle">
              {layer.files[0]}
            </text>
            <text className="ao-svg-file" x={x + 115} y={y + 211} textAnchor="middle">
              {layer.files[1]}
            </text>
          </g>
        );
      })}
      {[0, 1, 2, 3].map((index) => (
        <g className="ao-arrow-head" style={indexed(index)} key={index}>
          <path d={`M${338 + index * 278} 258 l24 -14 v28 Z`} />
        </g>
      ))}
      <text className="ao-flow-label ao-label-main" x="728" y="246" textAnchor="middle">
        {"runtime event -> LazySpan -> OTel span -> exporter"}
      </text>
      <text className="ao-flow-label ao-label-return" x="790" y="72" textAnchor="middle">
        Trace 数据读回：评估系统 / 自进化系统
      </text>
      <text className="ao-flow-label ao-label-drop" x="1138" y="444" textAnchor="middle">
        标准 span 落库后仍保留统一语义
      </text>
    </svg>
  );
}

function ArchitectureFlowStep() {
  const pipelineRows: Array<[string, string]> = [
    ["采集入口", "Flow / Module / callable"],
    ["事件转换", "hook -> semantic_type + output_attrs"],
    ["标准层", "start_span(...) / finish_span(...)"],
    ["写入路径", "OTLP -> Langfuse · JSONL -> local"],
    ["读回路径", "ConsumeBackend -> RawTracePayload"],
  ];

  return (
    <div className="ao-scene">
      <SceneTitle
        kicker="分层数据流"
        title="内部架构按数据流看最清楚"
        aside={<code>{"collect -> otel -> backend -> consume"}</code>}
      />
      <div className="ao-flow-layout">
        <LayerFlowSvg />
        <div className="ao-flow-bottom">
          <CodeStack lines={pipelineRows} />
          <div className="ao-flow-note card">
            <strong>两条路径同时存在</strong>
            <p>下半段负责把运行时事件采成标准 span；上半段负责把已有 Trace 读回评估和自进化系统。</p>
            <div className="ao-note-grid">
              <span>采集路径：真实调用链</span>
              <span>消费路径：后续分析链</span>
              <span>边界：后端只承接标准 span</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContextTransportSvg() {
  return (
    <svg className="ao-context-svg" viewBox="0 0 720 500" role="img" aria-label="LazyTraceContext 跨线程和进程传播">
      <rect className="ao-svg-panel ao-context-bag" x="52" y="72" width="250" height="342" />
      <text className="ao-svg-title" x="177" y="126" textAnchor="middle">LazyTraceContext</text>
      <text className="ao-svg-code" x="177" y="170" textAnchor="middle">globals['trace']</text>
      <text className="ao-svg-role" x="177" y="210" textAnchor="middle">可序列化字段包</text>
      <line className="ao-svg-rule" x1="90" y1="242" x2="264" y2="242" />
      <text className="ao-svg-file" x="177" y="280" textAnchor="middle">trace_id / parent_span_id</text>
      <text className="ao-svg-file" x="177" y="318" textAnchor="middle">session / user / tags</text>
      <text className="ao-svg-file" x="177" y="356" textAnchor="middle">sampled / payload / module</text>
      <path className="ao-flow-line ao-context-line-a" d="M302 180 H468" />
      <path className="ao-flow-line ao-context-line-b" d="M302 310 H468" />
      <rect className="ao-svg-panel ao-thread-box" x="468" y="110" width="188" height="126" />
      <text className="ao-svg-title" x="562" y="160" textAnchor="middle">线程路径</text>
      <text className="ao-svg-code" x="562" y="196" textAnchor="middle">copy_context()</text>
      <rect className="ao-svg-panel ao-process-box" x="468" y="270" width="188" height="126" />
      <text className="ao-svg-title" x="562" y="320" textAnchor="middle">进程路径</text>
      <text className="ao-svg-code" x="562" y="356" textAnchor="middle">global_data</text>
      <g className="ao-active-span">
        <rect x="346" y="28" width="190" height="52" />
        <text x="441" y="62" textAnchor="middle">active span 对象</text>
        <path d="M354 36 L528 72" />
        <path d="M528 36 L354 72" />
      </g>
      <text className="ao-flow-label" x="442" y="460" textAnchor="middle">
        传播靠轻量字段；运行栈里的 active span 只留给 OTel context
      </text>
    </svg>
  );
}

function ContextStep() {
  const groups: FieldGroup[] = [
    {
      title: "传播字段",
      fields: [
        ["trace_id", "跨组件串起同一条请求"],
        ["parent_span_id", "无 active span 时重建父链路"],
        ["session_id", "把多条 Trace 归到会话"],
        ["user_id", "用户级筛选与统计"],
        ["request_tags", "环境、业务线、实验标签"],
      ],
    },
    {
      title: "采集控制",
      fields: [
        ["enabled", "入口级开关"],
        ["sampled", "抽样策略结果"],
        ["debug_capture_payload", "是否保留 input / output"],
        ["module_trace", "按模块名或类型精细控制"],
      ],
    },
  ];

  return (
    <div className="ao-scene ao-scene-trace">
      <SceneTitle
        kicker="核心对象一"
        title="LazyTraceContext：轻量、可传播、不能绑死运行栈"
        aside={<code>context.py · globals['trace']</code>}
      />
      <div className="ao-context-layout">
        <div className="ao-context-left">
          <FieldGrid groups={groups} />
          <CodeStack
            lines={[
              ["读取", "LazyTraceContext.from_dict(llm_globals.get('trace', {}))"],
              ["回写", "ctx.trace_id = ... · ctx.parent_span_id = ..."],
              ["边界", "active span 由 OTel context 维护"],
            ]}
          />
        </div>
        <div className="ao-context-right card">
          <ContextTransportSvg />
        </div>
      </div>
    </div>
  );
}

function SpanMappingSvg() {
  const fields = [
    ["name", 86, 82],
    ["span_kind", 250, 82],
    ["semantic_type", 444, 82],
    ["input", 86, 178],
    ["output", 250, 178],
    ["status / error", 444, 178],
    ["config", 86, 274],
    ["usage", 250, 274],
    ["output_attrs", 444, 274],
  ];

  return (
    <svg className="ao-span-svg" viewBox="0 0 760 560" role="img" aria-label="LazySpan 快照映射到后端属性">
      <rect className="ao-svg-panel ao-span-object" x="48" y="42" width="520" height="326" />
      <text className="ao-svg-title" x="308" y="34" textAnchor="middle">LazySpan observation snapshot</text>
      {fields.map(([name, x, y], index) => (
        <g className="ao-span-field" style={indexed(index)} key={name}>
          <rect x={Number(x)} y={Number(y)} width="118" height="54" />
          <text x={Number(x) + 59} y={Number(y) + 35} textAnchor="middle">{name}</text>
        </g>
      ))}
      <path className="ao-flow-line ao-span-line-a" d="M568 206 H674" />
      <rect className="ao-svg-panel ao-map-box" x="604" y="138" width="132" height="136" />
      <text className="ao-svg-title" x="670" y="188" textAnchor="middle">map</text>
      <text className="ao-svg-code" x="670" y="222" textAnchor="middle">attributes</text>
      <path className="ao-flow-line ao-span-line-b" d="M670 274 V430" />
      <rect className="ao-svg-panel ao-backend-box" x="470" y="430" width="260" height="78" />
      <text className="ao-svg-title" x="600" y="466" textAnchor="middle">Langfuse / JSONL</text>
      <text className="ao-svg-code" x="600" y="496" textAnchor="middle">backend-specific attrs</text>
      <text className="ao-flow-label" x="262" y="464" textAnchor="middle">
        页面节点详情不是从后端反推，而是由 LazySpan 事实字段统一映射
      </text>
    </svg>
  );
}

function SpanStep() {
  const snapshotRows: Array<[string, string, string]> = [
    ["identity", "name / span_kind", "节点身份"],
    ["semantic", "semantic_type", "业务角色"],
    ["payload", "input / output", "可按策略保留"],
    ["state", "status / error", "成功、失败、异常"],
    ["extra", "config / usage", "成本、模型、参数"],
    ["attrs", "output_attrs", "结构化补充"],
  ];

  return (
    <div className="ao-scene">
      <SceneTitle
        kicker="核心对象二"
        title="LazySpan：单节点 observation 的事实快照"
        aside={<code>{"finish_span(...) -> set_attribute"}</code>}
      />
      <div className="ao-span-layout">
        <MiniLedger title="节点详情字段来源" rows={snapshotRows} />
        <div className="ao-span-visual card">
          <SpanMappingSvg />
        </div>
        <div className="ao-span-code card">
          <CodeStack
            lines={[
              ["构建", "_build_otel_attributes(span, trace=_current_trace.get())"],
              ["适配", "backend.map_attributes(attrs)"],
              ["写入", "otel_span.set_attribute(key, value)"],
              ["异常", "otel_span.record_exception(span.error)"],
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function TraceLifecycleSvg() {
  const nodes = [
    ["首个活动 span", "create LazyTrace", 86, 92],
    ["后续节点", "_record_span_start", 298, 250],
    ["节点结束", "status update", 512, 250],
    ["统一收口", "end_time + metadata", 724, 92],
  ];

  return (
    <svg className="ao-trace-svg" viewBox="0 0 900 460" role="img" aria-label="LazyTrace 请求级账本生命周期">
      <path className="ao-flow-line ao-trace-line-a" d="M208 126 C298 64 548 64 644 126" />
      <path className="ao-flow-line ao-trace-line-b" d="M178 158 C198 236 232 272 298 282" />
      <path className="ao-flow-line ao-trace-line-c" d="M420 282 H512" />
      <path className="ao-flow-line ao-trace-line-d" d="M634 282 C712 268 746 218 760 158" />
      {nodes.map(([title, code, x, y], index) => (
        <g className="ao-trace-node" style={indexed(index)} key={title}>
          <rect x={Number(x)} y={Number(y)} width="168" height="86" />
          <text className="ao-svg-title" x={Number(x) + 84} y={Number(y) + 36} textAnchor="middle">{title}</text>
          <text className="ao-svg-code" x={Number(x) + 84} y={Number(y) + 66} textAnchor="middle">{code}</text>
        </g>
      ))}
      <rect className="ao-svg-panel ao-trace-ledger-box" x="266" y="78" width="366" height="112" />
      <text className="ao-svg-title" x="449" y="124" textAnchor="middle">LazyTrace</text>
      <text className="ao-svg-code" x="449" y="158" textAnchor="middle">root_span_id · status · metadata</text>
      <text className="ao-flow-label" x="450" y="414" textAnchor="middle">
        父子关系归 OTel；请求级账本归 LazyTrace
      </text>
    </svg>
  );
}

function ResponsibilityBands() {
  const rows: Array<[string, string, string, string]> = [
    ["LazyTraceContext", "传播", "trace_id / parent_span_id", "跨线程、跨进程恢复父链路"],
    ["LazySpan", "事实", "input / output / status / usage", "页面节点详情和后端属性来源"],
    ["LazyTrace", "全局视图", "root_span_id / status / metadata", "请求级聚合、结束状态收口"],
  ];

  return (
    <div className="ao-responsibility">
      {rows.map(([name, role, fields, detail], index) => (
        <section className="ao-responsibility-row card" style={indexed(index)} key={name}>
          <code>{name}</code>
          <strong>{role}</strong>
          <span>{fields}</span>
          <p>{detail}</p>
        </section>
      ))}
    </div>
  );
}

function TraceCloseLedger() {
  const rows: Array<[string, string]> = [
    ["register_span(span)", "后续节点登记到同一个 LazyTrace"],
    ["status / end_time", "结束时统一收口请求状态"],
    ["is_reconstructed", "轻量上下文续接时保留来源标记"],
  ];

  return (
    <div className="ao-trace-close-grid">
      {rows.map(([code, label], index) => (
        <div className="ao-trace-close-row" style={indexed(index)} key={code}>
          <code>{code}</code>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

function TraceStep() {
  const ledgerRows: Array<[string, string, string]> = [
    ["root_span_id", "入口节点", "整条请求锚点"],
    ["start_time", "创建时刻", "请求开始"],
    ["end_time", "收口时刻", "请求结束"],
    ["status", "ok / error", "整体状态"],
    ["metadata", "dict", "请求级附加信息"],
    ["is_reconstructed", "bool", "是否由轻量上下文续接"],
  ];

  return (
    <div className="ao-scene">
      <SceneTitle
        kicker="核心对象三"
        title="LazyTrace：请求级账本，负责全局视图"
        aside={<code>_current_trace: ContextVar[LazyTrace]</code>}
      />
      <div className="ao-trace-layout">
        <div className="ao-trace-left">
          <MiniLedger title="请求级字段" rows={ledgerRows} />
          <ResponsibilityBands />
        </div>
        <div className="ao-trace-right card">
          <TraceLifecycleSvg />
          <TraceCloseLedger />
        </div>
      </div>
    </div>
  );
}

export default function ArchitectureObjectsChapter({ step }: ChapterStepProps) {
  if (step === 0) {
    return <ArchitectureFlowStep />;
  }

  if (step === 1) {
    return <ContextStep />;
  }

  if (step === 2) {
    return <SpanStep />;
  }

  if (step === 3) {
    return <TraceStep />;
  }

  return <ArchitectureFlowStep />;
}
