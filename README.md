# Obsidian Preview

A small VS Code extension that makes the built-in Markdown preview understand a few Obsidian features: image embeds, `==highlights==`, callouts, and PDF and video embeds.

## What it renders

| Syntax | Result |
| ------ | ------ |
| `![[image.png]]` | The image, found by filename anywhere in the workspace |
| `![[image.png\|400]]`, `![[image.png\|400x300]]` | Image with width (and height) |
| `![[image.png\|alt text]]` | Image with alt text |
| `![](Name.png)`, `![](Pasted%20image%20....png)` | Standard image links with a bare filename, resolved by filename when the file is not next to the note |
| `==highlight==` | Highlighted text |
| `> [!warning] Title` | Coloured callout box (`note`, `info`, `tip`, `success`, `warning`, `danger`, `error`, and others) |
| `![[file.pdf]]`, `![[file.pdf#page=3&height=500]]` | A link `📄 file.pdf (page 3)` to the PDF, found by filename (link card, not an inline viewer) |
| `[[Note]]`, `[[Note\|alias]]`, `[[Note#Heading]]`, `[[folder/Note]]`, `[[#Heading]]` | A clickable link to the note, found by filename anywhere in the workspace (case-insensitive, shortest path wins if several notes share a name). Links to a missing note show as dimmed text. `[[file.pdf]]` links to the file |
| `![[Note]]`, `![[Note#Heading]]`, `![[Note#^id]]` on a line of their own | The note, the section under that heading, or the tagged paragraph / list item, shown in a bordered box with a link back to the note. Front matter is not shown; loops are stopped with a notice |
| `> [!video] Title` + URL on the next line (also `[!video]-`) | A card with the title and the URL as a link (link card, not an inline player) |

Images and PDFs that cannot be found are left as literal text, so a typo is easy to spot.

### Why link cards for PDFs and videos

The preview webview has no PDF viewer and its content security policy blocks iframes from other sites, so an inline PDF viewer or video player is not possible there. Clicking a video link opens it in the browser. Clicking a PDF link uses VS Code's normal handling for non-text files, so it may offer to open the file with another program. The `#page=` value is shown in the link text but not passed on, and `#height=` is ignored.

## What it does not render

- An embed in the middle of a sentence (`text ![[Some Note]] text`) is left as written; only an embed alone on its line becomes a box
- A `[[Note#^id]]` link goes to the note, not to the block (the preview cannot scroll to a block), but it shows the block's text as a tooltip
- Relative Markdown links in an embedded note are resolved from the note being previewed
- An embedded note does not refresh until the page that embeds it is reopened or edited
- Mermaid diagrams (use a separate Mermaid extension, e.g. `bierner.markdown-mermaid`)

## How image lookup works

Obsidian resolves an image by searching the vault for that filename. VS Code only resolves paths relative to the note. This extension indexes every image in the workspace by lowercase filename (skipping `.git`, `node_modules`, `.obsidian`, `.vscode`) and rewrites the link to a path relative to the note, so the preview's own resource handling loads it.

- If two images share a filename, the first one found wins.
- The index is rebuilt when a lookup misses, at most once every 2 seconds, so new images appear without reloading.

### Which note is being previewed

The preview does not always tell extensions which note it is rendering. When it opens as the main editor (the preview that replaces the source tab) it passes no document at all. The extension reads the note's path from `env.currentDocument` when present, and otherwise from the preview tab (`vscode.markdown.preview.editor` tabs carry the file URI, side-by-side previews are matched by their `Preview <file>` title), then a visible Markdown editor, then the last Markdown file edited. If none works it resolves from the workspace root and writes a line to the **Obsidian Preview** output channel.

## Install

Requires VS Code 1.80 or later.

```
npm run package
code --install-extension dist/obsidian-preview-<version>.vsix --force
```

`npm run package` writes the `.vsix` to the `dist/` folder, not the repository root. `dist/` is git-ignored and excluded from the package. The script runs `vsce package --out dist/` with two `--base...Url` flags that are placeholders: `vsce` otherwise refuses to package because the README mentions example image syntax and the extension has no repository URL. The package is only installed locally.

On Windows use `"C:\Program Files\Microsoft VS Code\bin\code.cmd"`; `Code.exe` does not accept `--install-extension`. Then run **Developer: Reload Window** and reopen the preview.

When editing `package.json` on Windows PowerShell, write it as UTF-8 **without** a byte-order mark (`Set-Content -Encoding utf8` adds one and `vsce` then rejects the file).

## Testing

The tests run inside a real VS Code window that has `test/workspace` open, using `@vscode/test-cli` (config in `.vscode-test.mjs`).

```
npm install
npm test
```

`test/workspace` is a small fixture workspace: notes in `Notes/`, and images and a PDF in a separate flat `Static Assets/` folder, so every embed has to be found by filename. `test/suite/render.test.js` opens `Notes/Embeds.md`, renders it through the built-in preview engine (`markdown.api.render`) and checks the HTML.

By default the first run downloads a VS Code build into `.vscode-test/`. To use an installed VS Code instead, set `VSCODE_EXECUTABLE_PATH` to its executable first:

```
$env:VSCODE_EXECUTABLE_PATH = "C:\Program Files\Microsoft VS Code\Code.exe"
npm test
```

### Manual testing

- Press **F5** and choose **Run Extension (test workspace)** to open an Extension Development Host on the fixture workspace, then open a note under `test/workspace/Notes/` and press Ctrl+Shift+V. `Video and Callout Test.md` there lists what each section should look like.
- Or open `obsidian-preview.code-workspace`, which has the extension folder and the fixture workspace side by side.

## Files

- `extension.js`: the markdown-it plugin (image embeds, image links, PDF and video link cards, highlights, callouts)
- `preview.css`: styles for highlights, callouts and unresolved note links
- `CHANGELOG.md`: release notes
- `test/suite/`: Mocha tests; `test/workspace/`: fixture workspace they run against
- `.vscode-test.mjs`, `.vscode/launch.json`, `obsidian-preview.code-workspace`: test and debug setup
- `package.json`: extension manifest (`markdown.markdownItPlugins`, `markdown.previewStyles`)

## Lessons from building it

- The built-in preview turns image paths into webview URIs while parsing, via `md.normalizeLink`. Rewriting `src` after parsing is too late, so bare-filename links are rewritten in the raw text before parsing (a core rule placed before `normalize`).
- Paths handed to the preview must be relative to the note.

## License

Copyright 2026 Ashish Deep Singh. Licensed under the Apache License, Version 2.0; see [LICENSE](LICENSE).
