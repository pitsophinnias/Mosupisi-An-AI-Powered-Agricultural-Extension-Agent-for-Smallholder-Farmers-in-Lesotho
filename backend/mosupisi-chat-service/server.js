// backend/mosupisi-chat-service/server.js
// Node.js chat service gateway.
// Receives chat messages from the frontend (including optional weatherContext)
// and forwards them to the Python AI layer (main.py / RAG service).
// The weather context is injected as a system-prompt prefix so the AI
// can give weather-aware farming advice without knowing about the
// weather service directly.

const express    = require('express');
const cors       = require('cors');
const http       = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: {
    origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
    methods: ['GET', 'POST'],
  },
});

const PORT         = process.env.PORT         || 3001;
const PYTHON_AI_URL = process.env.PYTHON_AI_URL || 'http://localhost:8000';

app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
}));
app.use(express.json());

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'mosupisi-chat-service' });
});

// ---------------------------------------------------------------------------
// REST chat endpoint
// Accepts: { message, conversationId, userId, weatherContext? }
// ---------------------------------------------------------------------------

app.post('/api/chat', async (req, res) => {
  const { message, conversationId, userId, weatherContext } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const payload = buildAIPayload(message, conversationId, userId, weatherContext);
    const aiResponse = await forwardToAI(payload);
    res.json({ message: aiResponse.response || aiResponse.message, conversationId });
  } catch (err) {
    console.error('[chat] AI forward failed:', err.message);
    res.status(502).json({ error: 'AI service unavailable', detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// Chat history (stub — replace with your DB layer)
// ---------------------------------------------------------------------------

app.get('/api/chat/history/:conversationId', (req, res) => {
  // TODO: fetch from your persistence layer
  res.json({ conversationId: req.params.conversationId, messages: [] });
});

// ---------------------------------------------------------------------------
// Socket.IO (streaming / real-time)
// ---------------------------------------------------------------------------

io.on('connection', socket => {
  console.log(`[socket] client connected: ${socket.id}`);

  socket.on('chat:message', async ({ message, conversationId, userId, weatherContext }) => {
    if (!message) return;
    try {
      const payload    = buildAIPayload(message, conversationId, userId, weatherContext);
      const aiResponse = await forwardToAI(payload);
      socket.emit('chat:response', {
        message:        aiResponse.response || aiResponse.message,
        conversationId,
      });
    } catch (err) {
      console.error('[socket] AI forward failed:', err.message);
      socket.emit('chat:error', { error: 'AI service unavailable' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[socket] client disconnected: ${socket.id}`);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the payload sent to the Python AI / RAG service.
 * Weather context is prepended as a system note so the model always has
 * current conditions in scope — without tying the AI layer to the weather service.
 */
function buildAIPayload(message, conversationId, userId, weatherContext) {
  const systemNote = weatherContext
    ? `You are Mosupisi, an agricultural assistant for farmers in Lesotho.\n\n${weatherContext}\n\nUse the weather context above when relevant to give specific, practical advice.`
    : 'You are Mosupisi, an agricultural assistant for farmers in Lesotho.';

  return {
    message,
    conversation_id: conversationId,
    user_id:         userId,
    system_note:     systemNote,
  };
}

/**
 * Forward a payload to the Python AI service and return its response.
 */
async function forwardToAI(payload) {
  const response = await fetch(`${PYTHON_AI_URL}/api/chat`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`AI service HTTP ${response.status}: ${text}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

server.listen(PORT, () => {
  console.log(`[mosupisi-chat-service] listening on port ${PORT}`);
  console.log(`[mosupisi-chat-service] forwarding to AI at ${PYTHON_AI_URL}`);
});