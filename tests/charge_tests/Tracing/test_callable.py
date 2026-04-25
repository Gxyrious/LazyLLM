import json

from lazyllm import enable_trace


def test_simple_function_tracing(exporter):
    def add(a, b):
        return a + b

    result = enable_trace(add, 5, 3)

    spans = exporter.get_finished_spans()
    assert len(spans) == 1
    assert spans[0].name == "add"
    assert spans[0].attributes.get("lazyllm.span.kind") == "callable"
    assert json.loads(spans[0].attributes.get("lazyllm.io.input")) == {"args": [5, 3], "kwargs": {}}
    assert spans[0].attributes.get("lazyllm.io.output") == "8"
    assert result == 8


def test_decorator_tracing(exporter):
    @enable_trace()
    def subtract(x, y):
        return x - y

    result = subtract(10, 3)

    spans = exporter.get_finished_spans()
    assert [s.name for s in spans] == ["subtract"]
    assert result == 7


def test_lambda_function_tracing(exporter):
    func = lambda x: x * 2
    result = enable_trace(func, 5)

    spans = exporter.get_finished_spans()
    assert [s.name for s in spans] == ["<lambda>"]
    assert result == 10
