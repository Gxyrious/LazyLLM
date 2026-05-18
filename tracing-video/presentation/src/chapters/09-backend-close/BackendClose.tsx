import type { CSSProperties } from "react";
import type { ChapterStepProps } from "../../registry/types";
import "./BackendClose.css";

const indexed = (index: number): CSSProperties => ({ "--i": index } as CSSProperties);

type Anchor = [string, string, string];
type CodeLine = {
  text: string;
  mark?: "accent" | "muted" | "return";
};

function SceneTitle({
  kicker,
  title,
  aside,
}: {
  kicker: string;
  title: string;
  aside: string;
}) {
  return (
    <div className="bc-title">
      <div>
        <div className="bc-kicker">{kicker}</div>
        <h2>{title}</h2>
      </div>
      <p>{aside}</p>
    </div>
  );
}

function AnchorPanel({ anchors }: { anchors: Anchor[] }) {
  return (
    <div className="bc-anchor-panel">
      {anchors.map(([label, code, detail], index) => (
        <section className="bc-anchor card" style={indexed(index)} key={`${label}-${code}`}>
          <span>{label}</span>
          <code>{code}</code>
          <p>{detail}</p>
        </section>
      ))}
    </div>
  );
}

function CodePanel({
  eyebrow,
  title,
  lines,
}: {
  eyebrow: string;
  title: string;
  lines: CodeLine[];
}) {
  return (
    <section className="bc-code-panel card">
      <div className="bc-eyebrow">{eyebrow}</div>
      <h3>{title}</h3>
      <div className="bc-code-block">
        {lines.map((line, index) => (
          <code
            className={`bc-code-line ${line.mark ? `bc-code-line-${line.mark}` : ""}`}
            style={indexed(index)}
            key={`${line.text}-${index}`}
          >
            {line.text}
          </code>
        ))}
      </div>
    </section>
  );
}

function IsolationSvg() {
  const upstream: Array<[string, string, number]> = [
    ["Hook", "接入执行链", 82],
    ["LazySpan", "节点事实", 300],
    ["OpenTelemetry", "父子与上下文", 548],
  ];

  return (
    <svg className="bc-isolation-svg" viewBox="0 0 1180 610" role="img" aria-label="Backend 层隔离写入目标">
      <path className="bc-flow-line bc-upstream-line" d="M70 172 H760" />
      <path className="bc-flow-line bc-langfuse-line" d="M760 172 C846 172 846 92 930 92 H1092" />
      <path className="bc-flow-line bc-jsonl-line" d="M760 172 C846 172 846 248 930 248 H1092" />
      <path className="bc-flow-line bc-consume-line" d="M1034 310 C1034 410 858 464 634 464 H354" />
      <path className="bc-flow-line bc-return-line" d="M354 464 H186" />

      <rect className="bc-backend-wall" x="740" y="38" width="32" height="296" />
      <text className="bc-svg-copy bc-wall-label" x="756" y="368" textAnchor="middle">
        目标差异隔离
      </text>

      {upstream.map(([name, role, x], index) => (
        <g className="bc-upstream-node" style={indexed(index)} key={name}>
          <rect x={x} y="112" width="174" height="120" />
          <text className="bc-svg-title" x={x + 87} y="160" textAnchor="middle">
            {name}
          </text>
          <text className="bc-svg-copy" x={x + 87} y="196" textAnchor="middle">
            {role}
          </text>
        </g>
      ))}

      <g className="bc-standard-span" style={indexed(3)}>
        <rect x="632" y="114" width="190" height="116" />
        <text className="bc-svg-title" x="727" y="158" textAnchor="middle">
          标准节点
        </text>
        <text className="bc-svg-code" x="727" y="196" textAnchor="middle">
          OTel span + attrs
        </text>
      </g>

      <g className="bc-destination bc-destination-langfuse" style={indexed(4)}>
        <rect x="930" y="48" width="206" height="88" />
        <text className="bc-svg-title" x="1033" y="84" textAnchor="middle">
          Langfuse
        </text>
        <text className="bc-svg-code" x="1033" y="113" textAnchor="middle">
          OTLP exporter
        </text>
      </g>

      <g className="bc-destination bc-destination-jsonl" style={indexed(5)}>
        <rect x="930" y="204" width="206" height="88" />
        <text className="bc-svg-title" x="1033" y="240" textAnchor="middle">
          本地文件
        </text>
        <text className="bc-svg-code" x="1033" y="269" textAnchor="middle">
          JSONL span
        </text>
      </g>

      <g className="bc-consume-box" style={indexed(6)}>
        <rect x="420" y="402" width="392" height="124" />
        <text className="bc-svg-title" x="616" y="448" textAnchor="middle">
          消费后端读回
        </text>
        <text className="bc-svg-code" x="616" y="486" textAnchor="middle">
          ConsumeBackend -&gt; RawTracePayload
        </text>
      </g>

      <g className="bc-analysis-box" style={indexed(7)}>
        <rect x="58" y="418" width="198" height="92" />
        <text className="bc-svg-title" x="157" y="456" textAnchor="middle">
          分析系统
        </text>
        <text className="bc-svg-copy" x="157" y="486" textAnchor="middle">
          评估 / 回归对比
        </text>
      </g>
    </svg>
  );
}

function IsolationStep() {
  const anchors: Anchor[] = [
    ["上游产物", "标准 span", "业务流程、Hook、OTel 生命周期只交出统一观测数据"],
    ["隔离位置", "OpenTelemetry 之后", "Backend 位于标准层之后，专门吸收写入目标差异"],
    ["写入目标一", "Langfuse OTLP", "通过 OTLP 导出器发送到 Langfuse"],
    ["写入目标二", "local JSONL", "通过本地文件导出器写入 JSONL"],
    ["消费路径", "ConsumeBackend", "读取已有观测数据并还原统一载荷"],
    ["扩展边界", "新增 Backend", "新增后端集中改这一层，不回头改运行层"],
  ];

  return (
    <div className="bc-scene bc-scene-isolation">
      <SceneTitle
        kicker="第 9 章 · 后端抽象"
        title="Backend 层隔离写入目标，上游只产出标准节点"
        aside="同一组 span 可以写到 Langfuse，也可以写成本地 JSONL；Hook、LazySpan 和 OTel 生命周期都不需要关心目标。"
      />
      <div className="bc-isolation-layout">
        <section className="bc-visual-frame card">
          <IsolationSvg />
        </section>
        <AnchorPanel anchors={anchors} />
        <div className="bc-runtime-strip">
          {[
            ["运行时", "backend = self._get_backend()", "按配置拿到后端实例"],
            ["通道", "exporter = backend.build_exporter()", "只在初始化阶段决定写入出口"],
            ["安装", "BatchSpanProcessor(exporter)", "后续 span 生命周期仍归 OTel"],
          ].map(([label, code, detail], index) => (
            <div className="bc-runtime-cell" style={indexed(index)} key={label}>
              <span>{label}</span>
              <code>{code}</code>
              <small>{detail}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InterfaceSvg() {
  return (
    <svg className="bc-interface-svg" viewBox="0 0 1040 560" role="img" aria-label="TracingBackend 接口分工">
      <path className="bc-interface-stem" d="M520 92 V246" />
      <path className="bc-interface-arm bc-interface-arm-left" d="M520 246 C390 246 346 186 236 186" />
      <path className="bc-interface-arm bc-interface-arm-right" d="M520 246 C650 246 694 186 804 186" />
      <path className="bc-interface-arm bc-interface-arm-bottom" d="M520 314 C520 392 520 418 520 482" />

      <g className="bc-interface-core" style={indexed(0)}>
        <rect x="340" y="54" width="360" height="92" />
        <text className="bc-svg-title" x="520" y="94" textAnchor="middle">
          TracingBackend
        </text>
        <text className="bc-svg-code" x="520" y="124" textAnchor="middle">
          抽象基类
        </text>
      </g>

      <g className="bc-method-node bc-method-left" style={indexed(1)}>
        <rect x="62" y="132" width="348" height="142" />
        <text className="bc-svg-title" x="236" y="178" textAnchor="middle">
          构造写入通道
        </text>
        <text className="bc-svg-code" x="236" y="215" textAnchor="middle">
          build_exporter()
        </text>
        <text className="bc-svg-copy" x="236" y="246" textAnchor="middle">
          决定 span 最终写到哪里
        </text>
      </g>

      <g className="bc-method-node bc-method-right" style={indexed(2)}>
        <rect x="630" y="132" width="348" height="142" />
        <text className="bc-svg-title" x="804" y="178" textAnchor="middle">
          适配目标字段
        </text>
        <text className="bc-svg-code" x="804" y="215" textAnchor="middle">
          map_attributes(...)
        </text>
        <text className="bc-svg-copy" x="804" y="246" textAnchor="middle">
          不改变通用属性生成流程
        </text>
      </g>

      <g className="bc-target-table" style={indexed(3)}>
        <rect x="104" y="348" width="832" height="150" />
        <line x1="104" y1="398" x2="936" y2="398" />
        <line x1="382" y1="348" x2="382" y2="498" />
        <line x1="660" y1="348" x2="660" y2="498" />
        <text className="bc-svg-copy" x="243" y="380" textAnchor="middle">
          目标后端
        </text>
        <text className="bc-svg-copy" x="521" y="380" textAnchor="middle">
          写入通道
        </text>
        <text className="bc-svg-copy" x="798" y="380" textAnchor="middle">
          字段适配
        </text>
        <text className="bc-svg-title" x="243" y="442" textAnchor="middle">
          Langfuse
        </text>
        <text className="bc-svg-code" x="521" y="442" textAnchor="middle">
          OTLP exporter
        </text>
        <text className="bc-svg-code" x="798" y="442" textAnchor="middle">
          langfuse.*
        </text>
        <text className="bc-svg-title" x="243" y="478" textAnchor="middle">
          本地 JSONL
        </text>
        <text className="bc-svg-code" x="521" y="478" textAnchor="middle">
          JSONL exporter
        </text>
        <text className="bc-svg-copy" x="798" y="478" textAnchor="middle">
          保留 OTel 属性
        </text>
      </g>
    </svg>
  );
}

function AbilityCard({
  title,
  code,
  rows,
  index,
}: {
  title: string;
  code: string;
  rows: string[];
  index: number;
}) {
  return (
    <section className="bc-ability card" style={indexed(index)}>
      <span>{title}</span>
      <code>{code}</code>
      <ul>
        {rows.map((row) => (
          <li key={row}>{row}</li>
        ))}
      </ul>
    </section>
  );
}

function InterfaceStep() {
  return (
    <div className="bc-scene bc-scene-interface">
      <SceneTitle
        kicker="接口收敛"
        title="TracingBackend 只抽象两个能力：通道和字段"
        aside="新增后端的核心改动应该集中在 build_exporter 和 map_attributes，而不是回头改运行层或 hook 层。"
      />
      <div className="bc-interface-layout">
        <CodePanel
          eyebrow="article §3.5.1"
          title="基类把改动面收进两个抽象方法"
          lines={[
            { text: "class TracingBackend(ABC):", mark: "muted" },
            { text: "    name = ''", mark: "muted" },
            { text: "" },
            { text: "    @abstractmethod", mark: "muted" },
            { text: "    def build_exporter(self):", mark: "accent" },
            { text: "        pass", mark: "return" },
            { text: "" },
            { text: "    @abstractmethod", mark: "muted" },
            { text: "    def map_attributes(self, otel_attrs):", mark: "accent" },
            { text: "        return backend_attrs", mark: "return" },
          ]}
        />
        <section className="bc-interface-stage card">
          <InterfaceSvg />
        </section>
        <div className="bc-ability-grid">
          <AbilityCard
            title="通道职责"
            code="build_exporter"
            rows={["运行时初始化调用", "返回 exporter 实例", "Langfuse 走 OTLP", "本地后端写 JSONL"]}
            index={0}
          />
          <AbilityCard
            title="字段职责"
            code="map_attributes"
            rows={["span 结束前补字段", "通用 OTel 属性先写入", "Langfuse 映射 langfuse.*", "本地后端可原样保留"]}
            index={1}
          />
          <AbilityCard
            title="加载职责"
            code="_TRACE_BACKEND_SPECS"
            rows={["按名称加载模块路径", "运行时不依赖具体类", "写入后端与消费后端分开", "配置切换不碰上游采集"]}
            index={2}
          />
        </div>
      </div>
    </div>
  );
}

function ClosingMapSvg() {
  const roles: Array<[string, string, string, number]> = [
    ["Hook", "接入执行链", "pre / post / error / finalize", 82],
    ["LazySpan", "记录节点事实", "input / output / status / usage", 326],
    ["OpenTelemetry", "维护父子关系", "上下文传播", 590],
    ["Backend", "落地与字段映射", "build_exporter / map_attributes", 854],
  ];

  return (
    <svg className="bc-closing-svg" viewBox="0 0 1180 600" role="img" aria-label="Hook LazySpan OpenTelemetry Backend 职责收束总图">
      <path className="bc-close-line bc-close-main" d="M76 205 H1078" />
      <path className="bc-close-line bc-close-drop-a" d="M950 266 C950 344 824 380 690 380" />
      <path className="bc-close-line bc-close-drop-b" d="M950 266 C1020 340 1054 398 1054 470" />
      <path className="bc-close-line bc-close-read" d="M690 470 H310" />

      {roles.map(([name, duty, detail, x], index) => (
        <g
          className={`bc-final-role ${index === 3 ? "bc-final-role-backend" : ""}`}
          style={indexed(index)}
          key={name}
        >
          <rect x={x} y="128" width="208" height="154" />
          <text className="bc-svg-title" x={x + 104} y="176" textAnchor="middle">
            {name}
          </text>
          <text className="bc-svg-copy" x={x + 104} y="214" textAnchor="middle">
            {duty}
          </text>
          <text className="bc-svg-code" x={x + 104} y="250" textAnchor="middle">
            {detail}
          </text>
        </g>
      ))}

      <g className="bc-output-node" style={indexed(4)}>
        <rect x="564" y="342" width="252" height="82" />
        <text className="bc-svg-title" x="690" y="376" textAnchor="middle">
          观测后端
        </text>
        <text className="bc-svg-code" x="690" y="405" textAnchor="middle">
          Langfuse OTLP / JSONL
        </text>
      </g>

      <g className="bc-output-node" style={indexed(5)}>
        <rect x="906" y="430" width="250" height="82" />
        <text className="bc-svg-title" x="1031" y="464" textAnchor="middle">
          后端字段
        </text>
        <text className="bc-svg-code" x="1031" y="493" textAnchor="middle">
          langfuse.* / OTel attrs
        </text>
      </g>

      <g className="bc-output-node bc-output-consume" style={indexed(6)}>
        <rect x="70" y="430" width="276" height="82" />
        <text className="bc-svg-title" x="208" y="464" textAnchor="middle">
          消费后端
        </text>
        <text className="bc-svg-code" x="208" y="493" textAnchor="middle">
          RawTracePayload
        </text>
      </g>

      <g className="bc-close-caption" style={indexed(7)}>
        <rect x="360" y="36" width="460" height="56" />
        <text className="bc-svg-copy" x="590" y="72" textAnchor="middle">
          四层不混，排障、评估、回归对比复用同一套 Trace
        </text>
      </g>
    </svg>
  );
}

function ResponsibilityStack() {
  const rows: Array<[string, string, string]> = [
    ["接入", "Hook", "找到执行链入口，并把生命周期事件交给追踪逻辑"],
    ["事实", "LazySpan", "保存节点输入输出、状态、错误、耗时、用量和语义"],
    ["关系", "OpenTelemetry", "维护父子关系、上下文传播和 span 生命周期"],
    ["落地", "Backend", "提供 exporter，并把通用属性适配到目标后端字段"],
  ];

  return (
    <div className="bc-responsibility-stack">
      {rows.map(([label, code, detail], index) => (
        <section className="bc-responsibility-row card" style={indexed(index)} key={label}>
          <span>{label}</span>
          <code>{code}</code>
          <p>{detail}</p>
        </section>
      ))}
    </div>
  );
}

function ClosingStep() {
  const outputs: Anchor[] = [
    ["写入后端", "LangfuseBackend", "通过 OTLP 把标准节点送到 Langfuse"],
    ["写入后端", "LocalBackend", "把 span 保存成本地 JSONL"],
    ["消费后端", "LangfuseConsumeBackend", "从观测后端读回 Trace 数据"],
    ["消费后端", "LocalConsumeBackend", "从 JSONL 还原统一载荷"],
  ];

  return (
    <div className="bc-scene bc-scene-closing">
      <SceneTitle
        kicker="职责收束"
        title="Hook、LazySpan、OpenTelemetry、Backend 各管一段"
        aside="Trace 能同时服务排障、评估和回归对比，靠的是接入、事实、关系、落地四层边界清楚。"
      />
      <div className="bc-closing-layout">
        <section className="bc-closing-stage card">
          <ClosingMapSvg />
        </section>
        <ResponsibilityStack />
        <div className="bc-output-grid">
          {outputs.map(([label, code, detail], index) => (
            <section className="bc-output-card card" style={indexed(index)} key={`${label}-${code}`}>
              <span>{label}</span>
              <code>{code}</code>
              <p>{detail}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BackendCloseChapter({ step }: ChapterStepProps) {
  if (step === 0) {
    return <IsolationStep />;
  }

  if (step === 1) {
    return <InterfaceStep />;
  }

  if (step === 2) {
    return <ClosingStep />;
  }

  return <IsolationStep />;
}
