const axios = require('axios');
const fs = require('fs');

const config = {
  app_id: process.env.FB_APP_ID,
  app_secret: process.env.FB_APP_SECRET,
  page_access_token: process.env.FB_PAGE_ACCESS_TOKEN,
  page_id: process.env.FB_PAGE_ID,
};

function isConfigured() {
  return !!config.app_id && !!config.page_access_token;
}

async function post({ fileUrl, filePath, caption }) {
  try {
    console.log("📡 Uploading to Facebook...");
    
    // Read the actual file and upload it
    const formData = new FormData();
    const videoPath = filePath || `https://multi-z27w.onrender.com/uploads/${fileUrl.split('/uploads/')[1]}`;
    if (filePath && fs.existsSync(filePath)) {
      formData.append('source', fs.createReadStream(filePath));
    } else if (fileUrl) {
      const response = await axios.get(fileUrl, { responseType: 'stream' });
      formData.append('source', response.data, { filename: fileUrl.split('/').pop() || 'video.mp4' });
    }

    await axios.post(
      `https://graph.facebook.com/v18.0/${config.page_id}/photos`,
      formData,
      { 
        headers: { 'Authorization': `Bearer ${config.page_access_token}` },
        maxBodyLength: Infinity,
        timeout: 30000
      }
    );

    console.log("✅ Facebook upload successful!");
    return { success: true };
  } catch (err) {
    console.error("❌ Facebook error:", err.message);
    throw new Error(`Facebook: ${err.response?.data?.error?.message || err.message}`);
  }
}

module.exports = { config, isConfigured, post };
