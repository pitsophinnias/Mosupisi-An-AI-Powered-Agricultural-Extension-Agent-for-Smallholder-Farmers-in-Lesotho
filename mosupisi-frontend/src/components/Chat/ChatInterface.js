import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import axios from 'axios';
import { weatherApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const api = axios.create({
  baseURL: 'http://localhost:3002/api',
  // Fix: 120s to handle cold-start sentence transformer load (~25s) + inference
  timeout: 120000,
});

function buildWeatherSummary(current, forecast) {
  if (!current) return null;
  const lines = [
    `[Weather – ${current.location_name || 'Lesotho'}]`,
    `Now: ${current.description}, ${current.temperature_c}°C, humidity ${current.humidity_pct}%, wind ${current.wind_speed_ms} m/s`,
  ];
  if (current.rainfall_mm > 0) lines.push(`Rainfall last hour: ${current.rainfall_mm} mm`);
  if (forecast?.days?.length) {
    lines.push('Next 3 days:');
    forecast.days.slice(0, 3).forEach((d) => {
      let entry = `  ${d.date}: ${d.temp_min_c}–${d.temp_max_c}°C`;
      if (d.rainfall_mm > 0) entry += `, rain ${d.rainfall_mm} mm`;
      if (d.farming_note)    entry += ` : ${d.farming_note}`;
      lines.push(entry);
    });
  }
  return lines.join('\n');
}

const ChatInterface = () => {
  const { user } = useAuth();
  // Resolve display name: prefer full name, fall back to first_name, then username
  const farmerName = user?.name || user?.first_name
    ? [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.name
    : null;

  const [messages,           setMessages]           = useState([]);
  const [input,              setInput]              = useState('');
  const [isLoading,          setIsLoading]          = useState(false);
  const [error,              setError]              = useState(null);
  const [weatherSummary,     setWeatherSummary]     = useState(null);
  const [weatherStatus,      setWeatherStatus]      = useState('loading');
  const [currentWeather,     setCurrentWeather]     = useState(null);
  const [clearDialogOpen,    setClearDialogOpen]    = useState(false);
  const [hoveredMessageIdx,  setHoveredMessageIdx]  = useState(null);

  const messagesEndRef    = useRef(null);
  const weatherSummaryRef = useRef(null);

  useEffect(() => {
    weatherSummaryRef.current = weatherSummary;
  }, [weatherSummary]);

  const saveChat = useCallback((updated) => {
    localStorage.setItem('chat_history', JSON.stringify(updated));
  }, []);

  // ── Delete a single message ───────────────────────────────────────────────
  const handleDeleteMessage = useCallback((index) => {
    setMessages((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      saveChat(updated);
      return updated;
    });
  }, [saveChat]);

  // ── Clear all messages ────────────────────────────────────────────────────
  const handleClearChat = useCallback(() => {
    setMessages([]);
    localStorage.removeItem('chat_history');
    setClearDialogOpen(false);
  }, []);

  const getAIResponse = useCallback(async (question, context, currentMessages) => {
    setIsLoading(true);
    setError(null);

    try {
      if (!navigator.onLine) throw new Error('offline');

      const payload = {
        question,
        context,
        language:       'en',
        weatherContext: weatherSummaryRef.current || null,
        farmerName:     farmerName || null,
      };

      const { data } = await api.post('/chat/ask', payload);

      const botMessage = {
        text:      data.answer || data.message || "I couldn't generate a response. Please try again.",
        sender:    'bot',
        timestamp: new Date().toISOString(),
        sources:   data.sources || [],
      };

      const updated = [...currentMessages, botMessage];
      setMessages(updated);
      saveChat(updated);

    } catch (err) {
      console.error('Error getting AI response:', err);

      let errorMessage = '';
      if (err.message === 'offline' || !navigator.onLine) {
        errorMessage = "You're offline. Please check your connection and try again.";
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errorMessage = 'Response is taking longer than expected, the AI model may still be warming up. Please try again in a moment.';
      } else if (err.response) {
        errorMessage = err.response.data.message || 'Server error. Please try again later.';
      } else if (err.request) {
        errorMessage = 'No response from server. Please check your connection.';
      } else {
        errorMessage = 'Failed to get response. Please try again.';
      }

      setError(errorMessage);

      const updated = [...currentMessages, {
        text:      `❌ ${errorMessage}`,
        sender:    'bot',
        timestamp: new Date().toISOString(),
        isError:   true,
      }];
      setMessages(updated);
      saveChat(updated);

    } finally {
      setIsLoading(false);
    }
  }, [saveChat]);

  // ── Load history + pending question ──────────────────────────────────────
  useEffect(() => {
    const loadInitialMessages = async () => {
      const saved = localStorage.getItem('chat_history');
      let initialMessages = [];
      if (saved) {
        try { initialMessages = JSON.parse(saved); }
        catch (err) { console.error('Failed to parse chat_history', err); }
      }

      const pending = localStorage.getItem('pendingMosupisiQuestion');
      if (pending) {
        try {
          const pendingMsg = JSON.parse(pending);
          initialMessages = [...initialMessages, pendingMsg];
          setMessages(initialMessages);
          localStorage.removeItem('pendingMosupisiQuestion');
          await getAIResponse(pendingMsg.text, pendingMsg.context, initialMessages);
        } catch (err) {
          console.error('Could not parse pending question', err);
          setMessages(initialMessages);
        }
      } else {
        setMessages(initialMessages);
      }
    };

    loadInitialMessages();
  }, [getAIResponse]);

  // ── Weather context ───────────────────────────────────────────────────────
  const loadWeatherContext = useCallback(async () => {
    try {
      const [current, forecast] = await Promise.all([
        weatherApi.getCurrent(-29.3167, 27.4833, 'Maseru'),
        weatherApi.getForecast(-29.3167, 27.4833, 3, 'Maseru'),
      ]);
      setCurrentWeather(current);
      setWeatherSummary(buildWeatherSummary(current, forecast));
      setWeatherStatus('ready');
    } catch (err) {
      console.warn('ChatInterface: weather context unavailable', err);
      setWeatherStatus('unavailable');
    }
  }, []);

  useEffect(() => {
    loadWeatherContext();
    const interval = setInterval(loadWeatherContext, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadWeatherContext]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
      text:      input,
      sender:    'user',
      timestamp: new Date().toISOString(),
    };

    const updatedWithUser = [...messages, userMessage];
    setMessages(updatedWithUser);
    saveChat(updatedWithUser);
    setInput('');

    await getAIResponse(input, null, updatedWithUser);
  };

  return (
    <Box sx={{
      display:         'flex',
      flexDirection:   'column',
      height:          '80vh',
      backgroundColor: '#f0f2f5',
      borderRadius:    2,
      overflow:        'hidden',
    }}>

      {/* Weather status bar + clear button */}
      <Box sx={{
        px:              2,
        py:              0.75,
        backgroundColor: weatherStatus === 'ready' ? '#e8f5e9' : '#f5f5f5',
        borderBottom:    '1px solid #e0e0e0',
        display:         'flex',
        alignItems:      'center',
        gap:             1,
        flexWrap:        'wrap',
      }}>
        <WbSunnyIcon
          fontSize="small"
          sx={{ color: weatherStatus === 'ready' ? '#2e7d32' : '#9e9e9e' }}
        />
        {weatherStatus === 'loading' && (
          <Typography variant="caption" color="textSecondary">
            Loading weather context…
          </Typography>
        )}
        {weatherStatus === 'ready' && currentWeather && (
          <>
            <Typography variant="caption" sx={{ color: '#2e7d32', fontWeight: 600 }}>
              {currentWeather.location_name}: {currentWeather.description}, {currentWeather.temperature_c}°C
            </Typography>
            <Chip
              label="Live weather active"
              size="small"
              color="success"
              variant="outlined"
              sx={{ height: 18, fontSize: '0.65rem' }}
            />
          </>
        )}
        {weatherStatus === 'unavailable' && (
          <Typography variant="caption" color="textSecondary">
            ⚠️ Weather context offline. Answers may be general
          </Typography>
        )}

        {/* Spacer + clear all button */}
        <Box sx={{ flex: 1 }} />
        {messages.length > 0 && (
          <Button
            size="small"
            onClick={() => setClearDialogOpen(true)}
            startIcon={<DeleteSweepIcon sx={{ fontSize: 15 }} />}
            sx={{
              color:          '#9e9e9e',
              fontSize:       '0.7rem',
              textTransform:  'none',
              minHeight:      0,
              py:             0.25,
              px:             1,
              borderRadius:   1,
              '&:hover':      { color: '#d32f2f', bgcolor: '#ffebee' },
            }}
          >
            Clear chat
          </Button>
        )}
      </Box>

      {/* Messages */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {messages.map((msg, index) => (
          <Box
            key={index}
            onMouseEnter={() => setHoveredMessageIdx(index)}
            onMouseLeave={() => setHoveredMessageIdx(null)}
            sx={{
              display:        'flex',
              flexDirection:  msg.sender === 'user' ? 'row-reverse' : 'row',
              alignItems:     'flex-start',
              justifyContent: 'flex-start',
              gap:            0.5,
              mb:             2,
            }}
          >
            {/* Delete button: sits beside the bubble, visible on hover */}
            <Box sx={{
              width:          28,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              pt:             1,
              opacity:        hoveredMessageIdx === index ? 1 : 0,
              transition:     'opacity 0.15s',
              flexShrink:     0,
            }}>
              <Tooltip title="Delete message">
                <IconButton
                  size="small"
                  onClick={() => handleDeleteMessage(index)}
                  sx={{
                    width:     26,
                    height:    26,
                    color:     '#bdbdbd',
                    '&:hover': { color: '#d32f2f', bgcolor: '#ffebee' },
                  }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>

            <Paper
              sx={{
                p:               2,
                maxWidth:        '75%',
                backgroundColor: msg.sender === 'user' ? '#dcf8c6' : 'white',
                borderRadius:    2,
                boxShadow:       1,
                border:          msg.isError ? '1px solid #ff4444' : 'none',
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

      {/* Input */}
      <Box sx={{
        display:         'flex',
        p:               2,
        backgroundColor: 'white',
        borderTop:       '1px solid #e0e0e0',
      }}>
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
            backgroundColor:  '#25D366',
            color:            'white',
            '&:hover':        { backgroundColor: '#128C7E' },
            '&.Mui-disabled': { backgroundColor: '#cccccc' },
          }}
        >
          <SendIcon />
        </IconButton>
      </Box>

      {/* Clear all confirmation dialog */}
      <Dialog
        open={clearDialogOpen}
        onClose={() => setClearDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Clear chat history?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This will permanently delete all {messages.length} messages. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleClearChat} color="error" variant="contained">
            Clear all
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ChatInterface;