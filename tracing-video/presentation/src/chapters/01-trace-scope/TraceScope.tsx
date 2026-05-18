import type { CSSProperties } from "react";
import { MaskReveal } from "../../components/MaskReveal";
import type { ChapterStepProps } from "../../registry/types";
import "./TraceScope.css";

const indexed = (index: number): CSSProperties => ({ "--i": index } as CSSProperties);

function FieldChip({ children, index }: { children: string; index: number }) {
  return (
    <span className="ts-chip" style={indexed(index)}>
      {children}
    </span>
  );
}

function DenseList({ items }: { items: string[] }) {
  return (
    <ul className="ts-dense-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function KeyValueGrid({
  rows,
}: {
  rows: Array<[string, string, string]>;
}) {
  return (
    <div className="ts-kv-grid">
      {rows.map(([label, value, hint], index) => (
        <div className="ts-kv-row" style={indexed(index)} key={`${label}-${value}`}>
          <span>{label}</span>
          <code>{value}</code>
          <small>{hint}</small>
        </div>
      ))}
    </div>
  );
}

function CodeLine({
  label,
  value,
  index,
}: {
  label: string;
  value: string;
  index: number;
}) {
  return (
    <div className="ts-code-line" style={indexed(index)}>
      <span>{label}</span>
      <code>{value}</code>
    </div>
  );
}

function TraceTreeCover() {
  const nodes = [
    { id: "Request", hint: "真实请求", x: 118, y: 92 },
    { id: "Root Span", hint: "入口节点", x: 330, y: 92 },
    { id: "Backend", hint: "Langfuse/Local", x: 545, y: 92 },
    { id: "Retriever", hint: "召回", x: 235, y: 250 },
    { id: "LLM", hint: "生成", x: 424, y: 250 },
  ];
  return (
    <svg className="ts-tree-cover" viewBox="0 0 660 340" role="img" aria-label="追踪树示意">
      <path className="ts-tree-line ts-line-a" d="M156 92 H290" />
      <path className="ts-tree-line ts-line-b" d="M370 92 H506" />
      <path className="ts-tree-line ts-line-c" d="M330 127 C330 185 235 188 235 218" />
      <path className="ts-tree-line ts-line-d" d="M330 127 C330 185 424 188 424 218" />
      {nodes.map((node, index) => (
        <g key={node.id} className="ts-tree-node" style={indexed(index)}>
          <rect x={node.x - 56} y={node.y - 34} width="112" height="68" />
          <text x={node.x} y={node.y - 3} textAnchor="middle">
            {node.id}
          </text>
          <text className="ts-tree-hint" x={node.x} y={node.y + 20} textAnchor="middle">
            {node.hint}
          </text>
        </g>
      ))}
      <text className="ts-tree-caption" x="330" y="326" textAnchor="middle">
        {"request -> spans -> attributes -> exporter -> backend"}
      </text>
    </svg>
  );
}

function ContextRail() {
  const nodes: Array<[string, string, string[]]> = [
    ["Document", "module=document", ["trace_id 同步", "session 继承", "tags: rag/prod", "input: files", "metadata", "span 注册", "OTel attrs"]],
    ["Retriever", "span_type=retriever", ["parent_span_id", "Top-K=3", "query", "similarity", "chunks", "source_id", "duration"]],
    ["LLM", "span_type=llm", ["model", "prompt", "payload policy", "prompt_tokens", "completion_tokens", "status", "latency"]],
    ["Tool", "span_type=tool", ["tool_call_id", "tool_name", "args", "return", "exception", "error stack", "retry"]],
  ];
  return (
    <div className="ts-context-rail">
      <div className="ts-context-band">
        <span>Request Context</span>
        <code>trace_id=tr_8f3a · session_id=demo-session · request_tags=["rag","prod"]</code>
      </div>
      <div className="ts-context-nodes">
        {nodes.map(([name, type, lines], index) => (
          <div className="ts-context-node card" style={indexed(index)} key={name}>
            <strong>{name}</strong>
            <code>{type}</code>
            <DenseList items={lines as string[]} />
          </div>
        ))}
      </div>
      <div className="ts-context-meta">
        <CodeLine label="上下文传播" value="trace_id + parent_span_id" index={0} />
        <CodeLine label="分析聚合" value="session_id / user_id / request_tags" index={1} />
        <CodeLine label="请求级覆盖" value="sampled / debug_capture_payload / module_trace" index={2} />
      </div>
    </div>
  );
}

function TopologyMap() {
  const rows = [
    ["Pipeline", "span_001", "root", "入口"],
    ["Retriever", "span_002", "span_001", "召回"],
    ["TxtReader", "span_003", "span_002", "读取"],
    ["formatter", "span_004", "span_001", "上下文"],
    ["LLM", "span_005", "span_001", "生成"],
    ["Tool", "span_006", "span_005", "调用"],
  ];
  return (
    <div className="ts-topology">
      <svg
        className="ts-topology-map"
        viewBox="0 18 760 420"
        preserveAspectRatio="xMidYMin meet"
        role="img"
        aria-label="节点拓扑"
      >
        <path className="ts-topo-line" d="M380 72 V145" />
        <path className="ts-topo-line" d="M380 145 H160 V220" />
        <path className="ts-topo-line" d="M380 145 H380 V220" />
        <path className="ts-topo-line" d="M380 145 H600 V220" />
        <path className="ts-topo-line" d="M160 296 V370" />
        <path className="ts-topo-line" d="M600 296 V370" />
        {[
          ["Pipeline", 380, 72],
          ["Retriever", 160, 245],
          ["formatter", 380, 245],
          ["LLM", 600, 245],
          ["TxtReader", 160, 395],
          ["Tool", 600, 395],
        ].map(([name, x, y], index) => (
          <g key={name} className="ts-topo-node" style={indexed(index)}>
            <rect x={Number(x) - 82} y={Number(y) - 34} width="164" height="68" />
            <text x={Number(x)} y={Number(y) + 7} textAnchor="middle">
              {name}
            </text>
          </g>
        ))}
      </svg>
      <div className="ts-parent-table card">
        <div className="ts-parent-row is-head">
          <span>node</span>
          <code>span_id</code>
          <code>parent</code>
          <small>role</small>
        </div>
        {rows.map(([name, span, parent, role], index) => (
          <div className="ts-parent-row" style={indexed(index)} key={span}>
            <span>{name}</span>
            <code>{span}</code>
            <code>{parent}</code>
            <small>{role}</small>
          </div>
        ))}
      </div>
      <div className="ts-topology-notes">
        <div className="card">
          <span>root</span>
          <code>{"Pipeline -> Trace root"}</code>
          <DenseList items={["trace_id 起点", "span_id=span_001", "parent=root", "session/user tags"]} />
        </div>
        <div className="card">
          <span>fan-out</span>
          <code>{"span_001 -> retriever / formatter / llm"}</code>
          <DenseList items={["同级子节点", "共享 trace_id", "共享 parent_span_id", "分支耗时可比较"]} />
        </div>
        <div className="card">
          <span>nested</span>
          <code>TxtReader.parent = span_002</code>
          <DenseList items={["检索内部调用", "child duration 聚合", "错误向上归因", "深度链路保留"]} />
        </div>
        <div className="card">
          <span>tool chain</span>
          <code>Tool.parent = span_005</code>
          <DenseList items={["LLM 触发工具", "tool_call_id 关联", "return / exception", "错误可回溯"]} />
        </div>
      </div>
    </div>
  );
}

function NodeInspector() {
  const spanRows: Array<[string, string, string]> = [
    ["input", "{ query: '什么是夜来香？' }", "可按策略脱敏"],
    ["output", "{ answer: '夜间散发花香...' }", "可关闭完整内容"],
    ["status", "OK / ERROR", "请求级状态"],
    ["exception", "stacktrace | null", "on_error 写入"],
    ["duration", "1240ms", "性能定位"],
    ["attributes", "semantic_type + usage", "结构化分析"],
  ];
  const captureFlow: Array<[string, string, string]> = [
    ["global default", "TRACE_CONTENT_ENABLED=ON", "进程默认策略"],
    ["request override", "debug_capture_payload=False", "单次请求覆盖"],
    ["module rule", "module_trace.by_name.llm=False", "模块级关闭"],
    ["stored fields", "status / latency / error / semantic_type", "payload 可选"],
  ];
  return (
    <div className="ts-inspector">
      <div className="ts-inspector-panel card">
        <div className="ts-panel-title">LazySpan snapshot</div>
        <KeyValueGrid rows={spanRows} />
      </div>
      <div className="ts-payload-panel">
        <div className="ts-toggle-card card">
          <span>Payload policy</span>
          <strong>capture</strong>
          <code>debug_capture_payload=True</code>
          <DenseList items={["保存 input / output", "保留节点结构", "用于回放和评估"]} />
        </div>
        <div className="ts-toggle-card card is-muted">
          <span>Payload policy</span>
          <strong>redact</strong>
          <code>debug_capture_payload=False</code>
          <DenseList items={["隐藏完整内容", "保留 status / latency", "降低敏感信息暴露"]} />
        </div>
        <div className="ts-redacted card">
          <span>结构仍然保留</span>
          <code>span_id / parent_span_id / semantic_type / error</code>
        </div>
      </div>
      <div className="ts-capture-flow">
        {captureFlow.map(([label, value, hint], index) => (
          <div className="ts-capture-cell card" style={indexed(index)} key={label}>
            <span>{label}</span>
            <code>{value}</code>
            <small>{hint}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function SemanticMatrix() {
  const items: Array<[string, string, string[]]> = [
    ["LLM", "llm", ["model", "prompt", "temperature", "prompt_tokens", "completion_tokens", "latency", "stream", "GENERATION"]],
    ["Retriever", "retriever", ["Top-K", "query", "similarity", "chunks", "source_id", "doc_id", "metadata", "RETRIEVER"]],
    ["Reranker", "rerank", ["score", "rank", "cutoff", "candidate_id", "before/after", "threshold", "top_n", "score_delta"]],
    ["Tool", "tool", ["tool_name", "args", "return", "status", "exception", "retry", "timeout", "result_size"]],
    ["Agent", "agent", ["decision", "state", "tool_call", "memory", "loop_count", "step_id", "finish_reason", "finalize"]],
  ];
  return (
    <div className="ts-semantic">
      <div className="ts-semantic-grid">
        {items.map(([label, tag, fields], index) => (
          <div className="ts-semantic-cell card" style={indexed(index)} key={String(tag)}>
            <span>{label}</span>
            <code>{tag}</code>
            <ul>
              {(fields as string[]).map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="ts-analysis-bus">
        <span>semantic_type</span>
        <strong>同一套 Trace 树，按业务角色进入排障 / 评估 / 成本分析</strong>
      </div>
    </div>
  );
}

function NodeLedger() {
  const rows = [
    ["model", "SenseNova-V6-5-Pro", "配置"],
    ["Top-K", "3", "检索"],
    ["rerank_score", "0.87", "质量"],
    ["branch", "rag", "路径"],
    ["latency", "1240ms", "性能"],
    ["prompt_tokens", "812", "成本"],
    ["completion_tokens", "156", "成本"],
    ["status", "OK", "稳定性"],
    ["sampled", "true", "上报"],
    ["backend", "langfuse", "写入"],
  ];
  const metrics = [
    ["latency", "1240ms", "82%"],
    ["retrieval", "210ms", "36%"],
    ["generation", "930ms", "74%"],
    ["prompt", "812 tok", "82%"],
    ["completion", "156 tok", "34%"],
    ["score", "0.87", "87%"],
  ];
  return (
    <div className="ts-ledger">
      <div className="ts-ledger-table card">
        <div className="ts-ledger-head">
          <span>字段</span>
          <span>值</span>
          <span>用途</span>
        </div>
        {rows.map(([field, value, use], index) => (
          <div className="ts-ledger-row" style={indexed(index)} key={field}>
            <span>{field}</span>
            <code>{value}</code>
            <strong>{use}</strong>
          </div>
        ))}
      </div>
      <div className="ts-token-bars">
        {metrics.map(([label, value, width], index) => (
          <div className="ts-token-card card" style={{ ...indexed(index), "--w": width } as CSSProperties} key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <div className="ts-bar"><i /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TraceScopeChapter({ step }: ChapterStepProps) {
  if (step === 0) {
    return (
      <div className="ts-scene scene-pad">
        <div className="ts-cover">
          <section className="ts-cover-copy">
            <div className="kicker">第 1 章 · 追踪记录什么</div>
            <h1>
              <MaskReveal show duration={1000}>请求级</MaskReveal>
              <br />
              <MaskReveal show delay={240} duration={1000}>执行地图</MaskReveal>
            </h1>
            <p>
              不是日志堆叠，而是把一次真实请求整理成可定位、可比较、可写入的结构化追踪树。
            </p>
            <div className="ts-cover-tags">
              <FieldChip index={0}>Trace Tree</FieldChip>
              <FieldChip index={1}>Root Span</FieldChip>
              <FieldChip index={2}>OTel Attributes</FieldChip>
              <FieldChip index={3}>Exporter / Backend</FieldChip>
            </div>
          </section>
          <section className="ts-cover-visual">
            <TraceTreeCover />
            <div className="ts-cover-index card">
              <KeyValueGrid rows={[
                ["scope", "topology + payload + usage", "本章范围"],
                ["identity", "trace_id / session_id / tags", "归组维度"],
                ["node", "span_id / parent_span_id", "父子链路"],
              ]} />
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="ts-scene scene-pad">
        <div className="ts-step-title">
          <div className="kicker">请求上下文</div>
          <h2>跨组件行为，归到同一次请求</h2>
        </div>
        <ContextRail />
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="ts-scene scene-pad">
        <div className="ts-step-title">
          <div className="kicker">拓扑结构</div>
          <h2>节点和父子关系一起留下来</h2>
        </div>
        <TopologyMap />
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="ts-scene scene-pad">
        <div className="ts-step-title">
          <div className="kicker">节点事实</div>
          <h2>输入、输出、状态、异常栈</h2>
        </div>
        <NodeInspector />
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className="ts-scene scene-pad">
        <div className="ts-step-title">
          <div className="kicker">节点语义</div>
          <h2>让分析系统看懂业务角色</h2>
        </div>
        <SemanticMatrix />
      </div>
    );
  }

  if (step === 5) {
    return (
      <div className="ts-scene scene-pad">
        <div className="ts-step-title">
          <div className="kicker">配置与资源</div>
          <h2>节点账本：性能、成本、质量信号</h2>
        </div>
        <NodeLedger />
      </div>
    );
  }

  return (
    <div className="ts-scene scene-pad">
      <div className="ts-step-title">
        <div className="kicker">追踪记录什么</div>
        <h2>请求级执行地图</h2>
      </div>
      <TraceTreeCover />
    </div>
  );
}
