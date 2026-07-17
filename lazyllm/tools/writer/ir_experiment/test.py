from __future__ import annotations

import pytest

from ..data_models.task import WritingTask
from .experiment_tools import IRExperimentTools


# Fill these credentials manually before running the live experiment.
FEISHU_DOCUMENT_URL = ''
FEISHU_APP_ID = ''
FEISHU_APP_SECRET = ''
# 当前 FeishuWikiFS 的文档 Block 接口需要知识库 space_id，例如 wikcn... 。
FEISHU_WIKI_SPACE_ID = ''
QWEN_API_KEY = ''
LLM_MODEL = ''
WRITE_BACK = False

REVISION_QUERY = (
    '只修改“实施方案”章节中的交付时间，'
    '把“项目按期交付”改成“项目计划于九月底交付”。'
)


def _build_task() -> WritingTask:
    return WritingTask(
        task_id='structure-experiment-1',
        task_type='revise',
        query=REVISION_QUERY,
    )


def run_structure_experiment():
    if not FEISHU_DOCUMENT_URL:
        raise ValueError('Fill FEISHU_DOCUMENT_URL before running the experiment.')
    if not FEISHU_APP_ID or not FEISHU_APP_SECRET:
        raise ValueError('Fill FEISHU_APP_ID and FEISHU_APP_SECRET before running the experiment.')
    if not FEISHU_WIKI_SPACE_ID:
        raise ValueError('Fill FEISHU_WIKI_SPACE_ID required by the current FeishuWikiFS block API.')
    if not QWEN_API_KEY:
        raise ValueError('Fill QWEN_API_KEY before running the experiment.')

    import lazyllm
    from lazyllm.tools.fs.supplier.feishu import FeishuFS

    llm_kwargs = {
        'source': 'qwen',
        'api_key': QWEN_API_KEY,
        'stream': False,
    }
    if LLM_MODEL:
        llm_kwargs['model'] = LLM_MODEL
    # 本地实验使用飞书应用鉴权，FeishuFS 内部负责获取和刷新 tenant_access_token。
    feishu_fs = FeishuFS(
        app_id=FEISHU_APP_ID,
        app_secret=FEISHU_APP_SECRET,
        space_id=FEISHU_WIKI_SPACE_ID,
        dynamic_auth=False,
    )
    tool = IRExperimentTools(
        llm=lazyllm.OnlineChatModule(**llm_kwargs),
        adapters={'feishu': feishu_fs},
    )

    doc_ir = tool.read_docir(FEISHU_DOCUMENT_URL)
    modify_plan = tool.generate_modify_plan_structure(_build_task(), doc_ir)
    patch_set = tool.generate_patch_structure(modify_plan, doc_ir)
    revised_doc_ir, apply_result = tool.apply_patch(doc_ir, patch_set)
    write_result = None
    if WRITE_BACK:
        write_result = tool.write_patch_to_feishu(FEISHU_DOCUMENT_URL, patch_set)

    print('ModifyPlan:')
    print(modify_plan.model_dump_json(indent=2))
    print('PatchSet:')
    print(patch_set.model_dump_json(indent=2))
    print('Local apply:')
    print(apply_result.model_dump_json(indent=2))
    if write_result:
        print('Feishu writeback:')
        print(write_result.model_dump_json(indent=2))
    return {
        'source_docir': doc_ir,
        'modify_plan': modify_plan,
        'patch_set': patch_set,
        'revised_docir': revised_doc_ir,
        'apply_result': apply_result,
        'write_result': write_result,
    }


def run_md_experiment():
    raise NotImplementedError('Reserved for the Markdown model adapter implementation.')


@pytest.mark.skipif(
    not (
        FEISHU_DOCUMENT_URL
        and FEISHU_APP_ID
        and FEISHU_APP_SECRET
        and FEISHU_WIKI_SPACE_ID
        and QWEN_API_KEY
    ),
    reason='Fill live Feishu and Qwen credentials in test.py.',
)
def test_structure_live():
    result = run_structure_experiment()
    assert result['modify_plan'].instructions
    assert result['patch_set'].hunks
    assert result['apply_result'].success is True


if __name__ == '__main__':
    run_structure_experiment()
