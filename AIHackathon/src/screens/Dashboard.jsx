import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';
import './Dashboard.css';

const Dashboard = ({ onLogout }) => {
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
      const response = await fetch('http://localhost:3001/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMessage.content, language: i18n.language }),
      });

      const data = await response.json();

      if (data.type === 'buy') {
        const buyMessage = {
          id: Date.now() + 1,
          type: 'ai',
          content: data.introMessage || `I found some great options for **${data.expandedData.product_category}**. Here are the best deals sorted by price:`,
          buyData: data
        };
        setMessages(prev => [...prev, buyMessage]);
      } else if (data.type === 'research') {
        const researchMessage = {
          id: Date.now() + 1,
          type: 'ai',
          content: data.answer || 'Here\'s what I found:',
          sources: data.sources
        };
        setMessages(prev => [...prev, researchMessage]);
      } else {
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
          const response = await fetch('http://localhost:3001/api/stt', {
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
      const response = await fetch('http://localhost:3001/api/tts', {
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

                {/* Buy Results */}
                {message.buyData && message.buyData.results && (
                  <div className="buy-results">
                    <div className="buy-results-header">
                      <span className="buy-category">{message.buyData.expandedData.product_category}</span>
                      <span className="buy-hint">Price: {message.buyData.expandedData.price_range_hint}</span>
                    </div>
                    <div className="buy-results-list">
                      {message.buyData.results.map((result) => (
                        <a key={result.rank} href={result.buy_link} target="_blank" rel="noopener noreferrer" className="buy-result-card">
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
                        <span className="buy-specs-label">{t('dashboard.keySpecs')}</span>
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