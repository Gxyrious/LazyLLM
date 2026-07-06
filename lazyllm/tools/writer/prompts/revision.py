REVISE_DRAFT_DOCUMENT_PROMPT = '''Revise the given draft document according to the user's revision request.

Requirements:
- Return a DraftDocument object reflecting the fully revised document.
- Apply the revision request across the whole document.
- Keep the document's overall section structure and ordering unless the request explicitly asks to restructure, merge, or split sections.
- Preserve each section's section_id and outline_node_id from the original so the revised document stays aligned with the outline.
- Preserve section titles unless the request explicitly asks to rename them.
- Do not drop existing content unless the request asks for deletion.
- Respect the writing context: keep facts consistent (never alter locked facts), preserve terminology and the style profile.
- Do not invent facts that conflict with the writing context.
- Each text DraftBlock.content must remain complete prose; avoid placeholder or summary-style blocks.

Original draft document:
{draft_document_json}

Writing context:
{context_json}

Revision request:
{revision_request}
'''


REVISE_DRAFT_SECTION_PROMPT = '''Revise a single section of a draft document according to the user's revision request.

Requirements:
- Return a DraftSection object for the revised section.
- Apply the revision request to this section only; other sections are handled separately.
- Keep the section title unless the request explicitly asks to rename it.
- Respect the writing context: keep facts consistent (never alter locked facts), preserve terminology and style.
- Do not invent facts that conflict with the writing context.
- Each text DraftBlock.content must remain complete prose; avoid placeholder or summary-style blocks.

Original section:
{section_json}

Writing context (for reference):
{context_json}

Revision request:
{revision_request}
'''
