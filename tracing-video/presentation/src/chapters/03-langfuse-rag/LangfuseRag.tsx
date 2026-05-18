import type { CSSProperties } from "react";
import type { ChapterStepProps } from "../../registry/types";
import "./LangfuseRag.css";

const indexed = (index: number): CSSProperties => ({ "--i": index } as CSSProperties);

const withBar = (index: number, width: string): CSSProperties =>
  ({ "--i": index, "--w": width } as CSSProperties);

type TerminalRow = [string, string, string];

function TerminalBlock({ title, rows }: { title: string; rows: TerminalRow[] }) {
  return (
    <div className="lr-terminal">
      <div className="lr-terminal-title">
        <span>{title}</span>
        <code>observability shell</code>
      </div>
      <div className="lr-terminal-body">
        {rows.map(([prefix, command, note], index) => (
          <div className="lr-terminal-row" style={indexed(index)} key={`${prefix}-${command}`}>
            <span>{prefix}</span>
            <code>{command}</code>
            <small>{note}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function LabeledPill({ children, index }: { children: string; index: number }) {
  return (
    <span className="lr-pill" style={indexed(index)}>
      {children}
    </span>
  );
}

function RegionRouteSvg() {
  const nodes = [
    ["EU Cloud", "cloud.langfuse.com", 176, 88],
    ["US Cloud", "us.cloud.langfuse.com", 176, 220],
    ["Self-host", "langfuse.internal", 176, 352],
    ["OTLP HTTP", "exporter", 492, 220],
    ["Langfuse", "project ingest", 766, 220],
  ];

  return (
    <svg className="lr-region-route" viewBox="0 0 930 440" role="img" aria-label="Langfuse 写入地址路由">
      <path className="lr-svg-line lr-line-a" d="M300 88 C398 88 388 206 438 220" />
      <path className="lr-svg-line lr-line-b" d="M300 220 H438" />
      <path className="lr-svg-line lr-line-c" d="M300 352 C398 352 388 236 438 220" />
      <path className="lr-svg-line lr-line-d" d="M546 220 H676" />
      {nodes.map(([label, hint, x, y], index) => (
        <g className="lr-region-node" style={indexed(index)} key={label}>
          <rect x={Number(x) - 112} y={Number(y) - 42} width="224" height="84" />
          <text x={Number(x)} y={Number(y) - 5} textAnchor="middle">
            {label}
          </text>
          <text className="lr-svg-hint" x={Number(x)} y={Number(y) + 22} textAnchor="middle">
            {hint}
          </text>
        </g>
      ))}
    </svg>
  );
}

function CredentialRegions() {
  const regions: Array<[string, string, string]> = [
    ["EU", "https://cloud.langfuse.com", "Cloud 常见默认地址"],
    ["US", "https://us.cloud.langfuse.com", "美国区 Cloud 地址"],
    ["Self-host", "https://langfuse.internal", "私有部署按实际域名"],
  ];

  return (
    <div className="lr-region-table">
      {regions.map(([region, url, note], index) => (
        <div className="lr-region-row" style={indexed(index)} key={region}>
          <strong>{region}</strong>
          <code>{url}</code>
          <span>{note}</span>
        </div>
      ))}
    </div>
  );
}

function CredentialsStep() {
  return (
    <div className="lr-scene">
      <div className="lr-credentials-layout">
        <section className="lr-title-stack">
          <div className="lr-kicker">Langfuse 接入 · 凭证和区域</div>
          <h1>先把观测后端准备好</h1>
          <p>
            写入地址、public key、secret key 属于观测后端配置，只服务 Trace 写入和认证，不进入业务分支。
          </p>
          <div className="lr-pill-row">
            <LabeledPill index={0}>LANGFUSE_BASE_URL</LabeledPill>
            <LabeledPill index={1}>LANGFUSE_PUBLIC_KEY</LabeledPill>
            <LabeledPill index={2}>LANGFUSE_SECRET_KEY</LabeledPill>
          </div>
        </section>

        <section className="lr-credentials-board">
          <TerminalBlock
            title=".env.langfuse"
            rows={[
              ["export", 'LANGFUSE_BASE_URL="https://cloud.langfuse.com"', "EU Cloud 写入地址"],
              ["export", 'LANGFUSE_PUBLIC_KEY="pk-lf-..."', "项目 public key"],
              ["export", 'LANGFUSE_SECRET_KEY="sk-lf-..."', "服务端 secret key"],
              ["alt", 'LANGFUSE_BASE_URL="https://us.cloud.langfuse.com"', "US Cloud 可替换"],
              ["alt", 'LANGFUSE_BASE_URL="https://langfuse.internal"', "self-host 按部署填写"],
            ]}
          />
          <CredentialRegions />
        </section>
      </div>
      <RegionRouteSvg />
    </div>
  );
}

function DependencyFlowSvg() {
  const nodes = [
    ["LazyLLM", "Flow / Module hooks", 116, 136],
    ["OpenTelemetry API", "standard span", 354, 136],
    ["OpenTelemetry SDK", "processor / provider", 596, 136],
    ["OTLP HTTP exporter", "protocol bridge", 838, 136],
    ["Langfuse", "trace backend", 1076, 136],
  ];

  return (
    <svg className="lr-dependency-flow" viewBox="0 0 1190 260" role="img" aria-label="依赖栈导出链路">
      {nodes.slice(0, -1).map((node, index) => {
        const x = Number(node[2]);
        return (
          <path
            className="lr-svg-line"
            style={indexed(index)}
            d={`M${x + 104} 136 H${x + 188}`}
            key={node[0]}
          />
        );
      })}
      {nodes.map(([label, hint, x, y], index) => (
        <g className="lr-dependency-node" style={indexed(index)} key={label}>
          <rect x={Number(x) - 104} y={Number(y) - 50} width="208" height="100" />
          <text x={Number(x)} y={Number(y) - 8} textAnchor="middle">
            {label}
          </text>
          <text className="lr-svg-hint" x={Number(x)} y={Number(y) + 22} textAnchor="middle">
            {hint}
          </text>
        </g>
      ))}
    </svg>
  );
}

function RuntimeSwitches() {
  const switches: Array<[string, string, string, string]> = [
    ["LAZYLLM_TRACE_ENABLED", "ON", "是否追踪", "100%"],
    ["LAZYLLM_TRACE_BACKEND", "langfuse", "写到哪里", "72%"],
    ["LAZYLLM_TRACE_CONTENT_ENABLED", "ON", "是否保存内容", "86%"],
  ];

  return (
    <div className="lr-switch-grid">
      {switches.map(([name, value, note, width], index) => (
        <div className="lr-switch-card" style={withBar(index, width)} key={name}>
          <span>{note}</span>
          <code>{name}</code>
          <strong>{value}</strong>
          <div className="lr-switch-track">
            <i />
          </div>
        </div>
      ))}
    </div>
  );
}

function DependencyStep() {
  const stackCards: Array<[string, string, string[]]> = [
    ["lazyllm", "编排和内置 hook", ["Flow", "Module", "semantic attributes"]],
    ["langfuse", "后端集成", ["project auth", "Trace / Observation", "Cloud or self-host"]],
    ["opentelemetry", "标准 span 生命周期", ["opentelemetry-api", "opentelemetry-sdk", "OTLP HTTP exporter"]],
  ];

  return (
    <div className="lr-scene">
      <div className="lr-step-intro">
        <div className="lr-kicker">依赖栈 + 运行开关</div>
        <h2>依赖负责能力，环境变量负责运行策略</h2>
      </div>
      <div className="lr-dependency-layout">
        <section className="lr-dependency-left">
          <TerminalBlock
            title="install"
            rows={[
              ["pip", "install lazyllm", "业务编排 + 默认 hook"],
              ["pip", "install langfuse", "后端 SDK / 集成"],
              ["pip", "install opentelemetry-api opentelemetry-sdk", "标准 span API / SDK"],
              ["pip", "install opentelemetry-exporter-otlp-proto-http", "OTLP HTTP 导出"],
            ]}
          />
          <div className="lr-stack-cards">
            {stackCards.map(([name, role, tags], index) => (
              <div className="lr-stack-card" style={indexed(index)} key={name}>
                <strong>{name}</strong>
                <span>{role}</span>
                <ul>
                  {tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
        <section className="lr-dependency-right">
          <DependencyFlowSvg />
          <RuntimeSwitches />
        </section>
      </div>
    </div>
  );
}

function AutoTraceSvg() {
  const nodes = [
    ["Flow", "execution boundary", 166, 118],
    ["Module", "_call_impl boundary", 166, 294],
    ["LazyTracingHook", "pre / post / error", 482, 206],
    ["Trace", "auto generated", 780, 206],
    ["Langfuse", "backend write", 1054, 206],
  ];

  return (
    <svg className="lr-auto-svg" viewBox="0 0 1180 410" role="img" aria-label="默认接入执行边界">
      <path className="lr-svg-line lr-line-a" d="M270 118 C350 118 360 178 378 194" />
      <path className="lr-svg-line lr-line-b" d="M270 294 C350 294 360 234 378 218" />
      <path className="lr-svg-line lr-line-c" d="M586 206 H676" />
      <path className="lr-svg-line lr-line-d" d="M884 206 H950" />
      <path className="lr-boundary-ring" d="M358 48 H608 V364 H358 Z" />
      <text className="lr-boundary-label" x="483" y="388" textAnchor="middle">
        观测逻辑停在执行边界
      </text>
      {nodes.map(([label, hint, x, y], index) => (
        <g className="lr-auto-node" style={indexed(index)} key={label}>
          <rect x={Number(x) - 104} y={Number(y) - 48} width="208" height="96" />
          <text x={Number(x)} y={Number(y) - 7} textAnchor="middle">
            {label}
          </text>
          <text className="lr-svg-hint" x={Number(x)} y={Number(y) + 23} textAnchor="middle">
            {hint}
          </text>
        </g>
      ))}
    </svg>
  );
}

function StablePipelineCode() {
  const lines = [
    "documents = lazyllm.Document(dataset_path='./docs')",
    "retriever = lazyllm.Retriever(doc=documents, topk=3)",
    "llm = lazyllm.OnlineChatModule(...)",
    "",
    "with lazyllm.pipeline() as rag_ppl:",
    "    rag_ppl.retriever = retriever",
    "    rag_ppl.formatter = formatter",
    "    rag_ppl.llm = llm",
    "",
    "answer = rag_ppl(question)",
  ];

  return (
    <div className="lr-code-window">
      <div className="lr-code-title">
        <span>业务调用代码</span>
        <code>unchanged</code>
      </div>
      <pre>
        {lines.map((line, index) => (
          <code className={line === "" ? "lr-code-gap" : ""} style={indexed(index)} key={`${index}-${line}`}>
            {line || " "}
          </code>
        ))}
      </pre>
    </div>
  );
}

function DefaultAttachStep() {
  return (
    <div className="lr-scene">
      <div className="lr-default-layout">
        <section className="lr-default-copy">
          <div className="lr-kicker">默认接入路径</div>
          <h2>业务 pipeline 不改，Trace 在边界生成</h2>
          <p>
            Flow 和 Module 的执行路径已经有 hook 入口。配置后端与开关以后，原来的 pipeline 继续运行，观测链路自动挂上去。
          </p>
          <div className="lr-assertion-grid">
            <div className="lr-assertion" style={indexed(0)}>
              <strong>调用代码</strong>
              <span>保持原样</span>
            </div>
            <div className="lr-assertion" style={indexed(1)}>
              <strong>Hook 入口</strong>
              <span>Flow / Module 点亮</span>
            </div>
            <div className="lr-assertion" style={indexed(2)}>
              <strong>Trace</strong>
              <span>自动生成</span>
            </div>
          </div>
        </section>
        <StablePipelineCode />
      </div>
      <AutoTraceSvg />
    </div>
  );
}

function RagTopologySvg() {
  const nodes = [
    ["Document", "knowledge source", 210, 90],
    ["Retriever", "bm25_chinese · topk=3", 210, 240],
    ["formatter", "context_str", 540, 240],
    ["LLM", "answer generation", 870, 240],
    ["Pipeline", "Trace root", 540, 90],
    ["TxtReader", "document read", 210, 382],
  ];

  return (
    <svg className="lr-rag-topology" viewBox="0 0 1080 470" role="img" aria-label="RAG 业务骨架映射 Trace 拓扑">
      <path className="lr-svg-line lr-line-a" d="M314 90 H436" />
      <path className="lr-svg-line lr-line-b" d="M540 138 V196" />
      <path className="lr-svg-line lr-line-c" d="M314 240 H436" />
      <path className="lr-svg-line lr-line-d" d="M644 240 H766" />
      <path className="lr-svg-line lr-line-e" d="M210 288 V334" />
      {nodes.map(([label, hint, x, y], index) => (
        <g className="lr-rag-node" style={indexed(index)} key={label}>
          <rect x={Number(x) - 104} y={Number(y) - 44} width="208" height="88" />
          <text x={Number(x)} y={Number(y) - 5} textAnchor="middle">
            {label}
          </text>
          <text className="lr-svg-hint" x={Number(x)} y={Number(y) + 23} textAnchor="middle">
            {hint}
          </text>
        </g>
      ))}
    </svg>
  );
}

function RagCodeSkeleton() {
  const blocks: Array<[string, string[]]> = [
    ["Document", ['documents = lazyllm.Document(dataset_path="./docs")']],
    [
      "Retriever",
      [
        "retriever = lazyllm.Retriever(",
        "    doc=documents,",
        '    similarity="bm25_chinese",',
        "    topk=3,",
        ")",
      ],
    ],
    [
      "formatter",
      [
        "lambda nodes, query: dict(",
        "    context_str='\\n\\n'.join([n.get_content() for n in nodes]),",
        "    query=query,",
        ")",
      ],
    ],
    ["LLM + Pipeline", ["rag_ppl.retriever = retriever", "rag_ppl.formatter = formatter", "rag_ppl.llm = llm"]],
  ];

  return (
    <div className="lr-rag-code">
      {blocks.map(([name, lines], index) => (
        <div className="lr-rag-code-block" style={indexed(index)} key={name}>
          <strong>{name}</strong>
          <pre>
            {lines.map((line) => (
              <code key={line}>{line}</code>
            ))}
          </pre>
        </div>
      ))}
    </div>
  );
}

function RagMappingStep() {
  const rows: Array<[string, string, string]> = [
    ["Document", "知识源", "TxtReader 子节点读取文档"],
    ["Retriever", "召回", "similarity=bm25_chinese · topk=3"],
    ["formatter", "上下文整理", "nodes -> context_str"],
    ["LLM", "基于上下文回答", "prompt extra_keys=['context_str']"],
    ["Pipeline", "根拓扑", "业务结构映射 Trace 节点"],
  ];

  return (
    <div className="lr-scene">
      <div className="lr-step-intro">
        <div className="lr-kicker">RAG 代码骨架映射</div>
        <h2>业务结构会直接变成 Trace 拓扑</h2>
      </div>
      <div className="lr-rag-layout">
        <RagCodeSkeleton />
        <section className="lr-rag-visual">
          <RagTopologySvg />
          <div className="lr-mapping-table">
            {rows.map(([node, role, signal], index) => (
              <div className="lr-mapping-row" style={indexed(index)} key={node}>
                <strong>{node}</strong>
                <span>{role}</span>
                <code>{signal}</code>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function LangfuseBrowserMock() {
  const nodes: Array<[string, string, string, string]> = [
    ["Pipeline", "SPAN", "root", "100%"],
    ["retriever", "RETRIEVER", "recall", "36%"],
    ["TxtReader", "SPAN", "document read", "22%"],
    ["<lambda>", "SPAN", "formatter", "18%"],
    ["llm", "GENERATION", "SenseNova-V6-5-Pro", "74%"],
  ];

  return (
    <div className="lr-browser">
      <div className="lr-browser-top">
        <span>Langfuse / Tracing</span>
        <code>Trace: Pipeline</code>
      </div>
      <div className="lr-browser-body">
        <aside className="lr-trace-list">
          <strong>Trace 列表</strong>
          <div className="lr-trace-item lr-is-active">
            <span>Pipeline</span>
            <code>rag · demo</code>
          </div>
          <div className="lr-trace-item">
            <span>Pipeline</span>
            <code>previous run</code>
          </div>
        </aside>
        <section className="lr-observation-tree">
          <strong>Observation 拓扑</strong>
          {nodes.map(([name, type, detail, width], index) => (
            <div className="lr-observation-row" style={withBar(index, width)} key={name}>
              <span>{name}</span>
              <code>{type}</code>
              <small>{detail}</small>
              <i />
            </div>
          ))}
        </section>
        <section className="lr-observation-detail">
          <div className="lr-detail-title">
            <span>选中节点</span>
            <strong>llm</strong>
          </div>
          <div className="lr-detail-grid">
            <span>observation type</span>
            <code>GENERATION</code>
            <span>model</span>
            <code>SenseNova-V6-5-Pro</code>
            <span>semantic source</span>
            <code>LazyLLM semantic completion</code>
            <span>content policy</span>
            <code>LAZYLLM_TRACE_CONTENT_ENABLED</code>
          </div>
        </section>
      </div>
    </div>
  );
}

function LangfuseReadStep() {
  return (
    <div className="lr-scene">
      <div className="lr-step-intro">
        <div className="lr-kicker">Langfuse 页面读取</div>
        <h2>看节点名，也看 observation type</h2>
      </div>
      <div className="lr-langfuse-layout">
        <LangfuseBrowserMock />
        <aside className="lr-semantic-aside">
          <div className="lr-semantic-card" style={indexed(0)}>
            <span>生成节点</span>
            <strong>llm</strong>
            <code>GENERATION</code>
          </div>
          <div className="lr-semantic-card" style={indexed(1)}>
            <span>检索节点</span>
            <strong>retriever</strong>
            <code>RETRIEVER</code>
          </div>
          <div className="lr-semantic-card lr-is-wide" style={indexed(2)}>
            <span>语义来源</span>
            <strong>不是页面猜测</strong>
            <code>LazyLLM 补全节点角色和后端字段</code>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function LangfuseRag({ step }: ChapterStepProps) {
  if (step === 0) return <CredentialsStep />;
  if (step === 1) return <DependencyStep />;
  if (step === 2) return <DefaultAttachStep />;
  if (step === 3) return <RagMappingStep />;
  if (step === 4) return <LangfuseReadStep />;

  return <CredentialsStep />;
}
