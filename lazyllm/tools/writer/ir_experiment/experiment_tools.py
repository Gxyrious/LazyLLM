from __future__ import annotations

from difflib import SequenceMatcher
import time
from typing import Any, Dict, List, Set, Tuple
from uuid import uuid4

from pydantic import BaseModel, Field

from ..data_models.task import TargetDocument, WritingTask
from ..tools.base import WriterToolBase
from ..utils import to_prompt_json
from .model_adapters import MarkdownAdapter, StructuredJsonAdapter, XmlAdapter
from .writer_ir import (
    ModifyPlan, PatchBlock, PatchResult, PatchSet, WriterBlock, WriterDocument, WriterSpan,
    WriterStage,
)

# 飞书 block_type 整数 -> WriterBlock.type 字符串。
# heading 统一归为 'heading'，level 写入 numbering；其余未知类型一律 'block'，保持开放。
_FEISHU_TYPE_MAP = {
    1: 'document', 2: 'paragraph',
    3: 'heading', 4: 'heading', 5: 'heading', 6: 'heading', 7: 'heading',
    8: 'heading', 9: 'heading', 10: 'heading', 11: 'heading',
    12: 'list_item', 13: 'list_item', 14: 'code', 15: 'quote',
    27: 'image', 31: 'table', 32: 'table_cell',
}

_FEISHU_TEXT_FIELDS = {
    1: 'page', 2: 'text',
    3: 'heading1', 4: 'heading2', 5: 'heading3', 6: 'heading4', 7: 'heading5',
    8: 'heading6', 9: 'heading7', 10: 'heading8', 11: 'heading9',
    12: 'bullet', 13: 'ordered', 14: 'code', 15: 'quote', 17: 'todo',
}

_WRITER_TYPE_TO_FEISHU = {
    'document': 1, 'paragraph': 2, 'list_item': 12,
    'code': 14, 'quote': 15,
}


class _ContextSelection(BaseModel):
    use_full_document: bool = False
    section_node_ids: List[str] = Field(default_factory=list)


class IRExperimentTools(WriterToolBase):
    '''内层 WriterDocument 与三种模型边界 Adapter 的实验骨架。'''

    __public_apis__ = [
        'read_writer_doc',
        'generate_modify_plan_json', 'generate_modify_plan_xml', 'generate_modify_plan_markdown',
        'generate_patch_json', 'generate_patch_xml', 'generate_patch_markdown',
        'generate_staged_document_json', 'generate_staged_document_xml',
        'generate_staged_document_markdown',
        'apply_patch', 'write_patch_to_feishu',
    ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.json_adapter = StructuredJsonAdapter()
        self.xml_adapter = XmlAdapter()
        self.markdown_adapter = MarkdownAdapter()

    # ==================== 共用：飞书 -> 内层 WriterDocument ====================

    def read_writer_doc(self, feishu_url: str) -> WriterDocument:
        '''读取飞书文档并构造内层 WriterDocument（唯一 IR）。'''
        fs, real_path = self._resolve_feishu(feishu_url)
        resolved = fs.resolve_link(real_path)
        doc_id = resolved.get('obj_token')
        if not doc_id:
            raise ValueError(f'cannot resolve feishu url to a document: {feishu_url!r}')
        raw_blocks = fs._get_doc_blocks_raw(doc_id, with_descendants=True)
        blocks = self._build_writer_blocks(raw_blocks)
        stage: WriterStage = 'final'
        return WriterDocument(
            document_id=doc_id,
            stage=stage,
            title=resolved.get('title') or '',
            blocks=blocks,
            provider_binding={'adapter': 'feishu', 'uri': feishu_url},
            metadata={
                'title': resolved.get('title') or '',
                'source': TargetDocument(
                    doc_id=doc_id, uri=feishu_url, adapter='feishu',
                    title=resolved.get('title') or None,
                ).model_dump(),
                'block_count': sum(1 for _ in self._iter_blocks(blocks)),
            },
        )

    # ==================== Plan：三路线入口，差异仅在 Adapter ====================

    def generate_modify_plan_json(self, task: Any, document: Any) -> ModifyPlan:
        return self._generate_modify_plan(self.json_adapter, task, document)

    def generate_modify_plan_xml(self, task: Any, document: Any) -> ModifyPlan:
        return self._generate_modify_plan(self.xml_adapter, task, document)

    def generate_modify_plan_markdown(self, task: Any, document: Any) -> ModifyPlan:
        return self._generate_modify_plan(self.markdown_adapter, task, document)

    # ==================== Patch：三路线入口，差异仅在 Adapter ====================

    def generate_patch_json(self, modify_plan: Any, document: Any) -> PatchSet:
        return self._generate_patch(self.json_adapter, modify_plan, document)

    def generate_patch_xml(self, modify_plan: Any, document: Any) -> PatchSet:
        return self._generate_patch(self.xml_adapter, modify_plan, document)

    def generate_patch_markdown(self, modify_plan: Any, document: Any) -> PatchSet:
        return self._generate_patch(self.markdown_adapter, modify_plan, document)

    # ==================== Outline -> Draft -> Final ====================

    def generate_staged_document_json(self, task: Any, document: Any) -> Dict[str, Any]:
        return self._generate_staged_document(self.json_adapter, task, document)

    def generate_staged_document_xml(self, task: Any, document: Any) -> Dict[str, Any]:
        return self._generate_staged_document(self.xml_adapter, task, document)

    def generate_staged_document_markdown(self, task: Any, document: Any) -> Dict[str, Any]:
        return self._generate_staged_document(self.markdown_adapter, task, document)

    # ==================== 共用：Patch 应用到内层 WriterDocument ====================

    def apply_patch(self, document: Any, patch_set: Any) -> Tuple[WriterDocument, PatchResult]:
        '''按 target_node_id 把 PatchSet 应用到 WriterDocument 副本。'''
        doc = self._unified_model(document, WriterDocument).model_copy(deep=True)
        patch = self._unified_model(patch_set, PatchSet)
        if patch.target_doc_id != doc.document_id:
            raise ValueError(
                f'patch targets {patch.target_doc_id!r}, not {doc.document_id!r}'
            )

        applied, failed = [], []
        for idx, hunk in enumerate(patch.hunks):
            hunk_id = f'hunk-{idx}'
            node_map, container_of = self._build_node_index(doc.blocks)
            ok = self._apply_hunk(hunk, node_map, container_of)
            (applied if ok else failed).append(hunk_id)
        target_stage = patch.meta.get('target_stage')
        if target_stage in ('outline', 'draft', 'final'):
            doc.stage = target_stage
            for block in self._iter_blocks(doc.blocks):
                block.stage = target_stage
        return doc, self._patch_result(patch, applied, failed)

    # ==================== 共用：内层 Patch 写回飞书 ====================

    def write_patch_to_feishu(self, feishu_url: str, patch_set: Any) -> PatchResult:
        return self._write_patch_to_feishu(feishu_url, patch_set)

    # ==================== 私有：Plan / Patch 共用模型调用 ====================

    def _generate_modify_plan(
        self, adapter, task: Any, document: Any,
    ) -> ModifyPlan:
        doc = self._unified_model(document, WriterDocument)
        writing_task = self._unified_model(task, WritingTask)
        context_doc = self._select_model_context(adapter, writing_task, doc)
        model_input = adapter.document_to_model_input(context_doc)
        prompt = f'''You are planning a local document revision using the {adapter.name} representation.
Understand the user request and return a ModifyPlan before any patch is generated.
Locate every node involved in the requested replace / insert / delete / move operation, including
destination anchors and nodes whose cross-references may be affected. Use only node_ids present in
the document. For move, set anchor_node_id and position; set include_section=true when a heading and
its following section must move or be deleted together. Keep the scope minimal and put instructions
in their required execution order. If visible heading text or references must change after a structural
operation, express each change as an explicit replace instruction; the Patch application engine never
invents additional document edits.

Writing task:
{to_prompt_json(writing_task)}

Document ({adapter.name}):
{model_input}
'''
        plan = self._call_llm_structured(prompt, ModifyPlan)
        node_ids = {block.node_id for block in self._iter_blocks(doc.blocks)}
        referenced = plan.target_node_ids + [i.target_node_id for i in plan.instructions]
        referenced += [i.anchor_node_id for i in plan.instructions if i.anchor_node_id]
        missing = [nid for nid in referenced if nid not in node_ids]
        if missing:
            raise ValueError(f'modify plan targets node_ids absent from WriterDocument: {missing}')
        plan.meta['model_representation'] = adapter.name
        if context_doc is not doc:
            plan.meta['context_node_ids'] = [
                block.node_id for block in self._iter_blocks(context_doc.blocks)
            ]
        target_stage = writing_task.meta.get('target_stage')
        if target_stage in ('outline', 'draft', 'final'):
            plan.meta['target_stage'] = target_stage
        return plan

    def _generate_patch(self, adapter, modify_plan: Any, document: Any) -> PatchSet:
        doc = self._unified_model(document, WriterDocument)
        plan = self._unified_model(modify_plan, ModifyPlan)
        context_node_ids = plan.meta.get('context_node_ids')
        context_doc = self._document_subset(doc, set(context_node_ids)) if context_node_ids else doc
        model_input = adapter.document_to_model_input(context_doc)
        prompt = f'''You are compiling an approved ModifyPlan into an executable PatchSet using
the {adapter.name} representation.
Produce exactly one PatchHunk for each ModifyInstruction, in the same order. Copy target_node_id,
modify_type, position, and include_section from the instruction. For replace, return the complete new
WriterBlock.content and preserve_styles=true. For a plain paragraph insert, target_node_id is the
existing anchor and new_text is the complete content. For a heading, list, multi-block, nested, or
empty-document insert, use new_blocks with semantic type/content/spans/children and use inside_start
or inside_end when inserting into a document or container block. For delete, identify the target only.
For move, copy anchor_node_id into anchor.node_id; no document text is copied into the Patch. Do not
add operations absent from the plan. Leave old_text null for every operation; the Adapter injects its
authoritative value from the core WriterDocument after generation. new_text is plain WriterBlock.content:
never include JSON structure, XML tags, Markdown markers, or projection ID comments.

Modify plan:
{to_prompt_json(plan)}

Document ({adapter.name}):
{model_input}
'''
        model_output = self._call_llm_structured(prompt, PatchSet)
        patch = adapter.model_output_to_patch(model_output, doc)
        if plan.meta.get('target_stage') in ('outline', 'draft', 'final'):
            patch.meta['target_stage'] = plan.meta['target_stage']
        return patch

    def _generate_staged_document(self, adapter, task: Any, document: Any) -> Dict[str, Any]:
        writing_task = self._unified_model(task, WritingTask)
        current = self._unified_model(document, WriterDocument)
        stages = (
            ('outline', 'Create a complete outline only. Insert semantic heading blocks and concise '
             'outline points into the existing document root.'),
            ('draft', 'Expand the current outline into a coherent draft. Preserve existing block IDs '
             'when editing them and insert detailed content under the relevant headings.'),
            ('final', 'Polish the current draft into the final document. Preserve its structure and '
             'block IDs while improving accuracy, coherence, and style.'),
        )
        history = []
        for stage, instruction in stages:
            stage_task = writing_task.model_copy(deep=True)
            stage_task.query = f'{writing_task.query}\n\nStage requirement: {instruction}'
            stage_task.meta['target_stage'] = stage
            plan = self._generate_modify_plan(adapter, stage_task, current)
            patch = self._generate_patch(adapter, plan, current)
            current, result = self.apply_patch(current, patch)
            if not result.success:
                raise RuntimeError(f'{stage} PatchSet could not be applied: {result.failed_hunks}')
            history.append({'stage': stage, 'modify_plan': plan, 'patch_set': patch, 'result': result})
        return {'document': current, 'history': history}

    def _select_model_context(
        self, adapter, task: WritingTask, document: WriterDocument,
    ) -> WriterDocument:
        if not any(block.type == 'heading' for block in self._iter_blocks(document.blocks)):
            return document
        outline = self._outline_document(document)
        prompt = f'''Choose the document context required to complete the writing task. You may
inspect only the document outline at this step. When the target can be located from headings, return
the smallest sufficient set of heading node_ids and set use_full_document=false. Set
use_full_document=true only when the target cannot be located from the outline or the task inherently
requires the complete document. Multiple relevant sections do not by themselves require the full text.

Writing task:
{to_prompt_json(task)}

Document outline ({adapter.name}):
{adapter.document_to_model_input(outline)}
'''
        selection = self._call_llm_structured(prompt, _ContextSelection)
        if selection.use_full_document:
            return document
        node_map, _ = self._build_node_index(document.blocks)
        invalid = [
            node_id for node_id in selection.section_node_ids
            if node_id not in node_map or node_map[node_id].type != 'heading'
        ]
        if invalid or not selection.section_node_ids:
            raise ValueError(f'invalid context heading IDs: {invalid or selection.section_node_ids}')
        visible = {
            block.node_id for block in self._iter_blocks(self._outline_document(document).blocks)
        }
        _, container_of = self._build_node_index(document.blocks)
        for node_id in selection.section_node_ids:
            heading = node_map[node_id]
            container = container_of[node_id]
            start = container.index(heading)
            for block in container[start:self._section_end(container, start)]:
                visible.update(item.node_id for item in self._iter_blocks([block]))
        return self._document_subset(document, visible)

    @classmethod
    def _outline_document(cls, document: WriterDocument) -> WriterDocument:
        visible = {
            block.node_id for block in cls._iter_blocks(document.blocks)
            if block.type in ('document', 'heading')
        }
        return cls._document_subset(document, visible)

    @classmethod
    def _document_subset(cls, document: WriterDocument, visible: Set[str]) -> WriterDocument:
        def copy_blocks(blocks: List[WriterBlock]) -> List[WriterBlock]:
            copied = []
            for block in blocks:
                children = copy_blocks(block.children)
                if block.node_id not in visible and not children:
                    continue
                clone = block.model_copy(deep=True)
                clone.children = children
                copied.append(clone)
            return copied

        subset = document.model_copy(deep=True)
        subset.blocks = copy_blocks(document.blocks)
        return subset

    # ==================== 私有：Patch 应用引擎 ====================

    def _apply_hunk(
        self, hunk, node_map: Dict[str, WriterBlock], container_of,
    ) -> bool:
        modify_type = hunk.modify_type
        if modify_type == 'replace':
            target = node_map.get(hunk.target_node_id)
            if target is None or hunk.old_text != target.content:
                return False
            self._replace_text(target, hunk.new_text or '', hunk.preserve_styles)
            return True
        if modify_type == 'delete':
            target = node_map.get(hunk.target_node_id)
            container = container_of.get(hunk.target_node_id)
            if target is None or container is None or hunk.old_text != target.content:
                return False
            target_index = container.index(target)
            end_index = self._section_end(container, target_index) if hunk.include_section else target_index + 1
            del container[target_index:end_index]
            return True
        if modify_type == 'insert':
            anchor = node_map.get(hunk.target_node_id)
            if anchor is None:
                return False
            destination, insert_at = self._insertion_point(anchor, hunk.position, container_of)
            if destination is None:
                return False
            payloads = hunk.new_blocks or [PatchBlock(content=hunk.new_text or '')]
            new_blocks = [self._patch_block_to_writer(block, anchor.stage) for block in payloads]
            destination[insert_at:insert_at] = new_blocks
            return True
        if modify_type == 'move':
            target = node_map.get(hunk.target_node_id)
            source = container_of.get(hunk.target_node_id)
            anchor = node_map.get(hunk.anchor.node_id if hunk.anchor else '')
            if target is None or source is None or anchor is None:
                return False
            source_index = source.index(target)
            end_index = self._section_end(source, source_index) if hunk.include_section else source_index + 1
            moving = source[source_index:end_index]
            moving_ids = {block.node_id for root in moving for block in self._iter_blocks([root])}
            if anchor.node_id in moving_ids:
                return False
            del source[source_index:end_index]
            destination, insert_at = self._insertion_point(anchor, hunk.position, container_of)
            if destination is None:
                source[source_index:source_index] = moving
                return False
            destination[insert_at:insert_at] = moving
            return True
        return False

    @classmethod
    def _build_node_index(cls, roots: List[WriterBlock]):
        node_map: Dict[str, WriterBlock] = {}
        container_of: Dict[str, List[WriterBlock]] = {}

        def walk(blocks):
            for block in blocks:
                node_map[block.node_id] = block
                container_of[block.node_id] = blocks
                walk(block.children)
        walk(roots)
        return node_map, container_of

    @staticmethod
    def _insertion_point(anchor: WriterBlock, position: str, container_of):
        if position == 'inside_start':
            return anchor.children, 0
        if position == 'inside_end':
            return anchor.children, len(anchor.children)
        container = container_of.get(anchor.node_id)
        if container is None:
            return None, 0
        anchor_index = container.index(anchor)
        return container, anchor_index + (position == 'after')

    @classmethod
    def _section_end(cls, container: List[WriterBlock], start: int) -> int:
        heading = container[start]
        if heading.type != 'heading':
            return start + 1
        level = int(heading.numbering.get('level', 1))
        for index in range(start + 1, len(container)):
            candidate = container[index]
            if candidate.type == 'heading' and int(candidate.numbering.get('level', 1)) <= level:
                return index
        return len(container)

    @classmethod
    def _patch_block_to_writer(cls, block: PatchBlock, default_stage: WriterStage) -> WriterBlock:
        return WriterBlock(
            node_id=block.node_id or f'local-{uuid4().hex}', type=block.type,
            content=block.content, spans=block.spans, stage=default_stage,
            numbering=block.numbering,
            children=[cls._patch_block_to_writer(child, default_stage) for child in block.children],
        )

    @staticmethod
    def _replace_text(block: WriterBlock, new_text: str, preserve_styles: bool = True) -> None:
        if not preserve_styles or not block.spans:
            block.content = new_text
            block.spans = []
            return

        old_styles = [style for span in block.spans for style in [tuple(span.style)] * len(span.text)]
        new_styles: List[Tuple[str, ...]] = []
        for tag, old_start, old_end, new_start, new_end in SequenceMatcher(
            None, block.content, new_text,
        ).get_opcodes():
            new_length = new_end - new_start
            if tag == 'equal':
                new_styles.extend(old_styles[old_start:old_end])
            elif tag == 'replace' and old_start < old_end:
                replaced_styles = old_styles[old_start:old_end]
                style = replaced_styles[0] if all(item == replaced_styles[0] for item in replaced_styles) else ()
                new_styles.extend([style] * new_length)
            else:
                new_styles.extend([()] * new_length)

        spans: List[WriterSpan] = []
        for character, style in zip(new_text, new_styles):
            if spans and tuple(spans[-1].style) == style:
                spans[-1].text += character
            else:
                spans.append(WriterSpan(text=character, style=list(style)))
        block.content = new_text
        block.spans = spans

    # ==================== 私有：飞书写回 ====================

    def _write_patch_to_feishu(self, feishu_url: str, patch_set: Any) -> PatchResult:
        '''把统一 PatchSet 写回飞书。'''
        patch = self._unified_model(patch_set, PatchSet)
        fs, real_path = self._resolve_feishu(feishu_url)
        resolved = fs.resolve_link(real_path)
        document_id = resolved.get('obj_token')
        if not document_id:
            raise ValueError(f'cannot resolve feishu url to a document: {feishu_url!r}')
        if patch.target_doc_id != document_id:
            raise ValueError(
                f'patch targets {patch.target_doc_id!r}, not Feishu document {document_id!r}'
            )

        applied, failed = [], []
        remote_node_ids: Dict[str, Any] = {}
        for idx, hunk in enumerate(patch.hunks):
            hunk_id = f'hunk-{idx}'
            raw_blocks = fs._get_doc_blocks_raw(document_id, with_descendants=True)
            block_by_id = {block['block_id']: block for block in raw_blocks}
            target = block_by_id.get(hunk.target_node_id)
            if target is None:
                failed.append(hunk_id)
                continue

            current_text, _ = self._extract_feishu_text(target)
            if hunk.modify_type in ('replace', 'delete') and current_text != hunk.old_text:
                failed.append(hunk_id)
                continue

            if hunk.modify_type == 'replace':
                block = self._to_writer_block(target)
                self._replace_text(block, hunk.new_text or '', hunk.preserve_styles)
                self._update_remote_text(fs, document_id, block)
            elif hunk.modify_type == 'move':
                self._move_remote_blocks(fs, document_id, hunk, target, block_by_id)
            elif hunk.modify_type == 'insert':
                if hunk.position in ('inside_start', 'inside_end'):
                    parent_id = hunk.target_node_id
                    insert_index = 0 if hunk.position == 'inside_start' else len(target.get('children', []))
                else:
                    parent_id = target.get('parent_id')
                    parent = block_by_id.get(parent_id)
                    if parent is None or 'children' not in parent:
                        failed.append(hunk_id)
                        continue
                    target_index = parent['children'].index(hunk.target_node_id)
                    insert_index = target_index + (hunk.position == 'after')
                payloads = hunk.new_blocks or [PatchBlock(content=hunk.new_text or '')]
                created_ids = self._create_remote_blocks(
                    fs, document_id, parent_id, insert_index, payloads,
                )
                remote_node_ids[hunk_id] = created_ids[0] if len(created_ids) == 1 else created_ids
            elif hunk.modify_type == 'delete':
                parent_id = target.get('parent_id')
                parent = block_by_id.get(parent_id)
                if parent is None or 'children' not in parent:
                    failed.append(hunk_id)
                    continue
                child_ids = parent['children']
                target_index = child_ids.index(hunk.target_node_id)
                children_url = (
                    f'{fs._base_url}/docx/v1/documents/{document_id}'
                    f'/blocks/{parent_id}/children'
                )
                end_index = self._remote_section_end(
                    parent['children'], target_index, block_by_id,
                ) if hunk.include_section else target_index + 1
                fs._delete(f'{children_url}/batch_delete', json={
                    'start_index': target_index, 'end_index': end_index,
                })
            else:
                failed.append(hunk_id)
                continue
            applied.append(hunk_id)
            time.sleep(0.4)
        result = self._patch_result(patch, applied, failed)
        result.meta.update({
            'adapter': 'feishu',
            'model_representation': patch.meta.get('model_representation'),
            'writeback_mode': 'docx_block_api',
            'remote_node_ids': remote_node_ids,
        })
        return result

    @classmethod
    def _move_remote_blocks(cls, fs, document_id: str, hunk, target, block_by_id) -> List[str]:
        anchor = block_by_id.get(hunk.anchor.node_id if hunk.anchor else '')
        if anchor is None:
            raise ValueError(f'move anchor does not exist: {hunk.anchor.node_id!r}')
        parent_id = target.get('parent_id')
        parent = block_by_id.get(parent_id)
        if parent is None or anchor.get('parent_id') != parent_id:
            raise ValueError('Feishu block_move_after currently requires source and anchor siblings')

        child_ids = parent.get('children', [])
        source_index = child_ids.index(hunk.target_node_id)
        end_index = cls._remote_section_end(
            child_ids, source_index, block_by_id,
        ) if hunk.include_section else source_index + 1
        moved = child_ids[source_index:end_index]
        remaining = [node_id for node_id in child_ids if node_id not in moved]
        anchor_index = remaining.index(anchor['block_id'])
        if hunk.position == 'after':
            destination_id = anchor['block_id']
        elif hunk.position == 'before':
            destination_id = remaining[anchor_index - 1] if anchor_index else parent_id
        else:
            raise ValueError('Feishu block_move_after supports sibling before/after positions only')

        fs._put(f'{fs._base_url}/docs_ai/v1/documents/{document_id}', json={
            'block_id': destination_id,
            'command': 'block_move_after',
            'format': 'xml',
            'revision_id': -1,
            'src_block_ids': ','.join(moved),
        })
        return moved

    @classmethod
    def _create_remote_blocks(
        cls, fs, document_id: str, parent_id: str, index: int, blocks: List[PatchBlock],
    ) -> List[str]:
        children_url = (
            f'{fs._base_url}/docx/v1/documents/{document_id}/blocks/{parent_id}/children'
        )
        response = fs._post(children_url, json={
            'index': index,
            'children': [cls._patch_block_to_feishu(block) for block in blocks],
        })
        created = response.get('data', {}).get('children', [])
        if len(created) != len(blocks) or any(not block.get('block_id') for block in created):
            raise RuntimeError('Feishu did not return every created block ID')
        created_ids = [block['block_id'] for block in created]
        for created_block, patch_block in zip(created, blocks):
            if patch_block.children:
                cls._create_remote_blocks(
                    fs, document_id, created_block['block_id'], 0, patch_block.children,
                )
        return created_ids

    @classmethod
    def _patch_block_to_feishu(cls, block: PatchBlock) -> Dict[str, Any]:
        if block.type == 'heading':
            level = int(block.numbering.get('level', 1))
            if not 1 <= level <= 9:
                raise ValueError(f'Feishu heading level must be 1-9, got {level}')
            block_type = level + 2
        elif block.type == 'list_item':
            block_type = 13 if block.numbering.get('ordered') else 12
        else:
            block_type = _WRITER_TYPE_TO_FEISHU.get(block.type)
        if block_type is None or block_type == 1:
            raise ValueError(f'unsupported inserted Feishu block type: {block.type!r}')
        text_field = _FEISHU_TEXT_FIELDS[block_type]
        return {
            'block_type': block_type,
            text_field: {'elements': cls._spans_to_feishu_elements(block.content, block.spans)},
        }

    @staticmethod
    def _spans_to_feishu_elements(content: str, spans: List[WriterSpan]) -> List[Dict[str, Any]]:
        source_spans = spans or [WriterSpan(text=content)]
        elements = []
        for span in source_spans:
            text_run: Dict[str, Any] = {'content': span.text}
            style = {
                name: True for name in ('bold', 'italic', 'underline', 'strikethrough', 'inline_code')
                if name in span.style
            }
            if style:
                text_run['text_element_style'] = style
            elements.append({'text_run': text_run})
        return elements

    @classmethod
    def _update_remote_text(cls, fs, document_id: str, block: WriterBlock) -> None:
        url = f'{fs._base_url}/docx/v1/documents/{document_id}/blocks/{block.node_id}'
        fs._patch(url, json={'update_text_elements': {
            'elements': cls._spans_to_feishu_elements(block.content, block.spans),
        }})

    @classmethod
    def _remote_section_end(
        cls, child_ids: List[str], start: int, block_by_id: Dict[str, Dict[str, Any]],
    ) -> int:
        target_type = block_by_id[child_ids[start]].get('block_type')
        if not isinstance(target_type, int) or not 3 <= target_type <= 11:
            return start + 1
        target_level = target_type - 2
        for index in range(start + 1, len(child_ids)):
            block_type = block_by_id[child_ids[index]].get('block_type')
            if isinstance(block_type, int) and 3 <= block_type <= target_level + 2:
                return index
        return len(child_ids)

    # ==================== 私有：飞书读取与构造 ====================

    def _resolve_feishu(self, feishu_url: str):
        if not feishu_url.strip():
            raise ValueError('feishu_url is empty; fill FEISHU_DOCUMENT_URL in test.py')
        import lazyllm.tools.fs.client as _fs_client
        protocol, space_id, real_path = _fs_client.FS._parse(feishu_url)
        if protocol != 'feishu':
            raise ValueError(f'expected a Feishu URL, got protocol {protocol!r}')

        # 本地 POC 注入 app_id/app_secret 创建的 FeishuFS；
        # LazyMind 产品运行时未注入时，回退到 FS router 的动态用户 token 鉴权。
        configured_fs = self.adapters.get('feishu')
        if configured_fs is not None:
            return configured_fs, real_path
        return _fs_client.FS._get_or_create_fs(protocol, space_id, real_path), real_path

    @classmethod
    def _build_writer_blocks(cls, raw_blocks: List[Dict[str, Any]]) -> List[WriterBlock]:
        pairs = [(raw, cls._to_writer_block(raw)) for raw in raw_blocks if raw.get('block_id')]
        by_id = {block.node_id: block for _, block in pairs}
        roots: List[WriterBlock] = []
        for raw, block in pairs:
            parent_id = str(raw.get('parent_id') or '')
            if parent_id in by_id:
                by_id[parent_id].children.append(block)
            else:
                roots.append(block)
        return roots

    @classmethod
    def _to_writer_block(cls, raw: Dict[str, Any]) -> WriterBlock:
        raw_type = raw.get('block_type', 'block')
        block_type = _FEISHU_TYPE_MAP.get(raw_type, raw_type) if isinstance(raw_type, int) else str(raw_type)
        level = raw.get('level')
        if level is None and isinstance(raw_type, int) and 3 <= raw_type <= 11:
            level = raw_type - 2
        numbering = {'level': level} if level is not None else {}
        if raw_type in (12, 13):
            numbering['ordered'] = raw_type == 13
        source_refs = [{
            'source_block_id': str(raw.get('block_id', '')),
            'source_block_type': raw_type,
            'parent_id': str(raw.get('parent_id', '')),
        }]
        content, spans = cls._extract_feishu_text(raw)
        return WriterBlock(
            node_id=str(raw.get('block_id', '')),
            type=block_type,
            content=content,
            spans=spans,
            stage='final',
            numbering=numbering,
            source_refs=source_refs,
        )

    @staticmethod
    def _extract_feishu_text(raw: Dict[str, Any]) -> Tuple[str, List[WriterSpan]]:
        text_field = _FEISHU_TEXT_FIELDS.get(raw.get('block_type'))
        if text_field is None:
            return '', []
        elements = raw.get(text_field, {}).get('elements', [])
        spans: List[WriterSpan] = []
        for element in elements:
            text_run = element.get('text_run')
            if text_run is None:
                continue
            style_data = text_run.get('text_element_style', {})
            styles = [
                name for name in ('bold', 'italic', 'underline', 'strikethrough', 'inline_code')
                if style_data.get(name) is True
            ]
            if style_data.get('link'):
                styles.append('link')
            spans.append(WriterSpan(text=text_run.get('content', ''), style=styles))
        return ''.join(span.text for span in spans), spans

    @classmethod
    def _iter_blocks(cls, blocks: List[WriterBlock]):
        for block in blocks:
            yield block
            yield from cls._iter_blocks(block.children)

    @staticmethod
    def _patch_result(patch: PatchSet, applied: List[str], failed: List[str]) -> PatchResult:
        return PatchResult(
            patch_id=patch.patch_id,
            success=not failed,
            applied_hunks=applied,
            failed_hunks=failed,
            message='Patch applied.' if not failed else f'{len(failed)} hunk(s) failed.',
        )
