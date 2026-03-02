import React, { useState, useRef, useEffect } from 'react';
import './SellerConversationView.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const SellerConversationView = ({ conversation, sellerData, onClose, sellerId }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Handle close with animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 250); // Match CSS animation duration
  };

  // Extract conversation data
  const customerEmail = conversation?.userEmail || 'anonymous@user.com';
  const customerName = customerEmail.split('@')[0];
  const customerDomain = customerEmail.split('@')[1] || 'email.com';
  const productData = conversation?.productData || {};
  const extractedInfo = conversation?.extractedInfo || {};
  
  // Format messages on mount
  useEffect(() => {
    if (conversation?.messages) {
      const formattedMessages = conversation.messages.map((msg, idx) => ({
        id: idx,
        role: msg.role, // 'Customer' or 'Bot'
        content: msg.content,
        timestamp: msg.timestamp || new Date().toISOString(),
      }));
      setMessages(formattedMessages);
      
      // Generate AI suggestion for latest message if it's from customer
      const lastMsg = formattedMessages[formattedMessages.length - 1];
      if (lastMsg?.role === 'Customer' && !isManualMode) {
        generateAiSuggestion(lastMsg.content, formattedMessages);
      }
    }
  }, [conversation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Generate AI suggestion based on conversation context
  const generateAiSuggestion = async (latestMessage, conversationHistory) => {
    setIsAiLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/seller/chat/suggest-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sellerId,
          conversationHistory: conversationHistory.slice(-10), // Last 10 messages
          latestMessage,
          productData,
          extractedInfo,
          customerInfo: {
            name: customerName,
            email: customerEmail
          }
        })
      });
      
      const data = await response.json();
      if (data.suggestion) {
        setAiSuggestion({
          text: data.suggestion,
          confidence: data.confidence || 95,
          requiresEdit: data.requiresEdit || false
        });
      }
    } catch (err) {
      console.error('Failed to generate AI suggestion:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Handle sending message
  const handleSend = async (text = inputValue) => {
    if (!text.trim()) return;

    const newMessage = {
      id: Date.now(),
      role: 'Bot',
      content: text,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setInputValue('');
    setAiSuggestion(null);
    setIsLoading(true);

    try {
      // Save to DB
      await fetch(`${API_BASE_URL}/seller-user-chat/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: conversation.chatId,
          messages: updatedMessages.map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp
          }))
        })
      });

      // If customer responds, generate new suggestion
      setTimeout(() => {
        // Simulate customer response for demo - in real app, this would be via polling
        setIsLoading(false);
      }, 1000);
    } catch (err) {
      console.error('Failed to send message:', err);
      setIsLoading(false);
    }
  };

  // Handle AI suggestion actions
  const handleSendAiSuggestion = () => {
    if (aiSuggestion?.text) {
      handleSend(aiSuggestion.text);
    }
  };

  const handleEditAiSuggestion = () => {
    if (aiSuggestion?.text) {
      setInputValue(aiSuggestion.text);
      setAiSuggestion(null);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Format relative time
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return '';
    }
    
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  // Get initials from name
  const getInitials = (name) => {
    return name.substring(0, 2).toUpperCase();
  };

  // Group messages by sender
  const groupMessages = (msgs) => {
    const groups = [];
    let currentGroup = null;
    
    msgs.forEach((msg) => {
      const isCustomer = msg.role === 'Customer';
      if (!currentGroup || currentGroup.isCustomer !== isCustomer) {
        currentGroup = {
          isCustomer,
          messages: [],
          timestamp: msg.timestamp
        };
        groups.push(currentGroup);
      }
      currentGroup.messages.push(msg);
    });
    
    return groups;
  };

  const messageGroups = groupMessages(messages);

  const quickActions = [
    'Check Stock',
    'Warranty Info',
    'Delivery Time',
    'Bulk Discount'
  ];

  return (
    <div className={`seller-conversation-overlay ${isClosing ? 'closing' : ''}`}>
      {/* Header */}
      <header className="conversation-header">
        <div className="header-left">
          <button className="back-btn" onClick={handleClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          
          <div className="customer-info">
            <div className="customer-avatar">
              <img 
                src={`https://ui-avatars.com/api/?name=${customerName}&background=random&color=fff&size=128`} 
                alt={customerName}
              />
              <span className="online-indicator"></span>
            </div>
            
            <div className="customer-details">
              <div className="customer-name-row">
                <span className="customer-name">{customerName}</span>
                <span className="verified-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                  Verified Buyer
                </span>
              </div>
              <div className="customer-meta">
                Active now • {extractedInfo.location || 'Location unknown'}
              </div>
            </div>
          </div>
        </div>

        <div className="header-center">
          <div className="mode-toggle">
            <button 
              className={`mode-btn ${!isManualMode ? 'active' : ''}`}
              onClick={() => setIsManualMode(false)}
            >
              AI Automated
            </button>
            <button 
              className={`mode-btn ${isManualMode ? 'active' : ''}`}
              onClick={() => setIsManualMode(true)}
            >
              Manual Rep
            </button>
          </div>
        </div>

        <div className="header-right">
          <button className="profile-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            User Profile
          </button>
        </div>
      </header>

      {/* Main Chat Area */}
      <div className="conversation-container">
        {/* Messages */}
        <div className="messages-area" ref={messagesContainerRef}>
          {/* Date Divider */}
          <div className="date-divider">
            <span>Today</span>
          </div>

          {/* Product Context Card */}
          <div className="product-context-banner">
            <span className="context-icon">💬</span>
            <span>Inquiry regarding <strong>{productData.product_title}</strong> from Product Page</span>
          </div>

          {/* Messages */}
          {messageGroups.map((group, groupIndex) => (
            <div key={groupIndex} className={`message-group ${group.isCustomer ? 'customer' : 'seller'}`}>
              {/* Sender Info */}
              <div className="sender-info">
                {group.isCustomer ? (
                  <>
                    <img 
                      className="sender-avatar"
                      src={`https://ui-avatars.com/api/?name=${customerName}&background=random&color=fff&size=64`} 
                      alt={customerName}
                    />
                    <span className="sender-name">{customerName}</span>
                    <span className="sender-time">• {formatTime(group.timestamp)}</span>
                  </>
                ) : (
                  <>
                    <span className="sender-time">{formatTime(group.timestamp)} •</span>
                    <span className="sender-name">{sellerData?.displayName || 'You'} (AI Agent)</span>
                  </>
                )}
              </div>

              {/* Message Bubbles */}
              <div className="message-bubbles">
                {group.messages.map((message, msgIndex) => (
                  <div 
                    key={message.id} 
                    className={`message-bubble ${group.isCustomer ? 'incoming' : 'outgoing'}`}
                  >
                    {message.content}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isLoading && (
            <div className="message-group seller">
              <div className="sender-info">
                <span className="sender-time">• Just now</span>
                <span className="sender-name">You (AI Agent)</span>
              </div>
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}

          {/* AI Suggestion Panel */}
          {!isManualMode && aiSuggestion && !isLoading && (
            <div className="ai-suggestion-panel">
              <div className="ai-suggestion-header">
                <div className="ai-badge">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path>
                  </svg>
                  AI Suggested Response
                </div>
                <div className="confidence-badge">
                  Confidence: {aiSuggestion.confidence}%
                </div>
              </div>
              
              <div className="ai-suggestion-content">
                {aiSuggestion.text}
              </div>
              
              <div className="ai-suggestion-actions">
                <button 
                  className="btn-send-ai"
                  onClick={handleSendAiSuggestion}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                  Send Now
                </button>
                <button 
                  className="btn-edit-ai"
                  onClick={handleEditAiSuggestion}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Edit
                </button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="conversation-input-area">
          <div className="input-toolbar">
            <button className="toolbar-btn" title="Attach file">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>
            <button className="toolbar-btn" title="Quick actions">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </button>
          </div>
          
          <div className="input-wrapper">
            <input
              type="text"
              className="message-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isManualMode ? "Type your response..." : "AI is generating response..."}
              disabled={!isManualMode && isAiLoading}
            />
            <span className="input-hint">Internal Note: Shift + N</span>
          </div>
          
          <div className="input-actions">
            <button 
              className="send-btn"
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || isLoading}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Connection Status */}
        <div className="connection-status">
          <span className="status-dot connected"></span>
          <span>Connected</span>
          <span className="status-tools">🎨 📝 🔊 📎 🖼️</span>
        </div>
      </div>
    </div>
  );
};

export default SellerConversationView;