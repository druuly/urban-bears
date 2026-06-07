/*
 * main.js — Urban BEARS
 *
 * Shared JavaScript loaded by every page. Contains two self-contained features:
 *   1. Mobile nav toggle — hamburger button opens/closes the .nav-links menu
 *   2. Scroll reveal — IntersectionObserver adds .visible to .reveal and
 *      .stagger elements as they enter the viewport; CSS in animations.css
 *      handles the actual transitions.
 *
 * No dependencies — vanilla JS only.
 */

/* ── Mobile nav ── */
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('nav-links');

hamburger.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  hamburger.setAttribute('aria-expanded', String(open));
});

document.addEventListener('click', e => {
  if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
    navLinks.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  }
});

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
