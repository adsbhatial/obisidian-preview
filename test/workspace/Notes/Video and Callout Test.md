## Obsidian Preview test page

Open this file's Markdown preview (Ctrl+Shift+V) and compare each section with what it should look like. Image and PDF embeds are in `Embeds.md` next to this page.

## Video cards

**Expected:** a purple box with a ▶ title and the URL as a clickable link. Clicking opens the browser.

> [!video] Plain video callout
> https://www.youtube.com/embed/dQw4w9WgXcQ

> [!video]- Foldable form with a long URL and query parameters
> https://example.com/sites/demo/_layouts/15/embed.aspx?UniqueId=00000000-0000-0000-0000-000000000000&embed=%7B%22ust%22%3Afalse%7D&referrer=StreamWebApp

> [!video]
> https://vimeo.com/000000000

**Expected for the last one:** the title falls back to `Video`.

## Video callout with no URL

**Expected:** a purple box with only the title and no link.

> [!video] No URL here
> Just some text.

## Callouts

**Expected:** coloured boxes with bold titles.

> [!note] A note
> Body text under a note.

> [!warning] A warning
> Body text under a warning.

> [!danger]
> Title falls back to `Danger`.

## Highlights

**Expected:** yellow highlight.

This sentence has ==highlighted text== and ==highlight with *emphasis* inside== in it.

## Things that should stay as plain text

**Expected:** shown exactly as written.

- An unmatched marker: ==not closed
- A missing image: ![[this-file-does-not-exist.png]]
- A missing PDF: ![[this-file-does-not-exist.pdf]]
