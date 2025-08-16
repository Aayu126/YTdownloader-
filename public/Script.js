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
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Error: ${response.statusText}`);
            }

            const data = await response.json();
            currentVideoDetails = data;
            
            videoThumbnail.src = data.videoDetails.thumbnails[data.videoDetails.thumbnails.length - 1].url;
            videoTitle.textContent = data.videoDetails.title;
            channelName.textContent = data.videoDetails.author.name;
            videoDuration.textContent = `Duration: ${formatDuration(data.videoDetails.lengthSeconds)}`;
            videoViews.textContent = `Views: ${Number(data.videoDetails.viewCount).toLocaleString()}`;
            
            videoDetailsSection.style.display = 'flex';
            updateDownloadOptions();
            
        } catch (error) {
            errorMessage.textContent = error.message;
            errorMessage.style.display = 'block';
            createNotification('Error', error.message, 'error');
        } finally {
            loader.style.display = 'none';
        }
    }

    function updateDownloadOptions() {
        if (!currentVideoDetails) return;

        downloadOptionsDiv.innerHTML = '';
        const { videoId, title } = currentVideoDetails.videoDetails;
        const isVideoActive = videoDownloadOptionBtn.classList.contains('active');

        if (isVideoActive) {
            const uniqueQualities = {};
            currentVideoDetails.formats
                .filter(f => f.qualityLabel && f.container === 'mp4' && f.hasVideo)
                .forEach(f => {
                    if (!uniqueQualities[f.qualityLabel]) {
                        uniqueQualities[f.qualityLabel] = f;
                    }
                });

            Object.values(uniqueQualities)
                .sort((a,b) => parseInt(b.qualityLabel) - parseInt(a.qualityLabel))
                .forEach(format => {
                    const button = document.createElement('button');
                    button.className = 'download-btn';
                    
                    // ✨ Add a label to show if the download is fast or slow
                    const speedLabel = format.hasAudio ? '(Fast)' : '(Slow - Processing)';
                    button.innerHTML = `Download ${format.qualityLabel} <span class="speed-label">${speedLabel}</span>`;

                    button.onclick = () => initiateDownload(videoId, format.itag, title);
                    downloadOptionsDiv.appendChild(button);
                });
        } else {
            const audioButton = document.createElement('button');
            audioButton.className = 'download-btn audio';
            audioButton.textContent = 'Download as MP3';
            audioButton.onclick = () => initiateAudioDownload(videoId, title);
            downloadOptionsDiv.appendChild(audioButton);
        }
    }

    // --- ✅ THIS SECTION WAS MISSING ---
    // Event listeners that make the buttons work
    searchBtn.addEventListener('click', () => {
        const url = videoUrlInput.value.trim();
        if (url && (url.includes('youtube.com') || url.includes('youtu.be'))) {
            fetchVideoInfo(url);
        } else {
            createNotification('Invalid URL', 'Please enter a valid YouTube video URL.', 'error');
        }
    });
    
    // ✨ Added feature: Press Enter to search
    videoUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            searchBtn.click();
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
    // --- END OF MISSING SECTION ---

    function formatDuration(seconds) {
        if (isNaN(seconds)) return '00:00';
        const date = new Date(null);
        date.setSeconds(parseInt(seconds));
        return date.toISOString().substr(11, 8);
    }
});