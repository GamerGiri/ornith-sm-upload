const axios = require('axios');

// TikTok requires a separate API token setup (not included in your env)
const config = {
  app_id: null, // Will be set up later if needed
};

function isConfigured() {
  return false; // Not configured yet
}

async function post({ fileUrl, filePath }) {
  throw new Error('TikTok not configured. Add TIKTOK_ACCESS_TOKEN to .env.');
}

module.exports = { config, isConfigured, post };
