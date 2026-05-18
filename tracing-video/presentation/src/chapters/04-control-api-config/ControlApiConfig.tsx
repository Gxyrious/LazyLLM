import type { CSSProperties, ReactNode } from "react";
import type { ChapterStepProps } from "../../registry/types";
import "./ControlApiConfig.css";

const indexed = (index: number): CSSProperties => ({ "--i": index } as CSSProperties);
const sized = (index: number, width: string): CSSProperties => ({ "--i": index, "--w": width } as CSSProperties);

type CodeLine = { text: string; mark?: "accent" | "muted" | "cut" };

function CodeBlock({ lines }: { lines: CodeLine[] }) {
  return (
    <div className="cc-code-block">
      {lines.map((line, index) => (
        <code
          className={`cc-code-row ${line.mark ? `cc-code-row-${line.mark}` : ""}`}
          style={indexed(index)}
          key={`${line.text}-${index}`}
        >
          {line.text}
        </code>
      ))}
    </div>
  );
}

function ApiCard({
  eyebrow,
  title,
  lines,
  notes,
}: {
  eyebrow: string;
  title: string;
  lines: CodeLine[];
  notes: string[];
}) {
  return (
    <section className="cc-api-card cc-card card">
      <div className="cc-eyebrow">{eyebrow}</div>
      <h3>{title}</h3>
      <CodeBlock lines={lines} />
      <div className="cc-note-grid">
        {notes.map((note, index) => (
          <span style={indexed(index)} key={note}>
            {note}
          </span>
        ))}
      </div>
    </section>
  );
}

function FieldStack({ title, fields }: { title: string; fields: Array<[string, string]> }) {
  return (
    <div className="cc-field-stack cc-card card">
      <strong>{title}</strong>
      {fields.map(([name, hint], index) => (
        <div className="cc-field-row" style={indexed(index)} key={name}>
          <code>{name}</code>
          <span>{hint}</span>
        </div>
      ))}
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  index,
}: {
  label: string;
  value: string;
  hint: string;
  index: number;
}) {
  return (
    <div className="cc-metric-card cc-card card" style={indexed(index)}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  );
}

function ContextRelaySvg() {
  return (
    <svg className="cc-context-svg" viewBox="0 0 760 360" role="img" aria-label="set_trace_context 到 hook 的上下文读取流程">
      <path className="cc-svg-line cc-path-a" d="M244 176 H344" />
      <path className="cc-svg-line cc-path-b" d="M500 176 H612" />
      <path className="cc-svg-line cc-path-c" d="M672 214 C672 286 538 296 478 296" />
      <rect className="cc-svg-panel cc-context-box" x="34" y="72" width="210" height="208" />
      <text className="cc-svg-title" x="139" y="118" textAnchor="middle">LazyTraceContext</text>
      <text className="cc-svg-copy" x="139" y="156" textAnchor="middle">session / user / tags</text>
      <text className="cc-svg-copy" x="139" y="190" textAnchor="middle">trace_id / parent</text>
      <text className="cc-svg-copy" x="139" y="224" textAnchor="middle">sampled / payload</text>
      <rect className="cc-svg-panel cc-run-box" x="344" y="122" width="156" height="108" />
      <text className="cc-svg-title" x="422" y="166" textAnchor="middle">rag_ppl</text>
      <text className="cc-svg-code" x="422" y="198" textAnchor="middle">(question)</text>
      <rect className="cc-svg-panel cc-hook-box" x="612" y="96" width="124" height="160" />
      <text className="cc-svg-title" x="674" y="150" textAnchor="middle">hook</text>
      <text className="cc-svg-copy" x="674" y="186" textAnchor="middle">read context</text>
      <rect className="cc-svg-panel cc-ghost-box" x="330" y="272" width="148" height="48" />
      <text className="cc-svg-copy" x="404" y="303" textAnchor="middle">Trace: not yet</text>
      <circle className="cc-svg-dot cc-dot-a" cx="286" cy="176" r="8" />
      <circle className="cc-svg-dot cc-dot-b" cx="552" cy="176" r="8" />
      <circle className="cc-svg-dot cc-dot-c" cx="628" cy="276" r="8" />
    </svg>
  );
}

function RequestControlSvg() {
  const modules: Array<[string, string, number, boolean]> = [
    ["document", "on", 96, true],
    ["retriever", "on", 216, true],
    ["llm", "off", 336, false],
    ["tool", "on", 456, true],
  ];
  return (
    <svg className="cc-control-svg" viewBox="0 0 760 360" role="img" aria-label="请求级采集控制门禁图">
      <rect className="cc-svg-panel" x="36" y="48" width="162" height="264" />
      <text className="cc-svg-title" x="117" y="96" textAnchor="middle">request</text>
      <text className="cc-svg-copy" x="117" y="138" textAnchor="middle">LazyTraceContext</text>
      <path className="cc-svg-line cc-path-a" d="M198 180 H292" />
      <rect className="cc-svg-panel cc-gate-box" x="292" y="64" width="168" height="232" />
      <text className="cc-svg-title" x="376" y="108" textAnchor="middle">capture gates</text>
      <text className="cc-svg-code" x="376" y="154" textAnchor="middle">sampled</text>
      <text className="cc-svg-code" x="376" y="196" textAnchor="middle">payload</text>
      <text className="cc-svg-code" x="376" y="238" textAnchor="middle">module</text>
      <path className="cc-svg-line cc-path-b" d="M460 180 H548" />
      <rect className="cc-svg-panel" x="548" y="54" width="178" height="86" />
      <text className="cc-svg-title" x="637" y="92" textAnchor="middle">exporter</text>
      <text className="cc-svg-copy" x="637" y="120" textAnchor="middle">sampled=True 才上报</text>
      <rect className="cc-svg-panel" x="548" y="220" width="178" height="86" />
      <text className="cc-svg-title" x="637" y="258" textAnchor="middle">payload store</text>
      <text className="cc-svg-copy" x="637" y="286" textAnchor="middle">input / output 可留存</text>
      {modules.map(([name, state, y, active], index) => (
        <g className={`cc-module-node ${active ? "cc-module-on" : "cc-module-off"}`} style={indexed(index)} key={name}>
          <rect x="68" y={y} width="98" height="46" />
          <text className="cc-svg-code" x="117" y={y + 29} textAnchor="middle">{name}</text>
          <text className="cc-svg-copy" x="216" y={y + 30}>{state}</text>
        </g>
      ))}
    </svg>
  );
}

function BoundarySvg() {
  return (
    <svg className="cc-boundary-svg" viewBox="0 0 820 400" role="img" aria-label="enable_trace 入口边界图">
      <path className="cc-boundary-loop" d="M60 70 H366 V330 H60 Z" />
      <path className="cc-boundary-loop cc-loop-b" d="M454 70 H760 V330 H454 Z" />
      <text className="cc-svg-title" x="213" y="46" textAnchor="middle">Flow / Module</text>
      <text className="cc-svg-title" x="607" y="46" textAnchor="middle">Python callable</text>
      <rect className="cc-svg-panel" x="96" y="118" width="112" height="68" />
      <rect className="cc-svg-panel" x="242" y="118" width="92" height="68" />
      <rect className="cc-svg-panel" x="166" y="236" width="124" height="68" />
      <path className="cc-svg-line cc-path-a" d="M208 152 H242" />
      <path className="cc-svg-line cc-path-b" d="M213 186 C213 218 228 220 228 236" />
      <text className="cc-svg-code" x="152" y="160" textAnchor="middle">flow</text>
      <text className="cc-svg-code" x="288" y="160" textAnchor="middle">hook</text>
      <text className="cc-svg-code" x="228" y="278" textAnchor="middle">inner spans</text>
      <rect className="cc-svg-panel" x="492" y="112" width="118" height="72" />
      <rect className="cc-svg-panel cc-entry-box" x="646" y="112" width="84" height="72" />
      <rect className="cc-svg-panel" x="570" y="238" width="118" height="72" />
      <path className="cc-svg-line cc-path-c" d="M610 148 H646" />
      <path className="cc-svg-line cc-path-d" d="M688 184 C704 230 660 236 630 238" />
      <text className="cc-svg-code" x="551" y="155" textAnchor="middle">callable</text>
      <text className="cc-svg-code" x="688" y="155" textAnchor="middle">entry</text>
      <text className="cc-svg-code" x="629" y="280" textAnchor="middle">child work</text>
      <text className="cc-svg-copy" x="213" y="358" textAnchor="middle">内部节点继续走默认 hook</text>
      <text className="cc-svg-copy" x="607" y="358" textAnchor="middle">无活动父节点时补入口 span</text>
    </svg>
  );
}

function PriorityDiagram() {
  const rows: Array<[string, string, string]> = [
    ["TRACE_ENABLED", "enabled", "是否建节点"],
    ["TRACE_SAMPLED", "sampled", "是否上报"],
    ["TRACE_CAPTURE_PAYLOAD", "debug_capture_payload", "内容留存"],
    ["TRACE_MODULE_RULE", "module_trace", "模块过滤"],
  ];
  return (
    <div className="cc-priority">
      <div className="cc-priority-column cc-card card">
        <strong>环境变量</strong>
        <span>进程默认值</span>
        {rows.map(([env], index) => (
          <code style={indexed(index)} key={env}>{env}</code>
        ))}
      </div>
      <div className="cc-priority-arrow">
        <i />
        <span>单次覆盖</span>
      </div>
      <div className="cc-priority-column cc-priority-context cc-card card">
        <strong>LazyTraceContext</strong>
        <span>请求级覆盖</span>
        {rows.map(([, ctx], index) => (
          <code style={indexed(index)} key={ctx}>{ctx}</code>
        ))}
      </div>
      <div className="cc-priority-arrow">
        <i />
        <span>hook 读取</span>
      </div>
      <div className="cc-priority-column cc-card card">
        <strong>有效策略</strong>
        <span>本次请求</span>
        {rows.map(([, ctx, hint], index) => (
          <div className="cc-effective-row" style={indexed(index)} key={hint}>
            <code>{ctx}</code>
            <small>{hint}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function Switchboard() {
  const rows: Array<[string, string, string, string, string]> = [
    ["enabled", "False", "不建节点", "Trace 树没有这个 span", "15%"],
    ["sampled", "False", "建了但不上报", "本地结构仍可存在", "42%"],
    ["debug_capture_payload", "False", "裁掉 input/output", "Trace 不消失，只少内容", "68%"],
    ["module_trace.by_name.llm", "False", "llm 节点不记录", "同请求其它模块照常", "90%"],
  ];
  return (
    <div className="cc-switchboard">
      {rows.map(([key, value, decision, impact, width], index) => (
        <div className="cc-switch-row cc-card card" style={sized(index, width)} key={key}>
          <code>{key}</code>
          <strong>{value}</strong>
          <span>{decision}</span>
          <small>{impact}</small>
          <div className="cc-switch-track">
            <i />
          </div>
        </div>
      ))}
    </div>
  );
}

function SplitScene({ title, kicker, children }: { title: string; kicker: string; children: ReactNode }) {
  return (
    <div className="cc-scene scene-pad">
      <div className="cc-title-block">
        <div className="cc-kicker">{kicker}</div>
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function ControlApiConfig({ step }: ChapterStepProps) {
  if (step === 0) {
    return (
      <SplitScene title="set_trace_context：只写请求上下文" kicker="请求上下文">
        <div className="cc-step-one">
          <ApiCard
            eyebrow="API CARD"
            title="先写字段，后面执行才会读"
            lines={[
              { text: "set_trace_context(", mark: "accent" },
              { text: "  session_id=\"s_42\", user_id=\"u_7\"," },
              { text: "  request_tags=[\"rag\", \"debug\"]," },
              { text: "  trace_id=\"tr_existing\"," },
              { text: "  parent_span_id=\"span_parent\"" },
              { text: ")" },
              { text: "rag_ppl(question)", mark: "accent" },
            ]}
            notes={["只调用不建 Trace", "hook 在真实执行时读取", "可续接外部链路"]}
          />
          <div className="cc-context-visual cc-card card">
            <ContextRelaySvg />
          </div>
          <FieldStack
            title="归属字段"
            fields={[
              ["session_id", "按会话聚合"],
              ["user_id", "按用户筛选"],
              ["request_tags", "请求级标签"],
            ]}
          />
          <FieldStack
            title="链路续接"
            fields={[
              ["trace_id", "接到已有 Trace"],
              ["parent_span_id", "挂到外部父节点"],
              ["rag_ppl(question)", "真正触发 hook"],
            ]}
          />
        </div>
      </SplitScene>
    );
  }

  if (step === 1) {
    return (
      <SplitScene title="请求级采集控制：不改全局服务" kicker="单次覆盖">
        <div className="cc-step-two">
          <div className="cc-control-panel cc-card card">
            <RequestControlSvg />
          </div>
          <div className="cc-control-cards">
            <MetricCard label="sampled" value="上报开关" hint="控制是否送到 exporter / backend" index={0} />
            <MetricCard label="debug_capture_payload" value="内容留存" hint="本次是否保留 input / output" index={1} />
            <MetricCard label="module_trace" value="模块过滤" hint="按模块名关闭本次采集" index={2} />
          </div>
          <ApiCard
            eyebrow="REQUEST PATCH"
            title="本次把 llm 关掉"
            lines={[
              { text: "set_trace_context(" },
              { text: "  sampled=True," },
              { text: "  debug_capture_payload=False," },
              { text: "  module_trace={\"by_name\": {\"llm\": False}}", mark: "accent" },
              { text: ")" },
            ]}
            notes={["document / retriever 仍记录", "llm 节点跳过", "全局配置不变"]}
          />
        </div>
      </SplitScene>
    );
  }

  if (step === 2) {
    return (
      <SplitScene title="enable_trace：入口边界，而不是内部替代品" kicker="入口边界">
        <div className="cc-step-three">
          <div className="cc-boundary-panel cc-card card">
            <BoundarySvg />
          </div>
          <div className="cc-entry-api-grid">
            <ApiCard
              eyebrow="WRAPPER"
              title="包住某一次调用"
              lines={[
                { text: "answer = enable_trace(rag_ppl)(", mark: "accent" },
                { text: "  question," },
                { text: "  session_id=\"s_42\"" },
                { text: ")" },
              ]}
              notes={["临时入口", "适合单次调试", "上下文随调用进入"]}
            />
            <ApiCard
              eyebrow="DECORATOR"
              title="服务入口长期复用"
              lines={[
                { text: "@enable_trace", mark: "accent" },
                { text: "def handle_request(question):" },
                { text: "  return rag_ppl(question)" },
              ]}
              notes={["固定入口", "适合服务函数", "普通 callable 可补入口 span"]}
            />
          </div>
        </div>
      </SplitScene>
    );
  }

  if (step === 3) {
    return (
      <SplitScene title="Tracing 专用参数先被消费" kicker="参数与优先级">
        <div className="cc-step-four">
          <div className="cc-consume-panel cc-card card">
            <div className="cc-consume-title">
              <strong>调用入口</strong>
              <span>业务函数不会收到 tracing 专用参数</span>
            </div>
            <CodeBlock
              lines={[
                { text: "rag_service(", mark: "accent" },
                { text: "  question=\"...\", top_k=3," },
                { text: "  session_id=\"s_42\",", mark: "cut" },
                { text: "  request_tags=[\"debug\"],", mark: "cut" },
                { text: "  trace_id=\"tr_existing\"", mark: "cut" },
                { text: ")" },
              ]}
            />
            <div className="cc-consume-split">
              <div>
                <strong>LazyTraceContext</strong>
                <code>session_id / request_tags / trace_id</code>
              </div>
              <div>
                <strong>业务函数</strong>
                <code>question / top_k</code>
              </div>
            </div>
          </div>
          <PriorityDiagram />
        </div>
      </SplitScene>
    );
  }

  if (step === 4) {
    return (
      <SplitScene title="采集开关分层：节点、上报、内容、模块" kicker="分层门禁">
        <div className="cc-step-five">
          <Switchboard />
          <div className="cc-layer-summary">
            <div className="cc-big-rule cc-card card">
              <span className="hero-num">01</span>
              <strong>enabled</strong>
              <p>决定这次是否建节点，是结构层开关。</p>
            </div>
            <div className="cc-big-rule cc-card card">
              <span className="hero-num">02</span>
              <strong>sampled</strong>
              <p>节点建完以后，决定是否上报。</p>
            </div>
            <div className="cc-big-rule cc-card card">
              <span className="hero-num">03</span>
              <strong>payload / module</strong>
              <p>一个管内容留存，一个按模块名裁剪节点。</p>
            </div>
          </div>
        </div>
      </SplitScene>
    );
  }

  return (
    <SplitScene title="请求上下文、入口和采集控制" kicker="control api config">
      <div className="cc-fallback cc-card card">
        <strong>step out of range</strong>
        <code>narrations.length = 5</code>
      </div>
    </SplitScene>
  );
}
