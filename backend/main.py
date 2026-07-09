from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, Request
import httpx
import json
from datetime import datetime
import logging

app = FastAPI()
logging.basicConfig(level=logging.INFO)

# Platform upload URLs & configs
PLATFORMS = {
    'youtube': {
        'name': 'YouTube',
        'upload_url': 'https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=resumable',
        'token_key': 'refresh_token'  # YouTube uses refresh tokens
    },
    'fb_page': {
        'name': 'Facebook Page',
        'upload_url': None,  # FB posts via graph API directly
        'token_key': 'access_token'
    },
    'insta_business': {
        'name': 'Instagram Business',
        'upload_url': 'https://graph.facebook.com/v19.0/{page_id}/media?type=REELS',
        'token_key': 'access_token'
    }
}

@app.get("/")
async def read_root():
    return {"message": "Social Media Cross-Poster API"}

@app.post("/upload")
async def upload_post(
    background_tasks: BackgroundTasks,
    request: Request,
    platform: str = Form(),
    title: str = Form()
):
    """
    This endpoint receives the actual file from the frontend.
    The frontend will stream it directly to this endpoint.
    """
    
    # Get form data including the file
    form_data = await request.form()
    file_bytes = form_data.get("file", b"")  # In practice, use multipart parsing
    
    if not file_bytes:
        return {"error": "No file received"}
    
    # Log the upload attempt
    logging.info(f"Uploading to {platform}: Title='{title}'")
    
    # Create a background task to post to platforms
    async def process_upload():
        try:
            if platform == 'youtube':
                await post_to_youtube(file_bytes, title)
            elif platform in ['fb_page', 'insta_business']:
                await post_to_meta(platform, file_bytes, title)
            
            logging.info(f"✅ Upload to {platform} completed successfully")
        except Exception as e:
            logging.error(f"❌ Failed to upload to {platform}: {str(e)}")
    
    background_tasks.add_task(process_upload)
    
    return {"message": "Upload queued!", "job_id": datetime.now().isoformat()}

async def post_to_youtube(file_bytes, title):
    """Post video directly to YouTube API"""
    headers = {
        'Authorization': f'Bearer YOUR_YOUTUBE_REFRESH_TOKEN',  # Get from /generate-tokens
        'Content-Type': 'application/octet-stream'
    }
    
    # Using resumable upload or simple upload for simplicity
    url = PLATFORMS['youtube']['upload_url']
    data = {
        "snippet": {"title": title},
        "status": {"privacyStatus": "public"}
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, content=file_bytes, headers=headers)
        return response.json()

async def post_to_meta(platform, file_bytes, title):
    """Post to Facebook Page or Instagram Business"""
    token = f'YOUR_{platform.upper()}_REFRESH_TOKEN'  # Get from /generate-tokens
    
    # For Meta platforms, you need a page_id
    page_id = "YOUR_PAGE_ID"
    
    if platform == 'fb_page':
        url = f"https://graph.facebook.com/v19.0/{page_id}/photos?access_token={token}"
        data = {"message": title}
    elif platform == 'insta_business':
        # Instagram reels upload
        url = f"https://graph.facebook.com/v19.0/{page_id}/media?type=REELS"
        data = {"caption": title, "is_published": True}
    
    headers = {'Content-Type': 'application/json'}
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=data, headers=headers)
        return response.json()

@app.get("/generate-tokens")
async def generate_tokens():
    """
    Generate OAuth tokens for platforms.
    In production, this would redirect to platform auth pages.
    For personal use, we'll simulate token generation by showing instructions.
    """
    
    # In reality, you'd need to implement full OAuth flows
    # This is a simplified version that shows what needs to be done
    
    tokens = {
        'youtube': "YOUR_YOUTUBE_REFRESH_TOKEN_HERE",
        'fb_page': "YOUR_FB_PAGE_ACCESS_TOKEN_HERE", 
        'insta_business': "YOUR_INSTAGRAM_BUSINESS_TOKEN_HERE"
    }
    
    return {"tokens": tokens, "message": "Replace these with actual tokens from platform pages"}

@app.get("/transmission-log")
async def get_transmission_log():
    """Get the log of all upload attempts"""
    # In production, this would query a database or use file-based logging
    # For now, return mock data showing the log structure
    
    log = [
        {
            "timestamp": datetime.now().isoformat(),
            "platform": "youtube",
            "title": "My Test Video",
            "status": "success",
            "message": "Successfully uploaded to YouTube"
        },
        {
            "timestamp": datetime.now().isoformat(),
            "platform": "fb_page",
            "title": "My Test Post",
            "status": "failed",
            "message": "Invalid access token for Facebook Page"
        }
    ]
    
    return {"transmission_log": log}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
