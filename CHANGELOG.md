# Changelog

All notable changes to this extension are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.4.0] - 2026-10-23

### Added

- Note embeds: a `![[Note]]` on its own line shows the note's content inside a bordered box with a title link back to the note. The note's front matter is not shown. Images, wikilinks, callouts and PDF/video cards inside the embedded text work as they do on the page.
- Section embeds: `![[Note#Heading]]` shows that heading and everything under it, up to the next heading of the same or a higher level.
- Block embeds: `![[Note#^id]]` shows the paragraph or list item tagged with `^id`, including a list item's children. The `^id` itself is not shown, and an id on its own line below a paragraph is supported.
- A `[[Note#^id]]` link now shows the block's text as a tooltip.
- A missing section or block shows a "not found" notice inside the embed box.
- Notes that embed each other stop at the loop with a notice, and embeds nest at most four levels deep.
- Tests and fixture notes for embeds, blocks and the loop guard.

### Limits

- Only an embed alone on its line becomes a box. An embed in the middle of a sentence, or of a note that does not exist, is left as written.
- Relative Markdown links in an embedded note (such as `[text](../other.md)`) are resolved from the note being previewed, not from the embedded note. Wikilinks and image links are found by filename, so they are not affected.
- An embedded note does not refresh when you edit it; reopen or edit the page that embeds it.
- `[[Note#^id]]` links to the note and cannot jump to the block, because the preview has no way to scroll to one.

## [0.3.0] - 2026-10-23

### Added

- Wikilinks to notes: `[[Note]]`, `[[Note|alias]]`, `[[Note#Heading]]`, `[[folder/Note]]` and `[[#Heading]]` render as clickable links. Notes are found by filename anywhere in the workspace, case-insensitively, and the shortest path wins when several notes share a name. `[[file.pdf]]` links to the file.
- Links to a note that does not exist show as dimmed text with a dashed underline and a "Note not found" tooltip.
- Ten tests and two fixture notes for the new links.
- This changelog.

### Changed

- The tests build the extension id from `package.json` instead of a hard-coded id, so renaming the extension no longer breaks them.
- `package-lock.json` now matches the current extension name and version.

### Limits

- `![[Note]]` note embeds are left as written; only `[[Note]]` links are supported.
- `[[Note#^block]]` links to the note, not to the block.

## [0.2.3] - 2026-10-22

### Changed

- Version bump.

## [0.2.2] - 2026-10-22

### Added

- Extension icon.

### Changed

- Repository URL.

## [0.2.1] - 2026-10-22

### Changed

- Renamed the extension to **Obsidian Preview Native**, because the previous name was already taken.
- Set the publisher.
- `npm run package` writes the versioned `.vsix` into `dist/`.
- Added repository details to `package.json`.

## [0.2.0] - 2026-10-21

First tagged release.

### Added

- Image embeds: `![[image.png]]`, with `|400`, `|400x300` and `|alt text` options, found by filename anywhere in the workspace.
- Standard image links with a bare or URL-encoded filename, such as `![](Name.png)`, resolved by filename when the file is not next to the note.
- `==highlights==`.
- Callouts: `> [!type] Title`, with coloured boxes for the common types.
- Link cards for PDF embeds (`![[file.pdf#page=3]]`) and for `> [!video]` callouts. The preview cannot host a PDF viewer or an iframe, so these link out.
- Works in both preview modes: side by side, and the preview that replaces the source tab.
- Automated tests that run in a real VS Code window against a fixture workspace (`npm test`), plus an F5 launch configuration and a `.code-workspace` file.
- Apache License 2.0.

### Changed

- Packaged builds are written to `dist/`, not the repository root.
