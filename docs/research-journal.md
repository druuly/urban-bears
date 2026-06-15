# Research Journal — System Overview

The research journal is a Substack-style publishing system implemented
entirely in `pages/research.html`. Authorized authors can write and
publish articles; anyone can read them and signed-in users can like,
repost, and share.

The whole feature is one self-contained HTML file. There is no build
step and no server. State lives in Firestore; the page talks to it
directly through the Firebase JS SDK.

## File map

| Path | Role |
| --- | --- |
| `pages/research.html` | Single-file implementation: layout, styles, Firebase init, Quill editor, render logic. |
| `firestore.rules` | Security rules (paste into Firebase console → Firestore → Rules). |
| `css/base.css` | Shared site styles — palette variables, nav, footer, buttons. |
| `css/animations.css` | Shared keyframes used by the journal (`fadeIn`, `fadeSlideUp`, twinkle). |
| `js/main.js` | Shared nav hamburger + scroll reveal logic. |

## Page anatomy

```
┌─ Nav (shared) ────────────────────────────────────────────────┐
│  logo  |  Home  Research  Opportunities  Read  About  | Donate│
└───────────────────────────────────────────────────────────────┘
┌─ Journal topbar ──────────────────────────────────────────────┐
│              [ Home ]  [ Archive ]                            │
│                                          [+ New Article] (au) │
├─ View: Home ─────────────────────────────────────────────────┤
│  ┌─ Left ──┐  ┌─ Center (featured) ────┐  ┌─ Right ────────┐ │
│  │ small   │  │  large cover           │  │ Most Popular   │ │
│  │ card    │  │  H2 title              │  │ ─ row          │ │
│  │ ───     │  │  meta                  │  │ ─ row          │ │
│  │ small   │  └────────────────────────┘  │ ─ row …        │ │
│  │ card    │                              └────────────────┘ │
│  └─────────┘                                                  │
├─ View: Archive ──────────────────────────────────────────────┤
│  [ Latest ] [ Top ]                                    [🔍]   │
│  ──── search input (toggle) ─────────────────────────────     │
│  • row · row · row …                                          │
└───────────────────────────────────────────────────────────────┘

Overlays (open on demand):
- Reader modal (opens on any article click)
- Composer modal (opens from "+ New Article", authors only)
```

### Home view

Three-column grid driven by `renderHome()`:

| Column | Source |
| --- | --- |
| Left (two stacked cards) | Articles 1–2 from the recency-ordered list (`state.articles.slice(1, 3)`). |
| Center (featured) | Most recent article (`state.articles[0]`). |
| Right (Most Popular) | Top 6 by `likeCount`, descending. |

Empty state: when no articles exist, the panel shows a prompt that
nudges authors toward "+ New Article".

### Archive view

`renderArchive()` produces a flat list, sortable by **Latest** (default)
or **Top** (by `likeCount`). A magnifier toggle reveals a search box
that filters on title / subtitle / author client-side.

### Reader modal

Opens when any article card is clicked. Subscribes to the article doc
with `onSnapshot` so counters update live while open. Increments
`viewCount` once per open. Renders the body HTML through `DOMPurify`
before injecting.

### Composer modal

Authors-only. Inputs:

- Title (Seasons display font, large)
- Subtitle
- Cover image (drag/drop dropzone, downscaled to ≤ 1400 px wide)
- Tags (chip input — Enter or comma to add)
- Body (Quill 2.x snow editor styled to match the dark palette)

## Runtime flow

```
load page
  │
  ├─ initializeApp(firebaseConfig)
  ├─ getAuth(app)        ─┐
  ├─ getFirestore(app)   ─┤  modular v12 imports
  ├─ onAuthStateChanged ──┘
  │     ├─ user == null      → renderAuthBar() shows "Sign in"
  │     └─ user != null      → check authors/{uid}; set state.isAuthor
  │                              → renderAuthBar() shows chip + maybe "+ New Article"
  │
  ├─ loadArticles()
  │     └─ getDocs(query(articles, orderBy(createdAt desc), limit 60))
  │         └─ state.articles = [...]; renderHome(); renderArchive()
  │
  └─ if URL has ?article=ID → openReader(ID)
```

### Engagement actions

| Action | What happens |
| --- | --- |
| **Like** / **Repost** | Toggles `articles/{id}/{likes\|reposts}/{uid}` doc. Same call also `increment`s the `likeCount` / `repostCount` field on the parent doc. Counters update live via the reader's `onSnapshot`. |
| **Share** | Uses `navigator.share` when available, otherwise copies a deep link `?article=ID` to the clipboard. |

A signed-out user clicking like/repost gets a "Sign in to interact" toast.

## Visual / styling rules

These come from the project palette and the user's stated preferences:

- **Background:** `--navy` (#12122e). Cards lift via white-on-rgba overlays.
- **Body text:** always `--white`. No grey body fonts.
- **Accent surfaces** (tag pills, the "Publish" button, the toast):
  `--lavender-bg` (#cfd6f5) with `--navy` text — the only navy-on-light
  combination on the page.
- **Display headings:** `'The Seasons'` serif.
- **Body / UI text:** `'Libre Baskerville'`.
- **Animations:**
  - View change → `fadeSlideUp .55s` (defined in `animations.css`)
  - Modals → custom `modalIn` (fade + lift + slight scale)
  - Like button → `pulse` keyframe on activation
  - Cards → fade-slide-up on first render with `:nth-child` stagger

## What's not in this system

These were intentionally excluded — note them before reaching for
them:

- **Firebase Storage** — covers and inline images are compressed to
  base64 and stored on the Firestore doc instead. Hard cap: keep
  payloads under ~850 KB (Firestore's per-doc limit is ~1 MiB).
  Enforced client-side in the publish handler.
- **Drafts** — every publish writes directly to `articles`. No draft
  collection yet.
- **Per-author URLs** — articles are addressable via `?article=ID`
  query string only; there are no separate routes per article or per
  author.
- **Comments** — the engagement bar has like / repost / share but no
  comment thread.
