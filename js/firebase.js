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

/* `authDomain` should share the registrable domain with the live site
   (e.g. `auth.urbanbears.com`) so browser storage partitioning doesn't
   break sign-in on mobile Safari/Chrome. To switch:
     1. Add the subdomain in Firebase Console → Authentication → Settings → Authorized domains
     2. Add it in Google Cloud Console → Credentials → OAuth 2.0 client → Authorized JS origins + redirect URIs
     3. Point DNS at Firebase Hosting and verify the cert provisions
     4. Change `authDomain` below to the new subdomain */
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
