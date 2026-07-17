from __future__ import annotations

from typing import Any

from ..data_models.docir import DocIR
from ..data_models.revision import PatchSet
from ..utils import to_prompt_json


class StructuredModelAdapter:
    '''模型直接读取内部 Block IR 的结构化适配器。'''

    name = 'structured'

    def document_to_model_input(self, document: DocIR) -> str:
        return to_prompt_json(document)

    def model_output_to_patch(self, model_output: Any, document: DocIR) -> PatchSet:
        patch = model_output if isinstance(model_output, PatchSet) else PatchSet.model_validate(model_output)
        if patch.target_doc_id != (document.doc_id or ''):
            raise ValueError(f'patch targets {patch.target_doc_id!r}, not {document.doc_id!r}')
        patch.meta['model_representation'] = self.name
        return patch


class MarkdownModelAdapter:
    '''内部 Block IR 与模型使用的 Markdown/diff 之间的边界适配器。'''

    name = 'markdown'

    def document_to_model_input(self, document: DocIR) -> str:
        # Markdown 路线实现：将唯一 Block IR 投影为 Markdown，并设计稳定定位方案。
        raise NotImplementedError('Implement Block IR to Markdown projection for the experiment.')

    def model_output_to_patch(self, model_output: str, document: DocIR) -> PatchSet:
        # Markdown 路线实现：校验模型 diff，再编译为统一 PatchSet；不创建第二套 IR。
        raise NotImplementedError('Implement Markdown diff to PatchSet compilation for the experiment.')
