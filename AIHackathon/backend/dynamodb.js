const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
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

module.exports = {
    upsertUser,
    upsertSeller,
    getUser,
    getSeller,
    setUserLoggedOut,
    setSellerLoggedOut,
    incrementSellerOrder,
};
