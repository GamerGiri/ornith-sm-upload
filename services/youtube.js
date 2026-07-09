const axios = require('axios');

const config = {
  client_id: process.env.YT_CLIENT_ID,
  client_secret: process.env.YT_CLIENT_SECRET,
  refresh_token: process.env.YT_REFRESH_TOKEN,
};

function isConfigured() {
  return !!config.refresh_token;
}

async function post({ fileUrl, filePath }) {
  try {
    console.log("📡 Uploading to YouTube...");
    
    const formData = new FormData();
    if (filePath) {
      formData.append('media', fs.createReadStream(filePath), { filename: 'video.mp4' });
    } else if (fileUrl) {
      const response = await axios.get(fileUrl, { responseType: 'stream' });
      formData.append('media', response.data, { filename: fileUrl.split('/').pop() || 'video.mp4' });
    }

    // Upload using Google's multipart upload API
    await axios.post(
      `https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=multipart`,
      formData,
      { 
        headers: { 'Authorization': `Bearer ${config.refresh_token}` },
        maxBodyLength: Infinity,
        timeout: 60000 // YouTube allows longer timeouts
      }
    );

    console.log("✅ YouTube upload successful!");
    return { success: true };
  } catch (err) {
    console.error("❌ YouTube error:", err.message);
    throw new Error(`YouTube: ${err.response?.data?.error?.message || err.message}`);
  }
}

module.exports = { config, isConfigured, post };
