const express = require('express');
const admin = require('./firebase');
const { upsertUser, upsertSeller, setUserLoggedOut, setSellerLoggedOut } = require('./dynamodb');

const router = express.Router();

/**
 * POST /api/auth/verify
 * Frontend sends Firebase ID token after email/pwd or Google login.
 * Backend verifies token, upserts user in DynamoDB user-table.
 */
router.post('/verify', async (req, res) => {
    const { idToken, loginProvider } = req.body;

    if (!idToken) {
        return res.status(400).json({ error: 'idToken is required' });
    }

    try {
        // Verify the Firebase ID token
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const { uid, email, name } = decodedToken;

        // Upsert user in DynamoDB
        const user = await upsertUser({
            userId: uid,
            email: email || '',
            displayName: name || '',
            firebaseToken: idToken,
            loginProvider: loginProvider || 'email',
        });

        res.json({ success: true, user });
    } catch (error) {
        console.error('Token verification error:', error.message);
        res.status(401).json({ error: 'Invalid or expired token' });
    }
});

/**
 * POST /api/auth/verify-seller
 * Same as verify but stores in seller-table.
 */
router.post('/verify-seller', async (req, res) => {
    const { idToken, loginProvider } = req.body;

    if (!idToken) {
        return res.status(400).json({ error: 'idToken is required' });
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const { uid, email, name } = decodedToken;

        const seller = await upsertSeller({
            sellerId: uid,
            email: email || '',
            displayName: name || '',
            firebaseToken: idToken,
            loginProvider: loginProvider || 'email',
        });

        res.json({ success: true, seller });
    } catch (error) {
        console.error('Seller token verification error:', error.message);
        res.status(401).json({ error: 'Invalid or expired token' });
    }
});

/**
 * POST /api/auth/logout
 * Mark user or seller as logged out in DynamoDB.
 */
router.post('/logout', async (req, res) => {
    const { userId, sellerId } = req.body;

    try {
        if (userId) {
            await setUserLoggedOut(userId);
        }
        if (sellerId) {
            await setSellerLoggedOut(sellerId);
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Logout error:', error.message);
        res.status(500).json({ error: 'Failed to process logout' });
    }
});

module.exports = router;
