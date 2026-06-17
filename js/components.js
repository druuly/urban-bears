/*
 * components.js — Urban BEARS
 *
 * Tiny client-side include system. Scans the document for placeholder
 * elements of the form <div data-component="name"></div> and replaces
 * each one with the contents of /assets/components/{name}.html.
 *
 * Components use absolute paths (/assets/..., /pages/...), so the site
 * must be served from the domain root (Firebase Hosting does this).
 *
 * Pages should `await loadComponents()` before running any code that
 * touches injected DOM (nav, footer, profile modal).
 */

const CACHE = new Map();

async function fetchComponent(name) {
  if (!CACHE.has(name)) {
    CACHE.set(name, fetch(`/assets/components/${name}.html`).then(r => {
      if (!r.ok) throw new Error(`Failed to load component "${name}" (${r.status})`);
      return r.text();
    }));
  }
  return CACHE.get(name);
}

export async function loadComponents(root = document) {
  const placeholders = Array.from(root.querySelectorAll('[data-component]'));
  await Promise.all(placeholders.map(async (el) => {
    const html = await fetchComponent(el.dataset.component);
    const tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    el.replaceWith(tpl.content);
  }));
}
