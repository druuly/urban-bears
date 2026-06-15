# Firebase Setup

One-time setup for the Firebase project that backs the research
journal. The project is **`urban-bears`** and the config is already
hardcoded into `pages/research.html`. You only need to repeat any
step below if you reset the project or someone disabled a service.

> The app uses **Auth + Firestore only** — Firebase Storage is *not*
> required and should *not* be enabled. Images are downscaled in the
> browser and stored as base64 inside the Firestore article doc, which
> keeps the project on the free Spark plan.

## 1. Enable Google sign-in

1. Firebase console → **Authentication** → **Get started**.
2. **Sign-in method** tab → **Google** → Enable.
3. Pick a project support email and save.
4. **Settings** → **Authorized domains** → make sure your dev/prod
   domains are listed (`localhost` is added by default).

## 2. Create the Firestore database

1. Firebase console → **Firestore Database** → **Create database**.
2. Start in **production mode** (we will paste rules in step 3).
3. Pick a region close to your users (`us-central1` is fine).

## 3. Paste the security rules

The rules live in `firestore.rules` at the repo root. Copy that file's
contents into:

**Firestore Database → Rules tab → Publish**

What the rules enforce:

- Anyone can **read** articles.
- Only signed-in users whose UID has a doc at `authors/{uid}` can
  **create** articles, and the doc's `authorUid` must match their own.
- An article's `authorUid` owner can update or delete it.
- Any signed-in user can update an article *only if* their write
  touches `likeCount`, `repostCount`, or `viewCount` and nothing else
  — this is what makes the engagement counters safe.
- A like / repost doc at `articles/{id}/likes/{uid}` (or
  `.../reposts/{uid}`) is writable only by the user whose UID matches
  the doc key — one like per article per user, enforced server-side.

See [data-model.md](./data-model.md) for the field-level reference.

## 4. Add yourself as an author

The `authors` collection is the allowlist that controls who can
publish. It is managed manually from the console.

1. Open `pages/research.html` in your browser and sign in with Google.
   This creates your Firebase Auth user record.
2. Firebase console → **Authentication** → **Users** → copy the **User
   UID** for your account.
3. Firebase console → **Firestore Database** → **Start collection**.
   - Collection ID: `authors`
4. **Add document**:
   - Document ID: paste your UID
   - (optional) field `name` (string) → your name
   - (optional) field `role` (string) → e.g. "Editor"
5. Reload `research.html`. The "+ New Article" button now appears.

To add more authors later: repeat step 3.4 with each new UID.

## 5. (Optional) Firestore indexes

The page uses a single ordered query (`orderBy('createdAt', 'desc')`)
plus client-side filtering. Firestore creates the single-field index
automatically — no manual index setup is needed unless you add new
server-side sorted queries.

If you ever see a console error like *"The query requires an index"*,
click the link in the error to auto-create it.

## What you do NOT need to do

- Do **not** enable Firebase Storage.
- Do **not** enable Cloud Functions.
- Do **not** upgrade to the Blaze (paid) plan for this feature.

The current implementation runs entirely on the Spark plan within its
generous Firestore free tier (1 GiB stored, 50k reads/day, 20k
writes/day).
