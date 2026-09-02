/*
 * main.js — Urban BEARS
 *
 * Shared JavaScript loaded by every page. Contains two self-contained features:
 *   1. Mobile nav toggle — hamburger button opens/closes the .nav-links menu
 *   2. Scroll reveal — IntersectionObserver adds .visible to .reveal and
 *      .stagger elements as they enter the viewport; CSS in animations.css
 *      handles the actual transitions.
 *   3. Author-only nav — reveals the Analytics link and stamps lastActiveAt.
 *      This lives here because every page imports main.js, while the auth
 *      bar itself is handled per-page (nav-auth.js, or inline on
 *      research.html / article.html).
 */

/* ── Mobile nav ── */
const hamburger  = document.getElementById('hamburger');
const navLinks   = document.getElementById('nav-links');
const navAuthLi  = document.getElementById('nav-auth-li');
const donateBtn  = document.querySelector('.btn-donate');

function isMobileNav() {
  return window.matchMedia('(max-width: 48rem)').matches;
}

function closeMobileMenu() {
  navLinks.classList.remove('open');
  hamburger.setAttribute('aria-expanded', 'false');
  if (navAuthLi && navAuthLi.parentElement === navLinks) {
    donateBtn.after(navAuthLi);
  }
}

if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', String(open));
    if (open && isMobileNav() && navAuthLi) {
      navLinks.appendChild(navAuthLi);
    } else if (!open && navAuthLi && navAuthLi.parentElement === navLinks) {
      donateBtn.after(navAuthLi);
    }
  });

  document.addEventListener('click', e => {
    if (!hamburger.contains(e.target) && !navLinks.contains(e.target) && !navAuthLi?.contains(e.target)) {
      closeMobileMenu();
    }
  });
}

/* ── Scroll reveal ── */
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal, .stagger').forEach(el => observer.observe(el));

/* ── Author-only nav + activity stamp ── */
const analyticsLi = document.getElementById('nav-analytics-li');

(async () => {
  try {
    const { auth } = await import('/js/firebase.js');
    const { onAuthStateChanged } = await import(
      'https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js'
    );
    const { isAuthor, touchUserActivity } = await import('/js/analytics.js');

    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (analyticsLi) analyticsLi.hidden = true;
        return;
      }
      touchUserActivity(user);
      const author = await isAuthor(user.uid);
      if (analyticsLi) analyticsLi.hidden = !author;
    });
  } catch (e) {
    /* Auth is optional for browsing; a failure here just leaves the link hidden. */
  }
})();
