from __future__ import annotations

from collections.abc import Iterable
from copy import deepcopy
from html import escape, unescape
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urlsplit

from lazyllm.thirdparty import mistune

from ..data_models.revision import PatchHunk
from ..data_models.writer_ir import WriterBlock, WriterDocument, WriterSpan, WriterStage
from ..numbering import (
    NumberingEntry,
    build_numbering_view_from_ir,
    compute_numbering,
    format_target_number,
)
from ..utils import strip_heading_numbering
from .base import NativeBlock, NativePatchOperation, WriterAdapterBase

_TABLE_MARKDOWN = mistune.create_markdown(escape=True, plugins=['table'])
_VOID_TAGS = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}
_KNOWN_INLINE_TAGS = {'a', 'b', 'br', 'code', 'del', 'em', 'i', 's', 'span', 'strong', 'sub', 'sup', 'u'}
_KNOWN_BLOCK_TAGS = {'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'ol', 'p', 'pre', 'table', 'ul'}


class _HtmlNode:
    def __init__(
        self,
        tag: str,
        start: int,
        start_end: int,
        *,
        attrs: dict[str, str] | None = None,
        text: str = '',
    ) -> None:
        self.tag = tag
        self.start = start
        self.start_end = start_end
        self.end = start_end
        self.attrs = attrs or {}
        self.text = text
        self.children: list[_HtmlNode] = []


class _WeChatHTMLParser(HTMLParser):
    """Parse HTML while retaining source offsets for lossless block fragments."""

    def __init__(self, source: str) -> None:
        super().__init__(convert_charrefs=False)
        self.source = source
        self._line_starts = [0]
        self._line_starts.extend(index + 1 for index, value in enumerate(source) if value == '\n')
        self.root = _HtmlNode('#root', 0, 0)
        self.stack = [self.root]

    def _offset(self) -> int:
        line, column = self.getpos()
        return self._line_starts[line - 1] + column

    def _tag_end(self, start: int) -> int:
        end = self.source.find('>', start)
        return len(self.source) if end < 0 else end + 1

    def _append(self, node: _HtmlNode) -> None:
        self.stack[-1].children.append(node)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        start = self._offset()
        start_end = self._tag_end(start)
        node = _HtmlNode(
            tag.lower(), start, start_end,
            attrs={str(key).lower(): '' if value is None else str(value) for key, value in attrs},
        )
        self._append(node)
        if node.tag not in _VOID_TAGS:
            self.stack.append(node)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        start = self._offset()
        start_end = self._tag_end(start)
        self._append(_HtmlNode(
            tag.lower(), start, start_end,
            attrs={str(key).lower(): '' if value is None else str(value) for key, value in attrs},
        ))

    def handle_endtag(self, tag: str) -> None:
        start = self._offset()
        end = self._tag_end(start)
        tag = tag.lower()
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                for node in self.stack[index:]:
                    node.end = start
                self.stack = self.stack[:index]
                self.stack[-1].children[-1].end = end
                return

    def handle_data(self, data: str) -> None:
        start = self._offset()
        self._append(_HtmlNode('#text', start, start + len(data), text=data))

    def handle_entityref(self, name: str) -> None:
        start = self._offset()
        raw = self.source[start:self._tag_end(start)]
        raw = raw[:raw.find(';') + 1] if ';' in raw else f'&{name};'
        self._append(_HtmlNode('#text', start, start + len(raw), text=raw))

    def handle_charref(self, name: str) -> None:
        self.handle_entityref(f'#{name}')

    def handle_comment(self, data: str) -> None:
        start = self._offset()
        self._append(_HtmlNode('#raw', start, self._tag_end(start), text=self.source[start:self._tag_end(start)]))

    def handle_decl(self, decl: str) -> None:
        start = self._offset()
        self._append(_HtmlNode('#raw', start, self._tag_end(start), text=self.source[start:self._tag_end(start)]))

    def close(self) -> None:
        super().close()
        for node in self.stack[1:]:
            node.end = len(self.source)


def _html_raw(source: str, node: _HtmlNode) -> str:
    return source[node.start:node.end]


def _element_children(node: _HtmlNode) -> list[_HtmlNode]:
    return [child for child in node.children if child.tag != '#text' or child.text.strip()]


def _node_text(node: _HtmlNode) -> str:
    if node.tag == '#text':
        return unescape(node.text)
    if node.tag == 'br':
        return '\n'
    return ''.join(_node_text(child) for child in node.children)


def _descendants(node: _HtmlNode, tag: str) -> Iterable[_HtmlNode]:
    for child in node.children:
        if child.tag == tag:
            yield child
        yield from _descendants(child, tag)


def _inline_style(node: _HtmlNode) -> dict[str, Any]:
    style: dict[str, Any] = {}
    if node.tag in {'b', 'strong'}:
        style['bold'] = True
    if node.tag in {'i', 'em'}:
        style['italic'] = True
    if node.tag in {'del', 's'}:
        style['strikethrough'] = True
    if node.tag == 'code':
        style['inline_code'] = True
    if node.tag == 'u':
        style['underline'] = True
    if node.tag == 'sub':
        style['subscript'] = True
    if node.tag == 'sup':
        style['superscript'] = True
    css = node.attrs.get('style', '')
    if css:
        style['wechat_css'] = css
        for declaration in css.split(';'):
            if ':' not in declaration:
                continue
            key, value = (item.strip().lower() for item in declaration.split(':', 1))
            if key == 'font-weight' and value in {'bold', '700', '800', '900'}:
                style['bold'] = True
            elif key == 'font-style' and value == 'italic':
                style['italic'] = True
            elif key == 'text-decoration' and 'line-through' in value:
                style['strikethrough'] = True
    if node.tag == 'a' and node.attrs.get('href'):
        style['link'] = {'url': node.attrs['href']}
    return style


def _inline_content(node: _HtmlNode, inherited: dict[str, Any] | None = None) -> tuple[str, list[WriterSpan], list[dict[str, Any]]]:
    content = ''
    spans: list[WriterSpan] = []
    references: list[dict[str, Any]] = []
    current_style = dict(inherited or {})
    current_style.update(_inline_style(node))
    if node.tag == '#text':
        text = unescape(node.text)
        if text:
            if spans and spans[-1].style == current_style:
                spans[-1].text += text
            else:
                spans.append(WriterSpan(text=text, style=current_style))
            return text, spans, references
        return '', spans, references
    if node.tag == 'br':
        return '\n', [WriterSpan(text='\n', style=current_style)], [{'type': 'hard_break', 'offset': 0}]
    for child in node.children:
        child_content, child_spans, child_refs = _inline_content(child, current_style)
        start = len(content)
        content += child_content
        for span in child_spans:
            if spans and spans[-1].style == span.style:
                spans[-1].text += span.text
            else:
                spans.append(span)
        for reference in child_refs:
            adjusted = dict(reference)
            if 'start' in adjusted:
                adjusted['start'] = int(adjusted['start']) + start
                adjusted['end'] = int(adjusted['end']) + start
            elif 'offset' in adjusted:
                adjusted['offset'] = int(adjusted['offset']) + start
            references.append(adjusted)
    if node.tag == 'a' and node.attrs.get('href') and content:
        references.append({'type': 'link', 'url': node.attrs['href'], 'start': 0, 'end': len(content)})
    return content, spans, references


def _source_snapshot(block: WriterBlock) -> dict[str, Any]:
    return {
        'type': block.type,
        'content': block.content,
        'spans': [span.model_dump(exclude_defaults=True) for span in block.spans],
        'numbering': deepcopy(block.numbering),
        'references': deepcopy(block.references),
        'children': [_source_snapshot(child) for child in block.children],
    }


def _document_snapshot(document: WriterDocument) -> list[dict[str, Any]]:
    return [_source_snapshot(block) for block in document.blocks]


def _raw_if_unchanged(block: WriterBlock) -> str | None:
    raw = block.provider_payload.get('raw_html')
    snapshot = block.provider_payload.get('source_snapshot')
    if isinstance(raw, str) and snapshot == _source_snapshot(block):
        return raw
    return None


def _replace_raw_heading_number(
    raw_html: str,
    source_label: str,
    target_label: str,
) -> str | None:
    if not source_label:
        return None
    parser = _WeChatHTMLParser(raw_html)
    parser.feed(raw_html)
    parser.close()
    for node in _descendants(parser.root, '#text'):
        decoded = unescape(node.text)
        if not decoded.lstrip().startswith(source_label):
            continue
        offset = node.text.find(source_label)
        if offset < 0 or unescape(node.text[:offset]).strip():
            return None
        start = node.start + offset
        end = start + len(source_label)
        return f'{raw_html[:start]}{escape(target_label)}{raw_html[end:]}'
    return None


class WeChatWriterAdapter(WriterAdapterBase):
    """Render Writer IR into the conservative HTML subset accepted by MP drafts."""

    provider = 'wechat'

    @staticmethod
    def can_reuse_raw(block: WriterBlock) -> bool:
        return _raw_if_unchanged(block) is not None

    def blocks_to_ir(
        self,
        blocks: list[NativeBlock],
        *,
        external_document_id: str,
        stage: WriterStage = 'final',
        title: str = '',
        uri: str | None = None,
        revision: str | None = None,
    ) -> WriterDocument:
        if isinstance(blocks, str):
            html = blocks
        elif isinstance(blocks, list):
            html = ''.join(
                str(block.get('raw_html') or block.get('html') or '')
                for block in blocks if isinstance(block, dict)
            )
        else:
            raise TypeError(f'blocks must be a list or HTML string, got {type(blocks).__name__}.')
        return self.html_to_ir(
            html,
            external_document_id=external_document_id,
            stage=stage,
            title=title,
            uri=uri,
            revision=revision,
        )

    def html_to_ir(
        self,
        html: str,
        *,
        external_document_id: str,
        stage: WriterStage = 'final',
        title: str = '',
        uri: str | None = None,
        revision: str | None = None,
    ) -> WriterDocument:
        source = str(html or '')
        parser = _WeChatHTMLParser(source)
        parser.feed(source)
        parser.close()
        blocks = self._parse_root_blocks(
            parser.root.children,
            source,
            external_document_id,
            stage,
            path=(),
        )
        binding: dict[str, Any] = {
            'provider': self.provider,
            'document_id': external_document_id,
        }
        if uri is not None:
            binding['uri'] = uri
        if revision is not None:
            binding['revision'] = revision
        document = WriterDocument(
            document_id=self.make_document_id(external_document_id),
            stage=stage,
            title=title,
            blocks=blocks,
            revision=revision,
            metadata={
                'source_block_count': len(blocks),
                'wechat_html_source': source,
            },
            provider_binding=binding,
            ui_editable=False,
        )
        document.metadata['wechat_html_snapshot'] = _document_snapshot(document)
        return document

    def _parse_root_blocks(
        self,
        nodes: Iterable[_HtmlNode],
        source: str,
        external_document_id: str,
        stage: WriterStage,
        *,
        path: tuple[int, ...],
    ) -> list[WriterBlock]:
        blocks: list[WriterBlock] = []
        for index, node in enumerate(nodes):
            if node.tag == '#text' and not node.text.strip():
                continue
            blocks.append(self._parse_block(
                node, source, external_document_id, stage,
                path=(*path, index),
            ))
        return blocks

    def _parse_block(
        self,
        node: _HtmlNode,
        source: str,
        external_document_id: str,
        stage: WriterStage,
        *,
        path: tuple[int, ...],
    ) -> WriterBlock:
        node_id = self.make_node_id(external_document_id, 'html-' + '-'.join(map(str, path)))
        raw_html = _html_raw(source, node)
        semantic, payload_node = self._semantic_node(node)
        source_number_label: str | None = None
        if semantic == 'p':
            children = _element_children(payload_node)
            if len(children) == 1 and children[0].tag == 'img':
                semantic, payload_node = 'img', children[0]
        if semantic in {'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'}:
            content, spans, references = _inline_content(payload_node)
            numbering: dict[str, Any] = {}
            block_type = 'quote' if semantic == 'blockquote' else 'heading' if semantic.startswith('h') else 'paragraph'
            if block_type == 'heading':
                source_content = content.strip()
                content = strip_heading_numbering(content)
                if source_content != content:
                    prefix_end = len(source_content) - len(content) if content else len(source_content)
                    source_number_label = source_content[:prefix_end].strip()
                else:
                    source_number_label = ''
                if spans:
                    spans[0].text = strip_heading_numbering(spans[0].text)
                numbering['level'] = max(1, min(5, int(semantic[1:]) - 1))
            block = WriterBlock(
                node_id=node_id,
                type=block_type,
                content=content,
                spans=spans,
                references=references,
                numbering=numbering,
                stage=stage,
            )
        elif semantic == 'img':
            image_url = payload_node.attrs.get('src', '')
            caption = ''
            if node.tag in {'section', 'div', 'article', 'figure'}:
                children = _element_children(node)
                if len(children) == 2 and children[0].tag == 'img':
                    caption = _node_text(children[1])
            content = caption
            block = WriterBlock(
                node_id=node_id,
                type='image',
                content=content,
                references=[{
                    'type': 'wechat_image',
                    'url': image_url,
                    'alt': payload_node.attrs.get('alt', ''),
                }],
                stage=stage,
            )
        elif semantic == 'pre':
            code_node = next((child for child in payload_node.children if child.tag == 'code'), None)
            content = _node_text(code_node or payload_node)
            language = ''
            code_class = (code_node or payload_node).attrs.get('class', '')
            for value in code_class.split():
                if value.startswith('language-'):
                    language = value.removeprefix('language-')
                    break
            block = WriterBlock(
                node_id=node_id,
                type='code',
                content=content,
                stage=stage,
                editable=True,
                **({'language': language} if language else {}),
            )
        elif semantic == 'table':
            block = WriterBlock(
                node_id=node_id,
                type='table',
                content=self._table_to_markdown(payload_node),
                stage=stage,
                editable=True,
            )
        elif semantic in {'ul', 'ol'}:
            children = self._parse_list_items(
                payload_node, source, external_document_id, stage, path=path,
            )
            block = WriterBlock(
                node_id=node_id,
                type='wechat_list',
                children=children,
                numbering={'ordered': semantic == 'ol'},
                stage=stage,
            )
        else:
            block = WriterBlock(
                node_id=node_id,
                type='wechat_opaque',
                content=_node_text(node),
                stage=stage,
                editable=False,
            )
        block.provider_payload = {
            'raw_html': raw_html,
            'source_snapshot': _source_snapshot(block),
            'source_path': list(path),
        }
        if source_number_label is not None:
            block.provider_payload['source_number_label'] = source_number_label
        return block

    def _parse_list_items(
        self,
        node: _HtmlNode,
        source: str,
        external_document_id: str,
        stage: WriterStage,
        *,
        path: tuple[int, ...],
    ) -> list[WriterBlock]:
        items: list[WriterBlock] = []
        for index, child in enumerate(_element_children(node)):
            if child.tag != 'li':
                continue
            content_nodes = [item for item in child.children if item.tag not in {'ul', 'ol'}]
            content, spans, references = self._inline_nodes(content_nodes)
            nested = [item for item in child.children if item.tag in {'ul', 'ol'}]
            nested_blocks = [self._parse_block(
                item, source, external_document_id, stage,
                path=(*path, index, nested_index),
            ) for nested_index, item in enumerate(nested)]
            block = WriterBlock(
                node_id=self.make_node_id(external_document_id, 'html-' + '-'.join(map(str, (*path, index)))),
                type='list_item',
                content=content,
                spans=spans,
                references=references,
                numbering={'ordered': node.tag == 'ol'},
                children=nested_blocks,
                stage=stage,
            )
            block.provider_payload = {
                'raw_html': _html_raw(source, child),
                'source_snapshot': _source_snapshot(block),
                'source_path': [*path, index],
            }
            items.append(block)
        return items

    @staticmethod
    def _inline_nodes(nodes: Iterable[_HtmlNode]) -> tuple[str, list[WriterSpan], list[dict[str, Any]]]:
        wrapper = _HtmlNode('#inline', 0, 0)
        wrapper.children = list(nodes)
        return _inline_content(wrapper)

    @staticmethod
    def _semantic_node(node: _HtmlNode) -> tuple[str, _HtmlNode]:
        if node.tag in _KNOWN_BLOCK_TAGS:
            return node.tag, node
        if node.tag in {'section', 'div', 'article', 'figure'}:
            children = _element_children(node)
            if len(children) == 1 and children[0].tag in _KNOWN_BLOCK_TAGS:
                return children[0].tag, children[0]
            if len(children) == 2 and children[0].tag == 'img' and children[1].tag in {'p', 'figcaption'}:
                return 'img', children[0]
        if node.tag in _KNOWN_INLINE_TAGS:
            return 'p', node
        return '', node

    @staticmethod
    def _table_to_markdown(node: _HtmlNode) -> str:
        rows: list[list[str]] = []
        for row in _descendants(node, 'tr'):
            cells = [cell for cell in row.children if cell.tag in {'th', 'td'}]
            if cells:
                rows.append([_node_text(cell).replace('|', '\\|').replace('\n', '<br>') for cell in cells])
        if not rows:
            return ''
        width = max(len(row) for row in rows)
        rows = [row + [''] * (width - len(row)) for row in rows]
        output = [f"| {' | '.join(rows[0])} |", f"| {' | '.join(['---'] * width)} |"]
        output.extend(f"| {' | '.join(row)} |" for row in rows[1:])
        return '\n'.join(output)

    def ir_to_blocks(
        self,
        document: WriterDocument,
        media_assets: Any = None,
    ) -> list[NativeBlock]:
        raise NotImplementedError('WeChat drafts use HTML instead of native blocks.')

    def patch_to_operation(
        self,
        patch: PatchHunk,
        document: WriterDocument,
        media_assets: Any = None,
    ) -> NativePatchOperation:
        raise NotImplementedError('WeChat drafts apply changes through full-document replacement.')

    def document_to_html(
        self,
        document: WriterDocument,
        image_urls: dict[str, str] | None = None,
    ) -> str:
        source = document.metadata.get('wechat_html_source')
        source_snapshot = document.metadata.get('wechat_html_snapshot')
        if isinstance(source, str) and source_snapshot == _document_snapshot(document):
            return source
        images = image_urls or {}
        numbering = compute_numbering(build_numbering_view_from_ir(document))
        return ''.join(self._render_sequence(document.blocks, images, numbering))

    def _render_sequence(
        self,
        blocks: list[WriterBlock],
        images: dict[str, str],
        numbering: dict[str, NumberingEntry],
    ) -> list[str]:
        rendered: list[str] = []
        index = 0
        while index < len(blocks):
            block = blocks[index]
            if block.type == 'list_item':
                ordered = bool(block.numbering.get('ordered'))
                items: list[str] = []
                while index < len(blocks):
                    item = blocks[index]
                    if item.type != 'list_item' or bool(item.numbering.get('ordered')) != ordered:
                        break
                    body = self._render_inline(item)
                    children = ''.join(self._render_sequence(item.children, images, numbering))
                    items.append(f'<li>{body}{children}</li>')
                    index += 1
                tag = 'ol' if ordered else 'ul'
                rendered.append(f'<{tag}>{"".join(items)}</{tag}>')
                continue
            rendered.append(self._render_block(block, images, numbering))
            index += 1
        return rendered

    def _render_block(
        self,
        block: WriterBlock,
        images: dict[str, str],
        numbering: dict[str, NumberingEntry],
    ) -> str:
        entry = numbering.get(block.node_id)
        label = format_target_number(entry) if entry is not None else ''
        raw = _raw_if_unchanged(block)
        if raw is not None:
            if block.type != 'heading':
                return raw
            source_label = block.provider_payload.get('source_number_label')
            if source_label == label:
                return raw
            if isinstance(source_label, str):
                renumbered = _replace_raw_heading_number(raw, source_label, label)
                if renumbered is not None:
                    return renumbered
        if block.type == 'wechat_opaque':
            raise ValueError(
                f'Unsupported WeChat HTML block {block.node_id!r} cannot be modified.')
        if block.type == 'wechat_list':
            return self._render_list(block, images, numbering)
        body = self._render_inline(block)
        children = ''.join(self._render_sequence(block.children, images, numbering))
        if block.type == 'heading':
            level = int(block.numbering.get('level') or 1)
            heading = min(max(level + 1, 2), 4)
            title = f'{escape(label)} {body}'.strip()
            return f'<h{heading}>{title}</h{heading}>{children}'
        if block.type == 'image':
            asset_id = next((
                str(ref.get('id')) for ref in block.references
                if ref.get('type') == 'media_asset' and ref.get('id')
            ), '')
            url = images.get(asset_id, '') or next((
                str(ref.get('url') or '').strip() for ref in block.references
                if ref.get('type') == 'wechat_image' and ref.get('url')
            ), '')
            if not url:
                raise ValueError(f'Image block {block.node_id!r} media is unavailable.')
            caption_text = block.content.strip()
            caption = (
                f'<p>{escape(caption_text)}</p>'
                if caption_text else ''
            )
            return (
                f'<section>'
                f'<img src="{escape(url, quote=True)}" />'
                f'{caption}</section>{children}'
            )
        if block.type == 'table':
            return f'{self._render_table(block.content)}{children}'
        if block.type in {'quote', 'callout'}:
            return f'<blockquote>{body}</blockquote>{children}'
        if block.type in {'code', 'code_block'}:
            language = str(getattr(block, 'language', '') or '').strip()
            code_class = f' class="language-{escape(language, quote=True)}"' if language else ''
            return f'<pre><code{code_class}>{escape(block.content)}</code></pre>{children}'
        if block.type == 'divider':
            return f'<hr />{children}'
        return (f'<p>{body}</p>' if body else '') + children

    def _render_list(
        self,
        block: WriterBlock,
        images: dict[str, str],
        numbering: dict[str, NumberingEntry],
    ) -> str:
        tag = 'ol' if block.numbering.get('ordered') else 'ul'
        items: list[str] = []
        for item in block.children:
            if item.type != 'list_item':
                raise ValueError(f'WeChat list contains invalid child {item.type!r}.')
            body = self._render_inline(item)
            children = ''.join(self._render_sequence(item.children, images, numbering))
            items.append(f'<li>{body}{children}</li>')
        return f'<{tag}>{"".join(items)}</{tag}>'

    @staticmethod
    def _render_table(markdown: str) -> str:
        html = _TABLE_MARKDOWN(markdown).strip()
        if '<table>' not in html:
            raise ValueError('WeChat table block must contain a valid Markdown table.')
        return html.replace('&lt;br&gt;', '<br />')

    @staticmethod
    def _safe_link(value: Any) -> str:
        url = str(value or '').strip()
        return url if urlsplit(url).scheme.lower() in {'http', 'https', 'mailto'} else ''

    def _render_inline(self, block: WriterBlock) -> str:
        content = block.content or ''
        spans = block.spans if ''.join(span.text for span in block.spans) == content else []
        boundaries = {0, len(content)}
        span_ranges = []
        offset = 0
        for span in spans:
            end = offset + len(span.text)
            boundaries.update({offset, end})
            span_ranges.append((offset, end, span.style or {}))
            offset = end
        link_ranges = []
        for reference in block.references:
            start, end = reference.get('start'), reference.get('end')
            url = self._safe_link(reference.get('url'))
            if url and isinstance(start, int) and isinstance(end, int) and 0 <= start < end <= len(content):
                boundaries.update({start, end})
                link_ranges.append((start, end, url))

        positions = sorted(boundaries)
        parts: list[str] = []
        for index, start in enumerate(positions[:-1]):
            end = positions[index + 1]
            if start == end:
                continue
            value = escape(content[start:end])
            style = next((item for left, right, item in span_ranges if left <= start < right), {})
            if style.get('inline_code') or style.get('code'):
                value = f'<code>{value}</code>'
            if style.get('bold') or style.get('strong'):
                value = f'<strong>{value}</strong>'
            if style.get('italic'):
                value = f'<em>{value}</em>'
            if style.get('strikethrough') or style.get('strike'):
                value = f'<del>{value}</del>'
            styled_link = style.get('link')
            link = ''
            if isinstance(styled_link, dict):
                if styled_link.get('type') != 'internal_ref':
                    link = self._safe_link(styled_link.get('url'))
            if not link:
                link = next((url for left, right, url in link_ranges if left <= start < right), '')
            if link:
                value = f'<a href="{escape(link, quote=True)}">{value}</a>'
            parts.append(value)
        return ''.join(parts)


__all__ = ['WeChatWriterAdapter']
