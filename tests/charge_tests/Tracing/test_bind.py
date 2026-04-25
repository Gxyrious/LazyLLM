import json
from unittest.mock import patch

import lazyllm
from lazyllm import OnlineChatModule, bind, pipeline
from opentelemetry.trace import SpanKind


def add(x, y):
    return x + y


def format_pair(value, query):
    return {"value": value, "query": query}


def test_bind_plain_callable_in_pipeline(exporter):
    with pipeline() as flow:
        flow.add_ten = add | bind(lazyllm._0, 10)
    result = flow(20)

    spans = exporter.get_finished_spans()
    callable_span, pipeline_span = spans
    assert len(spans) == 2
    assert callable_span.name == "add"
    assert pipeline_span.name == "Pipeline"
    assert callable_span.kind == SpanKind.INTERNAL
    assert callable_span.attributes.get("lazyllm.span.kind") == "callable"
    assert json.loads(callable_span.attributes.get("lazyllm.io.input")) == {"args": [20], "kwargs": {}}
    assert callable_span.attributes.get("lazyllm.io.output") == "30"
    assert callable_span.parent.span_id == pipeline_span.context.span_id
    assert result == 30


def test_bind_with_pipeline_input(exporter):
    with pipeline() as flow:
        flow.add_ten = add | bind(lazyllm._0, 10)
        flow.format_pair = format_pair | bind(query=flow.input)
    result = flow(20)

    spans = exporter.get_finished_spans()
    add_span, format_span, pipeline_span = spans
    assert len(spans) == 3
    assert add_span.name == "add"
    assert format_span.name == "format_pair"
    assert pipeline_span.name == "Pipeline"
    assert add_span.attributes.get("lazyllm.span.kind") == "callable"
    assert format_span.attributes.get("lazyllm.span.kind") == "callable"
    assert json.loads(format_span.attributes.get("lazyllm.io.input")) == {"args": [30], "kwargs": {"query": 20}}
    assert json.loads(format_span.attributes.get("lazyllm.io.output")) == {"value": 30, "query": 20}
    assert add_span.parent.span_id == pipeline_span.context.span_id
    assert format_span.parent.span_id == pipeline_span.context.span_id
    assert result == {"value": 30, "query": 20}


def test_bind_module_in_pipeline(exporter):
    with patch.object(OnlineChatModule, "forward", return_value="mock response"):
        module = OnlineChatModule(source="dynamic", type="llm", model="mock-chat")
        with pipeline() as flow:
            flow.llm = module | bind("prompt")
        result = flow("ignored")

    spans = exporter.get_finished_spans()
    module_span, pipeline_span = spans
    assert len(spans) == 2
    assert module_span.name == "llm"
    assert pipeline_span.name == "Pipeline"
    assert module_span.kind == SpanKind.INTERNAL
    assert module_span.attributes.get("lazyllm.span.kind") == "module"
    assert module_span.attributes.get("lazyllm.semantic_type") == "llm"
    assert module_span.attributes.get("lazyllm.entity.config.model") == "mock-chat"
    assert json.loads(module_span.attributes.get("lazyllm.io.input")) == {"args": ["prompt"], "kwargs": {}}
    assert module_span.attributes.get("lazyllm.io.output") == "mock response"
    assert module_span.parent.span_id == pipeline_span.context.span_id
    assert result == "mock response"


def test_lazyllm_bind_function_in_pipeline(exporter):
    with pipeline() as flow:
        flow.add_ten = lazyllm.bind(add, lazyllm._0, 10)
    result = flow(20)

    spans = exporter.get_finished_spans()
    callable_span, pipeline_span = spans
    assert len(spans) == 2
    assert callable_span.name == "add"
    assert pipeline_span.name == "Pipeline"
    assert callable_span.attributes.get("lazyllm.span.kind") == "callable"
    assert callable_span.attributes.get("lazyllm.io.output") == "30"
    assert callable_span.parent.span_id == pipeline_span.context.span_id
    assert result == 30
