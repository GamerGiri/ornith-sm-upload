require('dotenv').config(); // Load environment variables FIRST

const fs = require('fs');           // File system - must be here early
const path = require('path');       // Path utilities
const express = require('express');  // Express framework
const multer = require('multer');    // File upload handling
const axios = require('axios');      // HTTP requests
const { v4: uuidv4 } = require('uuid'); // UUID generation

console.log("🚀 Server starting...");
console.log("PUBLIC_URL:", process.env.PUBLIC_URL);

// Set up app with error handling wrapper
try {
    const app = express();
    
    // Middleware
    app.use(express.json());
    app.use('/public', express.static(path.join(__dirname, 'public')));

    // Ensure directories exist
    [process.env.UPLOAD_DIR || './uploads', process.env.TOKEN_DIR || './tokens'].forEach(dir => {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });

    // Multer setup for file uploads
    const upload = multer({ dest: process.env.UPLOAD_DIR || './uploads' });

    // --- Logging System ---
    function addLog(level, message) {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] ${level}: ${message}`);
    }

    // --- Helper: Upload Media to Instagram (Reels/Posts) ---
    async function uploadToInstagram(filePath, caption) {
        try {
            console.log("Uploading to Instagram...");
            
            const formData = new FormData();
            formData.append('file', fs.createReadStream(filePath), { filename: 'video.mp4' });

            // Use the provided IG_ACCESS_TOKEN directly (same as your working app)
            await axios.put(
                `https://i.instagram.com/api/v1/media/configure/?cors=true&token=${process.env.IG_ACCESS_TOKEN}`,
                formData,
                { 
                    headers: { 'Content-Type': `multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW` },
                    maxBodyLength: Infinity
                }
            );

            addLog('SUCCESS', 'Instagram upload successful!');
            return `Insta_Post_${uuidv4()}`;
        } catch (e) {
            console.error("Instagram Error:", e.message);
            throw new Error(`Instagram upload failed: ${e.message}`);
        }
    }

    // --- Helper: Upload Media to Facebook Page ---
    async function uploadToFacebook(filePath, caption) {
        try {
            console.log("Uploading to Facebook...");
            
            const formData = new FormData();
            formData.append('source', fs.createReadStream(filePath));
            formData.append('caption', caption);

            // Use the provided FB_PAGE_ACCESS_TOKEN directly (same as your working app)
            await axios.post(
                `https://graph.facebook.com/v18.0/${process.env.FB_PAGE_ID}/photos`,
                formData,
                { 
                    headers: { 'Authorization': `Bearer ${process.env.FB_PAGE_ACCESS_TOKEN}` },
                    maxBodyLength: Infinity
                }
            );

            addLog('SUCCESS', 'Facebook upload successful!');
            return `FB_Post_${uuidv4()}`;
        } catch (e) {
            console.error("Facebook Error:", e.message);
            throw new Error(`Facebook upload failed: ${e.message}`);
        }
    }

    // --- Helper: Upload Media to YouTube Shorts ---
    async function uploadToYouTube(filePath, title, description) {
        try {
            console.log("Uploading to YouTube...");
            
            const formData = new FormData();
            formData.append('media', fs.createReadStream(filePath), { filename: 'video.mp4' });

            // Use the provided YT_REFRESH_TOKEN directly (same as your working app)
            await axios.post(
                `https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status,snippet&uploadType=multipart`,
                formData,
                { 
                    headers: { 'Authorization': `Bearer ${process.env.YT_REFRESH_TOKEN}` },
                    maxBodyLength: Infinity
                }
            );

            addLog('SUCCESS', 'YouTube upload successful!');
            return `YT_Short_${uuidv4()}`;
        } catch (e) {
            console.error("YouTube Error:", e.message);
            throw new Error(`YouTube upload failed: ${e.message}`);
        }
    }

    // --- Main Upload Route ---
    app.post('/upload', upload.single('file'), async (req, res) => {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const platforms = req.body.platforms.split(',').map(p => p.trim());
        const title = req.body.title || '';
        
        addLog('INFO', `Starting upload: "${title}" to ${platforms.join(', ')}...`);

        let results = {};

        for (const platform of platforms) {
            try {
                if (platform === 'instagram') {
                    const mediaId = await uploadToInstagram(req.file.path, title);
                    results[platform] = { status: 'success', ...mediaId };
                } else if (platform === 'facebook') {
                    const mediaId = await uploadToFacebook(req.file.path, title);
                    results[platform] = { status: 'success', ...mediaId };
                } else if (platform === 'youtube') {
                    const mediaId = await uploadToYouTube(req.file.path, title, '');
                    results[platform] = { status: 'success', ...mediaId };
                } else {
                    addLog('ERROR', `Unknown platform: ${platform}`);
                    results[platform] = { error: 'Platform not supported' };
                }
            } catch (err) {
                addLog('ERROR', `${platform.toUpperCase()}: ${err.message}`);
                results[platform] = { error: err.message };
            }
        }

        res.json({ success: true, title, platforms, results });
    });

    // Start server with proper port binding and error handling
    const PORT = process.env.PORT || 3000;
    
    app.listen(PORT, () => {
        console.log(`✅ Server is running on port ${PORT}`);
        console.log(`🌐 App URL: https://${process.env.PUBLIC_URL}`);
    });

} catch (err) {
    console.error("❌ Fatal Error:", err.message);
    process.exit(1); // Graceful shutdown with error visible in logs
}
