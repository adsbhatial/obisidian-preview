const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp']);
const INDEXED_EXT = new Set([...IMAGE_EXT, '.pdf', '.md']);
const SKIP_DIRS = new Set(['.git', 'node_modules', '.obsidian', '.vscode']);
const REINDEX_MIN_MS = 2000;

// root folder -> { map: Map<lowercase filename, full path>,
//                  notes: Map<lowercase note filename, full paths[]>, builtAt: number }
const indexes = new Map();

function buildIndex(root) {
   const map = new Map();
   const notes = new Map();
   const walk = (dir) => {
      let entries;
      try {
         entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch (e) {
         return;
      }
      for (const ent of entries) {
         const full = path.join(dir, ent.name);
         if (ent.isDirectory()) {
            if (!SKIP_DIRS.has(ent.name)) walk(full);
         } else if (INDEXED_EXT.has(path.extname(ent.name).toLowerCase())) {
            const key = ent.name.toLowerCase();
            if (!map.has(key)) map.set(key, full);
            if (key.endsWith('.md')) {
               if (!notes.has(key)) notes.set(key, []);
               notes.get(key).push(full);
            }
         }
      }
   };
   walk(root);
   const idx = { map, notes, builtAt: Date.now() };
   indexes.set(root, idx);
   return idx;
}

// Every note with this filename (several folders can hold an index.md, for example).
function findNotes(root, key) {
   const idx = indexes.get(root) || buildIndex(root);
   let hit = idx.notes.get(key);
   if (!hit && Date.now() - idx.builtAt > REINDEX_MIN_MS) {
      hit = buildIndex(root).notes.get(key);
   }
   return hit || [];
}

function findImage(root, name) {
   const key = name.toLowerCase();
   const idx = indexes.get(root) || buildIndex(root);
   let hit = idx.map.get(key);
   if (!hit && Date.now() - idx.builtAt > REINDEX_MIN_MS) {
      hit = buildIndex(root).map.get(key);
   }
   return hit;
}

let lastMarkdownPath = null;
let log = null;
function logLine(msg) {
   if (!log) log = vscode.window.createOutputChannel('Obsidian Preview');
   log.appendLine(msg);
}

function docPathFromPreviewTab() {
   const found = [];
   const direct = [];
   for (const group of vscode.window.tabGroups.all) {
      for (const tab of group.tabs) {
         const viewType = tab.input && tab.input.viewType;
         // Preview opened as the main editor: a custom editor tab that carries the file uri.
         if (viewType === 'vscode.markdown.preview.editor' && tab.input.uri && tab.input.uri.scheme === 'file') {
            direct.push({ fsPath: tab.input.uri.fsPath, active: group.isActive && tab.isActive });
         }
         if (viewType && String(viewType).includes('markdown.preview') && /^Preview /.test(tab.label)) {
            found.push({ name: tab.label.slice('Preview '.length), active: group.isActive && tab.isActive });
         }
      }
   }
   direct.sort((a, b) => Number(b.active) - Number(a.active));
   if (direct.length) return direct[0].fsPath;
   found.sort((a, b) => Number(b.active) - Number(a.active));
   for (const f of found) {
      const doc = vscode.workspace.textDocuments.find(
         (d) => d.languageId === 'markdown' && d.uri.scheme === 'file' && path.basename(d.uri.fsPath) === f.name
      );
      if (doc) return doc.uri.fsPath;
   }
   return null;
}

// The preview hands over env.currentDocument as a vscode-uri object, not necessarily a
// vscode.Uri, so derive the file path ourselves instead of relying on getWorkspaceFolder.
function rootFor(env) {
   const folders = vscode.workspace.workspaceFolders || [];
   const doc = env && env.currentDocument;
   let docPath = null;
   if (doc) {
      try {
         docPath = doc.fsPath || (doc.path && vscode.Uri.from({ scheme: doc.scheme || 'file', path: doc.path }).fsPath);
         if (!docPath) docPath = vscode.Uri.parse(String(doc)).fsPath;
      } catch (e) {
         docPath = null;
      }
   }
   if (!docPath) {
      // env gave no usable document: match the "Preview <file>" tab title to an open note,
      // then any visible note, else assume the note last edited.
      const visible = vscode.window.visibleTextEditors.find(
         (e) => e.document.languageId === 'markdown' && e.document.uri.scheme === 'file'
      );
      docPath = docPathFromPreviewTab() || (visible && visible.document.uri.fsPath) || lastMarkdownPath;
   }
   if (docPath) {
      const lower = docPath.toLowerCase();
      const folder = folders.find((f) => lower.startsWith(f.uri.fsPath.toLowerCase() + path.sep));
      return {
         root: folder ? folder.uri.fsPath : path.dirname(docPath),
         docDir: path.dirname(docPath),
         docPath,
      };
   }
   logLine('could not determine the note being previewed; resolving images from the workspace root');
   return folders[0] ? { root: folders[0].uri.fsPath, docDir: folders[0].uri.fsPath, docPath: null } : null;
}

// Relative to the note, so the built-in preview turns it into a webview URI itself.
function toSrc(docDir, target) {
   return path
      .relative(docDir, target)
      .split(path.sep)
      .map(encodeURIComponent)
      .join('/');
}

// ![[image.png]]  ![[image.png|400]]  ![[image.png|400x300]]  ![[image.png|alt text]]
function embedRule(state, silent) {
   const src = state.src;
   const start = state.pos;
   if (!src.startsWith('![[', start)) return false;
   const end = src.indexOf(']]', start + 3);
   if (end < 0 || end >= state.posMax) return false;

   const inner = src.slice(start + 3, end);
   if (inner.includes('\n')) return false;
   const parts = inner.split('|');
   const name = parts[0].split('#')[0].trim();
   const opt = (parts[1] || '').trim();
   if (!IMAGE_EXT.has(path.extname(name).toLowerCase())) return false;

   const ctx = rootFor(state.env);
   if (!ctx) return false;
   const target = findImage(ctx.root, path.basename(name));
   if (!target) return false;

   if (!silent) {
      const sizeMatch = /^(\d+)(?:x(\d+))?$/.exec(opt);
      const alt = sizeMatch || !opt ? path.basename(name) : opt;
      const token = state.push('image', 'img', 0);
      token.attrs = [['src', state.md.normalizeLink(toSrc(ctx.docDir, target))], ['alt', alt]];
      if (sizeMatch) {
         token.attrs.push(['width', sizeMatch[1]]);
         if (sizeMatch[2]) token.attrs.push(['height', sizeMatch[2]]);
      }
      token.content = alt;
      const text = new state.Token('text', '', 0);
      text.content = alt;
      token.children = [text];
   }
   state.pos = end + 2;
   return true;
}

// ==highlight==
function highlightRule(state, silent) {
   const src = state.src;
   const start = state.pos;
   if (!src.startsWith('==', start)) return false;
   const end = src.indexOf('==', start + 2);
   if (end < 0 || end >= state.posMax || end === start + 2) return false;
   if (silent) {
      state.pos = end + 2;
      return true;
   }
   state.push('mark_open', 'mark', 1);
   const oldMax = state.posMax;
   state.pos = start + 2;
   state.posMax = end;
   state.md.inline.tokenize(state);
   state.pos = end + 2;
   state.posMax = oldMax;
   state.push('mark_close', 'mark', -1);
   return true;
}

// > [!type] Title   (first line of a blockquote)
function calloutRule(state) {
   const tokens = state.tokens;
   const esc = state.md.utils.escapeHtml;
   for (let i = 0; i < tokens.length; i++) {
      const open = tokens[i];
      if (open.type !== 'blockquote_open') continue;
      const para = tokens[i + 1];
      const inline = tokens[i + 2];
      if (!para || para.type !== 'paragraph_open' || !inline || inline.type !== 'inline') continue;
      const m = /^\[!([\w-]+)\][+-]?[ \t]*([^\n]*)/.exec(inline.content);
      if (!m) continue;

      const type = m[1].toLowerCase();
      const title = m[2].trim() || type.charAt(0).toUpperCase() + type.slice(1);
      open.attrJoin('class', 'callout callout-' + type);

      const br = inline.children.findIndex((c) => c.type === 'softbreak');
      let bodyHtml = '';
      if (type === 'video') {
         // The preview can't host the player (iframes are blocked), so show a card that
         // links out to the video URL instead.
         const url = /https?:\/\/[^\s<>"']+/.exec(br < 0 ? '' : inline.content.slice(inline.content.indexOf('\n') + 1));
         if (url) {
            bodyHtml = '<div class="video-link"><a href="' + esc(url[0]) + '">' + esc(url[0]) + '</a></div>\n';
         }
         tokens.splice(i + 1, 3); // drop the paragraph; the card replaces it
      } else if (br < 0) {
         tokens.splice(i + 1, 3); // paragraph held only the marker line
      } else {
         inline.children = inline.children.slice(br + 1);
         inline.content = inline.content.slice(inline.content.indexOf('\n') + 1);
      }
      const titleTok = new state.Token('html_block', '', 0);
      titleTok.content =
         '<div class="callout-title">' + (type === 'video' ? '&#9654; ' : '') + esc(title) + '</div>\n' + bodyHtml;
      tokens.splice(i + 1, 0, titleTok);
   }
}

// ![](Name.png) / ![alt](Pasted%20image.png): bare filenames the vault resolves by name.
// Rewritten in the raw text before parsing, because the preview converts image paths to
// webview URIs while parsing. Only touched when the file doesn't exist next to the note.
const PDF_EMBED = /!\[\[([^\]|#]+\.pdf)(?:#([^\]|]*))?(?:\|[^\]]*)?\]\]/gi;
const IMAGE_LINK =/(!\[[^\]]*\]\()(<[^>]+>|[^)\s]+)((?:\s+"[^"]*")?\))/g;

function imageLinkRule(state) {
   const ctx = rootFor(state.env);
   if (!ctx) return;
   // ![[file.pdf]] / ![[file.pdf#page=3&height=500]]: the preview can't show a PDF inline,
   // so turn it into a plain link (handled by the preview's normal link logic).
   state.src = state.src.replace(PDF_EMBED, (all, name, frag) => {
      const target = findImage(ctx.root, path.basename(name.trim()));
      if (!target) return all;
      const page = /(?:^|&)page=(\d+)/.exec(frag || '');
      const label = '\u{1F4C4} ' + path.basename(target) + (page ? ' (page ' + page[1] + ')' : '');
      return '[' + label.replace(/[[\]]/g, '\\$&') + '](' + toSrc(ctx.docDir, target) + ')';
   });
   state.src = state.src.replace(IMAGE_LINK, (all, pre, link, post) => {
      const raw = link.replace(/^<|>$/g, '');
      if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('/')) return all;
      let decoded = raw;
      try {
         decoded = decodeURIComponent(raw);
      } catch (e) {
         // keep raw
      }
      if (fs.existsSync(path.join(ctx.docDir, decoded))) return all;
      const target = findImage(ctx.root, path.basename(decoded));
      return target ? pre + toSrc(ctx.docDir, target) + post : all;
   });
}

// Heading text -> the anchor id the preview gives that heading.
function slugify(heading) {
   return heading
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\p{L}\p{N}_-]/gu, '');
}

// Picks the note a wikilink means: filename match (case-insensitive), narrowed by any folder
// part of the link, shortest path first like Obsidian does.
function resolveNote(root, name) {
   const parts = name.replace(/\\/g, '/').replace(/\.md$/i, '').split('/').filter(Boolean);
   if (!parts.length) return null;
   let candidates = findNotes(root, parts[parts.length - 1].toLowerCase() + '.md');
   if (parts.length > 1) {
      const tail = '/' + parts.join('/').toLowerCase() + '.md';
      candidates = candidates.filter((c) => c.replace(/\\/g, '/').toLowerCase().endsWith(tail));
   }
   return candidates.slice().sort((a, b) => a.length - b.length)[0] || null;
}

// [[Note]]  [[Note|alias]]  [[Note#Heading]]  [[folder/Note]]  [[#Heading]]  [[file.pdf]]
// Resolved by filename anywhere in the workspace. A link to a note that does not exist is
// shown as dimmed text instead of a dead link. ![[...]] (an embed) is left alone.
function wikilinkRule(state, silent) {
   const src = state.src;
   const start = state.pos;
   if (!src.startsWith('[[', start)) return false;
   if (start > 0 && src.charCodeAt(start - 1) === 0x21) return false;
   const end = src.indexOf(']]', start + 2);
   if (end < 0 || end >= state.posMax) return false;

   const inner = src.slice(start + 2, end).replace(/\\\|/g, '|');
   if (!inner.trim() || inner.includes('\n')) return false;
   if (silent) {
      state.pos = end + 2;
      return true;
   }

   const bar = inner.indexOf('|');
   const target = (bar < 0 ? inner : inner.slice(0, bar)).trim();
   const alias = bar < 0 ? '' : inner.slice(bar + 1).trim();
   const hash = target.indexOf('#');
   const name = (hash < 0 ? target : target.slice(0, hash)).trim();
   const frag = hash < 0 ? '' : target.slice(hash + 1).trim();
   const heading = frag.startsWith('^') ? '' : frag; // block references have no anchor
   if (!name && !heading) return false;

   const ctx = rootFor(state.env);
   if (!ctx) return false;

   const base = name.replace(/\\/g, '/').split('/').pop();
   const ext = path.extname(base).toLowerCase();
   let file = null;
   if (name) {
      file = ext && ext !== '.md' && INDEXED_EXT.has(ext) ? findImage(ctx.root, base) : resolveNote(ctx.root, name);
   }
   const display = alias || (name && heading ? name + ' > ' + heading : name || heading);
   const anchor = heading ? '#' + slugify(heading) : '';

   if (name && !file) {
      const span = state.push('html_inline', '', 0);
      span.content =
         '<span class="wikilink-unresolved" title="Note not found">' + state.md.utils.escapeHtml(display) + '</span>';
   } else {
      const open = state.push('link_open', 'a', 1);
      open.attrs = [['href', (file ? toSrc(ctx.docDir, file) : '') + anchor]];
      if (file && frag.startsWith('^') && path.extname(file).toLowerCase() === '.md') {
         // The preview can't jump to a block, so show its text as a tooltip instead.
         const block = blockOf(readNoteLines(file), frag.slice(1));
         if (block) open.attrs.push(['title', block.join(' ').replace(/\s+/g, ' ').trim().slice(0, 240)]);
      }
      const text = state.push('text', '', 0);
      text.content = display;
      state.push('link_close', 'a', -1);
   }
   state.pos = end + 2;
   return true;
}

// ---- Note embeds: ![[Note]]  ![[Note#Heading]]  ![[Note#^block-id]] ----

const MAX_EMBED_DEPTH = 4;
const NOTE_EMBED_LINE = /^!\[\[([^\]]+)\]\]$/;
const HEADING_LINE = /^(#{1,6})\s+(.*?)\s*#*\s*$/;

function escapeRegExp(text) {
   return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readNoteLines(file) {
   try {
      const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
      return text.replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(\r?\n|$)/, '').split(/\r?\n/);
   } catch (e) {
      return [];
   }
}

function plainHeading(text) {
   return text.replace(/[*_`]/g, '').trim().toLowerCase();
}

// Lines of the section that starts at this heading, up to the next heading of the same or
// a higher level. Headings inside fenced code blocks are ignored.
function sectionOf(lines, heading) {
   const want = plainHeading(heading.split('#').pop());
   let fence = null;
   let start = -1;
   let level = 0;
   for (let i = 0; i < lines.length; i++) {
      const marker = /^\s*(```|~~~)/.exec(lines[i]);
      if (marker) {
         fence = fence ? (fence === marker[1] ? null : fence) : marker[1];
         continue;
      }
      if (fence) continue;
      const m = HEADING_LINE.exec(lines[i]);
      if (!m) continue;
      if (start < 0) {
         if (plainHeading(m[2]) === want) {
            start = i;
            level = m[1].length;
         }
      } else if (m[1].length <= level) {
         return lines.slice(start, i);
      }
   }
   return start < 0 ? null : lines.slice(start);
}

// The block that carries "^id" at the end of its last line (or alone on the line after it).
// A list item brings its indented children along; anything else is the paragraph above.
function blockOf(lines, id) {
   const tag = new RegExp('(^|\\s)\\^' + escapeRegExp(id) + '\\s*$');
   const idLine = lines.findIndex((l) => tag.test(l));
   if (idLine < 0) return null;
   const alone = lines[idLine].trim() === '^' + id;
   const last = alone ? idLine - 1 : idLine;
   if (last < 0 || !lines[last].trim()) return null;

   const indent = (l) => /^\s*/.exec(l)[0].length;
   const isItem = /^\s*([-*+]|\d+[.)])\s/.test(lines[last]);
   let start = last;
   if (!isItem) {
      while (start > 0 && lines[start - 1].trim() !== '') start--;
   }
   const out = lines.slice(start, last + 1);
   if (isItem && !alone) {
      for (let j = last + 1; j < lines.length; j++) {
         if (!lines[j].trim() || indent(lines[j]) <= indent(lines[last])) break;
         out.push(lines[j]);
      }
   }
   if (!alone) out[idLine - start] = out[idLine - start].replace(tag, '');
   return out;
}

// The text an embed shows, or null when the section / block does not exist.
function embedSelection(file, frag) {
   const lines = readNoteLines(file);
   if (!frag) return lines;
   if (frag.startsWith('^')) return blockOf(lines, frag.slice(1));
   return sectionOf(lines, frag);
}

function embedBox(esc, href, title, body) {
   return (
      '<div class="note-embed"><div class="note-embed-title"><a href="' + esc(href) + '">' + esc(title) + '</a></div>' +
      '<div class="note-embed-body">' + body + '</div></div>\n'
   );
}

// Renders the note through the same markdown-it instance, so images, links, callouts and
// nested embeds inside it work. Paths come out relative to the note being previewed.
function renderEmbed(md, env, ctx, file, frag) {
   const esc = md.utils.escapeHtml;
   const stack = env.obsidianEmbedStack || (ctx.docPath ? [ctx.docPath] : []);
   const same = (a, b) => a.toLowerCase() === b.toLowerCase();
   const title = path.basename(file, '.md') + (frag ? ' > ' + frag : '');
   const anchor = frag && !frag.startsWith('^') ? '#' + slugify(frag.split('#').pop()) : '';
   const href = toSrc(ctx.docDir, file) + anchor;
   const notice = (text) => embedBox(esc, href, title, '<p class="note-embed-notice">' + esc(text) + '</p>');

   if (stack.some((s) => same(s, file)) || stack.length > MAX_EMBED_DEPTH) {
      return notice('Embed loop: this note is already being shown above.').replace('note-embed"', 'note-embed note-embed-loop"');
   }
   const lines = embedSelection(file, frag);
   if (!lines) return notice(frag.startsWith('^') ? 'Block not found.' : 'Section not found.');

   const html = md.render(lines.join('\n'), Object.assign({}, env, { obsidianEmbedStack: stack.concat(file) }));
   // The preview's scroll-sync markers refer to line numbers of the embedded text, not this page.
   const clean = html.replace(/\sdata-line="\d+"/g, '').replace(/\s*\bcode-line\b/g, '').replace(/ class=""/g, '');
   return embedBox(esc, href, title, clean);
}

// A paragraph made only of ![[Note]] lines becomes the note's content. An embed in the
// middle of a sentence, or of a note that does not exist, is left as written.
function noteEmbedRule(state) {
   const tokens = state.tokens;
   let ctx = null;
   for (let i = 0; i + 2 < tokens.length; i++) {
      if (tokens[i].type !== 'paragraph_open' || tokens[i + 1].type !== 'inline' || tokens[i + 2].type !== 'paragraph_close') {
         continue;
      }
      const lines = tokens[i + 1].content.split('\n').map((l) => l.trim());
      if (!lines.every((l) => NOTE_EMBED_LINE.test(l))) continue;

      ctx = ctx || rootFor(state.env);
      if (!ctx) return;
      let html = '';
      for (const line of lines) {
         const target = NOTE_EMBED_LINE.exec(line)[1].split('|')[0].trim();
         const hash = target.indexOf('#');
         const name = (hash < 0 ? target : target.slice(0, hash)).trim();
         const frag = hash < 0 ? '' : target.slice(hash + 1).trim();
         const ext = path.extname(name).toLowerCase();
         const file = name && (!ext || ext === '.md') ? resolveNote(ctx.root, name) : null;
         if (!file) {
            html = null;
            break;
         }
         html += renderEmbed(state.md, state.env, ctx, file, frag);
      }
      if (html === null) continue;

      const token = new state.Token('html_block', '', 0);
      token.content = html;
      tokens.splice(i, 3, token);
   }
}

function activate(context) {
   const track = (editor) => {
      if (editor && editor.document.languageId === 'markdown' && editor.document.uri.scheme === 'file') {
         lastMarkdownPath = editor.document.uri.fsPath;
      }
   };
   track(vscode.window.activeTextEditor);
   context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(track));
   return {
      extendMarkdownIt(md) {
         md.inline.ruler.before('image', 'obsidian_embed', embedRule);
         md.inline.ruler.before('link', 'obsidian_wikilink', wikilinkRule);
         md.inline.ruler.before('emphasis', 'obsidian_highlight', highlightRule);
         md.core.ruler.after('block', 'obsidian_note_embeds', noteEmbedRule);
         md.core.ruler.after('inline', 'obsidian_callouts', calloutRule);
         md.core.ruler.before('normalize', 'obsidian_image_links', imageLinkRule);
         return md;
      },
   };
}

module.exports = { activate };
