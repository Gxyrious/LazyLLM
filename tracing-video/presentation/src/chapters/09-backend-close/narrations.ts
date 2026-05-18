import type { Narration } from "../../registry/types";

export const narrations: Narration[] = [
  "Backend 层隔离写入目标。\n\n上游只产出标准 span 和属性。\n\n写到 Langfuse OTLP，还是写到本地 JSONL，都不应该影响 Hook、LazySpan 和 OpenTelemetry 生命周期。\n\n消费后端再从已有观测数据读回统一载荷，供分析系统继续使用。",
  "`TracingBackend` 主要抽象两个能力。\n\n`build_exporter` 构造写入通道，决定 span 最终写到 Langfuse OTLP，还是本地 JSONL。\n\n`map_attributes` 把 LazyLLM 的通用字段适配成后端字段。\n\n新增后端时，核心改动应该集中在这里，而不是回头改运行层和 hook 层。",
  "最后把主线收回来。\n\nHook 负责接入执行链。\n\nLazySpan 记录节点事实。\n\nOpenTelemetry 负责父子关系和上下文传播。\n\nBackend 负责落地和字段映射。\n\n这四层不混，排障、评估和回归对比才能共用同一套 Trace。",
];
