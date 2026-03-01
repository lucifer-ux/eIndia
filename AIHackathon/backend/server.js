const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const { tavily } = require('@tavily/core');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand, DeleteTranscriptionJobCommand } = require('@aws-sdk/client-transcribe');
const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly');
const multer = require('multer');
require('dotenv').config();
const authRoutes = require('./authRoutes');
const { searchAssuredInventory, getProductBySku, getAssuredSeller } = require('./sellerInventory');
const { createChat, getUserChats, getChat, updateChat, deleteChat, deleteAllUserChats } = require('./dynamodb');

const app = express();
const port = process.env.PORT || 3001;

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Initialize AWS clients
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const transcribeClient = new TranscribeClient({ region: process.env.AWS_REGION || 'us-east-1' });
const pollyClient = new PollyClient({ region: process.env.AWS_REGION || 'us-east-1' });

const S3_BUCKET = process.env.S3_BUCKET || 'your-bucket-name';

// Language mappings
const LANGUAGE_MAP = {
  en: 'en-US',
  hi: 'hi-IN',
  kn: 'kn-IN',
  te: 'te-IN',
  ta: 'ta-IN',
  mr: 'mr-IN',
  pa: 'pa-IN',
  bn: 'bn-IN',
  gu: 'gu-IN',
  ml: 'ml-IN',
};

const POLLY_VOICES = {
  en: 'Joanna',
  hi: 'Aditi',
  kn: 'Aditi',
  te: 'Aditi',
  ta: 'Aditi',
  mr: 'Aditi',
  pa: 'Aditi',
  bn: 'Aditi',
  gu: 'Aditi',
  ml: 'Aditi',
};

// Store conversation state (in production, use Redis/database)
const conversationState = new Map();

// Store seller prompts and chat sessions
const sellerPrompts = new Map(); // sellerId -> prompt
const sellerChatSessions = new Map(); // sessionId -> { sellerId, productData, messages }

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

// Initialize Tavily client
const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY });

const MODEL = 'openai.gpt-oss-120b';

// Testing Mode Configuration
const TESTING_MODE = process.env.TESTING_MODE === 'true' || true;

// Demo/Test Seller Configuration
const DEMO_SELLER_CONFIG = {
  sellerId: 'demo-seller-001',
  name: 'Demo Electronics Store',
  displayName: 'Demo Electronics Store',
  email: 'demo@electrofind.com',
  isAssured: true,
  rating: 4.8,
  totalOrders: 156,
  responseTime: '< 5 min',
  warranty: '2 Years',
  returnPolicy: '30-day no questions asked',
  isOnline: true
};

// ═══════════════════════════════════════
// SMART CLARIFICATION SYSTEM
// ═══════════════════════════════════════

/**
 * Uses LLM to analyze user query and extract shopping preferences
 * Returns an object with extracted info
 */
async function analyzeQueryWithLLM(query, existingContext = {}) {
  const prompt = `You are a shopping assistant query analyzer. Extract information from the user's message.

User message: "${query}"

Already known from previous messages: ${JSON.stringify(existingContext)}

Extract the following information. Return ONLY a JSON object:
{
  "product": "Product category (e.g., 'Single-Board Computer', 'Laptop', 'Smartphone', 'Audio', 'Gaming', etc.)",
  "productName": "Specific product name/model if mentioned (e.g., 'Radxa 4D', 'iPhone 15', 'MacBook Pro')",
  "budget": "Budget/price range if mentioned (e.g., 'Under $500', '$1000-1500', 'around ₹15,000')",
  "region": "Country/region for shipping (e.g., 'India', 'USA', 'UK', 'Canada')",
  "useCase": "What they'll use it for (e.g., 'Gaming', 'Work', 'Student', 'Development', 'General Use')",
  "brand": "Brand preference if mentioned (e.g., 'Apple', 'Samsung', 'ASUS', 'none')",
  "condition": "New or Refurbished if mentioned"
}

Rules:
- If information is not mentioned, use null or omit the field
- Be smart about product categories: "Radxa" = Single-Board Computer, "Arduino" = Microcontroller, etc.
- Region defaults: "India", "delivered in india", "shipping to india" = "India"
- Use null for fields not mentioned, don't guess

Return valid JSON only.`;

  try {
    const stream = await openai.responses.create({
      model: MODEL,
      input: [{ role: 'user', content: prompt }],
      stream: true,
    });

    let response = '';
    for await (const event of stream) {
      if (event.type === 'response.output_text.delta') {
        response += event.delta;
      }
    }

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const llmExtracted = JSON.parse(jsonMatch[0]);
      // Merge with existing context, LLM values take precedence
      return { ...existingContext, ...llmExtracted };
    }
    throw new Error('Could not parse LLM response');
  } catch (error) {
    console.error('LLM analysis error:', error);
    // Fallback: return existing context
    return existingContext;
  }
}

/**
 * Legacy analyzeQuery - kept for simple regex-based extraction as fallback
 */
function analyzeQuery(query, existingContext = {}) {
  const lowerQuery = query.toLowerCase();
  const extracted = { ...existingContext };
  
  // Keep simple regex for budget as fallback
  if (!extracted.budget) {
    const pricePatterns = [
      { regex: /\b(under|below|less than|max|maximum)\s*[$₹£€]?\s*(\d{3,5})\b/gi, extract: (m) => `Under $${m[2]}` },
      { regex: /\b(\d{3,5})\s*(?:INR|Rs\.?|rupees?)?\s*(?:or less|max|maximum)?\b/gi, extract: (m) => `₹${m[1]}` },
      { regex: /\b(\d{3,5})\s*[-~to]\s*(\d{3,5})\b/gi, extract: (m) => `$${m[1]}-$${m[2]}` },
      { regex: /\$[\d,]+(?:\.\d{2})?\b/g, extract: (m) => m[0] }
    ];
    
    for (const pattern of pricePatterns) {
      const match = pattern.regex.exec(query);
      if (match) {
        extracted.budget = pattern.extract(match);
        break;
      }
    }
  }
  
  return extracted;
}

/**
 * Determines what questions to ask based on missing mandatory/high-impact info
 */
function determineQuestions(extracted) {
  const questions = [];
  const askedAbout = new Set();
  
  // MANDATORY CRITERIA (must have these)
  
  if (!extracted.product) {
    questions.push({
      id: 'product',
      text: "What specific product are you looking for? (e.g., laptop, phone, earbuds, Arduino board)",
      priority: 'mandatory'
    });
    askedAbout.add('product');
  }
  
  if (!extracted.budget) {
    questions.push({
      id: 'budget',
      text: "What's your budget range? (e.g., under $500, $500-1000, $1000+)",
      priority: 'mandatory'
    });
    askedAbout.add('budget');
  }
  
  if (!extracted.region) {
    questions.push({
      id: 'region',
      text: "Which country/region are you shopping from? (This affects store availability)",
      priority: 'mandatory'
    });
    askedAbout.add('region');
  }
  
  // Only ask high-impact questions if we have all mandatory info
  if (questions.length === 0) {
    // HIGH IMPACT CRITERIA
    
    if (!extracted.useCase && extracted.product) {
      // Product-specific use case questions
      if (extracted.product.includes('Laptop')) {
        questions.push({
          id: 'useCase',
          text: "What will you mainly use it for? (gaming, work/studies, video editing, general use)",
          priority: 'high'
        });
      } else if (extracted.product.includes('Smartphone')) {
        questions.push({
          id: 'useCase',
          text: "What's most important to you? (camera, battery life, performance, or general use)",
          priority: 'high'
        });
      } else if (extracted.product.includes('Audio')) {
        questions.push({
          id: 'useCase',
          text: "Use case: gym/sports, commuting, office calls, or casual listening?",
          priority: 'high'
        });
      } else if (extracted.product.includes('Arduino')) {
        questions.push({
          id: 'useCase',
          text: "What project are you working on? (robotics, IoT, learning/beginner, professional)",
          priority: 'high'
        });
      }
    }
    
    if (!extracted.brand) {
      questions.push({
        id: 'brand',
        text: "Any brand preference? (or say 'no preference' for all brands)",
        priority: 'high'
      });
    }
    
    if (!extracted.condition) {
      questions.push({
        id: 'condition',
        text: "New or refurbished? (refurbished can save 20-40%)",
        priority: 'high'
      });
    }
  }
  
  // Limit to max 3 questions at a time
  return questions.slice(0, 3);
}

// ═══════════════════════════════════════
// CLARIFICATION PROMPT
// ═══════════════════════════════════════

const CLARIFICATION_PROMPT = `You are ElectroFind, a helpful electronics shopping assistant. Your goal is to understand the user's needs before searching for products.

CONVERSATION CONTEXT:
{context}

USER QUERY: {query}

EXTRACTED INFORMATION:
{extracted_info}

MISSING INFORMATION:
{missing_info}

QUESTIONS TO ASK:
{questions}

INSTRUCTIONS:
1. Acknowledge what you already understand from their query
2. Ask ONLY the questions listed above (max 3)
3. Be conversational and friendly, not robotic
4. Don't overwhelm with options or tables
5. Keep your response brief and focused

Respond in this exact JSON format:
{
  "phase": "clarification",
  "message": "Your conversational response here...",
  "extracted": { /* the extracted info object */ },
  "questionsAsked": ["question_id_1", "question_id_2"],
  "awaitingUserResponse": true
}

Output ONLY the JSON, nothing else:`;

// ═══════════════════════════════════════
// SEARCH READY PROMPT
// ═══════════════════════════════════════

const SEARCH_READY_PROMPT = `You are ElectroFind's search optimizer. Based on the complete user context, generate a precise search query.

CONVERSATION HISTORY:
{context}

EXTRACTED USER PREFERENCES:
{extracted}

INSTRUCTIONS:
- expanded_query must be under 150 characters
- End with "buy online price" or "lowest price store"
- Include region-specific stores
- price_range min/max must be numbers or null

Output ONLY this JSON:
{
  "phase": "search_ready",
  "original_query": "<original>",
  "user_preferences": {
    "product": "<product>",
    "budget": "<budget>",
    "region": "<region>",
    "use_case": "<use case>",
    "brand": "<brand>",
    "condition": "<new/refurbished>"
  },
  "expanded_query": "<optimized search under 150 chars>",
  "product_category": "<category>",
  "price_range": {
    "min": <number or null>,
    "max": <number or null>,
    "currency": "<USD/INR/GBP>"
  },
  "region_stores": ["<store1>", "<store2>"]
}`;

// Check if query is a buy intent
function isBuyIntent(query) {
  const buyKeywords = [
    'buy', 'purchase', 'shop', 'price', 'deal', 'best', 'cheap', 'affordable',
    'under $', 'under ₹', 'under £', 'looking for', 'recommend', 'suggest',
    'where to buy', 'where can i find', 'want to get', 'need a', 'searching for',
    'get me', 'find me', 'help me find'
  ];
  const lowerQuery = query.toLowerCase();
  return buyKeywords.some(kw => lowerQuery.includes(kw)) || 
         query.match(/laptop|phone|earbuds?|headphones?|monitor|tv|camera|console|tablet|speaker|watch|arduino/gi);
}

// Get region-specific stores - ALWAYS returns actual domain names
function getRegionStores(region) {
  const regionLower = (region || '').toLowerCase();
  if (regionLower.includes('india')) {
    return ['amazon.in', 'flipkart.com', 'croma.com', 'reliancedigital.in', 'tatacliq.com'];
  }
  if (regionLower.includes('uk') || regionLower.includes('britain')) {
    return ['amazon.co.uk', 'currys.co.uk', 'argos.co.uk', 'johnlewis.com'];
  }
  if (regionLower.includes('canada')) {
    return ['amazon.ca', 'bestbuy.ca', 'newegg.ca'];
  }
  return ['amazon.com', 'bestbuy.com', 'newegg.com', 'walmart.com', 'bhphotovideo.com'];
}

// Map display names to actual domains
const STORE_DOMAIN_MAP = {
  'amazon.in': 'amazon.in',
  'amazon.com': 'amazon.com', 
  'amazon.co.uk': 'amazon.co.uk',
  'amazon.ca': 'amazon.ca',
  'flipkart.com': 'flipkart.com',
  'croma.com': 'croma.com',
  'reliancedigital.in': 'reliancedigital.in',
  'tatacliq.com': 'tatacliq.com',
  'bestbuy.com': 'bestbuy.com',
  'bestbuy.ca': 'bestbuy.ca',
  'newegg.com': 'newegg.com',
  'newegg.ca': 'newegg.ca',
  'walmart.com': 'walmart.com',
  'currys.co.uk': 'currys.co.uk',
  'argos.co.uk': 'argos.co.uk',
  // Handle display names that might come from LLM
  'amazon india': 'amazon.in',
  'amazon': 'amazon.com',
  'flipkart': 'flipkart.com',
  'croma': 'croma.com',
  'reliance digital': 'reliancedigital.in',
  'best buy': 'bestbuy.com',
  'walmart': 'walmart.com'
};

// Parse price range from budget string
function parsePriceRange(budget) {
  if (!budget) return { min: null, max: null, currency: 'USD' };
  
  const lower = budget.toLowerCase();
  
  // Detect currency
  let currency = 'USD';
  if (lower.includes('₹')) currency = 'INR';
  else if (lower.includes('£')) currency = 'GBP';
  else if (lower.includes('€')) currency = 'EUR';
  
  // Parse range
  const rangeMatch = lower.match(/(\d{3,5})\s*[-~to]+\s*(\d{3,5})/);
  if (rangeMatch) {
    return { min: parseInt(rangeMatch[1]), max: parseInt(rangeMatch[2]), currency };
  }
  
  // Parse "under X"
  const underMatch = lower.match(/(?:under|below|less than|max)\s*[$₹£€]?\s*(\d{3,5})/);
  if (underMatch) {
    return { min: null, max: parseInt(underMatch[1]), currency };
  }
  
  // Parse single amount
  const singleMatch = lower.match(/[$₹£€]\s*(\d{3,5})/);
  if (singleMatch) {
    const amount = parseInt(singleMatch[1]);
    return { min: amount * 0.8, max: amount * 1.2, currency };
  }
  
  return { min: null, max: null, currency };
}

// Phase 1: Get clarification
async function getClarification(query, sessionState) {
  const existingExtracted = sessionState?.extracted || {};
  const conversationHistory = sessionState?.messages || [];
  
  // Analyze what we know and what's missing
  const extracted = analyzeQuery(query, existingExtracted);
  const questions = determineQuestions(extracted);
  
  // Build context string
  const contextStr = conversationHistory.length > 0 
    ? conversationHistory.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n')
    : 'New conversation';
  
  const extractedStr = Object.entries(extracted)
    .filter(([k, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n') || 'None yet';
  
  const missingStr = questions.map(q => `- ${q.id} (${q.priority}): ${q.text}`).join('\n');
  const questionsStr = questions.map(q => q.text).join('\n');
  
  const prompt = CLARIFICATION_PROMPT
    .replace('{context}', contextStr)
    .replace('{query}', query)
    .replace('{extracted_info}', extractedStr)
    .replace('{missing_info}', missingStr)
    .replace('{questions}', questionsStr);

  try {
    const stream = await openai.responses.create({
      model: MODEL,
      input: [{ role: 'user', content: prompt }],
      stream: true,
    });

    let response = '';
    for await (const event of stream) {
      if (event.type === 'response.output_text.delta') {
        response += event.delta;
      }
    }

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      return {
        ...data,
        extracted: extracted,
        questions: questions,
        readyToSearch: questions.length === 0 || questions.every(q => q.priority !== 'mandatory')
      };
    }
    throw new Error('Could not parse JSON');
  } catch (error) {
    console.error('Error getting clarification:', error);
    // Fallback - simple questions
    const fallbackQuestions = questions.length > 0 ? questions : [
      { id: 'product', text: 'What product are you looking for?', priority: 'mandatory' },
      { id: 'budget', text: 'What is your budget?', priority: 'mandatory' }
    ];
    
    return {
      phase: 'clarification',
      message: `I want to help you find the best deals! ${fallbackQuestions.map(q => q.text).join(' ')}`,
      extracted: extracted,
      questions: fallbackQuestions,
      questionsAsked: fallbackQuestions.map(q => q.id),
      awaitingUserResponse: true,
      readyToSearch: false
    };
  }
}

// Phase 2: Get search ready
async function getSearchReady(sessionState) {
  const extracted = sessionState.extracted || {};
  const priceRange = parsePriceRange(extracted.budget);
  const regionStores = getRegionStores(extracted.region);
  
  const contextStr = (sessionState.messages || []).slice(-6)
    .map(m => `${m.role}: ${m.content}`).join('\n');
  
  const prompt = SEARCH_READY_PROMPT
    .replace('{context}', contextStr)
    .replace('{extracted}', JSON.stringify(extracted, null, 2));

  try {
    const stream = await openai.responses.create({
      model: MODEL,
      input: [{ role: 'user', content: prompt }],
      stream: true,
    });

    let response = '';
    for await (const event of stream) {
      if (event.type === 'response.output_text.delta') {
        response += event.delta;
      }
    }

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      // Ensure stores are set
      if (!data.region_stores || data.region_stores.length === 0) {
        data.region_stores = regionStores;
      }
      // Ensure price range is set
      if (!data.price_range || data.price_range.min === undefined) {
        data.price_range = priceRange;
      }
      return data;
    }
    throw new Error('Could not parse JSON');
  } catch (error) {
    console.error('Error getting search ready:', error);
    // Fallback
    return {
      phase: 'search_ready',
      original_query: extracted.product || 'electronics',
      user_preferences: extracted,
      expanded_query: `${extracted.product || 'electronics'} ${extracted.brand || ''} ${extracted.useCase || ''} buy online price`.substring(0, 150),
      product_category: extracted.product || 'Electronics',
      price_range: priceRange,
      region_stores: regionStores
    };
  }
}

// ═══════════════════════════════════════
// TAVILY SEARCH WITH STRICT FILTERING
// ═══════════════════════════════════════

function normalizeDomains(stores) {
  if (!Array.isArray(stores)) return ['amazon.com'];
  
  return stores.map(store => {
    const lower = store.toLowerCase().trim();
    // Check if it's already a valid domain
    if (lower.includes('.')) return lower;
    // Map display names to domains
    return STORE_DOMAIN_MAP[lower] || lower;
  }).filter(Boolean);
}

async function performBuySearch(searchData, sessionId) {
  try {
    const searchQuery = searchData.expanded_query;
    // Normalize stores to actual domains
    const rawStores = searchData.region_stores || getRegionStores(searchData.user_preferences?.region);
    const regionStores = normalizeDomains(rawStores);
    
    console.log('Tavily search:', searchQuery);
    console.log('Raw stores:', rawStores);
    console.log('Normalized stores:', regionStores);

    const response = await tavilyClient.search(searchQuery, {
      search_depth: 'advanced',
      include_answer: false,
      include_raw_content: true,
      max_results: 15,
      include_domains: regionStores,
      exclude_domains: [
        'reddit.com', 'youtube.com', 'pinterest.com', 'quora.com',
        'twitter.com', 'medium.com'
      ]
    });

    let tavilyResults = response.results || [];
    const totalRaw = tavilyResults.length;
    console.log('Raw results:', totalRaw);

    // SMART FILTERING - Detect buy pages by signals, not just domain
    const EXCLUDED_DOMAINS = [
      'reddit.com', 'youtube.com', 'pinterest.com', 'quora.com',
      'twitter.com', 'medium.com', 'github.com',
      'stackoverflow.com', 'wikipedia.org', 'blog.', 'forum.',
      'news.', 'review.', 'compare.', 'vs.'
    ];
    
    // Buy signals that indicate this is a purchase page
    const BUY_SIGNALS = [
      /add\s*to\s*cart/i,
      /buy\s*now/i,
      /purchase/i,
      /checkout/i,
      /add\s*to\s*bag/i,
      /order\s*now/i,
      /shop\s*now/i
    ];
    
    // Product page URL patterns
    const PRODUCT_PATTERNS = [
      /\/(product|item|dp|p|goods)\//i,
      /\/(buy|shop|store)\//i,
      /\?.*product/i,
      /\/[a-z0-9-]+\/[a-z0-9-]+\/\d+/i  // common product URL structure
    ];
    
    let validResults = [];
    
    for (const result of tavilyResults) {
      const content = result.content || '';
      const url = result.url || '';
      const title = result.title || '';
      
      // Skip excluded domains (social, forums, blogs, news)
      if (EXCLUDED_DOMAINS.some(d => url.includes(d))) {
        console.log('Excluded domain:', url);
        continue;
      }
      
      // Must have price
      const priceMatch = content.match(/[\$₹£€]\s*[\d,]+(?:\.\d{2})?/);
      if (!priceMatch) {
        console.log('No price found:', url);
        continue;
      }
      
      // Check for buy signals (add to cart, buy now, etc.)
      const hasBuySignals = BUY_SIGNALS.some(signal => signal.test(content));
      
      // Check for product page URL patterns
      const isProductUrl = PRODUCT_PATTERNS.some(pattern => pattern.test(url));
      
      // Check for availability/stock indicators
      const hasStockInfo = /in\s*stock|available|ships?|delivery|shipping/i.test(content);
      
      // Check for product title/description indicators
      const hasProductInfo = /description|specifications?|features?|details/i.test(content);
      
      // Score the result (need at least 2 strong signals or 3 weak ones)
      let score = 0;
      if (hasBuySignals) score += 2;
      if (isProductUrl) score += 2;
      if (hasStockInfo) score += 1;
      if (hasProductInfo) score += 1;
      
      // Must have minimum signals to be considered a buy page
      if (score >= 2) {
        console.log('Valid buy page:', url, 'Score:', score);
        validResults.push({...result, buySignals: {hasBuySignals, isProductUrl, hasStockInfo, hasProductInfo, score}});
      } else {
        console.log('Rejected (low score):', url, 'Score:', score);
      }
    }

    console.log('Valid results:', validResults.length, 'Total checked:', tavilyResults.length);

    // Fallback if needed
    let fallbackTriggered = false;
    if (validResults.length < 3 && totalRaw > 0) {
      fallbackTriggered = true;
      const fallbackResponse = await tavilyClient.search(searchQuery, {
        search_depth: 'advanced',
        include_raw_content: true,
        max_results: 15,
        include_domains: [...regionStores, 'google.com', 'pricespy.com']
      });
      
      const fallbackResults = fallbackResponse.results || [];
      for (const result of fallbackResults) {
        if (validResults.find(r => r.url === result.url)) continue;
        const content = result.content || '';
        if (/[\$₹£€]\s*[\d,]+/.test(content)) {
          validResults.push(result);
        }
      }
    }

    // Extract structured data
    let extractedResults = validResults.map((r, index) => {
      const content = r.content || '';
      const title = r.title || '';
      
      const priceMatch = content.match(/[\$₹£€]\s*[\d,]+(?:\.\d{2})?/);
      const price = priceMatch ? priceMatch[0].trim() : 'Price varies';
      const priceNumeric = parseFloat(price.replace(/[^\d.]/g, '')) || 999999;
      
      let currency = 'USD';
      if (price.includes('₹')) currency = 'INR';
      else if (price.includes('£')) currency = 'GBP';
      else if (price.includes('€')) currency = 'EUR';
      
      const domain = new URL(r.url).hostname.replace('www.', '');
      const storeMap = {
        'amazon.com': 'Amazon', 'amazon.in': 'Amazon India', 'amazon.co.uk': 'Amazon UK',
        'flipkart.com': 'Flipkart', 'bestbuy.com': 'Best Buy', 'croma.com': 'Croma'
      };
      const store = storeMap[domain] || domain.split('.')[0];
      
      let availability = 'In Stock';
      if (/out of stock|unavailable/i.test(content)) availability = 'Out of Stock';
      else if (/limited stock|few left/i.test(content)) availability = 'Limited Stock';
      
      return {
        rank: index + 1,
        product_title: title,
        store: store,
        price: price,
        price_numeric: priceNumeric,
        currency: currency,
        buy_link: r.url,
        availability: availability,
        description: content.substring(0, 120) + '...',
        deal_flag: /sale|discount|\d+% off/i.test(content),
        isAssured: false
      };
    });

    // Sort by price and take top 5
    extractedResults.sort((a, b) => a.price_numeric - b.price_numeric);
    extractedResults = extractedResults.slice(0, 5).map((r, i) => ({ ...r, rank: i + 1 }));

    // Add assured product in testing mode
    if (TESTING_MODE && extractedResults.length > 0) {
      const first = extractedResults[0];
      const assuredProduct = {
        rank: 1,
        product_title: first.product_title,
        store: DEMO_SELLER_CONFIG.displayName,
        storeId: DEMO_SELLER_CONFIG.sellerId,
        isAssured: true,
        price: first.price,
        price_numeric: first.price_numeric * 0.95,
        currency: first.currency,
        buy_link: first.buy_link,
        availability: 'In Stock',
        description: first.description,
        deal_flag: true,
        sku: `ASSURED-${Date.now()}`,
        sellerRating: DEMO_SELLER_CONFIG.rating
      };
      extractedResults = [assuredProduct, ...extractedResults.slice(1).map((r, i) => ({ ...r, rank: i + 2 }))];
    }

    return {
      search_status: extractedResults.length > 0 ? 'success' : 'failed',
      query_used: searchQuery,
      results: extractedResults,
      fallback_triggered: fallbackTriggered,
      error: extractedResults.length === 0 ? 'No purchasable listings found.' : null
    };
  } catch (error) {
    console.error('Search error:', error);
    return { search_status: 'failed', error: error.message, results: [] };
  }
}

// General chat response
async function getChatResponse(query, language = 'en') {
  const prompt = `You are ElectroFind, a helpful shopping assistant. Keep responses brief and focused on helping users find electronics.

User: ${query}

Assistant:`;

  try {
    const stream = await openai.responses.create({
      model: MODEL,
      input: [{ role: 'user', content: prompt }],
      stream: true,
    });

    let response = '';
    for await (const event of stream) {
      if (event.type === 'response.output_text.delta') {
        response += event.delta;
      }
    }
    return response.trim();
  } catch (error) {
    return "I'm here to help you find the best electronics. What are you looking for?";
  }
}

// ═══════════════════════════════════════
// SEARCH ENDPOINT
// ═══════════════════════════════════════

app.post('/api/search', async (req, res) => {
  const { query, language, sessionId = 'default', previousMessages = [] } = req.body;

  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    console.log('Query:', query, 'Session:', sessionId, 'Previous messages:', previousMessages.length);

    // Get or create session state
    let state = conversationState.get(sessionId);

    // If no state exists and we have previous messages, restore from them
    if (!state && previousMessages.length > 0) {
      state = {
        phase: 'restored',
        extracted: {},
        messages: previousMessages.map(m => ({
          role: m.role || (m.type === 'user' ? 'user' : 'assistant'),
          content: m.content,
          timestamp: Date.now()
        }))
      };
      // Try to extract product info from previous messages
      for (const msg of previousMessages) {
        if (msg.role === 'user' || msg.type === 'user') {
          const extracted = await analyzeQueryWithLLM(msg.content, state.extracted);
          const regexExtracted = analyzeQuery(msg.content, state.extracted);
          state.extracted = { ...state.extracted, ...regexExtracted, ...extracted };
        }
      }
      console.log('Restored state from previous messages:', state.extracted);
    }

    // Fallback to new state if still no state
    if (!state) {
      state = {
        phase: 'new',
        extracted: {},
        messages: []
      };
    }

    // Add user message to history
    state.messages.push({ role: 'user', content: query, timestamp: Date.now() });

    // Check if buy intent
    if (!isBuyIntent(query) && state.phase === 'new') {
      const response = await getChatResponse(query, language);
      state.messages.push({ role: 'assistant', content: response });
      conversationState.set(sessionId, state);
      
      return res.json({
        type: 'chat',
        response: response
      });
    }

    // Check if user is saying "I don't know" or similar
    const dontKnowPatterns = [
      "don't know", "dont know", "not sure", "no idea", "whatever", "anything",
      "you choose", "recommend", "suggest", "up to you", "doesn't matter",
      "skip", "pass", "nevermind", "any", "no preference"
    ];
    const isDontKnow = dontKnowPatterns.some(pattern => 
      query.toLowerCase().includes(pattern)
    );

    // Use LLM to analyze the query and extract information
    const llmExtracted = await analyzeQueryWithLLM(query, state.extracted);
    // Also run regex fallback for budget extraction
    const regexExtracted = analyzeQuery(query, state.extracted);
    
    // Merge: LLM takes precedence, regex as fallback
    state.extracted = { 
      ...state.extracted, 
      ...regexExtracted,
      ...llmExtracted 
    };
    
    console.log('LLM Extracted:', llmExtracted);
    console.log('Merged State:', state.extracted);
    
    // If user says "don't know", mark missing fields as "any" and search anyway
    if (isDontKnow) {
      if (!state.extracted.budget) state.extracted.budget = 'any';
      if (!state.extracted.region) state.extracted.region = 'India'; // Default to India
      if (!state.extracted.useCase) state.extracted.useCase = 'general';
    }
    
    // Check mandatory - we MUST have product, budget and region can be defaults
    const hasProduct = !!state.extracted.product;
    const hasBudget = !!state.extracted.budget;
    const hasRegion = !!state.extracted.region;
    
    // If we have product, we can search (use defaults for missing budget/region)
    if (!hasProduct || (!hasBudget && !isDontKnow) || (!hasRegion && !isDontKnow)) {
      // Build clarification message directly - NO LLM call to avoid hallucination
      const missing = [];
      if (!hasProduct) missing.push('what product you\'re looking for');
      if (!hasBudget && !isDontKnow) missing.push('your budget range');
      if (!hasRegion && !isDontKnow) missing.push('which country/region you\'re shopping from');
      
      let message = '';
      if (state.extracted.product || state.extracted.productName) {
        // We know something about the product
        const product = state.extracted.productName || state.extracted.product;
        message = `I see you're interested in ${product}. `;
      }
      
      message += `To help you find the best deals, I need to know ${missing.join(', ')}.`;
      
      // Add specific examples based on what's missing
      if (!hasProduct) {
        message += ' For example: "Radxa 4D", "Arduino board", "gaming laptop", etc.';
      }
      if (!hasBudget) {
        message += ' For example: "under ₹15,000", "$500-1000", "around 20k", etc.';
      }
      if (!hasRegion) {
        message += ' For example: "India", "USA", "UK", etc.';
      }
      
      state.phase = 'clarification';
      state.messages.push({ 
        role: 'assistant', 
        content: message,
        phase: 'clarification'
      });
      conversationState.set(sessionId, state);

      return res.json({
        type: 'buy',
        phase: 'clarification',
        message: message,
        extracted: state.extracted,
        questions: missing.map((m, i) => ({ id: `q${i}`, text: m, priority: 'mandatory' })),
        progress: {
          hasProduct: hasProduct,
          hasBudget: hasBudget,
          hasRegion: hasRegion
        }
      });
    }
    
    // If we reach here, we have enough info to search
    // Set defaults for any missing optional fields
    if (!state.extracted.budget) state.extracted.budget = 'any price';
    if (!state.extracted.region) state.extracted.region = 'India';

    // We have all mandatory info - perform search
    state.phase = 'searching';
    const searchData = await getSearchReady(state);
    const buyResults = await performBuySearch(searchData, sessionId);
    
    state.messages.push({ 
      role: 'assistant', 
      content: `Found ${buyResults.results.length} results`,
      phase: 'results'
    });
    conversationState.set(sessionId, state);

    // Build personalized intro
    const prefs = state.extracted;
    let intro = `Found the best deals for ${prefs.productName || prefs.product}`;
    if (prefs.budget && prefs.budget !== 'any' && prefs.budget !== 'any price') intro += ` within ${prefs.budget}`;
    if (prefs.region) intro += ` in ${prefs.region}`;
    if (prefs.useCase) intro += ` for ${prefs.useCase}`;
    intro += ':';

    return res.json({
      type: 'buy',
      phase: 'results',
      content: intro,
      results: buyResults.results,
      searchStatus: buyResults.search_status,
      fallbackTriggered: buyResults.fallback_triggered,
      extracted: state.extracted
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'An error occurred', details: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// STT - Speech to Text
app.post('/api/stt', upload.single('audio'), async (req, res) => {
  const language = req.body.language || 'en';
  const jobName = `stt-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  const s3Key = `uploads/${jobName}.wav`;

  if (!req.file) {
    return res.status(400).json({ error: 'Audio file required', transcript: '' });
  }

  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));

    await transcribeClient.send(new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      Media: { MediaFileUri: `s3://${S3_BUCKET}/${s3Key}` },
      MediaFormat: 'wav',
      LanguageCode: LANGUAGE_MAP[language] || 'en-US',
    }));

    const maxRetries = 30;
    for (let i = 0; i < maxRetries; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const response = await transcribeClient.send(new GetTranscriptionJobCommand({
        TranscriptionJobName: jobName,
      }));

      if (response.TranscriptionJob.TranscriptionJobStatus === 'COMPLETED') {
        const transcriptUrl = response.TranscriptionJob.Transcript.TranscriptFileUri;
        const fetchResponse = await fetch(transcriptUrl);
        const result = await fetchResponse.json();
        const transcript = result.results.transcripts[0].transcript;
        
        await cleanupTranscribe(jobName, s3Key);
        return res.json({ transcript: transcript.trim(), language });
      }
      
      if (response.TranscriptionJob.TranscriptionJobStatus === 'FAILED') {
        await cleanupTranscribe(jobName, s3Key);
        return res.status(500).json({ error: 'Transcription failed', transcript: '' });
      }
    }
    
    await cleanupTranscribe(jobName, s3Key);
    return res.status(500).json({ error: 'Transcription timeout', transcript: '' });
  } catch (error) {
    await cleanupTranscribe(jobName, s3Key);
    return res.status(500).json({ error: error.message, transcript: '' });
  }
});

async function cleanupTranscribe(jobName, s3Key) {
  try {
    if (jobName) await transcribeClient.send(new DeleteTranscriptionJobCommand({ TranscriptionJobName: jobName }));
    if (s3Key) await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: s3Key }));
  } catch (e) {}
}

// ═══════════════════════════════════════
// SELLER-SPECIFIC LLM CHAT SYSTEM
// ═══════════════════════════════════════

// Save seller's custom prompt
app.post('/api/seller/prompt', async (req, res) => {
  const { sellerId, prompt } = req.body;
  
  if (!sellerId || !prompt) {
    return res.status(400).json({ error: 'sellerId and prompt are required' });
  }
  
  sellerPrompts.set(sellerId, prompt);
  console.log(`Prompt saved for seller ${sellerId}`);
  res.json({ success: true, message: 'Prompt saved successfully' });
});

// Get seller's prompt
app.get('/api/seller/prompt/:sellerId', (req, res) => {
  const { sellerId } = req.params;
  const prompt = sellerPrompts.get(sellerId);
  
  if (!prompt) {
    // Return default prompt if not set
    return res.json({ 
      prompt: `Act as a senior technical sales engineer for ElectroFind. Your goal is to assist engineers and procurement managers in finding the right electronic components. Always verify stock availability before making commitments. Provide accurate technical specifications and competitive pricing. Be professional, helpful, and concise in your responses.`,
      isDefault: true 
    });
  }
  
  res.json({ prompt, isDefault: false });
});

// Start a new seller chat session
app.post('/api/seller/chat/start', async (req, res) => {
  const { sellerId, productData, userInfo } = req.body;
  
  if (!sellerId || !productData) {
    return res.status(400).json({ error: 'sellerId and productData are required' });
  }
  
  const sessionId = `seller-chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Get seller's prompt
  let sellerPrompt = sellerPrompts.get(sellerId);
  if (!sellerPrompt) {
    sellerPrompt = `Act as a senior technical sales engineer for ElectroFind. Your goal is to assist engineers and procurement managers in finding the right electronic components. Always verify stock availability before making commitments. Provide accurate technical specifications and competitive pricing. Be professional, helpful, and concise in your responses.`;
  }
  
  // Create welcome message with context
  const welcomeMessage = `Hello! Yes, the ${productData.product_title} is currently available at ${productData.price}. I'm here to help you with any questions about this product, shipping options, or placing an order. What would you like to know?`;
  
  // Store chat session
  const chatSession = {
    sessionId,
    sellerId,
    productData,
    userInfo: userInfo || {},
    sellerPrompt,
    messages: [
      { role: 'system', content: sellerPrompt },
      { role: 'assistant', content: welcomeMessage }
    ],
    createdAt: Date.now()
  };
  
  sellerChatSessions.set(sessionId, chatSession);
  console.log(`Chat session ${sessionId} started for seller ${sellerId}`);
  
  res.json({
    sessionId,
    message: welcomeMessage,
    productData
  });
});

// Send message in seller chat
app.post('/api/seller/chat/message', async (req, res) => {
  const { sessionId, message } = req.body;
  
  if (!sessionId || !message) {
    return res.status(400).json({ error: 'sessionId and message are required' });
  }
  
  const chatSession = sellerChatSessions.get(sessionId);
  if (!chatSession) {
    return res.status(404).json({ error: 'Chat session not found' });
  }
  
  // Add user message to history
  chatSession.messages.push({ role: 'user', content: message });
  
  // Build prompt with context
  const productContext = {
    product: chatSession.productData.product_title,
    price: chatSession.productData.price,
    store: chatSession.productData.store,
    sku: chatSession.productData.sku || 'N/A',
    userLocation: chatSession.userInfo?.location || 'Not specified',
    userBudget: chatSession.userInfo?.budget || 'Not specified'
  };
  
  const contextPrompt = `${chatSession.sellerPrompt}

CURRENT PRODUCT CONTEXT:
- Product: ${productContext.product}
- Price: ${productContext.price}
- Store: ${productContext.store}
- SKU: ${productContext.sku}
- User Location: ${productContext.userLocation}
- User Budget Range: ${productContext.userBudget}

IMPORTANT RESPONSE GUIDELINES:
1. Be conversational and friendly - like texting a friend who works at a store
2. Keep responses SHORT (2-4 sentences max)
3. NEVER use tables, markdown formatting, or bullet lists
4. Give key info only: price, availability, 1-2 main features
5. End with a question to keep the conversation going
6. If they want more details, they'll ask - don't overwhelm them

Example good responses:
- "Hey! These earbuds are in stock at ₹866. They're wireless with about 20 hours battery life. Want me to check delivery to your area?"
- "Yes! The Radxa 4D 8GB is available for ₹15,999. Great for development projects. When do you need it by?"
- "Absolutely! We've got them ready to ship. Price includes warranty. Any questions about compatibility?"

You are currently chatting with a customer. Be helpful, brief, and natural.`;

  try {
    // Prepare messages for OpenAI
    const apiMessages = [
      { role: 'system', content: contextPrompt },
      ...chatSession.messages.slice(1) // Skip the original system message, use our enhanced one
    ];
    
    const stream = await openai.responses.create({
      model: MODEL,
      input: apiMessages,
      stream: true,
    });

    let response = '';
    for await (const event of stream) {
      if (event.type === 'response.output_text.delta') {
        response += event.delta;
      }
    }
    
    // Add AI response to history
    chatSession.messages.push({ role: 'assistant', content: response });
    
    // Keep only last 20 messages to prevent context overflow
    if (chatSession.messages.length > 20) {
      chatSession.messages = [
        chatSession.messages[0], // Keep system prompt
        ...chatSession.messages.slice(-19)
      ];
    }
    
    res.json({
      message: response,
      sessionId,
      productContext
    });
    
  } catch (error) {
    console.error('Seller chat error:', error);
    res.status(500).json({ 
      error: 'Failed to generate response',
      fallbackMessage: "I apologize, I'm having trouble connecting right now. Please try again in a moment or contact support directly."
    });
  }
});

// Get chat history
app.get('/api/seller/chat/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const chatSession = sellerChatSessions.get(sessionId);
  
  if (!chatSession) {
    return res.status(404).json({ error: 'Chat session not found' });
  }
  
  res.json({
    sessionId,
    productData: chatSession.productData,
    messages: chatSession.messages.filter(m => m.role !== 'system') // Don't expose system prompt
  });
});

// End chat session
app.post('/api/seller/chat/end', (req, res) => {
  const { sessionId } = req.body;
  
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }
  
  const deleted = sellerChatSessions.delete(sessionId);
  res.json({ success: deleted, message: deleted ? 'Chat ended' : 'Session not found' });
});

// TTS - Text to Speech
app.post('/api/tts', async (req, res) => {
  const { text, language } = req.body;
  if (!text) return res.status(400).json({ error: 'Text required' });

  try {
    const command = new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: 'mp3',
      VoiceId: POLLY_VOICES[language] || 'Joanna',
      LanguageCode: LANGUAGE_MAP[language] || 'en-US',
    });

    const response = await pollyClient.send(command);
    const chunks = [];
    for await (const chunk of response.AudioStream) chunks.push(chunk);
    const audioBuffer = Buffer.concat(chunks);

    res.set('Content-Type', 'audio/mpeg');
    res.send(audioBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════
// USER CHAT HISTORY API
// ═══════════════════════════════════════

/**
 * Generate chat title using LLM
 */
async function generateChatTitle(messages) {
  try {
    // Get first user message or first few messages for context
    const userMessages = messages.filter(m => m.type === 'user' || m.role === 'user');
    if (userMessages.length === 0) return 'New Chat';

    const firstMessage = userMessages[0].content || userMessages[0].message || '';
    if (!firstMessage) return 'New Chat';

    const prompt = `Generate a short, descriptive title (3-5 words max) for a chat that starts with this user message: "${firstMessage.substring(0, 200)}"

Requirements:
- Maximum 5 words
- Capture the main intent of the query
- Be concise and clear
- Return ONLY the title, nothing else

Examples:
- User: "I want to buy a laptop under $1000" -> "Laptop Purchase Inquiry"
- User: "Tell me about Arduino boards" -> "Arduino Board Research"
- User: "Compare iPhone 15 and Samsung S24" -> "iPhone vs Samsung Comparison"

Title:`;

    const stream = await openai.responses.create({
      model: MODEL,
      input: [{ role: 'user', content: prompt }],
      stream: true,
    });

    let response = '';
    for await (const event of stream) {
      if (event.type === 'response.output_text.delta') {
        response += event.delta;
      }
    }

    const title = response.trim().replace(/["']/g, '');
    return title || 'New Chat';
  } catch (error) {
    console.error('Error generating chat title:', error);
    // Fallback: use first 30 chars of first user message
    const firstMessage = messages.find(m => m.type === 'user' || m.role === 'user');
    if (firstMessage) {
      const content = firstMessage.content || firstMessage.message || '';
      return content.substring(0, 30) + (content.length > 30 ? '...' : '');
    }
    return 'New Chat';
  }
}

/**
 * POST /api/chat/create
 * Create a new chat for a user
 */
app.post('/api/chat/create', async (req, res) => {
  const { userId, chatId, title, messages = [] } = req.body;

  if (!userId || !chatId) {
    return res.status(400).json({ error: 'userId and chatId are required' });
  }

  try {
    // Generate title if not provided
    let chatTitle = title;
    if (!chatTitle && messages.length > 0) {
      chatTitle = await generateChatTitle(messages);
    }

    const chat = await createChat({
      userId,
      chatId,
      title: chatTitle || 'New Chat',
      messages,
    });

    res.json({ success: true, chat });
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

/**
 * GET /api/chat/list/:userId
 * Get all chats for a user
 */
app.get('/api/chat/list/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const chats = await getUserChats(userId);
    res.json({ success: true, chats });
  } catch (error) {
    console.error('Get user chats error:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

/**
 * GET /api/chat/:userId/:chatId
 * Get a specific chat
 */
app.get('/api/chat/:userId/:chatId', async (req, res) => {
  const { userId, chatId } = req.params;

  try {
    const chat = await getChat(userId, chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    res.json({ success: true, chat });
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

/**
 * POST /api/chat/update
 * Update chat messages and/or title
 */
app.post('/api/chat/update', async (req, res) => {
  const { userId, chatId, messages, title } = req.body;

  if (!userId || !chatId) {
    return res.status(400).json({ error: 'userId and chatId are required' });
  }

  try {
    // Generate title from first message if not provided and this is the first update
    let chatTitle = title;
    if (!chatTitle && messages && messages.length > 0) {
      const existingChat = await getChat(userId, chatId);
      if (!existingChat || existingChat.title === 'New Chat') {
        chatTitle = await generateChatTitle(messages);
      }
    }

    const chat = await updateChat({
      userId,
      chatId,
      messages,
      title: chatTitle,
    });

    res.json({ success: true, chat });
  } catch (error) {
    console.error('Update chat error:', error);
    res.status(500).json({ error: 'Failed to update chat' });
  }
});

/**
 * POST /api/chat/delete
 * Delete a specific chat
 */
app.post('/api/chat/delete', async (req, res) => {
  const { userId, chatId } = req.body;

  if (!userId || !chatId) {
    return res.status(400).json({ error: 'userId and chatId are required' });
  }

  try {
    const result = await deleteChat(userId, chatId);
    res.json(result);
  } catch (error) {
    console.error('Delete chat error:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

/**
 * POST /api/chat/delete-all
 * Delete all chats for a user
 */
app.post('/api/chat/delete-all', async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const result = await deleteAllUserChats(userId);
    res.json(result);
  } catch (error) {
    console.error('Delete all chats error:', error);
    res.status(500).json({ error: 'Failed to delete all chats' });
  }
});

/**
 * POST /api/chat/generate-title
 * Generate a title for a chat based on messages
 */
app.post('/api/chat/generate-title', async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  try {
    const title = await generateChatTitle(messages);
    res.json({ success: true, title });
  } catch (error) {
    console.error('Generate title error:', error);
    res.status(500).json({ error: 'Failed to generate title' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
