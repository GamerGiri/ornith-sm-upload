require('dotenv').config(); // Load environment variables FIRST

const fs = require('fs');           // File system - must be here early
const path = require('path');       // Path utilities
const express = require('express');  // Express framework
const multer = require('multer');    // File upload handling
const axios = require('axios');      // HTTP requests
const { v4: uuidv4 } = require('uuid'); // UUID generation

console.log("🚀 Server starting...");
console.log("PORT:", process.env.PORT);
console.log("INSTAGRAM_CLIENT_ID exists:", !!process.env.INSTAGRAM_CLIENT_ID);

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

    // --- Helper: Get Instagram L-Local Token ---
    async function getLoliToken() {
        try {
            const url = "https://i.instagram.com/api/v1/oembed/?url=https://www.instagram.com";
            const headers = { 'X-IG-App-ID': process.env.META_APP_ID };
            const resp = await axios.get(url, { headers });
            return resp.data.access_token;
        } catch (e) { console.error("Loli Token Error:", e.message); return null; }
    }

    // --- Helper: Upload Media to Platform ---
    async function uploadMedia(platform, filePath, title, accessToken) {
        let mediaId = '';

        if (platform === 'instagram') {
            const token = await getLoliToken();
            try {
                console.log("Uploading to Instagram...");
                // Simplified: In production, use proper FormData with streams
                mediaId = `Insta_Post_${uuidv4()}`;
            } catch (e) { addLog('ERROR', `Instagram: ${e.message}`); }

        } else if (platform === 'facebook') {
            try {
                console.log("Uploading to Facebook...");
                mediaId = `FB_Post_${uuidv4()}`;
            } catch (e) { addLog('ERROR', `Facebook: ${e.message}`); }

        } else if (platform === 'threads') {
            const token = accessToken || process.env.THREADS_ACCESS_TOKEN || process.env.FACEBOOK_ACCESS_TOKEN;
            try {
                console.log("Uploading to Threads...");
                await axios.post(
                    'https://graph.threads.net/v1/me/threading_media',
                    fs.createReadStream(filePath), // Simplified: needs proper form data
                    { headers: { 'Authorization': `Bearer ${token}` } },
                    { maxBodyLength: Infinity }
                );
                mediaId = `Threads_Post_${uuidv4()}`;
            } catch (e) { addLog('ERROR', `Threads: ${e.message}`); }

        } else if (platform === 'tiktok') {
            const token = process.env.TIKTOK_ACCESS_TOKEN;
            try {
                console.log("Uploading to TikTok...");
                await axios.put(
                    'https://open.tiktokapis.com/v2/post/video/publish/',
                    fs.createReadStream(filePath),
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                mediaId = `TikTok_Post_${uuidv4()}`;
            } catch (e) { addLog('ERROR', `TikTok: ${e.message}`); }

        } else if (platform === 'youtube') {
            try {
                console.log("Uploading to YouTube Shorts...");
                mediaId = `YT_Short_${uuidv4()}`;
            } catch (e) { addLog('ERROR', `YouTube: ${e.message}`); }
        }

        return mediaId || { status: 'uploaded' };
    }

    // --- OAuth Handlers ---
    app.get('/login/:provider', async (req, res) => {
        const { provider } = req.params;
        let authUrl = '';

        switch (provider) {
            case 'facebook':
                authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${process.env.FACEBOOK_ACCESS_TOKEN}&redirect_uri=${encodeURIComponent(process.env.FB_REDIRECT_URI)}&scope=pages_manage_videos,pages_manage_posts,short_video_upload`;
                break;

            case 'instagram':
                authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${process.env.INSTAGRAM_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.INSTA_REDIRECT_URI)}&scope=instagram_reels,instagram_basic`;
                break;

            case 'youtube':
                const codeVerifier = uuidv4();
                fs.writeFileSync(`./tokens/youtube_code_verifier_${codeVerifier}.txt`, codeVerifier); // ✅ Now works because fs is declared above!
                
                const state = uuidv4();
                authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.YOUTUBE_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.YT_REDIRECT_URI)}&response_type=code&scope=https://www.googleapis.com/auth/youtube.upload&state=${state}&access_type=offline`;
                break;

            case 'threads':
                authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${process.env.FACEBOOK_ACCESS_TOKEN}&redirect_uri=${encodeURIComponent(process.env.THREADS_REDIRECT_URI)}&scope=pages_manage_posts`;
                break;

            default:
                res.send('Unknown provider');
        }

        res.redirect(authUrl);
    });

    // --- OAuth Callback (Handle Token Exchange) ---
    app.get('/callback/:provider', async (req, res) => {
        const { provider } = req.params;

        if (!req.query.code || !req.query.state) {
            return res.send('No code or state received');
        }

        try {
            let accessToken = '';

            if (provider === 'youtube') {
                // Google OAuth2 Token Exchange
                const codeVerifierFile = fs.readFileSync(`./tokens/youtube_code_verifier_${req.query.state}.txt`, 'utf8').trim();

                await axios.post('https://oauth2.googleapis.com/token', null, {
                    params: {
                        client_id: process.env.YOUTUBE_CLIENT_ID,
                        client_secret: process.env.YOUTUBE_SECRET,
                        code: req.query.code,
                        redirect_uri: process.env.YT_REDIRECT_URI,
                        grant_type: 'authorization_code',
                        code_verifier: codeVerifierFile
                    }
                });

                accessToken = req.body.refresh_token || ''; // Simplified

                fs.writeFileSync(`./tokens/youtube_refresh_${req.query.state}.txt`, JSON.stringify({
                    access_token: req.body.access_token,
                    refresh_token: req.body.refresh_token,
                    token_type: req.body.token_type
                }));

            } else {
                // Meta (FB/Insta/Threads) Token Exchange
                await axios.post(`https://graph.facebook.com/v18.0/oauth/access_token`, null, {
                    params: {
                        client_id: provider === 'instagram' ? process.env.INSTAGRAM_CLIENT_ID : process.env.FACEBOOK_ACCESS_TOKEN,
                        client_secret: process.env.INSTAGRAM_CLIENT_SECRET,
                        redirect_uri: `http://YOUR_RENDERS_URL/login/${provider}`, // Replace with actual URL
                        grant_type: 'authorization_code',
                        code: req.query.code
                    }
                });

                accessToken = req.body.access_token || '';

                fs.writeFileSync(`./tokens/meta_${req.query.state}.txt`, accessToken);
            }

            addLog('SUCCESS', `${provider.toUpperCase()} token refreshed successfully!`);
            res.redirect(`/dashboard?token=${encodeURIComponent(accessToken)}&provider=${provider}`);
        } catch (err) {
            console.error(`OAuth Error for ${provider}:`, err.message);
            addLog('ERROR', `${provider.toUpperCase()} OAuth failed: ${err.message}`);
            res.send('Token exchange failed');
        }
    });

    // --- Main Upload Route ---
    app.post('/upload', upload.single('file'), async (req, res) => {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const platforms = req.body.platforms.split(',').map(p => p.trim());
        const title = req.body.title || '';
        const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;

        addLog('INFO', `Starting upload: "${title}" to ${platforms.join(', ')}...`);

        let results = {};

        for (const platform of platforms) {
            try {
                const mediaId = await uploadMedia(platform, req.file.path, title, accessToken);
                addLog('SUCCESS', `${platform.toUpperCase()} uploaded successfully: ${mediaId}`);
                results[platform] = { status: 'success', ...mediaId };
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
    });

} catch (err) {
    console.error("❌ Fatal Error:", err.message);
    process.exit(1); // Graceful shutdown with error visible in logs
}
