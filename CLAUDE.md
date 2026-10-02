@AGENTS.md

## Matching a reference screenshot

When the user gives a screenshot and asks for a page to look like it, copy it exactly:

- Measure the image (sizes, spacing, colours, fonts, alignment) and use those values. Do not substitute the CSS tokens already in the file (`--ink`, `--gold`, cream, Spectral) unless they match the image.
- Do not "improve" it. Do not remove, add, reorder or move any element, text, field or section, and do not change what a field requires.
- Text, addresses, phone numbers, prices, products and photos shown in a screenshot are demo content from another site. Never copy them into the code. Real values come from the database or settings; if one is missing, keep the element and its position as it already is.
- Replace the whole CSS block for that page instead of patching a few classes, so old rules do not bleed through.
- Touch only the page the user named. If something is unclear, ask before editing.
