import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';
import './Dashboard.css';

const API_URL = import.meta.env.VITE_API_URL || '';

const Dashboard = ({ onLogout, onStartSellerChat }) => {
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
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const [awaitingClarification, setAwaitingClarification] = useState(false);
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

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
      const response = await fetch(`${API_URL}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: userMessage.content, 
          language: i18n.language,
          sessionId: sessionId
        }),
      });

      const data = await response.json();

      if (data.type === 'buy') {
          if (data.phase === 'clarification') {
            // Phase 1: Show clarification questions
            setAwaitingClarification(true);
            const clarificationMessage = {
              id: Date.now() + 1,
              type: 'ai',
              content: data.message,
              progress: data.progress
            };
            setMessages(prev => [...prev, clarificationMessage]);
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
            id: Date.now() + 1,
            type: 'ai',
            content: introContent,
            buyData: {
              results: data.results,
              searchStatus: data.searchStatus,
              totalFound: data.totalFound,
              searchData: data.searchData
            }
          };
          setMessages(prev => [...prev, buyMessage]);
        }
      } else if (data.type === 'research') {
        setAwaitingClarification(false);
        const researchMessage = {
          id: Date.now() + 1,
          type: 'ai',
          content: data.answer || 'Here\'s what I found:',
          sources: data.sources
        };
        setMessages(prev => [...prev, researchMessage]);
      } else {
        setAwaitingClarification(false);
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
        content: t('dashboard.error')
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

                {/* Buy Results - New Product Card UI */}
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
                        {/* Assured Partner Badge */}
                        {result.isAssured && (
                          <div className="assured-partner-badge">ASSURED PARTNER</div>
                        )}
                        
                        {/* Product Header */}
                        <div className="product-header">
                          <h3 className="product-title">{result.product_title}</h3>
                          <div className="product-price">{result.price}</div>
                        </div>
                        
                        {/* Store & Stock Info */}
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
                        
                        {/* Product Description */}
                        <p className="product-description">{result.description}</p>
                        
                        {/* Action Buttons */}
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
                        
                        {/* Make the whole card clickable for non-assured products */}
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

                {/* Research Sources */}
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
  );
};

function formatMessage(content) {
  let formatted = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/\n/g, '<br>');
  return formatted;
}

export default Dashboard;