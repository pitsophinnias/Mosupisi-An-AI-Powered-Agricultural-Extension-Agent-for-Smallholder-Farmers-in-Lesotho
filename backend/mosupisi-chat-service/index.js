// index.js — Mosupisi Chat Service (Node gateway)
//
// Routes:
//   GET  /api/health       — health check
//   GET  /api/crops        — crop list from JS knowledge base
//   GET  /api/crops/:crop  — crop detail
//   POST /api/chat/ask     — forwarded to Python main.py (LLM + RAG)
//
// The chat endpoint is forwarded to the Python AI service (main.py)
// running on PYTHON_AI_PORT (default 3003) which uses mosupisi-q4.gguf.

const express = require('express');
const cors    = require('cors');
const axios   = require('axios');
const dotenv  = require('dotenv');

dotenv.config();

const aiService    = require('./services/aiService');
const app          = express();
const PORT         = process.env.PORT         || 3002;
const PYTHON_AI_URL = process.env.PYTHON_AI_URL || 'http://localhost:3003/api/chat';

app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (req.method === 'POST') console.log('   Body:', JSON.stringify(req.body, null, 2));
  next();
});

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.json({
    name: 'Mosupisi Chat Service',
    version: '2.0.0',
    ai_backend: PYTHON_AI_URL,
    endpoints: {
      health:     'GET /api/health',
      crops:      'GET /api/crops',
      cropDetail: 'GET /api/crops/:crop',
      chat:       'POST /api/chat/ask',
    },
  });
});

// ---------------------------------------------------------------------------
// Health — check both Node and Python AI service
// ---------------------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  let aiStatus = 'unknown';
  try {
    const r = await axios.get(PYTHON_AI_URL.replace('/api/chat', '/health'), { timeout: 3000 });
    aiStatus = r.data.status;
  } catch {
    aiStatus = 'unreachable';
  }

  res.json({
    status:    'healthy',
    service:   'mosupisi-chat-service',
    ai_status: aiStatus,
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Crops — served from JS knowledge base (fast, no LLM needed)
// ---------------------------------------------------------------------------
app.get('/api/crops', (req, res) => {
  if (!aiService?.knowledgeBase?.crops) {
    return res.status(500).json({ error: 'Knowledge base not available' });
  }
  res.json({
    crops:   Object.keys(aiService.knowledgeBase.crops),
    details: aiService.knowledgeBase.crops,
  });
});

app.get('/api/crops/:crop', (req, res) => {
  if (!aiService?.knowledgeBase?.crops) {
    return res.status(500).json({ error: 'Knowledge base not available' });
  }
  const data = aiService.knowledgeBase.crops[req.params.crop];
  if (!data) {
    return res.status(404).json({
      error:     'Crop not found',
      available: Object.keys(aiService.knowledgeBase.crops),
    });
  }
  res.json(data);
});

// ---------------------------------------------------------------------------
// Chat — forwarded to Python AI service (mosupisi-q4.gguf + RAG)
// ---------------------------------------------------------------------------
app.post('/api/chat/ask', async (req, res) => {
  const { question, context = {}, language = 'en', weatherContext } = req.body;

  if (!question?.trim()) {
    return res.status(400).json({ error: 'Question is required' });
  }

  try {
    console.log(`   Forwarding to Python AI: "${question.slice(0, 60)}..."`);

    const payload = {
      message:         question,
      conversation_id: req.body.conversationId || null,
      user_id:         req.body.userId || null,
      system_note:     weatherContext || null,
      language:        language,
      context:         context,
    };

    const response = await axios.post(PYTHON_AI_URL, payload, {
      timeout: 60000,  // 60s — LLM can be slow on first inference
      headers: { 'Content-Type': 'application/json' },
    });

    const data = response.data;

    res.json({
      answer:    data.response || data.answer || '',
      sources:   data.sources  || ['Mosupisi Agricultural Knowledge Base'],
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('Python AI error:', err.message);

    // Fallback to JS knowledge base if Python AI is down
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      console.log('   Python AI unavailable — using JS fallback');
      try {
        const fallback = await aiService.getResponse(question, context, language);
        return res.json({
          answer:    fallback.answer,
          sources:   fallback.sources || ['Mosupisi Knowledge Base (offline mode)'],
          timestamp: new Date().toISOString(),
          warning:   'Using offline fallback — AI model not available',
        });
      } catch (fbErr) {
        console.error('Fallback also failed:', fbErr.message);
      }
    }

    res.status(502).json({
      error:   'AI service unavailable',
      message: 'Could not get a response. Please try again.',
      details: err.message,
    });
  }
});

// ---------------------------------------------------------------------------
// 404 + error handlers
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('  Mosupisi Chat Service v2.0');
  console.log('='.repeat(60));
  console.log(`  Node gateway : http://localhost:${PORT}`);
  console.log(`  Python AI    : ${PYTHON_AI_URL}`);
  console.log('  Endpoints    : GET /api/health | /api/crops | POST /api/chat/ask');
  console.log('='.repeat(60) + '\n');
});