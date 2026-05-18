import type { CSSProperties } from "react";
import type { ChapterStepProps } from "../../registry/types";
import "./HookCaptureSemantics.css";

const indexed = (index: number): CSSProperties => ({ "--i": index } as CSSProperties);
const weighted = (value: string): CSSProperties => ({ "--w": value } as CSSProperties);

function CodeLine({ text, index }: { text: string; index: number }) {
  return (
    <div className="hc-code-line" style={indexed(index)}>
      <code>{text}</code>
    </div>
  );
}

function TitleBlock({
  kicker,
  title,
  aside,
}: {
  kicker: string;
  title: string;
  aside: string;
}) {
  return (
    <div className="hc-title">
      <div>
        <div className="kicker">{kicker}</div>
        <h2>{title}</h2>
      </div>
      <p>{aside}</p>
    </div>
  );
}

function LifecycleRing() {
  const hooks = [
    ["pre_hook", "门禁", "读 LazyTraceContext", "enabled / sampled / module"],
    ["post_hook", "成功", "回写成功结果", "output / usage / duration"],
    ["on_error", "异常", "记录异常事实", "exception / stack / status"],
    ["finalize", "收尾", "统一结束处理", "remove_probe / finish_span"],
  ];
  return (
    <div className="hc-lifecycle">
      <div className="hc-lifecycle-map">
        <svg viewBox="0 0 820 560" role="img" aria-label="LazyTracingHook 生命周期">
          <path className="hc-ring-path" d="M410 100 C570 100 700 230 700 390 C700 475 630 515 520 515" />
          <path className="hc-ring-path hc-alt" d="M300 515 C190 515 120 475 120 390 C120 230 250 100 410 100" />
          <path className="hc-state-line" d="M160 275 H660" />
          {[
            ["pre_hook", 410, 100],
            ["post_hook", 700, 390],
            ["on_error", 120, 390],
            ["finalize", 410, 515],
          ].map(([label, x, y], index) => (
            <g className="hc-hook-node" style={indexed(index)} key={label}>
              <rect x={Number(x) - 90} y={Number(y) - 36} width="180" height="72" />
              <text x={Number(x)} y={Number(y) + 8} textAnchor="middle">
                {label}
              </text>
            </g>
          ))}
          {[
            ["未建节点", 160, 275],
            ["ACTIVE", 330, 275],
            ["OK / ERROR", 500, 275],
            ["FINISHED", 660, 275],
          ].map(([label, x, y], index) => (
            <g className="hc-state-node" style={indexed(index)} key={label}>
              <circle cx={Number(x)} cy={Number(y)} r="18" />
              <text x={Number(x)} y={Number(y) + 50} textAnchor="middle">
                {label}
              </text>
            </g>
          ))}
        </svg>
        <div className="hc-span-ledger">
          {["span = null", "start_span(...)", "set_span_output / set_span_error", "finish_span(...)"].map((item, index) => (
            <CodeLine text={item} index={index} key={item} />
          ))}
        </div>
      </div>
      <div className="hc-hook-table">
        {hooks.map(([name, state, action, attrs], index) => (
          <div className="hc-hook-row card" style={indexed(index)} key={name}>
            <code>{name}</code>
            <span>{state}</span>
            <strong>{action}</strong>
            <small>{attrs}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProbeCapture() {
  const rows = [
    ["nodes[0]", "source_id=doc_41", "score=0.91", "召回命中"],
    ["nodes[1]", "source_id=doc_18", "score=0.76", "候选保留"],
    ["rerank[0]", "source_id=doc_41", "score=0.88", "排序回写"],
    ["rerank[1]", "source_id=doc_03", "score=0.61", "低质暴露"],
  ];
  return (
    <div className="hc-probe">
      <div className="hc-probe-flow">
        <div className="hc-flow-step card" style={indexed(0)}>
          <span>调用开始</span>
          <code>pre_hook</code>
          <strong>安装 probe</strong>
        </div>
        <svg viewBox="0 0 660 210" role="img" aria-label="probe 补采流程">
          <path className="hc-probe-line" d="M58 105 H230 C280 105 280 45 330 45 H602" />
          <path className="hc-probe-line hc-second" d="M58 105 H230 C280 105 280 165 330 165 H602" />
          <g className="hc-probe-node" style={indexed(0)}>
            <rect x="255" y="16" width="150" height="58" />
            <text x="330" y="52" textAnchor="middle">Retriever</text>
          </g>
          <g className="hc-probe-node" style={indexed(1)}>
            <rect x="255" y="136" width="150" height="58" />
            <text x="330" y="172" textAnchor="middle">Reranker</text>
          </g>
          <g className="hc-probe-node hc-span-target" style={indexed(2)}>
            <rect x="492" y="76" width="138" height="58" />
            <text x="561" y="112" textAnchor="middle">span 属性</text>
          </g>
        </svg>
        <div className="hc-flow-step card" style={indexed(1)}>
          <span>后处理出现</span>
          <code>nodes / score</code>
          <strong>补采质量信号</strong>
        </div>
      </div>
      <div className="hc-probe-board">
        <section className="hc-probe-copy">
          <div className="hc-big-label">Retriever/Reranker probe</div>
          <p>不是只证明“被调用过”，而是把候选节点、source id、召回分数和重排分数挂回同一个 span。</p>
          <div className="hc-quality-bars">
            {[
              ["召回覆盖", "91%"],
              ["重排置信", "88%"],
              ["低质候选", "61%"],
            ].map(([label, value], index) => (
              <div className="hc-quality-bar" style={{ ...indexed(index), ...weighted(value) }} key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <i />
              </div>
            ))}
          </div>
        </section>
        <section className="hc-node-table card">
          <div className="hc-node-head">
            <span>节点</span>
            <span>source id</span>
            <span>score</span>
            <span>意义</span>
          </div>
          {rows.map(([node, source, score, meaning], index) => (
            <div className="hc-node-row" style={indexed(index)} key={`${node}-${source}`}>
              <code>{node}</code>
              <code>{source}</code>
              <code>{score}</code>
              <strong>{meaning}</strong>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function CaptureGate() {
  const gates = [
    {
      title: "请求能否建节点",
      code: "trace_enabled && sampled",
      note: "决定 Trace 是否存在",
      facts: ["globals.trace.enabled", "config.trace_enabled", "sampled !== False"],
    },
    {
      title: "模块能否记录",
      code: "module_trace.by_name",
      note: "决定当前目标是否接入",
      facts: ["default_module_trace", "by_class / by_name", "runtime_disabled"],
    },
    {
      title: "payload 是否留存",
      code: "debug_capture_payload > trace_content_enabled",
      note: "只决定 input/output 粒度",
      facts: ["ctx.debug_capture_payload", "TRACE_CONTENT_ENABLED", "脱敏但保留 span"],
    },
  ];
  return (
    <div className="hc-gates">
      <div className="hc-gate-pipeline">
        {gates.map((gate, index) => (
          <section className="hc-gate card" style={indexed(index)} key={gate.title}>
            <div className="hc-gate-num hero-num">0{index + 1}</div>
            <h3>{gate.title}</h3>
            <code>{gate.code}</code>
            <p>{gate.note}</p>
            <ul>
              {gate.facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="hc-priority-strip">
        <svg viewBox="0 0 1520 220" role="img" aria-label="采集控制优先级">
          <path className="hc-priority-path" d="M90 110 H480 H760 H1060 H1430" />
          {[
            ["请求", 110],
            ["模块", 560],
            ["payload", 1010],
            ["保留节点", 1380],
          ].map(([label, x], index) => (
            <g className="hc-priority-node" style={indexed(index)} key={label}>
              <rect x={Number(x) - 86} y="69" width="172" height="82" />
              <text x={Number(x)} y="118" textAnchor="middle">{label}</text>
            </g>
          ))}
        </svg>
        <div className="hc-policy-note">
          <strong>payload 不应该决定链路是否存在</strong>
          <code>span_id / status / latency / error / semantic_type</code>
        </div>
      </div>
    </div>
  );
}

function SemanticCompletion() {
  const matrix = [
    ["OnlineModule", "_collect_llm_trace_config", "llm", "model / usage"],
    ["Retriever", "_collect_retriever_trace_config", "retriever", "source_id / score"],
    ["Reranker", "_collect_reranker_trace_config", "rerank", "rank / score"],
    ["Flow", "_collect_flow_trace_config", "workflow_control", "branch"],
    ["Agent", "_collect_agent_trace_config", "agent", "loop_count / tool_call"],
  ];
  return (
    <div className="hc-semantic">
      <section className="hc-semantic-code card">
        <CodeLine text="cfg = collect_trace_config(target)" index={0} />
        <CodeLine text="semantic = resolve_semantic_type_for_target(target)" index={1} />
        <CodeLine text="attrs.update(output_properties)" index={2} />
        <div className="hc-code-result">
          <span>统一分析字段</span>
          <code>score/branch/loop_count</code>
        </div>
      </section>
      <section className="hc-semantic-matrix">
        <div className="hc-matrix-head">
          <span>目标对象</span>
          <span>配置补全</span>
          <span>语义类型</span>
          <span>输出属性</span>
        </div>
        {matrix.map(([target, config, semantic, output], index) => (
          <div className="hc-matrix-row card" style={indexed(index)} key={target}>
            <strong>{target}</strong>
            <code>{config}</code>
            <code>{semantic}</code>
            <span>{output}</span>
          </div>
        ))}
      </section>
      <section className="hc-semantic-bus">
        <svg viewBox="0 0 1500 230" role="img" aria-label="语义补全进入分析">
          <path className="hc-bus-line" d="M72 115 H390 C470 115 470 56 550 56 H1420" />
          <path className="hc-bus-line hc-lower" d="M390 115 C470 115 470 174 550 174 H1420" />
          {[
            ["配置", 140, 115],
            ["语义", 620, 56],
            ["质量", 620, 174],
            ["批量分析", 1320, 115],
          ].map(([label, x, y], index) => (
            <g className="hc-bus-node" style={indexed(index)} key={label}>
              <rect x={Number(x) - 82} y={Number(y) - 34} width="164" height="68" />
              <text x={Number(x)} y={Number(y) + 8} textAnchor="middle">{label}</text>
            </g>
          ))}
        </svg>
      </section>
    </div>
  );
}

export default function HookCaptureSemanticsChapter({ step }: ChapterStepProps) {
  if (step === 0) {
    return (
      <div className="hc-scene scene-pad">
        <TitleBlock
          kicker="第 7 章 · 生命周期、采集顺序、语义补全"
          title="LazyTracingHook 的生命周期把 span 收口"
          aside="统一调度只负责分支，Tracing 语义在 hook 内完成：建节点、回写、记错、结束。"
        />
        <LifecycleRing />
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="hc-scene scene-pad">
        <TitleBlock
          kicker="后处理补采"
          title="probe 把召回质量补回 span"
          aside="Retriever / Reranker 的关键结果经常晚于调用开始出现，probe 负责等 nodes 和 score 落地。"
        />
        <ProbeCapture />
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="hc-scene scene-pad">
        <TitleBlock
          kicker="采集门禁"
          title="先决定链路存在，再决定内容粒度"
          aside="请求级、模块级、payload 级三层控制必须按固定顺序生效，避免把脱敏误解成断链。"
        />
        <CaptureGate />
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="hc-scene scene-pad">
        <TitleBlock
          kicker="语义与属性补全"
          title="节点要能被批量分析，而不是只存 input/output"
          aside="配置、语义和输出属性一起进入 span，后续才能按业务角色聚合和评估。"
        />
        <SemanticCompletion />
      </div>
    );
  }

  return (
    <div className="hc-scene scene-pad">
      <TitleBlock
        kicker="生命周期、采集顺序、语义补全"
        title="LazyTracingHook 的生命周期把 span 收口"
        aside="pre_hook / post_hook / on_error / finalize"
      />
      <LifecycleRing />
    </div>
  );
}
