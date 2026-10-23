const assert = require('assert');
const path = require('path');
const vscode = require('vscode');
const pkg = require('../../package.json');

const EXT_ID = pkg.publisher + '.' + pkg.name;
const NOTE = path.join('Notes', 'Embeds.md');

// Opens the fixture note and renders it through the built-in preview engine, which loads
// this extension's markdown-it plugin.
async function renderFixture() {
   const folder = vscode.workspace.workspaceFolders[0];
   const uri = vscode.Uri.file(path.join(folder.uri.fsPath, NOTE));
   const doc = await vscode.workspace.openTextDocument(uri);
   await vscode.window.showTextDocument(doc);
   await vscode.extensions.getExtension(EXT_ID).activate();
   return vscode.commands.executeCommand('markdown.api.render', doc.getText());
}

suite('Obsidian Preview', () => {
   let html;

   suiteSetup(async function () {
      this.timeout(30000);
      html = await renderFixture();
   });

   test('extension is present', () => {
      assert.ok(vscode.extensions.getExtension(EXT_ID));
   });

   test('[[Note]] links to the note found by filename', () => {
      assert.match(html, /<a href="Target%20Note\.md"[^>]*>Target Note<\/a>/);
   });

   test('[[Note|alias]] shows the alias', () => {
      assert.match(html, /<a href="Target%20Note\.md"[^>]*>the target<\/a>/);
   });

   test('[[Note#Heading]] links to the heading anchor', () => {
      assert.match(html, /<a href="Target%20Note\.md#some-heading"[^>]*>Target Note &gt; Some Heading<\/a>/);
   });

   test('[[folder/Note]] finds a note in another folder', () => {
      assert.match(html, /<a href="\.\.\/Reference\/Deep%20Note\.md"[^>]*>Reference\/Deep Note<\/a>/);
   });

   test('note links ignore case and an explicit .md extension', () => {
      assert.match(html, /<a href="Target%20Note\.md"[^>]*>target note<\/a>/);
      assert.match(html, /<a href="Target%20Note\.md"[^>]*>Target Note\.md<\/a>/);
   });

   test('[[#Heading]] links within the same note', () => {
      assert.match(html, /<a href="#local-heading"[^>]*>Local Heading<\/a>/);
   });

   test('[[file.pdf]] links to the PDF', () => {
      assert.match(html, /<a href="\.\.\/Static%20Assets\/sample-guide\.pdf"[^>]*>sample-guide\.pdf<\/a>/);
   });

   test('link to a missing note is dimmed text, not a link', () => {
      assert.match(html, /<span class="wikilink-unresolved"[^>]*>No Such Note<\/span>/);
      assert.ok(!/<a [^>]*>No Such Note<\/a>/.test(html));
   });

   test('![[note]] embed and [[link]] in code stay as written', () => {
      assert.ok(html.includes('![[Target Note]]'));
      assert.ok(html.includes('<code>[[Not A Link]]</code>'));
   });

   // An embed box runs from its title link to the closing tags; look inside one box at a time.
   const embedByTitle = (title) => {
      const start = html.indexOf('>' + title + '</a></div>');
      assert.ok(start >= 0, 'no embed titled ' + title);
      return html.slice(start, html.indexOf('</div></div>', start));
   };

   test('![[Note]] on its own line shows the note without its front matter', () => {
      assert.ok(embedByTitle('Target Note').includes('Fixture note that the wikilinks'));
      assert.ok(!html.includes('Front Matter Title'));
   });

   test('![[Note#Heading]] shows that section and its sub-section only', () => {
      const box = embedByTitle('Embed Source &gt; First Section');
      assert.ok(box.includes('Section text one.'));
      assert.ok(box.includes('Sub section text.'));
      assert.ok(!html.includes('Section text two.'));
      assert.ok(!html.includes('Intro paragraph of the source note.'));
   });

   test('images inside an embedded section are resolved', () => {
      assert.match(embedByTitle('Embed Source &gt; First Section'), /<img[^>]*test-image\.png[^>]*width="50"/);
   });

   test('![[Note#^id]] shows the paragraph without its id', () => {
      const box = embedByTitle('Embed Source &gt; ^para-id');
      assert.ok(box.includes('A tagged paragraph.'));
      assert.ok(!box.includes('^para-id</p>') && !/<p>[^<]*\^para-id/.test(box));
   });

   test('![[Note#^id]] on a list item shows the item and its child, not its siblings', () => {
      const box = embedByTitle('Embed Source &gt; ^item-id');
      assert.ok(box.includes('Second item'));
      assert.ok(box.includes('child under second'));
      assert.ok(!html.includes('First item'));
   });

   test('![[Note#^id]] with the id on the next line shows the paragraph above', () => {
      const box = embedByTitle('Embed Source &gt; ^alone-id');
      assert.ok(box.includes('Another paragraph with the id on the next line.'));
      assert.ok(!/<p>[^<]*\^alone-id/.test(box));
   });

   test('embed of a missing section shows a notice', () => {
      assert.match(html, /note-embed-notice">Section not found\./);
   });

   test('notes that embed each other stop at the loop', () => {
      assert.match(html, /note-embed note-embed-loop/);
      assert.ok(html.includes('Text in loop A.'));
      assert.ok(html.includes('Text in loop B.'));
   });

   test('embed of a missing note stays as written', () => {
      assert.ok(html.includes('![[No Such Embed]]'));
   });

   test('[[Note#^id]] link shows the block text as a tooltip', () => {
      assert.match(html, /<a href="Embed%20Source\.md"[^>]*title="A tagged paragraph\."/);
   });

   test('![[image]] resolves by filename from another folder', () => {
      assert.match(html, /<img[^>]*src="[^"]*Static(%20| )Assets\/test-image\.png"/);
   });

   test('![[image|200]] sets the width', () => {
      assert.match(html, /<img[^>]*test-image\.png[^>]*width="200"/);
   });

   test('![[image|200x100]] sets width and height', () => {
      assert.match(html, /<img[^>]*width="200"[^>]*height="100"/);
   });

   test('![](bare-name.png) resolves by filename', () => {
      const imgs = html.match(/<img[^>]*test-image\.png[^>]*>/g) || [];
      assert.ok(imgs.length >= 4, 'expected the 3 embeds plus the standard link, got ' + imgs.length);
   });

   test('URL-encoded name in a subfolder resolves', () => {
      assert.match(html, /<img[^>]*Static(%20| )Assets\/pasted\/Pasted(%20| )image(%20| )20260101000000\.png/);
   });

   test('![[file.pdf]] becomes a link card', () => {
      assert.match(html, /<a[^>]*href="[^"]*sample-guide\.pdf"[^>]*>[^<]*sample-guide\.pdf<\/a>/);
   });

   test('![[file.pdf#page=3]] shows the page in the link text', () => {
      assert.match(html, /sample-guide\.pdf \(page 3\)/);
   });

   test('missing image and PDF stay as literal text', () => {
      assert.ok(html.includes('![[no-such-image.png]]'));
      assert.ok(html.includes('![[no-such-file.pdf]]'));
   });

   test('video callout becomes a card with a link', () => {
      assert.match(html, /callout-video/);
      assert.match(html, /<div class="video-link"><a href="https:\/\/example\.com\/embed\/video\?id=1&amp;x=2"/);
   });

   test('callout gets its type class and title', () => {
      // The preview adds its own attributes (code-line, data-line) and an empty div.
      assert.match(
         html,
         /<blockquote class="callout callout-note[^"]*"[^>]*>[\s\S]*?<div class="callout-title">Fixture note<\/div>/
      );
   });

   test('==highlight== renders as mark', () => {
      assert.match(html, /<mark>highlighted<\/mark>/);
   });
});
