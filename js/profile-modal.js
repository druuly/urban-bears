import {
  getFirestore, doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

/* One shared promise per uid. onAuthStateChanged can fire several times for a
   single sign-in (session restore, redirect result, token refresh), and some
   pages call this on every firing without awaiting it. Without this guard each
   firing would attach another submit listener to the same form. */
const pending = new Map();

export async function checkAndShowProfileModal(user, app) {
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
    return snap.data();
  }

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
