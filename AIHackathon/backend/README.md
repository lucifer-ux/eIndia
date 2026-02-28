# ElectroFind Backend

Backend service for ElectroFind with OpenAI and Tavily integration.

## Architecture

```
User Query → OpenAI (Intent Check) → [CHAT/RESEARCH]
                                 ↓
                              CHAT → OpenAI (Response)
                                 ↓
                              RESEARCH → OpenAI (Enhance Query) → Tavily API → Results
```

## Prerequisites

- Node.js 18+
- OpenAI API key (get from your OpenAI dashboard)
- Tavily API key (get from https://tavily.com)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your credentials:
   ```env
   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key
   OPENAI_BASE_URL=https://api.openai.com/v1

   # Tavily API Key
   TAVILY_API_KEY=your_tavily_api_key

   # Server Configuration
   PORT=3001
   ```

3. **Start the server:**
   ```bash
   # Production
   npm start
   
   # Development (with auto-reload)
   npm run dev
   ```

## API Endpoints

### POST /api/search
Main search endpoint that processes user queries.

**Request:**
```json
{
  "query": "Best noise cancelling headphones under $200"
}
```

**Response - Chat:**
```json
{
  "type": "chat",
  "response": "Here's what I found about...",
  "sources": []
}
```

**Response - Research:**
```json
{
  "type": "research",
  "originalQuery": "Best noise cancelling headphones under $200",
  "enhancedQuery": "Best noise cancelling headphones under $200 2024 reviews ratings",
  "answer": "Based on research...",
  "results": [...],
  "sources": [
    {
      "title": "Source Title",
      "url": "https://...",
      "content": "..."
    }
  ]
}
```

### GET /api/health
Health check endpoint.

## How It Works

1. **Intent Detection:** Uses `openai.gpt-oss-120b` model to determine if the user wants to chat or needs research
2. **Query Enhancement:** For research queries, enhances the search terms for better results
3. **Tavily Search:** Performs advanced web search with the enhanced query
4. **Response:** Returns either a chat response or research results with sources

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key | Yes |
| `OPENAI_BASE_URL` | OpenAI base URL (default: https://api.openai.com/v1) | No |
| `TAVILY_API_KEY` | Tavily API key | Yes |
| `PORT` | Server port (default: 3001) | No |

## Model

The backend uses `openai.gpt-oss-120b` for all LLM operations including:
- Intent classification
- Query enhancement  
- Chat responses