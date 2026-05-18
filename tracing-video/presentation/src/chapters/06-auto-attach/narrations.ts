import type { Narration } from "../../registry/types";

export const narrations: Narration[] = [
  "默认观测能自动挂上去，是因为 LazyLLM 已经有统一执行链。\n\nFlow 初始化时会调用 register_hooks(self, resolve_builtin_hooks(self))。\n\nresolve_builtin_hooks 根据对象和运行配置返回内置 hook 列表，Tracing 只是其中一种 provider 能力。",
  "Flow 和 Module 的调用边界会统一进 hook。\n\nFlow 执行走 execution_with_hooks，同时 globals.stack_enter(...) 维护调用层级。\n\nModule 的 __call__ 也会把 _call_impl 包进 execution_with_hooks(...)。\n\n所以父子关系来自框架调用栈，不靠业务代码手写。",
  "provider 会先判断要不要挂 Tracing。\n\n全局 trace_enabled 关了，不返回 hook。\n\n模块规则命中关闭，也不返回。\n\n通过判断后才返回 [LazyTracingHook]，后续调用才会进入 pre、post、error、finalize 生命周期。",
];
