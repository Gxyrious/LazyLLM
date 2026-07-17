from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, model_validator


WriterStage = Literal['outline', 'draft', 'final']


class WriterSpan(BaseModel):
    text: str = ''
    style: List[str] = Field(default_factory=list)


class WriterBlock(BaseModel):
    node_id: str
    type: str
    content: str = ''
    spans: List[WriterSpan] = Field(default_factory=list)
    children: List['WriterBlock'] = Field(default_factory=list)
    stage: WriterStage
    status: str = ''
    authoring: Dict[str, Any] = Field(default_factory=dict)
    numbering: Dict[str, Any] = Field(default_factory=dict)
    references: List[Dict[str, Any]] = Field(default_factory=list)
    source_refs: List[Dict[str, Any]] = Field(default_factory=list)
    provider_binding: Dict[str, Any] = Field(default_factory=dict)
    provider_payload: Dict[str, Any] = Field(default_factory=dict)
    editable: bool = True

    @model_validator(mode='after')
    def validate_spans(self) -> 'WriterBlock':
        if self.spans and ''.join(span.text for span in self.spans) != self.content:
            raise ValueError('content must equal the concatenated span text when spans are present')
        return self


WriterBlock.model_rebuild()


class WriterDocument(BaseModel):
    document_id: str
    stage: WriterStage
    title: str = ''
    blocks: List[WriterBlock] = Field(default_factory=list)
    revision: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    provider_binding: Dict[str, Any] = Field(default_factory=dict)


__all__ = ['WriterDocument', 'WriterBlock', 'WriterSpan', 'WriterStage']
