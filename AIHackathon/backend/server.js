const express = require('express');
const cors = require('cors');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { TavilyClient } = require('@tavily/core');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize clients
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const tavilyClient = new TavilyClient(process.env.TAVILY_API_KEY);

// Intent checking prompt
const INTENT_CHECK_PROMPT = `You are an AI assistant that determines user intent. Analyze the following query and determine if the user is:
1. Asking a general question or just chatting (respond with "CHAT")
2. Asking for research, current information, or searching for products/information (respond with "RESEARCH")

Only respond with one word: either "CHAT" or "RESEARCH"

User Query: {query}

Intent:`;

// Prompt enhancement for Tavily
const ENHANCE_PROMPT = `You are a search query optimizer. Enhance the following user query to make it more specific and effective for web search. 
Add relevant keywords, clarify intent, and make it comprehensive for better search results.
Return ONLY the enhanced query without any explanation.

Original Query: {query}

Enhanced Query:`;

// Chat response prompt
const CHAT_PROMPT = `You are a helpful AI assistant for ElectroFind, an electronics discovery platform. 
Answer the user's question concisely and helpfully.

User: {query}

Assistant:`;

// Check intent using Bedrock
async function checkIntent(query) {
  const prompt = INTENT_CHECK_PROMPT.replace('{query}', query);
  
  const command = new InvokeModelCommand({
    modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 10,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    }),
  });

  try {
    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const intent = responseBody.content[0].text.trim().toUpperCase();
    return intent === 'RESEARCH' ? 'RESEARCH' : 'CHAT';
  } catch (error) {
    console.error('Error checking intent:', error);
    return 'CHAT'; // Default to chat on error
  }
}

// Enhance query for Tavily
async function enhanceQuery(query) {
  const prompt = ENHANCE_PROMPT.replace('{query}', query);
  
  const command = new InvokeModelCommand({
    modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    }),
  });

  try {
    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return responseBody.content[0].text.trim();
  } catch (error) {
    console.error('Error enhancing query:', error);
    return query; // Return original query on error
  }
}

// Get chat response from Bedrock
async function getChatResponse(query) {
  const prompt = CHAT_PROMPT.replace('{query}', query);
  
  const command = new InvokeModelCommand({
    modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    }),
  });

  try {
    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return responseBody.content[0].text.trim();
  } catch (error) {
    console.error('Error getting chat response:', error);
    throw error;
  }
}

// Perform Tavily research
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
  const { query } = req.body;
  
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
      const response = await getChatResponse(query);
      return res.json({
        type: 'chat',
        response: response,
        sources: []
      });
    } else {
      // Step 2: Enhance query for research
      const enhancedQuery = await enhanceQuery(query);
      console.log('Enhanced query:', enhancedQuery);
      
      // Step 3: Perform Tavily research
      const researchResults = await performResearch(enhancedQuery);
      
      return res.json({
        type: 'research',
        originalQuery: query,
        enhancedQuery: enhancedQuery,
        answer: researchResults.answer,
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