import type { ChapterDef } from "./types";
import TraceScopeChapter from "../chapters/01-trace-scope/TraceScope";
import { narrations as traceScopeNarrations } from "../chapters/01-trace-scope/narrations";
import DiagnosisValueChapter from "../chapters/02-diagnosis-value/DiagnosisValue";
import { narrations as diagnosisValueNarrations } from "../chapters/02-diagnosis-value/narrations";
import LangfuseRagChapter from "../chapters/03-langfuse-rag/LangfuseRag";
import { narrations as langfuseRagNarrations } from "../chapters/03-langfuse-rag/narrations";
import ControlApiConfigChapter from "../chapters/04-control-api-config/ControlApiConfig";
import { narrations as controlApiConfigNarrations } from "../chapters/04-control-api-config/narrations";
import ArchitectureObjectsChapter from "../chapters/05-architecture-objects/ArchitectureObjects";
import { narrations as architectureObjectsNarrations } from "../chapters/05-architecture-objects/narrations";
import AutoAttachChapter from "../chapters/06-auto-attach/AutoAttach";
import { narrations as autoAttachNarrations } from "../chapters/06-auto-attach/narrations";
import HookCaptureSemanticsChapter from "../chapters/07-hook-capture-semantics/HookCaptureSemantics";
import { narrations as hookCaptureSemanticsNarrations } from "../chapters/07-hook-capture-semantics/narrations";
import OtelRuntimeChapter from "../chapters/08-otel-runtime/OtelRuntime";
import { narrations as otelRuntimeNarrations } from "../chapters/08-otel-runtime/narrations";
import BackendCloseChapter from "../chapters/09-backend-close/BackendClose";
import { narrations as backendCloseNarrations } from "../chapters/09-backend-close/narrations";

/**
 * Order = order of presentation.
 *
 * Each chapter MUST provide a `narrations: Narration[]` array. Its length
 * is the chapter's step count — there is no `totalSteps` to maintain
 * separately. This guarantees the audio synthesis pipeline, the runtime
 * stepper, and the chapter `.tsx` switch on `step` cannot drift apart.
 *
 * Visual styling (color, fonts) comes entirely from the active theme —
 * chapters never hard-code palette / font names. See THEMES.md.
 */
export const CHAPTERS: ChapterDef[] = [
  {
    id: "trace-scope",
    title: "追踪记录什么",
    narrations: traceScopeNarrations,
    Component: TraceScopeChapter,
  },
  {
    id: "diagnosis-value",
    title: "排障价值只讲技术点",
    narrations: diagnosisValueNarrations,
    Component: DiagnosisValueChapter,
  },
  {
    id: "langfuse-rag",
    title: "Langfuse 接入和默认 RAG 追踪",
    narrations: langfuseRagNarrations,
    Component: LangfuseRagChapter,
  },
  {
    id: "control-api-config",
    title: "请求上下文、入口和采集控制",
    narrations: controlApiConfigNarrations,
    Component: ControlApiConfigChapter,
  },
  {
    id: "architecture-objects",
    title: "分层架构和三类对象",
    narrations: architectureObjectsNarrations,
    Component: ArchitectureObjectsChapter,
  },
  {
    id: "auto-attach",
    title: "默认观测如何自动挂上去",
    narrations: autoAttachNarrations,
    Component: AutoAttachChapter,
  },
  {
    id: "hook-capture-semantics",
    title: "生命周期、采集顺序和语义补全",
    narrations: hookCaptureSemanticsNarrations,
    Component: HookCaptureSemanticsChapter,
  },
  {
    id: "otel-runtime",
    title: "OpenTelemetry 上下文和并发传播",
    narrations: otelRuntimeNarrations,
    Component: OtelRuntimeChapter,
  },
  {
    id: "backend-close",
    title: "后端抽象和收束",
    narrations: backendCloseNarrations,
    Component: BackendCloseChapter,
  },
];
