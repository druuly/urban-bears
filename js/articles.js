/* Urban BEARS — article store.
   Firestore-backed CRUD for the Research journal. All article reads/writes
   should go through this module so the rest of the app stays DOM-only. */

import {
  collection, doc, getDoc, getDocs, addDoc, deleteDoc,
  query, orderBy, limit as fbLimit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { app, db } from './firebase.js';

export { app, db };

const COLL = 'articles';

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

export async function getArticle(id) {
  const snap = await getDoc(doc(db, COLL, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function publishArticle(data) {
  const ref = await addDoc(collection(db, COLL), {
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
  });
  return ref.id;
}

export async function deleteArticle(id) {
  return deleteDoc(doc(db, COLL, id));
}

/* Returns up to `count` featured articles ranked by engagement (likes + views),
   pulling from the `pool` most recent articles as candidates. */
export async function fetchFeaturedArticles({ count = 3, pool = 20 } = {}) {
  const articles = await fetchArticles({ limit: pool });
  return articles
    .sort((a, b) =>
      ((b.likeCount || 0) + (b.viewCount || 0)) -
      ((a.likeCount || 0) + (a.viewCount || 0))
    )
    .slice(0, count);
}
