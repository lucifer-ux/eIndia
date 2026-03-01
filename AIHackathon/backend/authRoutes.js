const express = require('express');
const admin = require('./firebase');
const { upsertUser, upsertSeller, getSeller, setUserLoggedOut, setSellerLoggedOut, incrementSellerOrder } = require('./dynamodb');
const { DEMO_CREDENTIALS, DEMO_SELLER } = require('./mock/demoSeller');

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

/**
 * GET /api/auth/seller-stats/:sellerId
 * Get seller dashboard statistics
 */
router.get('/seller-stats/:sellerId', async (req, res) => {
    const { sellerId } = req.params;

    // Return mock data for demo seller
    if (sellerId === DEMO_SELLER.sellerId) {
        return res.json({
            success: true,
            stats: {
                ordersPlaced: DEMO_SELLER.ordersPlaced,
                orderVolume: DEMO_SELLER.orderVolume,
                isLoggedIn: true,
                lastLoginAt: new Date().toISOString(),
                email: DEMO_SELLER.email,
                displayName: DEMO_SELLER.displayName
            }
        });
    }

    try {
        const seller = await getSeller(sellerId);
        
        if (!seller) {
            return res.status(404).json({ error: 'Seller not found' });
        }

        // Return relevant stats for the dashboard
        res.json({
            success: true,
            stats: {
                ordersPlaced: seller.ordersPlaced || 0,
                orderVolume: seller.orderVolume || 0,
                isLoggedIn: seller.isLoggedIn,
                lastLoginAt: seller.lastLoginAt,
                email: seller.email,
                displayName: seller.displayName
            }
        });
    } catch (error) {
        console.error('Get seller stats error:', error.message);
        res.status(500).json({ error: 'Failed to fetch seller stats' });
    }
});

/**
 * POST /api/auth/seller-order
 * Increment seller's order count (called when an order is placed)
 */
router.post('/seller-order', async (req, res) => {
    const { sellerId, orderAmount } = req.body;

    if (!sellerId) {
        return res.status(400).json({ error: 'sellerId is required' });
    }

    try {
        const updatedSeller = await incrementSellerOrder(sellerId, orderAmount || 0);
        res.json({
            success: true,
            stats: {
                ordersPlaced: updatedSeller.ordersPlaced,
                orderVolume: updatedSeller.orderVolume
            }
        });
    } catch (error) {
        console.error('Increment order error:', error.message);
        res.status(500).json({ error: 'Failed to update order count' });
    }
});

/**
 * POST /api/auth/demo-seller-login
 * Demo login for testing - bypasses Firebase authentication
 * Credentials: demo@electrofind.com / demo123
 */
router.post('/demo-seller-login', async (req, res) => {
    const { email, password } = req.body;

    // Validate credentials against demo credentials
    if (email !== DEMO_CREDENTIALS.email || password !== DEMO_CREDENTIALS.password) {
        return res.status(401).json({ error: 'Invalid demo credentials' });
    }

    try {
        // Create a demo seller session
        const demoSeller = {
            ...DEMO_SELLER,
            lastLoginAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isLoggedIn: true
        };

        // Store in DynamoDB (upsert)
        await upsertSeller({
            sellerId: demoSeller.sellerId,
            email: demoSeller.email,
            displayName: demoSeller.displayName,
            firebaseToken: 'demo-token-' + Date.now(),
            loginProvider: 'demo'
        });

        console.log('Demo seller logged in:', demoSeller.sellerId);

        res.json({
            success: true,
            seller: demoSeller,
            message: 'Demo login successful'
        });
    } catch (error) {
        console.error('Demo login error:', error.message);
        res.status(500).json({ error: 'Failed to process demo login' });
    }
});

/**
 * GET /api/auth/demo-seller-data
 * Get complete demo seller data including mock stats, inquiries, orders
 */
router.get('/demo-seller-data', async (req, res) => {
    try {
        const { DEMO_SELLER, DEMO_INQUIRIES, DEMO_ORDERS, DEMO_STATS, DEMO_INVENTORY, DEMO_AGENT_CONFIG } = require('./mock/demoSeller');
        
        res.json({
            success: true,
            data: {
                seller: DEMO_SELLER,
                inquiries: DEMO_INQUIRIES,
                orders: DEMO_ORDERS,
                stats: DEMO_STATS,
                inventory: DEMO_INVENTORY,
                agentConfig: DEMO_AGENT_CONFIG
            }
        });
    } catch (error) {
        console.error('Get demo data error:', error.message);
        res.status(500).json({ error: 'Failed to fetch demo data' });
    }
});

module.exports = router;
