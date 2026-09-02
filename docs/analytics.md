# Analytics Dashboard

`pages/analytics.html` is an author-only view of readership and
engagement. It is linked from the nav, but only for users who have an
`authors/{uid}` doc.

## Files

| File | Role |
| --- | --- |
| `pages/analytics.html` | The page: gating, layout, and rendering. |
| `js/analytics.js` | Event logging, activity stamping, dashboard queries, and the aggregation helpers. |
| `js/main.js` | Reveals the nav link for authors and calls `touchUserActivity()` on every page load. |
| `firestore.rules` | The `events` collection and the widened `users` read rule. |

## Access control

Two independent layers:

1. **Nav link.** `js/main.js` hides `#nav-analytics-li` unless
   `authors/{uid}` exists. Cosmetic only.
2. **Firestore rules.** `events` is readable only by authors, and the
   whole `users` collection is readable only by authors. A non-author
   who types the URL sees a "Not authorized" message, and even if they
   bypassed that they would get permission-denied on the data.

Article documents stay world-readable, since they already are on the
public site.

## Where each number comes from

| Metric | Source |
| --- | --- |
| Total users | Number of docs in `users`. |
| Active users (7 / 30 days) | `users` docs whose `lastActiveAt` falls inside the window. |
| Views / likes / shares, all time | Sum of `viewCount` / `likeCount` / `repostCount` across articles. |
| Views / likes / shares, recent | Aggregated from `events` inside the selected window. |
| Signed-in readers | Distinct non-empty `uid` on `view` events in the window. |
| Views per day | `view` events bucketed by calendar day, plotted as a line graph (x: day, y: views). |

"Shares" means reposts, which is the share action already wired up on
`pages/article.html`.

Lifetime totals are historical and complete. The windowed numbers only
cover the period since event logging was deployed, so expect them to
read low until the log has been collecting for a while.

The counter-based "all time" block is hidden while the window is set to
all time, since the two blocks would otherwise be headed the same thing.
That means the default view reports engagement from the event log alone,
which under-reports anything that happened before logging was deployed.
Switch to a 30- or 7-day window to see the counter totals alongside it.

## How the data is fetched

One query pulls the event log (capped at 5000 docs, newest first) and
everything else is aggregated in memory:

- `summarize(events, {days, articleId})` — net views/likes/shares. An
  unlike cancels a like, which keeps the window consistent with the
  article counter.
- `summarizeByArticle(events, {days})` — the same thing for every
  article in a single pass, so the table stays cheap as it grows.
- `dailyViews(events, {days, articleId})` — per-day view buckets.
- `countActiveUsers(users, days)` — `lastActiveAt` within the window.

Because the window is filtered client-side, switching between all time,
30 days, and 7 days, and drilling into an article, are all free: no
extra reads, and no composite index to create. The window starts on
**all time**.

The "Views per day" graph follows the same window. On all time it spans
from the first logged event, capped at 90 days so the x axis stays
readable, and it drops the per-point dots once the window is longer
than 31 days.

## Article detail

Clicking a row pushes `?id={articleId}` and re-renders with the same
in-memory data. Back/forward work through `popstate`.

## Adding a metric

- **Something already stored on the article:** read it in
  `renderOverview` / `renderDetail`, no rules change needed.
- **Something time-windowed:** add a new `type` string, log it with
  `logEvent()`, add it to the `type in [...]` list in `firestore.rules`,
  and handle it in the `switch` inside `summarize()`.
- **A new counter field on the article:** it must also be added to the
  `hasOnly([...])` list in the article update rule, or the increment
  will be denied for non-authors.

## Cost note

Every article view writes one small `events` doc. If read volume ever
makes that expensive, the natural next step is to roll events up into a
daily per-article summary doc with a scheduled function and have the
dashboard read the rollups instead.
