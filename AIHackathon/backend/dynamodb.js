const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
require('dotenv').config();

const client = new DynamoDBClient({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const docClient = DynamoDBDocumentClient.from(client);

const USER_TABLE = process.env.DYNAMODB_USER_TABLE || 'user-table';
const SELLER_TABLE = process.env.DYNAMODB_SELLER_TABLE || 'seller-table';
const USER_CHAT_TABLE = process.env.DYNAMODB_USER_CHAT_TABLE || 'user-chat';
const SELLER_USER_CHAT_TABLE = process.env.DYNAMODB_SELLER_USER_CHAT_TABLE || 'seller-user-chat';

/**
 * Upsert a user record in user-table after successful Firebase auth
 */
async function upsertUser({ userId, email, displayName, firebaseToken, loginProvider }) {
    const params = {
        TableName: USER_TABLE,
        Item: {
            userId,
            email,
            displayName: displayName || '',
            firebaseToken,
            loginProvider, // 'google' or 'email'
            isLoggedIn: true,
            lastLoginAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
    };

    await docClient.send(new PutCommand(params));
    return params.Item;
}

/**
 * Upsert a seller record in seller-table after successful Firebase auth
 * Preserves existing ordersPlaced if seller already exists
 */
async function upsertSeller({ sellerId, email, displayName, firebaseToken, loginProvider }) {
    // First check if seller exists to preserve ordersPlaced
    const existingSeller = await getSeller(sellerId);
    
    const params = {
        TableName: SELLER_TABLE,
        Item: {
            sellerId,
            email,
            displayName: displayName || '',
            firebaseToken,
            loginProvider,
            isLoggedIn: true,
            ordersPlaced: existingSeller?.ordersPlaced || 0,
            orderVolume: existingSeller?.orderVolume || 0,
            lastLoginAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
    };

    await docClient.send(new PutCommand(params));
    return params.Item;
}

/**
 * Increment seller's order count and volume
 */
async function incrementSellerOrder(sellerId, orderAmount) {
    const params = {
        TableName: SELLER_TABLE,
        Key: { sellerId },
        UpdateExpression: 'SET ordersPlaced = if_not_exists(ordersPlaced, :zero) + :inc, orderVolume = if_not_exists(orderVolume, :zero) + :amount, updatedAt = :now',
        ExpressionAttributeValues: {
            ':inc': 1,
            ':amount': orderAmount || 0,
            ':zero': 0,
            ':now': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
    };
    
    const result = await docClient.send(new UpdateCommand(params));
    return result.Attributes;
}

/**
 * Increment seller's total queries count (product tile clicks)
 */
async function incrementTotalQueries(sellerId) {
    const params = {
        TableName: SELLER_TABLE,
        Key: { sellerId },
        UpdateExpression: 'SET totalQueries = if_not_exists(totalQueries, :zero) + :inc, updatedAt = :now',
        ExpressionAttributeValues: {
            ':inc': 1,
            ':zero': 0,
            ':now': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
    };
    
    const result = await docClient.send(new UpdateCommand(params));
    return result.Attributes;
}

/**
 * Increment seller's resolved queries count (WhatsApp notifications sent)
 */
async function incrementResolvedQueries(sellerId) {
    const params = {
        TableName: SELLER_TABLE,
        Key: { sellerId },
        UpdateExpression: 'SET resolvedQueries = if_not_exists(resolvedQueries, :zero) + :inc, updatedAt = :now',
        ExpressionAttributeValues: {
            ':inc': 1,
            ':zero': 0,
            ':now': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
    };
    
    const result = await docClient.send(new UpdateCommand(params));
    return result.Attributes;
}

/**
 * Update seller's AI prompt
 */
async function updateSellerPrompt(sellerId, prompt) {
    const params = {
        TableName: SELLER_TABLE,
        Key: { sellerId },
        UpdateExpression: 'SET sellerPrompt = :prompt, updatedAt = :now',
        ExpressionAttributeValues: {
            ':prompt': prompt,
            ':now': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
    };
    
    const result = await docClient.send(new UpdateCommand(params));
    return result.Attributes;
}

/**
 * Update seller's WhatsApp recipient number
 */
async function updateSellerWhatsAppNumber(sellerId, recipientNumber) {
    const params = {
        TableName: SELLER_TABLE,
        Key: { sellerId },
        UpdateExpression: 'SET whatsAppRecipientNumber = :number, updatedAt = :now',
        ExpressionAttributeValues: {
            ':number': recipientNumber,
            ':now': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
    };
    
    const result = await docClient.send(new UpdateCommand(params));
    return result.Attributes;
}

/**
 * Get seller's WhatsApp recipient number
 */
async function getSellerWhatsAppNumber(sellerId) {
    const seller = await getSeller(sellerId);
    return seller?.whatsAppRecipientNumber || null;
}

/**
 * Get a user by userId
 */
async function getUser(userId) {
    const params = {
        TableName: USER_TABLE,
        Key: { userId },
    };
    const result = await docClient.send(new GetCommand(params));
    return result.Item || null;
}

/**
 * Get a seller by sellerId
 */
async function getSeller(sellerId) {
    const params = {
        TableName: SELLER_TABLE,
        Key: { sellerId },
    };
    const result = await docClient.send(new GetCommand(params));
    return result.Item || null;
}

/**
 * Mark a user as logged out
 */
async function setUserLoggedOut(userId) {
    const params = {
        TableName: USER_TABLE,
        Key: { userId },
        UpdateExpression: 'SET isLoggedIn = :val, updatedAt = :now',
        ExpressionAttributeValues: {
            ':val': false,
            ':now': new Date().toISOString(),
        },
    };
    await docClient.send(new UpdateCommand(params));
}

/**
 * Mark a seller as logged out
 */
async function setSellerLoggedOut(sellerId) {
    const params = {
        TableName: SELLER_TABLE,
        Key: { sellerId },
        UpdateExpression: 'SET isLoggedIn = :val, updatedAt = :now',
        ExpressionAttributeValues: {
            ':val': false,
            ':now': new Date().toISOString(),
        },
    };
    await docClient.send(new UpdateCommand(params));
}

// ═══════════════════════════════════════
// USER CHAT OPERATIONS
// ═══════════════════════════════════════

/**
 * Create a new chat for a user
 */
async function createChat({ userId, chatId, title, messages = [] }) {
    const now = new Date().toISOString();
    const params = {
        TableName: USER_CHAT_TABLE,
        Item: {
            userCharId: `${userId}#${chatId}`,
            userId,
            chatId,
            title: title || 'New Chat',
            messages,
            createdAt: now,
            updatedAt: now,
        },
    };

    await docClient.send(new PutCommand(params));
    return params.Item;
}

/**
 * Get all chats for a user (sorted by updatedAt descending)
 */
async function getUserChats(userId) {
    const params = {
        TableName: USER_CHAT_TABLE,
        FilterExpression: 'userId = :userId',
        ExpressionAttributeValues: {
            ':userId': userId,
        },
    };

    const result = await docClient.send(new ScanCommand(params));
    // Sort by updatedAt descending (most recent first)
    const chats = (result.Items || []).sort((a, b) =>
        new Date(b.updatedAt) - new Date(a.updatedAt)
    );
    return chats;
}

/**
 * Get a specific chat by userId and chatId
 */
async function getChat(userId, chatId) {
    const params = {
        TableName: USER_CHAT_TABLE,
        Key: {
            userCharId: `${userId}#${chatId}`,
        },
    };

    const result = await docClient.send(new GetCommand(params));
    return result.Item || null;
}

/**
 * Update chat messages and title
 */
async function updateChat({ userId, chatId, messages, title }) {
    const now = new Date().toISOString();
    let updateExpression = 'SET updatedAt = :now';
    const expressionAttributeValues = { ':now': now };
    const expressionAttributeNames = {};

    if (messages !== undefined) {
        updateExpression += ', messages = :messages';
        expressionAttributeValues[':messages'] = messages;
    }

    if (title !== undefined) {
        updateExpression += ', #title = :title';
        expressionAttributeValues[':title'] = title;
        expressionAttributeNames['#title'] = 'title';
    }

    const params = {
        TableName: USER_CHAT_TABLE,
        Key: { userCharId: `${userId}#${chatId}` },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
    };

    if (Object.keys(expressionAttributeNames).length > 0) {
        params.ExpressionAttributeNames = expressionAttributeNames;
    }

    const result = await docClient.send(new UpdateCommand(params));
    return result.Attributes;
}

/**
 * Delete a chat
 */
async function deleteChat(userId, chatId) {
    const params = {
        TableName: USER_CHAT_TABLE,
        Key: {
            userCharId: `${userId}#${chatId}`,
        },
    };

    await docClient.send(new DeleteCommand(params));
    return { success: true, chatId };
}

/**
 * Delete all chats for a user
 */
async function deleteAllUserChats(userId) {
    const chats = await getUserChats(userId);
    const deletePromises = chats.map(chat => deleteChat(userId, chat.chatId));
    await Promise.all(deletePromises);
    return { success: true, deletedCount: chats.length };
}

// ═══════════════════════════════════════
// SELLER-USER CHAT OPERATIONS (for Org Dashboard)
// ═══════════════════════════════════════

/**
 * Create or update a seller-user conversation
 */
async function saveSellerUserChat({ 
    sellerId, 
    userEmail, 
    sessionId, 
    productData, 
    messages, 
    status = 'active',
    extractedInfo = null,
    whatsappNotified = false 
}) {
    const now = new Date().toISOString();
    const chatId = `${sellerId}#${userEmail}#${sessionId}`;
    
    const params = {
        TableName: SELLER_USER_CHAT_TABLE,
        Item: {
            chatId,
            sellerId,
            userEmail,
            sessionId,
            productData: productData || {},
            messages: messages || [],
            status,
            extractedInfo: extractedInfo || {},
            whatsappNotified,
            createdAt: now,
            updatedAt: now,
        },
    };

    await docClient.send(new PutCommand(params));
    return params.Item;
}

/**
 * Get all conversations for a seller (sorted by updatedAt descending)
 */
async function getSellerConversations(sellerId) {
    const params = {
        TableName: SELLER_USER_CHAT_TABLE,
        FilterExpression: 'sellerId = :sellerId',
        ExpressionAttributeValues: {
            ':sellerId': sellerId,
        },
    };

    const result = await docClient.send(new ScanCommand(params));
    // Sort by updatedAt descending (most recent first)
    const conversations = (result.Items || []).sort((a, b) =>
        new Date(b.updatedAt) - new Date(a.updatedAt)
    );
    return conversations;
}

/**
 * Get a specific conversation by chatId
 */
async function getSellerUserChat(chatId) {
    const params = {
        TableName: SELLER_USER_CHAT_TABLE,
        Key: { chatId },
    };

    const result = await docClient.send(new GetCommand(params));
    return result.Item || null;
}

/**
 * Update conversation messages and metadata
 */
async function updateSellerUserChat({ 
    chatId, 
    messages, 
    status, 
    extractedInfo, 
    whatsappNotified 
}) {
    const now = new Date().toISOString();
    let updateExpression = 'SET updatedAt = :now';
    const expressionAttributeValues = { ':now': now };
    const expressionAttributeNames = {};

    if (messages !== undefined) {
        updateExpression += ', messages = :messages';
        expressionAttributeValues[':messages'] = messages;
    }

    if (status !== undefined) {
        updateExpression += ', #status = :status';
        expressionAttributeValues[':status'] = status;
        expressionAttributeNames['#status'] = 'status';
    }

    if (extractedInfo !== undefined) {
        updateExpression += ', extractedInfo = :extractedInfo';
        expressionAttributeValues[':extractedInfo'] = extractedInfo;
    }

    if (whatsappNotified !== undefined) {
        updateExpression += ', whatsappNotified = :whatsappNotified';
        expressionAttributeValues[':whatsappNotified'] = whatsappNotified;
    }

    const params = {
        TableName: SELLER_USER_CHAT_TABLE,
        Key: { chatId },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
    };

    if (Object.keys(expressionAttributeNames).length > 0) {
        params.ExpressionAttributeNames = expressionAttributeNames;
    }

    const result = await docClient.send(new UpdateCommand(params));
    return result.Attributes;
}

/**
 * Update conversation status
 */
async function updateConversationStatus(chatId, status) {
    return updateSellerUserChat({ chatId, status });
}

/**
 * Delete a conversation
 */
async function deleteSellerUserChat(chatId) {
    const params = {
        TableName: SELLER_USER_CHAT_TABLE,
        Key: { chatId },
    };

    await docClient.send(new DeleteCommand(params));
    return { success: true, chatId };
}

/**
 * Get conversations by user email
 */
async function getUserConversations(userEmail) {
    const params = {
        TableName: SELLER_USER_CHAT_TABLE,
        FilterExpression: 'userEmail = :userEmail',
        ExpressionAttributeValues: {
            ':userEmail': userEmail,
        },
    };

    const result = await docClient.send(new ScanCommand(params));
    const conversations = (result.Items || []).sort((a, b) =>
        new Date(b.updatedAt) - new Date(a.updatedAt)
    );
    return conversations;
}

module.exports = {
    upsertUser,
    upsertSeller,
    getUser,
    getSeller,
    setUserLoggedOut,
    setSellerLoggedOut,
    incrementSellerOrder,
    incrementTotalQueries,
    incrementResolvedQueries,
    updateSellerPrompt,
    updateSellerWhatsAppNumber,
    getSellerWhatsAppNumber,
    // User chat operations
    createChat,
    getUserChats,
    getChat,
    updateChat,
    deleteChat,
    deleteAllUserChats,
    // Seller-user chat operations
    saveSellerUserChat,
    getSellerConversations,
    getSellerUserChat,
    updateSellerUserChat,
    updateConversationStatus,
    deleteSellerUserChat,
    getUserConversations,
};
