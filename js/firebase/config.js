// js/firebase/config.js
// Central Firebase initialization. Every other module imports `app`, `auth`, `db` from here
// so there is exactly one Firebase App instance in the whole application.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// This is safe to keep client-side; access is enforced by Realtime Database security rules
// and Firebase Auth, not by hiding this object.
const firebaseConfig = {
  apiKey: "AIzaSyB0CR3gaK_BKjLXBu3UEJiPqU3vB5s6ptw",
  authDomain: "ares-projects.firebaseapp.com",
  databaseURL: "https://ares-projects-default-rtdb.firebaseio.com/",
  projectId: "ares-projects",
  storageBucket: "ares-projects.firebasestorage.app",
  messagingSenderId: "168912227431",
  appId: "1:168912227431:web:6f4351944b462546fbd8c2",
  measurementId: "G-W6W1MLSEB2",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

// Persist login across browser restarts (session-timeout logic is handled separately
// in js/firebase/auth.js via an inactivity timer, not by Firebase persistence itself).
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error("Failed to set auth persistence:", err);
});
