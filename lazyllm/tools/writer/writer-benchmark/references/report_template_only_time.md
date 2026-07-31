# WriterAgent性能分析

## 核心流程

1. trigger_writer_plugin
2. writer_build_writing_task
3. writer_profile_resources
4. writer_create_writing_context
5. writer_generate_outline
6. writer_update_writing_context
7. writer_generate_section_instructions
8. writer_generate_draft_blocks
9. writer_generate_draft_document
10. writer_update_writing_context
11. writer_generate_final_document
12. writer_export_markdown

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

# 基于大纲写作

## 核心流程

1. trigger_writer_plugin
2. writer_build_writing_task
3. writer_load_document
4. writer_profile_resources
5. writer_create_writing_context
6. writer_prepare_outline
7. writer_update_writing_context
8. writer_generate_section_instructions
9. writer_generate_draft_blocks
10. writer_generate_draft_document
11. writer_update_writing_context
12. writer_generate_final_document
13. writer_export_markdown

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

# 局部修改文档

## 核心流程

1. trigger_writer_plugin
2. writer_build_writing_task
3. writer_load_document
4. writer_profile_resources
5. writer_create_writing_context
6. writer_build_revision_task
7. writer_locate_revision_target
8. writer_generate_modify_plan
9. writer_generate_patch_set
10. writer_apply_revision
11. writer_update_writing_context
12. writer_publish_revision

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
