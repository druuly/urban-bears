/* Urban BEARS — engagement event log + analytics queries.
 *
 * The article doc keeps lifetime counters (viewCount/likeCount/repostCount).
 * Those have no time dimension, so anything windowed ("views this week",
 * "active users") is answered from two places instead:
 *
 *   events/{id}     one append-only doc per view/like/repost action
 *   users/{uid}     lastActiveAt, refreshed on sign-in
 *
 * Writes here are always best-effort: analytics must never break a page.
 */

import {
  collection, doc, addDoc, getDoc, getDocs, setDoc,
  query, where, orderBy, limit as fbLimit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { auth, db } from './firebase.js';

export const DAY_MS = 86400000;

/* Firebase restores the session asynchronously, so `auth.currentUser` is null
   for a beat after page load. A view logged in that window would be attributed
   to nobody, so every write waits for the first auth callback. */
let settle;
const authReady = new Promise((resolve) => { settle = resolve; });
onAuthStateChanged(auth, () => settle());

/* ── Writes ── */

/* type: 'view' | 'like' | 'unlike' | 'repost' | 'unrepost' */
export async function logEvent(type, articleId) {
  await authReady;
  return addDoc(collection(db, 'events'), {
    type,
    articleId: articleId || '',
    uid: auth.currentUser?.uid || '',
    createdAt: serverTimestamp(),
  }).catch(() => null);
}

/* Stamps users/{uid}.lastActiveAt. Rules allow this as either a merge onto an
   existing profile or a lastActiveAt-only create for a user who hasn't
   finished the profile modal yet. */
export function touchUserActivity(user) {
  if (!user) return Promise.resolve(null);
  return setDoc(
    doc(db, 'users', user.uid),
    { lastActiveAt: serverTimestamp() },
    { merge: true }
  ).catch(() => null);
}

/* ── Reads ── */

export async function isAuthor(uid) {
  if (!uid) return false;
  try {
    return (await getDoc(doc(db, 'authors', uid))).exists();
  } catch {
    return false;
  }
}

export async function fetchUsers({ limit = 2000 } = {}) {
  const snap = await getDocs(query(collection(db, 'users'), fbLimit(limit)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* One query covers the whole dashboard: pull the log once and aggregate in
   memory, so no composite index is needed and switching windows or drilling
   into an article costs nothing extra. `days: null` means all time. */
export async function fetchEvents({ days = null, limit = 5000 } = {}) {
  const clauses = [collection(db, 'events')];
  if (days) clauses.push(where('createdAt', '>=', new Date(Date.now() - days * DAY_MS)));
  clauses.push(orderBy('createdAt', 'desc'), fbLimit(limit));

  const snap = await getDocs(query(...clauses));
  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      type: data.type,
      articleId: data.articleId || '',
      uid: data.uid || '',
      at: data.createdAt?.toDate?.() || null,
    };
  }).filter(e => e.at);
}

/* ── Aggregation helpers ── */

/* Net counts for a window: a like followed by an unlike nets to zero, which
   matches what the article's own counter would show. Views only ever add. */
export function summarize(events, { days, articleId = null } = {}) {
  const cutoff = days ? Date.now() - days * DAY_MS : 0;
  const out = { views: 0, likes: 0, shares: 0, viewers: new Set(), actors: new Set() };

  for (const e of events) {
    if (e.at.getTime() < cutoff) continue;
    if (articleId && e.articleId !== articleId) continue;

    switch (e.type) {
      case 'view':     out.views  += 1; if (e.uid) out.viewers.add(e.uid); break;
      case 'like':     out.likes  += 1; break;
      case 'unlike':   out.likes  -= 1; break;
      case 'repost':   out.shares += 1; break;
      case 'unrepost': out.shares -= 1; break;
      default: break;
    }
    if (e.uid) out.actors.add(e.uid);
  }

  return {
    views:  out.views,
    likes:  Math.max(0, out.likes),
    shares: Math.max(0, out.shares),
    signedInViewers: out.viewers.size,
    activeUsers: out.actors.size,
  };
}

/* One pass over the window instead of one pass per article, which matters
   once the table has a few hundred rows. */
export function summarizeByArticle(events, { days } = {}) {
  const cutoff = days ? Date.now() - days * DAY_MS : 0;
  const byArticle = new Map();

  for (const e of events) {
    if (e.at.getTime() < cutoff) continue;
    if (!byArticle.has(e.articleId)) byArticle.set(e.articleId, []);
    byArticle.get(e.articleId).push(e);
  }

  const out = new Map();
  for (const [articleId, list] of byArticle) out.set(articleId, summarize(list));
  return out;
}

export const EMPTY_SUMMARY = Object.freeze({
  views: 0, likes: 0, shares: 0, signedInViewers: 0, activeUsers: 0,
});

/* Buckets 'view' events into one entry per day, oldest first. */
export function dailyViews(events, { days = 14, articleId = null } = {}) {
  const buckets = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    buckets.push({ date: new Date(start.getTime() - i * DAY_MS), views: 0 });
  }
  const first = buckets[0].date.getTime();

  for (const e of events) {
    if (e.type !== 'view') continue;
    if (articleId && e.articleId !== articleId) continue;
    const t = e.at.getTime();
    if (t < first) continue;
    const idx = Math.floor((t - first) / DAY_MS);
    if (buckets[idx]) buckets[idx].views += 1;
  }
  return buckets;
}

/* `days: null` counts everyone who has ever been seen. */
export function countActiveUsers(users, days) {
  const cutoff = days ? Date.now() - days * DAY_MS : 0;
  return users.filter(u => {
    const t = u.lastActiveAt?.toDate?.()?.getTime();
    return t && t >= cutoff;
  }).length;
}

/* Oldest event in the log, or null when the log is empty. */
export function earliestEvent(events) {
  let min = null;
  for (const e of events) {
    if (!min || e.at.getTime() < min.getTime()) min = e.at;
  }
  return min;
}
