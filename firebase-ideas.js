/* =============================================================================
 * firebase-ideas.js — Cloud Firestore bridge for the Ideas Box
 * -----------------------------------------------------------------------------
 * This is the ONLY file that talks to Firebase. It loads the Firebase *browser*
 * SDK as an ES module (that is why index.html includes it with type="module"),
 * initialises the app, and exposes ONE tiny helper on the page:
 *
 *     window.RafiIdeas = { ready: true, submit(name, idea) -> Promise }
 *
 * app.js (a classic, non-module script) calls window.RafiIdeas.submit() to send
 * a submission. Keeping Firebase in its own module means the rest of the site
 * stays a plain zero-build static site.
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │  SECURITY — READ THIS.                                                      │
 * │  • The values in `firebaseConfig` (apiKey, appId, …) are a PUBLIC client    │
 * │    identifier. Google designs the Web apiKey to ship in frontend code; it   │
 * │    is NOT a secret and grants no privileged access on its own.              │
 * │  • What actually protects the data is Firestore SECURITY RULES (server      │
 * │    side — see README → "Ideas Box backend"): visitors may only CREATE a     │
 * │    submission; they cannot read, list, edit, or delete anything.            │
 * │  • NEVER put the Firebase Admin SDK, a service-account JSON, a private key,  │
 * │    a password, or any server credential in this file or anywhere in the     │
 * │    frontend. None are needed here and none are present.                     │
 * │  • Firebase Analytics is intentionally NOT initialised (no getAnalytics),   │
 * │    so `measurementId` below is unused — it is kept only so this config      │
 * │    matches the Firebase console verbatim.                                   │
 * └───────────────────────────────────────────────────────────────────────────┘
 * ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// Public Web App config (safe to expose — see the SECURITY note above).
const firebaseConfig = {
  apiKey: "AIzaSyChCUxgwqeYx9W98WI7VlP1Zf3pe45TFbA",
  authDomain: "web-me-a9800.firebaseapp.com",
  projectId: "web-me-a9800",
  storageBucket: "web-me-a9800.firebasestorage.app",
  messagingSenderId: "542320907811",
  appId: "1:542320907811:web:216b202c4753d973b94396",
  measurementId: "G-H76T8106DV" // Analytics only — intentionally NOT initialised.
};

// Field limits — kept in sync with data.js (ideasBackend) and, crucially, with
// the Firestore security rules in README. The rules are the real gate.
const NAME_MAX = 80;
const IDEA_MAX = 2000;

try {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  window.RafiIdeas = {
    ready: true,
    /**
     * Create ONE submission in the `ideas` collection.
     * Writes exactly three fields — name, idea, createdAt — because the
     * security rules reject any document with extra/missing keys.
     * Returns the addDoc() promise (resolves on success, rejects on failure).
     */
    submit(name, idea) {
      const doc = {
        name: String(name == null ? "" : name).trim().slice(0, NAME_MAX),
        idea: String(idea == null ? "" : idea).trim().slice(0, IDEA_MAX),
        createdAt: serverTimestamp()
      };
      return addDoc(collection(db, "ideas"), doc);
    }
  };
} catch (err) {
  // If the SDK fails to load/init (e.g. offline), expose a clearly not-ready
  // shim so app.js can show a friendly "couldn't connect" message instead of
  // throwing. It never silently swallows a real submission.
  window.RafiIdeas = {
    ready: false,
    error: String(err && err.message ? err.message : err),
    submit() { return Promise.reject(new Error("Firebase not ready")); }
  };
}
