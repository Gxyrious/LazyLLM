import json
from unittest.mock import patch

import lazyllm
from lazyllm import OnlineChatModule, bind, pipeline


def add(x, y):
    return x + y


def format_pair(value, query):
    return {"value": value, "query": query}


def test_bind_plain_callable_in_pipeline(exporter):
    with pipeline() as flow:
        flow.add_ten = add | bind(lazyllm._0, 10)
    result = flow(20)

    spans = exporter.get_finished_spans()
    assert [s.name for s in spans] == ["add", "Pipeline"]
    callable_span = spans[0]
    assert json.loads(callable_span.attributes.get("lazyllm.io.input")) == {"args": [20], "kwargs": {}}
    assert callable_span.attributes.get("lazyllm.io.output") == "30"
    assert result == 30


def test_bind_with_pipeline_input(exporter):
    with pipeline() as flow:
        flow.add_ten = add | bind(lazyllm._0, 10)
        flow.format_pair = format_pair | bind(query=flow.input)
    result = flow(20)

    spans = exporter.get_finished_spans()
    assert [s.name for s in spans] == ["add", "format_pair", "Pipeline"]
    format_span = spans[1]
    assert json.loads(format_span.attributes.get("lazyllm.io.input")) == {"args": [30], "kwargs": {"query": 20}}
    assert json.loads(format_span.attributes.get("lazyllm.io.output")) == {"value": 30, "query": 20}
    assert result == {"value": 30, "query": 20}


def test_bind_module_in_pipeline(exporter):
    with patch.object(OnlineChatModule, "forward", return_value="mock response"):
        module = OnlineChatModule(source="dynamic", type="llm", model="mock-chat")
        with pipeline() as flow:
            flow.llm = module | bind("prompt")
        result = flow("ignored")

    spans = exporter.get_finished_spans()
    assert [s.name for s in spans] == ["llm", "Pipeline"]
    module_span = spans[0]
    assert json.loads(module_span.attributes.get("lazyllm.io.input")) == {"args": ["prompt"], "kwargs": {}}
    assert module_span.attributes.get("lazyllm.io.output") == "mock response"
    assert result == "mock response"


def test_lazyllm_bind_function_in_pipeline(exporter):
    with pipeline() as flow:
        flow.add_ten = lazyllm.bind(add, lazyllm._0, 10)
    result = flow(20)

    spans = exporter.get_finished_spans()
    assert [s.name for s in spans] == ["add", "Pipeline"]
    assert result == 30
