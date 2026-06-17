/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut
} from 'firebase/auth';
import {
  initializeFirestore,
  enableNetwork,
  onSnapshotsInSync,
  doc as firestoreDoc,
  getDoc as firestoreGetDoc,
  getDocFromCache,
  DocumentReference,
  DocumentSnapshot
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Safe lazy initialization of Firebase App
let app;
try {
  if (firebaseConfig && firebaseConfig.apiKey) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  } else {
    console.warn('Firebase config apiKey is missing. Using local simulation.');
  }
} catch (e) {
  console.error('Firebase initialization error, running in local fallback mode:', e);
}

export const auth = app ? getAuth(app) : null;
export const db = app ? initializeFirestore(app, {
  experimentalForceLongPolling: true
}) : null;

// ── Firestore readiness & safe-read helpers ──────────────────────────
let _firestoreReady = false;
let _readyPromise: Promise<void> | null = null;

/**
 * Returns a promise that resolves once the Firestore SDK has synchronised
 * with the backend at least once (i.e. the long-polling channel is up).
 * Falls back after `timeoutMs` so the app never blocks forever.
 */
export function waitForFirestoreReady(timeoutMs = 5000): Promise<void> {
  if (_firestoreReady || !db) return Promise.resolve();
  if (_readyPromise) return _readyPromise;

  _readyPromise = new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      console.log('[Firestore] Connection readiness timed out – proceeding with local fallbacks');
      _firestoreReady = true;
      resolve();
    }, timeoutMs);

    // enableNetwork() ensures the SDK is actively trying to connect,
    // then onSnapshotsInSync fires once the first server round-trip completes.
    enableNetwork(db!)
      .then(() => {
        const unsub = onSnapshotsInSync(db!, () => {
          clearTimeout(timer);
          _firestoreReady = true;
          unsub();
          console.log('[Firestore] Backend connection established');
          resolve();
        });
      })
      .catch(() => {
        clearTimeout(timer);
        _firestoreReady = true;
        resolve();
      });
  });

  return _readyPromise;
}

/**
 * A safe wrapper around getDoc that:
 *   1. Tries a normal server+cache read.
 *   2. If that throws "client is offline", falls back to a cache-only read.
 *   3. If cache also misses, returns a snapshot where .exists() === false
 *      instead of throwing.
 */
export async function safeGetDoc(ref: DocumentReference): Promise<DocumentSnapshot> {
  try {
    return await firestoreGetDoc(ref);
  } catch (err: any) {
    const msg = err?.message || '';
    if (msg.includes('offline') || msg.includes('unavailable')) {
      try {
        return await getDocFromCache(ref);
      } catch {
        // Cache miss – return a "not found" snapshot by re-reading
        // (the SDK returns exists()=false for missing cache docs)
        // We'll use a sentinel
      }
    }
    // For any other error, just rethrow
    if (!msg.includes('offline') && !msg.includes('unavailable') && !msg.includes('Failed to get document')) {
      throw err;
    }
  }
  // Absolute fallback: return a fake "empty" snapshot interface
  return { exists: () => false, data: () => undefined, id: ref.id } as unknown as DocumentSnapshot;
}

// Configure provider with custom scopes
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.profile');
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.email');
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

// Cache the access token in-memory
let cachedAccessToken: string | null = null;
let isSigningIn = false;

/**
 * Initializeauth state listener
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (!auth) {
    console.warn('[Auth] Firebase auth not initialized');
    if (onAuthFailure) onAuthFailure();
    return () => {};
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        console.log('[Auth] Session restored for', user.email, 'token prefix:', cachedAccessToken.slice(0, 8) + '...');
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        const storedToken = localStorage.getItem('firebaseAccessToken');
        if (storedToken) {
          cachedAccessToken = storedToken;
          console.log('[Auth] Restored token from localStorage for', user.email);
        } else {
          console.warn('[Auth] User signed in but no Google OAuth access token cached — Drive API will be unavailable until token is fetched');
        }
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken || '');
      }
    } else {
      console.log('[Auth] User signed out');
      cachedAccessToken = null;
      localStorage.removeItem('firebaseAccessToken');
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Handle Google Sign-In with popup
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (!auth) {
    throw new Error('Firebase Auth not initialized. Check firebase-applet-config.json');
  }

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve access token from Google.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Core Sign-in failure:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (token) {
    localStorage.setItem('firebaseAccessToken', token);
  } else {
    localStorage.removeItem('firebaseAccessToken');
  }
};

export const logout = async () => {
  if (auth) {
    await signOut(auth);
  }
  cachedAccessToken = null;
};
