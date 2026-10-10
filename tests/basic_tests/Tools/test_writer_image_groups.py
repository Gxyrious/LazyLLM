from bs4 import BeautifulSoup
from lazyllm.tools.writer.adapter.wechat import WeChatWriterAdapter
from lazyllm.tools.writer.data_models.revision import PatchSet
from lazyllm.tools.writer.data_models.multimodal import MediaAsset, MediaAssetLibrary
from lazyllm.tools.writer.tools.revision_tools import apply_patch_to_ir, WriterRevisionTools
from lazyllm.tools.writer.utils.conversion import writer_document_from_markdown, render_document_markdown
from lazyllm.tools.writer.utils.serialization import parse_document_markdown
from lazyllm.tools.writer.utils.image_groups import image_group_markdown, sliding_image_groups
from lazyllm.tools.writer.utils.export import export_writer_document


def test_image_groups_markdown_patch_and_wechat_round_trip():
    markdown = '# 城市绿意\n\n## 公园\n\n![小路](https://example.com/a.jpg)\n\n![长椅](https://example.com/b.jpg)\n\n![草地](https://example.com/c.jpg)\n\n正文\n\n![单张](https://example.com/d.jpg)'
    source = parse_document_markdown(markdown, 'gallery')
    assert export_writer_document(source, 'markdown').count('![') == 4
    images = [block for block in source.iter_blocks() if block.type == 'image']
    for image, name in zip(images, 'abcd'):
        image.references = [{'type': 'media_asset', 'id': name, 'url': f'https://example.com/{name}.jpg'}]
    groups = [{'images': [{'source': f'https://example.com/{name}.jpg', 'occurrence': 0}
                          for name in 'abc'], 'layout': 'sliding'}]
    selected, result = apply_patch_to_ir(source, PatchSet(target_doc_id=source.document_id, image_groups=groups))
    assert result.success
    assert selected.blocks == source.blocks
    assert sliding_image_groups(selected) == {images[0].node_id: [image.node_id for image in images[:3]]}
    serialized = image_group_markdown(markdown, selected)
    assert parse_document_markdown(serialized, 'gallery').metadata['image_groups'] == groups
    common = writer_document_from_markdown(serialized)
    assert common.metadata['image_groups'] == groups
    assert 'writer_image_groups' in render_document_markdown(common)
    exported = export_writer_document(common, 'markdown')
    assert 'writer_image_groups' not in exported
    assert exported.count('![') == 4
    adapter = WeChatWriterAdapter()
    urls = {name: f'https://example.com/{name}.jpg' for name in 'abcd'}
    html = adapter.document_to_html(selected, urls)
    soup = BeautifulSoup(html, 'html.parser')
    assert [image['src'] for image in soup.find_all('img')] == list(urls.values())
    assert len(soup.select('section[style*="overflow-x:auto"]')) == 1
    remote = adapter.html_to_ir(html, external_document_id='remote')
    assert len([block for block in remote.iter_blocks() if block.type == 'image']) == 4
    assert len(sliding_image_groups(remote)) == 1
    portable = export_writer_document(remote, 'markdown')
    assert portable.count('![') == 4
    assert [portable.index(url) for url in urls.values()] == sorted(portable.index(url) for url in urls.values())
    vertical = remote.model_copy(deep=True)
    vertical.metadata['image_groups'][0]['layout'] = 'vertical'
    restored = adapter.document_to_html(vertical)
    assert 'overflow-x:auto' not in restored
    assert len(BeautifulSoup(restored, 'html.parser').find_all('img')) == 4
    patch = WriterRevisionTools(llm=None)._diff_documents(source, selected)
    assert patch.image_groups == groups


def test_pasted_generated_image_urls_resolve_existing_assets():
    path = '/data/subagent/session/workflow/media/assets/flower.jpg'
    library = MediaAssetLibrary(library_id='media', assets={
        'flower': MediaAsset(media_asset_id='flower', asset_type='image',
                             source_type='image_generation', local_path=path),
    })
    document = parse_document_markdown(f'![花坛](http://localhost:8090{path})', 'pasted', media_assets=library)
    assert document.blocks[0].references[0]['id'] == 'flower'
    assert document.blocks[0].references[0]['path'] == f'http://localhost:8090{path}'
