const axios = require('axios');

const config = {
  access_token: process.env.IG_ACCESS_TOKEN, // Threads uses same token as Instagram
};

function isConfigured() {
  return !!config.access_token;
}

async function post({ fileUrl, filePath, caption }) {
  try {
    console.log("📡 Uploading to Threads...");
    
    const formData = new FormData();
    if (filePath) {
      // Use the file path directly for Threads upload
      await axios.post(
        'https://graph.threads.net/v1/me/threading_media',
        fs.createReadStream(filePath),
        { 
          headers: { 'Authorization': `Bearer ${config.access_token}` },
          maxBodyLength: Infinity,
          timeout: 30000
        }
      );
    } else if (fileUrl) {
      // Download and upload via API
      const response = await axios.get(fileUrl, { responseType: 'stream' });
      formData.append('source', response.data, { filename: fileUrl.split('/').pop() || 'video.mp4' });
      
      await axios.post(
        'https://graph.threads.net/v1/me/threading_media',
        formData,
        { 
          headers: { 'Authorization': `Bearer ${config.access_token}` },
          maxBodyLength: Infinity,
          timeout: 30000
        }
      );
    }

    console.log("✅ Threads upload successful!");
    return { success: true };
  } catch (err) {
    console.error("❌ Threads error:", err.message);
    throw new Error(`Threads: ${err.response?.data?.error?.message || err.message}`);
  }
}

module.exports = { config, isConfigured, post };
