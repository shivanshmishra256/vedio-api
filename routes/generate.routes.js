const express = require('express');
const router = express.Router();
const { handleGenerate, handleEditVideo } = require('../controllers/generate.controller');

router.get('/health', (req, res) => {
	res.status(200).json({ status: 'ok' });
});

// POST /api/generate
router.post('/generate', handleGenerate);
router.post('/edit-video', handleEditVideo);

router.get('/generate', (req, res) => {
	res.status(405).json({ error: 'Method not allowed. Use POST /api/generate' });
});

router.all('/generate', (req, res) => {
	res.status(405).json({ error: 'Method not allowed. Use POST /api/generate' });
});

module.exports = router;
