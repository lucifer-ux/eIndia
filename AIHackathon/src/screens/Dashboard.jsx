import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';
import './Dashboard.css';

const API_URL = import.meta.env.VITE_API_URL || '';

const Dashboard = ({ onLogout, onStartSellerChat, user }) => {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'ai',
      content: t('dashboard.greeting')
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const [sessionId, setSessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const [awaitingClarification, setAwaitingClarification] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [displayedChats, setDisplayedChats] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const messagesRef = useRef(messages);
  const currentChatIdRef = useRef(currentChatId);
  const isSavingRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    currentChatIdRef.current = currentChatId;
  }, [currentChatId]);

  const userId = user?.uid || user?.userId || localStorage.getItem('userId');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Update greeting when language changes
  useEffect(() => {
    setMessages(prev => prev.map((msg, idx) =>
      idx === 0 ? { ...msg, content: t('dashboard.greeting') } : msg
    ));
  }, [i18n.language, t]);

  // Load chat history on mount
  useEffect(() => {
    if (userId) {
      loadChatHistory();
    }
  }, [userId]);


  const loadChatHistory = async () => {
    if (!userId) return;
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`${API_URL}/api/chat/list/${userId}`);
      const data = await response.json();
      if (data.success) {
        const allChats = data.chats || [];
        // Limit to 15 most recent chats
        const limitedChats = allChats.slice(0, 15);
        setChatHistory(limitedChats);
        setDisplayedChats(limitedChats);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Search chats locally from the 15 loaded chats
  const handleChatSearch = (query) => {
    setChatSearchQuery(query);
    if (!query.trim()) {
      setDisplayedChats(chatHistory);
      return;
    }
    const lowerQuery = query.toLowerCase();
    const filtered = chatHistory.filter(chat =>
      (chat.title || '').toLowerCase().includes(lowerQuery)
    );
    setDisplayedChats(filtered);
  };

  const saveChatWithMessages = async (messagesToSave) => {
    // Prevent duplicate saves
    if (isSavingRef.current) {
      console.log('Save already in progress, skipping...');
      return;
    }
    isSavingRef.current = true;

    try {
      // Use ref to get latest currentChatId
      const activeChatId = currentChatIdRef.current;
      console.log('saveChatWithMessages called', { userId, messageCount: messagesToSave.length, activeChatId });
      if (!userId || messagesToSave.length <= 1) {
        console.log('Skipping save - no userId or not enough messages');
        return;
      }

      const isNewChat = !activeChatId;
      const chatId = activeChatId || `chat-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      console.log('Saving chat:', { isNewChat, chatId });

      // Get first user message for title
      const firstUserMessage = messagesToSave.find(m => m.type === 'user');
      const firstMessageContent = firstUserMessage?.content || 'New Chat';

      const chatData = {
        userId,
        chatId,
        messages: messagesToSave.map(m => ({
          id: m.id,
          type: m.type,
          role: m.type === 'user' ? 'user' : 'assistant',
          content: m.content,
          buyData: m.buyData,
          sources: m.sources,
        })),
      };

      const url = isNewChat ? `${API_URL}/api/chat/create` : `${API_URL}/api/chat/update`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatData),
      });
      const data = await response.json();
      if (data.success) {
        setCurrentChatId(chatId);

        // Immediately add to local state for new chats
        if (isNewChat) {
          const newChat = {
            userCharId: `${userId}#${chatId}`,
            userId,
            chatId,
            title: data.chat?.title || firstMessageContent.substring(0, 30) + (firstMessageContent.length > 30 ? '...' : ''),
            messages: chatData.messages,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setChatHistory(prev => [newChat, ...prev].slice(0, 15));
          setDisplayedChats(prev => [newChat, ...prev].slice(0, 15));
        } else {
          // Update existing chat in local state
          setChatHistory(prev => prev.map(c =>
            c.chatId === chatId
              ? { ...c, messages: chatData.messages, updatedAt: new Date().toISOString() }
              : c
          ));
          if (!chatSearchQuery) {
            setDisplayedChats(prev => prev.map(c =>
              c.chatId === chatId
                ? { ...c, messages: chatData.messages, updatedAt: new Date().toISOString() }
                : c
            ));
          }
        }
      }
    } catch (error) {
      console.error('Failed to save chat:', error);
    } finally {
      isSavingRef.current = false;
    }
  };

  const startNewChat = () => {
    setCurrentChatId(null);
    setSessionId(`session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    setMessages([
      {
        id: 1,
        type: 'ai',
        content: t('dashboard.greeting')
      }
    ]);
    setAwaitingClarification(false);
    setInputValue('');
  };

  const loadChat = async (chat) => {
    // Clear messages first to prevent contamination
    setMessages([]);

    setCurrentChatId(chat.chatId);
    currentChatIdRef.current = chat.chatId;
    setSessionId(`session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

    // Convert stored messages to UI format with unique IDs
    const loadedMessages = chat.messages.map((m, idx) => ({
      id: `${chat.chatId}-${idx}-${Date.now()}`,
      type: m.type || (m.role === 'user' ? 'user' : 'ai'),
      content: m.content,
      buyData: m.buyData,
      sources: m.sources,
    }));

    setMessages(loadedMessages);
    setAwaitingClarification(false);
  };

  const deleteChat = async (e, chatId) => {
    e.stopPropagation();
    if (!userId || !chatId) return;

    if (!window.confirm('Delete this chat?')) return;

    try {
      const response = await fetch(`${API_URL}/api/chat/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, chatId }),
      });
      const data = await response.json();
      if (data.success) {
        if (currentChatId === chatId) {
          startNewChat();
        }
        loadChatHistory();
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  };

  const deleteAllChats = async () => {
    if (!userId) return;

    if (!window.confirm('Delete all chats? This cannot be undone.')) return;

    try {
      const response = await fetch(`${API_URL}/api/chat/delete-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await response.json();
      if (data.success) {
        startNewChat();
        loadChatHistory();
      }
    } catch (error) {
      console.error('Failed to delete all chats:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type: 'user',
      content: inputValue
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Build previous messages for context (exclude the greeting and current message)
      const previousMessages = messages
        .filter(m => m.id !== 1 && m.id !== userMessage.id) // Exclude greeting and current message
        .map(m => ({
          role: m.type === 'user' ? 'user' : 'assistant',
          content: m.content,
          type: m.type
        }));

      const response = await fetch(`${API_URL}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMessage.content,
          language: i18n.language,
          sessionId: sessionId,
          previousMessages: previousMessages.length > 0 ? previousMessages : undefined
        }),
      });

      const data = await response.json();

      if (data.type === 'buy') {
          if (data.phase === 'clarification') {
            // Phase 1: Show clarification questions
            setAwaitingClarification(true);
            const clarificationMessage = {
              id: `ai-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              type: 'ai',
              content: data.message,
              progress: data.progress
            };
            setMessages(prev => {
              const newMessages = [...prev, clarificationMessage];
              // Save after state update
              setTimeout(() => saveChatWithMessages(newMessages), 50);
              return newMessages;
            });
        } else if (data.phase === 'results') {
          // Phase 2: Show search results
          setAwaitingClarification(false);

          let introContent;
          if (data.fallbackTriggered) {
            introContent = "I found some options, though results were limited. Here are the best deals I could find:";
          } else if (data.searchData?.user_preferences) {
            const prefs = data.searchData.user_preferences;
            introContent = `Great! Based on your preferences${prefs.budget !== 'not specified' ? ` (budget: ${prefs.budget})` : ''}${prefs.region ? ` in ${prefs.region}` : ''}, here are the best deals I found:`;
          } else {
            introContent = "Based on your preferences, here are the best deals I found:";
          }

          const buyMessage = {
            id: `ai-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            type: 'ai',
            content: introContent,
            buyData: {
              results: data.results,
              searchStatus: data.searchStatus,
              totalFound: data.totalFound,
              searchData: data.searchData
            }
          };
          setMessages(prev => {
            const newMessages = [...prev, buyMessage];
            setTimeout(() => saveChatWithMessages(newMessages), 50);
            return newMessages;
          });
        }
      } else if (data.type === 'research') {
        setAwaitingClarification(false);
        const researchMessage = {
          id: `ai-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          type: 'ai',
          content: data.answer || 'Here\'s what I found:',
          sources: data.sources
        };
        setMessages(prev => {
          const newMessages = [...prev, researchMessage];
          setTimeout(() => saveChatWithMessages(newMessages), 50);
          return newMessages;
        });
      } else {
        setAwaitingClarification(false);
        const aiMessage = {
          id: `ai-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          type: 'ai',
          content: data.response
        };
        setMessages(prev => [...prev, aiMessage]);
        // Save chat after AI response
        setTimeout(() => {
          const currentMessages = [...messagesRef.current, aiMessage];
          saveChatWithMessages(currentMessages);
        }, 100);
      }
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: t('dashboard.error')
      };
      setMessages(prev => [...prev, errorMessage]);
      // Save chat even on error
      setTimeout(() => {
        const currentMessages = [...messagesRef.current, errorMessage];
        saveChatWithMessages(currentMessages);
      }, 100);
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

  // STT: Record audio and send to backend
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());

        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('language', i18n.language);

        setIsTranscribing(true);
        try {
          const response = await fetch(`${API_URL}/api/stt`, {
            method: 'POST',
            body: formData,
          });
          const data = await response.json();
          if (data.transcript) {
            setInputValue(data.transcript);
          }
        } catch (err) {
          console.error('STT error:', err);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access denied:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // TTS: Play AI message as audio
  const playTTS = async (messageId, text) => {
    if (playingId === messageId) return;
    setPlayingId(messageId);

    try {
      const response = await fetch(`${API_URL}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language: i18n.language }),
      });

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.onended = () => {
        setPlayingId(null);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => setPlayingId(null);
      audio.play();
    } catch (err) {
      console.error('TTS error:', err);
      setPlayingId(null);
    }
  };

  return (
    <div className="dashboard">
      <div className="dashboard-with-sidebar">
        {/* Chat History Sidebar */}
        <aside className="chat-sidebar">
          <div className="sidebar-header">
            <button className="btn-new-chat" onClick={startNewChat}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              New Chat
            </button>
          </div>

          {/* Search Box */}
          <div className="chat-search-container">
            <div className="chat-search-wrapper">
              <svg className="chat-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
              <input
                type="text"
                className="chat-search-input"
                placeholder="Search chats..."
                value={chatSearchQuery}
                onChange={(e) => handleChatSearch(e.target.value)}
              />
              {chatSearchQuery && (
                <button
                  className="chat-search-clear"
                  onClick={() => handleChatSearch('')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className="chat-history">
            <div className="chat-history-header">
              <span>Recent Chats {chatHistory.length > 0 && `(${chatHistory.length})`}</span>
              {chatHistory.length > 0 && (
                <button className="btn-clear-all" onClick={deleteAllChats} title="Clear all chats">
                  Clear All
                </button>
              )}
            </div>

            {isLoadingHistory ? (
              <div className="no-chats">Loading...</div>
            ) : displayedChats.length === 0 ? (
              <div className="no-chats">
                {chatSearchQuery ? 'No chats found' : 'No chats yet'}
              </div>
            ) : (
              displayedChats.map((chat) => (
                <div
                  key={chat.chatId}
                  className={`chat-item ${currentChatId === chat.chatId ? 'active' : ''}`}
                  onClick={() => loadChat(chat)}
                >
                  <svg className="chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  <div className="chat-info">
                    <div className="chat-title">{chat.title || 'New Chat'}</div>
                    <div className="chat-date">{formatDate(chat.updatedAt)}</div>
                  </div>
                  <button
                    className="chat-delete-btn"
                    onClick={(e) => deleteChat(e, chat.chatId)}
                    title="Delete chat"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Main Chat Area */}
        <div className="chat-main">
          <nav className="dashboard-navbar">
            <div className="dashboard-brand">
              <div className="dashboard-logo-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <span className="dashboard-logo-text">ElectroFind</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <LanguageSelector />
              <button className="btn btn-secondary" onClick={onLogout}>
                {t('nav.logout')}
              </button>
            </div>
          </nav>

          <main className="chat-container">
            <div className="messages">
              {messages.map((message) => (
                <div key={message.id} className={`message ${message.type}`}>
                  {message.type === 'ai' && (
                    <div className="ai-avatar">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path>
                      </svg>
                    </div>
                  )}
                  <div className="message-content">
                    <div dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }} />

                    {/* TTS button for AI messages */}
                    {message.type === 'ai' && (
                      <button
                        className="tts-btn"
                        onClick={() => playTTS(message.id, message.content)}
                        disabled={playingId === message.id}
                        title="Listen"
                      >
                        {playingId === message.id ? '⏸' : '🔊'}
                      </button>
                    )}

                    {/* Clarification Progress */}
                    {message.progress && (
                      <div className="clarification-progress">
                        <div className={`progress-item ${message.progress.hasProduct ? 'complete' : 'pending'}`}>
                          <span className="progress-icon">{message.progress.hasProduct ? '✓' : '○'}</span>
                          Product
                        </div>
                        <div className={`progress-item ${message.progress.hasBudget ? 'complete' : 'pending'}`}>
                          <span className="progress-icon">{message.progress.hasBudget ? '✓' : '○'}</span>
                          Budget
                        </div>
                        <div className={`progress-item ${message.progress.hasRegion ? 'complete' : 'pending'}`}>
                          <span className="progress-icon">{message.progress.hasRegion ? '✓' : '○'}</span>
                          Region
                        </div>
                      </div>
                    )}

                    {message.buyData && message.buyData.results && (
                      <div className="product-results">
                        {message.buyData.results.map((result) => (
                          <div
                            key={result.rank}
                            className={`product-card ${result.isAssured ? 'product-card-assured' : ''}`}
                          >
                            {result.isAssured && (
                              <div className="assured-partner-badge">ASSURED PARTNER</div>
                            )}
                            <div className="product-header">
                              <h3 className="product-title">{result.product_title}</h3>
                              <div className="product-price">{result.price}</div>
                            </div>
                            <div className="product-meta">
                              <span className="product-store">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                </svg>
                                {result.store}
                              </span>
                              <span className={`product-stock ${
                                result.availability === 'Out of Stock' ? 'out-of-stock' :
                                result.availability === 'Limited Stock' ? 'low-stock' : 'in-stock'
                              }`}>
                                {result.availability || 'In Stock'}
                              </span>
                              {result.deal_flag && <span className="deal-badge">DEAL</span>}
                            </div>
                            <p className="product-description">{result.description}</p>
                            <div className="product-actions">
                              {result.isAssured ? (
                                <>
                                  <button
                                    className="btn-chat-to-buy"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onStartSellerChat && onStartSellerChat(result);
                                    }}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                    </svg>
                                    Chat to Buy
                                  </button>
                                  <a
                                    href={result.buy_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-view-details"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    View Details →
                                  </a>
                                </>
                              ) : (
                                <a
                                  href={result.buy_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn-buy-now"
                                >
                                  Buy Now →
                                </a>
                              )}
                            </div>
                            {!result.isAssured && (
                              <a
                                href={result.buy_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="product-card-overlay"
                              >
                                <span className="sr-only">Buy {result.product_title}</span>
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {message.sources && message.sources.length > 0 && (
                      <div className="sources">
                        <p className="sources-title">{t('dashboard.sources')}</p>
                        {message.sources.map((source, idx) => (
                          <a key={idx} href={source.url} target="_blank" rel="noopener noreferrer" className="source-link">
                            {source.title}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="message ai">
                  <div className="ai-avatar">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path>
                    </svg>
                  </div>
                  <div className="message-content">
                    <div className="typing-indicator">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="input-container">
              <div className={`input-wrapper ${isTranscribing ? 'transcribing' : ''}`}>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={isTranscribing ? t('dashboard.transcribing') || 'Transcribing...' : t('dashboard.placeholder')}
                  disabled={isLoading || isTranscribing}
                />
                {isTranscribing && (
                  <div className="stt-loader">
                    <span></span><span></span><span></span>
                  </div>
                )}
                <button
                  className={`mic-btn ${isRecording ? 'recording' : ''}`}
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onMouseLeave={stopRecording}
                  disabled={isTranscribing}
                  title="Hold to speak"
                >
                  🎤
                </button>
                <button
                  className="send-btn"
                  onClick={handleSend}
                  disabled={isLoading || !inputValue.trim() || isTranscribing}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </div>
              <p className="input-hint">{t('dashboard.inputHint')}</p>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

function formatMessage(content) {
  let formatted = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/\n/g, '<br>');
  return formatted;
}

export default Dashboard;