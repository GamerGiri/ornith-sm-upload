// File Preview
const mediaFileInput = document.getElementById('mediaFile');
const previewArea = document.getElementById('previewArea');

mediaFileInput.addEventListener('change', function() {
    const file = this.files[0];
    if (!file) return;
    
    // Show preview based on file type
    if (file.type.startsWith('video/')) {
        const videoPreview = document.createElement('video');
        videoPreview.src = URL.createObjectURL(file);
        previewArea.innerHTML = '';
        previewArea.appendChild(videoPreview);
    } else {
        const imgPreview = document.createElement('img');
        imgPreview.className = 'preview-img';
        imgPreview.src = URL.createObjectURL(file);
        previewArea.innerHTML = '';
        previewArea.appendChild(imgPreview);
    }
    
    previewArea.style.display = 'block';
});

// Platform Selection
const platforms = ['youtube', 'fb_page', 'insta_business'];
let selectedPlatforms = [];

platforms.forEach(platform => {
    const checkbox = document.getElementById(platform);
    checkbox.addEventListener('change', function() {
        if (this.checked) {
            selectedPlatforms.push(this.value);
        } else {
            selectedPlatforms = selectedPlatforms.filter(p => p !== this.value);
        }
        
        // Update button state
        const uploadBtn = document.getElementById('uploadBtn');
        uploadBtn.disabled = selectedPlatforms.length === 0;
    });
});

// Upload Function
async function uploadToPlatforms() {
    const fileInput = document.getElementById('mediaFile');
    const title = document.getElementById('postTitle').value.trim();
    
    if (fileInput.files.length === 0) {
        alert('Please select a file first!');
        return;
    }
    
    if (!selectedPlatforms.length) {
        alert('Please select at least one platform!');
        return;
    }
    
    if (!title) {
        alert('Please enter a title/caption for your post!');
        return;
    }
    
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('platforms', JSON.stringify(selectedPlatforms));
    formData.append('title', title);
    
    // Show loading state
    const uploadBtn = document.getElementById('uploadBtn');
    const originalText = uploadBtn.textContent;
    uploadBtn.textContent = '⏳ Uploading...';
    uploadBtn.disabled = true;
    
    try {
        // Send to backend with background processing
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            // Add success log entry
            addLogEntry('success', selectedPlatforms, title);
            
            // Reset form
            mediaFileInput.value = '';
            previewArea.style.display = 'none';
            document.getElementById('postTitle').value = '';
        } else {
            throw new Error(`Upload failed: ${response.statusText}`);
        }
    } catch (error) {
        addLogEntry('failed', selectedPlatforms, title, error.message);
        alert('❌ Upload failed! Check transmission log for details.');
    } finally {
        uploadBtn.textContent = originalText;
        uploadBtn.disabled = false;
    }
}

// Add Log Entry to UI
function addLogEntry(status, platforms, title, message) {
    const logContainer = document.getElementById('transmissionLog');
    
    // Remove "no uploads" message if present
    const noUploadsMsg = logContainer.querySelector('.placeholder-msg');
    if (noUploadsMsg) noUploadsMsg.remove();
    
    // Create timestamp
    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    // Build log entry HTML
    let platformsHTML = '';
    selectedPlatforms.forEach(p => {
        const platformNames = { youtube: 'YouTube', fb_page: 'Facebook Page', insta_business: 'Instagram' };
        platformsHTML += `<span>${platformNames[p]} ✓</span><br>`;
    });
    
    const logEntry = `
        <div class="log-entry ${status}">
            <div class="log-time">${timeString}</div>
            <span class="log-platform">Status: ${status === 'success' ? '✅ Success' : '❌ Failed'}</span>
            <span class="log-title">Title: "${title}"</span>
            <p>${platformsHTML}</p>
            ${message ? `<p style="font-size: 0.85em; color: #7f8c8d;">${message}</p>` : ''}
        </div>
    `;
    
    logContainer.innerHTML = logEntry + logContainer.innerHTML;
}

// Save Tokens (In production, this would call /generate-tokens endpoint)
function saveTokens() {
    const youtubeToken = document.getElementById('youtubeToken').value.trim();
    const fbToken = document.getElementById('fbToken').value.trim();
    const instaToken = document.getElementById('instaToken').value.trim();
    
    if (!youtubeToken || !fbToken || !instaToken) {
        alert('Please fill in all token fields!');
        return;
    }
    
    // In a real implementation, you'd POST these to the backend:
    // fetch('/generate-tokens', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({youtube: youtubeToken, fb_page: fbToken, insta_business: instaToken}) })
    
    alert('✅ Tokens saved! (In production, these would be stored securely on the server)');
}

// Load transmission log from server (in production)
async function loadTransmissionLog() {
    try {
        const response = await fetch('/transmission-log');
        if (response.ok) {
            const data = await response.json();
            
            // Clear existing logs
            const logContainer = document.getElementById('transmissionLog');
            logContainer.innerHTML = '';
            
            // Add all entries
            data.transmission_log.forEach(entry => {
                addLogEntryFromData(entry);
            });
        }
    } catch (error) {
        console.error('Failed to load transmission log:', error);
    }
}

// Add log entry from server data
function addLogEntryFromData(entry) {
    const logContainer = document.getElementById('transmissionLog');
    
    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    let platformsHTML = '';
    if (entry.platforms) {
        entry.platforms.forEach(p => {
            const platformNames = { youtube: 'YouTube', fb_page: 'Facebook Page', insta_business: 'Instagram' };
            platformsHTML += `<span>${platformNames[p]} ✓</span><br>`;
        });
    }
    
    const logEntry = `
        <div class="log-entry ${entry.status}">
            <div class="log-time">${timeString}</div>
            <span class="log-platform">Status: ${entry.status === 'success' ? '✅ Success' : '❌ Failed'}</span>
            <span class="log-title">Title: "${entry.title}"</span>
            <p>${platformsHTML}</p>
        </div>
    `;
    
    logContainer.innerHTML = logEntry + logContainer.innerHTML;
}

// Load logs when page loads
loadTransmissionLog();
