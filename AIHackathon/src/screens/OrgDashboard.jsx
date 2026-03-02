import React, { useState, useEffect, useRef } from 'react';
import './OrgDashboard.css';
import SellerConversationView from './SellerConversationView';

const API_BASE_URL = 'http://localhost:3001/api';

const OrgDashboard = ({ onLogout, sellerId, sellerData }) => {
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [promptText, setPromptText] = useState(`Act as a senior technical sales engineer for eIndia. Your goal is to assist engineers and procurement managers in finding the right electronic components. Always verify stock availability before making commitments. Provide accurate technical specifications and competitive pricing. Be professional, helpful, and concise in your responses.`);
  const [isAgentActive, setIsAgentActive] = useState(true);
  
  // WhatsApp integration state
  const [whatsappStatus, setWhatsappStatus] = useState('disconnected'); // 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
  const [qrCode, setQrCode] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState(null);
  
  // WhatsApp number configuration
  const [recipientNumber, setRecipientNumber] = useState('');
  const [showNumberConfig, setShowNumberConfig] = useState(false);
  
  // Connection notification
  const [showConnectionSuccess, setShowConnectionSuccess] = useState(false);
  
  const [stats, setStats] = useState({
    totalQueries: 0,
    resolvedQueries: 0,
    ordersPlaced: 0,
    orderVolume: 0,
    conversionRate: '0%'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Navigation state
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'products' | 'conversations'
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Conversations state
  const [conversations, setConversations] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [showConversationModal, setShowConversationModal] = useState(false);
  
   // Add Products state
   const [dbConnectionType, setDbConnectionType] = useState('api');
   const [uploadProgress, setUploadProgress] = useState(null);
   const [isDragging, setIsDragging] = useState(false);
   const fileInputRef = useRef(null);
   const [recentIngestions, setRecentIngestions] = useState([
    {
      id: 1,
      source: 'q4_inventory_update.xlsx',
      method: 'Direct Upload',
      status: 'Processing',
      records: '--',
      timestamp: 'Just now'
    },
    {
      id: 2,
      source: 'Primary Warehouse DB',
      method: 'PostgreSQL Connect',
      status: 'Synced',
      records: '12,405 SKUs',
      timestamp: '2 hrs ago'
    },
    {
      id: 3,
      source: 'legacy_parts_list.pdf',
      method: 'Direct Upload',
      status: 'Synced',
      records: '450 SKUs',
      timestamp: 'Yesterday'
    }
  ]);

  // Fetch seller stats from API
  useEffect(() => {
    const fetchSellerStats = async () => {
      if (!sellerId) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/seller/stats/${sellerId}`);
        const data = await response.json();

        if (data.success) {
          const volume = data.stats.orderVolume || 0;
          const formattedVolume = volume >= 1000 
            ? `$${(volume / 1000).toFixed(1)}k` 
            : `$${volume}`;

          setStats({
            totalQueries: data.stats.totalQueries || 0,
            resolvedQueries: data.stats.resolvedQueries || 0,
            ordersPlaced: data.stats.ordersPlaced || 0,
            orderVolume: formattedVolume,
            conversionRate: data.stats.conversionRate || '0%'
          });
        }
      } catch (err) {
        console.error('Failed to fetch seller stats:', err);
        setError('Failed to load stats from server');
      } finally {
        setLoading(false);
      }
    };

    fetchSellerStats();
  }, [sellerId]);

  // Format relative time
  const formatRelativeTime = (dateString) => {
    if (!dateString) return 'Just now';
    
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Just now';
    }
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  // Get initials from email
  const getInitialsFromEmail = (email) => {
    if (!email) return 'U';
    const namePart = email.split('@')[0];
    return namePart.substring(0, 2).toUpperCase();
  };

  // Get first user message from conversation
  const getFirstUserMessage = (conversation) => {
    if (!conversation.messages || conversation.messages.length === 0) return 'No message';
    // Find first user/customer message
    const userMsg = conversation.messages.find(m => 
      m.role === 'Customer' || m.role === 'user' || m.type === 'user'
    );
    return userMsg ? userMsg.content : conversation.messages[0].content;
  };

  // Get status based on conversation data
  const getInquiryStatus = (conversation) => {
    if (conversation.whatsappNotified) {
      return { text: 'NOTIFIED', color: 'green' };
    }
    if (conversation.extractedInfo?.purchaseIntent === 'yes') {
      return { text: 'HIGH INTENT', color: 'green' };
    }
    if (conversation.extractedInfo?.wantsHuman) {
      return { text: 'NEEDS HUMAN', color: 'yellow' };
    }
    return { text: 'NEW REQUEST', color: 'blue' };
  };

  const topComponents = [
    { name: 'ESP32-WROOM', queries: 1240, percentage: 85 },
    { name: 'Arduino Uno R3', queries: 980, percentage: 65 }
  ];

  const handleEditPrompt = () => {
    setIsEditingPrompt(true);
    setIsPromptExpanded(true);
  };

  const handleUpdateAgent = async () => {
    setIsEditingPrompt(false);
    
    if (!sellerId) {
      alert('Seller ID not found');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/seller/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId, prompt: promptText })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('Prompt saved to backend:', promptText);
      } else {
        console.error('Failed to save prompt:', data.error);
      }
    } catch (err) {
      console.error('Error saving prompt:', err);
    }
  };

  // Load seller prompt on mount
  useEffect(() => {
    const loadSellerPrompt = async () => {
      if (!sellerId) return;
      
      try {
        const response = await fetch(`${API_BASE_URL}/seller/prompt/${sellerId}`);
        const data = await response.json();
        
        if (data.prompt) {
          setPromptText(data.prompt);
        }
      } catch (err) {
        console.error('Failed to load seller prompt:', err);
      }
    };
    
    loadSellerPrompt();
  }, [sellerId]);

  // Check WhatsApp status on mount and auto-restore connection
  useEffect(() => {
    const checkWhatsappStatus = async () => {
      if (!sellerId) return;
      
      try {
        const response = await fetch(`${API_BASE_URL}/whatsapp/status/${sellerId}`);
        const data = await response.json();
        
        setWhatsappStatus(data.status);
        if (data.phoneNumber) {
          setWhatsappPhone(data.phoneNumber);
        }
        
        // If backend has session but client needs reconnect, try to restore
        if (data.status === 'disconnected') {
          await attemptAutoReconnect();
        }
      } catch (err) {
        console.error('Failed to check WhatsApp status:', err);
      }
    };
    
    // Attempt to auto-restore WhatsApp connection
    const attemptAutoReconnect = async () => {
      const savedConfig = localStorage.getItem(`eindia_whatsapp_${sellerId}`);
      if (!savedConfig) return;
      
      try {
        const config = JSON.parse(savedConfig);
        const lastConnected = config.lastConnected ? new Date(config.lastConnected) : null;
        const hoursSinceConnection = lastConnected ? (Date.now() - lastConnected.getTime()) / (1000 * 60 * 60) : Infinity;
        
        // Only auto-restore if connected within last 24 hours
        if (hoursSinceConnection < 24) {
          console.log('[WhatsApp] Attempting auto-restore...');
          
          const response = await fetch(`${API_BASE_URL}/whatsapp/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sellerId })
          });
          
          const data = await response.json();
          
          if (data.status === 'ready' || data.status === 'connected') {
            console.log('[WhatsApp] Auto-restore successful!');
            setWhatsappStatus('connected');
            if (data.phoneNumber) {
              setWhatsappPhone(data.phoneNumber);
            }
          }
        }
      } catch (err) {
        console.log('[WhatsApp] Auto-restore failed:', err);
      }
    };
    
    // Load saved WhatsApp config from localStorage and backend
    const loadWhatsappConfig = async () => {
      if (!sellerId) return;
      
      // First try localStorage for instant loading
      const savedConfig = localStorage.getItem(`eindia_whatsapp_${sellerId}`);
      if (savedConfig) {
        try {
          const config = JSON.parse(savedConfig);
          if (config.recipientNumber) {
            setRecipientNumber(config.recipientNumber);
          }
          if (config.phoneNumber) {
            setWhatsappPhone(config.phoneNumber);
          }
        } catch (e) {
          console.error('Failed to parse saved WhatsApp config:', e);
        }
      }
      
      // Then fetch from backend to ensure sync
      try {
        const response = await fetch(`${API_BASE_URL}/whatsapp/config/${sellerId}`);
        const data = await response.json();
        
        if (data.senderNumber) {
          setWhatsappPhone(data.senderNumber);
        }
        if (data.recipientNumber) {
          setRecipientNumber(data.recipientNumber);
          // Update localStorage with backend data
          saveWhatsappConfigToLocal(data.recipientNumber, data.senderNumber);
        }
      } catch (err) {
        console.error('Failed to load WhatsApp config:', err);
      }
    };
    
    // Save config to localStorage
    const saveWhatsappConfigToLocal = (recipient, sender) => {
      const config = {
        recipientNumber: recipient,
        phoneNumber: sender || whatsappPhone,
        lastConnected: new Date().toISOString()
      };
      localStorage.setItem(`eindia_whatsapp_${sellerId}`, JSON.stringify(config));
    };
    
    checkWhatsappStatus();
    loadWhatsappConfig();
  }, [sellerId]);

  // Save WhatsApp config to localStorage whenever it changes
  useEffect(() => {
    if (!sellerId) return;
    
    const config = {
      recipientNumber,
      phoneNumber: whatsappPhone,
      lastConnected: new Date().toISOString()
    };
    localStorage.setItem(`eindia_whatsapp_${sellerId}`, JSON.stringify(config));
  }, [recipientNumber, whatsappPhone, sellerId]);

  const handleCancelEdit = () => {
    setIsEditingPrompt(false);
  };

  // WhatsApp connection handlers
  const handleConnectWhatsapp = async () => {
    if (!sellerId) {
      alert('Seller ID not found');
      return;
    }

    setWhatsappStatus('connecting');
    setShowQrModal(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/whatsapp/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId })
      });
      
      const data = await response.json();
      
      if (data.status === 'ready') {
        setWhatsappStatus('connected');
        setShowQrModal(false);
        if (data.phoneNumber) {
          setWhatsappPhone(data.phoneNumber);
        }
      } else if (data.qrCode) {
        setQrCode(data.qrCode);
        setWhatsappStatus('qr_ready');
      } else if (data.status === 'initializing') {
        // Poll for QR code
        pollForQrCode();
      }
    } catch (err) {
      console.error('Failed to connect WhatsApp:', err);
      setWhatsappStatus('disconnected');
      alert('Failed to initialize WhatsApp. Please try again.');
    }
  };

  const pollForQrCode = async () => {
    const maxAttempts = 120; // 4 minutes max (increased for 10s initialization delay)
    let attempts = 0;
    let connectionEstablished = false;
    
    const interval = setInterval(async () => {
      attempts++;
      console.log(`[WhatsApp Poll] Attempt ${attempts}, status: checking...`);
      
      try {
        const response = await fetch(`${API_BASE_URL}/whatsapp/status/${sellerId}`);
        const data = await response.json();
        
        console.log(`[WhatsApp Poll] Status: ${data.status}, connected: ${data.connected}, phone: ${data.phoneNumber}`);
        
        if (data.status === 'ready' && data.connected && !connectionEstablished) {
          console.log('[WhatsApp Poll] ✅ Connection ready! Updating UI...');
          connectionEstablished = true;
          clearInterval(interval);
          
          // Update status and phone first
          setWhatsappStatus('connected');
          if (data.phoneNumber) {
            setWhatsappPhone(data.phoneNumber);
          }
          
          // Show success notification
          setShowConnectionSuccess(true);
          
          // Close modal after a short delay so user sees the success state
          setTimeout(() => {
            setShowQrModal(false);
            setQrCode(null);
          }, 2000);
          
        } else if (data.qrCode && !qrCode) {
          console.log('[WhatsApp Poll] QR code available - displaying');
          setQrCode(data.qrCode);
          setWhatsappStatus('qr_ready');
        } else if (attempts >= maxAttempts) {
          console.log(`[WhatsApp Poll] Timeout after ${attempts} attempts`);
          clearInterval(interval);
          if (!connectionEstablished) {
            setWhatsappStatus('disconnected');
            setShowQrModal(false);
            setQrCode(null);
            alert('⏱️ WhatsApp connection timed out. Please try again.');
          }
        }
      } catch (err) {
        console.error('[WhatsApp Poll] Error:', err);
        // Don't stop polling on error, keep trying
      }
    }, 2000);
  };

  const handleSaveWhatsappConfig = async () => {
    if (!sellerId) return;
    
    // Format the recipient number - add country code if missing
    let formattedNumber = recipientNumber.replace(/\D/g, '');
    if (formattedNumber.length === 10) {
      console.log('[Config Save] Adding India country code (+91) to number');
      formattedNumber = '91' + formattedNumber;
    }
    
    // Validate number format
    if (formattedNumber.length < 10) {
      alert('Please enter a valid phone number with at least 10 digits');
      return;
    }
    
    // First check if WhatsApp is actually connected
    try {
      const statusResponse = await fetch(`${API_BASE_URL}/whatsapp/status/${sellerId}`);
      const statusData = await statusResponse.json();
      
      console.log('[Config Save] WhatsApp status before saving:', statusData);
      
      if (!statusData.connected) {
        alert('WhatsApp is not connected. Please scan the QR code and wait for the connection to be established before saving the recipient number.');
        return;
      }
      
      // Update the phone number in state
      if (statusData.phoneNumber) {
        setWhatsappPhone(statusData.phoneNumber);
      }
    } catch (err) {
      console.error('[Config Save] Failed to check status:', err);
      alert('Could not verify WhatsApp connection. Please try again.');
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/whatsapp/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sellerId, 
          recipientNumber: formattedNumber,
          sendTest: true // Send test message to verify setup
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setShowNumberConfig(false);
        if (data.testMessage?.success) {
          alert('✅ WhatsApp configuration saved! Test message sent successfully. Check your WhatsApp!');
        } else if (data.warning) {
          alert(`⚠️ Configuration saved but test message failed: ${data.warning}`);
        } else {
          alert('WhatsApp configuration saved successfully!');
        }
      }
    } catch (err) {
      console.error('Failed to save WhatsApp config:', err);
      alert('Failed to save configuration. Please try again.');
    }
  };

  const handleDisconnectWhatsapp = async () => {
    if (!sellerId) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/whatsapp/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setWhatsappStatus('disconnected');
        setQrCode(null);
        setWhatsappPhone(null);
      }
    } catch (err) {
      console.error('Failed to disconnect WhatsApp:', err);
    }
  };

  // Fetch conversations from DB
  const fetchConversations = async () => {
    if (!sellerId) return;
    
    setConversationsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/seller-user-chat/conversations/${sellerId}`);
      const data = await response.json();
      
      if (data.success) {
        setConversations(data.conversations || []);
      } else {
        console.error('Failed to fetch conversations:', data.error);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setConversationsLoading(false);
    }
  };

  // Load conversations when tab changes or on dashboard mount
  useEffect(() => {
    if (activeTab === 'conversations' || activeTab === 'dashboard') {
      fetchConversations();
      // Poll for new conversations every 30 seconds
      const interval = setInterval(fetchConversations, 30000);
      return () => clearInterval(interval);
    }
  }, [activeTab, sellerId]);

  const handleViewConversation = (conversation) => {
    setSelectedConversation(conversation);
    setShowConversationModal(true);
  };

  const handleCloseConversation = () => {
    setShowConversationModal(false);
    setSelectedConversation(null);
  };

  // Render full-screen conversation view
  const renderConversationView = () => {
    if (!showConversationModal || !selectedConversation) return null;
    
    return (
      <SellerConversationView
        conversation={selectedConversation}
        sellerData={sellerData}
        sellerId={sellerId}
        onClose={handleCloseConversation}
      />
    );
  };

  const handleSimulateOrder = async () => {
    if (!sellerId) {
      alert('Seller ID not found');
      return;
    }

    const orderAmount = Math.floor(Math.random() * 500) + 100;
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/seller-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId, orderAmount })
      });
      
      const data = await response.json();
      
      if (data.success) {
        const volume = data.stats.orderVolume || 0;
        const formattedVolume = volume >= 1000 
          ? `$${(volume / 1000).toFixed(1)}k` 
          : `$${volume}`;
          
        setStats(prev => ({
          ...prev,
          ordersPlaced: data.stats.ordersPlaced,
          orderVolume: formattedVolume
        }));
        
        alert(`Order placed! Amount: $${orderAmount}. Total orders: ${data.stats.ordersPlaced}`);
      }
    } catch (err) {
      console.error('Failed to place order:', err);
      alert('Failed to place order. Check console for details.');
    }
  };

  // File upload handlers
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      uploadFile(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      uploadFile(file);
    }
  };

  const uploadFile = async (file) => {
    // Validate file type
    const validTypes = ['.csv', '.xlsx', '.xls', '.pdf'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    if (!validTypes.includes(fileExt)) {
      alert('Please upload a CSV, Excel, or PDF file');
      return;
    }

    // Validate file size (25MB)
    if (file.size > 25 * 1024 * 1024) {
      alert('File size must be less than 25MB');
      return;
    }

    setUploadProgress({ filename: file.name, percent: 0 });

    // Simulate upload progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        
        // Add to recent ingestions after upload
        setTimeout(() => {
          const newIngestion = {
            id: Date.now(),
            source: file.name,
            method: 'Direct Upload',
            status: 'Processing',
            records: '--',
            timestamp: 'Just now'
          };
          setRecentIngestions(prev => [newIngestion, ...prev]);
          setUploadProgress(null);
        }, 500);
      }
      setUploadProgress({ filename: file.name, percent: Math.floor(progress) });
    }, 200);
  };

  // Render Conversations section
  const renderConversations = () => (
    <div className="conversations-section">
      <div className="add-products-header">
        <h1>Customer Conversations</h1>
        <p>View and manage real-time conversations between your AI agent and potential customers.</p>
      </div>

      {conversationsLoading ? (
        <div className="chat-loading" style={{ padding: '40px', textAlign: 'center' }}>
          <div className="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <p>Loading conversations...</p>
        </div>
      ) : conversations.length === 0 ? (
        <div className="no-conversations" style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ marginBottom: '16px', opacity: 0.5 }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <h3>No conversations yet</h3>
          <p>Customer conversations will appear here once they start chatting with your AI agent.</p>
        </div>
      ) : (
        <div className="conversations-list">
          {conversations.map((conv) => (
            <div key={conv.chatId} className="conversation-card" onClick={() => handleViewConversation(conv)}>
              <div className="conversation-header">
                <div className="conversation-user">
                  <div className="user-avatar-org">{conv.userEmail?.charAt(0).toUpperCase() || 'U'}</div>
                  <div className="user-info">
                    <span className="user-name">{conv.userEmail?.split('@')[0] || 'Anonymous User'}</span>
                    <span className="user-company">@{conv.userEmail?.split('@')[1] || 'email.com'}</span>
                  </div>
                </div>
                <div className="conversation-meta">
                  <span className={`status-badge ${conv.whatsappNotified ? 'green' : 'yellow'}`}>
                    {conv.whatsappNotified ? 'NOTIFIED' : 'ACTIVE'}
                  </span>
                  <span className="inquiry-time">
                    {conv.createdAt && !isNaN(new Date(conv.createdAt).getTime()) 
                      ? new Date(conv.createdAt).toLocaleString() 
                      : 'Just now'}
                  </span>
                </div>
              </div>

              <div className="conversation-preview">
                <div className="product-info">
                  <span className="component-tag">{conv.productData?.product_title || 'Unknown Product'}</span>
                  <span className="product-price">{conv.productData?.price || 'N/A'}</span>
                </div>
                <p className="last-message">
                  {conv.messages?.length > 0 
                    ? conv.messages[conv.messages.length - 1].content.substring(0, 100) + '...'
                    : 'No messages yet'}
                </p>
              </div>

              {conv.extractedInfo && Object.keys(conv.extractedInfo).length > 0 && (
                <div className="extracted-info">
                  {conv.extractedInfo.wantsHuman && <span className="info-tag">🙋 Wants Human</span>}
                  {conv.extractedInfo.address && <span className="info-tag">📍 Address Available</span>}
                  {conv.extractedInfo.bargainPrice && <span className="info-tag">💰 Bargain: {conv.extractedInfo.bargainPrice}</span>}
                  {conv.extractedInfo.purchaseIntent && <span className="info-tag">🛒 Purchase Intent</span>}
                </div>
              )}

              <div className="conversation-footer">
                <span>{conv.messages?.length || 0} messages</span>
                <button className="btn btn-primary btn-sm">View Full Conversation</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Conversation Detail Modal */}
      {showConversationModal && selectedConversation && (
        <div className="qr-modal-overlay" onClick={handleCloseConversation}>
          <div className="qr-modal conversation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="qr-modal-header">
              <h3>Conversation with {selectedConversation.userEmail?.split('@')[0] || 'Anonymous'}</h3>
              <button className="qr-modal-close" onClick={handleCloseConversation}>×</button>
            </div>
            <div className="qr-modal-content conversation-detail-content">
              <div className="conversation-product-info">
                <h4>{selectedConversation.productData?.product_title}</h4>
                <p>Price: {selectedConversation.productData?.price}</p>
                <p>Status: <span className={`status-badge ${selectedConversation.whatsappNotified ? 'green' : 'yellow'}`}>
                  {selectedConversation.whatsappNotified ? 'WhatsApp Notified' : 'Active'}
                </span></p>
              </div>
              
              <div className="conversation-messages">
                {selectedConversation.messages?.map((msg, idx) => (
                  <div key={idx} className={`message-detail ${msg.role.toLowerCase()}`}>
                    <div className="message-header">
                      <span className="message-sender">{msg.role}</span>
                      <span className="message-time">
                        {msg.timestamp ? new Date(msg.timestamp).toLocaleString() : 'Unknown time'}
                      </span>
                    </div>
                    <p className="message-content">{msg.content}</p>
                  </div>
                ))}
              </div>

              {selectedConversation.extractedInfo && Object.keys(selectedConversation.extractedInfo).length > 0 && (
                <div className="extracted-info-detail">
                  <h4>Extracted Information</h4>
                  <pre>{JSON.stringify(selectedConversation.extractedInfo, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Render Add Products section
  const renderAddProducts = () => (
    <div className="add-products-section">
      <div className="add-products-header">
        <h1>Add Products</h1>
        <p>Ingest your product catalog to power eIndia's AI discovery engine. Connect a database or upload files directly.</p>
      </div>

      <div className="add-products-grid">
        {/* Database Connector Card */}
        <div className="connector-card">
          <div className="connector-card-header">
            <div className="connector-icon db-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
              </svg>
            </div>
            <h3>Database Connector</h3>
          </div>
          <p className="connector-description">
            Connect your existing inventory database for real-time synchronization. We support read-only access patterns.
          </p>

          <div className="connection-options">
            <label className={`radio-option ${dbConnectionType === 'api' ? 'selected' : ''}`}>
              <input 
                type="radio" 
                name="dbType" 
                value="api"
                checked={dbConnectionType === 'api'}
                onChange={(e) => setDbConnectionType(e.target.value)}
              />
              <span className="radio-dot"></span>
              <span>API Integration (REST/GraphQL)</span>
            </label>

            <label className={`radio-option ${dbConnectionType === 'postgres' ? 'selected' : ''}`}>
              <input 
                type="radio" 
                name="dbType" 
                value="postgres"
                checked={dbConnectionType === 'postgres'}
                onChange={(e) => setDbConnectionType(e.target.value)}
              />
              <span className="radio-dot"></span>
              <span>PostgreSQL Database</span>
            </label>

            <label className={`radio-option ${dbConnectionType === 'mongo' ? 'selected' : ''}`}>
              <input 
                type="radio" 
                name="dbType" 
                value="mongo"
                checked={dbConnectionType === 'mongo'}
                onChange={(e) => setDbConnectionType(e.target.value)}
              />
              <span className="radio-dot"></span>
              <span>MongoDB Cluster</span>
            </label>
          </div>

          <button className="btn btn-primary setup-connection-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
            Setup Connection
          </button>
        </div>

        {/* Document Upload Card */}
        <div className="connector-card">
          <div className="connector-card-header">
            <div className="connector-icon upload-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </div>
            <h3>Document Upload</h3>
          </div>
          <p className="connector-description">
            Manually upload product catalogs. Our AI will parse specifications, prices, and stock levels automatically.
          </p>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".csv,.xlsx,.xls,.pdf"
            style={{ display: 'none' }}
          />
          <div 
            className={`upload-area ${isDragging ? 'dragging' : ''}`}
            onClick={handleUploadClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="upload-cloud-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
              </svg>
            </div>
            <p className="upload-text">Click to upload or drag and drop</p>
            <p className="upload-formats">CSV, Excel, or PDF (max 25MB)</p>
          </div>

          {uploadProgress && (
            <div className="upload-progress">
              <div className="upload-progress-header">
                <span className="upload-filename">{uploadProgress.filename}</span>
                <span className="upload-status">Uploading {uploadProgress.percent}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${uploadProgress.percent}%` }}></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Ingestions Table */}
      <div className="ingestions-section">
        <div className="ingestions-header">
          <h2>Recent Ingestions</h2>
          <a href="#history" className="view-history-link">
            View All History
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7"></path>
            </svg>
          </a>
        </div>

        <div className="ingestions-table-container">
          <table className="ingestions-table">
            <thead>
              <tr>
                <th>Source / File Name</th>
                <th>Method</th>
                <th>Status</th>
                <th>Records</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {recentIngestions.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="source-cell">
                      <div className="source-icon">
                        {item.method.includes('PostgreSQL') ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                          </svg>
                        ) : item.source.endsWith('.pdf') ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                          </svg>
                        )}
                      </div>
                      <span>{item.source}</span>
                    </div>
                  </td>
                  <td>{item.method}</td>
                  <td>
                    <span className={`status-badge-ingestion ${item.status.toLowerCase()}`}>
                      {item.status === 'Processing' && <span className="status-dot"></span>}
                      {item.status === 'Synced' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                      {item.status}
                    </span>
                  </td>
                  <td>{item.records}</td>
                  <td>{item.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Close mobile menu when tab changes
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="org-dashboard">
      <nav className="org-navbar">
        <div className="navbar-brand">
          <div className="navbar-logo-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <span className="navbar-logo-text">eIndia</span>
        </div>
        
        {/* Desktop Navigation */}
        <div className="navbar-nav desktop-nav">
          <button 
            className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={`nav-tab ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            Add Products
          </button>
          <button 
            className={`nav-tab ${activeTab === 'conversations' ? 'active' : ''}`}
            onClick={() => setActiveTab('conversations')}
          >
            Customer Conversations
          </button>
        </div>

        {/* Mobile Hamburger Button */}
        <button 
          className="mobile-menu-btn"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {isMobileMenuOpen ? (
              <path d="M18 6L6 18M6 6l12 12" />
            ) : (
              <path d="M3 12h18M3 6h18M3 18h18" />
            )}
          </svg>
        </button>
        
        <div className="navbar-actions desktop-actions">
          <button className="btn btn-secondary" onClick={onLogout}>
            Log Out
          </button>
        </div>
      </nav>

      {/* Mobile Navigation Drawer */}
      <div className={`mobile-nav-drawer ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="mobile-nav-header">
          <span className="mobile-nav-title">Menu</span>
          <button 
            className="mobile-nav-close"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mobile-nav-links">
          <button 
            className={`mobile-nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleTabChange('dashboard')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            Dashboard
          </button>
          <button 
            className={`mobile-nav-tab ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => handleTabChange('products')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Add Products
          </button>
          <button 
            className={`mobile-nav-tab ${activeTab === 'conversations' ? 'active' : ''}`}
            onClick={() => handleTabChange('conversations')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            Customer Conversations
          </button>
        </div>
        <div className="mobile-nav-footer">
          <button className="btn btn-secondary btn-full" onClick={onLogout}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Log Out
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="mobile-nav-overlay"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {renderConversationView()}
      
      <main className="org-main">
        {activeTab === 'products' ? renderAddProducts() : 
         activeTab === 'conversations' ? renderConversations() : (
          <>
            {/* Header Section */}
            <div className="org-header">
              <div className="header-content">
                <h1>Organization Dashboard</h1>
                <p>Monitor incoming component requests, configure your AI agent, and track sales performance in real-time.</p>
              </div>
              <div className="header-actions">
                <button className="btn btn-secondary">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  Export Report
                </button>
                <button className="btn btn-primary" onClick={handleSimulateOrder}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="9" cy="21" r="1"></circle>
                    <circle cx="20" cy="21" r="1"></circle>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                  </svg>
                  Simulate Order
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">Total Queries</span>
                  <div className="stat-icon blue">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 3v18h18"></path>
                      <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path>
                    </svg>
                  </div>
                </div>
                <div className="stat-value-row">
                  <span className="stat-value">{stats.totalQueries}</span>
                  <span className="stat-growth">lifetime</span>
                </div>
                <span className="stat-comparison">Product tile clicks</span>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">Resolved Queries</span>
                  <div className="stat-icon green">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                  </div>
                </div>
                <div className="stat-value-row">
                  <span className="stat-value">{stats.resolvedQueries}</span>
                  <span className="stat-rate">{stats.conversionRate} Conv.</span>
                </div>
                <span className="stat-comparison">WhatsApp notifications sent</span>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">Orders Placed</span>
                  <div className="stat-icon purple">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="9" cy="21" r="1"></circle>
                      <circle cx="20" cy="21" r="1"></circle>
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                    </svg>
                  </div>
                </div>
                <div className="stat-value-row">
                  <span className="stat-value">{stats.ordersPlaced}</span>
                  <span className="stat-volume">{stats.orderVolume} Vol</span>
                </div>
                <span className="stat-comparison">Total order volume</span>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="content-grid">
              {/* Left Column - Inquiries */}
              <div className="inquiries-section">
                <div className="section-header">
                  <h2>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    Recent User Inquiries
                  </h2>
                  <button className="view-all" onClick={() => setActiveTab('conversations')}>View All</button>
                </div>

                <div className="inquiries-list">
                  {conversationsLoading ? (
                    <div className="chat-loading" style={{ padding: '20px', textAlign: 'center' }}>
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                      <p>Loading inquiries...</p>
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="no-conversations" style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ marginBottom: '16px', opacity: 0.5 }}>
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      </svg>
                      <p>No inquiries yet</p>
                      <p style={{ fontSize: '14px', marginTop: '8px' }}>Customer inquiries will appear here once they start chatting</p>
                    </div>
                  ) : (
                    conversations.slice(0, 5).map((conversation) => {
                      const status = getInquiryStatus(conversation);
                      const firstMessage = getFirstUserMessage(conversation);
                      const hasExtractedInfo = conversation.extractedInfo && Object.keys(conversation.extractedInfo).length > 0;
                      
                      return (
                        <div key={conversation.chatId} className="inquiry-card" onClick={() => handleViewConversation(conversation)}>
                          <div className="inquiry-header">
                            <div className="inquiry-user">
                              <div className="user-avatar-org">{getInitialsFromEmail(conversation.userEmail)}</div>
                              <div className="user-info">
                                <span className="user-name">{conversation.userEmail?.split('@')[0] || 'Anonymous'}</span>
                                <span className="user-company">@ {conversation.userEmail?.split('@')[1] || 'email.com'}</span>
                              </div>
                            </div>
                            <div className="inquiry-meta">
                              <span className={`status-badge ${status.color}`}>{status.text}</span>
                              <span className="inquiry-time">{formatRelativeTime(conversation.createdAt)}</span>
                            </div>
                          </div>

                          <div className="inquiry-message">
                            "{firstMessage.substring(0, 150)}{firstMessage.length > 150 ? '...' : ''}"
                          </div>

                          {conversation.productData?.product_title && (
                            <div className="component-detected">
                              <span>Product:</span>
                              <span className="component-tag">{conversation.productData.product_title}</span>
                            </div>
                          )}

                          {hasExtractedInfo && (
                            <div className="ai-suggestion">
                              <div className="ai-suggestion-header">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path>
                                </svg>
                                EXTRACTED INSIGHTS
                              </div>
                              <div className="extracted-info" style={{ marginTop: '8px' }}>
                                {conversation.extractedInfo.purchaseIntent && (
                                  <span className="info-tag">🛒 Intent: {conversation.extractedInfo.purchaseIntent}</span>
                                )}
                                {conversation.extractedInfo.bargainPrice && (
                                  <span className="info-tag">💰 Bargain: {conversation.extractedInfo.bargainPrice}</span>
                                )}
                                {conversation.extractedInfo.wantsHuman && (
                                  <span className="info-tag">🙋 Wants Human</span>
                                )}
                                {conversation.extractedInfo.customerAddress && (
                                  <span className="info-tag">📍 Address Shared</span>
                                )}
                              </div>
                              <div className="ai-suggestion-actions">
                                <button className="btn btn-primary btn-sm" onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewConversation(conversation);
                                }}>View Conversation</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column - AI Agent & Stats */}
              <div className="sidebar">
                {/* AI Agent Setup */}
                <div className="agent-setup-card">
                  <div className="agent-setup-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="4" y1="21" x2="4" y2="14"></line>
                      <line x1="4" y1="10" x2="4" y2="3"></line>
                      <line x1="12" y1="21" x2="12" y2="12"></line>
                      <line x1="12" y1="8" x2="12" y2="3"></line>
                      <line x1="20" y1="21" x2="20" y2="16"></line>
                      <line x1="20" y1="12" x2="20" y2="3"></line>
                      <line x1="1" y1="14" x2="7" y2="14"></line>
                      <line x1="9" y1="8" x2="15" y2="8"></line>
                      <line x1="17" y1="16" x2="23" y2="16"></line>
                    </svg>
                    <h3>AI Agent Setup</h3>
                  </div>
                  <p className="agent-setup-description">
                    Configure the persona and instructions for your organization's automated response agent.
                  </p>

                  <div className="prompt-section">
                    <label className="prompt-label">DEFAULT INITIAL PROMPT</label>
                    
                    {isEditingPrompt ? (
                      <div className="prompt-edit-container">
                        <textarea
                          className="prompt-textarea"
                          value={promptText}
                          onChange={(e) => setPromptText(e.target.value)}
                          rows={8}
                        />
                        <div className="prompt-edit-actions">
                          <button className="btn btn-secondary btn-sm" onClick={handleCancelEdit}>
                            Cancel
                          </button>
                          <button className="btn btn-primary btn-sm" onClick={handleUpdateAgent}>
                            Save Changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div 
                          className={`prompt-box ${isPromptExpanded ? 'expanded' : ''}`}
                          onClick={() => setIsPromptExpanded(!isPromptExpanded)}
                        >
                          <p>{promptText}</p>
                          {!isPromptExpanded && <div className="prompt-fade"></div>}
                        </div>
                        {isPromptExpanded && (
                          <div className="prompt-actions">
                            <button className="btn btn-secondary btn-sm" onClick={handleEditPrompt}>
                              Edit Prompt
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="agent-controls">
                    <div className="toggle-wrapper">
                      <label className="toggle">
                        <input 
                          type="checkbox" 
                          checked={isAgentActive}
                          onChange={(e) => setIsAgentActive(e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                      <span className="toggle-label">{isAgentActive ? 'Active' : 'Inactive'}</span>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={handleUpdateAgent}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="12" y1="8" x2="12" y2="16"></line>
                        <line x1="8" y1="12" x2="16" y2="12"></line>
                      </svg>
                      Update Agent
                    </button>
                  </div>
                </div>

                {/* WhatsApp Integration */}
                <div className="whatsapp-card">
                  <div className="whatsapp-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                    <h3>WhatsApp Integration</h3>
                  </div>
                  <p className="whatsapp-subtitle">Configure WhatsApp numbers for sending and receiving messages</p>
                  
                  {/* Number Configuration */}
                  <div className="whatsapp-numbers">
                    <div className="number-row">
                      <div className="number-label">
                        <span className="number-icon">📤</span>
                        <div>
                          <span className="number-title">Sender (Bot)</span>
                          <span className="number-desc">Auto-captured from QR scan</span>
                        </div>
                      </div>
                      <span className="number-value">{whatsappPhone || 'Not connected'}</span>
                    </div>
                    
                    <div className="number-row">
                      <div className="number-label">
                        <span className="number-icon">📥</span>
                        <div>
                          <span className="number-title">Recipient</span>
                          <span className="number-desc">Number to receive messages</span>
                        </div>
                      </div>
                      <span className="number-value">{recipientNumber || 'Not set'}</span>
                    </div>
                    
                    <button 
                      className="btn btn-secondary btn-sm config-numbers-btn"
                      onClick={() => setShowNumberConfig(true)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                      Configure Recipient
                    </button>
                  </div>
                  
                  <div className="whatsapp-status">
                    <div className={`status-indicator ${whatsappStatus}`}>
                      <span className="status-dot"></span>
                      <span className="status-text">
                        {whatsappStatus === 'disconnected' && 'Not Connected'}
                        {whatsappStatus === 'connecting' && 'Connecting...'}
                        {whatsappStatus === 'qr_ready' && 'QR Code Ready'}
                        {whatsappStatus === 'connected' && `Connected ${whatsappPhone ? `(${whatsappPhone})` : ''}`}
                      </span>
                    </div>
                  </div>

                  <div className="whatsapp-actions">
                    {whatsappStatus === 'disconnected' ? (
                      <button className="btn btn-primary btn-sm whatsapp-connect-btn" onClick={handleConnectWhatsapp}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                        </svg>
                        Connect WhatsApp
                      </button>
                    ) : (
                      <button className="btn btn-secondary btn-sm" onClick={handleDisconnectWhatsapp}>
                        Disconnect
                      </button>
                    )}
                  </div>
                </div>

                {/* Number Config Modal */}
                {showNumberConfig && (
                  <div className="qr-modal-overlay" onClick={() => setShowNumberConfig(false)}>
                    <div className="qr-modal number-config-modal" onClick={(e) => e.stopPropagation()}>
                      <div className="qr-modal-header">
                        <h3>Configure Recipient Number</h3>
                        <button className="qr-modal-close" onClick={() => setShowNumberConfig(false)}>×</button>
                      </div>
                      <div className="qr-modal-content">
                        <div className="number-config-form">
                          <div className="form-group">
                            <label>
                              <span className="label-icon">📥</span>
                              Recipient Number
                              <span className="label-hint">Number where you want to receive WhatsApp notifications</span>
                            </label>
                            <input
                              type="tel"
                              placeholder="7015332581 or 917015332581"
                              value={recipientNumber}
                              onChange={(e) => setRecipientNumber(e.target.value)}
                            />
                            <span className="input-hint">
                              Enter 10 digits (we'll add +91) or full number with country code (e.g., 917015332581)
                            </span>
                          </div>
                          
                          <div className="info-box">
                            <p><strong>Note:</strong> The sender number is automatically captured when you scan the QR code with WhatsApp. You don't need to enter it manually.</p>
                          </div>
                          
                          <div className="number-config-actions">
                            <button className="btn btn-secondary" onClick={() => setShowNumberConfig(false)}>
                              Cancel
                            </button>
                            <button className="btn btn-primary" onClick={handleSaveWhatsappConfig}>
                              Save Recipient
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* QR Code Modal */}
                {showQrModal && (
                  <div className="qr-modal-overlay" onClick={() => !showConnectionSuccess && setShowQrModal(false)}>
                    <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
                      <div className="qr-modal-header">
                        <h3>Connect WhatsApp</h3>
                        {!showConnectionSuccess && (
                          <button className="qr-modal-close" onClick={() => setShowQrModal(false)}>×</button>
                        )}
                      </div>
                      <div className="qr-modal-content">
                        {showConnectionSuccess && (
                          <div className="qr-success">
                            <div className="success-icon">✅</div>
                            <h4>WhatsApp Connected!</h4>
                            <p className="success-phone">{whatsappPhone}</p>
                            <p className="success-message">You can now configure the recipient number to receive notifications.</p>
                          </div>
                        )}
                        
                        {!showConnectionSuccess && whatsappStatus === 'connecting' && !qrCode && (
                          <div className="qr-loading">
                            <div className="spinner"></div>
                            <p>Generating QR code...</p>
                            <p className="qr-hint">Please wait while we connect to WhatsApp</p>
                          </div>
                        )}
                        
                        {!showConnectionSuccess && qrCode && (
                          <>
                            <div className="qr-code-container">
                              <img src={qrCode} alt="WhatsApp QR Code" />
                            </div>
                            <div className="qr-instructions">
                              <p><strong>Scan this QR code with WhatsApp:</strong></p>
                              <ol>
                                <li>Open WhatsApp on your phone</li>
                                <li>Tap Settings → Linked Devices</li>
                                <li>Tap "Link a Device"</li>
                                <li>Point your camera at the QR code</li>
                              </ol>
                              <p className="qr-note">The connection will be established once you scan the code.</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Most In Demand */}
                <div className="demand-card">
                  <div className="demand-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                      <polyline points="17 6 23 6 23 12"></polyline>
                    </svg>
                    <h3>Most In Demand</h3>
                  </div>
                  <p className="demand-subtitle">TOP COMPONENTS (7 DAYS)</p>
                  
                  <div className="demand-list">
                    {topComponents.map((component, index) => (
                      <div key={index} className="demand-item">
                        <div className="demand-item-header">
                          <span className="demand-name">{component.name}</span>
                          <span className="demand-queries">{component.queries.toLocaleString()} queries</span>
                        </div>
                        <div className="demand-bar">
                          <div 
                            className="demand-bar-fill" 
                            style={{ width: `${component.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default OrgDashboard;