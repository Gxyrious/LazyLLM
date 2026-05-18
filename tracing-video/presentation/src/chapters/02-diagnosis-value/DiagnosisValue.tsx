import type { CSSProperties } from "react";
import type { ChapterStepProps } from "../../registry/types";
import "./DiagnosisValue.css";

const indexed = (index: number): CSSProperties => ({ "--i": index } as CSSProperties);

const meter = (width: string, index: number): CSSProperties =>
  ({ "--w": width, "--i": index } as CSSProperties);

function FieldRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="dv-field-rows">
      {rows.map(([label, value], index) => (
        <div className="dv-field-row" style={indexed(index)} key={`${label}-${value}`}>
          <span>{label}</span>
          <code>{value}</code>
        </div>
      ))}
    </div>
  );
}

function SceneTitle({ eyebrow, title, note }: { eyebrow: string; title: string; note: string }) {
  return (
    <section className="dv-title-block">
      <div className="dv-eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
      <p>{note}</p>
    </section>
  );
}

function RagPipeline() {
  const milestones: Array<[string, string, number]> = [
    ["query", "用户问题", 90],
    ["retriever", "召回证据", 430],
    ["reranker", "候选排序", 760],
    ["llm", "生成答案", 1090],
  ];
  const stages: Array<{
    name: string;
    cn: string;
    duration: string;
    rows: Array<[string, string]>;
    meter: string;
  }> = [
    {
      name: "Retriever",
      cn: "检索器",
      duration: "184ms",
      rows: [
        ["输入", "query + Top-K"],
        ["参数", "topk=3 · bm25_chinese"],
        ["输出", "chunk[] + source_id"],
        ["判断", "是否召回正确知识"],
      ],
      meter: "24%",
    },
    {
      name: "Reranker",
      cn: "重排器",
      duration: "76ms",
      rows: [
        ["输入", "candidate chunks"],
        ["字段", "score · rank · cutoff"],
        ["输出", "ordered candidates"],
        ["判断", "候选是否被排坏"],
      ],
      meter: "12%",
    },
    {
      name: "LLM",
      cn: "大模型",
      duration: "1260ms",
      rows: [
        ["输入", "prompt + context_str"],
        ["字段", "answer · token usage"],
        ["输出", "final answer"],
        ["判断", "是否正确利用上下文"],
      ],
      meter: "82%",
    },
  ];

  return (
    <div className="dv-rag-layout">
      <div className="dv-rag-spine" aria-hidden="true">
        <svg viewBox="0 0 1180 190" role="img" aria-label="RAG 三段诊断链路">
          <path className="dv-rag-path dv-rag-path-a" d="M90 96 H430" />
          <path className="dv-rag-path dv-rag-path-b" d="M430 96 H760" />
          <path className="dv-rag-path dv-rag-path-c" d="M760 96 H1090" />
          {milestones.map(([label, hint, x], index) => (
            <g className="dv-rag-dot" style={indexed(index)} key={label}>
              <circle cx={x} cy="96" r="12" />
              <circle className="dv-rag-dot-pulse" cx={x} cy="96" r="28" />
              <text className="dv-rag-dot-label" x={x} y="56" textAnchor="middle">{label}</text>
              <text className="dv-rag-dot-hint" x={x} y="136" textAnchor="middle">{hint}</text>
            </g>
          ))}
        </svg>
        <div className="dv-trace-root card">
          <span>一条 Trace</span>
          <code>{"trace_id -> retriever / reranker"}</code>
          <strong>在同一棵树里对齐</strong>
        </div>
      </div>
      <div className="dv-rag-cards">
        {stages.map((stage, index) => (
          <article className="dv-rag-card card" style={indexed(index)} key={stage.name}>
            <div className="dv-stage-head">
              <div>
                <span>{stage.cn}</span>
                <strong>{stage.name}</strong>
              </div>
              <code>{stage.duration}</code>
            </div>
            <FieldRows rows={stage.rows} />
            <div className="dv-duration-bar" style={meter(stage.meter, index)}>
              <i />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function EvidenceMatrix() {
  const columns = [
    {
      title: "未召回",
      symptom: "answer 缺关键事实",
      evidence: "retriever.chunks[] 不含目标 source_id",
      signals: [
        ["query", "是否被改写偏航"],
        ["top_k", "召回窗口是否过窄"],
        ["source_id", "目标文档是否缺失"],
      ],
      inspect: ["索引是否完整", "chunk 是否切碎", "Top-K / similarity 是否过窄"],
      next: "先查 Retriever",
    },
    {
      title: "上下文未利用",
      symptom: "context_str 已有正确知识",
      evidence: "LLM.answer 仍偏离证据",
      signals: [
        ["context_str", "正确事实已进入上下文"],
        ["prompt", "证据位置和约束是否清楚"],
        ["answer", "是否背离引用内容"],
      ],
      inspect: ["prompt 位置", "context_str 拼接", "模型输出约束"],
      next: "再查 Prompt / LLM",
    },
    {
      title: "重排异常",
      symptom: "候选里有正确 chunk",
      evidence: "reranker score 后排名下滑",
      signals: [
        ["before_rank", "召回阶段原始排名"],
        ["score_delta", "重排后分差变化"],
        ["after_rank", "正确 chunk 是否被压低"],
      ],
      inspect: ["score_delta", "cutoff / top_n", "before / after rank"],
      next: "回看 Reranker",
    },
  ];

  return (
    <div className="dv-evidence">
      <div className="dv-answer-strip card">
        <span>最终 answer</span>
        <strong>只告诉你结果错了，不告诉你错在哪里</strong>
        <code>root cause = evidence path</code>
      </div>
      <div className="dv-evidence-grid">
        {columns.map((column, index) => (
          <article className="dv-evidence-card card" style={indexed(index)} key={column.title}>
            <div className="dv-evidence-top">
              <span>{column.title}</span>
              <strong>{column.next}</strong>
            </div>
            <div className="dv-evidence-line" aria-hidden="true" />
            <FieldRows
              rows={[
                ["现象", column.symptom],
                ["证据", column.evidence],
              ]}
            />
            <div className="dv-evidence-signals">
              {column.signals.map(([label, detail], signalIndex) => (
                <div className="dv-evidence-signal" style={indexed(signalIndex)} key={label}>
                  <code>{label}</code>
                  <span>{detail}</span>
                </div>
              ))}
            </div>
            <ul className="dv-check-list">
              {column.inspect.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <svg className="dv-evidence-rail" viewBox="0 0 1360 130" role="img" aria-label="错误归因证据路径">
        <path className="dv-evidence-path dv-evidence-path-a" d="M150 92 C300 50 430 50 548 92" />
        <path className="dv-evidence-path dv-evidence-path-b" d="M548 92 C680 50 820 50 948 92" />
        <path className="dv-evidence-path dv-evidence-path-c" d="M948 92 C1080 50 1200 50 1260 92" />
        <text x="680" y="42" textAnchor="middle">证据路径先分叉，再归因</text>
      </svg>
    </div>
  );
}

function AgentTrace() {
  const events = [
    ["model_output", "action=search_docs", "模型为什么选工具"],
    ["tool_call_id", "call_7f31", "把调用和返回配对"],
    ["tool_args", "{ query, top_k }", "检查参数是否偏航"],
    ["tool_return", "{ chunks, status }", "确认工具真实返回"],
    ["state_patch", "observation 写回", "下一轮能否看到结果"],
    ["loop_count", "4 -> 5 -> 6", "重复动作的报警字段"],
  ];

  return (
    <div className="dv-agent-layout">
      <div className="dv-agent-orbit card">
        <svg viewBox="0 0 720 560" role="img" aria-label="Agent 工具调用循环">
          <path className="dv-loop-ring" d="M360 88 C500 88 600 190 600 314 C600 440 500 486 360 486 C220 486 120 440 120 314 C120 190 220 88 360 88" />
          {[
            ["模型输出", "model_output", 360, 88],
            ["工具参数", "tool_args", 600, 314],
            ["工具返回", "tool_return", 360, 486],
            ["状态回填", "observation", 120, 314],
          ].map(([label, code, x, y], index) => (
            <g className="dv-loop-node" style={indexed(index)} key={String(code)}>
              <rect x={Number(x) - 92} y={Number(y) - 42} width="184" height="84" />
              <text x={Number(x)} y={Number(y) - 6} textAnchor="middle">{label}</text>
              <text className="dv-loop-code" x={Number(x)} y={Number(y) + 22} textAnchor="middle">{code}</text>
            </g>
          ))}
          <g className="dv-loop-center">
            <rect x="238" y="232" width="244" height="132" />
            <text x="360" y="282" textAnchor="middle">tool_call_id</text>
            <text className="dv-loop-code" x="360" y="318" textAnchor="middle">call_7f31</text>
          </g>
        </svg>
        <div className="dv-loop-meter">
          <span>loop_count</span>
          <strong>06</strong>
          <div><i /></div>
        </div>
      </div>
      <div className="dv-agent-ledger">
        {events.map(([field, value, hint], index) => (
          <div className="dv-agent-row card" style={indexed(index)} key={field}>
            <span>{field}</span>
            <code>{value}</code>
            <strong>{hint}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function WaterfallAggregation() {
  const bars = [
    ["Retriever", "文档读取 / 向量库", "220ms", "0%", "18%"],
    ["Reranker", "候选排序", "90ms", "18%", "8%"],
    ["LLM", "推理 / token", "1180ms", "26%", "58%"],
    ["Flow", "分支重复", "310ms", "74%", "17%"],
  ];
  const tags = [
    ["session_id", "同一对话回放"],
    ["user_id", "用户维度聚合"],
    ["request_tags", "rag / prod / debug"],
    ["prompt_version", "提示词回归"],
    ["model_version", "底座切换"],
    ["flow_version", "流程改动"],
  ];
  const compare = [
    ["Logging", "离散事件", "发生过什么"],
    ["Metrics", "聚合趋势", "整体是否变慢"],
    ["Tracing", "请求链路", "哪一层导致退化"],
  ];

  return (
    <div className="dv-ops-layout">
      <section className="dv-waterfall card">
        <div className="dv-panel-head">
          <span>Waterfall</span>
          <strong>总耗时拆成节点 duration</strong>
        </div>
        <div className="dv-waterfall-plot">
          {bars.map(([name, hint, duration, left, width], index) => (
            <div className="dv-waterfall-row" style={indexed(index)} key={name}>
              <span>{name}</span>
              <div className="dv-waterfall-track">
                <i style={{ "--l": left, "--w": width } as CSSProperties} />
              </div>
              <code>{duration}</code>
              <small>{hint}</small>
            </div>
          ))}
        </div>
      </section>
      <section className="dv-aggregation card">
        <div className="dv-panel-head">
          <span>线上聚合</span>
          <strong>一批请求一起比较</strong>
        </div>
        <div className="dv-tag-grid">
          {tags.map(([name, hint], index) => (
            <div className="dv-tag-cell" style={indexed(index)} key={name}>
              <code>{name}</code>
              <span>{hint}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="dv-observe card">
        <div className="dv-panel-head">
          <span>三类观测</span>
          <strong>Trace 是排障骨架</strong>
        </div>
        <div className="dv-observe-grid">
          {compare.map(([name, scope, answer], index) => (
            <article className="dv-observe-card" style={indexed(index)} key={name}>
              <span>{name}</span>
              <code>{scope}</code>
              <strong>{answer}</strong>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function DiagnosisValue({ step }: ChapterStepProps) {
  if (step === 0) {
    return (
      <div className="dv-scene">
        <SceneTitle
          eyebrow="RAG 三段诊断"
          title="先拆链路，再判断根因"
          note="Retriever、Reranker、LLM 的输入、输出、耗时和判断字段，必须在同一条 Trace 里对齐。"
        />
        <RagPipeline />
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="dv-scene dv-scene-matrix">
        <SceneTitle
          eyebrow="错误归因矩阵"
          title="看证据路径，不只看最终 answer"
          note="同样是答错，根因可能在召回、上下文利用，也可能在重排顺序。"
        />
        <EvidenceMatrix />
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="dv-scene dv-scene-agent">
        <SceneTitle
          eyebrow="Agent 决策链"
          title="把工具调用和状态回填接起来看"
          note="模型输出、tool_call_id、参数、返回和 observation，要和 loop_count 一起对齐。"
        />
        <AgentTrace />
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="dv-scene dv-scene-ops">
        <SceneTitle
          eyebrow="性能与线上回归"
          title="Waterfall 看单次慢，标签看批量退化"
          note="节点 duration、请求标签、Prompt / 模型 / 流程版本一起进入 Trace，才能比较共同退化。"
        />
        <WaterfallAggregation />
      </div>
    );
  }

  return (
    <div className="dv-scene">
      <SceneTitle
        eyebrow="排障价值"
        title="技术证据先于经验猜测"
        note="Trace 把 RAG、Agent、性能和回归放到同一套请求事实里。"
      />
      <RagPipeline />
    </div>
  );
}
