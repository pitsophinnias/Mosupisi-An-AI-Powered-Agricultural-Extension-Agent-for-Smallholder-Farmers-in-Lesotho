// server.js - Minimal working version
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Simple in-memory knowledge base
const knowledgeBase = {
  crops: {
    maize: {
      name: 'Maize',
      fertilizer: 'Apply 2:3:2 (22) + Zn at planting, LAN at 4-6 weeks',
      water: 'Critical at tasseling and silking',
      pests: ['Stalk borer', 'Cutworm']
    },
    sorghum: {
      name: 'Sorghum',
      fertilizer: 'Apply 2:3:2 (22) at planting, LAN at 4 weeks',
      water: 'Critical at flowering',
      pests: ['Shoot fly', 'Midge']
    },
    legumes: {
      name: 'Legumes',
      fertilizer: 'Single super phosphate at planting',
      water: 'Critical at flowering and pod filling',
      pests: ['Aphids', 'Pod borer']
    }
  }
};

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Mosupisi Chat Service',
    status: 'running',
    endpoints: {
      health: '/api/health',
      crops: '/api/crops',
      chat: '/api/chat/ask'
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
  res.json({
    crops: Object.keys(knowledgeBase.crops),
    details: knowledgeBase.crops
  });
});

// Get specific crop
app.get('/api/crops/:crop', (req, res) => {
  const crop = req.params.crop;
  console.log(`✅ GET /api/crops/${crop} - Fetching crop details`);
  
  if (knowledgeBase.crops[crop]) {
    res.json(knowledgeBase.crops[crop]);
  } else {
    res.status(404).json({ 
      error: 'Crop not found',
      available: Object.keys(knowledgeBase.crops)
    });
  }
});

// Chat endpoint
app.post('/api/chat/ask', (req, res) => {
  const { question, context = {}, language = 'en' } = req.body;
  console.log('✅ POST /api/chat/ask - Question:', question);
  console.log('   Context:', context);
  
  const crop = context.crop || 'maize';
  const cropData = knowledgeBase.crops[crop] || knowledgeBase.crops.maize;
  
  let answer = '';
  const q = question.toLowerCase();
  
  if (q.includes('fertilizer') || q.includes('fertilize')) {
    answer = cropData.fertilizer;
  } else if (q.includes('water') || q.includes('irrigation') || q.includes('rain')) {
    answer = cropData.water;
  } else if (q.includes('pest') || q.includes('disease') || q.includes('insect')) {
    answer = `Common pests: ${cropData.pests.join(', ')}`;
  } else {
    answer = `I can help you with ${cropData.name}. Please ask about fertilizer, water, or pests.`;
  }
  
  res.json({
    answer: answer,
    sources: ['Local Knowledge Base'],
    timestamp: new Date().toISOString(),
    context_used: { crop, language }
  });
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

app.listen(PORT, () => {
  console.log('\n' + '='.repeat(50));
  console.log('✅ Mosupisi Chat Service - MINIMAL VERSION');
  console.log('='.repeat(50));
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log('\n📝 Test these endpoints:');
  console.log(`   🔹 GET  http://localhost:${PORT}/`);
  console.log(`   🔹 GET  http://localhost:${PORT}/api/health`);
  console.log(`   🔹 GET  http://localhost:${PORT}/api/crops`);
  console.log(`   🔹 GET  http://localhost:${PORT}/api/crops/maize`);
  console.log(`   🔹 POST http://localhost:${PORT}/api/chat/ask`);
  console.log('='.repeat(50) + '\n');
});