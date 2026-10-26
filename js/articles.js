/* Urban BEARS — article store.
   Firestore-backed CRUD for the Research journal. All article reads/writes
   should go through this module so the rest of the app stays DOM-only. */

import {
  collection, doc, getDoc, getDocs, setDoc, writeBatch, deleteDoc,
  query, orderBy, limit as fbLimit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { app, db } from './firebase.js';

export { app, db };

const COLL = 'articles';
const CARDS = 'articleCards';

/* Bylines come from the subtitle, not the uploader's account.
   Articles are often published on a student's behalf, so `authorName` /
   `authorSchool` hold whoever pressed publish. The subtitle is written as
   "First Last, High School Name" — everything before the first comma is the
   real author, everything after it is their school. If there is no comma we
   fall back to the account fields. */
export function articleAuthorName(a = {}) {
  const [before] = String(a.subtitle || '').split(',');
  const name = (before || '').trim();
  if (name && String(a.subtitle || '').includes(',')) return name;
  return a.authorName || 'Anonymous';
}

export function articleAuthorSchool(a = {}) {
  const sub = String(a.subtitle || '');
  const i = sub.indexOf(',');
  const school = i === -1 ? '' : sub.slice(i + 1).trim();
  return school || a.authorSchool || '';
}

export async function fetchArticles({ limit = 60 } = {}) {
  const q = query(collection(db, COLL), orderBy('createdAt', 'desc'), fbLimit(limit));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* List cards: a slim copy of each article (no body, small cover thumbnail,
   mirrored counters) so the home and research lists don't download every
   full article. articles/{id} stays the source of truth; the counters are
   kept in step by article.html. Same id as the article. */
const THUMB_W = 640;

const makeThumb = (dataUrl) => new Promise((resolve) => {
  if (!dataUrl) return resolve('');
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, THUMB_W / img.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    resolve(canvas.toDataURL('image/jpeg', 0.7));
  };
  img.onerror = () => resolve('');
  img.src = dataUrl;
});

const cardFields = async (a) => ({
  title:        a.title || 'Untitled',
  subtitle:     a.subtitle || '',
  tags:         Array.isArray(a.tags) ? a.tags : [],
  authorUid:    a.authorUid || '',
  authorName:   a.authorName || 'Anonymous',
  authorPhoto:  a.authorPhoto || '',
  authorSchool: a.authorSchool || '',
  coverUrl:     await makeThumb(a.coverUrl),
  createdAt:    a.createdAt,
  likeCount:    a.likeCount || 0,
  repostCount:  a.repostCount || 0,
  viewCount:    a.viewCount || 0,
});

export async function saveCard(id, article) {
  return setDoc(doc(db, CARDS, id), await cardFields(article));
}

export async function fetchArticleCards({ limit = 60 } = {}) {
  const q = query(collection(db, CARDS), orderBy('createdAt', 'desc'), fbLimit(limit));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* Cross-page cache of the card list so research.html can paint instantly.
   IndexedDB, not sessionStorage: covers are base64 and can blow past its
   quota. Timestamps are stored as millis since structured clone strips
   their methods. */
const CACHE_DB = 'ub-articles';
const CACHE_STORE = 'kv';
const CACHE_KEY = 'list';

const openCache = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(CACHE_DB, 1);
  req.onupgradeneeded = () => req.result.createObjectStore(CACHE_STORE);
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

/* Fetches the card list, caches it for research.html, and returns it. */
export async function prefetchArticles({ limit = 60 } = {}) {
  const cards = await fetchArticleCards({ limit });
  try {
    const slim = cards.map(a => ({ ...a, createdAt: a.createdAt?.toMillis?.() ?? a.createdAt }));
    const cache = await openCache();
    cache.transaction(CACHE_STORE, 'readwrite').objectStore(CACHE_STORE).put(slim, CACHE_KEY);
  } catch { /* IndexedDB unavailable: the list still renders */ }
  return cards;
}

export async function getCachedArticles() {
  try {
    const cache = await openCache();
    return await new Promise((resolve, reject) => {
      const req = cache.transaction(CACHE_STORE).objectStore(CACHE_STORE).get(CACHE_KEY);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function getArticle(id) {
  const snap = await getDoc(doc(db, COLL, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function publishArticle(data) {
  const article = {
    title:        data.title || 'Untitled',
    subtitle:     data.subtitle || '',
    body:         data.body || '',
    coverUrl:     data.coverUrl || '',
    tags:         Array.isArray(data.tags) ? data.tags : [],
    authorUid:    data.authorUid || '',
    authorName:   data.authorName || 'Anonymous',
    authorPhoto:  data.authorPhoto || '',
    authorSchool: data.authorSchool || '',
    createdAt:    serverTimestamp(),
    updatedAt:    serverTimestamp(),
    likeCount:    0,
    repostCount:  0,
    viewCount:    0,
  };
  const ref = doc(collection(db, COLL));
  const batch = writeBatch(db);
  batch.set(ref, article);
  batch.set(doc(db, CARDS, ref.id), await cardFields(article));
  await batch.commit();
  return ref.id;
}

export async function deleteArticle(id) {
  return deleteDoc(doc(db, COLL, id));
}

/* Returns up to `count` featured articles ranked by engagement (likes + views),
   picking from the `pool` most recent of an already-fetched card list. */
export function pickFeaturedArticles(articles, { count = 3, pool = 20 } = {}) {
  return articles
    .slice(0, pool)
    .sort((a, b) =>
      ((b.likeCount || 0) + (b.viewCount || 0)) -
      ((a.likeCount || 0) + (a.viewCount || 0))
    )
    .slice(0, count);
}
