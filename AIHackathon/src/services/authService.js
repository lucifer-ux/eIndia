import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    sendPasswordResetEmail,
    signOut,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase/firebaseConfig';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Helper to send Firebase ID token to backend for verification and DynamoDB storage
 */
async function verifyWithBackend(idToken, loginProvider, endpoint) {
    const response = await fetch(`${API_URL}/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, loginProvider }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Backend verification failed');
    }

    return response.json();
}

// ==================== USER AUTH ====================

/**
 * Sign up with email and password (user)
 */
export async function signupWithEmail(email, password) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const idToken = await userCredential.user.getIdToken();
    const result = await verifyWithBackend(idToken, 'email', 'verify');
    return { firebaseUser: userCredential.user, ...result };
}

/**
 * Login with email and password (user)
 */
export async function loginWithEmail(email, password) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await userCredential.user.getIdToken();
    const result = await verifyWithBackend(idToken, 'email', 'verify');
    return { firebaseUser: userCredential.user, ...result };
}

/**
 * Login with Google popup (user)
 */
export async function loginWithGoogle() {
    const userCredential = await signInWithPopup(auth, googleProvider);
    const idToken = await userCredential.user.getIdToken();
    const result = await verifyWithBackend(idToken, 'google', 'verify');
    return { firebaseUser: userCredential.user, ...result };
}

// ==================== SELLER AUTH ====================

/**
 * Sign up with email and password (seller)
 */
export async function sellerSignupWithEmail(email, password) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const idToken = await userCredential.user.getIdToken();
    const result = await verifyWithBackend(idToken, 'email', 'verify-seller');
    return { firebaseUser: userCredential.user, ...result };
}

/**
 * Login with email and password (seller)
 */
export async function sellerLoginWithEmail(email, password) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await userCredential.user.getIdToken();
    const result = await verifyWithBackend(idToken, 'email', 'verify-seller');
    return { firebaseUser: userCredential.user, ...result };
}

/**
 * Login with Google popup (seller)
 */
export async function sellerLoginWithGoogle() {
    const userCredential = await signInWithPopup(auth, googleProvider);
    const idToken = await userCredential.user.getIdToken();
    const result = await verifyWithBackend(idToken, 'google', 'verify-seller');
    return { firebaseUser: userCredential.user, ...result };
}

// ==================== COMMON ====================

/**
 * Send password reset email
 */
export async function resetPassword(email) {
    await sendPasswordResetEmail(auth, email);
}

/**
 * Logout — sign out from Firebase + notify backend
 */
export async function logout(userId, sellerId) {
    await signOut(auth);

    try {
        await fetch(`${API_URL}/api/auth/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, sellerId }),
        });
    } catch (error) {
        console.error('Backend logout notification failed:', error);
    }
}
