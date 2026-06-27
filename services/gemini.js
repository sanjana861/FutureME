const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;

let ai = null;
if (apiKey && apiKey.trim() !== '' && apiKey !== 'your_gemini_api_key_here') {
  ai = new GoogleGenAI({ apiKey });
}

// Clean markdown tags if they leak through
function cleanJsonResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/i, '');
    cleaned = cleaned.replace(/\n?```$/i, '');
  }
  return cleaned.trim();
}

/**
 * Send prompt to Gemini and return parsed JSON.
 */
async function callGemini(promptText) {
  if (!ai) {
    throw new Error('Gemini API key is not configured. Please add your GEMINI_API_KEY in the .env file.');
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: promptText,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.7,
      }
    });

    const rawText = response.text;
    
    if (!rawText || rawText.trim() === '') {
      throw new Error('Received empty response from AI engine.');
    }

    const cleanedText = cleanJsonResponse(rawText);
    try {
      return JSON.parse(cleanedText);
    } catch (parseErr) {
      console.error('Failed to parse Gemini response as JSON. Raw text:', rawText);
      throw new Error('AI response formatting mismatch. Please try again.');
    }
  } catch (error) {
    console.error('Gemini API Error:', error);
    
    if (error.status === 403 || error.message.includes('API key not valid')) {
      throw new Error('Your Gemini API key appears to be invalid. Please check your .env file settings.');
    }
    
    if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      throw new Error('AI service request timed out. Please check your network connection.');
    }

    throw new Error(error.message || 'Error occurred while contacting the Gemini AI engine.');
  }
}

module.exports = {
  callGemini
};
