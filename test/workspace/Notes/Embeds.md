## Embeds fixture

Used by the automated tests and for manual checks. The images and PDF live in `Static Assets/`, a different folder from this note, so every one of them has to be found by filename.

Image embed: ![[test-image.png]]

Image embed with width: ![[test-image.png|200]]

Image embed with width and height: ![[test-image.png|200x100]]

Standard link with a bare filename: ![](test-image.png)

Standard link, URL-encoded name, file in a subfolder: ![](Pasted%20image%2020260101000000.png)

PDF embed: ![[sample-guide.pdf]]

PDF embed at a page: ![[sample-guide.pdf#page=3&height=500]]

Missing image: ![[no-such-image.png]]

Missing PDF: ![[no-such-file.pdf]]

> [!video] Fixture video
> https://example.com/embed/video?id=1&x=2

> [!note] Fixture note
> Body text.

A ==highlighted== word.

## Local Heading

Note link: [[Target Note]]

Note link with alias: [[Target Note|the target]]

Note link to a heading: [[Target Note#Some Heading]]

Note link by folder and name: [[Reference/Deep Note]]

Note link, different case: [[target note]]

Note link with the extension: [[Target Note.md]]

Link to a heading in this note: [[#Local Heading]]

Link to a PDF: [[sample-guide.pdf]]

Link to a missing note: [[No Such Note]]

A note embed is not supported and stays as written: ![[Target Note]]

In code, not a link: `[[Not A Link]]`
