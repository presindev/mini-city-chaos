/* spec.js — SDD spec page: renders the embedded markdown sources in the browser.
 *
 * scripts/render-spec.sh (or render-spec.ps1) embeds each markdown document in
 * a <script type="text/markdown" data-file="…"> block of spec-shell.html.template
 * and inlines this file. No external dependencies; works from file://.
 *
 *   - spec mode (a feature folder): overview + one tab per document, and
 *     per-item feedback (accept / change / reject / answer / comment) that the
 *     developer saves as feedback.md for the agent to apply.
 *   - single mode (one file, e.g. history.md): the document alone.
 *
 * Markdown conventions: skills/sdd-workflow/spec-format.md.
 */
(function () {
  'use strict';

  /* ── Shared vocabulary ─────────────────────────────────────────── */

  // Frontmatter keys whose values render as status badges.
  var BADGE_KEYS = ['status', 'approval', 'human_approval', 'review_status', 'decision',
    'documentation_status'];
  // Frontmatter keys whose values render as <code>.
  var CODE_KEY_SUFFIXES = ['_id', '_slug', '_document', '_path', '_command', '_date'];
  var CODE_KEYS = ['task_id', 'feature_slug', 'source_document', 'created', 'spec'];

  // status word → badge variant
  var BADGE_VARIANTS = {
    draft: 'draft', spec_draft: 'draft',
    pending: 'pending', spec_ready: 'pending', in_progress: 'pending', todo: 'pending',
    ok: 'ok', approved: 'approved', accepted: 'ok', resolved: 'ok', done: 'ok',
    human_approved: 'ok', updated: 'ok', pass: 'ok', passed: 'ok', not_required: 'ok',
    blocking: 'blocking', rejected: 'rejected', failed: 'blocking', fail: 'blocking',
    spec_revision_required: 'blocking',
    warning: 'warning', needs_changes: 'warning', deferred: 'warning', blocked: 'warning'
  };

  // requirement-ID prefix → .req-id variant class ('' = default)
  var REQ_ID_CLASSES = [
    [/^NFR/, 'nfr'], [/^EDGE/, 'edge'], [/^(ERR|BLK)/, 'err'], [/^AT-EDGE/, 'edge'],
    [/^AT-ERR/, 'err'], [/^(AC|UI|IMG)/, 'ac'], [/^NBK/, 'edge'], [/^T-?\d/, 't']
  ];

  var ID_TOKEN = /^([A-Z]{1,4}(?:-[A-Z]{1,4})?-?\d+(?:\.\d+)*)$/;
  var REQ_ROW = /^([A-Z]{1,4}(?:-[A-Z]{1,4})?-?\d+(?:\.\d+)*):\s+(.+)$/;
  var INLINE_BADGE = /\[!(draft|pending|ok|approved|blocking|rejected|warning)\s+([^\]]+)\]/g;
  var CELL_VERDICT = /^!(ok|warning|blocking|pending)(?:\s+(.*))?$/;
  var ITEM_STATUS = /^\[([ x>!])\]\s+/;
  var ITEM_STATUS_CLASS = { x: 'done', '>': 'in-progress', '!': 'blocked', ' ': '' };

  // Document order and tab labels in spec mode.
  var DOC_ORDER = ['requirements', 'open-questions', 'assumptions', 'design', 'tasks',
    'acceptance-tests', 'review'];
  var DOC_LABELS = {
    requirements: 'Requirements', 'open-questions': 'Questions', assumptions: 'Assumptions',
    design: 'Design', tasks: 'Tasks', 'acceptance-tests': 'Tests', review: 'Review'
  };

  /* ── Small helpers ─────────────────────────────────────────────── */

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function slugify(s) {
    return s.toLowerCase().replace(/`/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function reqIdClass(id) {
    for (var i = 0; i < REQ_ID_CLASSES.length; i++) {
      if (REQ_ID_CLASSES[i][0].test(id)) return REQ_ID_CLASSES[i][1];
    }
    return '';
  }

  function reqIdSpan(id) {
    var cls = reqIdClass(id);
    return '<span class="req-id' + (cls ? ' ' + cls : '') + '" data-ref="' + escapeHtml(id) + '">' +
      escapeHtml(id) + '</span>';
  }

  function badgeSpan(word) {
    var variant = BADGE_VARIANTS[word.toLowerCase()] || 'draft';
    return '<span class="badge badge-' + variant + '">' + escapeHtml(word.replace(/_/g, ' ')) + '</span>';
  }

  function store(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
    } catch (e) { /* storage unavailable: state lives for this visit only */ }
    return null;
  }

  /* ── Inline markdown ───────────────────────────────────────────── */

  function inline(text) {
    var codes = [];
    var s = text.replace(/`([^`]+)`/g, function (_, code) {
      codes.push('<code>' + escapeHtml(code) + '</code>');
      return '\x00' + (codes.length - 1) + '\x00';
    });
    s = escapeHtml(s);
    s = s.replace(INLINE_BADGE, function (_, variant, label) {
      return '<span class="badge badge-' + variant + '">' + label + '</span>';
    });
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    s = s.replace(/\x00(\d+)\x00/g, function (_, i) { return codes[Number(i)]; });
    return s;
  }

  /* ── Frontmatter ───────────────────────────────────────────────── */

  function parseFrontmatter(text) {
    var meta = [];
    if (text.indexOf('---') !== 0) return { meta: meta, body: text };
    var lines = text.split(/\r?\n/);
    var end = -1;
    for (var i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') { end = i; break; }
    }
    if (end === -1) return { meta: meta, body: text };
    for (var j = 1; j < end; j++) {
      var line = lines[j];
      if (!line.trim() || line.trim().charAt(0) === '#') continue;
      var m = line.match(/^([A-Za-z0-9_-]+):\s*(.*?)\s*(?:#.*)?$/);
      if (m) meta.push([m[1], m[2]]);
    }
    return { meta: meta, body: lines.slice(end + 1).join('\n') };
  }

  function metaValue(key, value) {
    if (BADGE_KEYS.indexOf(key) !== -1) return badgeSpan(value);
    var isCode = CODE_KEYS.indexOf(key) !== -1 ||
      CODE_KEY_SUFFIXES.some(function (suf) { return key.slice(-suf.length) === suf; });
    return isCode ? '<code>' + escapeHtml(value) + '</code>' : inline(value);
  }

  function metaList(meta) {
    var items = meta.filter(function (kv) { return kv[0] !== 'title' && kv[0] !== 'doc'; })
      .map(function (kv) {
        var label = kv[0].replace(/_/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); });
        return '<div><dt>' + escapeHtml(label) + '</dt><dd>' + metaValue(kv[0], kv[1]) + '</dd></div>';
      });
    return items.length ? '<dl class="meta">' + items.join('') + '</dl>' : '';
  }

  /* ── Block-level markdown ──────────────────────────────────────── */

  function parseBlocks(lines, out, container) {
    var i = 0;
    var n = lines.length;
    var cardState = container && container.type === 'card' ? { headerDone: false, bodyOpen: false } : null;

    function ensureCardBody() {
      if (cardState && !cardState.bodyOpen) { out.push('<div class="card-body">'); cardState.bodyOpen = true; }
    }

    while (i < n) {
      var line = lines[i];
      var trimmed = line.trim();
      if (!trimmed) { i++; continue; }

      // HTML comment (guidance): skip, including multi-line comments.
      if (trimmed.indexOf('<!--') === 0) {
        while (i < n && lines[i].indexOf('-->') === -1) i++;
        i++;
        continue;
      }

      // Fenced code block
      if (trimmed.indexOf('```') === 0) {
        ensureCardBody();
        var lang = trimmed.slice(3).trim();
        var code = [];
        i++;
        while (i < n && lines[i].trim().indexOf('```') !== 0) { code.push(lines[i]); i++; }
        i++;
        var cls = lang ? ' class="language-' + escapeHtml(lang) + '"' : '';
        out.push('<pre><code' + cls + '>' + escapeHtml(code.join('\n')) + '</code></pre>');
        continue;
      }

      // Container: ::: name [classes...]  /  ::: closes
      if (trimmed.indexOf(':::') === 0) {
        var spec = trimmed.slice(3).replace(/<!--.*?-->/g, '').trim();
        if (!spec) { i++; continue; }
        var inner = [];
        var depth = 1;
        i++;
        while (i < n) {
          var t = lines[i].trim();
          if (t.indexOf(':::') === 0 && t.slice(3).trim()) depth++;
          else if (t === ':::') { depth--; if (depth === 0) break; }
          inner.push(lines[i]);
          i++;
        }
        i++;
        ensureCardBody();
        renderContainer(spec, inner, out);
        continue;
      }

      // Raw HTML block (passes through untouched until a blank line)
      if (/^</.test(trimmed)) {
        ensureCardBody();
        var raw = [];
        while (i < n && lines[i].trim()) { raw.push(lines[i]); i++; }
        out.push(raw.join('\n'));
        continue;
      }

      // Heading
      var h = trimmed.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        var level = h[1].length;
        var text = h[2].trim();
        if (cardState && level === 4 && !cardState.headerDone && !cardState.bodyOpen) {
          out.push(renderCardHeader(text));
          cardState.headerDone = true;
          i++;
          continue;
        }
        ensureCardBody();
        out.push('<h' + level + ' id="' + slugify(text) + '">' + inline(text) + '</h' + level + '>');
        i++;
        continue;
      }

      // Horizontal rule
      if (/^(-{3,}|\*{3,})$/.test(trimmed)) { ensureCardBody(); out.push('<hr>'); i++; continue; }

      // Table
      if (trimmed.charAt(0) === '|' && i + 1 < n && /^\|[\s:|-]+\|?$/.test(lines[i + 1].trim())) {
        ensureCardBody();
        var tbl = [];
        while (i < n && lines[i].trim().charAt(0) === '|') { tbl.push(lines[i].trim()); i++; }
        out.push(renderTable(tbl));
        continue;
      }

      // List
      if (/^(\s*)([-*]|\d+\.)\s+/.test(line)) {
        var block = [];
        while (i < n && lines[i].trim() !== '') {
          if (!/^(\s*)([-*]|\d+\.)\s+/.test(lines[i]) && !/^\s{2,}\S/.test(lines[i])) break;
          block.push(lines[i]);
          i++;
        }
        ensureCardBody();
        out.push(renderList(block, container));
        continue;
      }

      // Blockquote
      if (trimmed.charAt(0) === '>') {
        ensureCardBody();
        var quote = [];
        while (i < n && lines[i].trim().charAt(0) === '>') {
          quote.push(lines[i].trim().replace(/^>\s?/, ''));
          i++;
        }
        out.push('<blockquote><p>' + inline(quote.join(' ')) + '</p></blockquote>');
        continue;
      }

      // Requirement row: "REQ-001: text"
      var req = trimmed.match(REQ_ROW);
      if (req) {
        ensureCardBody();
        var rc = reqIdClass(req[1]);
        out.push('<div class="req-row' + (rc ? ' ' + rc : '') + '" data-item="' + escapeHtml(req[1]) + '">' +
          reqIdSpan(req[1]) + '<span class="req-text">' + inline(req[2]) + '</span></div>');
        i++;
        continue;
      }

      // Paragraph
      ensureCardBody();
      var para = [];
      while (i < n && lines[i].trim() && !/^(#{1,4}\s|```|:::|\||[-*]\s|\d+\.\s|>|<)/.test(lines[i].trim()) &&
        !REQ_ROW.test(lines[i].trim()) && !/^(-{3,}|\*{3,})$/.test(lines[i].trim())) {
        para.push(lines[i].trim());
        i++;
      }
      if (para.length) out.push('<p>' + inline(para.join(' ')) + '</p>');
      else i++;
    }

    if (cardState && cardState.bodyOpen) out.push('</div>');
  }

  /* ── Containers ────────────────────────────────────────────────── */

  function renderContainer(spec, innerLines, out) {
    var parts = spec.split(/\s+/);
    var kind = parts[0];

    if (kind === 'collapse') {
      var title = spec.slice('collapse'.length).trim() || 'Details';
      out.push('<details class="collapse"><summary>' + inline(title) + '</summary><div class="collapse-body">');
      parseBlocks(innerLines, out, { type: 'collapse' });
      out.push('</div></details>');
      return;
    }
    if (kind === 'card') {
      var extra = parts.slice(1).filter(function (c) { return /^[a-z0-9-]+$/.test(c); }).join(' ');
      out.push('<div class="card' + (extra ? ' ' + extra : '') + '">');
      parseBlocks(innerLines, out, { type: 'card' });
      out.push('</div>');
      return;
    }
    if (kind === 'note' || kind === 'diagram') {
      out.push('<div class="' + (kind === 'note' ? 'note' : 'diagram') + '">');
      parseBlocks(innerLines, out, { type: kind });
      out.push('</div>');
      return;
    }
    // Generic: the words become CSS classes.
    out.push('<div class="' + escapeHtml(spec) + '">');
    parseBlocks(innerLines, out, { type: 'generic' });
    out.push('</div>');
  }

  // "#### A1 — Title [!pending Pending]" → card header
  function renderCardHeader(text) {
    var rest = text;
    var idSpan = '';
    var id = '';
    var idMatch = rest.match(/^([A-Z]{1,4}(?:-[A-Z]{1,4})?-?\d+)\s*[—-]\s*/);
    if (idMatch) {
      id = idMatch[1];
      idSpan = reqIdSpan(id);
      rest = rest.slice(idMatch[0].length);
    }
    var badge = '';
    var badgeMatch = rest.match(/\[!(draft|pending|ok|approved|blocking|rejected|warning)\s+([^\]]+)\]\s*$/);
    if (badgeMatch) {
      badge = '<span class="badge badge-' + badgeMatch[1] + '">' + escapeHtml(badgeMatch[2]) + '</span>';
      rest = rest.slice(0, badgeMatch.index).trim();
    }
    return '<div class="card-header"' + (id ? ' data-item="' + escapeHtml(id) + '"' : '') + '>' + idSpan +
      '<span class="card-title">' + inline(rest) + '</span>' + badge + '</div>';
  }

  /* ── Tables ────────────────────────────────────────────────────── */

  function splitRow(row) {
    var cells = [];
    var cur = '';
    var inCode = false;
    var body = row.replace(/^\|/, '').replace(/\|$/, '');
    for (var k = 0; k < body.length; k++) {
      var ch = body.charAt(k);
      if (ch === '`') inCode = !inCode;
      if (ch === '|' && !inCode) { cells.push(cur.trim()); cur = ''; } else cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  }

  function renderCell(raw, tag) {
    var cls = '';
    var content = raw;
    var verdict = raw.match(CELL_VERDICT);
    if (verdict) { cls = ' class="v-' + verdict[1] + '"'; content = verdict[2] || verdict[1]; }
    var idTok = content.match(ID_TOKEN);
    return '<' + tag + cls + '>' + (idTok ? reqIdSpan(idTok[1]) : inline(content)) + '</' + tag + '>';
  }

  function renderTable(rows) {
    var header = splitRow(rows[0]);
    var body = rows.slice(2).map(splitRow);
    var thead = '<thead><tr>' + header.map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr></thead>';
    var tbody = body.length ? '<tbody>' + body.map(function (r) {
      return '<tr>' + r.map(function (c) { return renderCell(c, 'td'); }).join('') + '</tr>';
    }).join('') + '</tbody>' : '';
    return '<div class="table-wrap"><table>' + thead + tbody + '</table></div>';
  }

  /* ── Lists ─────────────────────────────────────────────────────── */

  function parseListItems(lines) {
    var items = [];
    var baseIndent = null;
    lines.forEach(function (line) {
      var m = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
      if (m && (baseIndent === null || m[1].length <= baseIndent)) {
        if (baseIndent === null) baseIndent = m[1].length;
        if (m[1].length === baseIndent) { items.push({ marker: m[2], text: m[3], children: [] }); return; }
      }
      if (items.length) items[items.length - 1].children.push(line);
    });
    return items;
  }

  function dedent(lines) {
    var indents = lines.filter(function (l) { return l.trim(); }).map(function (l) { return l.match(/^\s*/)[0].length; });
    var min = indents.length ? Math.min.apply(null, indents) : 0;
    return lines.map(function (l) { return l.slice(min); });
  }

  function renderList(lines, container) {
    var items = parseListItems(lines);
    if (!items.length) return '';
    var ordered = /^\d+\.$/.test(items[0].marker);
    var allStatus = items.every(function (it) { return ITEM_STATUS.test(it.text); });

    if (ordered && allStatus) return renderTimeline(items);
    if (!ordered && allStatus) {
      return '<ul class="checklist">' + items.map(function (it) {
        var done = it.text.match(ITEM_STATUS)[1] === 'x';
        return '<li' + (done ? ' class="done"' : '') + '>' + inline(it.text.replace(ITEM_STATUS, '')) + '</li>';
      }).join('') + '</ul>';
    }
    if (container && container.type === 'card' &&
      items.every(function (it) { return /^\*\*[^*]+:\*\*\s/.test(it.text); })) {
      return '<dl class="fields">' + items.map(function (it) {
        var m = it.text.match(/^\*\*([^*]+):\*\*\s+(.*)$/);
        return '<div><dt>' + inline(m[1]) + '</dt><dd>' + inline(m[2]) + '</dd></div>';
      }).join('') + '</dl>';
    }
    var tag = ordered ? 'ol' : 'ul';
    return '<' + tag + '>' + items.map(function (it) {
      var innerHtml = inline(it.text);
      if (it.children.length) {
        var d = dedent(it.children);
        innerHtml += d.some(function (l) { return /^(\s*)([-*]|\d+\.)\s+/.test(l); })
          ? renderList(d, container) : '<p>' + inline(d.join(' ').trim()) + '</p>';
      }
      return '<li>' + innerHtml + '</li>';
    }).join('') + '</' + tag + '>';
  }

  function renderTimeline(items) {
    return '<ol class="timeline">' + items.map(function (it) {
      var status = ITEM_STATUS_CLASS[it.text.match(ITEM_STATUS)[1]];
      var rest = it.text.replace(ITEM_STATUS, '');
      var chip = '';
      var id = '';
      var idm = rest.match(/^(T-?\d+(?:\.\d+)*):\s*/);
      if (idm) { id = idm[1]; chip = reqIdSpan(id); rest = rest.slice(idm[0].length); }
      var parts = rest.split(' — ');
      var body = parts.slice(1).join(' — ');
      return '<li class="task' + (status ? ' ' + status : '') + '"' + (id ? ' data-item="' + escapeHtml(id) + '"' : '') + '>' +
        '<div class="task-head">' + chip + '<strong>' + inline(parts[0]) + '</strong></div>' +
        (body ? '<div class="task-body">' + inline(body) + '</div>' : '') + '</li>';
    }).join('') + '</ol>';
  }

  /* ── Documents ─────────────────────────────────────────────────── */

  function readSources() {
    return Array.prototype.map.call(document.querySelectorAll('script[type="text/markdown"]'), function (el) {
      var text = el.textContent.replace(/^\n/, '').replace(/<\\\/(script)/gi, '</$1');
      var fm = parseFrontmatter(text);
      var metaMap = {};
      fm.meta.forEach(function (kv) { metaMap[kv[0]] = kv[1]; });
      var file = el.getAttribute('data-file') || 'document.md';
      var key = metaMap.doc || file.replace(/\.md$/, '');
      var out = [];
      parseBlocks(fm.body.split(/\r?\n/), out, null);
      return { key: key, file: file, meta: fm.meta, metaMap: metaMap, title: metaMap.title || file, markup: out.join('\n') };
    }).sort(function (a, b) {
      var ia = DOC_ORDER.indexOf(a.key); var ib = DOC_ORDER.indexOf(b.key);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }

  // Wrap each <h2> and the content up to the next <h2> in a collapsible section.
  // Sections whose whole body is "None." / "Not applicable." collapse to one line.
  function sectionize(root) {
    var nodes = Array.prototype.slice.call(root.childNodes);
    var current = null;
    var frag = document.createDocumentFragment();
    nodes.forEach(function (node) {
      if (node.nodeType === 1 && node.tagName === 'H2') {
        current = document.createElement('details');
        current.className = 'sec';
        current.open = true;
        current.id = node.id;
        var summary = document.createElement('summary');
        summary.innerHTML = node.innerHTML;
        current.appendChild(summary);
        current.body = document.createElement('div');
        current.body.className = 'sec-body';
        current.appendChild(current.body);
        frag.appendChild(current);
        root.removeChild(node);
      } else if (current) {
        current.body.appendChild(node);
      } else {
        frag.appendChild(node);
      }
    });
    root.appendChild(frag);
    Array.prototype.forEach.call(root.querySelectorAll('details.sec'), function (sec) {
      var body = sec.querySelector('.sec-body');
      var text = body.textContent.trim();
      if (text.length < 80 && /^(none|not applicable|n\/a|no |not required)/i.test(text) && !body.querySelector('table, .card, ol, ul')) {
        var line = document.createElement('div');
        line.className = 'sec-empty';
        line.id = sec.id;
        line.innerHTML = '<span class="sec-empty-title">' + sec.querySelector('summary').innerHTML + '</span>' +
          '<span class="sec-empty-text">' + escapeHtml(text) + '</span>';
        sec.parentNode.replaceChild(line, sec);
      }
    });
  }

  /* ── Feedback state ────────────────────────────────────────────── */

  var ACTIONS = {
    accept: { label: 'Accept', icon: '✓', needsText: false },
    change: { label: 'Change', icon: '✎', needsText: true, prompt: 'What should change?' },
    reject: { label: 'Reject', icon: '✕', needsText: true, prompt: 'Why, and what instead?' },
    answer: { label: 'Answer', icon: '↳', needsText: true, prompt: 'Your answer' },
    comment: { label: 'Comment', icon: '💬', needsText: true, prompt: 'Your comment' }
  };
  var DOC_ACTIONS = {
    'open-questions': ['answer', 'comment'],
    assumptions: ['accept', 'reject', 'comment'],
    review: ['comment'],
    tasks: ['accept', 'change', 'comment']
  };
  var DEFAULT_ACTIONS = ['accept', 'change', 'comment'];

  var state = { items: {}, verdict: 'none', general: '' };
  var stateKey = '';
  var listeners = [];

  function loadState(slug) {
    stateKey = 'sdd-feedback:' + slug;
    try {
      var saved = JSON.parse(store(stateKey) || 'null');
      if (saved && saved.items) state = saved;
    } catch (e) { /* ignore corrupt state */ }
  }

  function saveState() {
    store(stateKey, JSON.stringify(state));
    listeners.forEach(function (fn) { fn(); });
  }

  function feedbackMarkdown(slug, order) {
    var ids = Object.keys(state.items).sort(function (a, b) {
      var ia = order.indexOf(a); var ib = order.indexOf(b);
      return (ia === -1 ? 1e6 : ia) - (ib === -1 ? 1e6 : ib);
    });
    var lines = ['---', 'doc: feedback', 'feature_slug: ' + slug, 'generated: ' + new Date().toISOString(),
      'verdict: ' + state.verdict, '---', '', '## Items', ''];
    if (!ids.length) lines.push('None.');
    ids.forEach(function (id) {
      var it = state.items[id];
      var text = (it.text || '').replace(/\s*\n\s*/g, ' ').trim();
      lines.push('- ' + id + ': ' + it.action + (text ? ' — ' + text : ''));
    });
    lines.push('', '## General', '', state.general.trim() || 'None.', '');
    return lines.join('\n');
  }

  function countFeedback() {
    var c = { total: 0 };
    Object.keys(state.items).forEach(function (id) {
      var a = state.items[id].action;
      c[a] = (c[a] || 0) + 1;
      c.total++;
    });
    return c;
  }

  /* ── Feedback controls on items ────────────────────────────────── */

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function attachControls(itemEl, id, actions) {
    var bar = el('div', 'fb');
    var editor = el('div', 'fb-editor');
    editor.hidden = true;
    var textarea = el('textarea');
    textarea.rows = 2;
    var save = el('button', 'btn btn-primary', 'Save');
    var remove = el('button', 'btn btn-ghost', 'Clear');
    save.type = remove.type = 'button';
    var editorActions = el('div', 'fb-editor-actions');
    editorActions.appendChild(save);
    editorActions.appendChild(remove);
    editor.appendChild(textarea);
    editor.appendChild(editorActions);
    var note = el('div', 'fb-note');
    var pendingAction = null;

    actions.forEach(function (name) {
      var a = ACTIONS[name];
      var b = el('button', 'fb-btn', '<span aria-hidden="true">' + a.icon + '</span><span class="fb-label">' + a.label + '</span>');
      b.type = 'button';
      b.setAttribute('data-action', name);
      b.title = a.label + ' ' + id;
      b.setAttribute('aria-label', a.label + ' ' + id);
      b.addEventListener('click', function () {
        var cur = state.items[id];
        if (!a.needsText) {
          if (cur && cur.action === name) delete state.items[id];
          else state.items[id] = { action: name, text: '' };
          editor.hidden = true;
          saveState();
          return;
        }
        pendingAction = name;
        textarea.placeholder = a.prompt;
        textarea.value = cur && cur.action === name ? cur.text : '';
        editor.hidden = false;
        textarea.focus();
      });
      bar.appendChild(b);
    });

    save.addEventListener('click', function () {
      var text = textarea.value.trim();
      if (!text) { textarea.focus(); return; }
      state.items[id] = { action: pendingAction, text: text };
      editor.hidden = true;
      saveState();
    });
    remove.addEventListener('click', function () {
      delete state.items[id];
      editor.hidden = true;
      saveState();
    });
    textarea.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save.click();
      if (e.key === 'Escape') editor.hidden = true;
    });

    function paint() {
      var cur = state.items[id];
      Array.prototype.forEach.call(bar.children, function (b) {
        b.classList.toggle('on', !!cur && cur.action === b.getAttribute('data-action'));
      });
      itemEl.setAttribute('data-fb', cur ? cur.action : '');
      note.hidden = !(cur && cur.text);
      note.innerHTML = cur && cur.text ? '<strong>' + ACTIONS[cur.action].label + ':</strong> ' + escapeHtml(cur.text) : '';
    }
    listeners.push(paint);
    paint();

    // Buttons sit at the end of the item's first line (card header, row, task
    // head); the note and the editor go below the item.
    var line = itemEl.querySelector('.task-head') || itemEl;
    line.appendChild(bar);
    var below = itemEl.classList.contains('card-header') ? itemEl.parentNode : itemEl;
    below.appendChild(note);
    below.appendChild(editor);
  }

  /* ── Page assembly ─────────────────────────────────────────────── */

  function themeToggle() {
    var b = el('button', 'theme-toggle', '');
    b.type = 'button';
    b.setAttribute('aria-label', 'Toggle light or dark theme');
    function current() {
      var t = document.documentElement.getAttribute('data-theme');
      if (t) return t;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    function paint() { b.textContent = current() === 'dark' ? '☀︎' : '☾'; }
    b.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      store('sdd-theme', next);
      paint();
    });
    paint();
    return b;
  }

  function headerBadges(doc) {
    if (!doc) return '';
    return BADGE_KEYS.filter(function (k) { return doc.metaMap[k]; }).map(function (k) {
      return '<span class="badge-label">' + escapeHtml(k.replace(/_/g, ' ')) + '</span>' + badgeSpan(doc.metaMap[k]);
    }).join('');
  }

  function renderSingle(app, doc) {
    document.title = doc.title;
    var top = el('header', 'topbar');
    top.innerHTML = '<div class="topbar-inner"><span class="brand">SDD</span><span class="topbar-title">' +
      escapeHtml(doc.title) + '</span><span class="spacer"></span></div>';
    top.firstChild.appendChild(themeToggle());
    app.appendChild(top);
    var main = el('main', 'page');
    var panel = el('article', 'doc', '<h1>' + escapeHtml(doc.title) + '</h1>' + metaList(doc.meta) +
      '<div class="doc-body">' + doc.markup + '</div>');
    main.appendChild(panel);
    app.appendChild(main);
    sectionize(panel.querySelector('.doc-body'));
  }

  function textOf(html) {
    var d = document.createElement('div');
    d.innerHTML = html;
    return d;
  }

  function overview(docs, byKey) {
    var req = byKey.requirements;
    var parts = [];

    // At a glance: the requirements summary.
    var summary = '';
    if (req) {
      var d = textOf(req.markup);
      var h = d.querySelector('h2');
      if (h && /summary/i.test(h.textContent)) {
        var buf = [];
        var n = h.nextElementSibling;
        while (n && n.tagName !== 'H2') { buf.push(n.outerHTML); n = n.nextElementSibling; }
        summary = buf.join('');
      }
    }
    parts.push('<section class="glance"><p class="eyebrow">At a glance</p>' +
      (summary || '<p class="muted">No summary in requirements.md.</p>') + '</section>');

    // Stats.
    var stats = [];
    function count(doc, sel) { return doc ? textOf(doc.markup).querySelectorAll(sel).length : 0; }
    if (req) stats.push(['Requirements', count(req, '.req-row'), 'requirements']);
    if (byKey['open-questions']) stats.push(['Open questions', openCards(byKey['open-questions']).length, 'open-questions']);
    if (byKey.assumptions) stats.push(['Pending assumptions', openCards(byKey.assumptions).length, 'assumptions']);
    if (byKey.tasks) {
      var t = textOf(byKey.tasks.markup);
      stats.push(['Tasks done', t.querySelectorAll('.timeline .task.done').length + ' / ' + t.querySelectorAll('.timeline .task').length, 'tasks']);
    }
    if (byKey.review && byKey.review.metaMap.review_status) {
      stats.push(['Review', badgeSpan(byKey.review.metaMap.review_status), 'review']);
    }
    parts.push('<div class="stats">' + stats.map(function (s) {
      return '<a class="stat" href="#' + s[2] + '"><span class="stat-value">' + s[1] + '</span><span class="stat-label">' + s[0] + '</span></a>';
    }).join('') + '</div>');

    // Needs your decision.
    var decide = [];
    ['open-questions', 'assumptions'].forEach(function (k) {
      if (byKey[k]) openCards(byKey[k]).forEach(function (c) { decide.push(c.outerHTML); });
    });
    parts.push('<section class="decide"><h2>Needs your decision</h2>' +
      (decide.length ? '<p class="muted">Answer or accept each item here, or review the full documents in the tabs. Then save your feedback below.</p>' + decide.join('')
        : '<p class="muted">Nothing open. Review the documents, then approve or request changes below.</p>') + '</section>');

    return parts.join('');
  }

  // Cards under the first "open"/"pending" section of a document (or all cards if no such section).
  function openCards(doc) {
    var d = textOf(doc.markup);
    var cards = [];
    var inOpen = null;
    Array.prototype.forEach.call(d.children, function (n) {
      if (n.tagName === 'H2') inOpen = /^(open|pending|blocking|non-blocking)/i.test(n.textContent.trim());
      if (n.classList && n.classList.contains('card') && inOpen !== false) cards.push(n);
    });
    return cards;
  }

  function renderSpec(app, docs, slug) {
    var byKey = {};
    docs.forEach(function (d) { byKey[d.key] = d; });
    var lead = byKey.requirements || docs[0];
    var title = lead.title.replace(/^Requirements\s*[—–-]\s*/i, '');
    document.title = title + ' — spec';
    loadState(slug);

    // Top bar.
    var top = el('header', 'topbar');
    top.innerHTML = '<div class="topbar-inner"><span class="brand">SDD spec</span><span class="topbar-title">' +
      escapeHtml(title) + '</span><span class="topbar-badges">' + headerBadges(lead) + '</span><span class="spacer"></span></div>';
    top.firstChild.appendChild(themeToggle());

    // Tabs.
    var tabs = [{ key: 'overview', label: 'Overview' }].concat(docs.map(function (d) {
      return { key: d.key, label: DOC_LABELS[d.key] || d.title.split(/\s+[—–-]\s+/)[0] };
    }));
    var nav = el('nav', 'tabs');
    nav.setAttribute('aria-label', 'Spec documents');
    tabs.forEach(function (t) {
      var a = el('a', 'tab', escapeHtml(t.label));
      a.href = '#' + t.key;
      a.setAttribute('data-tab', t.key);
      a.addEventListener('click', function (e) { e.preventDefault(); show(t.key); });
      nav.appendChild(a);
    });
    top.appendChild(nav);
    app.appendChild(top);

    // Panels.
    var main = el('main', 'page');
    var ov = el('section', 'panel', overview(docs, byKey));
    ov.setAttribute('data-panel', 'overview');
    main.appendChild(ov);
    docs.forEach(function (d) {
      var p = el('section', 'panel', '<article class="doc"><h1>' + escapeHtml(d.title) + '</h1>' + metaList(d.meta) +
        '<div class="doc-body">' + d.markup + '</div></article>');
      p.setAttribute('data-panel', d.key);
      p.setAttribute('data-doc', d.key);
      main.appendChild(p);
      sectionize(p.querySelector('.doc-body'));
    });
    app.appendChild(main);

    // Feedback controls: overview cards belong to their source document.
    var order = [];
    Array.prototype.forEach.call(main.querySelectorAll('[data-doc] [data-item]'), function (item) {
      var id = item.getAttribute('data-item');
      if (order.indexOf(id) === -1) order.push(id);
    });
    Array.prototype.forEach.call(main.querySelectorAll('[data-item]'), function (item) {
      var id = item.getAttribute('data-item');
      var panel = item.closest('[data-panel]');
      var docKey = panel.getAttribute('data-doc');
      if (!docKey) {
        docKey = /^Q/.test(id) ? 'open-questions' : /^A\d/.test(id) ? 'assumptions' : '';
      }
      attachControls(item, id, DOC_ACTIONS[docKey] || DEFAULT_ACTIONS);
    });

    // ID chips link to their definition.
    Array.prototype.forEach.call(main.querySelectorAll('.req-id[data-ref]'), function (chip) {
      var id = chip.getAttribute('data-ref');
      if (chip.parentNode.getAttribute('data-item') === id) return;
      var target = main.querySelector('[data-panel]:not([data-panel="overview"]) [data-item="' + id + '"]');
      if (!target) return;
      chip.classList.add('ref');
      chip.setAttribute('role', 'link');
      chip.tabIndex = 0;
      chip.title = 'Go to ' + id;
      chip.addEventListener('click', function () {
        show(target.closest('[data-panel]').getAttribute('data-panel'));
        target.scrollIntoView({ block: 'center' });
        target.classList.add('flash');
        setTimeout(function () { target.classList.remove('flash'); }, 1200);
      });
    });

    app.appendChild(feedbackBar(slug, order));

    function show(key) {
      if (!main.querySelector('[data-panel="' + key + '"]')) key = 'overview';
      Array.prototype.forEach.call(main.querySelectorAll('[data-panel]'), function (p) {
        p.hidden = p.getAttribute('data-panel') !== key;
      });
      Array.prototype.forEach.call(nav.children, function (a) {
        a.classList.toggle('active', a.getAttribute('data-tab') === key);
      });
      if (location.hash.slice(1) !== key) history.replaceState(null, '', '#' + key);
      window.scrollTo(0, 0);
    }
    window.addEventListener('hashchange', function () { show(location.hash.slice(1)); });
    show(location.hash.slice(1) || 'overview');

    // Tab counts.
    listeners.push(function () {
      Array.prototype.forEach.call(nav.children, function (a) {
        var key = a.getAttribute('data-tab');
        var n = main.querySelectorAll('[data-panel="' + key + '"] [data-fb]:not([data-fb=""])').length;
        var dot = a.querySelector('.tab-count');
        if (!n) { if (dot) dot.remove(); return; }
        if (!dot) { dot = el('span', 'tab-count'); a.appendChild(dot); }
        dot.textContent = n;
      });
    });
    saveState();
  }

  function feedbackBar(slug, order) {
    var bar = el('aside', 'fbbar');
    bar.setAttribute('aria-label', 'Your feedback');
    bar.innerHTML =
      '<div class="fbbar-inner">' +
      '<span class="fbbar-summary"></span>' +
      '<div class="verdict" role="group" aria-label="Verdict">' +
      '<button type="button" class="seg" data-verdict="approve">Approve</button>' +
      '<button type="button" class="seg" data-verdict="request_changes">Request changes</button></div>' +
      '<button type="button" class="btn btn-ghost" data-act="note">Note</button>' +
      '<span class="spacer"></span>' +
      '<button type="button" class="btn btn-ghost" data-act="reset" title="Clear all feedback">Reset</button>' +
      '<button type="button" class="btn btn-ghost" data-act="copy">Copy</button>' +
      '<button type="button" class="btn btn-primary" data-act="save">Save<span class="hide-sm"> feedback.md</span></button>' +
      '</div>' +
      '<div class="fbbar-note" hidden><textarea rows="3" placeholder="General feedback for the agent"></textarea></div>' +
      '<div class="fbbar-hint" hidden></div>';

    var summary = bar.querySelector('.fbbar-summary');
    var noteBox = bar.querySelector('.fbbar-note');
    var noteArea = noteBox.querySelector('textarea');
    var hint = bar.querySelector('.fbbar-hint');
    noteArea.value = state.general;
    noteArea.addEventListener('input', function () { state.general = noteArea.value; saveState(); });

    function say(msg) {
      hint.innerHTML = msg;
      hint.hidden = false;
    }

    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var v = b.getAttribute('data-verdict');
      if (v) { state.verdict = state.verdict === v ? 'none' : v; saveState(); return; }
      var act = b.getAttribute('data-act');
      var md = feedbackMarkdown(slug, order);
      if (act === 'note') { noteBox.hidden = !noteBox.hidden; if (!noteBox.hidden) noteArea.focus(); }
      if (act === 'reset' && window.confirm('Clear all feedback on this page?')) {
        state = { items: {}, verdict: 'none', general: '' };
        noteArea.value = '';
        saveState();
      }
      if (act === 'copy') {
        var done = function () { say('Copied. Paste it in the chat with your agent.'); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(md).then(done, function () { fallbackCopy(md); done(); });
        } else { fallbackCopy(md); done(); }
      }
      if (act === 'save') saveFile(md, slug, say);
    });

    listeners.push(function () {
      var c = countFeedback();
      var bits = [];
      ['accept', 'change', 'reject', 'answer', 'comment'].forEach(function (a) {
        if (c[a]) bits.push(c[a] + ' ' + (a === 'change' ? 'changed' : a === 'reject' ? 'rejected' : a === 'answer' ? 'answered' : a === 'accept' ? 'accepted' : 'comments'));
      });
      summary.textContent = bits.length ? bits.join(' · ') : 'No feedback yet';
      Array.prototype.forEach.call(bar.querySelectorAll('[data-verdict]'), function (s) {
        s.classList.toggle('on', s.getAttribute('data-verdict') === state.verdict);
      });
    });
    return bar;
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* nothing else to try */ }
    ta.remove();
  }

  function saveFile(md, slug, say) {
    var tell = '<code>specs/' + escapeHtml(slug) + '/feedback.md</code>';
    if (window.showSaveFilePicker) {
      window.showSaveFilePicker({
        suggestedName: 'feedback.md',
        types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }]
      }).then(function (handle) {
        return handle.createWritable().then(function (w) { return w.write(md).then(function () { return w.close(); }); });
      }).then(function () {
        say('Saved. If you saved it as ' + tell + ', tell your agent: <em>read the feedback</em>.');
      }, function (err) {
        if (err && err.name === 'AbortError') return;
        download(md, slug, say);
      });
      return;
    }
    download(md, slug, say);
  }

  function download(md, slug, say) {
    var name = slug + '.feedback.md';
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    say('Downloaded <code>' + escapeHtml(name) + '</code>. Move it to <code>specs/' + escapeHtml(slug) +
      '/feedback.md</code> (or tell your agent where it is), then say: <em>read the feedback</em>.');
  }

  /* ── Boot ──────────────────────────────────────────────────────── */

  function boot() {
    var saved = store('sdd-theme');
    if (saved === 'light' || saved === 'dark') document.documentElement.setAttribute('data-theme', saved);
    var app = document.getElementById('app');
    if (!app) return;
    var docs = readSources();
    if (!docs.length) { app.innerHTML = '<main class="page"><p>No markdown sources embedded.</p></main>'; return; }
    if (app.getAttribute('data-mode') === 'single') renderSingle(app, docs[0]);
    else renderSpec(app, docs, app.getAttribute('data-slug') || 'spec');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}());
