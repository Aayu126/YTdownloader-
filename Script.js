// Script.js
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
    const downloadProgressContainer = document.getElementById('downloadProgressContainer');
    const progressBar = document.getElementById('progressBar');
    
    // New format option buttons
    const videoDownloadOptionBtn = document.getElementById('video-download-option');
    const audioDownloadOptionBtn = document.getElementById('audio-download-option');

    let currentVideoDetails = null;

    // Helper function to show toast notifications
    function createNotification(message, details, type) {
        const notification = document.createElement('div');
        notification.className = `toast-notification show ${type}`;
        notification.innerHTML = `
            <div>
                <strong class="font-semibold">${message}</strong>
                <p class="text-sm">${details}</p>
            </div>
        `;
        document.body.appendChild(notification);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    // Function to initiate video download
    function initiateDownload(videoId, itag, quality) {
        // Use the new hq-download endpoint
        const downloadUrl = `/api/hq-download?videoId=${videoId}&itag=${itag}`;
        window.location.href = downloadUrl;
        createNotification('Download Started!', `Your video (${quality}) is now downloading.`, 'success');
        showProgressBar();
    }

    // Function to initiate audio download
    function initiateAudioDownload(videoId) {
        const downloadUrl = `/api/audio?videoId=${videoId}`;
        window.location.href = downloadUrl;
        createNotification('Audio Download Started!', `Your audio file is now downloading.`, 'success');
        showProgressBar();
    }
    
    // Function to fetch video info from the backend
    async function fetchVideoInfo(url) {
        loader.style.display = 'block';
        errorMessage.style.display = 'none';
        videoDetailsSection.style.display = 'none';
        downloadProgressContainer.style.display = 'none';

        try {
            const response = await fetch(`/api/videoInfo?url=${encodeURIComponent(url)}`);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
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
            currentVideoDetails.formats
                .filter(f => f.qualityLabel)
                .sort((a,b) => parseInt(b.qualityLabel) - parseInt(a.qualityLabel))
                .forEach(format => {
                const button = document.createElement('button');
                button.className = 'download-btn';
                button.textContent = `Download ${format.qualityLabel}`;
                button.onclick = () => initiateDownload(currentVideoDetails.videoDetails.videoId, format.itag, format.qualityLabel);
                downloadOptionsDiv.appendChild(button);
            });
        } else {
            const audioButton = document.createElement('button');
            audioButton.className = 'download-btn audio';
            audioButton.textContent = 'Download as MP3';
            audioButton.onclick = () => initiateAudioDownload(currentVideoDetails.videoDetails.videoId);
            downloadOptionsDiv.appendChild(audioButton);
        }
    }

    function showProgressBar() {
        downloadProgressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        let progress = 0;
        const interval = setInterval(() => {
            if (progress >= 99) {
                clearInterval(interval);
            } else {
                progress += Math.random() * 5; 
                progressBar.style.width = `${progress}%`;
            }
        }, 1000);
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

    document.querySelectorAll('.faq-item').forEach(item => {
        item.querySelector('.faq-question').addEventListener('click', () => {
            const answer = item.querySelector('.faq-answer');
            answer.style.maxHeight = answer.style.maxHeight ? null : answer.scrollHeight + "px";
            item.classList.toggle('active');
        });
    });
});
