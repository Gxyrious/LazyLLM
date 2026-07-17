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


PatchModifyType = Literal['replace', 'insert', 'delete', 'move']
PatchPosition = Literal['before', 'after', 'inside_start', 'inside_end']


class Anchor(BaseModel):
    node_id: str
    heading_path: List[str] = Field(default_factory=list)
    text_offset: Optional[int] = None


class ModifyInstruction(BaseModel):
    instruction_id: Optional[str] = None
    target_node_id: str
    modify_type: PatchModifyType
    anchor_node_id: Optional[str] = None
    position: Optional[PatchPosition] = None
    include_section: bool = False
    instruction: str
    meta: Dict[str, Any] = Field(default_factory=dict)


class ModifyPlan(BaseModel):
    plan_id: Optional[str] = None
    task_id: Optional[str] = None
    scope: Literal['document', 'section', 'block', 'span']
    target_node_ids: List[str] = Field(default_factory=list)
    instructions: List[ModifyInstruction] = Field(default_factory=list)
    summary: Optional[str] = None
    meta: Dict[str, Any] = Field(default_factory=dict)


class PatchBlock(BaseModel):
    node_id: Optional[str] = None
    type: str = 'paragraph'
    content: str = ''
    spans: List[WriterSpan] = Field(default_factory=list)
    children: List['PatchBlock'] = Field(default_factory=list)
    numbering: Dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode='after')
    def validate_spans(self) -> 'PatchBlock':
        if self.spans and ''.join(span.text for span in self.spans) != self.content:
            raise ValueError('content must equal the concatenated span text when spans are present')
        return self


PatchBlock.model_rebuild()


class PatchHunk(BaseModel):
    target_node_id: str
    modify_type: PatchModifyType
    anchor: Optional[Anchor] = None
    old_text: Optional[str] = None
    new_text: Optional[str] = None
    new_blocks: List[PatchBlock] = Field(default_factory=list)
    position: Optional[PatchPosition] = None
    include_section: bool = False
    preserve_styles: bool = True
    meta: Dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode='after')
    def validate_operation(self) -> 'PatchHunk':
        if self.modify_type == 'insert':
            if self.position is None or (self.new_text is None and not self.new_blocks):
                raise ValueError('insert requires position and new_text or new_blocks')
        elif self.modify_type == 'replace':
            if self.new_text is None:
                raise ValueError('replace requires new_text')
        elif self.modify_type == 'move' and (self.anchor is None or self.position is None):
            raise ValueError('move requires anchor and position')
        return self


class PatchSet(BaseModel):
    patch_id: Optional[str] = None
    target_doc_id: str
    hunks: List[PatchHunk] = Field(default_factory=list)
    meta: Dict[str, Any] = Field(default_factory=dict)


class PatchResult(BaseModel):
    patch_id: Optional[str] = None
    success: bool
    applied_hunks: List[str] = Field(default_factory=list)
    failed_hunks: List[str] = Field(default_factory=list)
    message: Optional[str] = None
    meta: Dict[str, Any] = Field(default_factory=dict)


WriterDocument.model_rebuild()


__all__ = [
    'WriterDocument', 'WriterBlock', 'WriterSpan', 'WriterStage',
    'Anchor', 'ModifyInstruction', 'ModifyPlan',
    'PatchBlock', 'PatchHunk', 'PatchSet', 'PatchResult',
]
