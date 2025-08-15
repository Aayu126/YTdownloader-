document.addEventListener('DOMContentLoaded', () => {
    // UI elements
    const videoUrlInput = document.getElementById('videoUrl');
    const searchBtn = document.getElementById('searchBtn');
    const videoDetailsSection = document.getElementById('videoDetails');
    const videoThumbnail = document.getElementById('videoThumbnail');
    const videoTitle = document.getElementById('videoTitle');
    const channelName = document.getElementById('channelName');
    const videoDuration = document.getElementById('videoDuration');
    const downloadOptionsDiv = document.getElementById('downloadOptions');
    const loader = document.getElementById('loader');
    const errorMessage = document.getElementById('errorMessage');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mainNav = document.getElementById('mainNav');
    
    // New format option buttons
    const videoDownloadOptionBtn = document.getElementById('video-download-option');
    const audioDownloadOptionBtn = document.getElementById('audio-download-option');

    let currentVideoDetails = null;

    // Use a relative path for the API URL, which will automatically resolve
    // to the correct domain whether you are on localhost or a deployed server.
    const API_BASE_URL = window.location.origin;

    // Helper function to show toast notifications
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
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(100px)';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    // Function to initiate video download
    function initiateDownload(videoId, itag, quality) {
        const downloadUrl = `${API_BASE_URL}/api/download?videoId=${videoId}&itag=${itag}`;
        window.location.href = downloadUrl;
        createNotification('Download Started!', `Your video (${quality}) is now downloading.`, 'success');
    }

    // Function to initiate audio download
    function initiateAudioDownload(videoId) {
        const downloadUrl = `${API_BASE_URL}/api/audio?videoId=${videoId}`;
        window.location.href = downloadUrl;
        createNotification('Audio Download Started!', `Your audio file is now downloading.`, 'success');
    }
    
    // Function to fetch video info from the backend
    async function fetchVideoInfo(url) {
        loader.style.display = 'block';
        errorMessage.style.display = 'none';
        videoDetailsSection.style.display = 'none';
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/videoInfo?url=${encodeURIComponent(url)}`);
            
            // Check for network errors (server not running)
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                if (response.status === 500 && !errorData.error) {
                    throw new Error('Connection failed. Please ensure the backend server is running.');
                }
                throw new Error(errorData.error || `Error: ${response.statusText}`);
            }

            const data = await response.json();
            currentVideoDetails = data;
            
            // Populate video details
            videoThumbnail.src = data.videoDetails.thumbnails[0].url;
            videoTitle.textContent = data.videoDetails.title;
            channelName.textContent = data.videoDetails.author.name;
            videoDuration.textContent = `Duration: ${formatDuration(data.videoDetails.lengthSeconds)}`;
            videoDetailsSection.style.display = 'block';

            updateDownloadOptions();
            
        } catch (error) {
            errorMessage.textContent = error.message;
            errorMessage.style.display = 'block';
            createNotification('Error', error.message, 'error');
        } finally {
            loader.style.display = 'none';
        }
    }

    // Function to update the download buttons based on the selected format
    function updateDownloadOptions() {
        if (!currentVideoDetails) return;

        downloadOptionsDiv.innerHTML = '';
        const isVideoActive = videoDownloadOptionBtn.classList.contains('active');

        if (isVideoActive) {
            // Create download buttons for video
            currentVideoDetails.formats.filter(f => f.qualityLabel).sort((a,b) => parseInt(b.qualityLabel) - parseInt(a.qualityLabel)).forEach(format => {
                const button = document.createElement('button');
                button.className = 'download-btn';
                button.innerHTML = `Download ${format.qualityLabel}`;
                button.onclick = () => initiateDownload(currentVideoDetails.videoDetails.videoId, format.itag, format.qualityLabel);
                downloadOptionsDiv.appendChild(button);
            });
        } else {
            // Create audio download button
            const audioButton = document.createElement('button');
            audioButton.className = 'download-btn audio';
            audioButton.textContent = 'Download as MP3';
            audioButton.onclick = () => initiateAudioDownload(currentVideoDetails.videoDetails.videoId);
            downloadOptionsDiv.appendChild(audioButton);
        }
    }

    // Event listeners
    searchBtn.addEventListener('click', () => {
        const url = videoUrlInput.value;
        if (url) {
            fetchVideoInfo(url);
        } else {
            createNotification('Invalid URL', 'Please enter a valid YouTube video URL.', 'error');
        }
    });

    videoDownloadOptionBtn.addEventListener('click', () => {
        videoDownloadOptionBtn.classList.add('active');
        audioDownloadOptionBtn.classList.remove('active');
        if (currentVideoDetails) {
            updateDownloadOptions();
        }
    });

    audioDownloadOptionBtn.addEventListener('click', () => {
        audioDownloadOptionBtn.classList.add('active');
        videoDownloadOptionBtn.classList.remove('active');
        if (currentVideoDetails) {
            updateDownloadOptions();
        }
    });

    mobileMenuBtn.addEventListener('click', () => {
        mainNav.querySelector('ul').classList.toggle('active');
    });

    // Simple duration formatter
    function formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    }
});