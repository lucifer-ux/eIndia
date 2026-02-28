import React, { useState } from 'react';
import './OrgDashboard.css';

const OrgDashboard = ({ onLogout }) => {
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [promptText, setPromptText] = useState(`Act as a senior technical sales engineer for ElectroFind. Your goal is to assist engineers and procurement managers in finding the right electronic components. Always verify stock availability before making commitments. Provide accurate technical specifications and competitive pricing. Be professional, helpful, and concise in your responses.`);
  const [isAgentActive, setIsAgentActive] = useState(true);

  // Mock data
  const stats = {
    queries24h: 142,
    queriesGrowth: '+12%',
    resolvedQueries: 128,
    resolutionRate: '90%',
    avgResponseTime: '4m',
    ordersViaChat: 34,
    orderVolume: '$12.4k',
    conversionRate: '24%'
  };

  const inquiries = [
    {
      id: 1,
      name: 'John Doe',
      company: 'TechCorp',
      avatar: 'JD',
      time: '2 mins ago',
      status: 'NEW REQUEST',
      statusColor: 'blue',
      message: "I'm looking for a bulk order of STM32F407 microcontrollers, specifically the VGT6 variant. Need about 500 units by next week. Do you have stock?",
      componentDetected: 'STM32F407VGT6',
      aiResponse: "Hello John, thanks for your inquiry. Yes, we have 1,200 units of STM32F407VGT6 in stock at our warehouse. We can expedite shipping to meet your next week deadline. Would you like a formal quote for 500 units?"
    },
    {
      id: 2,
      name: 'Sarah Miller',
      company: 'ProtoLabs',
      avatar: 'SM',
      time: '15 mins ago',
      status: 'PENDING REVIEW',
      statusColor: 'yellow',
      message: "Do you carry any high-voltage ceramic capacitors rated for 2kV? Looking for 100pF."
    }
  ];

  const topComponents = [
    { name: 'ESP32-WROOM', queries: 1240, percentage: 85 },
    { name: 'Arduino Uno R3', queries: 980, percentage: 65 }
  ];

  const handleEditPrompt = () => {
    setIsEditingPrompt(true);
    setIsPromptExpanded(true);
  };

  const handleUpdateAgent = () => {
    setIsEditingPrompt(false);
    // In a real app, you would save to backend here
    console.log('Prompt updated:', promptText);
  };

  const handleCancelEdit = () => {
    setIsEditingPrompt(false);
    // Reset to original or keep changes - here we'll keep changes since it's UI only
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
          <span className="navbar-logo-text">ElectroFind</span>
        </div>
        <div className="navbar-links">
          <a href="#dashboard" className="nav-link active">Dashboard</a>
          <a href="#inquiries" className="nav-link">Inquiries</a>
          <a href="#orders" className="nav-link">Orders</a>
          <a href="#inventory" className="nav-link">Inventory</a>
        </div>
        <div className="navbar-actions">
          <button className="btn btn-secondary" onClick={onLogout}>
            Log Out
          </button>
        </div>
      </nav>

      <main className="org-main">
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
            <button className="btn btn-primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="12" y1="8" x2="12" y2="16"></line>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
              New Inquiry
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Queries in 24h</span>
              <div className="stat-icon blue">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3v18h18"></path>
                  <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path>
                </svg>
              </div>
            </div>
            <div className="stat-value-row">
              <span className="stat-value">{stats.queries24h}</span>
              <span className="stat-growth">{stats.queriesGrowth}</span>
            </div>
            <span className="stat-comparison">vs. yesterday</span>
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
              <span className="stat-rate">{stats.resolutionRate} Rate</span>
            </div>
            <span className="stat-comparison">Avg. response time: {stats.avgResponseTime}</span>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Orders Placed via Chat</span>
              <div className="stat-icon purple">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="9" cy="21" r="1"></circle>
                  <circle cx="20" cy="21" r="1"></circle>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
              </div>
            </div>
            <div className="stat-value-row">
              <span className="stat-value">{stats.ordersViaChat}</span>
              <span className="stat-volume">{stats.orderVolume} Vol</span>
            </div>
            <span className="stat-comparison">Conversion rate: {stats.conversionRate}</span>
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
              <a href="#all" className="view-all">View All</a>
            </div>

            <div className="inquiries-list">
              {inquiries.map((inquiry) => (
                <div key={inquiry.id} className="inquiry-card">
                  <div className="inquiry-header">
                    <div className="inquiry-user">
                      <div className="user-avatar-org">{inquiry.avatar}</div>
                      <div className="user-info">
                        <span className="user-name">{inquiry.name}</span>
                        <span className="user-company">@ {inquiry.company}</span>
                      </div>
                    </div>
                    <div className="inquiry-meta">
                      <span className={`status-badge ${inquiry.statusColor}`}>{inquiry.status}</span>
                      <span className="inquiry-time">{inquiry.time}</span>
                    </div>
                  </div>

                  <div className="inquiry-message">
                    "{inquiry.message}"
                  </div>

                  {inquiry.componentDetected && (
                    <div className="component-detected">
                      <span>Component Detected:</span>
                      <span className="component-tag">{inquiry.componentDetected}</span>
                    </div>
                  )}

                  {inquiry.aiResponse && (
                    <div className="ai-suggestion">
                      <div className="ai-suggestion-header">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path>
                        </svg>
                        AI SUGGESTED RESPONSE
                      </div>
                      <p>{inquiry.aiResponse}</p>
                      <div className="ai-suggestion-actions">
                        <button className="btn btn-primary btn-sm">Approve & Send</button>
                        <button className="btn btn-secondary btn-sm">Edit Response</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
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
      </main>
    </div>
  );
};

export default OrgDashboard;