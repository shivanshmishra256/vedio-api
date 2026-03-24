const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Test route
app.get('/', (req, res) => {
  res.json({
    status: 'API is running'
  });
});

// Routes
app.use('/api', require('./routes/generate.routes'));

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
