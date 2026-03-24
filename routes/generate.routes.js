const express = require('express');
const router = express.Router();
const { handleGenerate } = require('../controllers/generate.controller');

// POST /api/generate
router.post('/generate', handleGenerate);

module.exports = router;
