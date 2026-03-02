const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

// Store active WhatsApp clients per seller
const whatsappClients = new Map();

/**
 * Clean up Chrome lock files that prevent browser restart
 * @param {string} sellerId 
 */
function cleanupLockFiles(sellerId) {
  const sessionPath = path.resolve(`./whatsapp-session-${sellerId}`);
  const lockFiles = [
    path.join(sessionPath, 'session', 'SingletonLock'),
    path.join(sessionPath, 'session', 'SingletonSocket'),
    path.join(sessionPath, 'session', 'SingletonCookie'),
    path.join(sessionPath, 'session', 'Default', 'SingletonLock'),
    path.join(sessionPath, 'session', 'Default', 'SingletonSocket'),
    path.join(sessionPath, 'session', 'Default', 'SingletonCookie')
  ];
  
  for (const lockFile of lockFiles) {
    try {
      if (fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile);
        console.log(`[WhatsApp] Cleaned up lock file: ${lockFile}`);
      }
    } catch (err) {
      console.log(`[WhatsApp] Could not clean up lock file ${lockFile}: ${err.message}`);
    }
  }
}

/**
 * Check if a client is actually usable by verifying browser connection
 * @param {Object} clientInfo 
 * @returns {boolean}
 */
async function isClientUsable(clientInfo) {
  if (!clientInfo || !clientInfo.client) {
    return false;
  }
  
  try {
    // Try to access the puppeteer browser to check if it's connected
    const browser = clientInfo.client.pupBrowser;
    if (!browser) {
      return false;
    }
    
    // Check if browser is connected
    if (browser.isConnected && !browser.isConnected()) {
      return false;
    }
    
    // Try to get state to verify client is responsive
    await clientInfo.client.getState();
    return true;
  } catch (err) {
    console.log(`[WhatsApp] Client usability check failed: ${err.message}`);
    return false;
  }
}

/**
 * Force cleanup client and browser processes
 * @param {string} sellerId 
 */
async function forceCleanupClient(sellerId) {
  const clientInfo = whatsappClients.get(sellerId);
  
  console.log(`[WhatsApp] Force cleaning up client for ${sellerId}`);
  
  if (clientInfo && clientInfo.client) {
    try {
      // Try to close the browser properly
      const browser = clientInfo.client.pupBrowser;
      if (browser) {
        try {
          await browser.close();
          console.log(`[WhatsApp] Browser closed for ${sellerId}`);
        } catch (err) {
          console.log(`[WhatsApp] Browser close error (ignoring): ${err.message}`);
        }
      }
    } catch (err) {
      console.log(`[WhatsApp] Error accessing browser: ${err.message}`);
    }
    
    try {
      await clientInfo.client.destroy();
      console.log(`[WhatsApp] Client destroyed for ${sellerId}`);
    } catch (err) {
      console.log(`[WhatsApp] Client destroy error (ignoring): ${err.message}`);
    }
  }
  
  // Clean up lock files
  cleanupLockFiles(sellerId);
  
  // Remove from map
  whatsappClients.delete(sellerId);
  console.log(`[WhatsApp] Client removed from map for ${sellerId}`);
}

/**
 * Clear session data directory completely
 * @param {string} sellerId 
 */
function clearSessionData(sellerId) {
  const sessionPath = path.resolve(`./whatsapp-session-${sellerId}`);
  try {
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log(`[WhatsApp] Session data cleared for ${sellerId}`);
    }
  } catch (err) {
    console.log(`[WhatsApp] Could not clear session data: ${err.message}`);
  }
}

/**
 * Initialize WhatsApp client for a seller
 * @param {string} sellerId - Unique seller identifier
 * @returns {Promise<{qrCode: string, status: string}>} - QR code data URL and status
 */
async function initializeClient(sellerId) {
  // If client already exists, check if it's actually usable
  if (whatsappClients.has(sellerId)) {
    const existing = whatsappClients.get(sellerId);
    
    // Check if client is truly usable
    const usable = await isClientUsable(existing);
    
    if (!usable) {
      console.log(`[WhatsApp] Client ${sellerId} exists but is not usable, force cleaning up...`);
      await forceCleanupClient(sellerId);
      // Continue to create new client below
    } else if (existing.ready) {
      console.log(`[WhatsApp] Client ${sellerId} already ready, returning existing status`);
      return { qrCode: null, status: 'ready', message: 'Already connected', phoneNumber: existing.phoneNumber };
    } else if (existing.qrCode) {
      console.log(`[WhatsApp] Client ${sellerId} has QR, returning existing QR`);
      return { qrCode: existing.qrCode, status: 'qr_ready', message: 'Scan QR code with WhatsApp' };
    } else {
      // If still connecting, return pending
      console.log(`[WhatsApp] Client ${sellerId} initializing, returning pending`);
      return { qrCode: null, status: 'initializing', message: 'Connection in progress' };
    }
  }

  // Clean up any lock files before creating new client
  cleanupLockFiles(sellerId);

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
        
        // Force full cleanup including session data on critical errors
        if (err.message?.includes('detached Frame') || 
            err.message?.includes('Execution context') || 
            err.message?.includes('Protocol error') ||
            err.message?.includes('Target closed')) {
          console.log(`[WhatsApp] Critical initialization error, clearing session data for ${sellerId}...`);
          await forceCleanupClient(sellerId);
          // Also clear the session directory completely
          clearSessionData(sellerId);
          if (!qrResolved) {
            reject(new Error('WhatsApp session corrupted. Session cleared. Please try again.'));
          }
        } else {
          cleanupClient(sellerId);
          if (!qrResolved) {
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
