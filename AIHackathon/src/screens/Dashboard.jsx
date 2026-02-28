import React, { useState, useRef, useEffect } from 'react';
import './Dashboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const Dashboard = ({ onLogout }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const textareaRef = useRef(null);
  const chatContainerRef = useRef(null);

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 200);
      textarea.style.height = `${newHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [searchQuery]);

  useEffect(() => {
    // Scroll to bottom of chat when new message added
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [conversations]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const userMessage = searchQuery.trim();
    setIsLoading(true);
    
    // Add user message to conversation
    const newConversation = {
      id: Date.now(),
      type: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    };
    setConversations(prev => [...prev, newConversation]);
    setSearchQuery('');

    try {
      const response = await fetch(`${API_URL}/api/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: userMessage }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      
      // Add AI response to conversation
      const aiResponse = {
        id: Date.now() + 1,
        type: 'ai',
        content: data.type === 'chat' ? data.response : data.answer,
        data: data,
        timestamp: new Date().toISOString()
      };
      setConversations(prev => [...prev, aiResponse]);
    } catch (err) {
      // Add error message
      const errorResponse = {
        id: Date.now() + 1,
        type: 'error',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString()
      };
      setConversations(prev => [...prev, errorResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleSuggestionClick = (suggestion) => {
    setSearchQuery(suggestion);
  };

  // Icons
  const LightningIcon = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );

  const ArrowIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"></line>
      <polyline points="12 5 19 12 12 19"></polyline>
    </svg>
  );

  const LaptopIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
      <line x1="8" y1="21" x2="16" y2="21"></line>
      <line x1="12" y1="17" x2="12" y2="21"></line>
    </svg>
  );

  const HeadphonesIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
    </svg>
  );

  const MonitorIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
      <line x1="8" y1="21" x2="16" y2="21"></line>
      <line x1="12" y1="17" x2="12" y2="21"></line>
    </svg>
  );

  const UserIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  );

  const AIIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </svg>
  );

  const suggestions = [
    { text: 'Best budget laptops 2024', icon: <LaptopIcon /> },
    { text: 'Top-rated wireless earbuds', icon: <HeadphonesIcon /> },
    { text: 'Gaming monitors under $300', icon: <MonitorIcon /> },
  ];

  const UserAvatar = () => (
    <div className="user-avatar">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
    </div>
  );

  return (
    <div className="dashboard">
      <nav className="dashboard-navbar">
        <div className="navbar-brand">
          <div className="navbar-logo-icon">
            <LightningIcon />
          </div>
          <span className="navbar-logo-text">ElectroFind</span>
        </div>
        <div className="navbar-links">
          <a href="#discover" className="nav-link active">Discover</a>
          <a href="#stores" className="nav-link">Verified Stores</a>
          <a href="#orders" className="nav-link">My Orders</a>
        </div>
        <div className="navbar-actions">
          <UserAvatar />
          <button className="btn btn-primary" onClick={onLogout}>
            Sign In
          </button>
        </div>
      </nav>

      <main className="dashboard-main">
        {/* Conversation/Chat Area */}
        <div className="chat-container" ref={chatContainerRef}>
          {conversations.length === 0 ? (
            <h1 className="dashboard-headline">
              Find your next <span className="highlight">electronic gadget</span>
            </h1>
          ) : (
            conversations.map((conv) => (
              <div key={conv.id} className={`chat-message ${conv.type}`}>
                <div className="message-avatar">
                  {conv.type === 'user' ? <UserIcon /> : conv.type === 'ai' ? <AIIcon /> : '⚠️'}
                </div>
                <div className="message-content">
                  {conv.type === 'ai' && conv.data?.type === 'research' && conv.data.sources?.length > 0 ? (
                    <div className="research-response">
                      <p>{conv.content}</p>
                      <div className="sources">
                        <h4>Sources</h4>
                        <ul>
                          {conv.data.sources.map((source, index) => (
                            <li key={index}>
                              <a href={source.url} target="_blank" rel="noopener noreferrer">
                                {source.title}
                              </a>
                              <p>{source.content?.substring(0, 150)}...</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <p>{conv.content}</p>
                  )}
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="chat-message ai loading">
              <div className="message-avatar"><AIIcon /></div>
              <div className="message-content">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Search Box - Fixed at Bottom */}
        <div className="search-wrapper">
          {!conversations.length > 0 && (
            <div className="suggestions">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  className="suggestion-chip"
                  onClick={() => handleSuggestionClick(suggestion.text)}
                >
                  <span className="suggestion-icon">{suggestion.icon}</span>
                  {suggestion.text}
                </button>
              ))}
            </div>
          )}
          
          <div className={`search-container ${isFocused ? 'focused' : ''} ${searchQuery ? 'has-content' : ''}`}>
            <form onSubmit={handleSearch} className="search-form">
              <div className="search-input-wrapper">
                <textarea
                  ref={textareaRef}
                  className="search-textarea"
                  placeholder="Ask anything... e.g., 'Best noise-cancelling headphones under $200'"
                  value={searchQuery}
                  onChange={handleChange}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  rows={1}
                  disabled={isLoading}
                />
              </div>
              <div className="search-actions">
                <button 
                  type="submit" 
                  className="search-submit-btn"
                  disabled={isLoading || !searchQuery.trim()}
                >
                  {isLoading ? (
                    <span className="loading-spinner">Loading...</span>
                  ) : (
                    <ArrowIcon />
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;