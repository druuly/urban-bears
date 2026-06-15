import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import {
  getFirestore, collection, getDocs, doc, deleteDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCubjX7XwPD9lfOh2kdBO0DRlDQSn9OZWs",
  authDomain: "urban-bears.firebaseapp.com",
  projectId: "urban-bears",
  storageBucket: "urban-bears.firebasestorage.app",
  messagingSenderId: "624423642068",
  appId: "1:624423642068:web:78c4845d6765a9dc07ec41",
  measurementId: "G-9W94R3112S"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const esc = (s = '') => s.replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fmtDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/* ── Confirmation modal ── */
let pendingId   = null;
let pendingCard = null;

const modal      = document.getElementById('delete-modal');
const btnConfirm = document.getElementById('modal-confirm');
const btnCancel  = document.getElementById('modal-cancel');
const errorToast = document.getElementById('delete-error');

function openModal(id, card) {
  pendingId   = id;
  pendingCard = card;
  modal.hidden = false;
}

btnCancel.addEventListener('click', () => {
  modal.hidden = true;
  pendingId   = null;
  pendingCard = null;
});

btnConfirm.addEventListener('click', async () => {
  if (!pendingId || !pendingCard) return;
  modal.hidden = true;

  const card = pendingCard;
  const id   = pendingId;
  pendingId   = null;
  pendingCard = null;

  card.classList.add('article-removing');
  try {
    await deleteDoc(doc(db, 'articles', id));
    card.addEventListener('transitionend', () => {
      card.remove();
      if (!document.querySelector('#articles-grid article')) {
        document.getElementById('articles-empty').hidden = false;
      }
    }, { once: true });
  } catch (err) {
    card.classList.remove('article-removing');
    console.error('Delete failed', err);
    errorToast.hidden = false;
    setTimeout(() => { errorToast.hidden = true; }, 4000);
  }
});

/* ── Render ── */
function buildCard(data, id, canDelete) {
  const card = document.createElement('article');
  card.className = 'article-card';
  card.dataset.id = id;

  const tags = Array.isArray(data.tags) ? data.tags.slice(0, 2) : [];
  const tagPills = tags.length
    ? tags.map(t => `<span class="article-tag">${esc(t)}</span>`).join('')
    : '<span class="article-tag">Science</span>';

  card.innerHTML = `
    <div class="article-meta">
      <div class="article-tags">${tagPills}</div>
      <span class="article-date">${esc(fmtDate(data.publishedAt))}</span>
    </div>
    <h2 class="article-title">${esc(data.title || 'Untitled')}</h2>
    <p class="article-abstract">${esc(data.abstract || '')}</p>
    <div class="article-footer">
      <span class="article-author">By ${esc(data.authorName || 'Unknown')}</span>
      ${canDelete
        ? `<button class="btn-delete-article" aria-label="Delete article">Delete</button>`
        : ''}
    </div>
  `;

  if (canDelete) {
    card.querySelector('.btn-delete-article').addEventListener('click', () => openModal(id, card));
  }

  return card;
}

async function loadArticles(user) {
  const grid    = document.getElementById('articles-grid');
  const loading = document.getElementById('articles-loading');
  const empty   = document.getElementById('articles-empty');

  grid.innerHTML = '';
  loading.hidden = false;
  empty.hidden   = true;

  try {
    const snap = await getDocs(
      query(collection(db, 'articles'), orderBy('publishedAt', 'desc'))
    );

    loading.hidden = true;

    if (snap.empty) {
      empty.hidden = false;
      return;
    }

    snap.forEach(docSnap => {
      const data = docSnap.data();
      const canDelete = !!(user && data.authorUid === user.uid);
      grid.appendChild(buildCard(data, docSnap.id, canDelete));
    });

  } catch (err) {
    loading.hidden = true;
    empty.hidden   = false;
    console.error('Failed to load articles', err);
  }
}

onAuthStateChanged(auth, loadArticles);
