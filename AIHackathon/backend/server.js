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
const { createChat, getUserChats, getChat, updateChat, deleteChat, deleteAllUserChats, saveSellerUserChat, getSellerConversations, getSellerUserChat, updateSellerUserChat, updateConversationStatus, deleteSellerUserChat, incrementTotalQueries, incrementResolvedQueries, updateSellerPrompt, getSeller } = require('./dynamodb');
const whatsappService = require('./whatsappService');

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
const sellerWhatsappConfig = new Map(); // sellerId -> { recipientNumber }

// Store buy readiness tracking per session
const buyReadinessTracking = new Map(); // sessionId -> { lastChecked, isReady, notified }

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

const SEARCH_READY_PROMPT = `You are ElectroFind's search optimizer. Your goal is to find the LOWEST prices by searching beyond major platforms.

CONVERSATION HISTORY:
{context}

EXTRACTED USER PREFERENCES:
{extracted}

INSTRUCTIONS:
- Focus on finding LOWEST prices available across ALL platforms
- Search non-conventional marketplaces, local stores, niche retailers, and specialized e-commerce sites
- Crawl beyond Amazon/Flipkart - include smaller retailers, wholesale sites, and local dealers
- Look for: local electronics markets, wholesale distributors, refurbished specialists, direct manufacturer sales
- Include stores like: robu.in, electronicscomp.com, thingsbit.com, tanotis.com, robocraze.com, and similar niche electronics retailers
- expanded_query must be under 150 characters
- End with "buy online lowest price" or "best deal"
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
  "region_stores": ["<store1>", "<store2>", "<local-store>", "<niche-retailer>"]
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
// NICHE STORE LISTS BY REGION
// ═══════════════════════════════════════

const NICHE_STORES_BY_REGION = {
  india: [
    'robu.in', 'electronicscomp.com', 'thingsbit.com', 'tanotis.com',
    'robocraze.com', 'potentiallabs.com', 'rhydolabz.com', 'evelta.com',
    'sunrom.com', 'probots.co.in', 'techtonics.in', 'robokits.co.in',
    'vyrian.com', 'crazypi.in', 'biccamera.com', 'devicemart.in',
    'transistorman.in', 'mechatronics.in', 'hnhcart.com', 'fabtolab.com',
    'iotech.in', 'shop101.com', 'snapdeal.com', 'shopclues.com',
    'paytmmall.com', 'meesho.com', 'industrybuying.com', 'moglix.com',
    'toolsvilla.com', 'vguard.in', 'smartprix.com', 'pricedekho.com',
    'jiomart.com', 'sangeetha.com', 'poorvika.com', 'lotmobiles.com'
  ],
  usa: [
    'newegg.com', 'bhphotovideo.com', 'adorama.com', 'microcenter.com',
    'antonline.com', 'tigerdirect.com', 'provantage.com', 'cdw.com',
    'insight.com', 'pcmag.com', 'rakuten.com', 'overstock.com',
    'adorama.com', 'digi-key.com', 'mouser.com', 'arrow.com',
    'jameco.com', 'sparkfun.com', 'adafruit.com', 'robotshop.com'
  ],
  uk: [
    'currys.co.uk', 'argos.co.uk', 'johnlewis.com', 'scan.co.uk',
    'ebuyer.com', 'box.co.uk', 'overclockers.co.uk', 'ccl.co.uk',
    'laptopsdirect.co.uk', 'techradar.com', 'pimoroni.com',
    'rapidonline.com', 'rs-components.com', 'farnell.com'
  ]
};

// ═══════════════════════════════════════
// ENHANCED PRICE EXTRACTOR
// ═══════════════════════════════════════

function extractPrice(content, title = '') {
  const text = `${title} ${content}`.substring(0, 3000);
  
  // Priority ordered patterns - most specific first
  const patterns = [
    // Indian formats
    /(?:price|cost|mrp|offer|sale)[:\s]*(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{2})?)/i,
    /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{2})?)\s*(?:only|\/?\-)?/i,
    /([\d,]+)\s*\/?\-?\s*(?:Rs|INR|rupees)/i,
    // US formats
    /(?:price|cost|sale|offer)[:\s]*\$\s*([\d,]+(?:\.\d{2})?)/i,
    /\$\s*([\d,]+(?:\.\d{2})?)\s*(?:USD)?/,
    // UK formats  
    /£\s*([\d,]+(?:\.\d{2})?)/,
    // Generic with currency symbol
    /[\$₹£€]\s*([\d,]+(?:\.\d{2})?)/,
    // Price as plain number near price keywords (e.g. "Price: 15999")
    /(?:price|cost|buy for|available at|offer)[:\s]+([\d,]{3,7})/i,
    // Slash format: 15,999/-
    /([\d,]+)\s*\/\-/
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const raw = match[1].replace(/,/g, '');
      const num = parseFloat(raw);
      // Sanity check: price should be between 10 and 10,000,000
      if (num >= 10 && num <= 10000000) {
        // Detect currency
        let currency = 'USD';
        let symbol = '$';
        if (/₹|Rs\.?|INR|rupee/i.test(text.substring(0, 500))) { currency = 'INR'; symbol = '₹'; }
        else if (/£|GBP/i.test(text.substring(0, 500))) { currency = 'GBP'; symbol = '£'; }
        else if (/€|EUR/i.test(text.substring(0, 500))) { currency = 'EUR'; symbol = '€'; }
        
        return {
          display: `${symbol}${num.toLocaleString()}`,
          numeric: num,
          currency,
          found: true
        };
      }
    }
  }
  
  return { display: 'Check Price', numeric: 999999, currency: 'USD', found: false };
}

// ═══════════════════════════════════════
// DETECT IF URL IS A PRODUCT PAGE
// ═══════════════════════════════════════

function isProductPage(url, content) {
  const productUrlSignals = [
    /\/dp\//, /\/product\//, /\/p\/[A-Z0-9]/, /\/item\//, /\/buy\//,
    /\/shop\/[^/]+\/[^/]+/, /\/pd\//, /\/itm\//, /\/ip\//,
    /[?&]pid=/, /[?&]sku=/, /[?&]productId=/,
    /\/[A-Z0-9]{8,}/, // Amazon-style ASIN
  ];
  
  const productContentSignals = [
    /add to cart/i, /buy now/i, /add to bag/i, /checkout/i,
    /in stock/i, /out of stock/i, /ships in/i, /delivery/i,
    /add to wishlist/i, /quantity/i, /pincode/i, /serviceable/i
  ];
  
  const urlScore = productUrlSignals.filter(p => p.test(url)).length;
  const contentScore = productContentSignals.filter(p => p.test(content)).length;
  
  // It's a product page if URL has product signals OR content has 2+ buy signals
  return urlScore > 0 || contentScore >= 2;
}

// Define giants vs non-conventional platforms
const GIANT_STORES = [
  'amazon.in', 'amazon.com', 'amazon.co.uk', 'amazon.ca',
  'flipkart.com', 'croma.com', 'reliancedigital.in', 'tatacliq.com',
  'bestbuy.com', 'bestbuy.ca', 'walmart.com', 'target.com'
];

function isGiantStore(domain) {
  const lowerDomain = domain.toLowerCase();
  return GIANT_STORES.some(giant => lowerDomain.includes(giant));
}

// ═══════════════════════════════════════
// MULTI-QUERY PARALLEL TAVILY SEARCH
// ═══════════════════════════════════════

async function performBuySearch(searchData, sessionId) {
  const { expanded_query, user_preferences, price_range, product_category } = searchData;
  const region = (user_preferences?.region || 'india').toLowerCase();
  const product = user_preferences?.product || expanded_query;
  const budget = user_preferences?.budget || '';
  const brand = user_preferences?.brand || '';

  // Get niche stores for region
  const nicheStores = NICHE_STORES_BY_REGION[
    region.includes('india') ? 'india' :
    region.includes('uk') || region.includes('britain') ? 'uk' : 'usa'
  ];

  // ── BUILD 3 PARALLEL SEARCH QUERIES ──────────────────────────────

  // Query 1: Niche stores only — force Tavily away from giants
  const nicheQuery = `${product}${brand ? ' ' + brand : ''} buy online price site:${nicheStores.slice(0, 6).join(' OR site:')}`;

  // Query 2: Broad product search with buy intent signals
  const broadQuery = `${expanded_query} buy now price in stock`;

  // Query 3: Price comparison / shopping aggregator angle  
  const compareQuery = `${product}${budget ? ' ' + budget : ''} lowest price compare online ${region.includes('india') ? 'india' : ''}`;

  console.log('Running 3 parallel Tavily searches...');
  console.log('Query 1 (niche):', nicheQuery.substring(0, 100));
  console.log('Query 2 (broad):', broadQuery.substring(0, 100));
  console.log('Query 3 (compare):', compareQuery.substring(0, 100));

  const COMMON_EXCLUDE = [
    'reddit.com', 'youtube.com', 'pinterest.com', 'quora.com',
    'twitter.com', 'x.com', 'medium.com', 'github.com',
    'stackoverflow.com', 'wikipedia.org', 'blogspot.com',
    'wordpress.com', 'tumblr.com', 'linkedin.com',
    'facebook.com', 'instagram.com', 'tiktok.com',
    'bbc.com', 'cnn.com', 'nytimes.com', 'theverge.com',
    'techcrunch.com', 'engadget.com', 'gsmarena.com',
    'rtings.com', 'notebookcheck.net', 'tomshardware.com',
    'anandtech.com', 'digitaltrends.com', 'pcmag.com'
  ];

  // Run all 3 searches in parallel
  const [nicheResults, broadResults, compareResults] = await Promise.allSettled([
    tavilyClient.search(nicheQuery, {
      search_depth: 'advanced',
      include_raw_content: true,
      max_results: 15,
      exclude_domains: COMMON_EXCLUDE
    }),
    tavilyClient.search(broadQuery, {
      search_depth: 'advanced',
      include_raw_content: true,
      max_results: 15,
      exclude_domains: COMMON_EXCLUDE
    }),
    tavilyClient.search(compareQuery, {
      search_depth: 'basic', // basic is faster for compare
      include_raw_content: true,
      max_results: 10,
      exclude_domains: COMMON_EXCLUDE
    })
  ]);

  // Collect all results, tag their source tier
  let allResults = [];

  if (nicheResults.status === 'fulfilled') {
    const results = nicheResults.value?.results || [];
    results.forEach(r => allResults.push({ ...r, searchTier: 'niche' }));
    console.log(`Niche search: ${results.length} raw results`);
  }

  if (broadResults.status === 'fulfilled') {
    const results = broadResults.value?.results || [];
    results.forEach(r => allResults.push({ ...r, searchTier: 'broad' }));
    console.log(`Broad search: ${results.length} raw results`);
  }

  if (compareResults.status === 'fulfilled') {
    const results = compareResults.value?.results || [];
    results.forEach(r => allResults.push({ ...r, searchTier: 'compare' }));
    console.log(`Compare search: ${results.length} raw results`);
  }

  console.log(`Total raw results across all searches: ${allResults.length}`);

  // ── DEDUPLICATE by domain (keep first occurrence per domain) ─────
  const seenDomains = new Set();
  const seenUrls = new Set();
  
  allResults = allResults.filter(r => {
    if (!r.url) return false;
    if (seenUrls.has(r.url)) return false;
    seenUrls.add(r.url);
    
    try {
      const domain = new URL(r.url).hostname.replace('www.', '');
      // Allow max 2 results per domain
      const domainCount = [...seenDomains].filter(d => d === domain).length;
      if (domainCount >= 2) return false;
      seenDomains.add(domain);
      return true;
    } catch {
      return false;
    }
  });

  // ── FILTER & SCORE EACH RESULT ───────────────────────────────────

  const SKIP_URL_PATTERNS = [
    /\/category\//i, /\/categories\//i, /\/collections\/?$/i,
    /\/search\?/, /\/tag\//, /\/blog\//, /\/news\//, /\/article\//,
    /\/review\//, /\/compare\//, /\/vs\//, /\/best-/
  ];

  const SKIP_DOMAINS = [
    ...COMMON_EXCLUDE,
    'indiamart.com', // Usually inquiry-based, no direct buy
  ];

  let scoredResults = [];

  for (const result of allResults) {
    const url = result.url || '';
    const content = result.content || '';
    const rawContent = result.raw_content || content;
    const title = result.title || '';

    // Skip bad domains
    if (SKIP_DOMAINS.some(d => url.includes(d))) continue;

    // Skip non-product pages
    if (SKIP_URL_PATTERNS.some(p => p.test(url))) continue;

    // Extract domain
    let domain;
    try {
      domain = new URL(url).hostname.replace('www.', '');
    } catch {
      continue;
    }

    // Extract price using enhanced extractor
    const priceData = extractPrice(rawContent || content, title);

    // Detect if actual product page
    const isProduct = isProductPage(url, rawContent || content);

    // Score this result (higher = better)
    let score = 0;

    // +30 if it has a real price
    if (priceData.found) score += 30;

    // +20 if it's a product page
    if (isProduct) score += 20;

    // +20 if from niche search (we specifically looked for niche)
    if (result.searchTier === 'niche') score += 20;

    // +10 if from niche store list
    if (nicheStores.some(s => domain.includes(s.replace('.com', '').replace('.in', '').replace('.co.uk', '')))) {
      score += 10;
    }

    // -20 if giant store (we want to deprioritize)
    if (isGiantStore(domain)) score -= 20;

    // +5 if has buy/cart signals in content
    if (/add to cart|buy now|add to bag/i.test(content)) score += 5;

    // +5 if has stock info
    if (/in stock|ships in|ready to ship/i.test(content)) score += 5;

    // Skip results with score < 10 (very likely not a buy page)
    if (score < 10 && !priceData.found) continue;

    // Build store name
    const storeNameMap = {
      'amazon.in': 'Amazon India', 'amazon.com': 'Amazon',
      'flipkart.com': 'Flipkart', 'croma.com': 'Croma',
      'reliancedigital.in': 'Reliance Digital', 'tatacliq.com': 'Tata CLiQ',
      'bestbuy.com': 'Best Buy', 'newegg.com': 'Newegg',
      'robu.in': 'Robu.in', 'electronicscomp.com': 'ElectronicsComp',
      'robocraze.com': 'Robocraze', 'thingsbit.com': 'ThingsBit',
      'tanotis.com': 'Tanotis', 'potentiallabs.com': 'Potential Labs',
      'evelta.com': 'Evelta', 'crazypi.in': 'CrazyPi',
      'rhydolabz.com': 'RhydoLabz', 'probots.co.in': 'Probots',
      'moglix.com': 'Moglix', 'industrybuying.com': 'IndustryBuying',
      'snapdeal.com': 'Snapdeal', 'paytmmall.com': 'Paytm Mall',
      'jiomart.com': 'JioMart', 'meesho.com': 'Meesho'
    };

    const storeName = storeNameMap[domain] ||
      domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);

    // Availability
    let availability = 'In Stock';
    if (/out of stock|unavailable|sold out/i.test(content)) availability = 'Out of Stock';
    else if (/limited stock|few left|hurry/i.test(content)) availability = 'Limited Stock';
    else if (/pre.?order/i.test(content)) availability = 'Pre-order';

    // Clean description — extract most relevant sentence
    const sentences = (rawContent || content)
      .replace(/\n+/g, ' ')
      .split(/[.!?]/)
      .map(s => s.trim())
      .filter(s => s.length > 30 && s.length < 200);
    
    // Find sentence with product name or specs
    const productWords = product.toLowerCase().split(' ');
    const bestSentence = sentences.find(s =>
      productWords.some(w => w.length > 3 && s.toLowerCase().includes(w))
    ) || sentences[0] || content.substring(0, 150);

    scoredResults.push({
      url,
      domain,
      title,
      score,
      searchTier: result.searchTier,
      priceData,
      isProduct,
      storeName,
      availability,
      description: bestSentence,
      isGiant: isGiantStore(domain),
      dealFlag: /sale|discount|\d+%\s*off|deal|offer/i.test(content),
      hasCartButton: /add to cart|buy now/i.test(content),
      inStock: !/out of stock|unavailable/i.test(content)
    });
  }

  console.log(`Scored results: ${scoredResults.length}`);

  // ── SORT: Score DESC, then price ASC within same score tier ──────
  scoredResults.sort((a, b) => {
    // Primary: score
    if (b.score !== a.score) return b.score - a.score;
    // Secondary: price (lower is better, but only if both have real prices)
    if (a.priceData.found && b.priceData.found) {
      return a.priceData.numeric - b.priceData.numeric;
    }
    // Results with prices rank above those without
    if (a.priceData.found && !b.priceData.found) return -1;
    if (!a.priceData.found && b.priceData.found) return 1;
    return 0;
  });

  // ── TAKE TOP 8, FORMAT OUTPUT ────────────────────────────────────
  let finalResults = scoredResults.slice(0, 8).map((r, i) => ({
    rank: i + 1,
    product_title: r.title,
    store: r.storeName,
    price: r.priceData.display,
    price_numeric: r.priceData.numeric,
    currency: r.priceData.currency,
    buy_link: r.url,
    availability: r.availability,
    description: r.description,
    deal_flag: r.dealFlag,
    has_cart_button: r.hasCartButton,
    is_product_page: r.isProduct,
    search_tier: r.searchTier,
    isAssured: false,
    isGiant: r.isGiant,
    domain: r.domain,
    score: r.score
  }));

  // ── ADD ASSURED PRODUCT (testing mode) ──────────────────────────
  if (TESTING_MODE && finalResults.length > 0) {
    // Use the highest-scored non-giant as the base for assured
    const assuredBase = finalResults.find(r => !r.isGiant) || finalResults[0];
    const assuredProduct = {
      rank: 1,
      product_title: assuredBase.product_title,
      store: DEMO_SELLER_CONFIG.displayName,
      storeId: DEMO_SELLER_CONFIG.sellerId,
      isAssured: true,
      price: assuredBase.price_numeric < 999999
        ? assuredBase.price
        : 'Contact for Price',
      price_numeric: assuredBase.price_numeric < 999999
        ? assuredBase.price_numeric * 0.95
        : 999999,
      currency: assuredBase.currency,
      buy_link: assuredBase.buy_link,
      availability: 'In Stock',
      description: assuredBase.description,
      deal_flag: true,
      has_cart_button: true,
      is_product_page: true,
      sku: `ASSURED-${Date.now()}`,
      sellerRating: DEMO_SELLER_CONFIG.rating
    };

    finalResults = [
      assuredProduct,
      ...finalResults.slice(0, 7).map((r, i) => ({ ...r, rank: i + 2 }))
    ];
  }

  // ── FALLBACK: if < 3 results, retry with broader query ──────────
  if (finalResults.length < 3) {
    console.log('Low results, running fallback search...');
    try {
      const fallbackResponse = await tavilyClient.search(
        `${product} price buy online`, {
          search_depth: 'advanced',
          include_raw_content: true,
          max_results: 20,
          exclude_domains: ['reddit.com', 'youtube.com']
        }
      );
      
      const fallbackResults = (fallbackResponse.results || [])
        .filter(r => !seenUrls.has(r.url))
        .slice(0, 5)
        .map((r, i) => {
          const priceData = extractPrice(r.raw_content || r.content || '', r.title);
          let domain;
          try { domain = new URL(r.url).hostname.replace('www.', ''); } catch { domain = 'unknown'; }
          return {
            rank: finalResults.length + i + 1,
            product_title: r.title,
            store: domain.split('.')[0],
            price: priceData.display,
            price_numeric: priceData.numeric,
            currency: priceData.currency,
            buy_link: r.url,
            availability: 'Check Site',
            description: (r.content || '').substring(0, 150),
            deal_flag: false,
            is_product_page: false,
            search_tier: 'fallback',
            isAssured: false,
            isGiant: isGiantStore(domain),
            domain
          };
        });
      
      finalResults = [...finalResults, ...fallbackResults];
    } catch (e) {
      console.error('Fallback search failed:', e.message);
    }
  }

  return {
    search_status: finalResults.length > 0 ? 'success' : 'failed',
    query_used: expanded_query,
    queries_run: [nicheQuery, broadQuery, compareQuery],
    results: finalResults,
    fallback_triggered: scoredResults.length < 3,
    tiers: {
      assured: TESTING_MODE ? 1 : 0,
      niche: scoredResults.filter(r => r.searchTier === 'niche').length,
      broad: scoredResults.filter(r => r.searchTier === 'broad').length,
      compare: scoredResults.filter(r => r.searchTier === 'compare').length
    },
    error: finalResults.length === 0 ? 'No purchasable listings found.' : null
  };
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

// Save seller's custom prompt (stored in DynamoDB)
app.post('/api/seller/prompt', async (req, res) => {
  const { sellerId, prompt } = req.body;
  
  if (!sellerId || !prompt) {
    return res.status(400).json({ error: 'sellerId and prompt are required' });
  }
  
  try {
    // Save to DynamoDB seller-table
    await updateSellerPrompt(sellerId, prompt);
    // Also update in-memory for current session
    sellerPrompts.set(sellerId, prompt);
    console.log(`Prompt saved for seller ${sellerId} in DynamoDB`);
    res.json({ success: true, message: 'Prompt saved successfully' });
  } catch (error) {
    console.error('Error saving prompt:', error);
    res.status(500).json({ error: 'Failed to save prompt' });
  }
});

// Get seller's prompt (from DynamoDB)
app.get('/api/seller/prompt/:sellerId', async (req, res) => {
  const { sellerId } = req.params;
  
  try {
    // First check DynamoDB
    const sellerData = await getSeller(sellerId);
    const dbPrompt = sellerData?.sellerPrompt;
    
    // If found in DB, use it
    if (dbPrompt) {
      // Also cache in memory
      sellerPrompts.set(sellerId, dbPrompt);
      return res.json({ prompt: dbPrompt, isDefault: false });
    }
    
    // Check in-memory cache
    const memoryPrompt = sellerPrompts.get(sellerId);
    if (memoryPrompt) {
      return res.json({ prompt: memoryPrompt, isDefault: false });
    }
    
    // Return default prompt
    const defaultPrompt = `Act as a senior technical sales engineer for ElectroFind. Your goal is to assist engineers and procurement managers in finding the right electronic components. Always verify stock availability before making commitments. Provide accurate technical specifications and competitive pricing. Be professional, helpful, and concise in your responses.`;
    
    res.json({ 
      prompt: defaultPrompt,
      isDefault: true 
    });
  } catch (error) {
    console.error('Error getting prompt:', error);
    // Return default on error
    res.json({ 
      prompt: `Act as a senior technical sales engineer for ElectroFind. Your goal is to assist engineers and procurement managers in finding the right electronic components. Always verify stock availability before making commitments. Provide accurate technical specifications and competitive pricing. Be professional, helpful, and concise in your responses.`,
      isDefault: true 
    });
  }
});

// ═══════════════════════════════════════
// SELLER STATS API (totalQueries, resolvedQueries)
// ═══════════════════════════════════════

/**
 * POST /api/seller/stats/query
 * Increment totalQueries when user clicks product tile
 */
app.post('/api/seller/stats/query', async (req, res) => {
  const { sellerId } = req.body;
  
  if (!sellerId) {
    return res.status(400).json({ error: 'sellerId is required' });
  }
  
  try {
    const result = await incrementTotalQueries(sellerId);
    res.json({ 
      success: true, 
      stats: {
        totalQueries: result.totalQueries || 0,
        resolvedQueries: result.resolvedQueries || 0
      }
    });
  } catch (error) {
    console.error('[Seller Stats] Error incrementing totalQueries:', error);
    res.status(500).json({ error: 'Failed to update stats' });
  }
});

/**
 * POST /api/seller/stats/resolved
 * Increment resolvedQueries when WhatsApp notification is sent
 */
app.post('/api/seller/stats/resolved', async (req, res) => {
  const { sellerId } = req.body;
  
  if (!sellerId) {
    return res.status(400).json({ error: 'sellerId is required' });
  }
  
  try {
    const result = await incrementResolvedQueries(sellerId);
    res.json({ 
      success: true, 
      stats: {
        totalQueries: result.totalQueries || 0,
        resolvedQueries: result.resolvedQueries || 0
      }
    });
  } catch (error) {
    console.error('[Seller Stats] Error incrementing resolvedQueries:', error);
    res.status(500).json({ error: 'Failed to update stats' });
  }
});

/**
 * GET /api/seller/stats/:sellerId
 * Get all stats for a seller
 */
app.get('/api/seller/stats/:sellerId', async (req, res) => {
  const { sellerId } = req.params;
  
  if (!sellerId) {
    return res.status(400).json({ error: 'sellerId is required' });
  }
  
  try {
    const sellerData = await getSeller(sellerId);
    
    if (!sellerData) {
      return res.status(404).json({ error: 'Seller not found' });
    }
    
    const totalQueries = sellerData.totalQueries || 0;
    const resolvedQueries = sellerData.resolvedQueries || 0;
    const conversionRate = totalQueries > 0 
      ? Math.round((resolvedQueries / totalQueries) * 100) 
      : 0;
    
    res.json({
      success: true,
      stats: {
        totalQueries,
        resolvedQueries,
        ordersPlaced: sellerData.ordersPlaced || 0,
        orderVolume: sellerData.orderVolume || 0,
        conversionRate: `${conversionRate}%`
      }
    });
  } catch (error) {
    console.error('[Seller Stats] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
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
  
  // ═══════════════════════════════════════
  // BUY READINESS AGENT - Check if user is ready to buy
  // ═══════════════════════════════════════
  let buyReadinessAssessment = null;
  let whatsappNotification = null;
  
  try {
    // Analyze buy readiness in parallel with generating response
    buyReadinessAssessment = await analyzeBuyReadiness(sessionId, message, chatSession);
    
    // If ready to buy with high confidence and not already notified, send WhatsApp
    const tracking = buyReadinessTracking.get(sessionId);
    if (buyReadinessAssessment.ready_to_buy && 
        buyReadinessAssessment.confidence >= 80 && 
        !tracking?.notified) {
      whatsappNotification = await sendBuyReadinessNotification(
        chatSession.sellerId, 
        chatSession, 
        buyReadinessAssessment
      );
    }
  } catch (error) {
    console.error('Buy readiness check error:', error);
    // Continue with chat even if buy readiness check fails
  }
  
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
7. If user shows clear buying intent, be ready to guide them to complete the purchase

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
    
    // Prepare response with buy readiness info
    const responsePayload = {
      message: response,
      sessionId,
      productContext
    };
    
    // Include buy readiness info in development/testing mode
    if (buyReadinessAssessment) {
      responsePayload.buyReadiness = {
        isReady: buyReadinessAssessment.ready_to_buy,
        confidence: buyReadinessAssessment.confidence,
        signals: buyReadinessAssessment.signals,
        nextAction: buyReadinessAssessment.next_action
      };
      
      if (whatsappNotification) {
        responsePayload.whatsappNotification = whatsappNotification;
      }
    }
    
    res.json(responsePayload);
    
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

// Analyze conversation with LLM to extract key information
app.post('/api/seller/chat/analyze', async (req, res) => {
  const { sellerId, sessionId, triggerMessage, conversationHistory, productInfo, userInfo } = req.body;
  
  if (!sellerId || !triggerMessage) {
    return res.status(400).json({ error: 'sellerId and triggerMessage are required' });
  }
  
  try {
    // Build conversation context
    const conversationContext = conversationHistory && conversationHistory.length > 0
      ? conversationHistory.slice(-10).map(m => `${m.role}: ${m.content}`).join('\n')
      : 'No previous conversation';
    
    const prompt = `You are a sales intelligence analyzer. Analyze the customer conversation and extract key information.

PRODUCT CONTEXT:
- Product: ${productInfo?.name || 'Unknown'}
- Listed Price: ${productInfo?.price || 'Unknown'}

FULL CONVERSATION:
${conversationContext}

CUSTOMER'S LATEST MESSAGE: "${triggerMessage}"

Analyze the conversation and extract the following information using LLM reasoning (NOT regex):

1. **purchaseIntent**: Is the customer ready to buy? (yes/no/maybe)
   - Look for: buying signals, commitment language, questions about payment/delivery
   - Consider conversation context, not just latest message

2. **customerAddress**: Has the customer provided their address/location?
   - Extract the full address if mentioned (street, city, state, pincode)
   - Return null if no address found

3. **bargainPrice**: Has the customer mentioned a bargain/negotiated price?
   - Extract the price they are offering (e.g., "₹800", "1000 rupees")
   - Return null if no bargain mentioned

4. **wantsHuman**: Does the customer want to talk to a human?
   - Look for: human, agent, call me, talk to someone, customer service, phone call
   - Return true/false

5. **shouldNotify**: Should we notify the seller about this conversation?
   - Return true if: purchaseIntent is "yes" or "maybe", OR wantsHuman is true, OR bargainPrice is mentioned, OR address is provided
   - Return false only for casual inquiries with no buying signals

Return ONLY valid JSON in this exact format:
{
  "purchaseIntent": "yes/no/maybe",
  "customerAddress": "extracted address or null",
  "bargainPrice": "extracted price or null",
  "wantsHuman": true/false,
  "shouldNotify": true/false,
  "reasoning": "brief explanation of your analysis"
}

Rules:
- Extract information from the ENTIRE conversation context, not just the latest message
- Use null for any field where information is not found (do not use empty strings)
- Be smart about context - if they said "I want to buy" earlier and now ask "Can you deliver to Mumbai?", capture both intent and address
- Purchase intent can be inferred from cumulative signals across the conversation
- Return valid JSON only, no markdown formatting`;

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
    if (!jsonMatch) {
      throw new Error('Could not parse LLM response');
    }
    
    const analysis = JSON.parse(jsonMatch[0]);
    
    console.log(`[Chat Analyze] LLM Analysis:`, analysis);
    
    res.json({
      shouldNotify: analysis.shouldNotify,
      extractedInfo: {
        purchaseIntent: analysis.purchaseIntent,
        customerAddress: analysis.customerAddress,
        bargainPrice: analysis.bargainPrice,
        wantsHuman: analysis.wantsHuman,
        reasoning: analysis.reasoning
      }
    });
    
  } catch (error) {
    console.error('[Chat Analyze] Error:', error);
    // Default to not notifying on error
    res.json({ 
      shouldNotify: false,
      extractedInfo: {
        purchaseIntent: 'unknown',
        customerAddress: null,
        bargainPrice: null,
        wantsHuman: false,
        reasoning: 'Analysis failed: ' + error.message
      }
    });
  }
});

// Send WhatsApp notification for purchase intent/human intervention
app.post('/api/seller/chat/notify', async (req, res) => {
  const { sellerId, sessionId, conversationHistory, extractedInfo, productInfo, userInfo } = req.body;
  
  if (!sellerId) {
    return res.status(400).json({ error: 'sellerId is required' });
  }
  
  // Get WhatsApp config for seller
  const config = sellerWhatsappConfig.get(sellerId);
  const recipientNumber = config?.recipientNumber;
  
  if (!recipientNumber) {
    return res.status(400).json({ error: 'Recipient number not configured' });
  }
  
  // Check WhatsApp connection status
  const status = whatsappService.getStatus(sellerId);
  if (!status.connected) {
    return res.status(503).json({ error: 'WhatsApp not connected', connected: false });
  }
  
  try {
    // Build notification message
    const timestamp = new Date().toLocaleString('en-IN', { 
      dateStyle: 'short', 
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata'
    });
    
    // Format conversation summary
    const conversationSummary = conversationHistory && conversationHistory.length > 0 
      ? conversationHistory.slice(-4).map(m => `${m.role}: ${m.content.substring(0, 100)}${m.content.length > 100 ? '...' : ''}`).join('\n')
      : 'No conversation history available';
    
    // Determine notification type based on extracted info
    let intentType = '👤 Customer Inquiry';
    if (extractedInfo?.wantsHuman) {
      intentType = '👤 Human Intervention Request';
    } else if (extractedInfo?.purchaseIntent === 'yes') {
      intentType = '🛒 High Purchase Intent';
    } else if (extractedInfo?.purchaseIntent === 'maybe') {
      intentType = '🤔 Moderate Purchase Interest';
    } else if (extractedInfo?.bargainPrice) {
      intentType = '💰 Bargain Offer Received';
    } else if (extractedInfo?.customerAddress) {
      intentType = '📍 Delivery Address Shared';
    }
    
    // Build extracted info section
    const extractedSection = [];
    if (extractedInfo?.purchaseIntent) {
      extractedSection.push(`🎯 *Purchase Intent:* ${extractedInfo.purchaseIntent.toUpperCase()}`);
    }
    if (extractedInfo?.customerAddress) {
      extractedSection.push(`📍 *Customer Address:* ${extractedInfo.customerAddress}`);
    }
    if (extractedInfo?.bargainPrice) {
      extractedSection.push(`💰 *Bargain Price:* ${extractedInfo.bargainPrice} (Listed: ${productInfo?.price || 'N/A'})`);
    }
    if (extractedInfo?.wantsHuman) {
      extractedSection.push(`📞 *Wants Human:* Yes`);
    }
    
    const message = `${intentType}

📅 *Time:* ${timestamp}

👤 *Customer:* ${userInfo?.name || 'Unknown'}
${userInfo?.location ? `📍 *Profile Location:* ${userInfo.location}` : ''}

📦 *Product:* ${productInfo?.name || 'Unknown'}
💰 *Listed Price:* ${productInfo?.price || 'Not specified'}
🔖 *SKU:* ${productInfo?.sku || 'N/A'}

${extractedSection.length > 0 ? '*EXTRACTED INFORMATION:*\n' + extractedSection.join('\n') : ''}

${extractedInfo?.reasoning ? `\n📝 *Analysis:* ${extractedInfo.reasoning}` : ''}

📝 *Recent Conversation:*
${conversationSummary}

⚡ *Action Required:* Follow up with customer immediately!

🔗 *Dashboard:* https://eindia.duckdns.org/

_This is an automated notification from ElectroFind._`;

    // Send WhatsApp message
    const result = await whatsappService.sendMessage(sellerId, recipientNumber, message);
    
    console.log(`[Chat Notify] WhatsApp notification sent to ${recipientNumber}`);
    
    res.json({ 
      success: true, 
      message: 'Notification sent successfully',
      recipient: recipientNumber,
      extractedInfo: extractedInfo,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Chat Notify] Failed to send WhatsApp notification:', error);
    
    // Check for specific error types
    if (error.message?.includes('No LID') || error.message?.includes('not have WhatsApp')) {
      return res.status(400).json({ 
        error: 'Recipient number may not have WhatsApp or needs to be in contacts first',
        details: error.message
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to send notification', 
      details: error.message 
    });
  }
});

// ═══════════════════════════════════════
// WHATSAPP INTEGRATION ENDPOINTS
// ═══════════════════════════════════════

// Initialize WhatsApp connection (returns QR code)
app.post('/api/whatsapp/connect', async (req, res) => {
  const { sellerId } = req.body;
  
  if (!sellerId) {
    return res.status(400).json({ error: 'sellerId is required' });
  }
  
  try {
    const result = await whatsappService.initializeClient(sellerId);
    res.json(result);
  } catch (error) {
    console.error('WhatsApp connect error:', error);
    res.status(500).json({ error: error.message || 'Failed to initialize WhatsApp' });
  }
});

// Get WhatsApp connection status
app.get('/api/whatsapp/status/:sellerId', (req, res) => {
  const { sellerId } = req.params;
  
  if (!sellerId) {
    return res.status(400).json({ error: 'sellerId is required' });
  }
  
  const status = whatsappService.getStatus(sellerId);
  res.json(status);
});

// Disconnect WhatsApp
app.post('/api/whatsapp/disconnect', async (req, res) => {
  const { sellerId } = req.body;
  
  if (!sellerId) {
    return res.status(400).json({ error: 'sellerId is required' });
  }
  
  try {
    const result = await whatsappService.disconnectClient(sellerId);
    res.json(result);
  } catch (error) {
    console.error('WhatsApp disconnect error:', error);
    res.status(500).json({ error: error.message || 'Failed to disconnect' });
  }
});

// Send WhatsApp message (for future use)
app.post('/api/whatsapp/send', async (req, res) => {
  const { sellerId, phoneNumber, message } = req.body;
  
  if (!sellerId || !phoneNumber || !message) {
    return res.status(400).json({ error: 'sellerId, phoneNumber, and message are required' });
  }
  
  try {
    const result = await whatsappService.sendMessage(sellerId, phoneNumber, message);
    res.json(result);
  } catch (error) {
    console.error('WhatsApp send error:', error);
    res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

// Get seller's WhatsApp configuration
app.get('/api/whatsapp/config/:sellerId', (req, res) => {
  const { sellerId } = req.params;
  
  if (!sellerId) {
    return res.status(400).json({ error: 'sellerId is required' });
  }
  
  // Get the connected client's phone number (sender)
  const status = whatsappService.getStatus(sellerId);
  const senderNumber = status.phoneNumber || null;
  
  // Get the configured recipient number
  const config = sellerWhatsappConfig.get(sellerId);
  const recipientNumber = config?.recipientNumber || '';
  
  res.json({ 
    senderNumber, 
    recipientNumber,
    connected: status.connected 
  });
});

// Save seller's WhatsApp recipient number
app.post('/api/whatsapp/config', async (req, res) => {
  const { sellerId, recipientNumber, sendTest } = req.body;
  
  if (!sellerId) {
    return res.status(400).json({ error: 'sellerId is required' });
  }
  
  sellerWhatsappConfig.set(sellerId, {
    recipientNumber: recipientNumber || ''
  });
  
  // Send test message if requested and number is provided
  if (sendTest && recipientNumber) {
    try {
      const testResult = await whatsappService.sendTestMessage(sellerId, recipientNumber);
      return res.json({ 
        success: true, 
        message: 'WhatsApp configuration saved and test message sent',
        testMessage: testResult
      });
    } catch (error) {
      console.error('Test message failed:', error);
      // Still save config even if test message fails
      return res.json({ 
        success: true, 
        message: 'WhatsApp configuration saved but test message failed',
        warning: error.message
      });
    }
  }
  
  res.json({ success: true, message: 'WhatsApp configuration saved' });
});

// Send test WhatsApp message
app.post('/api/whatsapp/test', async (req, res) => {
  const { sellerId } = req.body;
  
  if (!sellerId) {
    return res.status(400).json({ error: 'sellerId is required' });
  }
  
  const config = sellerWhatsappConfig.get(sellerId);
  const recipientNumber = config?.recipientNumber;
  
  if (!recipientNumber) {
    return res.status(400).json({ error: 'Recipient number not configured' });
  }
  
  try {
    const result = await whatsappService.sendTestMessage(sellerId, recipientNumber);
    res.json({ success: true, message: 'Test message sent', result });
  } catch (error) {
    console.error('Test message error:', error);
    res.status(500).json({ error: error.message || 'Failed to send test message' });
  }
});

// Send WhatsApp message to configured recipient
app.post('/api/whatsapp/send-to-recipient', async (req, res) => {
  const { sellerId, message } = req.body;
  
  if (!sellerId || !message) {
    return res.status(400).json({ error: 'sellerId and message are required' });
  }
  
  // Get the configured recipient number
  const config = sellerWhatsappConfig.get(sellerId);
  const recipientNumber = config?.recipientNumber;
  
  if (!recipientNumber) {
    return res.status(400).json({ error: 'Recipient number not configured' });
  }
  
  try {
    const result = await whatsappService.sendMessage(sellerId, recipientNumber, message);
    res.json(result);
  } catch (error) {
    console.error('WhatsApp send error:', error);
    res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

// ═══════════════════════════════════════
// SELLER-USER CHAT API (for Org Dashboard)
// ═══════════════════════════════════════

/**
 * POST /api/seller-user-chat/save
 * Save or update a seller-user conversation
 */
app.post('/api/seller-user-chat/save', async (req, res) => {
  const { sellerId, userEmail, sessionId, productData, messages, status, extractedInfo, whatsappNotified } = req.body;

  if (!sellerId || !userEmail || !sessionId) {
    return res.status(400).json({ error: 'sellerId, userEmail, and sessionId are required' });
  }

  try {
    const chat = await saveSellerUserChat({
      sellerId,
      userEmail,
      sessionId,
      productData,
      messages,
      status: status || 'active',
      extractedInfo,
      whatsappNotified
    });

    res.json({ success: true, chat });
  } catch (error) {
    console.error('[Seller-User-Chat] Save error:', error);
    res.status(500).json({ error: 'Failed to save conversation' });
  }
});

/**
 * GET /api/seller-user-chat/conversations/:sellerId
 * Get all conversations for a seller
 */
app.get('/api/seller-user-chat/conversations/:sellerId', async (req, res) => {
  const { sellerId } = req.params;

  if (!sellerId) {
    return res.status(400).json({ error: 'sellerId is required' });
  }

  try {
    const conversations = await getSellerConversations(sellerId);
    res.json({ success: true, conversations });
  } catch (error) {
    console.error('[Seller-User-Chat] Get conversations error:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * GET /api/seller-user-chat/:chatId
 * Get a specific conversation by chatId
 */
app.get('/api/seller-user-chat/:chatId', async (req, res) => {
  const { chatId } = req.params;

  if (!chatId) {
    return res.status(400).json({ error: 'chatId is required' });
  }

  try {
    const conversation = await getSellerUserChat(chatId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json({ success: true, conversation });
  } catch (error) {
    console.error('[Seller-User-Chat] Get conversation error:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

/**
 * POST /api/seller-user-chat/update
 * Update conversation messages and metadata
 */
app.post('/api/seller-user-chat/update', async (req, res) => {
  const { chatId, messages, status, extractedInfo, whatsappNotified } = req.body;

  if (!chatId) {
    return res.status(400).json({ error: 'chatId is required' });
  }

  try {
    const chat = await updateSellerUserChat({
      chatId,
      messages,
      status,
      extractedInfo,
      whatsappNotified
    });

    res.json({ success: true, chat });
  } catch (error) {
    console.error('[Seller-User-Chat] Update error:', error);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

/**
 * POST /api/seller-user-chat/status
 * Update conversation status
 */
app.post('/api/seller-user-chat/status', async (req, res) => {
  const { chatId, status } = req.body;

  if (!chatId || !status) {
    return res.status(400).json({ error: 'chatId and status are required' });
  }

  try {
    const chat = await updateConversationStatus(chatId, status);
    res.json({ success: true, chat });
  } catch (error) {
    console.error('[Seller-User-Chat] Update status error:', error);
    res.status(500).json({ error: 'Failed to update conversation status' });
  }
});

/**
 * POST /api/seller-user-chat/delete
 * Delete a conversation
 */
app.post('/api/seller-user-chat/delete', async (req, res) => {
  const { chatId } = req.body;

  if (!chatId) {
    return res.status(400).json({ error: 'chatId is required' });
  }

  try {
    const result = await deleteSellerUserChat(chatId);
    res.json(result);
  } catch (error) {
    console.error('[Seller-User-Chat] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// ═══════════════════════════════════════
// BUY READINESS AGENT
// ═══════════════════════════════════════

/**
 * Analyzes conversation context to determine if user is ready to buy
 * Returns readiness assessment with confidence score
 */
async function analyzeBuyReadiness(sessionId, userMessage, chatSession) {
  const tracking = buyReadinessTracking.get(sessionId) || { lastChecked: null, isReady: false, notified: false };
  
  // Build conversation context from recent messages
  const recentMessages = chatSession.messages.slice(-10); // Last 10 messages
  const conversationContext = recentMessages
    .filter(m => m.role !== 'system')
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');
  
  const prompt = `You are a sales assistant analyzing a customer conversation to determine if they are ready to make a purchase.

PRODUCT CONTEXT:
- Product: ${chatSession.productData?.product_title || 'Unknown'}
- Price: ${chatSession.productData?.price || 'Unknown'}
- Store: ${chatSession.productData?.store || 'Unknown'}

RECENT CONVERSATION:
${conversationContext}

USER'S LATEST MESSAGE: "${userMessage}"

Analyze the conversation and determine:
1. Is the user showing clear intent to purchase? (ready_to_buy: true/false)
2. What is your confidence level? (confidence: 0-100)
3. What signals indicate readiness or hesitation? (signals: array of strings)
4. What is the next best action? (next_action: "send_whatsapp" | "continue_chat" | "offer_assistance")

Return ONLY a JSON object in this format:
{
  "ready_to_buy": boolean,
  "confidence": number (0-100),
  "signals": ["signal1", "signal2"],
  "next_action": "send_whatsapp" | "continue_chat" | "offer_assistance",
  "reasoning": "brief explanation of your assessment"
}

Rules:
- ready_to_buy = true ONLY if user explicitly asks to purchase, confirms they want to buy, or asks about payment/shipping/next steps
- Confidence > 80 required for "send_whatsapp" action
- Signals can include: "asked_price", "confirmed_budget", "asked_availability", "asked_shipping", "asked_payment", "said_yes", "ready_to_order", "hesitation_about_price", "needs_more_info", "comparison_shopping"

Output valid JSON only:`;

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
      const assessment = JSON.parse(jsonMatch[0]);
      
      // Update tracking
      tracking.lastChecked = Date.now();
      tracking.isReady = assessment.ready_to_buy;
      buyReadinessTracking.set(sessionId, tracking);
      
      return assessment;
    }
    
    throw new Error('Could not parse JSON response');
  } catch (error) {
    console.error('Buy readiness analysis error:', error);
    // Default to conservative response
    return {
      ready_to_buy: false,
      confidence: 0,
      signals: ['analysis_failed'],
      next_action: 'continue_chat',
      reasoning: 'Error analyzing readiness, continuing conversation'
    };
  }
}

/**
 * Sends WhatsApp notification when user is ready to buy
 */
async function sendBuyReadinessNotification(sellerId, chatSession, assessment) {
  const config = sellerWhatsappConfig.get(sellerId);
  const recipientNumber = config?.recipientNumber;
  
  if (!recipientNumber) {
    console.log(`[BuyReadiness] No recipient number configured for seller ${sellerId}`);
    return { sent: false, reason: 'no_recipient_configured' };
  }
  
  const status = whatsappService.getStatus(sellerId);
  if (!status.connected) {
    console.log(`[BuyReadiness] WhatsApp not connected for seller ${sellerId}`);
    return { sent: false, reason: 'whatsapp_not_connected' };
  }
  
  const productName = chatSession.productData?.product_title || 'Unknown Product';
  const price = chatSession.productData?.price || 'Unknown';
  const userInfo = chatSession.userInfo || {};
  
  const message = `🛒 *New Purchase Intent Alert!*

*Product:* ${productName}
*Price:* ${price}
*Confidence:* ${assessment.confidence}%

*Customer Signals:*
${assessment.signals.map(s => `• ${s}`).join('\n')}

*Conversation Summary:*
${assessment.reasoning}

${userInfo.location ? `*Location:* ${userInfo.location}` : ''}
${userInfo.budget ? `*Budget:* ${userInfo.budget}` : ''}

Reply to this chat to follow up with the customer.`;

  try {
    const result = await whatsappService.sendMessage(sellerId, recipientNumber, message);
    
    // Mark as notified
    const tracking = buyReadinessTracking.get(chatSession.sessionId);
    if (tracking) {
      tracking.notified = true;
      tracking.notifiedAt = Date.now();
      buyReadinessTracking.set(chatSession.sessionId, tracking);
    }
    
    console.log(`[BuyReadiness] Notification sent for session ${chatSession.sessionId}`);
    return { sent: true, result };
  } catch (error) {
    console.error('[BuyReadiness] Failed to send WhatsApp notification:', error);
    
    // Check if it's a session issue
    if (error.message?.includes('session expired') || error.message?.includes('detached')) {
      return { 
        sent: false, 
        reason: 'session_expired', 
        error: error.message,
        reconnectRequired: true 
      };
    }
    
    return { sent: false, reason: 'send_failed', error: error.message };
  }
}

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
