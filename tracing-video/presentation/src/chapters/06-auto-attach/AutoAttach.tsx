import type { CSSProperties } from "react";
import type { ChapterStepProps } from "../../registry/types";
import "./AutoAttach.css";

const indexed = (index: number): CSSProperties => ({ "--i": index } as CSSProperties);

type CodeLine = {
  text: string;
  mark?: "accent" | "muted" | "return";
};

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
    <section className="aa-code-panel">
      <div className="aa-eyebrow">{eyebrow}</div>
      <h3>{title}</h3>
      <div className="aa-code-block">
        {lines.map((line, index) => (
          <code
            className={`aa-code-line ${line.mark ? `aa-code-line-${line.mark}` : ""}`}
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

function FactStrip({ rows }: { rows: Array<[string, string, string]> }) {
  return (
    <div className="aa-fact-strip">
      {rows.map(([label, value, hint], index) => (
        <div className="aa-fact-cell card" style={indexed(index)} key={label}>
          <span>{label}</span>
          <code>{value}</code>
          <small>{hint}</small>
        </div>
      ))}
    </div>
  );
}

function SceneTitle({
  kicker,
  title,
  note,
}: {
  kicker: string;
  title: string;
  note: string;
}) {
  return (
    <div className="aa-title">
      <div>
        <div className="aa-kicker">{kicker}</div>
        <h2>{title}</h2>
      </div>
      <p>{note}</p>
    </div>
  );
}

function InitAttachSvg() {
  const providers: Array<[string, string, number]> = [
    ["Tracing provider", "LazyTracingHook?", 276],
    ["内置 provider", "其它框架能力", 340],
    ["扩展 provider", "统一返回 hook[]", 404],
  ];

  return (
    <svg className="aa-init-svg" viewBox="0 0 900 510" role="img" aria-label="Flow 初始化时解析 provider 并注册 hook">
      <path className="aa-svg-line aa-line-a" d="M166 132 H310" />
      <path className="aa-svg-line aa-line-b" d="M500 132 H646" />
      <path className="aa-svg-line aa-line-c" d="M722 176 C722 250 612 314 456 354" />
      <path className="aa-svg-line aa-line-d" d="M456 354 C340 386 236 380 166 332" />

      <rect className="aa-svg-box aa-box-strong" x="34" y="78" width="132" height="108" />
      <text className="aa-svg-title" x="100" y="122" textAnchor="middle">Flow</text>
      <text className="aa-svg-copy" x="100" y="154" textAnchor="middle">__init__</text>

      <rect className="aa-svg-box aa-box-strong" x="310" y="76" width="190" height="112" />
      <text className="aa-svg-title" x="405" y="116" textAnchor="middle">resolve_builtin_hooks</text>
      <text className="aa-svg-copy" x="405" y="151" textAnchor="middle">汇总 provider 结果</text>

      <rect className="aa-svg-box aa-box-strong" x="646" y="76" width="182" height="112" />
      <text className="aa-svg-title" x="737" y="116" textAnchor="middle">register_hooks</text>
      <text className="aa-svg-copy" x="737" y="151" textAnchor="middle">写入 self._hooks</text>

      <rect className="aa-provider-frame" x="260" y="222" width="380" height="244" />
      <text className="aa-svg-copy" x="450" y="250" textAnchor="middle">_builtin_hook_providers</text>
      {providers.map(([name, value, y], index) => (
        <g className="aa-provider-row" style={indexed(index)} key={name}>
          <rect x="286" y={y} width="328" height="52" />
          <text className="aa-svg-code" x="314" y={y + 33}>{name}</text>
          <text className="aa-svg-copy" x="590" y={y + 33} textAnchor="end">{value}</text>
        </g>
      ))}

      <rect className="aa-svg-box aa-hook-store" x="48" y="286" width="178" height="108" />
      <text className="aa-svg-title" x="137" y="326" textAnchor="middle">self._hooks</text>
      <text className="aa-svg-code" x="137" y="361" textAnchor="middle">[LazyTracingHook]</text>

      <g className="aa-hook-pulse">
        <circle cx="737" cy="132" r="9" />
        <circle cx="405" cy="132" r="9" />
        <circle cx="137" cy="340" r="9" />
      </g>
    </svg>
  );
}

function BoundarySvg() {
  const stackNodes: Array<[string, string, number]> = [
    ["root", "Pipeline", 308],
    ["child", "Retriever", 366],
    ["child", "LLM", 424],
  ];

  return (
    <svg className="aa-boundary-svg" viewBox="0 0 980 560" role="img" aria-label="Flow 和 Module 都进入 execution_with_hooks 并维护调用栈">
      <path className="aa-svg-line aa-line-a" d="M212 126 H370" />
      <path className="aa-svg-line aa-line-b" d="M610 126 H768" />
      <path className="aa-svg-line aa-line-c" d="M370 126 C458 126 458 366 546 366" />
      <path className="aa-svg-line aa-line-d" d="M768 126 C826 214 780 366 658 366" />
      <path className="aa-svg-line aa-line-e" d="M546 366 H658" />

      <rect className="aa-svg-box aa-box-strong" x="46" y="70" width="166" height="112" />
      <text className="aa-svg-title" x="129" y="112" textAnchor="middle">Flow.__call__</text>
      <text className="aa-svg-code" x="129" y="148" textAnchor="middle">@execution_with_hooks</text>

      <rect className="aa-svg-box aa-box-strong" x="370" y="70" width="240" height="112" />
      <text className="aa-svg-title" x="490" y="110" textAnchor="middle">globals.stack_enter</text>
      <text className="aa-svg-copy" x="490" y="148" textAnchor="middle">维护 Flow 调用层级</text>

      <rect className="aa-svg-box aa-box-strong" x="768" y="70" width="166" height="112" />
      <text className="aa-svg-title" x="851" y="112" textAnchor="middle">Module.__call__</text>
      <text className="aa-svg-code" x="851" y="148" textAnchor="middle">_call_impl</text>

      <rect className="aa-stack-frame" x="310" y="244" width="360" height="244" />
      <text className="aa-svg-title" x="490" y="282" textAnchor="middle">framework call stack</text>
      {stackNodes.map(([role, name, y], index) => (
        <g className="aa-stack-node" style={indexed(index)} key={`${role}-${name}`}>
          <rect x={350 + index * 32} y={y} width="252" height="50" />
          <text className="aa-svg-code" x={376 + index * 32} y={y + 31}>{role}</text>
          <text className="aa-svg-copy" x={578 + index * 32} y={y + 31} textAnchor="end">{name}</text>
        </g>
      ))}

      <rect className="aa-svg-box aa-hook-engine" x="392" y="492" width="196" height="46" />
      <text className="aa-svg-code" x="490" y="522" textAnchor="middle">parent_span_id 来自栈</text>
    </svg>
  );
}

function BoundaryLedger() {
  const rows: Array<[string, string, string]> = [
    ["Flow", "@execution_with_hooks", "进入通用 hook 调度"],
    ["Flow", "globals.stack_enter(...)", "写入当前调用层级"],
    ["Flow", "_run(...) -> _post_process", "业务执行不改入口"],
    ["Module", "execution_with_hooks(self,...)", "复用同一套边界"],
    ["Module", "self._call_impl", "真实执行被包进去"],
    ["Tracing", "parent_span_id", "从框架调用栈推导"],
  ];

  return (
    <div className="aa-ledger">
      <div className="aa-ledger-head">
        <span>对象</span>
        <span>边界</span>
        <span>追踪含义</span>
      </div>
      {rows.map(([target, boundary, meaning], index) => (
        <div className="aa-ledger-row" style={indexed(index)} key={`${target}-${boundary}`}>
          <strong>{target}</strong>
          <code>{boundary}</code>
          <span>{meaning}</span>
        </div>
      ))}
    </div>
  );
}

function ProviderGateSvg() {
  const lifecycle = ["pre", "post", "error", "finalize"];

  return (
    <svg className="aa-provider-svg" viewBox="0 0 940 520" role="img" aria-label="provider 判断 trace_enabled 和模块规则后返回 LazyTracingHook">
      <path className="aa-svg-line aa-line-a" d="M104 108 H280" />
      <path className="aa-svg-line aa-line-b" d="M426 108 H604" />
      <path className="aa-svg-line aa-line-c" d="M750 108 H858" />
      <path className="aa-svg-line aa-line-d aa-line-muted" d="M350 162 C350 224 190 232 190 298" />
      <path className="aa-svg-line aa-line-e aa-line-muted" d="M676 162 C676 224 506 232 506 298" />
      <path className="aa-svg-line aa-line-f" d="M858 108 C892 172 848 224 760 246" />

      <rect className="aa-svg-box aa-box-strong" x="28" y="62" width="152" height="92" />
      <text className="aa-svg-title" x="104" y="100" textAnchor="middle">obj</text>
      <text className="aa-svg-copy" x="104" y="128" textAnchor="middle">Flow / Module</text>

      <g className="aa-decision-node" style={indexed(0)}>
        <rect x="280" y="48" width="146" height="120" />
        <text className="aa-svg-code" x="353" y="96" textAnchor="middle">trace_enabled</text>
        <text className="aa-svg-copy" x="353" y="130" textAnchor="middle">全局开关</text>
      </g>
      <g className="aa-decision-node" style={indexed(1)}>
        <rect x="604" y="48" width="146" height="120" />
        <text className="aa-svg-code" x="677" y="96" textAnchor="middle">module rule</text>
        <text className="aa-svg-copy" x="677" y="130" textAnchor="middle">模块级关闭</text>
      </g>
      <rect className="aa-svg-box aa-box-strong" x="858" y="70" width="54" height="76" />
      <text className="aa-svg-title" x="885" y="116" textAnchor="middle">pass</text>

      <rect className="aa-return-empty" x="94" y="298" width="192" height="70" />
      <text className="aa-svg-code" x="190" y="326" textAnchor="middle">return []</text>
      <text className="aa-svg-copy" x="190" y="352" textAnchor="middle">不挂 Tracing</text>

      <rect className="aa-return-empty" x="410" y="298" width="192" height="70" />
      <text className="aa-svg-code" x="506" y="326" textAnchor="middle">return []</text>
      <text className="aa-svg-copy" x="506" y="352" textAnchor="middle">模块规则关闭</text>

      <rect className="aa-svg-box aa-hook-result" x="656" y="232" width="208" height="82" />
      <text className="aa-svg-code" x="760" y="268" textAnchor="middle">[LazyTracingHook]</text>
      <text className="aa-svg-copy" x="760" y="294" textAnchor="middle">后续调用进入生命周期</text>

      <g className="aa-life-track">
        <path d="M214 430 H732" />
        {lifecycle.map((stage, index) => (
          <g className="aa-life-node" style={indexed(index)} key={stage}>
            <circle cx={246 + index * 150} cy="430" r="36" />
            <text className="aa-svg-code" x={246 + index * 150} y="437" textAnchor="middle">{stage}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

function GateMatrix() {
  const rows: Array<[string, string, string, "stop" | "go"]> = [
    ["全局开关", "config['trace_enabled']", "False 时 provider 直接返回空列表", "stop"],
    ["对象主体", "_unwrap_trace_subject(obj)", "先把包装对象还原成真实模块", "go"],
    ["模块规则", "resolve_default_module_trace(...)", "命中关闭时同样返回空列表", "stop"],
    ["通过后", "return [LazyTracingHook]", "调用才会进入 pre/post/error/finalize", "go"],
  ];

  return (
    <div className="aa-gate-matrix">
      {rows.map(([label, code, hint, state], index) => (
        <div className={`aa-gate-row aa-gate-row-${state}`} style={indexed(index)} key={label}>
          <span>{label}</span>
          <code>{code}</code>
          <small>{hint}</small>
        </div>
      ))}
    </div>
  );
}

function InitStep() {
  return (
    <div className="aa-scene aa-scene-init scene-pad">
      <SceneTitle
        kicker="默认观测接入点"
        title="Flow 初始化时，把 provider 解析成默认 hook"
        note="Tracing 不是业务代码显式调用的新入口，而是内置 provider 在对象构造阶段返回的一种能力。"
      />
      <div className="aa-init-layout">
        <CodePanel
          eyebrow="article §3.2.1 / §3.3.1"
          title="构造阶段先决定后续调用会不会被观察"
          lines={[
            { text: "class LazyLLMFlowsBase(...):", mark: "muted" },
            { text: "    def __init__(...):", mark: "muted" },
            { text: "        self._hooks = []" },
            { text: "        register_hooks(self, resolve_builtin_hooks(self))", mark: "accent" },
            { text: "" },
            { text: "def resolve_builtin_hooks(obj):", mark: "muted" },
            { text: "    hooks = []" },
            { text: "    for provider in _builtin_hook_providers:", mark: "accent" },
            { text: "        hooks.extend(provider(obj) or [])" },
            { text: "    return hooks", mark: "return" },
          ]}
        />
        <div className="aa-init-visual">
          <InitAttachSvg />
        </div>
        <FactStrip
          rows={[
            ["注册时机", "Flow.__init__", "对象一建好，默认 hook 集合已经挂上"],
            ["能力来源", "_builtin_hook_providers", "Tracing 只是 provider 列表里的一个回答"],
            ["执行结果", "self._hooks", "后续调用边界复用这组 hook"],
          ]}
        />
      </div>
    </div>
  );
}

function BoundaryStep() {
  return (
    <div className="aa-scene aa-scene-boundary scene-pad">
      <SceneTitle
        kicker="统一执行链"
        title="Flow 和 Module 的调用边界，都进 execution_with_hooks"
        note="父子关系来自框架维护的调用层级；业务 pipeline 不需要手写 trace_id 或 parent_span_id。"
      />
      <div className="aa-boundary-layout">
        <div className="aa-boundary-visual">
          <BoundarySvg />
        </div>
        <CodePanel
          eyebrow="边界代码"
          title="两个入口，落到同一个 hook 调度骨架"
          lines={[
            { text: "@execution_with_hooks", mark: "accent" },
            { text: "def __call__(self, ...):" },
            { text: "    with globals.stack_enter(self.identities):", mark: "accent" },
            { text: "        output = self._run(...)" },
            { text: "    return self._post_process(output)" },
            { text: "" },
            { text: "def __call__(self, ...):", mark: "muted" },
            { text: "    return execution_with_hooks(self, ...)", mark: "accent" },
            { text: "        (self._call_impl)(...)" },
          ]}
        />
        <BoundaryLedger />
      </div>
    </div>
  );
}

function ProviderStep() {
  return (
    <div className="aa-scene aa-scene-provider scene-pad">
      <SceneTitle
        kicker="provider 门禁"
        title="先判断要不要挂 Tracing，再决定生命周期是否存在"
        note="全局关闭或模块规则关闭，provider 都返回空列表；只有通过门禁，后续调用才会触发 LazyTracingHook。"
      />
      <div className="aa-provider-layout">
        <CodePanel
          eyebrow="resolve_tracing_hooks"
          title="不在业务类里分散判断，统一收敛到 provider"
          lines={[
            { text: "def resolve_tracing_hooks(obj):", mark: "muted" },
            { text: "    if not config['trace_enabled']:", mark: "accent" },
            { text: "        return []", mark: "return" },
            { text: "" },
            { text: "    subject = _unwrap_trace_subject(obj)" },
            { text: "    if hasattr(subject, '_module_id') \\", mark: "accent" },
            { text: "       and not resolve_default_module_trace(...):", mark: "accent" },
            { text: "        return []", mark: "return" },
            { text: "" },
            { text: "    return [LazyTracingHook]", mark: "accent" },
          ]}
        />
        <div className="aa-provider-visual">
          <ProviderGateSvg />
        </div>
        <GateMatrix />
      </div>
    </div>
  );
}

export default function AutoAttachChapter({ step }: ChapterStepProps) {
  if (step === 0) {
    return <InitStep />;
  }

  if (step === 1) {
    return <BoundaryStep />;
  }

  if (step === 2) {
    return <ProviderStep />;
  }

  return <InitStep />;
}
