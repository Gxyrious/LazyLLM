import pytest
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.resources import Resource
from opentelemetry import trace

from lazyllm import set_trace_context, LazyTraceContext
from lazyllm.tracing.collect.runtime import _runtime


@pytest.fixture
def exporter():
    # 重置 OpenTelemetry 全局状态
    trace._TRACER_PROVIDER = None
    trace._TRACER_PROVIDER_SET_ONCE = trace.Once()

    # 重置 runtime 状态
    _runtime._initialized = False
    _runtime._tracer = None
    _runtime._provider = None
    _runtime._trace_api = None

    set_trace_context(LazyTraceContext(trace_id='test-trace', enabled=True))

    exporter = InMemorySpanExporter()
    provider = TracerProvider(resource=Resource.create({'service.name': 'lazyllm'}))
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    trace.set_tracer_provider(provider)

    _runtime._provider = provider
    _runtime._trace_api = trace
    _runtime._tracer = trace.get_tracer('lazyllm.tracing')
    _runtime._initialized = True

    yield exporter

    exporter.clear()
    trace._TRACER_PROVIDER = None
    trace._TRACER_PROVIDER_SET_ONCE = trace.Once()
    _runtime._initialized = False
    _runtime._tracer = None
    _runtime._provider = None
    _runtime._trace_api = None


def find_spans_by_name(spans, name):
    return [s for s in spans if s.name == name]
