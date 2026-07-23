from __future__ import annotations
import json

from typing import Any, Collection, Optional


def to_prompt_json(value: Any, *, exclude: Optional[Collection[str]] = None) -> str:
    def default(obj: Any) -> Any:
        if hasattr(obj, 'model_dump'):
            return obj.model_dump()
        return str(obj)

    data = json.loads(json.dumps(value, ensure_ascii=False, default=default))
    if exclude:
        _strip_keys(data, exclude)
    return json.dumps(data, ensure_ascii=False, indent=2)


def _strip_keys(obj: Any, keys: Collection[str]) -> None:
    if isinstance(obj, dict):
        for key in keys:
            obj.pop(key, None)
        for value in obj.values():
            _strip_keys(value, keys)
    elif isinstance(obj, list):
        for item in obj:
            _strip_keys(item, keys)
