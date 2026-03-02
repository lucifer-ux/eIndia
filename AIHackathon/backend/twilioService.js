const twilio = require('twilio');

// Store WhatsApp connection status per seller
const whatsappClients = new Map();

// Required environment variables:
// TWILIO_ACCOUNT_SID - Your Twilio Account SID
// TWILIO_AUTH_TOKEN - Your Twilio Auth Token  
// TWILIO_WHATSAPP_NUMBER - Your Twilio WhatsApp number (e.g., +14155238886)

/**
 * Initialize WhatsApp client for a seller using Twilio
 * @param {string} sellerId - Unique seller identifier
 * @returns {Promise<{qrCode: string|null, status: string}>} - Connection status
 */
async function initializeClient(sellerId) {
  // Check if already connected
  if (whatsappClients.has(sellerId)) {
    const existing = whatsappClients.get(sellerId);
    if (existing.ready) {
      console.log(`[Twilio] Client ${sellerId} already ready`);
      return { 
        qrCode: null, 
        status: 'ready', 
        message: 'Already connected', 
        phoneNumber: existing.phoneNumber 
      };
    }
  }

  // Validate Twilio credentials
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    throw new Error('Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
  }

  if (!process.env.TWILIO_WHATSAPP_NUMBER) {
    throw new Error('Twilio WhatsApp number not configured. Please set TWILIO_WHATSAPP_NUMBER');
  }

  // Validate the number format - must be a WhatsApp-enabled number
  const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;
  if (!whatsappNumber.startsWith('+1415') && !whatsappNumber.startsWith('+1')) {
    console.warn(`[Twilio] Warning: ${whatsappNumber} may not be WhatsApp-enabled.`);
    console.warn('[Twilio] For testing, use the Twilio WhatsApp Sandbox number starting with +1415...');
  }

  // Store client info (Twilio doesn't require QR code scanning)
  const clientInfo = {
    ready: true,
    phoneNumber: process.env.TWILIO_WHATSAPP_NUMBER,
    connectedAt: new Date().toISOString()
  };
  whatsappClients.set(sellerId, clientInfo);

  console.log(`[Twilio] ✅ Client initialized for seller ${sellerId}`);
  console.log(`[Twilio] 📱 WhatsApp Number: ${clientInfo.phoneNumber}`);

  return {
    qrCode: null,
    status: 'ready',
    message: 'Connected via Twilio',
    phoneNumber: clientInfo.phoneNumber
  };
}

/**
 * Get WhatsApp connection status for a seller
 * @param {string} sellerId 
 * @returns {Object} - Status info
 */
function getStatus(sellerId) {
  const clientInfo = whatsappClients.get(sellerId);
  
  if (!clientInfo) {
    console.log(`[Twilio] Status for ${sellerId}: disconnected`);
    return { connected: false, status: 'disconnected', message: 'Not connected' };
  }

  return { 
    connected: true, 
    status: 'ready', 
    phoneNumber: clientInfo.phoneNumber,
    message: 'Connected to WhatsApp via Twilio' 
  };
}

/**
 * Disconnect and cleanup WhatsApp client
 * @param {string} sellerId 
 */
async function disconnectClient(sellerId) {
  whatsappClients.delete(sellerId);
  console.log(`[Twilio] Client ${sellerId} disconnected`);
  return { success: true, message: 'Disconnected' };
}

/**
 * Send WhatsApp message via Twilio
 * @param {string} sellerId 
 * @param {string} phoneNumber - Recipient phone number (with country code)
 * @param {string} message 
 * @returns {Promise<Object>}
 */
async function sendMessage(sellerId, phoneNumber, message) {
  const clientInfo = whatsappClients.get(sellerId);
  
  console.log(`[Twilio] Attempting to send message for ${sellerId}`);
  
  if (!clientInfo || !clientInfo.ready) {
    throw new Error('WhatsApp client not initialized. Please connect first.');
  }

  // Initialize Twilio client
  const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  // Format phone number
  let formattedNumber = phoneNumber.replace(/\D/g, '');
  
  // Validate phone number
  if (!formattedNumber || formattedNumber.length < 10) {
    throw new Error('Invalid phone number format. Please include country code (e.g., 917015332581)');
  }
  
  // Add + prefix if missing
  if (!formattedNumber.startsWith('+')) {
    formattedNumber = '+' + formattedNumber;
  }

  const fromNumber = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`;
  const toNumber = `whatsapp:${formattedNumber}`;

  console.log(`[Twilio] Sending message from ${fromNumber} to ${toNumber}`);

  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: fromNumber,
      to: toNumber
    });

    console.log(`[Twilio] Message sent successfully. SID: ${result.sid}`);
    
    return { 
      success: true, 
      message: 'Message sent', 
      messageSid: result.sid,
      timestamp: new Date().toISOString() 
    };
  } catch (err) {
    console.error('[Twilio] Send message error:', err);
    
    if (err.code === 21211) {
      throw new Error('Invalid phone number format. Please use format: +[country_code][number] (e.g., +917015332581)');
    } else if (err.code === 21608) {
      throw new Error('The recipient has not opted in to receive messages. They must send a WhatsApp message to your Twilio number first.');
    } else if (err.code === 63016) {
      throw new Error('WhatsApp channel error. Please ensure the recipient has an active WhatsApp account.');
    } else if (err.code === 63007 || err.message?.includes('could not find a Channel')) {
      throw new Error(
        'RECIPIENT NOT OPTED IN. Error 63007: The recipient must first send a WhatsApp message to your Twilio number before you can message them.\n\n' +
        'TO FIX THIS:\n' +
        '1. From the recipient phone (' + formattedNumber + '), send a WhatsApp message to: ' + process.env.TWILIO_WHATSAPP_NUMBER + '\n' +
        '   Message can be anything, e.g.: "Hello" or "Join"\n' +
        '2. Wait for confirmation that the message was delivered\n' +
        '3. Then try sending the test message again from this app\n\n' +
        'This is a Twilio WhatsApp Sandbox requirement. Recipients must initiate contact first.'
      );
    }
    
    throw new Error(`Failed to send message: ${err.message}`);
  }
}

/**
 * Send test message to verify WhatsApp is working
 * @param {string} sellerId 
 * @param {string} phoneNumber 
 * @returns {Promise<Object>}
 */
async function sendTestMessage(sellerId, phoneNumber) {
  const testMessage = `✅ *WhatsApp Integration Test*

Your ElectroFind WhatsApp integration is now active via Twilio!

*Sender Number:* ${process.env.TWILIO_WHATSAPP_NUMBER}
*Recipient Number:* ${phoneNumber}
*Connected At:* ${new Date().toLocaleString()}

You will receive notifications here when customers show purchase intent.

_This is an automated test message from ElectroFind._`;

  return sendMessage(sellerId, phoneNumber, testMessage);
}

/**
 * Handle incoming WhatsApp messages (webhook handler)
 * @param {Object} req - Express request object
 * @returns {Object} - Parsed message data
 */
function handleIncomingMessage(req) {
  const { Body, From, To, MessageSid } = req.body;
  
  console.log(`[Twilio] Incoming message from ${From}: ${Body}`);
  
  return {
    messageSid: MessageSid,
    from: From.replace('whatsapp:', ''),
    to: To.replace('whatsapp:', ''),
    body: Body,
    timestamp: new Date().toISOString()
  };
}

/**
 * Validate Twilio webhook request signature
 * @param {string} authToken - Twilio Auth Token
 * @param {string} url - Webhook URL
 * @param {Object} params - Request parameters
 * @param {string} signature - X-Twilio-Signature header
 * @returns {boolean}
 */
function validateWebhook(authToken, url, params, signature) {
  const client = twilio();
  return client.validateRequest(authToken, signature, url, params);
}

module.exports = {
  initializeClient,
  getStatus,
  disconnectClient,
  sendMessage,
  sendTestMessage,
  handleIncomingMessage,
  validateWebhook
};