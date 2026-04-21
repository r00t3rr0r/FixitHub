const express = require('express');
const axios = require('axios');

const router = express.Router();

// Proxy für mobileapi.dev
// GET /api/proxy/mobileapi?name=...&page=... (API-Key wird serverseitig gesetzt)
router.get('/mobileapi', async (req, res) => {
  try {
    const { name, page = 1 } = req.query;
    if (!name) {
      return res.status(400).json({ error: 'Parameter "name" ist erforderlich.' });
    }
    const apiKey = process.env.MOBILEAPI_KEY || '3f40ccad3fc498fa3a59e30264e20d35f904e7e6';
    const url = `https://api.mobileapi.dev/devices/search/?name=${encodeURIComponent(name)}&page=${page}&key=${apiKey}`;
    const response = await axios.get(url, { headers: { 'Content-Type': 'application/json' } });
    res.json(response.data);
  } catch (err) {
    console.error('Proxy mobileapi.dev error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Proxy-Request zu mobileapi.dev fehlgeschlagen.' });
  }
});

module.exports = router;
