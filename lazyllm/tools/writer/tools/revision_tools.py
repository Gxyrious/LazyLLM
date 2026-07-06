from __future__ import annotations
from typing import Any, List

from .base import WriterToolBase
from ..data_models.context import WritingContext
from ..data_models.writing import DraftDocument, DraftSection
from ..prompts import REVISE_DRAFT_DOCUMENT_PROMPT, REVISE_DRAFT_SECTION_PROMPT
from ..utils import to_prompt_json


class WriterRevisionTools(WriterToolBase):
    __public_apis__ = [
        'revise_draft_document',
        'revise_draft_section',
    ]

    def revise_draft_document(
        self,
        draft_document: Any,
        context: Any,
        revision_request: str,
    ) -> dict:
        source_document = self._unified_model(draft_document, DraftDocument)
        writing_context = self._unified_model(context, WritingContext)
        if not source_document.sections:
            raise ValueError('draft_document must contain at least one section.')
        if not str(revision_request or '').strip():
            raise ValueError('revision_request must be a non-empty string.')

        prompt = REVISE_DRAFT_DOCUMENT_PROMPT.format(
            draft_document_json=to_prompt_json(source_document),
            context_json=to_prompt_json(writing_context),
            revision_request=revision_request,
        )
        revised = self._call_llm_structured(prompt, DraftDocument)
        if not revised.sections:
            raise ValueError('LLM returned an empty document revision.')
        revised.draft_id = revised.draft_id or source_document.draft_id
        revised.title = revised.title or source_document.title
        for index, section in enumerate(revised.sections, start=1):
            self._normalize_section(section, index)
        revised.meta = dict(revised.meta or {})
        revised.meta.update({
            'source': 'revise_draft_document',
            'revised_from': source_document.draft_id,
        })

        result = self._save_artifacts(
            {'revised_document': revised},
            step_name='revise_draft_document',
            primary_key='revised_document',
            context_key=None,
            summary='Revised draft document.',
            counts={
                'revised_sections': len(revised.sections),
                'draft_blocks': self._count_draft_blocks(revised.sections),
            },
            artifact_meta={
                'context_id': writing_context.context_id,
                'doc_id': writing_context.doc_id,
                'source_draft_id': source_document.draft_id,
            },
            artifact_filenames={
                'revised_document': f'revised_document_{source_document.draft_id or 'draft'}.json',
            },
        )
        return result.model_dump()

    def revise_draft_section(
        self,
        section: Any,
        context: Any,
        revision_request: str,
    ) -> dict:
        source_section = self._unified_model(section, DraftSection)
        writing_context = self._unified_model(context, WritingContext)
        if not str(revision_request or '').strip():
            raise ValueError('revision_request must be a non-empty string.')

        prompt = REVISE_DRAFT_SECTION_PROMPT.format(
            section_json=to_prompt_json(source_section),
            context_json=to_prompt_json(writing_context),
            revision_request=revision_request,
        )
        revised = self._call_llm_structured(prompt, DraftSection)
        revised = self._normalize_revised_section(revised, source_section)

        result = self._save_artifacts(
            {'revised_section': revised},
            step_name='revise_draft_section',
            primary_key='revised_section',
            context_key=None,
            summary='Revised draft section.',
            counts={'draft_blocks': self._count_draft_blocks([revised])},
            artifact_meta={
                'context_id': writing_context.context_id,
                'section_id': revised.section_id,
                'outline_node_id': revised.outline_node_id,
            },
            artifact_filenames={
                'revised_section': f'revised_section_{revised.section_id or 'section'}.json',
            },
        )
        return result.model_dump()

    def _normalize_revised_section(
        self,
        revised: DraftSection,
        source_section: DraftSection,
    ) -> DraftSection:
        revised.section_id = source_section.section_id or revised.section_id
        revised.outline_node_id = source_section.outline_node_id or revised.outline_node_id
        revised.instruction_id = source_section.instruction_id or revised.instruction_id
        revised.title = revised.title or source_section.title
        self._normalize_section(revised, 1)
        return revised

    def _normalize_section(self, section: DraftSection, index: int) -> None:
        section_id = section.section_id or f'revised-section-{index}'
        section.section_id = section_id
        for block_index, block in enumerate(section.blocks, start=1):
            block.block_id = block.block_id or f'{section_id}-block-{block_index}'
            block.section_id = section_id
            block.outline_node_id = block.outline_node_id or section.outline_node_id
            for subtask in block.subtasks:
                subtask.section_id = subtask.section_id or section_id
                subtask.block_id = subtask.block_id or block.block_id
        for subtask in section.subtasks:
            subtask.section_id = subtask.section_id or section_id

    def _count_draft_blocks(self, sections: List[DraftSection]) -> int:
        return sum(
            len(section.blocks) + self._count_draft_blocks(section.sub_sections)
            for section in sections
        )
