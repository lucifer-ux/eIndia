const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const { tavily } = require('@tavily/core');
require('dotenv').config();
const authRoutes = require('./authRoutes');

const app = express();
const port = process.env.PORT || 3001;

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

// Intent checking prompt
const INTENT_CHECK_PROMPT = `You are an AI assistant that determines user intent. Analyze the following query and determine if the user is:
1. Asking a general question or just chatting (respond with "CHAT")
2. Asking for research, current information, or searching for products/information (respond with "RESEARCH")
3. Looking to buy/purchase an electronic item (respond with "BUY")

Only respond with one word: either "CHAT", "RESEARCH", or "BUY"

User Query: {query}

Intent:`;

// Electronics purchase query expansion prompt
const BUY_QUERY_EXPANSION_PROMPT = `You are an intelligent electronics search assistant. Your sole job is to take a user's electronics query and expand it into a precise, optimized search query for finding the best purchase results online.

When given a user query, you must:

1. Identify the core product the user is looking for (e.g., "wireless earbuds", "gaming laptop", "4K monitor")
2. Infer implicit requirements from context (budget hints, use case, preferences)
3. Expand the query to include:
   - Product category and subcategory
   - Key technical specifications relevant to that product type
   - Common trusted brands for that category
   - Price-related terms to help surface buying results
   - Terms that indicate product listing pages (e.g., "buy", "price", "store")

Output ONLY a JSON object in this exact format, nothing else:

{
  "original_query": "<user's original query>",
  "expanded_query": "<your optimized search string for Tavily>",
  "product_category": "<identified category>",
  "key_specs": ["<spec1>", "<spec2>", "<spec3>"],
  "price_range_hint": "<budget inferred from query or 'not specified'>",
  "sort_intent": "price_asc"
}

Rules:
- Never answer the user directly. Only output the JSON.
- Keep expanded_query under 150 characters.
- expanded_query must be a natural search string, not a sentence.
- Always append "buy online price" or "store price compare" to the expanded_query.
- If the user mentions a budget, include it as a filter hint in the expanded_query.
- Do not hallucinate specs. Only include specs relevant to the product type.

Examples:

User: "I need good earbuds for gym"
Output:
{
  "original_query": "I need good earbuds for gym",
  "expanded_query": "best wireless sport earbuds sweat resistant buy online price",
  "product_category": "Audio > Earbuds",
  "key_specs": ["wireless", "sweat resistant", "secure fit", "battery life"],
  "price_range_hint": "not specified",
  "sort_intent": "price_asc"
}

User: "cheap laptop for college under 500 dollars"
Output:
{
  "original_query": "cheap laptop for college under 500 dollars",
  "expanded_query": "budget student laptop under $500 buy online store price",
  "product_category": "Computers > Laptops",
  "key_specs": ["lightweight", "long battery", "8GB RAM", "SSD storage"],
  "price_range_hint": "under $500",
  "sort_intent": "price_asc"
}

Now process this query:
User: "{query}"

Output:`;

// General query enhancement for research
const ENHANCE_PROMPT = `You are a search query optimizer. Enhance the following user query to make it more specific and effective for web search.
Add relevant keywords, clarify intent, and make it comprehensive for better search results.
Return ONLY the enhanced query without any explanation.

Original Query: {query}

Enhanced Query:`;

// Buy intro message prompt
const BUY_INTRO_PROMPT = `You are a helpful AI assistant. Generate a brief, friendly intro message in {language} telling the user you found options for a product category.

Product Category: {category}
Price Range: {priceRange}

Respond ONLY with the intro message in {language}. Keep it under 2 sentences.`;

// Research answer translation/summarization prompt
const RESEARCH_SUMMARY_PROMPT = `You are a helpful AI assistant. Based on the research results below, provide a helpful summary in {language}.

Original Question: {query}

Research Answer (English): {answer}

Sources:
{sources}

Provide a clear, helpful response in {language} summarizing the findings. If the answer is not helpful, create a better summary from the sources.`;

// Chat response prompt
const CHAT_PROMPT = `You are a helpful AI assistant for ElectroFind, an electronics discovery platform. 
Answer the user's question concisely and helpfully.
{langInstruction}

User: {query}

Assistant:`;

// Language instruction map
const LANG_NAMES = {
  hi: 'Hindi (हिन्दी)', kn: 'Kannada (ಕನ್ನಡ)', te: 'Telugu (తెలుగు)',
  pa: 'Punjabi (ਪੰਜਾਬੀ)', mr: 'Marathi (मराठी)', ta: 'Tamil (தமிழ்)',
  en: 'English'
};

// Check intent using OpenAI
async function checkIntent(query) {
  const prompt = INTENT_CHECK_PROMPT.replace('{query}', query);

  try {
    const stream = await openai.responses.create({
      model: MODEL,
      input: [
        { role: 'user', content: prompt }
      ],
      stream: true,
    });

    let intent = '';
    for await (const event of stream) {
      if (event.type === 'response.output_text.delta') {
        intent += event.delta;
      }
    }

    const cleanIntent = intent.trim().toUpperCase();
    if (cleanIntent === 'BUY') return 'BUY';
    if (cleanIntent === 'RESEARCH') return 'RESEARCH';
    return 'CHAT';
  } catch (error) {
    console.error('Error checking intent:', error);
    return 'CHAT';
  }
}

// Expand buy query using OpenAI
async function expandBuyQuery(query) {
  const prompt = BUY_QUERY_EXPANSION_PROMPT.replace('{query}', query);

  try {
    const stream = await openai.responses.create({
      model: MODEL,
      input: [
        { role: 'user', content: prompt }
      ],
      stream: true,
    });

    let response = '';
    for await (const event of stream) {
      if (event.type === 'response.output_text.delta') {
        response += event.delta;
      }
    }

    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Could not parse JSON response');
  } catch (error) {
    console.error('Error expanding buy query:', error);
    // Return fallback
    return {
      original_query: query,
      expanded_query: query + ' buy online price',
      product_category: 'Electronics',
      key_specs: [],
      price_range_hint: 'not specified',
      sort_intent: 'price_asc'
    };
  }
}

// Enhance query for Tavily (general research)
async function enhanceQuery(query) {
  const prompt = ENHANCE_PROMPT.replace('{query}', query);

  try {
    const stream = await openai.responses.create({
      model: MODEL,
      input: [
        { role: 'user', content: prompt }
      ],
      stream: true,
    });

    let enhancedQuery = '';
    for await (const event of stream) {
      if (event.type === 'response.output_text.delta') {
        enhancedQuery += event.delta;
      }
    }

    return enhancedQuery.trim();
  } catch (error) {
    console.error('Error enhancing query:', error);
    return query;
  }
}

// Get chat response from OpenAI
async function getChatResponse(query, language = 'en') {
  const langInstruction = language !== 'en' && LANG_NAMES[language]
    ? `IMPORTANT: You MUST respond in ${LANG_NAMES[language]}. Do not respond in English.`
    : '';
  const prompt = CHAT_PROMPT.replace('{query}', query).replace('{langInstruction}', langInstruction);

  try {
    const stream = await openai.responses.create({
      model: MODEL,
      input: [
        { role: 'user', content: prompt }
      ],
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
    console.error('Error getting chat response:', error);
    throw error;
  }
}

// Generate buy intro message in user's language
async function generateBuyIntro(productCategory, priceRange, language = 'en') {
  if (language === 'en' || !LANG_NAMES[language]) {
    return `I found some great options for **${productCategory}**. Here are the best deals sorted by price:`;
  }

  const prompt = BUY_INTRO_PROMPT
    .replace(/{category}/g, productCategory)
    .replace(/{priceRange}/g, priceRange)
    .replace(/{language}/g, LANG_NAMES[language]);

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
    console.error('Error generating buy intro:', error);
    return `I found some great options for **${productCategory}**. Here are the best deals sorted by price:`;
  }
}

// Generate research summary in user's language
async function generateResearchSummary(query, answer, sources, language = 'en') {
  if (language === 'en' || !LANG_NAMES[language]) {
    return answer || 'Here\'s what I found:';
  }

  const sourcesText = sources.map((s, i) => `${i + 1}. ${s.title}: ${s.content?.substring(0, 200) || ''}`).join('\n');
  const prompt = RESEARCH_SUMMARY_PROMPT
    .replace(/{language}/g, LANG_NAMES[language])
    .replace(/{query}/g, query)
    .replace(/{answer}/g, answer || 'No summary available')
    .replace(/{sources}/g, sourcesText);

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
    console.error('Error generating research summary:', error);
    return answer || 'Here\'s what I found:';
  }
}

// Perform Tavily research for buying
async function performBuySearch(expandedQueryData) {
  try {
    const searchQuery = expandedQueryData.expanded_query;

    const response = await tavilyClient.search(searchQuery, {
      search_depth: 'advanced',
      include_answer: false,
      include_raw_content: false,
      max_results: 10,
      include_domains: [
        'amazon.com', 'bestbuy.com', 'walmart.com', 'newegg.com',
        'bhphotovideo.com', 'costco.com', 'target.com', 'ebay.com',
        'rtings.com', 'gsmarena.com'
      ],
      exclude_domains: ['reddit.com', 'youtube.com', 'pinterest.com', 'quora.com']
    });

    // Process results
    let results = response.results || [];
    const totalFound = results.length;

    // Filter for product listings with price signals
    results = results.filter(r => {
      const hasPrice = /\$\d+|\d+\s*USD|price|cost/i.test(r.content || '');
      const isProductPage = /product|item|buy|shop|cart|add to cart/i.test(r.url || '');
      return hasPrice || isProductPage;
    });

    // Extract and format results
    const formattedResults = results.slice(0, 5).map((r, index) => {
      // Extract price if present
      const priceMatch = (r.content || '').match(/\$[\d,]+(?:\.\d{2})?/);
      const price = priceMatch ? priceMatch[0] : 'Price varies';

      // Infer store from domain
      const domain = new URL(r.url).hostname.replace('www.', '');
      const storeMap = {
        'amazon.com': 'Amazon',
        'bestbuy.com': 'Best Buy',
        'walmart.com': 'Walmart',
        'newegg.com': 'Newegg',
        'bhphotovideo.com': 'B&H Photo',
        'costco.com': 'Costco',
        'target.com': 'Target',
        'ebay.com': 'eBay'
      };
      const store = storeMap[domain] || domain.split('.')[0];

      return {
        rank: index + 1,
        product_title: r.title || 'Product',
        store: store,
        price: price,
        buy_link: r.url,
        description: r.content ? r.content.substring(0, 120) + '...' : ''
      };
    });

    // Sort by price (extract numeric value)
    formattedResults.sort((a, b) => {
      const priceA = parseFloat(a.price.replace(/[$,]/g, '')) || Infinity;
      const priceB = parseFloat(b.price.replace(/[$,]/g, '')) || Infinity;
      return priceA - priceB;
    });

    return {
      query_used: searchQuery,
      results: formattedResults,
      total_found: totalFound,
      search_status: formattedResults.length >= 5 ? 'success' : (formattedResults.length > 0 ? 'partial' : 'failed'),
      expanded_data: expandedQueryData
    };
  } catch (error) {
    console.error('Error performing buy search:', error);
    throw error;
  }
}

// Perform general Tavily research
async function performResearch(query) {
  try {
    const response = await tavilyClient.search(query, {
      search_depth: 'advanced',
      include_answer: true,
      max_results: 10,
    });
    return response;
  } catch (error) {
    console.error('Error performing research:', error);
    throw error;
  }
}

// Search endpoint
app.post('/api/search', async (req, res) => {
  const { query, language } = req.body;

  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    console.log('Processing query:', query);

    // Step 1: Check intent
    const intent = await checkIntent(query);
    console.log('Detected intent:', intent);

    if (intent === 'CHAT') {
      // Handle chat
      const response = await getChatResponse(query, language || 'en');
      return res.json({
        type: 'chat',
        response: response,
        sources: []
      });
    } else if (intent === 'BUY') {
      // Handle electronics purchase
      const expandedQueryData = await expandBuyQuery(query);
      console.log('Expanded query:', expandedQueryData);

      const buyResults = await performBuySearch(expandedQueryData);

      // Generate intro message in user's language
      const introMessage = await generateBuyIntro(
        expandedQueryData.product_category,
        expandedQueryData.price_range_hint,
        language || 'en'
      );

      return res.json({
        type: 'buy',
        originalQuery: query,
        expandedData: expandedQueryData,
        results: buyResults.results,
        searchStatus: buyResults.search_status,
        totalFound: buyResults.total_found,
        introMessage: introMessage
      });
    } else {
      // Handle general research
      const enhancedQuery = await enhanceQuery(query);
      console.log('Enhanced query:', enhancedQuery);

      const researchResults = await performResearch(enhancedQuery);

      // Generate summary in user's language
      const translatedAnswer = await generateResearchSummary(
        query,
        researchResults.answer,
        researchResults.results,
        language || 'en'
      );

      return res.json({
        type: 'research',
        originalQuery: query,
        enhancedQuery: enhancedQuery,
        answer: translatedAnswer,
        results: researchResults.results,
        sources: researchResults.results.map(r => ({
          title: r.title,
          url: r.url,
          content: r.content
        }))
      });
    }
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      error: 'An error occurred while processing your request',
      details: error.message
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});