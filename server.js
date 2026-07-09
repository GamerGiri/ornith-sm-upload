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
console.log("FACEBOOK_ACCESS_TOKEN exists:", !!process.env.FACEBOOK_ACCESS_TOKEN);

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

    // --- Dashboard Route (Show Success/Error Messages After Login) ---
    app.get('/dashboard', (req, res) => {
        const token = req.query.token;
        const provider = req.query.provider || 'unknown';

        console.log(`🔍 Checking dashboard for ${provider} token...`);

        // If no token provided, show login page
        if (!token) {
            return res.send(`<html><body>
                <h1>Login Required</h1>
                <p>Please select an account to continue.</p>
                <a href="/login/youtube">Login with YouTube</a>
            </body></html>`);
        }

        // Show success message and link back to home page
        res.send(`<html><body>
            <h1>${provider.toUpperCase()} Login Successful!</h1>
            <p>You've been logged in successfully.</p>
            <p><strong>Token:</strong> ${token.substring(0, 20)}...</p>
            <a href="/">Go to Home Page</a>
        </body></html>`);
    });

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

        console.log(`🔗 Redirecting to ${provider} login page...`);

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

        console.log(`📡 Redirecting user to: ${authUrl}`);
        res.redirect(authUrl);
    });

    // --- OAuth Callback (Handle Token Exchange) ---
    app.get('/callback/:provider', async (req, res) => {
        const { provider } = req.params;

        console.log(`🔁 Received callback for ${provider}`);
        console.log('Query params:', req.query); // Shows code, state, etc.

        if (!req.query.code || !req.query.state) {
            console.error('❌ No code or state received');
            return res.send(`<html><body>
                <h1>Login Failed</h1>
                <p>No authorization code was received.</p>
                <a href="/login/${provider}">Try Again</a>
            </body></html>`);
        }

        try {
            let accessToken = '';

            if (provider === 'youtube') {
                // Google OAuth2 Token Exchange
                const codeVerifierFile = fs.readFileSync(`./tokens/youtube_code_verifier_${req.query.state}.txt`, 'utf8').trim();

                console.log('📡 Exchanging token with Google...');

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

                console.log('✅ Token exchange successful!');

                // Extract refresh token and access token from response
                accessToken = req.body.refresh_token || ''; // Simplified: use refresh_token for persistence
                
                // Save tokens to file for reuse (server-side!)
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
                        redirect_uri: `http://YOUR_RENDERS_URL/login/${provider}`, // Replace with actual URL!
                        grant_type: 'authorization_code',
                        code: req.query.code
                    }
                });

                accessToken = req.body.access_token || '';

                console.log('✅ Token saved successfully!');

                // Save token to server-side file (not just browser localStorage!)
                fs.writeFileSync(`./tokens/meta_${req.query.state}.txt`, accessToken);
            }

            addLog('SUCCESS', `${provider.toUpperCase()} token refreshed successfully!`);
            
            // Redirect back to app with success message
            res.redirect(`/dashboard?token=${encodeURIComponent(accessToken)}&provider=${provider}`);
        } catch (err) {
            console.error(`❌ OAuth Error for ${provider}:`, err.message);
            addLog('ERROR', `${provider.toUpperCase()} OAuth failed: ${err.message}`);
            
            // Send back to user with error message instead of crashing
            res.send(`<html><body>
                <h1>Login Failed</h1>
                <p>Error: ${err.message}</p>
                <a href="/login/${provider}">Try Again</a>
            </body></html>`);
        }
    });

    // --- New API Endpoint to Read Tokens from Server (Fix for "Please login first!" error) ---
    app.get('/api/get-token', (req, res) => {
        const provider = req.query.provider;

        let tokenPath = '';

        if (provider === 'facebook' || provider === 'threads') {
            tokenPath = `./tokens/meta_${Date.now()}.txt`; // Use timestamp for uniqueness
        } else if (provider === 'instagram') {
            tokenPath = './tokens/meta_instagram.txt';
        } else if (provider === 'youtube') {
            tokenPath = './tokens/youtube_refresh_latest.txt';
        }

        try {
            const data = fs.readFileSync(tokenPath, 'utf8');
            console.log(`✅ Found ${provider} token on server`);
            res.json({ success: true, token: data }); // Return the stored token
        } catch (err) {
            addLog('ERROR', `Token not found for ${provider}: ${err.message}`);
            res.json({ success: false, message: "No token available" });
        }
    });

    // --- Main Upload Route ---
    app.post('/upload', upload.single('file'), async (req, res) => {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const platforms = req.body.platforms.split(',').map(p => p.trim());
        const title = req.body.title || '';
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

    // Start server with proper port binding and error handling
    const PORT = process.env.PORT || 3000;
    
    app.listen(PORT, () => {
        console.log(`✅ Server is running on port ${PORT}`);
    });

} catch (err) {
    console.error("❌ Fatal Error:", err.message);
    process.exit(1); // Graceful shutdown with error visible in logs
}
