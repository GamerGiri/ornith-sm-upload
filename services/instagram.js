const axios = require('axios');
const fs = require('fs');

const config = {
  access_token: process.env.IG_ACCESS_TOKEN,
  user_id: process.env.IG_USER_ID,
};

function isConfigured() {
  return !!config.access_token;
}

async function post({ fileUrl, filePath, caption }) {
  try {
    console.log("📡 Uploading to Instagram...");
    
    const formData = new FormData();
    if (filePath && fs.existsSync(filePath)) {
      formData.append('file', fs.createReadStream(filePath), { filename: 'video.mp4' });
    } else if (fileUrl) {
      const response = await axios.get(fileUrl, { responseType: 'stream' });
      formData.append('file', response.data, { filename: 'video.mp4' });
    }

    // Use the L-Local token approach for Instagram Reels/Posts
    await axios.put(
      `https://i.instagram.com/api/v1/media/configure/?cors=true&token=${config.access_token}`,
      formData,
      { 
        headers: { 'Content-Type': `multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW` },
        maxBodyLength: Infinity,
        timeout: 30000
      }
    );

    console.log("✅ Instagram upload successful!");
    return { success: true };
  } catch (err) {
    console.error("❌ Instagram error:", err.message);
    throw new Error(`Instagram: ${err.response?.data?.error?.message || err.message}`);
  }
}

module.exports = { config, isConfigured, post };
