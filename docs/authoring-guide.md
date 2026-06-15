# Authoring Guide

This guide walks an authorized author through writing and publishing
an article. If "+ New Article" is not visible after signing in, the
author allowlist hasn't been updated yet — see
[firebase-setup.md](./firebase-setup.md), step 4.

## Sign in

1. Open `pages/research.html`.
2. Click **Sign in with Google** in the top-right.
3. Pick your Google account in the popup.
4. After sign-in your avatar chip appears. If your UID is in
   `authors/{uid}`, the **+ New Article** button shows up next to it.

## Open the composer

Click **+ New Article**. A modal slides up with five fields:

| Field | Tips |
| --- | --- |
| **Title** | Required. Plain text, displayed in the Seasons serif. Aim for under 60 characters so it fits the featured card. |
| **Subtitle** | Optional one-liner under the title. Italic. |
| **Cover image** | Click or drop a file. Auto-resized to 1400 px wide before save. Use 16:9-ish aspect for the cleanest card crop. |
| **Tags** | Type and press Enter (or comma). Click the `×` on a pill to remove. |
| **Body** | Rich text editor — see below. |

## Writing in the editor

The editor is Quill 2.x styled to match the dark theme. You can:

- Use the toolbar for headings, bold/italic/underline/strike, lists,
  blockquote, code block, link, image.
- **Paste images directly** — but prefer the image toolbar button.
  The button compresses to 1100 px wide before embedding; raw pastes
  may be larger. Each image is stored as base64 inside the article
  doc, so a few heavy images can blow the size budget.
- **Paste markdown.** If the clipboard text matches markdown syntax
  (`#`, `##`, `*bold*`, `**bold**`, `- item`, `1. item`, `[link](url)`,
  fenced code, `> quote`), the page renders it to HTML via marked.js
  before inserting. Pasting from a rich source (Google Docs, Notion,
  another browser tab) keeps the formatting via Quill's default
  pipeline.

### Inline images and size

Every image you embed adds to the article's document size. Firestore
caps docs at ~1 MiB and the publish guard rejects anything over
~850 KB. If you hit "Article too large — remove or shrink some
images", remove or replace a heavy image and try again. The cover
image counts too.

Practical rule of thumb:

- Cover + 4–5 inline photos: usually fine.
- Lots of full-bleed screenshots: borderline — preview before
  publishing.

## Publish

Click **Publish**. The button switches to *"Publishing…"* while the
doc is written. On success:

- A toast confirms.
- The composer closes and clears.
- The article list reloads. Your article becomes the new featured
  card on Home.

## Edit / delete (advanced)

The current UI has no edit button. To make changes:

- Edit the document directly in Firebase console → Firestore →
  `articles/{id}`. You can change `title`, `subtitle`, `body`,
  `tags`, `coverUrl`, etc. The rules allow this only for the doc's
  `authorUid`.
- To delete: select the doc and use the trash icon. The rules require
  your account to be the article's author.

(Editing inside the page UI is on the roadmap; until then console
edits are the supported path.)

## Reader-side actions (any signed-in user)

Once published, anyone signed in with Google can:

- **♥ Like** — toggles `articles/{id}/likes/{uid}` and the parent's
  `likeCount`.
- **↻ Repost** — same pattern with `reposts`. (Currently a counter
  only; there's no separate "reposted" feed yet.)
- **Share** — uses the native share sheet on supported devices,
  otherwise copies a `…?article={id}` link to the clipboard.

Signed-out visitors can still read every article; clicking like or
repost prompts them to sign in.
