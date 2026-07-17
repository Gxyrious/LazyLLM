from __future__ import annotations

from typing import Any, Dict, List, Tuple

from ..data_models.docir import DocBlock, DocIR
from ..data_models.revision import ModifyPlan, PatchResult, PatchSet
from ..data_models.task import TargetDocument, WritingTask
from ..tools.base import WriterToolBase
from ..utils import to_prompt_json
from .model_adapters import MarkdownModelAdapter, StructuredModelAdapter


_FEISHU_BLOCK_TYPES = {
    1: 'document', 2: 'paragraph',
    3: 'heading', 4: 'heading', 5: 'heading', 6: 'heading', 7: 'heading',
    8: 'heading', 9: 'heading', 10: 'heading', 11: 'heading',
    12: 'list_item', 13: 'list_item', 14: 'code', 15: 'quote',
    27: 'image', 31: 'table', 32: 'table_cell',
}
_VALID_BLOCK_TYPES = set(DocBlock.model_fields['block_type'].annotation.__args__)


class IRExperimentTools(WriterToolBase):
    '''唯一 Block IR 与两种模型边界适配器的实验骨架。'''

    __public_apis__ = [
        'read_docir',
        'generate_modify_plan_structure',
        'generate_modify_plan_markdown',
        'generate_patch_structure',
        'generate_patch_markdown',
        'apply_patch',
        'write_patch_to_feishu',
    ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.structured_model_adapter = StructuredModelAdapter()
        self.markdown_model_adapter = MarkdownModelAdapter()

    # ==================== 共用：飞书只转换为唯一 Block IR ====================

    def read_docir(self, feishu_url: str) -> DocIR:
        '''读取飞书文档并构造唯一树状 Block IR。'''
        fs, real_path = self._resolve_feishu(feishu_url)
        resolved = fs.resolve_link(real_path) or {}
        doc_id = fs.get_document_id(real_path)
        raw_blocks = fs.get_doc_blocks(real_path, with_descendants=True) or []
        blocks = self._build_block_tree(raw_blocks)
        return DocIR(
            doc_id=doc_id,
            source=TargetDocument(
                doc_id=doc_id,
                uri=feishu_url,
                adapter='feishu',
                title=resolved.get('title') or None,
            ),
            title=resolved.get('title') or None,
            blocks=blocks,
            plain_text='\n'.join(block.text for block in self._iter_blocks(blocks) if block.text),
            adapter='feishu',
            meta={
                'block_count': sum(1 for _ in self._iter_blocks(blocks)),
            },
        )

    # ==================== 适配器实验：理解需求并生成 ModifyPlan ====================
    # 两个入口便于分别统计模型读取结构化表示和 Markdown 投影时的效果。

    def generate_modify_plan_structure(self, task: Any, doc_ir: Any) -> ModifyPlan:
        '''结构化路线：模型直接读取 Block IR。'''
        document = self._unified_model(doc_ir, DocIR)
        model_input = self.structured_model_adapter.document_to_model_input(document)
        return self._generate_modify_plan(task, document, model_input, 'structured Block IR')

    def generate_modify_plan_markdown(self, task: Any, doc_ir: Any) -> ModifyPlan:
        '''Markdown 路线：模型读取由同一 Block IR 生成的 Markdown 投影。'''
        document = self._unified_model(doc_ir, DocIR)
        model_input = self.markdown_model_adapter.document_to_model_input(document)
        return self._generate_modify_plan(task, document, model_input, 'Markdown projection')

    # ==================== 适配器实验：根据 Plan 生成统一 Patch ====================
    # Patch 阶段不再直接读取用户任务，必须忠实执行上一阶段的 ModifyPlan。

    def generate_patch_structure(self, modify_plan: Any, doc_ir: Any) -> PatchSet:
        '''结构化路线：模型直接生成统一 IR Patch。'''
        document = self._unified_model(doc_ir, DocIR)
        model_input = self.structured_model_adapter.document_to_model_input(document)
        model_output = self._generate_structured_patch(modify_plan, model_input, 'structured Block IR')
        return self.structured_model_adapter.model_output_to_patch(model_output, document)

    def generate_patch_markdown(self, modify_plan: Any, doc_ir: Any) -> PatchSet:
        '''Markdown 路线：模型生成 Markdown diff，适配器再编译为统一 IR Patch。'''
        document = self._unified_model(doc_ir, DocIR)
        model_input = self.markdown_model_adapter.document_to_model_input(document)
        model_output = self._generate_markdown_diff(modify_plan, model_input)
        return self.markdown_model_adapter.model_output_to_patch(model_output, document)

    # ==================== 共用：Patch 只应用到唯一 Block IR ====================

    def apply_patch(self, doc_ir: Any, patch_set: Any) -> Tuple[DocIR, PatchResult]:
        '''共用：按 block_id 将统一 PatchSet 应用到 Block IR。'''
        document = self._unified_model(doc_ir, DocIR).model_copy(deep=True)
        patch = self._unified_model(patch_set, PatchSet)
        if patch.target_doc_id != (document.doc_id or ''):
            raise ValueError(f'patch targets {patch.target_doc_id!r}, not {document.doc_id!r}')

        block_map = {block.block_id: block for block in self._iter_blocks(document.blocks)}
        applied, failed = [], []
        for hunk in patch.hunks:
            hunk_id = hunk.hunk_id or hunk.target_block_id or ''
            target = block_map.get(hunk.target_block_id or '')
            if hunk.modify_type != 'replace' or target is None or hunk.old_text != target.text:
                failed.append(hunk_id)
                continue
            target.text = hunk.new_text or ''
            target.spans = []
            applied.append(hunk_id)

        document.plain_text = '\n'.join(
            block.text for block in self._iter_blocks(document.blocks) if block.text
        )
        return document, self._patch_result(patch, applied, failed)

    # ==================== 共用：统一 IR Patch 写回飞书 ====================

    def write_patch_to_feishu(self, feishu_url: str, patch_set: Any) -> PatchResult:
        return self._write_patch_to_feishu(feishu_url, patch_set)

    # ==================== 共用能力：任务约束、LLM 调用、Patch 输出格式 ====================

    def _generate_modify_plan(
        self, task: Any, document: DocIR, model_input: str, representation_name: str,
    ) -> ModifyPlan:
        '''共用 Plan 模型调用；实验只改变模型看到的表示。'''
        writing_task = self._unified_model(task, WritingTask)
        prompt = f'''You are planning a local document revision using {representation_name}.
Understand the user request and return a ModifyPlan before any patch is generated.
Locate every block involved in the requested insert, replace, or delete operation, including insertion
anchors and blocks whose numbering or cross-references may be affected. Use only block_ids present in
the document. Keep the scope minimal and put instructions in their required execution order.

Writing task:
{to_prompt_json(writing_task)}

Document IR:
{model_input}
'''
        plan = self._call_llm_structured(prompt, ModifyPlan)
        block_ids = {block.block_id for block in self._iter_blocks(document.blocks)}
        referenced_ids = plan.target_block_ids + [item.target_block_id for item in plan.instructions]
        missing = [block_id for block_id in referenced_ids if block_id not in block_ids]
        if missing:
            raise ValueError(f'modify plan targets block_ids absent from Block IR: {missing}')
        plan.meta['model_representation'] = representation_name
        return plan

    def _generate_structured_patch(
        self, modify_plan: Any, model_input: str, representation_name: str,
    ) -> PatchSet:
        '''共用 Patch 模型调用；Patch 必须忠实实现 ModifyPlan。'''
        plan = self._unified_model(modify_plan, ModifyPlan)
        prompt = f'''You are compiling an approved ModifyPlan into an executable PatchSet using
{representation_name}.
Produce exactly one PatchHunk for each ModifyInstruction, in the same order. Copy target_block_id and
modify_type from the instruction. For replace, return the complete replacement text and exact old_text.
For insert, target_block_id is the existing anchor block and new_text is the complete inserted content.
For delete, return exact old_text and leave new_text null. Do not add operations absent from the plan.

Modify plan:
{to_prompt_json(plan)}

Document IR:
{model_input}
'''
        return self._call_llm_structured(prompt, PatchSet)

    def _generate_markdown_diff(self, modify_plan: Any, markdown: str) -> str:
        '''Markdown 路线共用模型调用；原始输出由 Markdown 适配器解析。'''
        if self.llm is None:
            raise ValueError('llm is not set')
        plan = self._unified_model(modify_plan, ModifyPlan)
        prompt = f'''Apply the approved ModifyPlan to the Markdown document.
Return only a unified diff against the supplied Markdown. Do not return the full document.

Modify plan:
{to_prompt_json(plan)}

Markdown document:
{markdown}
'''
        return self.llm(prompt)

    def _write_patch_to_feishu(self, feishu_url: str, patch_set: Any) -> PatchResult:
        '''共用飞书写回；当前只验证已有 Block 的纯文本 replace。'''
        patch = self._unified_model(patch_set, PatchSet)
        fs, real_path = self._resolve_feishu(feishu_url)
        document_id = fs.get_document_id(real_path)
        if patch.target_doc_id != document_id:
            raise ValueError(f'patch targets {patch.target_doc_id!r}, not Feishu document {document_id!r}')

        current_blocks = {
            str(block.get('block_id') or ''): str(block.get('plain_text') or '')
            for block in fs.get_doc_blocks(real_path, with_descendants=True) or []
        }
        applied, failed = [], []
        for hunk in patch.hunks:
            hunk_id = hunk.hunk_id or hunk.target_block_id or ''
            target_id = hunk.target_block_id or ''
            if hunk.modify_type != 'replace' or current_blocks.get(target_id) != hunk.old_text:
                failed.append(hunk_id)
                continue
            fs.update_doc_block_text(real_path, target_id, hunk.new_text or '')
            applied.append(hunk_id)
        result = self._patch_result(patch, applied, failed)
        result.meta.update({
            'adapter': 'feishu',
            'model_representation': patch.meta.get('model_representation'),
            'writeback_mode': 'patch_direct_to_block',
            'warning': 'Current FeishuFS writes one unstyled text run.',
        })
        return result

    def _resolve_feishu(self, feishu_url: str):
        '''共用 FeishuFS 路由入口；本地实验优先使用显式注入的应用鉴权实例。'''
        if not feishu_url.strip():
            raise ValueError('feishu_url is empty; fill FEISHU_DOCUMENT_URL in test.py')
        import lazyllm.tools.fs.client as _fs_client
        protocol, space_id, real_path = _fs_client.FS._parse(feishu_url)
        if protocol != 'feishu':
            raise ValueError(f'expected a Feishu URL, got protocol {protocol!r}')

        # 共用扩展点：本地 POC 注入 app_id/app_secret 创建的 FeishuFS；
        # LazyMind 产品运行时未注入时，才回退到 FS router 的动态用户 token 鉴权。
        configured_fs = self.adapters.get('feishu')
        if configured_fs is not None:
            return configured_fs, real_path
        return _fs_client.FS._get_or_create_fs(protocol, space_id, real_path), real_path

    @classmethod
    def _build_block_tree(cls, raw_blocks: List[Dict[str, Any]]) -> List[DocBlock]:
        '''结构化路线私有实现：根据 parent_id 恢复 Block 树。'''
        pairs = [(raw, cls._to_doc_block(raw)) for raw in raw_blocks if raw.get('block_id')]
        by_id = {block.block_id: block for _, block in pairs}
        roots = []
        for raw, block in pairs:
            parent_id = str(raw.get('parent_id') or '')
            if parent_id in by_id:
                by_id[parent_id].children.append(block)
            else:
                roots.append(block)
        return roots

    @staticmethod
    def _to_doc_block(raw: Dict[str, Any]) -> DocBlock:
        '''结构化路线私有实现：飞书简化 Block 转 DocBlock。'''
        raw_type = raw.get('block_type', 'block')
        block_type = _FEISHU_BLOCK_TYPES.get(raw_type, raw_type) if isinstance(raw_type, int) else raw_type
        if block_type not in _VALID_BLOCK_TYPES:
            block_type = 'block'
        level = raw.get('level')
        if level is None and isinstance(raw_type, int) and 3 <= raw_type <= 11:
            level = raw_type - 2
        return DocBlock(
            block_id=str(raw.get('block_id') or ''),
            block_type=block_type,
            text=str(raw.get('plain_text') or ''),
            level=level,
            meta={
                'source_block_id': str(raw.get('block_id') or ''),
                'source_block_type': raw_type,
                'parent_id': str(raw.get('parent_id') or ''),
            },
        )

    @classmethod
    def _iter_blocks(cls, blocks: List[DocBlock]):
        '''结构化路线私有实现：遍历树状 DocIR。'''
        for block in blocks:
            yield block
            yield from cls._iter_blocks(block.children)

    @staticmethod
    def _patch_result(patch: PatchSet, applied: List[str], failed: List[str]) -> PatchResult:
        '''共用 PatchResult 构造。'''
        return PatchResult(
            patch_id=patch.patch_id,
            success=not failed,
            applied_hunks=applied,
            failed_hunks=failed,
            message='Patch applied.' if not failed else f'{len(failed)} hunk(s) failed.',
        )
