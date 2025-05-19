const express = require('express');
const multer = require('multer');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const path = require('path');

const router = express.Router();

// Multer storage config (uploads to 'uploads/' dir)
const upload = multer({ dest: 'uploads/' });

// Route: POST /parse-cv
router.post('/', upload.single('cv'), async (req, res) => {
  console.log('📥 POST /parse-cv received');

  // If no file is attached
  if (!req.file) {
    console.warn('⚠️ No file uploaded in request');
    return res.status(400).json({ error: 'No file uploaded' });
  }

  console.log('✅ File received:', req.file.originalname);

  try {
    const pdfBuffer = fs.readFileSync(req.file.path);
    const data = await pdfParse(pdfBuffer);

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    // Send parsed text
    res.json({ text: data.text });
  } catch (error) {
    console.error('❌ Error parsing PDF:', error);

    // Clean up file if it still exists
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ error: 'Failed to parse PDF file' });
  }
});

module.exports = router;
