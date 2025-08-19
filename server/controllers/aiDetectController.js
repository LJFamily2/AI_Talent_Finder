const fs = require('fs');
const path = require('path');
const { parsePdfToText } = require('../utils/pdfUtils');
const axios = require('axios');

const detectPosition = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const filePath = path.join(__dirname, '../uploads', file.filename);
    const text = await parsePdfToText(filePath);

    // Gemini API call
    const prompt = `Read this job description and extract the most likely job position title (e.g., "Information Systems"):\n\n${text}`;

    const geminiRes = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
      { contents: [{ parts: [{ text: prompt }] }] },
      { params: { key: process.env.GEMINI_API_KEY } }
    );

    const result = geminiRes?.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    res.json({ position: result });

    // Optionally delete uploaded file
    fs.unlinkSync(filePath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process PDF' });
  }
};

module.exports = { detectPosition };
