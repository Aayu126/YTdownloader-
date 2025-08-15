document.addEventListener('DOMContentLoaded', () => {
    // CHANGE THIS TO YOUR DEPLOYED RAILWAY BACKEND URL
    const BASE_API = "https://ytdownloader-production-cb83.up.railway.app";

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

    const videoDownloadOptionBtn = document.getElementById('video-download-option');
    const audioDownloadOptionBtn = document.getElementById('audio-download-option');

    let currentVideoDetails = null;
    let isLoading = false;

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
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(100px)';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    function validateYouTubeURL(url) {
        const patterns = [
            /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)/,
            /^(https?:\/\/)?(m\.)?youtube\.com\/watch\?v=/
        ];
        return patterns.some(pattern => pattern.test(url));
    }

    function extractVideoId(url) {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

    function initiateDownload(videoId, itag, quality) {
        const downloadUrl = `${BASE_API}/api/download?videoId=${videoId}&itag=${itag}`;
        
        // Create a temporary link to trigger download
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = '';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        createNotification('Download Started!', `Your video (${quality}) is now downloading.`, 'success');
    }

    function initiateAudioDownload(videoId) {
        const downloadUrl = `${BASE_API}/api/audio?videoId=${videoId}`;
        
        // Create a temporary link to trigger download
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = '';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        createNotification('Audio Download Started!', `Your audio file is now downloading.`, 'success');
    }

    async function fetchVideoInfo(url) {
        if (isLoading) {
            createNotification('Please wait', 'Previous request is still processing...', 'warning');
            return;
        }

        // Validate URL format
        if (!validateYouTubeURL(url)) {
            createNotification('Invalid URL', 'Please enter a valid YouTube URL.', 'error');
            return;
        }

        isLoading = true;
        loader.style.display = 'block';
        errorMessage.style.display = 'none';
        videoDetailsSection.style.display = 'none';
        searchBtn.disabled = true;
        searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

            const response = await fetch(`${BASE_API}/api/videoInfo?url=${encodeURIComponent(url)}`, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                
                if (response.status === 500) {
                    throw new Error(errorData.error || 'Server error occurred. Please try again later.');
                } else if (response.status === 429) {
                    throw new Error('Too many requests. Please wait a moment before trying again.');
                } else {
                    throw new Error(errorData.error || `Error: ${response.statusText}`);
                }
            }

            const data = await response.json();
            currentVideoDetails = data;
            
            // Update UI with video information
            if (data.videoDetails.thumbnails && data.videoDetails.thumbnails.length > 0) {
                const thumbnail = data.videoDetails.thumbnails[data.videoDetails.thumbnails.length - 1];
                videoThumbnail.src = thumbnail.url;
            }
            
            videoTitle.textContent = data.videoDetails.title || 'Unknown Title';
            channelName.textContent = data.videoDetails.author?.name || 'Unknown Channel';
            videoDuration.textContent = `Duration: ${formatDuration(data.videoDetails.lengthSeconds)}`;
            
            // Show video details section
            videoDetailsSection.style.display = 'block';

            updateDownloadOptions();
            
            createNotification('Success!', 'Video information loaded successfully.', 'success');
            
        } catch (error) {
            console.error('Fetch error:', error);
            
            let errorMsg = error.message;
            
            if (error.name === 'AbortError') {
                errorMsg = 'Request timed out. Please try again.';
            } else if (errorMsg.includes('Failed to fetch')) {
                errorMsg = 'Network error. Please check your connection and try again.';
            }
            
            errorMessage.textContent = errorMsg;
            errorMessage.style.display = 'block';
            createNotification('Error', errorMsg, 'error');
            
        } finally {
            isLoading = false;
            loader.style.display = 'none';
            searchBtn.disabled = false;
            searchBtn.innerHTML = '<i class="fas fa-search"></i> Search';
        }
    }

    function updateDownloadOptions() {
        if (!currentVideoDetails || !currentVideoDetails.formats) return;

        downloadOptionsDiv.innerHTML = '';
        const isVideoActive = videoDownloadOptionBtn.classList.contains('active');

        if (isVideoActive) {
            // Filter and sort video formats
            const videoFormats = currentVideoDetails.formats
                .filter(f => f.hasVideo && f.qualityLabel)
                .sort((a, b) => {
                    const qualityA = parseInt(a.qualityLabel) || 0;
                    const qualityB = parseInt(b.qualityLabel) || 0;
                    return qualityB - qualityA;
                });

            if (videoFormats.length === 0) {
                downloadOptionsDiv.innerHTML = '<p style="text-align: center; color: #666;">No video formats available for download.</p>';
                return;
            }

            videoFormats.forEach(format => {
                const button = document.createElement('button');
                button.className = 'download-btn';
                button.innerHTML = `<i class="fas fa-download"></i> Download ${format.qualityLabel}`;
                button.onclick = () => initiateDownload(currentVideoDetails.videoDetails.videoId, format.itag, format.qualityLabel);
                downloadOptionsDiv.appendChild(button);
            });
            
        } else {
            // Audio download option
            const audioButton = document.createElement('button');
            audioButton.className = 'download-btn audio';
            audioButton.innerHTML = '<i class="fas fa-music"></i> Download as MP3';
            audioButton.onclick = () => initiateAudioDownload(currentVideoDetails.videoDetails.videoId);
            downloadOptionsDiv.appendChild(audioButton);
        }
    }

    // Event listeners
    searchBtn.addEventListener('click', () => {
        const url = videoUrlInput.value.trim();
        if (url) {
            fetchVideoInfo(url);
        } else {
            createNotification('Invalid URL', 'Please enter a valid YouTube video URL.', 'error');
            videoUrlInput.focus();
        }
    });

    // Allow Enter key to trigger search
    videoUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !isLoading) {
            const url = videoUrlInput.value.trim();
            if (url) {
                fetchVideoInfo(url);
            }
        }
    });

    // Real-time URL validation
    videoUrlInput.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        if (url && !validateYouTubeURL(url)) {
            e.target.style.borderColor = '#F44336';
        } else {
            e.target.style.borderColor = '#ddd';
        }
    });

    videoDownloadOptionBtn.addEventListener('click', () => {
        if (!videoDownloadOptionBtn.classList.contains('active')) {
            videoDownloadOptionBtn.classList.add('active');
            audioDownloadOptionBtn.classList.remove('active');
            if (currentVideoDetails) {
                updateDownloadOptions();
            }
        }
    });

    audioDownloadOptionBtn.addEventListener('click', () => {
        if (!audioDownloadOptionBtn.classList.contains('active')) {
            audioDownloadOptionBtn.classList.add('active');
            videoDownloadOptionBtn.classList.remove('active');
            if (currentVideoDetails) {
                updateDownloadOptions();
            }
        }
    });

    mobileMenuBtn.addEventListener('click', () => {
        mainNav.classList.toggle('active');
    });

    function formatDuration(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Auto-paste from clipboard if available (optional feature)
    videoUrlInput.addEventListener('focus', async () => {
        try {
            if (navigator.clipboard && !videoUrlInput.value) {
                const clipboardText = await navigator.clipboard.readText();
                if (validateYouTubeURL(clipboardText)) {
                    videoUrlInput.value = clipboardText;
                    videoUrlInput.style.borderColor = '#4CAF50';
                    setTimeout(() => {
                        videoUrlInput.style.borderColor = '#ddd';
                    }, 2000);
                }
            }
        } catch (err) {
            // Clipboard access not available or denied
        }
    });

    // Add example URLs for user guidance
    const exampleUrls = [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtu.be/dQw4w9WgXcQ'
    ];

    // Create example text
    const tooltipContainer = document.createElement('div');
    tooltipContainer.className = 'tooltip-container';
    tooltipContainer.innerHTML = `
        <p class="tooltip-text">
            Example: ${exampleUrls[0]}
        </p>
    `;
    
    const searchContainer = document.querySelector('.search-container');
    if (searchContainer) {
        searchContainer.appendChild(tooltipContainer);
    }
});