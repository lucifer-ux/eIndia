import React, { useState, useRef, useEffect } from 'react';
import './SellerChat.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const SellerChat = ({ productData, userData, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [isStarting, setIsStarting] = useState(true);
  const [notificationSent, setNotificationSent] = useState(false);
  const [chatId, setChatId] = useState(null);
  const [extractedInfo, setExtractedInfo] = useState({});
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Get seller info from product data
  const sellerId = productData.storeId || 'demo-seller-001';
  const userEmail = userData?.email || 'anonymous@user.com';

  // Save conversation to DynamoDB
  const saveConversationToDB = async (updatedMessages, status = 'active', extractedData = null, notified = false) => {
    try {
      const chatId = `${sellerId}#${userEmail}#${sessionId}`;
      const payload = {
        sellerId,
        userEmail,
        sessionId,
        productData: {
          product_title: productData.product_title,
          price: productData.price,
          store: productData.store,
          sku: productData.sku || 'N/A'
        },
        messages: updatedMessages.map(m => ({
          role: m.type === 'user' ? 'Customer' : 'Bot',
          content: m.content,
          timestamp: m.timestamp
        })),
        status: status,
        whatsappNotified: notified
      };

      // Add extracted info if available
      if (extractedData || Object.keys(extractedInfo).length > 0) {
        payload.extractedInfo = extractedData || extractedInfo;
      }

      const response = await fetch(`${API_URL}/api/seller-user-chat/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (data.success) {
        console.log('[SellerChat] Conversation saved to DB');
      }
    } catch (error) {
      console.error('[SellerChat] Error saving conversation:', error);
    }
  };

  // Initialize chat session on mount
  useEffect(() => {
    const startChatSession = async () => {
      try {
        const response = await fetch(`${API_URL}/api/seller/chat/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sellerId: productData.storeId || 'demo-seller-001',
            productData: {
              product_title: productData.product_title,
              price: productData.price,
              store: productData.store,
              sku: productData.sku || 'N/A'
            },
            userInfo: {
              location: userData?.location || 'Not specified',
              budget: userData?.budget || 'Not specified',
              name: userData?.name || 'Customer'
            }
          })
        });

        const data = await response.json();
        
        if (data.sessionId) {
          setSessionId(data.sessionId);
          
          const now = new Date();
          const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          
          const welcomeMessage = {
            id: Date.now(),
            type: 'seller',
            sender: productData.store || 'Seller Support',
            content: data.message,
            timestamp: timeString,
            isFirstInGroup: true
          };
          
          setMessages([welcomeMessage]);
          
          // Save initial conversation to DB
          setTimeout(() => {
            saveConversationToDB([welcomeMessage]);
          }, 0);
        }
      } catch (error) {
        console.error('Failed to start chat session:', error);
        // Fallback welcome message
        const welcomeMessage = {
          id: Date.now(),
          type: 'seller',
          sender: productData.store || 'Seller Support',
          content: `Hello! Yes, the ${productData.product_title} is currently available. It comes with all the specifications you need and is ready to ship.`,
          timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          isFirstInGroup: true
        };
        setMessages([welcomeMessage]);
      } finally {
        setIsStarting(false);
      }
    };

    startChatSession();
    
    // Cleanup on unmount
    return () => {
      if (sessionId) {
        fetch(`${API_URL}/api/seller/chat/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        }).catch(err => console.error('Failed to end chat:', err));
      }
    };
  }, [productData, userData]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;
    
    // If session is still starting, show a message
    if (!sessionId) {
      const now = new Date();
      const userMessage = {
        id: Date.now(),
        type: 'user',
        sender: 'You',
        content: inputValue,
        timestamp: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        isFirstInGroup: true
      };
      
      setMessages(prev => [...prev, userMessage]);
      setInputValue('');
      
      // Show connecting message
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          type: 'seller',
          sender: productData.store || 'Seller Support',
          content: "Please wait a moment, I'm still connecting to the seller's system...",
          timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          isFirstInGroup: true
        }]);
      }, 500);
      return;
    }

    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // Add user message
    const userMessage = {
      id: Date.now(),
      type: 'user',
      sender: 'You',
      content: inputValue,
      timestamp: timeString,
      isFirstInGroup: true
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/seller/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: userMessage.content
        })
      });

      const data = await response.json();
      
      const responseTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      
      const sellerResponse = {
        id: Date.now() + 1,
        type: 'seller',
        sender: productData.store || 'Seller Support',
        content: data.message || data.fallbackMessage || "I'm sorry, I'm having trouble responding right now. Please try again.",
        timestamp: responseTime,
        isFirstInGroup: true
      };

      setMessages(prev => [...prev, sellerResponse]);

      // Save conversation to DB after each exchange
      const updatedMessages = [...messages, userMessage, sellerResponse];
      saveConversationToDB(updatedMessages);

      // Send every user message to backend for LLM-based intent analysis
      if (!notificationSent) {
        console.log('[SellerChat] Analyzing message with LLM...');
        await analyzeAndNotify(userMessage.content, updatedMessages);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const errorMessage = {
        id: Date.now() + 1,
        type: 'seller',
        sender: productData.store || 'Seller Support',
        content: "I apologize, I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: errorTime,
        isFirstInGroup: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (action) => {
    setInputValue(action);
    setTimeout(() => handleSend(), 100);
  };

  // Analyze message with LLM and send notification if needed
  const analyzeAndNotify = async (triggerMessage) => {
    try {
      const sellerId = productData.storeId || 'demo-seller-001';
      
      // Build full conversation history
      const fullConversation = messages.map(m => ({
        role: m.type === 'user' ? 'Customer' : 'Bot',
        content: m.content
      }));

      const response = await fetch(`${API_URL}/api/seller/chat/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sellerId,
          sessionId,
          triggerMessage,
          conversationHistory: fullConversation,
          productInfo: {
            name: productData.product_title,
            price: productData.price,
            sku: productData.sku || 'N/A'
          },
          userInfo: {
            name: userData?.name || 'Customer',
            location: userData?.location || 'Not specified'
          }
        })
      });

      const data = await response.json();
      
      if (data.shouldNotify && !notificationSent) {
        console.log('[SellerChat] LLM detected intent! Sending WhatsApp notification...');
        await sendWhatsAppNotification(data.extractedInfo);
      }
    } catch (error) {
      console.error('[SellerChat] Error analyzing message:', error);
    }
  };

  // Send WhatsApp notification to seller
  const sendWhatsAppNotification = async (extractedInfo) => {
    try {
      const sellerId = productData.storeId || 'demo-seller-001';
      
      // Build conversation summary from recent messages
      const recentMessages = messages.slice(-6).map(m => ({
        role: m.type === 'user' ? 'Customer' : 'Bot',
        content: m.content
      }));

      const response = await fetch(`${API_URL}/api/seller/chat/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sellerId,
          sessionId,
          conversationHistory: recentMessages,
          extractedInfo,
          productInfo: {
            name: productData.product_title,
            price: productData.price,
            sku: productData.sku || 'N/A'
          },
          userInfo: {
            name: userData?.name || 'Customer',
            location: userData?.location || 'Not specified'
          }
        })
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('[SellerChat] WhatsApp notification sent successfully');
        setNotificationSent(true);
        
        // Track resolved query for seller
        try {
          await fetch(`${API_URL}/api/seller/stats/resolved`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sellerId })
          });
          console.log('[SellerChat] Resolved query tracked for seller:', sellerId);
        } catch (statsError) {
          console.error('[SellerChat] Failed to track resolved query:', statsError);
        }
        
        // Save to DB with notified status
        const updatedMessages = [...messages];
        saveConversationToDB(updatedMessages, 'active', extractedInfo, true);
        
        // Show confirmation to user with dashboard login prompt
        const confirmationMessage = {
          id: Date.now() + 100,
          type: 'seller',
          sender: productData.store || 'Seller Support',
          content: extractedInfo?.wantsHuman 
            ? "I've notified the seller. Someone will reach out to you shortly! You can also track your inquiry at https://eindia.duckdns.org/"
            : "I've notified the seller about your interest. They'll follow up with you soon! Track your inquiry at https://eindia.duckdns.org/",
          timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          isFirstInGroup: true,
          isNotification: true
        };
        
        setMessages(prev => [...prev, confirmationMessage]);
        
        // Save again with the confirmation message and notified status
        setTimeout(() => {
          saveConversationToDB([...updatedMessages, confirmationMessage], 'active', extractedInfo, true);
        }, 0);
      } else {
        console.error('[SellerChat] Failed to send notification:', data.error);
      }
    } catch (error) {
      console.error('[SellerChat] Error sending WhatsApp notification:', error);
    }
  };

  // Group messages by sender for styling
  const groupMessages = (msgs) => {
    const groups = [];
    let currentGroup = null;
    
    msgs.forEach((msg) => {
      if (!currentGroup || currentGroup.type !== msg.type) {
        currentGroup = {
          type: msg.type,
          sender: msg.sender,
          messages: []
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

  const formatDate = () => {
    return 'Today';
  };

  const getInitials = (name) => {
    if (!name) return 'SE';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="seller-chat-overlay">
      {/* Header */}
      <header className="seller-chat-header">
        <div className="seller-header-left">
          <button className="back-btn" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          
          <div className="seller-header-avatar">
            <span>{getInitials(productData.store)}</span>
            <span className="online-indicator"></span>
          </div>
          
          <div className="seller-header-info">
            <span className="seller-header-name">{productData.store || 'Seller Support'}</span>
            <span className="seller-header-status">Typically replies in 5m</span>
          </div>
        </div>

        <div className="seller-header-right">
          <div className="seller-header-product">
            <div className="product-thumb" style={{ background: '#374151' }}></div>
            <div className="product-thumb-info">
              <span className="product-thumb-name">{productData.product_title}</span>
              <span className="product-thumb-price">{productData.price} • In Stock</span>
            </div>
          </div>
          
          <button className="more-options-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Chat Container */}
      <div className="seller-chat-container">
        {/* Messages */}
        <div className="seller-chat-messages" ref={messagesContainerRef}>
          {isStarting && (
            <div className="chat-loading">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <p>Connecting to seller...</p>
            </div>
          )}
          
          {/* Date Divider */}
          {!isStarting && messages.length > 0 && (
            <div className="date-divider">
              <span>{formatDate()}</span>
            </div>
          )}

          {/* Product Card */}
          {!isStarting && (
            <div className="product-card">
              <div className="product-card-content">
                <div className="product-card-image" style={{ background: '#374151' }}></div>
                <div className="product-card-details">
                  <h3 className="product-card-name">{productData.product_title}</h3>
                  <p className="product-card-specs">
                    {productData.specs ? productData.specs.join(' • ') : 'High Quality • Fast Shipping • Warranty'}
                  </p>
                  <div className="product-card-price-row">
                    <span className="product-card-price">{productData.price}</span>
                    <a href="#" className="view-details-link" onClick={(e) => e.preventDefault()}>View Details</a>
                  </div>
                </div>
              </div>
              <div className="product-card-footer">
                You started a conversation about this item
              </div>
            </div>
          )}

          {/* Messages */}
          {messageGroups.map((group, groupIndex) => (
            <div key={groupIndex} className={`message-group ${group.type}`}>
              {group.messages.map((message, msgIndex) => (
                <React.Fragment key={message.id}>
                  {msgIndex === 0 && group.type === 'seller' && (
                    <div className="message-sender">
                      <div className="message-sender-avatar">{getInitials(productData.store)}</div>
                      <span>{message.sender}</span>
                      <span>•</span>
                      <span>{message.timestamp}</span>
                    </div>
                  )}
                  {msgIndex === 0 && group.type === 'user' && (
                    <div className="message-sender" style={{ justifyContent: 'flex-end' }}>
                      <span>{message.timestamp}</span>
                      <span>•</span>
                      <span>{message.sender}</span>
                    </div>
                  )}
                  <div className={`message-bubble ${group.type} ${message.isNotification ? 'notification' : ''}`}>
                    {message.content}
                  </div>
                </React.Fragment>
              ))}
            </div>
          ))}

          {/* Typing Indicator */}
          {isLoading && (
            <div className="message-group seller">
              <div className="message-sender">
                <div className="message-sender-avatar">{getInitials(productData.store)}</div>
                <span>{productData.store || 'Seller Support'}</span>
              </div>
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        {!isStarting && (
          <div className="quick-actions-row">
            {quickActions.map((action, idx) => (
              <button 
                key={idx} 
                className="quick-action-chip"
                onClick={() => handleQuickAction(action)}
                disabled={isLoading}
              >
                {action}
              </button>
            ))}
          </div>
        )}

        {/* Input Area */}
        <div className="seller-chat-input-area">
          <p className="input-hint-text">Press Enter to send, Shift + Enter for new line</p>
          <div className="seller-chat-input-wrapper">
            <button className="input-action-btn" disabled={isLoading || isStarting}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v8M8 12h8"/>
              </svg>
            </button>
            
            <button className="input-action-btn" disabled={isLoading || isStarting}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </button>
            
            <input
              type="text"
              className="seller-chat-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isStarting ? "Connecting..." : "Type a message..."}
              disabled={isLoading}
            />
            
            <button 
              className="send-message-btn"
              onClick={handleSend}
              disabled={isLoading || !inputValue.trim()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerChat;