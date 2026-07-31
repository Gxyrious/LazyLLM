# 核心机制

> 基于OTel(OpenTelemetry)的SDK和底层hook机制，为LazyLLM添加观测功能，支持Module, Flow, Callable三种类型，并接入多种等观测后端系统

每个span都是通过自定义的`start_span()`来开启的，该函数中会调用`start_as_current_span`，并管理LazySpan和LazyTrace对象的创建，

1. `enable_trace()`针对Callable函数进行观测
2. `start_span`和`finish_span`在hook中被调用

# 思路整理

## 关键函数

### enable_trace和_run_with_trace

针对Callable函数（用户自定义函数）进行观测，Module和Flow是基于hook机制的，是统一的；而自定义函数则需要用装饰器包一层。

#### 难点

支持流式传输下的同步/异步生成器（async和yield），一般函数是“开-关”，而生成器则是“开-产-产-产...-关”，因此正常返回生成器后不能直接当作关闭span，该生成器还会反复`next()或yield`产生数据，这些数据也得被记录，所以就将`next()或yield`的操作封装一层wrapper，先恢复2类相关的上下文，再调用核心的`next()或yield`操作，再捕获相关输出和错误，最后还原旧上下文。

### start_span

`start_as_current_span(span_name, context=parent_context)`其中的`parent_context`是`opentelemetry.trace.SpanContext`类型，会有2种情况：

1. 为`None`，说明开户一个新的`trace_id`

2. 来自`opentelemetry.trace.set_span_in_context()`的返回值，此时上层已经提供`trace_id`

会利用`LazyTraceContext`类型的`trace_id`和`parent_span_id`，其中：

1. 用于构建`SpanContext`类型，需要传入`trace_id=trace_id`和`span_id=parent_span_id`作为参数，该对象用来传入`start_as_current_span()`

2. 调用`start_as_current_span()`后会得到新的`span_context`，从而`ctx.trace_id`和`ctx.parent_span_id`被重新赋值用于下一轮的`start_span`

创建自己的`LazySpan`对象用于

### finish_span

本来OTel的`start_as_current_span`应该是带着with调用的，会自动退出SpanContext，但是我们是用`ExitStack()`手动管理的，因此在`finish_span`的时候需要手动退出上下文。还有个`LazyTraceContext`的上下文需要我们手动保存和设置



## 关键类

### LazyTracingHook

1. `pre_hook()`

   判断是否开启观测，保留先前的`LazyTraceContext`上下文，调用`start_span()`生成新的Span

2. `post_hook()`

   记录正常运行情况下的各种输入输出信息，包括Token用量，耗时，LLM输出

3. `on_error()`

   `try-catch`的捕获异常时调用，将错误信息保存到观测系统中

4. `finalize()`

   必然触发，调用`finish_span()`退出当前的span上下文，手动还原先前的`LazyTraceContext`上下文。

#### 设计难点

有些观测数据在业务函数的最终输出中根本拿不到，必须去中间环节“劫持”才能抓到，例如：

1. Switch和IFS组件，他们所命中的分支在最终输出中是不可知的。解决方案：设置调用栈专有的一个临时存储，在Switch/IFS内部代码判定进入某个分支时将命中信息添加到这个临时存储，并在`post_hook()`中读取，在`finalize()`中还原
2. 如果需要捕获的数据具有清晰的方法边界，例如是个方法的返回值，则可以通过monkey-patch的方法，把原来的方法套一层，拿完返回值后再运行原逻辑。

## LazySpan和LazyTrace

这个LazySpan和LazyTrace两个对象存在的意义是什么，这个观测系统还有什么类似的对象吗

# 背景知识

## OTel是什么

通过API定义接口标准，SDK实现一套参考，OTLP用一种基于 Protobuf/HTTP 或 gRPC 的协议实现跨进程跨主机的数据推送。

### 核心数据结构

1. Span
2. SpanContext
3. BatchSpanProcessor
