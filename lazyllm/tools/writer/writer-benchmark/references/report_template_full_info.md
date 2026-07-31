# WriterAgent性能分析

## 核心流程

1. trigger_writer_plugin：理解用户写作请求，匹配并启动 Writer Plugin，返回可执行的工作流和首个步骤信息。

2. writer_build_writing_task：将自然语言写作需求标准化为 WritingTask，包含任务类型、主题和目标文档约束。

3. writer_profile_resources：收集用户附件、已有文档和可用资源，并形成资源画像。

4. writer_create_writing_context：构建统一写作上下文。

5. writer_generate_outline：根据写作任务和上下文生成结构化 WriterDocument 大纲，确定文档标题、章节及其层级关系。

6. writer_update_writing_context：将最新大纲写回写作上下文。

7. writer_generate_section_instructions：为每个大纲章节生成写作目标、必备要点、风格约束、事实限制和预期内容块。

8. writer_generate_draft_blocks：按章节顺序生成各章节的 WriterBlock 草稿；每章都携带前序正文，以保持上下文连贯。

9. writer_generate_draft_document：按章节顺序合并所有 Draft Block，形成完整的 Draft WriterDocument。

10. writer_update_writing_context：将完整草稿的摘要和状态写回上下文，为最终文档生成提供最新输入。

11. writer_generate_final_document：将 Draft 文档转化为最终 WriterDocument，并生成最终 Markdown 内容。

12. writer_export_markdown：将最终文档导出为可下载的 Markdown 文件。

## 耗时统计

|操作|Input Token|Output Token|平均耗时|LLM调用次数|
|---|---|---|---|---|
|全链路|67,110|19,464|639.252 s|54|
|Agent React|||271.400 s|44|
|trigger_writer_plugin|1,949|639|11.277 s|1|
|writer_generate_outline|1,571|1,741|21.942 s|1|
|writer_generate_section_instructions|8,687|2,845|53.635 s|1|
|writer_generate_draft_blocks|54,903|14,239|289.522 s|7|
|draft_block-1|4,217|1,122|21.369 s|1|
|draft_block-2|4,899|1,696|34.096 s|1|
|draft_block-3|6,101|2,391|52.663 s|1|
|draft_block-4|8,021|1,589|33.121 s|1|
|draft_block-5|9,182|2,902|60.752 s|1|
|draft_block-6|11,303|2,414|53.367 s|1|
|draft_block-7|11,180|2,125|34.155 s|1|

## 原因分析

1. Agent React：ChatAgent 及各 advance_step 内 SubAgent 的所有 React 行为，职责包括判断下一步、读取前一步结果、组织工具参数、保存工作流产物、生成用户可见回复。调用次数多且贯穿全链路，是总耗时的主要来源之一。

2. trigger_writer_plugin：从用户长请求中识别写作意图、确认插件适用性，生成包含步骤索引和启动策略的结构化结果。输入输出规模不大，属于固定启动成本。

3. writer_generate_outline：生成完整文档树而非仅章节标题，还需输出各章节层级、节点 ID 和内容要点，并满足 WriterDocument JSON Schema。结构化输出造成一定耗时。

4. writer_generate_section_instructions：同时读取完整大纲、写作上下文和结构化输出 Schema，一次产出所有章节的目标、必备要点、风格与事实约束。是正文生成前最重的单次模型调用。

5. writer_generate_draft_blocks：按章节顺序串行生成正文，每章将已完成章节作为 previous_blocks 注入 prompt。随章节推进，输入持续增长、输出累加，且各章严格串行，因此是全链路最大的单步耗时来源。单次调用耗时因章节内容密度和前文长度差异较大，范围从首章的较低值到信息密集章节的较高值不等。

# 基于大纲写作

## 核心流程

1. trigger_writer_plugin：理解用户“基于已有大纲撰写完整文章”的请求，选择 Writer Plugin，并返回可执行的工作流和首个步骤信息。

2. writer_build_writing_task：将用户请求标准化为 WritingTask，记录写作目标、主题和交付约束。

3. writer_load_document：读取用户提供的 Feishu 大纲，并将云端文档解析为 source_ir.json；该产物的语义是大纲，而不是待重新生成的大纲。

4. writer_profile_resources：资源画像。

5. writer_create_writing_context：基于任务、资源画像和 source_ir 构建 WritingContext，保存文档摘要、事实约束和写作状态。

6. writer_prepare_outline：将 source_ir 规范化并标记为 outline-stage 的 outline_ir；该步骤不调用 LLM，也不重新生成大纲内容，是把给定大纲接入后续写作流程的必要 IR 转换。

7. writer_update_writing_context：将规范化后的 outline_ir 写回上下文，使章节写作能够使用确定的大纲结构。

8. writer_generate_section_instructions：基于给定大纲和写作上下文，为每个章节生成写作目标、必备要点、风格约束、事实限制和预期内容块。

9. writer_generate_draft_blocks：按章节顺序生成各章节的 WriterBlock 草稿；每章都会携带已完成章节，以维持前后文连贯。

10. writer_generate_draft_document：将全部 Draft Block 按顺序合并为完整的 Draft WriterDocument。

11. writer_update_writing_context：将完整草稿的摘要和状态写回上下文，为最终文档生成提供最新输入。

12. writer_generate_final_document：将 Draft 文档转化为最终 WriterDocument，并生成最终 Markdown 内容。

13. writer_export_markdown：将最终文档导出为可下载的 Markdown 文件；用户仅将 Feishu URL 作为大纲来源，未明确要求写回 Feishu，因此采用默认 Markdown 交付。

## 耗时统计

|操作|Input Token|Output Token|平均耗时|LLM调用次数|
|---|---|---|---|---|
|全链路|130,131|18,551|506.867 s|41|
|Agent React|||172.692 s|32|
|trigger_writer_plugin|1,920|472|8.449 s|1|
|writer_profile_resources|2,329|1,886|22.886 s|1|
|writer_generate_section_instructions|23,300|2,236|31.438 s|1|
|writer_generate_draft_blocks|102,582|13,957|290.330 s|6|
|draft_block-1|12,445|1,164|21.505 s|1|
|draft_block-2|13,170|1,984|42.186 s|1|
|draft_block-3|14,797|2,657|54.829 s|1|
|draft_block-4|17,207|2,499|53.441 s|1|
|draft_block-5|19,473|2,529|52.053 s|1|
|draft_block-6|25,490|3,124|66.317 s|1|

## 原因分析

1. Agent React：同上

2. trigger_writer_plugin：同上

3. writer_profile_resources：读取用户请求和已加载大纲，转化为资源画像。输入输出规模中等，耗时稳定。

4. writer_generate_section_instructions：读取完整给定大纲 \+ WritingContext \+ 输出 Schema，一次生成全部章节约束。给定大纲本身内容详细导致输入较大，是正文前最重的单次调用。

5. writer_generate_draft_blocks：按章节顺序串行生成正文，每章将已完成章节作为 previous_blocks 注入 prompt。随章节推进，输入持续增长、输出累加，且各章严格串行，因此是全链路最大的单步耗时来源。给定大纲较详细，使得每章的输入基数高于场景一，整体耗时更高。

# 局部修改文档

## 核心流程

1. trigger_writer_plugin：理解用户对既有飞书文档的局部修改请求，选择 Writer Plugin，并返回可执行工作流和首个步骤信息。

2. writer_build_writing_task：将请求标准化为 WritingTask，记录文档来源、修改目标和交付约束。

3. writer_load_document：读取原飞书文档并解析为`source_ir.json`，为后续定位和补丁生成提供可编辑的 WriterDocument。

4. writer_profile_resources：汇总用户修改要求、原文档内容和可用资源，生成资源画像，以约束修改内容的事实、范围和风格。

5. writer_create_writing_context：基于修订任务、原文档和资源画像构建 WritingContext，保存文档摘要、上下文和修订状态。

6. writer_build_revision_task：将写作任务转换为 RevisionTask，明确该任务为对现有 WriterDocument 的结构化修订。

7. writer_locate_revision_target：在原文档 IR 中定位用户指定的章节、锚点和待修改范围，产出可供计划步骤使用的定位结果。

8. writer_generate_modify_plan：根据定位结果、原文档和写作上下文生成修改计划，确定创建、更新、删除或移动等具体操作及其顺序。

9. writer_generate_patch_set：为修改计划中的每项指令生成结构化 PatchSet，包括新内容、目标节点和插入位置。

10. writer_apply_revision：在内存中的 WriterDocument 上应用 PatchSet，并校验补丁执行结果，得到修订后的文档 IR。

11. writer_update_writing_context：将修订后文档的摘要和状态写回 WritingContext，保证发布阶段使用最新版本。

12. writer_publish_revision：将验证后的修订结果发布回原飞书文档；该场景明确要求直接修改原文档而非创建新文档。

## 耗时统计

|操作|Input Token|Output Token|平均耗时|LLM调用次数|
|---|---|---|---|---|
|全链路|91,898|5,399|236.721 s|41|
|Agent React|||148.802 s|36|
|trigger_writer_plugin|1,989|660|10.711 s|1|
|writer_profile_resources|6,051|1,693|24.027 s|1|
|writer_locate_revision_target|10,819|824|12.925 s|1|
|writer_generate_modify_plan|36,590|1,386|21.206 s|1|
|writer_generate_patch_set|36,449|836|10.351 s|1|

## 原因分析

1. Agent React：同上

2. trigger_writer_plugin：同上

3. writer_profile_resources：读取用户修改要求 \+ 完整原文档，提取可复用事实、风格和边界约束。输入输出规模中等。

4. writer_locate_revision_target：在原文档 IR 中匹配用户指向的章节、子节点及相邻锚点，定位结果须与节点 ID 精确对应。

5. writer_generate_modify_plan：注入完整原文档 \+ 定位结果 \+ WritingContext \+ 修改计划 Schema，规划每项补丁的操作类型和顺序。输入规模大，是 Writer 语义步骤中输入最大的单次调用。

6. writer_generate_patch_set：再次读取原文档 \+ 上下文 \+ 修改计划，生成实际替换 / 插入内容和精确节点引用。输入规模与计划步骤相近，但输出较少，故耗时低于计划阶段。

