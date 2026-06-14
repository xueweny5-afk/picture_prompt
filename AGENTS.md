# Prototype Instructions

Run the local server yourself and open the preview in the in-app browser. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Locked product direction

- Public, free, no-login browsing and copying.
- Content is curated by one owner through an internal admin area.
- Chinese interface; prompts retain their original Chinese or English wording.
- Multi-model support, with future author, account, and moderation expansion kept out of the v1 UI.
- Selected visual target: premium near-black immersive masonry gallery in `reference.png`.
- Public-facing model, category, style, and scene labels must display in Chinese. Preserve original stored values for filtering, imports, and admin editing.
- Admin prompt editing must expose separate multi-value style and scene tag editors. Existing tags are selectable suggestions, and administrators may create custom tags.
- Admin content library must offer list, thumbnail grid, and compact expandable views, and remember the administrator's last selected view.
- Admin prompt editing uses fixed dropdowns for model and aspect ratio. Category is not shown in the editor; new prompts use `Other Use Cases`, while existing category values remain preserved during edits.
