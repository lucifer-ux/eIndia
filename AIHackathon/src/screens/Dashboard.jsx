import React, { useState, useRef, useEffect } from 'react';
import './Dashboard.css';

const Dashboard = ({ onLogout }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef(null);

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

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      console.log('Searching for:', searchQuery);
    }
  };

  const handleChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleSuggestionClick = (suggestion) => {
    setSearchQuery(suggestion);
    console.log('Searching for:', suggestion);
  };

  // Icons
  const LightningIcon = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );

  const SearchIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"></circle>
      <path d="m21 21-4.35-4.35"></path>
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
        <h1 className="dashboard-headline">
          Find your next <span className="highlight">electronic gadget</span>
        </h1>

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
              />
            </div>
            {(searchQuery || isFocused) && (
              <div className="search-actions">
                <button type="submit" className="search-submit-btn">
                  <ArrowIcon />
                  <span>Search</span>
                </button>
              </div>
            )}
          </form>
        </div>

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
      </main>
    </div>
  );
};

export default Dashboard;