import React, { useState, useEffect, useRef } from 'react';
import './OrgDashboard.css';

const API_BASE_URL = 'http://localhost:3001/api';

const OrgDashboard = ({ onLogout, sellerId, sellerData }) => {
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [promptText, setPromptText] = useState(`Act as a senior technical sales engineer for ElectroFind. Your goal is to assist engineers and procurement managers in finding the right electronic components. Always verify stock availability before making commitments. Provide accurate technical specifications and competitive pricing. Be professional, helpful, and concise in your responses.`);
  const [isAgentActive, setIsAgentActive] = useState(true);
  const [stats, setStats] = useState({
    queries24h: 342,
    queriesGrowth: '+18%',
    resolvedQueries: 318,
    resolutionRate: '93%',
    avgResponseTime: '3m',
    ordersPlaced: 0,
    orderVolume: 0,
    conversionRate: '28%'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Navigation state
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'products'
  
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
        const response = await fetch(`${API_BASE_URL}/auth/seller-stats/${sellerId}`);
        const data = await response.json();

        if (data.success) {
          const volume = data.stats.orderVolume || 0;
          const formattedVolume = volume >= 1000 
            ? `$${(volume / 1000).toFixed(1)}k` 
            : `$${volume}`;

          setStats(prev => ({
            ...prev,
            ordersPlaced: data.stats.ordersPlaced || 0,
            orderVolume: formattedVolume
          }));
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

  const handleCancelEdit = () => {
    setIsEditingPrompt(false);
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

  // Render Add Products section
  const renderAddProducts = () => (
    <div className="add-products-section">
      <div className="add-products-header">
        <h1>Add Products</h1>
        <p>Ingest your product catalog to power ElectroFind's AI discovery engine. Connect a database or upload files directly.</p>
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
        <div className="navbar-nav">
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
        </div>
        <div className="navbar-actions">
          <button className="btn btn-secondary" onClick={onLogout}>
            Log Out
          </button>
        </div>
      </nav>

      <main className="org-main">
        {activeTab === 'products' ? renderAddProducts() : (
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
          </>
        )}
      </main>
    </div>
  );
};

export default OrgDashboard;