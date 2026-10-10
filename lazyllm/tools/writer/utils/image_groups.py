from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator
from lazyllm.thirdparty import frontmatter
from ..data_models.writer_ir import WriterBlock, WriterDocument


class ImageReference(BaseModel):
    model_config = ConfigDict(extra='forbid')
    source: str = Field(min_length=1)
    occurrence: int = Field(ge=0, strict=True)


class ImageGroup(BaseModel):
    model_config = ConfigDict(extra='forbid')
    images: list[ImageReference] = Field(min_length=2)
    layout: Literal['sliding', 'vertical']

    @model_validator(mode='after')
    def validate_images(self):
        keys = [(image.source, image.occurrence) for image in self.images]
        if len(keys) != len(set(keys)):
            raise ValueError('Image group contains duplicate references.')
        return self


def split_image_group_markdown(markdown: str) -> tuple[str, list[dict]]:
    post = frontmatter.loads(markdown)
    groups = [ImageGroup.model_validate(group).model_dump()
              for group in post.metadata.get('writer_image_groups', [])]
    return post.content if post.metadata else markdown, groups


def image_group_markdown(markdown: str, document: WriterDocument) -> str:
    groups = document.metadata.get('image_groups', [])
    if not groups:
        return markdown
    post = frontmatter.loads(markdown)
    post.metadata['writer_image_groups'] = groups
    return frontmatter.dumps(post) + '\n'


def strip_image_group_markdown(markdown: str) -> str:
    post = frontmatter.loads(markdown)
    if 'writer_image_groups' not in post.metadata:
        return markdown
    post.metadata.pop('writer_image_groups')
    return (frontmatter.dumps(post) if post.metadata else post.content) + '\n'


def image_source(block: WriterBlock) -> str:
    reference = next((ref for ref in block.references if ref.get('type') == 'media_asset'), None)
    if reference is None:
        reference = next((ref for ref in block.references if ref.get('type') in {'preview_asset', 'wechat_image'}), {})
    return str(reference.get('url') or reference.get('path') or reference.get('id') or '')


def sliding_image_groups(document: WriterDocument) -> dict[str, list[str]]:
    settings = [ImageGroup.model_validate(group) for group in document.metadata.get('image_groups', [])]
    sliding = {frozenset((image.source, image.occurrence) for image in group.images)
               for group in settings if group.layout == 'sliding'}
    counts: dict[str, int] = {}
    result: dict[str, list[str]] = {}

    def visit(blocks: list[WriterBlock]) -> None:
        members: list[WriterBlock] = []
        keys: list[tuple[str, int]] = []

        def finish() -> None:
            if len(members) >= 2 and frozenset(keys) in sliding:
                result[members[0].node_id] = [member.node_id for member in members]
            members.clear()
            keys.clear()

        for block in blocks:
            if block.type == 'image' and not block.children:
                source = image_source(block)
                occurrence = counts.get(source, 0)
                counts[source] = occurrence + 1
                members.append(block)
                keys.append((source, occurrence))
            else:
                finish()
                visit(block.children)
        finish()

    visit(document.blocks)
    return result


def image_group_references(document: WriterDocument) -> dict[str, dict]:
    counts: dict[str, int] = {}
    references: dict[str, dict] = {}
    for block in document.iter_blocks():
        if block.type != 'image':
            continue
        source = image_source(block)
        occurrence = counts.get(source, 0)
        counts[source] = occurrence + 1
        references[block.node_id] = {'source': source, 'occurrence': occurrence}
    return references
