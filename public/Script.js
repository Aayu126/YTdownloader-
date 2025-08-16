document.addEventListener('DOMContentLoaded', () => {
    // UI elements
    const videoUrlInput = document.getElementById('videoUrl');
    const searchBtn = document.getElementById('searchBtn');
    const videoDetailsSection = document.getElementById('videoDetails');
    const videoThumbnail = document.getElementById('videoThumbnail');
    const videoTitle = document.getElementById('videoTitle');
    const channelName = document.getElementById('channelName');
    const videoDuration = document.getElementById('videoDuration');
    const videoViews = document.getElementById('videoViews');
    const downloadOptionsDiv = document.getElementById('downloadOptions');
    const loader = document.getElementById('loader');
    const errorMessage = document.getElementById('errorMessage');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    
    const videoDownloadOptionBtn = document.getElementById('video-download-option');
    const audioDownloadOptionBtn = document.getElementById('audio-download-option');

    let currentVideoDetails = null;

    const API_BASE_URL = window.location.origin;

    function createNotification(message, details, type) {
        const notification = document.createElement('div');
        notification.className = `toast-notification show ${type}`;
        notification.innerHTML = `
            <div>
                <strong>${message}</strong>
                <p>${details}</p>
            </div>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 5000);
        }
        // Add missing closing brace for DOMContentLoaded event listener
    });

    function initiateDownload(videoId, itag, title) {
        const downloadUrl = `${API_BASE_URL}/api/download?videoId=${videoId}&itag=${itag}&title=${encodeURIComponent(title)}`;
        window.location.href = downloadUrl;
        createNotification('Download Started!', `Your video is now downloading.`, 'success');
    }

    function initiateAudioDownload(videoId, title) {
        const downloadUrl = `${API_BASE_URL}/api/audio?videoId=${videoId}&title=${encodeURIComponent(title)}`;
        window.location.href = downloadUrl;
        createNotification('Audio Download Started!', `Your audio file is now downloading.`, 'success');
    }
    
    async function fetchVideoInfo(url) {
        loader.style.display = 'block';
        errorMessage.style.display = 'none';
        videoDetailsSection.style.display = 'none';
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/videoInfo?url=${encodeURIComponent(url)}`);
            const data = await response.json();

            if (response.ok) {
                currentVideoDetails = data.videoDetails;
                displayVideoDetails(currentVideoDetails);
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        } catch (error) {
            console.error('Error fetching video info:', error);
            createNotification('Error Fetching Video Info', error.message, 'error');
        } finally {
            loader.style.display = 'none';
        }
    }