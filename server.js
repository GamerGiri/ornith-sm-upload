const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// API Routes
app.post('/api/upload', upload.single('media'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const mediaPath = req.file.path;
        const postData = req.body;

        // Process and distribute to social media platforms
        await distributeToPlatforms(req.file, postData);

        // Clean up the uploaded file
        fs.unlinkSync(mediaPath);

        res.json({ 
            success: true, 
            message: 'Media uploaded and distributed successfully' 
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to process upload', details: error.message });
    }
});

// Distribute media to different platforms
async function distributeToPlatforms(file, postData) {
    const platforms = [];
    
    if (postData.facebook) platforms.push('facebook');
    if (postData.instagram) platforms.push('instagram');
    if (postData.youtube) platforms.push('youtube');
    if (postData.tiktok) platforms.push('tiktok');
    if (postData.threads) platforms.push('threads');

    console.log(`Distributing to: ${platforms.join(', ')}`);

    // Post to each platform
    for (const platform of platforms) {
        try {
            await postToPlatform(platform, file, postData);
            console.log(`Successfully posted to ${platform}`);
        } catch (error) {
            console.error(`Failed to post to ${platform}:`, error.message);
        }
    }
}

// Platform posting functions
async function postToPlatform(platform, file, postData) {
    switch (platform) {
        case 'facebook':
            await postToFacebook(file, postData);
            break;
        case 'instagram':
            await postToInstagram(file, postData);
            break;
        case 'youtube':
            await postToYoutube(file, postData);
            break;
        case 'tiktok':
            await postToTikTok(file, postData);
            break;
        case 'threads':
            await postToThreads(file, postData);
            break;
    }
}

// Example: Facebook posting (requires Meta Developer credentials)
async function postToFacebook(file, postData) {
    const axios = require('axios');
    
    // You'll need to set these in your .env file or get them from Meta Developer Portal
    const PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_TOKEN;
    const PAGE_ID = process.env.FACEBOOK_PAGE_ID;

    if (!PAGE_ACCESS_TOKEN || !PAGE_ID) {
        throw new Error('Facebook credentials not configured');
    }

    // For videos, use Facebook Graph API video upload endpoint
    const formData = new FormData();
    formData.append('source', file.path);
    
    await axios.post(
        `https://graph.facebook.com/${PAGE_ID}/videos`,
        formData,
        {
            headers: { 'Content-Type': 'multipart/form-data' },
            params: {
                access_token: PAGE_ACCESS_TOKEN,
                title: postData.title || '',
                description: postData.description || ''
            }
        }
    );
}

// Example: YouTube posting (requires Google Cloud credentials)
async function postToYoutube(file, postData) {
    const axios = require('axios');
    
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

    if (!YOUTUBE_API_KEY) {
        throw new Error('YouTube API key not configured');
    }

    // Upload video to YouTube using Media Upload API
    await axios.post(
        'https://www.googleapis.com/upload/youtube/v3/videos',
        fs.createReadStream(file.path),
        {
            headers: {
                'Content-Type': 'video/*',
                'Authorization': `Bearer ${YOUTUBE_API_KEY}`
            },
            params: {
                part: 'snippet,status',
                key: YOUTUBE_API_KEY,
                status: JSON.stringify({
                    privacyStatus: postData.privacy || 'private'
                })
            }
        }
    );
}

// Instagram posting (requires Meta Developer credentials)
async function postToInstagram(file, postData) {
    const axios = require('axios');
    
    const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;

    if (!ACCESS_TOKEN) {
        throw new Error('Instagram access token not configured');
    }

    // Instagram API requires specific image/video formats and sizes
    console.log(`Would post to Instagram: ${file.originalname}`);
}

// TikTok posting (requires TikTok Developer credentials)
async function postToTikTok(file, postData) {
    const axios = require('axios');
    
    const ACCESS_TOKEN = process.env.TIKTOK_ACCESS_TOKEN;
    const OPEN_API_KEY = process.env.TIKTOK_OPEN_API_KEY;

    if (!ACCESS_TOKEN || !OPEN_API_KEY) {
        throw new Error('TikTok credentials not configured');
    }

    console.log(`Would post to TikTok: ${file.originalname}`);
}

// Threads posting (requires Meta Developer credentials)
async function postToThreads(file, postData) {
    const axios = require('axios');
    
    const ACCESS_TOKEN = process.env.THREADS_ACCESS_TOKEN;

    if (!ACCESS_TOKEN) {
        throw new Error('Threads access token not configured');
    }

    console.log(`Would post to Threads: ${file.originalname}`);
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Social Media Poster is ready!`);
});
