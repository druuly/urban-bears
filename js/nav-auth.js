import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { app, auth, signIn, signOut, signInErrorMessage } from './firebase.js';
import { checkAndShowProfileModal } from './profile-modal.js';

const escapeHtml = (s = '') => s.replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const btnSignin   = document.getElementById('btn-signin');
const navUserWrap = document.getElementById('nav-user-wrap');
const navUserChip = document.getElementById('nav-user-chip');
const btnSignout  = document.getElementById('btn-signout');

btnSignin.addEventListener('click', async () => {
  try { await signIn(); }
  catch (e) {
    console.error('Sign in failed', e);
    const msg = signInErrorMessage(e);
    if (msg) alert(msg);
  }
});

btnSignout.addEventListener('click', () => signOut());

function setNavChip(photoURL, displayName) {
  navUserChip.innerHTML = `
    <img src="${escapeHtml(photoURL || '')}" alt="" />
    <div><div class="name">${escapeHtml(displayName || 'Reader')}</div></div>
  `;
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    btnSignin.hidden = true;
    navUserWrap.hidden = false;
    setNavChip(user.photoURL, user.displayName);

    const profile = await checkAndShowProfileModal(user, app);
    if (profile?.firstName) {
      setNavChip(user.photoURL, `${profile.firstName} ${profile.lastName}`);
    }
  } else {
    btnSignin.hidden = false;
    navUserWrap.hidden = true;
  }
});
