import React, { useState, useRef, useEffect } from 'react';
import './Dashboard.css';

const Dashboard = ({ onLogout }) => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'ai',
      content: "Hello! I'm your AI assistant. I can help you find electronics, research products, or answer questions. What would you like to know?"
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputValue
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: userMessage.content }),
      });

      const data = await response.json();

      if (data.type === 'buy') {
        // Handle buy response
        const buyMessage = {
          id: Date.now() + 1,
          type: 'ai',
          content: `I found some great options for **${data.expandedData.product_category}**. Here are the best deals sorted by price:`,
          buyData: data
        };
        setMessages(prev => [...prev, buyMessage]);
      } else if (data.type === 'research') {
        // Handle research response
        const researchMessage = {
          id: Date.now() + 1,
          type: 'ai',
          content: data.answer || 'Here\'s what I found:',
          sources: data.sources
        };
        setMessages(prev => [...prev, researchMessage]);
      } else {
        // Handle chat response
        const aiMessage = {
          id: Date.now() + 1,
          type: 'ai',
          content: data.response
        };
        setMessages(prev => [...prev, aiMessage]);
      }
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: 'Sorry, I encountered an error. Please try again.'
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

  return (
    <div className="dashboard">
      <nav className="dashboard-navbar">
        <div className="dashboard-brand">
          <div className="dashboard-logo-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <span className="dashboard-logo-text">ElectroFind</span>
        </div>
        <button className="btn btn-secondary" onClick={onLogout}>
          Log Out
        </button>
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

                {/* Buy Results */}
                {message.buyData && message.buyData.results && (
                  <div className="buy-results">
                    <div className="buy-results-header">
                      <span className="buy-category">{message.buyData.expandedData.product_category}</span>
                      <span className="buy-hint">Price: {message.buyData.expandedData.price_range_hint}</span>
                    </div>
                    <div className="buy-results-list">
                      {message.buyData.results.map((result) => (
                        <a
                          key={result.rank}
                          href={result.buy_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="buy-result-card"
                        >
                          <div className="buy-result-rank">#{result.rank}</div>
                          <div className="buy-result-info">
                            <div className="buy-result-title">{result.product_title}</div>
                            <div className="buy-result-store">{result.store}</div>
                            <div className="buy-result-desc">{result.description}</div>
                          </div>
                          <div className="buy-result-price">{result.price}</div>
                        </a>
                      ))}
                    </div>
                    {message.buyData.expandedData.key_specs.length > 0 && (
                      <div className="buy-specs">
                        <span className="buy-specs-label">Key specs:</span>
                        {message.buyData.expandedData.key_specs.map((spec, idx) => (
                          <span key={idx} className="buy-spec-tag">{spec}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Research Sources */}
                {message.sources && message.sources.length > 0 && (
                  <div className="sources">
                    <p className="sources-title">Sources:</p>
                    {message.sources.map((source, idx) => (
                      <a
                        key={idx}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="source-link"
                      >
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
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-container">
          <div className="input-wrapper">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about electronics, compare prices, or search for products..."
              disabled={isLoading}
            />
            <button
              className="send-btn"
              onClick={handleSend}
              disabled={isLoading || !inputValue.trim()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
          <p className="input-hint">Press Enter to send • Try "best wireless earbuds under $100"</p>
        </div>
      </main>
    </div>
  );
};

// Helper to format message content (simple markdown-like)
function formatMessage(content) {
  // Bold text
  let formatted = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Line breaks
  formatted = formatted.replace(/\n/g, '<br>');
  return formatted;
}

export default Dashboard;