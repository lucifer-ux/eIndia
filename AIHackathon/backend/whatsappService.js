const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');

// Store active WhatsApp clients per seller
const whatsappClients = new Map();

/**
 * Initialize WhatsApp client for a seller
 * @param {string} sellerId - Unique seller identifier
 * @returns {Promise<{qrCode: string, status: string}>} - QR code data URL and status
 */
async function initializeClient(sellerId) {
  // If client already exists and is ready, return current status
  if (whatsappClients.has(sellerId)) {
    const existing = whatsappClients.get(sellerId);
    if (existing.ready) {
      console.log(`[WhatsApp] Client ${sellerId} already ready, returning existing status`);
      return { qrCode: null, status: 'ready', message: 'Already connected', phoneNumber: existing.phoneNumber };
    }
    // If QR was already generated, return it
    if (existing.qrCode) {
      console.log(`[WhatsApp] Client ${sellerId} has QR, returning existing QR`);
      return { qrCode: existing.qrCode, status: 'qr_ready', message: 'Scan QR code with WhatsApp' };
    }
    // If still connecting, return pending
    console.log(`[WhatsApp] Client ${sellerId} initializing, returning pending`);
    return { qrCode: null, status: 'initializing', message: 'Connection in progress' };
  }

  return new Promise((resolve, reject) => {
    let qrResolved = false;
    let initTimeout = null;
    let isDestroyed = false;

    const client = new Client({
      authStrategy: new LocalAuth({
        dataPath: `./whatsapp-session-${sellerId}`
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ],
        timeout: 60000
      }
    });

    // Store client info
    const clientInfo = {
      client,
      ready: false,
      qrCode: null,
      phoneNumber: null,
      destroyed: false
    };
    whatsappClients.set(sellerId, clientInfo);

    // QR Code event - send QR to user
    client.on('qr', async (qr) => {
      // Ignore QR events if already resolved or destroyed
      if (qrResolved || isDestroyed || clientInfo.ready) {
        console.log(`[WhatsApp] Ignoring QR event for ${sellerId} (resolved=${qrResolved}, destroyed=${isDestroyed}, ready=${clientInfo.ready})`);
        return;
      }
      
      console.log(`[WhatsApp] QR received for seller ${sellerId}`);
      try {
        const qrDataUrl = await QRCode.toDataURL(qr);
        clientInfo.qrCode = qrDataUrl;
        
        if (!qrResolved) {
          qrResolved = true;
          console.log(`[WhatsApp] Resolving with QR for ${sellerId}`);
          resolve({ qrCode: qrDataUrl, status: 'qr_ready', message: 'Scan QR code with WhatsApp' });
        }
      } catch (err) {
        console.error('QR generation error:', err);
        if (!qrResolved && !isDestroyed) {
          reject(err);
        }
      }
    });

    // Ready event - authenticated
    client.on('ready', async () => {
      console.log(`[WhatsApp] ✅ READY event fired for seller ${sellerId}`);
      
      // Clear the timeout since we're connected
      if (initTimeout) {
        clearTimeout(initTimeout);
        initTimeout = null;
      }
      
      // Mark as resolved to prevent QR from resolving later
      qrResolved = true;
      
      clientInfo.qrCode = null; // Clear QR once connected
      
      // Get phone number from client info
      if (client.info && client.info.wid) {
        clientInfo.phoneNumber = client.info.wid.user;
        console.log(`[WhatsApp] 📱 Phone number captured: ${clientInfo.phoneNumber}`);
      }
      
      // Wait for contact sync
      console.log(`[WhatsApp] ⏳ Waiting 5 seconds for contact sync...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Verify client state
      try {
        const state = await client.getState();
        console.log(`[WhatsApp] 📊 Client state: ${state}`);
        
        if (state === 'CONNECTED') {
          clientInfo.ready = true;
          console.log(`[WhatsApp] ✅ Client FULLY READY for ${sellerId}`);
          console.log(`[WhatsApp] 📊 Status: ready=${clientInfo.ready}, phone=${clientInfo.phoneNumber}`);
        } else {
          console.error(`[WhatsApp] ❌ Client state is ${state}, not CONNECTED`);
          // Don't cleanup here, let it try to reconnect
        }
      } catch (stateErr) {
        console.error(`[WhatsApp] ⚠️ Error checking client state: ${stateErr.message}`);
        // Don't cleanup on state check error, client might still be usable
        clientInfo.ready = true; // Mark as ready anyway since we got 'ready' event
      }
    });

    // Authentication failure
    client.on('auth_failure', (msg) => {
      console.error(`[WhatsApp] Auth failure for seller ${sellerId}:`, msg);
      isDestroyed = true;
      cleanupClient(sellerId);
      if (!qrResolved) {
        reject(new Error('Authentication failed: ' + msg));
      }
    });

    // Disconnected
    client.on('disconnected', (reason) => {
      console.log(`[WhatsApp] Disconnected for seller ${sellerId}:`, reason);
      isDestroyed = true;
      cleanupClient(sellerId);
    });

    // Initialize client
    const initClient = async () => {
      try {
        await client.initialize();
      } catch (err) {
        console.error('[WhatsApp] Client initialization error:', err);
        isDestroyed = true;
        cleanupClient(sellerId);
        if (!qrResolved) {
          if (err.message?.includes('Execution context') || err.message?.includes('Protocol error')) {
            reject(new Error('WhatsApp session corrupted. Please clear session data and try again.'));
          } else {
            reject(err);
          }
        }
      }
    };

    initClient();

    // Timeout if QR not received within 60 seconds
    initTimeout = setTimeout(() => {
      if (!qrResolved && !clientInfo.ready && !isDestroyed) {
        console.log(`[WhatsApp] Timeout for ${sellerId}, cleaning up...`);
        isDestroyed = true;
        cleanupClient(sellerId);
        reject(new Error('QR code generation timeout'));
      }
    }, 60000);
  });
}

/**
 * Get WhatsApp connection status for a seller
 * @param {string} sellerId 
 * @returns {Object} - Status info
 */
function getStatus(sellerId) {
  const clientInfo = whatsappClients.get(sellerId);
  
  if (!clientInfo) {
    console.log(`[WhatsApp] Status for ${sellerId}: disconnected (no client)`);
    return { connected: false, status: 'disconnected', message: 'Not connected' };
  }

  console.log(`[WhatsApp] Status check for ${sellerId}: ready=${clientInfo.ready}, hasQR=${!!clientInfo.qrCode}, phone=${clientInfo.phoneNumber}`);

  if (clientInfo.ready) {
    return { 
      connected: true, 
      status: 'ready', 
      phoneNumber: clientInfo.phoneNumber,
      message: 'Connected to WhatsApp' 
    };
  }

  if (clientInfo.qrCode) {
    return { 
      connected: false, 
      status: 'qr_ready', 
      qrCode: clientInfo.qrCode,
      message: 'QR code ready for scanning' 
    };
  }

  return { connected: false, status: 'initializing', message: 'Connecting...' };
}

/**
 * Disconnect and cleanup WhatsApp client
 * @param {string} sellerId 
 */
async function disconnectClient(sellerId) {
  const clientInfo = whatsappClients.get(sellerId);
  
  if (clientInfo && clientInfo.client) {
    try {
      await clientInfo.client.destroy();
    } catch (err) {
      console.error('Error destroying client:', err);
    }
  }
  
  cleanupClient(sellerId);
  return { success: true, message: 'Disconnected' };
}

/**
 * Send WhatsApp message
 * @param {string} sellerId 
 * @param {string} phoneNumber - Recipient phone number (with country code)
 * @param {string} message 
 * @returns {Promise<Object>}
 */
async function sendMessage(sellerId, phoneNumber, message) {
  const clientInfo = whatsappClients.get(sellerId);
  
  console.log(`[WhatsApp] Attempting to send message for ${sellerId}`);
  console.log(`[WhatsApp] Client exists: ${!!clientInfo}, ready: ${clientInfo?.ready}`);
  
  if (!clientInfo) {
    throw new Error('WhatsApp client not initialized');
  }
  
  if (!clientInfo.ready) {
    throw new Error('WhatsApp not connected');
  }

  // Check if client is still valid (not destroyed/detached)
  if (!clientInfo.client) {
    console.error('WhatsApp client is null');
    cleanupClient(sellerId);
    throw new Error('WhatsApp session expired. Please reconnect.');
  }

  // Verify client state before sending
  try {
    const state = await clientInfo.client.getState();
    if (state !== 'CONNECTED') {
      throw new Error(`WhatsApp client not in CONNECTED state (current: ${state})`);
    }
  } catch (stateErr) {
    console.error('Client state check failed:', stateErr);
    cleanupClient(sellerId);
    throw new Error('WhatsApp session is not active. Please reconnect.');
  }

  try {
    // Format phone number (remove non-digits)
    let formattedNumber = phoneNumber.replace(/\D/g, '');
    
    // Validate phone number format
    if (!formattedNumber || formattedNumber.length < 10) {
      throw new Error('Invalid phone number format. Please include country code (e.g., 917015332581)');
    }
    
    // If number doesn't start with country code (assuming India +91 if 10 digits)
    if (formattedNumber.length === 10) {
      console.log(`[WhatsApp] Number missing country code, assuming India +91`);
      formattedNumber = '91' + formattedNumber;
    }
    
    // Try multiple formats
    const formatsToTry = [
      `${formattedNumber}@c.us`,
      `${formattedNumber}@lid`
    ];
    
    console.log(`[WhatsApp] Trying to send message to: ${formattedNumber}`);
    
    // Try each format
    let lastError = null;
    for (const chatId of formatsToTry) {
      try {
        console.log(`[WhatsApp] Trying format: ${chatId}`);
        
        // Try to get chat first
        let chat = null;
        try {
          chat = await clientInfo.client.getChatById(chatId);
          console.log(`[WhatsApp] Found chat for ${chatId}`);
        } catch (e) {
          // Chat not in cache, try direct send
        }
        
        if (chat) {
          await chat.sendMessage(message);
          console.log(`[WhatsApp] Message sent via chat object: ${chatId}`);
          return { success: true, message: 'Message sent', timestamp: new Date().toISOString() };
        } else {
          await clientInfo.client.sendMessage(chatId, message);
          console.log(`[WhatsApp] Message sent directly: ${chatId}`);
          return { success: true, message: 'Message sent', timestamp: new Date().toISOString() };
        }
      } catch (err) {
        console.log(`[WhatsApp] Format ${chatId} failed: ${err.message}`);
        lastError = err;
        // Continue to next format
      }
    }
    
    // All formats failed
    throw new Error(`Could not send message to ${phoneNumber}. Please ensure:\n1. The number includes country code (e.g., 917015332581)\n2. The number has WhatsApp\n3. You have chatted with this number before\n\nError: ${lastError?.message || 'Unknown error'}`);
  } catch (err) {
    console.error('Send message error:', err);
    // Check if it's a detached frame error
    if (err.message?.includes('detached Frame') || err.message?.includes('Session closed')) {
      cleanupClient(sellerId);
      throw new Error('WhatsApp session expired. Please reconnect.');
    }
    throw new Error('Failed to send message: ' + err.message);
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

Your ElectroFind WhatsApp integration is now active!

*Sender Number:* ${getStatus(sellerId).phoneNumber || 'Connected'}
*Recipient Number:* ${phoneNumber}
*Connected At:* ${new Date().toLocaleString()}

You will receive notifications here when customers show purchase intent.

_This is an automated test message from ElectroFind._`;

  return sendMessage(sellerId, phoneNumber, testMessage);
}

/**
 * Cleanup client from memory
 * @param {string} sellerId 
 */
function cleanupClient(sellerId) {
  whatsappClients.delete(sellerId);
}

module.exports = {
  initializeClient,
  getStatus,
  disconnectClient,
  sendMessage,
  sendTestMessage
};
