from __future__ import annotations
from typing import Any, Dict, List, Optional

from .base import WriterToolBase
from ..data_models.context import WritingContext, PROMPT_EXCLUDE as CONTEXT_EXCLUDE
from ..data_models.resource import ResourceProfile, PROMPT_EXCLUDE as PROFILE_EXCLUDE
from ..data_models.task import WritingTask
from ..data_models.writer_ir import (
    WriterBlock,
    WriterAuthoring,
    WriterConstraints,
    WriterDocument,
    PROMPT_EXCLUDE as IR_EXCLUDE,
)
from ..data_models.planning import SectionInstruction, SectionInstructionList
from ..prompts import GENERATE_OUTLINE_PROMPT, GENERATE_SECTION_INSTRUCTIONS_PROMPT
from ..utils import to_prompt_json




class WriterPlanningTools(WriterToolBase):
    __public_apis__ = [
        'generate_outline',
        'generate_section_instructions',
    ]

    def generate_outline(
        self,
        task: Any,
        context: Any,
        resource_profiles: Any = None,
        execution_results: Any = None,
    ) -> dict:
        writing_task = self._unified_model(task, WritingTask)
        writing_context = self._unified_model(context, WritingContext)
        profiles = self._unified_models(resource_profiles, ResourceProfile)
        execution_data = self._normalize_execution_results(execution_results)

        prompt = GENERATE_OUTLINE_PROMPT.format(
            task_json=to_prompt_json(writing_task),
            context_json=to_prompt_json(writing_context, exclude=CONTEXT_EXCLUDE),
            resource_profiles_json=to_prompt_json(profiles, exclude=PROFILE_EXCLUDE),
            execution_results_json=to_prompt_json(execution_data),
        )
        outline = self._call_llm_structured(prompt, WriterDocument, exclude=IR_EXCLUDE,
            normalize=lambda d: self._normalize_outline(
                d, writing_task, writing_context, profiles, execution_data))

        result = self._save_artifacts(
            {'outline': outline},
            step_name='generate_outline',
            primary_key='outline',
            context_key=None,
            summary='Generated writing outline.',
            counts={
                'top_level_sections': len(outline.blocks),
                'outline_nodes': self._count_outline_blocks(outline.blocks),
            },
            artifact_meta={
                'task_id': writing_task.task_id,
                'context_id': writing_context.context_id,
                'resource_profile_count': len(profiles),
                'has_execution_results': execution_data is not None,
            },
        )
        return result.model_dump()

    def generate_section_instructions(
        self,
        outline: Any,
        context: Any,
        execution_results: Any = None,
    ) -> dict:
        writing_outline = self._unified_model(outline, WriterDocument)
        writing_context = self._unified_model(context, WritingContext)
        execution_data = self._normalize_execution_results(execution_results)

        prompt = GENERATE_SECTION_INSTRUCTIONS_PROMPT.format(
            outline_json=to_prompt_json(writing_outline, exclude=IR_EXCLUDE - {'node_id'}),
            context_json=to_prompt_json(writing_context, exclude=CONTEXT_EXCLUDE),
            execution_results_json=to_prompt_json(execution_data),
        )
        instruction_list = self._call_llm_structured(prompt, SectionInstructionList)
        self._apply_section_instructions(writing_outline, instruction_list)

        result = self._save_artifacts(
            {'outline': writing_outline},
            step_name='generate_section_instructions',
            primary_key='outline',
            context_key=None,
            summary='Generated section writing instructions.',
            counts={
                'section_instructions': len(instruction_list.instructions),
            },
            artifact_meta={
                'document_id': writing_outline.document_id,
                'context_id': writing_context.context_id,
                'has_execution_results': execution_data is not None,
            },
        )
        return result.model_dump()

    def _normalize_execution_results(self, execution_results: Any) -> Any:
        return self._unified_raw_data(execution_results)

    def _normalize_outline(
        self,
        raw_outline: dict,
        task: WritingTask,
        context: WritingContext,
        profiles: List[ResourceProfile],
        execution_results: Any,
    ) -> dict:
        raw_blocks = raw_outline.get('blocks', [])
        if len(raw_blocks) < 3:
            raise ValueError('generate_outline must produce at least 3 top-level sections.')
        valid_reference_ids = self._valid_reference_ids(context, profiles)
        has_available_facts = self._has_available_facts(context, profiles)
        for index, raw_block in enumerate(raw_blocks, start=1):
            self._normalize_outline_block(
                raw_block, level=1, node_id=f'section-{index}',
                valid_reference_ids=valid_reference_ids,
                has_available_facts=has_available_facts)
        raw_outline['document_id'] = self._default_outline_id(task, context)
        raw_outline['stage'] = 'outline'
        raw_outline['title'] = raw_outline.get('title') or self._default_outline_title(task)
        raw_outline.setdefault('metadata', {})['source'] = 'llm'
        return raw_outline

    def _normalize_outline_block(
        self,
        raw_block: dict,
        *,
        level: int,
        node_id: str,
        valid_reference_ids: set[str],
        has_available_facts: bool,
    ) -> dict:
        raw_block['node_id'] = node_id
        raw_block['type'] = 'heading'
        raw_block['stage'] = 'outline'
        raw_block['numbering'] = {'level': level}
        authoring_raw = raw_block.setdefault('authoring', {})
        authoring_raw.setdefault('instruction', None)
        constraints_raw = authoring_raw.setdefault('constraints', {})
        valid_keys = set(WriterConstraints.model_fields.keys())
        for unknown in set(constraints_raw) - valid_keys:
            constraints_raw.pop(unknown)
        if not has_available_facts:
            constraints_raw['fact_constraints'] = []
        raw_block['references'] = self._filter_references(
            raw_block.get('references', []), valid_reference_ids)
        for index, child in enumerate(raw_block.get('children', []), start=1):
            self._normalize_outline_block(
                child, level=level + 1, node_id=f'{node_id}-{index}',
                valid_reference_ids=valid_reference_ids,
                has_available_facts=has_available_facts)
        return raw_block

    def _default_outline_id(self, task: WritingTask, context: WritingContext) -> str:
        source_id = task.task_id or context.context_id or 'writer'
        return f'{source_id}-outline'

    def _default_outline_title(self, task: WritingTask) -> str:
        if task.target_document and task.target_document.title:
            return task.target_document.title
        query = ' '.join(task.query.split())
        return query[:80] if query else 'Writing Outline'

    def _count_outline_blocks(self, blocks: List[WriterBlock]) -> int:
        return sum(1 + self._count_outline_blocks(block.children) for block in blocks)

    def _apply_section_instructions(
        self,
        outline: WriterDocument,
        instruction_list: SectionInstructionList,
    ) -> None:
        target_by_id = {block.node_id: block for block in outline.blocks}
        instruction_by_node_id: Dict[str, SectionInstruction] = {}

        for instruction in instruction_list.instructions:
            node_id = instruction.outline_node_id
            if node_id in instruction_by_node_id:
                raise ValueError(f'Duplicate section instruction for outline node {node_id!r}.')
            if node_id not in target_by_id:
                raise ValueError(f'Section instruction references unknown outline node {node_id!r}.')
            instruction_by_node_id[node_id] = instruction

        missing_node_ids = [
            block.node_id for block in outline.blocks
            if block.node_id not in instruction_by_node_id
        ]
        if missing_node_ids:
            raise ValueError(
                'Missing section instructions for outline nodes: '
                + ', '.join(missing_node_ids)
            )

        for block in outline.blocks:
            instruction = instruction_by_node_id[block.node_id]
            if block.authoring is None:
                block.authoring = WriterAuthoring()
            block.authoring.instruction_id = f'instruction-{block.node_id}'
            block.authoring.expected_blocks = (
                instruction.expected_blocks or self._default_expected_blocks(block))
            block.authoring.visual_needs = instruction.visual_needs
            block.authoring.pending_subtasks = instruction.pending_subtasks
            block.authoring.revision_notes = instruction.revision_notes

    def _default_expected_blocks(self, block: WriterBlock) -> List[str]:
        blocks = [block.content] if block.content else []
        if block.authoring and block.authoring.constraints.required_points:
            blocks.extend(block.authoring.constraints.required_points[:3])
        return blocks

    def _valid_reference_ids(
        self,
        context: WritingContext,
        profiles: Optional[List[ResourceProfile]] = None,
    ) -> set[str]:
        refs: set[str] = set()
        for profile in profiles or []:
            if profile.resource_id:
                refs.add(profile.resource_id)
        for fact in context.facts:
            if fact.fact_id:
                refs.add(fact.fact_id)
            refs.update(source for source in fact.source if source)
        return refs

    def _has_available_facts(
        self,
        context: WritingContext,
        profiles: Optional[List[ResourceProfile]] = None,
    ) -> bool:
        if context.facts:
            return True
        return any(profile.key_facts for profile in profiles or [])

    def _filter_references(
        self,
        references: List[Dict[str, Any]],
        valid_reference_ids: set[str],
    ) -> List[Dict[str, Any]]:
        if not valid_reference_ids:
            return []
        return [
            reference
            for reference in references
            if reference.get('id') in valid_reference_ids
        ]
