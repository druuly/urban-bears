# Urban BEARS — Documentation

Documentation for the Urban BEARS website, focused on the
**Research Journal** system that powers `pages/research.html`.

## Contents

| Doc | What it covers |
| --- | --- |
| [research-journal.md](./research-journal.md) | System overview — architecture, page layout, runtime flow, key files. Read this first. |
| [firebase-setup.md](./firebase-setup.md) | One-time Firebase project setup: enabling Auth, creating Firestore, pasting security rules, adding an author. |
| [data-model.md](./data-model.md) | Firestore collection shapes (`articles`, `authors`, `likes`, `reposts`) and security-rule reference. |
| [authoring-guide.md](./authoring-guide.md) | How an authorized author writes, formats, and publishes an article. |

## Quick links

- **Site entry:** `index.html`
- **Research journal:** `pages/research.html`
- **Firestore rules (deployed via console):** `firestore.rules`
- **Shared styles:** `css/base.css`, `css/animations.css`
- **Shared JS:** `js/main.js`

## Stack at a glance

- Static HTML + CSS + vanilla JS (no build step, no framework)
- Firebase Auth (Google sign-in)
- Firebase Firestore (articles + engagement)
- Quill 2.x for the article editor (CDN)
- marked + DOMPurify for markdown paste handling and safe HTML render (CDN)
- **No Firebase Storage** — images are downscaled client-side and stored as
  base64 inside the Firestore article doc, keeping the project on the free
  Spark plan
