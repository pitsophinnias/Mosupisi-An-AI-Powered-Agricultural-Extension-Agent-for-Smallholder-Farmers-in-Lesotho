// index.js - Full working version with aiService
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import your AI service
const aiService = require('./services/aiService');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`\n📨 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.method === 'POST') {
    console.log('   Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Mosupisi Chat Service',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: 'GET /api/health',
      crops: 'GET /api/crops',
      cropDetail: 'GET /api/crops/:crop',
      chat: 'POST /api/chat/ask'
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'mosupisi-chat-service',
    timestamp: new Date().toISOString()
  });
});

// Get all crops
app.get('/api/crops', (req, res) => {
  console.log('✅ GET /api/crops - Fetching all crops');
  
  // Check if aiService is properly initialized
  if (!aiService || !aiService.knowledgeBase || !aiService.knowledgeBase.crops) {
    console.error('❌ aiService not properly initialized');
    return res.status(500).json({ 
      error: 'Service not properly initialized',
      message: 'Knowledge base not available'
    });
  }
  
  const crops = Object.keys(aiService.knowledgeBase.crops);
  console.log(`   Found crops: ${crops.join(', ')}`);
  
  res.json({
    crops: crops,
    details: aiService.knowledgeBase.crops
  });
});

// Get specific crop
app.get('/api/crops/:crop', (req, res) => {
  const crop = req.params.crop;
  console.log(`✅ GET /api/crops/${crop} - Fetching crop details`);
  
  if (!aiService || !aiService.knowledgeBase || !aiService.knowledgeBase.crops) {
    return res.status(500).json({ 
      error: 'Service not properly initialized',
      message: 'Knowledge base not available'
    });
  }
  
  const cropData = aiService.knowledgeBase.crops[crop];
  
  if (!cropData) {
    return res.status(404).json({ 
      error: 'Crop not found',
      message: `Crop '${crop}' not found`,
      available: Object.keys(aiService.knowledgeBase.crops)
    });
  }

  res.json(cropData);
});

// Chat endpoint
app.post('/api/chat/ask', async (req, res) => {
  try {
    const { question, context = {}, language = 'en' } = req.body;
    
    console.log('✅ POST /api/chat/ask - Processing question:');
    console.log(`   Question: "${question}"`);
    console.log(`   Context:`, context);
    console.log(`   Language: ${language}`);

    // Validate input
    if (!question || question.trim() === '') {
      return res.status(400).json({ 
        error: 'Question is required',
        message: language === 'st' ? 'Potso ea hlokahala' : 'Question is required'
      });
    }

    // Check if aiService is available
    if (!aiService || typeof aiService.getResponse !== 'function') {
      console.error('❌ aiService.getResponse not available');
      
      // Fallback response
      const crop = context.crop || 'maize';
      const fallbackResponses = {
        fertilizer: `For ${crop}, apply fertilizer at planting and 4-6 weeks after emergence.`,
        water: `Water ${crop} during critical periods like flowering and grain filling.`,
        pest: `Monitor ${crop} for common pests and diseases.`
      };
      
      const q = question.toLowerCase();
      let answer = '';
      if (q.includes('fertilizer')) answer = fallbackResponses.fertilizer;
      else if (q.includes('water')) answer = fallbackResponses.water;
      else if (q.includes('pest')) answer = fallbackResponses.pest;
      else answer = `I can help you with ${crop}. Please ask about fertilizer, water, or pests.`;
      
      return res.json({
        answer: answer,
        sources: ['Fallback Knowledge Base'],
        timestamp: new Date().toISOString(),
        warning: 'Using fallback response - aiService not available'
      });
    }

    // Get AI response using your service
    const response = await aiService.getResponse(question, context, language);
    
    console.log('   ✅ Response generated successfully');
    
    res.json({
      answer: response.answer,
      sources: response.sources || ['Mosupisi Knowledge Base'],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Chat error:', error);
    
    // Provide a helpful error response
    res.status(500).json({ 
      error: 'Failed to process question',
      message: 'An error occurred while processing your question.',
      details: error.message,
      fallback: 'Please try again or rephrase your question.'
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    available_endpoints: {
      root: 'GET /',
      health: 'GET /api/health',
      crops: 'GET /api/crops',
      crop_detail: 'GET /api/crops/:crop',
      chat: 'POST /api/chat/ask'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: 'Something went wrong. Please try again later.'
  });
});

// Start server
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 Mosupisi Chat Service - FULL VERSION');
  console.log('='.repeat(60));
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🌱 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🤖 AI Service: ${aiService ? 'Loaded' : 'Failed to load'}`);
  console.log('\n📋 Available Endpoints:');
  console.log(`   🔹 GET  /`);
  console.log(`   🔹 GET  /api/health`);
  console.log(`   🔹 GET  /api/crops`);
  console.log(`   🔹 GET  /api/crops/:crop`);
  console.log(`   🔹 POST /api/chat/ask`);
  console.log('='.repeat(60) + '\n');
});