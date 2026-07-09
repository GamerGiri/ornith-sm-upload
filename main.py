# Add this at the top of main.py to get detailed error messages:
import traceback
import sys
import logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks
import httpx
import logging
from fastapi.staticfiles import StaticFiles
import os

# Add these at the top of main.py after importing modules:
YOUTUBE_TOKEN = "YOUR_ACTUAL_YOUTUBE_REFRESH_TOKEN"  # Replace with real token
FB_PAGE_ID = "YOUR_FB_PAGE_ID"                        # Get from Facebook settings
INSTA_BUSINESS_ID = "YOUR_INSTAGRAM_BUSINESS_ID"      # Get from Instagram Business

# Then update your upload function:
async def post_to_youtube(file_bytes, title):
    headers = {
        'Authorization': f'Bearer {YOUTUBE_TOKEN}',
        'Content-Type': 'application/octet-stream'
    }
    
    url = "https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=resumable"
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, content=file_bytes, headers=headers)
        return response.json()

async def post_to_meta(platform, file_bytes, title):
    if platform == 'fb_page':
        url = f"https://graph.facebook.com/v19.0/{FB_PAGE_ID}/photos?access_token={YOUTUBE_TOKEN}"  # Use correct token for FB
        data = {"message": title}
    elif platform == 'insta_business':
        url = f"https://graph.facebook.com/v19.0/{INSTA_BUSINESS_ID}/media?type=REELS"
        data = {"caption": title, "is_published": True}

app = FastAPI()

# Serve frontend files from the same directory as main.py
frontend_dir = "frontend"  # Adjust this if your file structure differs

@app.get("/")
async def read_root():
    return {"message": "Social Media Cross-Poster API"}

@app.post("/upload")
async def upload_post(
    background_tasks: BackgroundTasks,
    request: Request,
    platforms: str = Form(),  # JSON string of selected platforms
    title: str = Form()
):
    """
    Receives file directly from frontend and forwards to platform APIs.
    No storage - files are streamed through.
    """
    
    form_data = await request.form()
    file_bytes = form_data.get("file", b"")  # In practice, use multipart parsing
    
    if not file_bytes:
        return {"error": "No file received"}
    
    logging.info(f"Uploading to {platforms}: Title='{title}'")
    
    # Process in background
    async def process_upload():
        try:
            selected_platforms = json.loads(platforms)
            
            for platform in selected_platforms:
                if platform == 'youtube':
                    await post_to_youtube(file_bytes, title)
                elif platform in ['fb_page', 'insta_business']:
                    await post_to_meta(platform, file_bytes, title)
            
            logging.info(f"✅ Upload to {platforms} completed")
        except Exception as e:
            logging.error(f"❌ Failed to upload to {platforms}: {str(e)}")
    
    background_tasks.add_task(process_upload)
    
    return {"message": "Upload queued!", "job_id": uuid.uuid4()}

async def post_to_youtube(file_bytes, title):
    """Post video directly to YouTube API"""
    token = f"YOUR_YOUTUBE_REFRESH_TOKEN"  # Get from frontend
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/octet-stream'
    }
    
    url = "https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=resumable"
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, content=file_bytes, headers=headers)
        return response.json()

async def post_to_meta(platform, file_bytes, title):
    """Post to Facebook Page or Instagram Business"""
    token = f"YOUR_{platform.upper()}_TOKEN"  # Get from frontend
    
    if platform == 'fb_page':
        page_id = "YOUR_FB_PAGE_ID"
        url = f"https://graph.facebook.com/v19.0/{page_id}/photos?access_token={token}"
        data = {"message": title}
    elif platform == 'insta_business':
        page_id = "YOUR_INSTA_BUSINESS_ID"
        url = f"https://graph.facebook.com/v19.0/{page_id}/media?type=REELS"
        data = {"caption": title, "is_published": True}
    
    headers = {'Content-Type': 'application/json'}
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=data, headers=headers)
        return response.json()

# Serve frontend static files from the same directory
app.mount("/frontend", StaticFiles(directory="frontend"), name="frontend")

@app.get("/transmission-log")
async def get_transmission_log():
    """Get transmission log (simulated for no-DB setup)"""
    log = [
        {
            "timestamp": datetime.now().isoformat(),
            "platforms": ["youtube", "fb_page"],
            "title": "Test Post",
            "status": "success"
        }
    ]
    
    return {"transmission_log": log}

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "platforms_configured": len(PLATFORM_CONFIGS) if 'PLATFORM_CONFIGS' in dir() else 3,
        "frontend_serving": os.path.exists("index.html")
    }

if __name__ == "__main__":
    import uvicorn
    # Run on port from environment variable or default to 10000
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)
