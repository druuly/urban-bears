import {
  getFirestore, doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

export async function checkAndShowProfileModal(user, app) {
  const db  = getFirestore(app);
  const ref = doc(db, 'users', user.uid);

  let snap = null;
  try { snap = await getDoc(ref); } catch { /* permission denied or offline — fall through to show modal */ }

  if (snap && snap.exists() && snap.data().schoolName) {
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
