import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Paper,
  CircularProgress,
  Alert
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import axios from 'axios';

// Create API client (similar to your PlantingGuide)
const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  baseURL: 'http://localhost:3002/api',
  timeout: 20000,
});

const ChatInterface = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  // Load history + pending question from PlantingGuide
  useEffect(() => {
    const loadInitialMessages = async () => {
      // 1. Load saved chat history
      const saved = localStorage.getItem('chat_history');
      let initialMessages = [];
      if (saved) {
        try {
          initialMessages = JSON.parse(saved);
        } catch (err) {
          console.error("Failed to parse chat_history", err);
        }
      }

      // 2. Check for pending question from PlantingGuide
      const pending = localStorage.getItem('pendingMosupisiQuestion');
      if (pending) {
        try {
          const pendingMsg = JSON.parse(pending);
          
          // Add the user's question to messages
          initialMessages = [...initialMessages, pendingMsg];
          setMessages(initialMessages);
          
          // Clean up localStorage
          localStorage.removeItem('pendingMosupisiQuestion');
          
          // Get AI response for the pending question
          await getAIResponse(pendingMsg.text, pendingMsg.context, initialMessages);
          
        } catch (err) {
          console.error("Could not parse pending question", err);
          setMessages(initialMessages);
        }
      } else {
        setMessages(initialMessages);
      }
    };

    loadInitialMessages();
  }, []);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveChat = (updated) => {
    localStorage.setItem('chat_history', JSON.stringify(updated));
  };

  // Function to get AI response from your backend
  const getAIResponse = async (question, context, currentMessages) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Check if online
      if (!navigator.onLine) {
        throw new Error('offline');
      }

      // Prepare the request payload
      const payload = {
        question: question,
        context: context,
        language: 'en', // You might want to get this from your language context
      };

      // Call your AI endpoint
      const { data } = await api.post('/chat/ask', payload);
      
      // Create bot message from response
      const botMessage = {
        text: data.answer || data.message || "I couldn't generate a response. Please try again.",
        sender: 'bot',
        timestamp: new Date().toISOString(),
        sources: data.sources || [] // If your API returns sources
      };

      const updatedMessages = [...currentMessages, botMessage];
      setMessages(updatedMessages);
      saveChat(updatedMessages);

    } catch (err) {
      console.error('Error getting AI response:', err);
      
      let errorMessage = '';
      
      if (err.message === 'offline' || !navigator.onLine) {
        errorMessage = "You're offline. Please check your connection and try again.";
      } else if (err.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        errorMessage = err.response.data.message || 'Server error. Please try again later.';
      } else if (err.request) {
        // The request was made but no response was received
        errorMessage = 'No response from server. Please check your connection.';
      } else {
        // Something happened in setting up the request that triggered an Error
        errorMessage = 'Failed to get response. Please try again.';
      }
      
      setError(errorMessage);
      
      // Add error message to chat
      const errorBotMessage = {
        text: `❌ ${errorMessage}`,
        sender: 'bot',
        timestamp: new Date().toISOString(),
        isError: true
      };
      
      const updatedMessages = [...currentMessages, errorBotMessage];
      setMessages(updatedMessages);
      saveChat(updatedMessages);
      
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
      text: input,
      sender: 'user',
      timestamp: new Date().toISOString()
    };

    const updatedWithUser = [...messages, userMessage];
    setMessages(updatedWithUser);
    saveChat(updatedWithUser);
    setInput('');
    
    // Get AI response
    await getAIResponse(input, null, updatedWithUser);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '80vh',
        backgroundColor: '#f0f2f5',
        borderRadius: 2,
        overflow: 'hidden'
      }}
    >
      {/* Messages Area */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 2
        }}
      >
        {messages.map((msg, index) => (
          <Box
            key={index}
            sx={{
              display: 'flex',
              justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              mb: 2
            }}
          >
            <Paper
              sx={{
                p: 2,
                maxWidth: '70%',
                backgroundColor: msg.sender === 'user' ? '#dcf8c6' : 'white',
                borderRadius: 2,
                boxShadow: 1,
                border: msg.isError ? '1px solid #ff4444' : 'none'
              }}
            >
              <Typography variant="body1">{msg.text}</Typography>
              
              {msg.context && (
                <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                  Context: {msg.context.crop} - {msg.context.location}
                  {msg.context.plantingDate && ` (planted: ${new Date(msg.context.plantingDate).toLocaleDateString()})`}
                </Typography>
              )}
              
              {msg.sources && msg.sources.length > 0 && (
                <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                  Sources: {msg.sources.join(', ')}
                </Typography>
              )}
            </Paper>
          </Box>
        ))}
        
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
            <Paper sx={{ p: 2, backgroundColor: 'white', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" color="textSecondary">
                  Mosupisi is thinking about your crops 🌱...
                </Typography>
              </Box>
            </Paper>
          </Box>
        )}
        
        {error && (
          <Box sx={{ mb: 2 }}>
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          </Box>
        )}
        
        <div ref={messagesEndRef} />
      </Box>

      {/* Input Area */}
      <Box
        sx={{
          display: 'flex',
          p: 2,
          backgroundColor: 'white',
          borderTop: '1px solid #e0e0e0'
        }}
      >
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Ask Mosupisi about your crops..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSend()}
          size="small"
          disabled={isLoading}
          sx={{ mr: 1 }}
        />
        <IconButton
          color="primary"
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          sx={{
            backgroundColor: '#25D366',
            color: 'white',
            '&:hover': {
              backgroundColor: '#128C7E'
            },
            '&.Mui-disabled': {
              backgroundColor: '#cccccc'
            }
          }}
        >
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );
};

export default ChatInterface;