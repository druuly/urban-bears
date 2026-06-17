/* Urban BEARS — shared Firebase init + auth helpers.
   Every page imports `app`, `auth`, `db` from here so we don't duplicate
   config and so mobile auth behavior is consistent. */

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider,
  signInWithPopup, signInWithRedirect, getRedirectResult,
  signOut as fbSignOut
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

/* `authDomain` should share the registrable domain with the live site so
   browser storage partitioning doesn't break sign-in on mobile Safari/Chrome.
   The site is on Vercel — `*.vercel.app` is on the Public Suffix List, so
   the only way to fix this is to:
     1. Buy/use a custom domain (e.g. urbanbears.com → Vercel)
     2. Point a subdomain (e.g. auth.urbanbears.com) at Firebase Hosting
     3. Add that subdomain in Firebase Console → Auth → Settings → Authorized domains
     4. Add it in Google Cloud Console → Credentials → OAuth client → Authorized JS origins + /__/auth/handler redirect URI
     5. Change `authDomain` below to the new subdomain
   Until then, mobile Safari users may hit `auth/missing-initial-state`. */
const firebaseConfig = {
  apiKey: "AIzaSyCubjX7XwPD9lfOh2kdBO0DRlDQSn9OZWs",
  authDomain: "urban-bears.firebaseapp.com",
  projectId: "urban-bears",
  storageBucket: "urban-bears.firebasestorage.app",
  messagingSenderId: "624423642068",
  appId: "1:624423642068:web:78c4845d6765a9dc07ec41",
  measurementId: "G-9W94R3112S"
};

export const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

const provider = new GoogleAuthProvider();

const IN_APP_BROWSER_RE = /FBAN|FBAV|Instagram|TikTok|Line\/|Snapchat|LinkedIn|Twitter/i;
const ua = navigator.userAgent || '';
export const authEnv = {
  isMobile: /Android|iPhone|iPad|iPod/i.test(ua),
  isInAppBrowser: IN_APP_BROWSER_RE.test(ua),
};

export class InAppBrowserError extends Error {
  constructor() { super('IN_APP_BROWSER'); this.code = 'IN_APP_BROWSER'; }
}

/* Consume any pending redirect result. Must run on every page load — that's
   how Firebase resolves the promise returned by signInWithRedirect and
   clears its internal sessionStorage state. */
getRedirectResult(auth).catch((e) => {
  if (e?.code && e.code !== 'auth/no-auth-event') {
    console.warn('getRedirectResult:', e.code);
  }
});

export async function signIn() {
  if (authEnv.isInAppBrowser) throw new InAppBrowserError();
  if (authEnv.isMobile) {
    await signInWithRedirect(auth, provider);
    return;
  }
  await signInWithPopup(auth, provider);
}

export const signOut = () => fbSignOut(auth);

/* Maps a sign-in error to a user-facing message. Returns null for benign
   cases (user closed the popup) so callers can stay silent. */
export function signInErrorMessage(e) {
  const code = e?.code || e?.message;
  switch (code) {
    case 'IN_APP_BROWSER':
      return 'Please open this page in Safari or Chrome to sign in.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null;
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Allow popups and try again.';
    case 'auth/missing-initial-state':
    case 'auth/web-storage-unsupported':
      return 'Sign-in is blocked by your browser. Try Safari/Chrome outside private mode, or a desktop browser.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return 'Sign in failed. Please try again.';
  }
}
