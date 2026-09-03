import {
  getFirestore, doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

/* One shared promise per uid. onAuthStateChanged can fire several times for a
   single sign-in (session restore, redirect result, token refresh), and some
   pages call this on every firing without awaiting it. Without this guard each
   firing would attach another submit listener to the same form. */
const pending = new Map();

/* "This account finished onboarding" is a fact that never goes back to false,
   so it does not need to be re-derived from the network on every page load.
   Once we have seen a complete profile — either because we just saved one or
   because a read confirmed one — the answer is cached per uid and no later
   page load can decide otherwise. Without this, every navigation re-asks
   Firestore, and any single bad answer (denied read, blocked request, stale
   cache, wrong account) re-opens the modal on a user who is already done. */
const DONE_KEY = (uid) => `urbanbears.profileComplete.${uid}`;

function markComplete(uid, profile) {
  try {
    localStorage.setItem(DONE_KEY(uid), JSON.stringify({
      firstName: profile.firstName || '',
      lastName:  profile.lastName  || '',
    }));
  } catch { /* private mode / storage full — we just lose the fast path */ }
}

function readComplete(uid) {
  try { return JSON.parse(localStorage.getItem(DONE_KEY(uid)) || 'null'); }
  catch { return null; }
}

export async function checkAndShowProfileModal(user, app) {
  const done = readComplete(user.uid);
  if (done) return done;

  const existing = pending.get(user.uid);
  if (existing) return existing;

  const run = showModalIfNeeded(user, app).finally(() => pending.delete(user.uid));
  pending.set(user.uid, run);
  return run;
}

async function showModalIfNeeded(user, app) {
  const db  = getFirestore(app);
  const ref = doc(db, 'users', user.uid);

  let snap;
  try {
    snap = await getDoc(ref);
  } catch (err) {
    /* A failed read is NOT the same as "no profile". Showing the modal here
       would nag a user who already completed it — and their re-submit would
       succeed, so the bug looks like the form never saving. Skip this page
       load instead; a genuinely new user gets prompted on the next one. */
    console.warn('Profile lookup failed, skipping profile modal:', err?.code || err);
    return null;
  }

  if (snap.exists() && snap.data().schoolName) {
    markComplete(user.uid, snap.data());
    return snap.data();
  }

  /* Reaching here means the read said this account has no profile. If that is
     ever wrong, this line says which account and what came back, which is the
     only thing worth knowing when the modal shows up unexpectedly. */
  console.info('[profile-modal] no profile for', user.uid,
    '— exists:', snap.exists(), 'fields:', snap.exists() ? Object.keys(snap.data()) : []);

  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return null;

  const modal = document.getElementById('profile-modal');
  if (!modal) return null;

  const form     = document.getElementById('profile-form');
  const errorEl  = form.querySelector('.modal-error');
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  const firstInput = form.querySelector('input');
  if (firstInput) setTimeout(() => firstInput.focus(), 50);

  const submitBtn = form.querySelector('button[type=submit]');
  const labelEl   = submitBtn.querySelector('.btn-modal-label') || submitBtn;
  const inputs    = Array.from(form.querySelectorAll('input[required]'));

  const validate = () => {
    let allValid = true;
    for (const input of inputs) {
      const ok = input.value.trim().length >= 2;
      input.classList.toggle('is-valid', ok);
      if (!ok) allValid = false;
    }
    submitBtn.disabled = !allValid;
  };
  inputs.forEach((input) => input.addEventListener('input', validate));
  validate();

  return new Promise((resolve) => {
    let saving = false;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (saving) return;

      const firstName  = form.firstName.value.trim();
      const lastName   = form.lastName.value.trim();
      const schoolName = form.schoolName.value.trim();
      if (!firstName || !lastName || !schoolName) return;

      saving = true;
      submitBtn.disabled = true;
      labelEl.textContent = 'Saving…';
      if (errorEl) errorEl.hidden = true;

      try {
        const digestOptIn = !!(form.digestOptIn && form.digestOptIn.checked);
        const data = { firstName, lastName, schoolName, uid: user.uid, email: user.email ?? '', digestOptIn };
        await setDoc(ref, data, { merge: true });
        markComplete(user.uid, data);
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        resolve(data);
      } catch (err) {
        console.error('Profile save failed', err);
        saving = false;
        submitBtn.disabled = false;
        labelEl.textContent = 'Join';
        if (errorEl) {
          errorEl.textContent = 'Could not save your profile. Please try again.';
          errorEl.hidden = false;
        }
      }
    });
  });
}
