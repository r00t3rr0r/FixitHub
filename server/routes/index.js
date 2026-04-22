const express = require('express');
const router = express.Router();

// Import CSV Device Import routes
router.use('/api/csv-device-import', require('./csvDeviceImportRoutes'));

// Root path response
router.get("/", (req, res) => {
  res.status(200).send("Welcome to Your Website!");
});

router.get("/ping", (req, res) => {
  res.status(200).send("pong");
});

module.exports = router;
