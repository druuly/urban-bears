import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCubjX7XwPD9lfOh2kdBO0DRlDQSn9OZWs",
  authDomain: "urban-bears.firebaseapp.com",
  projectId: "urban-bears",
  storageBucket: "urban-bears.firebasestorage.app",
  messagingSenderId: "624423642068",
  appId: "1:624423642068:web:78c4845d6765a9dc07ec41",
  measurementId: "G-9W94R3112S"
};

const app    = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth   = getAuth(app);
const provider = new GoogleAuthProvider();

const escapeHtml = (s = '') => s.replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const btnSignin   = document.getElementById('btn-signin');
const navUserWrap = document.getElementById('nav-user-wrap');
const navUserChip = document.getElementById('nav-user-chip');
const btnSignout  = document.getElementById('btn-signout');

btnSignin.addEventListener('click', async () => {
  try { await signInWithPopup(auth, provider); }
  catch (e) { console.error('Sign in failed', e); }
});

btnSignout.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user) {
    btnSignin.hidden = true;
    navUserWrap.hidden = false;
    navUserChip.innerHTML = `
      <img src="${escapeHtml(user.photoURL || '')}" alt="" />
      <div><div class="name">${escapeHtml(user.displayName || 'Reader')}</div></div>
    `;
  } else {
    btnSignin.hidden = false;
    navUserWrap.hidden = true;
  }
});
