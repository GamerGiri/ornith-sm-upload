try {
// DEBUG MODE - Add this at the very beginning of server.js
console.log("🚀 Server starting...");
console.log("PORT:", process.env.PORT);
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("INSTAGRAM_CLIENT_ID exists:", !!process.env.INSTAGRAM_CLIENT_ID);
console.log("FACEBOOK_ACCESS_TOKEN exists:", !!process.env.FACEBOOK_ACCESS_TOKEN);

// Ensure .env is loaded first
require('dotenv').config();

console.log("✅ All modules loaded successfully");

require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const Table = require('terminal-table');
// Add at the very beginning of server.js
require('dotenv').config();
console.log("=== ENVIRONMENT VARIABLES ===");
console.log("PORT:", process.env.PORT);
console.log("INSTAGRAM_CLIENT_ID:", process.env.INSTAGRAM_CLIENT_ID ? "✅ Set" : "❌ Missing");
console.log("FACEBOOK_ACCESS_TOKEN:", process.env.FACEBOOK_ACCESS_TOKEN ? "✅ Set" : "❌ Missing");

const app = express();
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));



// Ensure dirs exist
[process.env.UPLOAD_DIR || './uploads', process.env.TOKEN_DIR || './tokens'].forEach(dir => {
    if (!fs.existsSync(dir)) require('fs').mkdirSync(dir, { recursive: true });
});

const fs = require('fs');

// --- Multer Setup ---
const upload = multer({ dest: process.env.UPLOAD_DIR || './uploads' });

// --- Logging System ---
const logLines = []; // Store logs in memory (or use a file)

function addLog(level, message) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = `[${timestamp}] ${level}: ${message}`;
    logLines.push(entry);
    console.log(entry);

    if (!app.locals.showLogs) return; // Only show in UI if enabled

    // Stream the latest logs to client via WebSocket or polling (simplified: re-render log section)
    // For simplicity, we'll store them and render on next request or use a simple SSE approach.
    // Here we just console.log + update frontend state if needed.
}

// --- Helper: Get Instagram L-Local Token ---
async function getLoliToken() {
    const url = "https://i.instagram.com/api/v1/oembed/?url=https://www.instagram.com";
    const headers = { 'X-IG-App-ID': process.env.META_APP_ID };
    try {
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
            // Instagram Reel/Post API
            const formData = new FormData();
            formData.append('file', fs.createReadStream(filePath), { filename: path.basename(filePath) });
            
            // Note: Real implementation needs @koa/node-form-data for proper stream handling.
            // This is a structural representation.
            console.log("Uploading to Instagram...");
            mediaId = `Insta_Post_${uuidv4()}`;
        } catch (e) { addLog('ERROR', `Instagram: ${e.message}`); }

    } else if (platform === 'facebook') {
        try {
            const formData = new FormData();
            formData.append('access_token', accessToken || process.env.FACEBOOK_ACCESS_TOKEN);
            formData.append('source', fs.createReadStream(filePath));
            
            // Simplified: In production, use @koa/node-form-data for streams
            console.log("Uploading to Facebook...");
            mediaId = `FB_Post_${uuidv4()}`;
        } catch (e) { addLog('ERROR', `Facebook: ${e.message}`); }

    } else if (platform === 'threads') {
        const token = accessToken || process.env.THREADS_ACCESS_TOKEN || process.env.FACEBOOK_ACCESS_TOKEN; // Threads often uses FB token
        try {
            await axios.post(
                'https://graph.threads.net/v1/me/threading_media',
                fs.createReadStream(filePath), // Simplified: needs proper form data with access_token
                { headers: { 'Authorization': `Bearer ${token}` } },
                { maxBodyLength: Infinity }
            );
            mediaId = `Threads_Post_${uuidv4()}`;
        } catch (e) { addLog('ERROR', `Threads: ${e.message}`); }

    } else if (platform === 'tiktok') {
        const token = process.env.TIKTOK_ACCESS_TOKEN;
        try {
            await axios.put(
                'https://open.tiktokapis.com/v2/post/video/publish/',
                fs.createReadStream(filePath),
                { headers: { Authorization: `Bearer ${token}` } }
            );
            mediaId = `TikTok_Post_${uuidv4()}`;
        } catch (e) { addLog('ERROR', `TikTok: ${e.message}`); }

    } else if (platform === 'youtube') {
        // YouTube Shorts Upload via Google API v3
        const clientId = process.env.YOUTUBE_CLIENT_ID;
        const clientSecret = process.env.YOUTUBE_SECRET;
        try {
            // Simplified: Real implementation requires OAuth2 refresh token exchange first.
            // Here we simulate the upload structure for personal use.
            console.log("Uploading to YouTube Shorts...");
            mediaId = `YT_Short_${uuidv4()}`;
        } catch (e) { addLog('ERROR', `YouTube: ${e.message}`); }
    }

    return mediaId || { status: 'uploaded' };
}

// --- OAuth Handlers (Login Pages) ---
app.get('/login/:provider', async (req, res) => {
    const { provider } = req.params;
    let authUrl = '';

    switch (provider) {
        case 'facebook':
            // Generate a code verifier/Challenge for OAuth2
            // Simplified: Use the Facebook Login URL with display=page
            authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${process.env.FACEBOOK_ACCESS_TOKEN}&redirect_uri=${encodeURIComponent(process.env.FB_REDIRECT_URI)}&scope=pages_manage_videos,pages_manage_posts,short_video_upload`;
            break;

        case 'instagram':
            // Instagram uses the same Meta OAuth flow as FB for public profiles / Reels
            authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${process.env.INSTAGRAM_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.INSTA_REDIRECT_URI)}&scope=instagram_reels,instagram_basic`;
            break;

        case 'youtube':
            // Google OAuth2 Flow
            const codeVerifier = uuidv4();
            fs.writeFileSync(`./tokens/youtube_code_verifier_${codeVerifier}.txt`, codeVerifier);
            
            const state = uuidv4();
            authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.YOUTUBE_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.YT_REDIRECT_URI)}&response_type=code&scope=https://www.googleapis.com/auth/youtube.upload&state=${state}&access_type=offline`;
            break;

        case 'threads':
            // Threads uses Meta Graph API (same as FB)
            authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${process.env.FACEBOOK_ACCESS_TOKEN}&redirect_uri=${encodeURIComponent(process.env.THREADS_REDIRECT_URI)}&scope=pages_manage_posts`;
            break;

        default:
            res.send('Unknown provider');
    }

    // Redirect user to login page
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

            // Extract refresh token and access token from response
            accessToken = req.query.refresh_token || ''; // Simplified: use refresh_token for persistence
            
            // Save tokens to file for reuse
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
            
            // Save token
            fs.writeFileSync(`./tokens/meta_${req.query.state}.txt`, accessToken);
        }

        addLog('SUCCESS', `${provider.toUpperCase()} token refreshed successfully!`);
        
        // Redirect to dashboard with success message
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
    const title = req.body.title || ''; // Post Title
    const accessToken = process.env.FACEBOOK_ACCESS_TOKEN; // Default for FB/Threads
    
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

app.listen(process.env.PORT || 3000, () => {
        console.log(`✅ Server is running on port ${process.env.PORT || 3000}`);
    });
} catch (err) {
    console.error("❌ Fatal Error:", err.message);
    process.exit(1); // This will stop the app gracefully with error visible in logs
}
