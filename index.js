const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/outputs', express.static(path.join(__dirname, 'outputs')));

// Health route
app.get('/health', (req, res) => {
  res.json({
    status: 'API is running'
  });
});

// UI route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Routes
const generateRoutes = require('./routes/generate.routes');
app.use('/api', generateRoutes);
app.use('/', generateRoutes);

// JSON error for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// Handle malformed JSON payloads gracefully
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  return next(err);
});

// Final error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.message);
  if (req.path.startsWith('/api')) {
    return res.status(500).json({ error: 'Internal server error' });
  }
  return res.status(500).send('Internal server error');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
