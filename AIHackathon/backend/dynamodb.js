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
 */
async function upsertSeller({ sellerId, email, displayName, firebaseToken, loginProvider }) {
    const params = {
        TableName: SELLER_TABLE,
        Item: {
            sellerId,
            email,
            displayName: displayName || '',
            firebaseToken,
            loginProvider,
            isLoggedIn: true,
            lastLoginAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
    };

    await docClient.send(new PutCommand(params));
    return params.Item;
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
};
