# Research Journal — Feature Tasks

A sequenced punch-list for an agent picking up changes to the research
journal. Read `docs/research-journal.md` first for system context, then
work tasks in order. Every change lives in `pages/research.html` unless
noted otherwise.

---

## Task 1 — Remove the maximum article length

### Goal
Authors should be able to publish articles of any size. The current
client-side cap (~850 KB) must be removed. Firestore's hard per-doc
limit (~1 MiB) is acknowledged and accepted; this task does not
introduce chunking or external storage.

### Where the cap lives
`pages/research.html`, inside the `<script type="module">` block:

1. Constant declaration near the image-helper section
   (search for `MAX_BODY_BYTES`):
   ```js
   const MAX_BODY_BYTES = 850_000; // soft cap before publish
   ```

2. The guard inside the composer submit handler
   (search for `approxBytes`):
   ```js
   const approxBytes = (body.length + (coverDataUrl?.length || 0)) * 0.75;
   if (approxBytes > MAX_BODY_BYTES) {
     showToast('Article too large — remove or shrink some images');
     return;
   }
   ```

### Steps
1. Delete the `MAX_BODY_BYTES` constant line.
2. Delete the `approxBytes` block (both the calculation and the
   `if (...) { showToast(...); return; }` guard) from the
   `composerForm` submit handler.
3. Leave every other publish step untouched — title/cover/tag/body
   validation must still run.
4. Do NOT alter the image-compression constants
   (`COVER_MAX_W`, `INLINE_MAX_W`, `QUALITY`). Those affect quality,
   not length, and are independent of the cap.

### Verification
- Open the composer as an author, write or paste a long article
  (e.g. 5,000+ words with several embedded images), and confirm the
  "Article too large" toast no longer appears.
- Publish succeeds and the article appears on Home / Archive.
- If Firestore rejects an oversize document, the existing
  `catch (err)` already surfaces a "Publish failed — check console"
  toast. That fallback is acceptable.

### Out of scope
- No chunking, no Firebase Storage, no draft splitting.
- Do not touch task 6's drafting system here.

---

*Stop after Task 1 is complete and confirm before continuing.*

---

## Task 2 — "Caption" format in the Quill toolbar

### Goal
Add a fourth option to the toolbar's header picker, alongside H1/H2/H3
and Normal, for image captions and figure descriptions. The caption
style should be visibly smaller than body text, italic, and dimmed
slightly — the classic figure-caption look. It must render the same
way both inside the editor and on the published article page.

### Implementation approach
Quill 2.x's header picker uses `<h1>`–`<h6>` blots. Re-use `<h6>` as
the "Caption" level — it's semantically appropriate for small captions
and is already supported by Quill without registering a custom blot.

### Steps

1. **Toolbar config** — in `initQuill()`, update the `toolbar` array.
   Currently:
   ```js
   [{ header: [1, 2, 3, false] }],
   ```
   Change to:
   ```js
   [{ header: [1, 2, 3, 6, false] }],
   ```
   This adds an `<h6>` entry to the picker.

2. **Picker label** — Quill labels header options as "Heading 1",
   "Heading 2", etc. Override the `<h6>` label to read "Caption" by
   adding a CSS rule inside the existing `<style>` block (near the
   other `.ql-snow` overrides):
   ```css
   .ql-snow .ql-picker.ql-header .ql-picker-label[data-value="6"]::before,
   .ql-snow .ql-picker.ql-header .ql-picker-item[data-value="6"]::before {
     content: 'Caption';
   }
   ```

3. **Editor styling** — style `<h6>` inside the editor so the author
   sees the caption look while writing. Add to the `<style>` block:
   ```css
   #editor h6,
   .ql-editor h6 {
     font-family: 'Libre Baskerville', serif;
     font-size: .82rem;
     font-style: italic;
     line-height: 1.45;
     color: var(--white);
     opacity: .75;
     letter-spacing: .02em;
     margin: .4rem 0 1.2rem;
     text-align: center;
   }
   ```

4. **Published article styling** — the reader renders the body HTML
   inside `pages/article.html` (or wherever the body is mounted). Add
   the same `h6` rule there so captions read consistently after
   publishing. If `article.html` already has a body-content selector
   (e.g. `.article-body`), scope the rule to it:
   ```css
   .article-body h6 {
     font-family: 'Libre Baskerville', serif;
     font-size: .82rem;
     font-style: italic;
     line-height: 1.45;
     color: var(--white);
     opacity: .75;
     letter-spacing: .02em;
     margin: .4rem 0 1.2rem;
     text-align: center;
   }
   ```
   Read `pages/article.html` first to find the exact selector before
   adding the rule.

5. **DOMPurify allowlist** — `DOMPurify.sanitize` keeps `<h6>` by
   default, so no config change is required. Do NOT pass a custom
   `ALLOWED_TAGS` list that would drop it.

### Verification
- Open the composer, pick "Caption" from the header dropdown, type
  text — it should appear small, italic, centered, and dimmed.
- Publish the article and confirm the caption renders identically
  on the article page.
- Normal, H1, H2, H3 options still work unchanged.

### Out of scope
- No new icons, no separate toolbar button. Reuse the existing header
  picker dropdown.
- Do not register custom Quill blots.

---

*Stop after Task 2 is complete and confirm before continuing.*

---

## Task 3 — Markdown parsing on the published article

### Goal
If an author writes or pastes markdown into the composer, the
published article must render it as formatted HTML (bold, italics,
headings, lists, links, code, blockquotes). Today, markdown only
converts on **paste of plain text**; markdown typed directly, or
inline markdown inside a larger paste, survives raw into the saved
HTML and shows literally on the article page.

### Where to fix it
Fix at **publish time** rather than at render time. Publishing once
through `marked` + `DOMPurify` gives a clean stored HTML body and
keeps the reader page simple. Render-time conversion would also work
but reprocesses on every view.

### Steps

1. **Locate the publish handler** in `pages/research.html` — the
   `els.composerForm.addEventListener('submit', ...)` block. Find:
   ```js
   const body = DOMPurify.sanitize(quill.root.innerHTML);
   ```

2. **Replace** that line with a two-pass conversion: extract the raw
   HTML, run any remaining markdown-looking text nodes through
   `marked`, then sanitize:
   ```js
   // Convert any raw markdown still present in the editor HTML to
   // formatted HTML before sanitizing. Quill's paste handler covers
   // pasted plain text, but markdown typed directly into the editor
   // is still stored as literal characters. Running the full body
   // through marked catches both cases.
   const rawHtml = quill.root.innerHTML;
   const markdownified = marked.parse(quillHtmlToMarkdown(rawHtml));
   const body = DOMPurify.sanitize(markdownified);
   ```

3. **Add a helper** `quillHtmlToMarkdown` near the other helpers at
   the top of the module script. It walks Quill's HTML, converting
   structural tags (`<p>`, `<h1>`–`<h6>`, `<ul>`, `<ol>`, `<blockquote>`,
   `<strong>`, `<em>`, `<a>`, `<img>`, `<pre>`) to markdown so
   `marked` re-renders them — including any inline markdown
   characters the author typed:
   ```js
   const quillHtmlToMarkdown = (html) => {
     const tmp = document.createElement('div');
     tmp.innerHTML = html;
     const walk = (node) => {
       if (node.nodeType === Node.TEXT_NODE) return node.textContent;
       if (node.nodeType !== Node.ELEMENT_NODE) return '';
       const tag = node.tagName.toLowerCase();
       const inner = [...node.childNodes].map(walk).join('');
       switch (tag) {
         case 'h1': return `\n# ${inner}\n\n`;
         case 'h2': return `\n## ${inner}\n\n`;
         case 'h3': return `\n### ${inner}\n\n`;
         case 'h6': return `\n###### ${inner}\n\n`;
         case 'strong': case 'b': return `**${inner}**`;
         case 'em': case 'i': return `*${inner}*`;
         case 'u': return `<u>${inner}</u>`;
         case 's': case 'strike': return `~~${inner}~~`;
         case 'code': return `\`${inner}\``;
         case 'pre': return `\n\`\`\`\n${inner}\n\`\`\`\n\n`;
         case 'blockquote': return `\n> ${inner}\n\n`;
         case 'a': return `[${inner}](${node.getAttribute('href') || ''})`;
         case 'img': return `![${node.getAttribute('alt') || ''}](${node.getAttribute('src') || ''})`;
         case 'li': return `- ${inner}\n`;
         case 'ul': case 'ol': return `\n${inner}\n`;
         case 'p': case 'div': return `${inner}\n\n`;
         case 'br': return `\n`;
         default: return inner;
       }
     };
     return [...tmp.childNodes].map(walk).join('');
   };
   ```

4. **Preserve the `<h6>` caption** from task 2 — note the `h6` case
   in the switch above maps to `######`, which `marked` re-emits as
   `<h6>`. Confirm by inspecting the published HTML.

5. **Keep the existing paste handler** — it's still useful so authors
   see formatting render as soon as they paste rather than waiting
   until publish. No change needed there.

6. **Image data URLs** must survive. `marked` preserves `data:` URLs
   in image syntax, and `DOMPurify` allows them by default. Do not
   add a `FORBID_ATTR` or `ALLOWED_URI_REGEXP` that would strip them.

### Verification
- Type `**bold**`, `# Heading`, `- item`, `> quote` directly in the
  composer (no paste). Publish. Confirm they render as bold, heading,
  list, blockquote on the article page.
- Paste a markdown block of mixed syntax. Publish. Confirm it renders
  the same as before this change (paste handler still wins on paste).
- Inline images embedded earlier still display.
- Captions from task 2 still render small/italic.

### Out of scope
- No markdown export, no markdown-mode toggle in the toolbar.
- Do not change the reader page's render path — it already runs
  through `DOMPurify`.

---

*Stop after Task 3 is complete and confirm before continuing.*

---

## Task 4 — Composer modal cut off by the nav bar

### Goal
The composer modal's top edge (close button, header) currently sits
under the fixed site nav. Push the modal down so the header is fully
visible on all viewports without the user needing to scroll.

### Where the issue lives
`pages/research.html`, inside the `<style>` block:

```css
.overlay {
  position: fixed;
  inset: 0;
  ...
  padding: 3rem 1rem;
  overflow-y: auto;
}
```

`3rem` of top padding is less than the shared nav's height, so the
modal's top is hidden behind it.

### Steps

1. **Measure the nav.** Read `js/components.js` (and the nav HTML it
   injects) or open the page in the browser dev tools. Note the nav's
   computed height — typically around `4.5rem`–`5rem` for this site.

2. **Increase overlay top padding.** Change the `.overlay` rule so the
   top padding clears the nav with breathing room:
   ```css
   .overlay {
     position: fixed;
     inset: 0;
     background: rgba(8,8,22,.78);
     backdrop-filter: blur(6px);
     -webkit-backdrop-filter: blur(6px);
     z-index: 200;
     display: none;
     align-items: flex-start;
     justify-content: center;
     padding: 6.5rem 1rem 3rem;
     overflow-y: auto;
   }
   ```
   Use `rem` (not `px`) to match the rest of the file's spacing.

3. **Mobile adjustment.** Inside the existing
   `@media (max-width: 48rem)` block, add:
   ```css
   .overlay { padding: 5rem 1rem 2rem; }
   ```
   The mobile nav is shorter (hamburger collapsed), so the offset can
   be reduced while still clearing the bar.

4. **Z-index sanity check.** The nav must remain clickable above the
   page but below the overlay. The overlay is `z-index: 200` and the
   crop overlay is `z-index: 250`. Confirm the nav's z-index in
   `css/base.css` is below `200`; if it's higher, the modal would sit
   behind the nav rather than under it. If so, lower the nav's
   z-index — do not raise the overlay above the crop overlay.

5. **Do not** change the modal's own positioning, width, or
   `align-items`. The fix is purely in the overlay's padding.

### Verification
- Open the composer at desktop, tablet, and mobile widths. The
  modal's × button and "New Article" header must be fully visible
  without scrolling.
- The crop modal (task-2-adjacent) sits inside the same `.overlay`
  rule, so confirm its header is also visible.
- Scrolling inside the overlay (for long forms) still works.

---

*Stop after Task 4 is complete and confirm before continuing.*

---

## Task 5 — Prevent accidental close + confirmation dialog

### Goal
Today, clicking outside the modal closes the composer and discards
all in-progress work. This happens unintentionally when an author
selects text inside the modal and the mouse-up lands on the overlay.
Fix by:

1. Removing the outside-click-to-close behavior entirely.
2. Wrapping the × and Cancel buttons in a confirmation prompt:
   "Are you sure you want to exit? All your progress will be saved
   in drafts."

This task is paired with Task 6 — the "saved in drafts" promise must
be honored once Task 6 is implemented. Implement Task 5 first; the
confirmation hook will call into Task 6's `saveDraft()` once added.

### Steps

1. **Remove the outside-click handler** in `pages/research.html`:
   ```js
   els.composerOverlay.addEventListener('click', (e) => {
     if (e.target === els.composerOverlay) closeComposer();
   });
   ```
   Delete this block entirely.

2. **Add a confirmation modal.** Markup goes next to the other
   overlays (after the composer overlay):
   ```html
   <div class="overlay" id="confirm-exit-overlay" role="dialog" aria-hidden="true">
     <div class="modal confirm-modal">
       <div class="composer-header">
         <h2>Leave article?</h2>
       </div>
       <div class="confirm-body">
         <p>Are you sure you want to exit? All your progress will be saved in drafts.</p>
         <div class="confirm-footer">
           <button type="button" class="btn-cancel" id="btn-confirm-stay">Keep writing</button>
           <button type="button" class="btn-publish" id="btn-confirm-exit">Save &amp; exit</button>
         </div>
       </div>
     </div>
   </div>
   ```

3. **Style the confirm modal** — matches the composer palette
   (navy surface, Seasons heading, Libre Baskerville body, lavender
   primary action). Add to the `<style>` block:
   ```css
   #confirm-exit-overlay { z-index: 260; }
   .confirm-modal { width: min(28rem, 100%); }
   .confirm-modal .composer-header h2 {
     font-size: 1.3rem;
   }
   .confirm-body {
     padding: 1.4rem 2rem 1.8rem;
   }
   .confirm-body p {
     font-family: 'Libre Baskerville', serif;
     color: var(--white);
     line-height: 1.6;
     font-size: .95rem;
     margin-bottom: 1.4rem;
   }
   .confirm-footer {
     display: flex;
     justify-content: flex-end;
     gap: .8rem;
     padding-top: 1rem;
     border-top: 1px solid rgba(255,255,255,.12);
   }
   ```
   `z-index: 260` puts the confirm above the composer (200) and the
   crop overlay (250).

4. **Wire the close intent.** Replace the existing `closeComposer`
   calls bound to × and Cancel with a `requestCloseComposer` step:
   ```js
   const isComposerDirty = () => {
     if (!quill) return false;
     return (
       els.compTitle.value.trim() ||
       els.compSubtitle.value.trim() ||
       coverDataUrl ||
       tags.size > 0 ||
       quill.getText().trim().length > 0
     );
   };

   const requestCloseComposer = () => {
     if (!isComposerDirty()) {
       closeComposer();
       return;
     }
     openOverlay(document.getElementById('confirm-exit-overlay'));
   };

   els.composerClose.removeEventListener('click', closeComposer);
   els.btnCancel.removeEventListener('click', closeComposer);
   els.composerClose.addEventListener('click', requestCloseComposer);
   els.btnCancel.addEventListener('click', requestCloseComposer);
   ```
   (The two `removeEventListener` lines only matter if you keep the
   original `addEventListener` lines; the cleaner option is to edit
   those originals to call `requestCloseComposer` directly.)

5. **Confirmation handlers:**
   ```js
   document.getElementById('btn-confirm-stay').addEventListener('click', () => {
     closeOverlay(document.getElementById('confirm-exit-overlay'));
   });
   document.getElementById('btn-confirm-exit').addEventListener('click', () => {
     saveDraft(); // implemented in Task 6
     closeOverlay(document.getElementById('confirm-exit-overlay'));
     closeComposer();
   });
   ```
   Until Task 6 lands, stub `saveDraft = () => {}` so this block
   doesn't throw.

6. **ESC handling.** The existing handler closes the composer on
   Escape. Change it to route through `requestCloseComposer` too, so
   Escape also prompts. Update the existing block:
   ```js
   document.addEventListener('keydown', (e) => {
     if (e.key !== 'Escape') return;
     if (document.getElementById('crop-overlay').classList.contains('open')) cancelCrop();
     else if (document.getElementById('confirm-exit-overlay').classList.contains('open')) {
       closeOverlay(document.getElementById('confirm-exit-overlay'));
     }
     else if (els.composerOverlay.classList.contains('open')) requestCloseComposer();
   });
   ```

7. **Do NOT add an outside-click handler to the confirm overlay.**
   Same hazard. The confirm modal closes via its two buttons only.

### Verification
- Open composer, type something, click outside the modal — nothing
  happens.
- Click ×: confirm dialog appears.
- "Keep writing" returns to the composer with state intact.
- "Save & exit" closes the composer and (once Task 6 is in)
  persists a draft.
- Opening composer with no content typed → × closes immediately,
  no confirm prompt.
- Escape behaves the same as ×.

---

*Stop after Task 5 is complete and confirm before continuing.*

---

## Task 6 — Local draft system

### Goal
Persist in-progress articles to `localStorage` so that closing the
composer (with the confirmation from Task 5) doesn't lose work.
Drafts are visible to the author in a "Drafts" section on the
research page, can be reopened in the composer for further editing,
and are deleted once published or explicitly discarded.

Drafts are **per-browser, per-author**. No Firestore sync. Use
`localStorage` keyed by the signed-in user's UID so a shared
computer doesn't cross-pollinate authors.

### Data shape

```js
// localStorage key:  urbanbears.drafts.<uid>
// Value: JSON array, newest first.
[
  {
    id: 'd-1729012345678-x7k2',   // local-only id
    title: '...',
    subtitle: '...',
    coverDataUrl: 'data:image/...',
    tags: ['ethics', 'engineering'],
    body: '<p>...</p>',            // Quill HTML, NOT markdown-rendered
    updatedAt: 1729012345678
  },
  ...
]
```

### Steps

#### A. Storage helpers
Add near the top of the module script:

```js
const DRAFT_KEY = (uid) => `urbanbears.drafts.${uid}`;

const loadDrafts = () => {
  if (!state.user) return [];
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY(state.user.uid)) || '[]');
  } catch { return []; }
};

const writeDrafts = (list) => {
  if (!state.user) return;
  localStorage.setItem(DRAFT_KEY(state.user.uid), JSON.stringify(list));
};

let currentDraftId = null; // set when editing an existing draft

const saveDraft = () => {
  if (!state.user || !quill) return;
  if (!isComposerDirty()) return;
  const drafts = loadDrafts();
  const payload = {
    id: currentDraftId || `d-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    title: els.compTitle.value,
    subtitle: els.compSubtitle.value,
    coverDataUrl,
    tags: [...tags],
    body: quill.root.innerHTML,
    updatedAt: Date.now(),
  };
  const idx = drafts.findIndex(d => d.id === payload.id);
  if (idx >= 0) drafts[idx] = payload;
  else drafts.unshift(payload);
  writeDrafts(drafts);
  currentDraftId = payload.id;
  renderDrafts();
  showToast('Draft saved');
};

const deleteDraft = (id) => {
  writeDrafts(loadDrafts().filter(d => d.id !== id));
  if (currentDraftId === id) currentDraftId = null;
  renderDrafts();
};
```

#### B. Auto-save
Add a debounced auto-save while the composer is open so drafts
survive a tab crash, not just an intentional close:

```js
let autoSaveTimer = null;
const scheduleAutoSave = () => {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    if (els.composerOverlay.classList.contains('open')) saveDraft();
  }, 1500);
};
// Wire after initQuill() inside openComposer():
quill.on('text-change', scheduleAutoSave);
els.compTitle.addEventListener('input', scheduleAutoSave);
els.compSubtitle.addEventListener('input', scheduleAutoSave);
```

#### C. Loading a draft into the composer
```js
const openComposerWithDraft = (draft) => {
  if (!state.isAuthor) return;
  resetComposer();
  initQuill();
  currentDraftId = draft.id;
  els.compTitle.value = draft.title || '';
  els.compSubtitle.value = draft.subtitle || '';
  if (draft.coverDataUrl) {
    coverDataUrl = draft.coverDataUrl;
    els.coverDropzone.style.backgroundImage = `url('${coverDataUrl}')`;
    els.coverDropzone.classList.add('has-image');
  }
  (draft.tags || []).forEach(t => tags.add(t));
  renderTagPills();
  quill.clipboard.dangerouslyPasteHTML(draft.body || '', 'silent');
  openOverlay(els.composerOverlay);
};
```

Reset `currentDraftId = null` inside `resetComposer()`.

#### D. Publish flow integration
At the start of the existing publish success branch (after
`showToast('Published!')`), delete the draft:
```js
if (currentDraftId) deleteDraft(currentDraftId);
currentDraftId = null;
```

#### E. Drafts UI on the research page
Add a Drafts section to the Home view, visible only to the signed-in
author when at least one draft exists. It should sit above the
three-column grid so the author lands on their unfinished work first.

Markup pattern (matches the existing `recent-section`):
```html
<section class="drafts-section" id="drafts-section" hidden>
  <div class="recent-header">
    <h2>Your drafts</h2>
  </div>
  <div class="recent-grid" id="drafts-grid"></div>
</section>
```

Render function:
```js
const renderDrafts = () => {
  const section = document.getElementById('drafts-section');
  const grid = document.getElementById('drafts-grid');
  if (!section || !grid) return;
  const drafts = loadDrafts();
  if (!state.isAuthor || !drafts.length) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  grid.innerHTML = drafts.map(d => `
    <article class="recent-card draft-card" data-draft-id="${d.id}">
      <div class="cover" ${d.coverDataUrl ? `style="background-image:url('${d.coverDataUrl}')"` : ''}></div>
      <h3>${escapeHtml(d.title || 'Untitled draft')}</h3>
      <div class="card-byline">
        <span class="byline-text">Draft · saved ${fmtDate(new Date(d.updatedAt))}</span>
      </div>
      <button class="btn-draft-delete" data-delete="${d.id}" aria-label="Delete draft">×</button>
    </article>`).join('');
  grid.querySelectorAll('[data-draft-id]').forEach(node => {
    node.addEventListener('click', (e) => {
      if (e.target.matches('[data-delete]')) return;
      const draft = loadDrafts().find(d => d.id === node.dataset.draftId);
      if (draft) openComposerWithDraft(draft);
    });
  });
  grid.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteDraft(btn.dataset.delete);
    });
  });
};
```

Call `renderDrafts()` from:
- The end of `loadArticles()` (so it renders on first paint).
- The auth state callback after `state.isAuthor` is set.
- `saveDraft()` and `deleteDraft()` (already covered above).

#### F. Styles
Add to the existing `<style>` block, matching the codebase palette
and the existing `.recent-card` styling:

```css
.drafts-section {
  margin-top: 1rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid rgba(255,255,255,.1);
  margin-bottom: 2rem;
}
.drafts-section .recent-header h2 {
  font-style: italic;
  opacity: .9;
}
.draft-card {
  position: relative;
  border: 1.5px dashed rgba(255,255,255,.18);
  border-radius: 1rem;
  padding: 1rem;
  background: rgba(255,255,255,.03);
  transition: border-color var(--transition), background var(--transition);
}
.draft-card:hover {
  border-color: var(--lavender-bg);
  background: rgba(255,255,255,.06);
}
.draft-card .cover {
  border-radius: .8rem;
  margin-bottom: .8rem;
}
.btn-draft-delete {
  position: absolute;
  top: .6rem;
  right: .6rem;
  width: 1.8rem;
  height: 1.8rem;
  border-radius: 50%;
  background: rgba(8,8,22,.7);
  border: 1px solid rgba(255,255,255,.25);
  color: var(--white);
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--transition), transform var(--transition);
}
.btn-draft-delete:hover {
  background: var(--lavender-bg);
  color: var(--navy);
  transform: scale(1.08);
}
```

#### G. Edge cases
- **Sign-out clears `currentDraftId`** but does not delete the
  stored drafts — they're still in `localStorage` and reappear if
  the same author signs back in on the same browser.
- **No user signed in** → `saveDraft` and `loadDrafts` return early.
  Drafts are author-only.
- **Storage full** → `localStorage.setItem` throws `QuotaExceededError`.
  Wrap `writeDrafts` in try/catch and surface a toast
  "Draft storage full — publish or delete older drafts".
- **Large covers** — the same compression that runs in
  `handleCoverFile` already shrinks the data URL before it lands in
  `coverDataUrl`, so drafts inherit the small size.

### Verification
- As an author: write title + body, click × → confirm prompt →
  "Save & exit". Reload the page. The draft appears in "Your drafts"
  on Home. Click it: composer reopens with all fields populated.
- Edit and publish → article appears on Home, draft disappears.
- Edit and click the × on the draft card → draft deleted, no
  confirmation needed (deletion of a *saved* draft is a deliberate
  click on a small destructive button).
- Sign out → drafts section disappears. Sign back in as same user →
  drafts return.
- Open two tabs as the same author → drafts written in one tab
  appear in the other on next render (no live sync required).

### Out of scope
- No cross-device sync.
- No revision history per draft — each save overwrites.
- No draft-to-Firestore migration.

