// Set your deployed backend here. If you change your Railway URL, update this.
const API_BASE_URL = 'https://ytdownloader-production-cb83.up.railway.app';

document.addEventListener('DOMContentLoaded', () => {
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
  const videoDownloadOptionBtn = document.getElementById('video-download-option');
  const audioDownloadOptionBtn = document.getElementById('audio-download-option');

  let currentVideoDetails = null;

  function notify(msg) {
    console.log(msg);
  }

  function initiateDownload(videoId, itag, title) {
    const url = `${API_BASE_URL}/api/download?videoId=${videoId}&itag=${itag}&title=${encodeURIComponent(title)}`;
    window.location.href = url;
    notify('Download started');
  }

  function initiateAudioDownload(videoId, title) {
    const url = `${API_BASE_URL}/api/audio?videoId=${videoId}&title=${encodeURIComponent(title)}`;
    window.location.href = url;
    notify('Audio download started');
  }

  async function fetchVideoInfo(url) {
    loader.style.display = 'block';
    errorMessage.style.display = 'none';
    videoDetailsSection.style.display = 'none';

    try {
      const resp = await fetch(`${API_BASE_URL}/api/videoInfo?url=${encodeURIComponent(url)}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to fetch info');

      currentVideoDetails = data;

      // thumbnails can be array or string; handle both safely
      const thumb = Array.isArray(data.videoDetails.thumbnails) && data.videoDetails.thumbnails.length
        ? data.videoDetails.thumbnails[data.videoDetails.thumbnails.length - 1].url
        : (typeof data.videoDetails.thumbnails === 'string' ? data.videoDetails.thumbnails : '');

      const author = (data.videoDetails.author && (data.videoDetails.author.name || data.videoDetails.author)) || 'Unknown';

      videoThumbnail.src = thumb || '';
      videoTitle.textContent = data.videoDetails.title || 'Untitled';
      channelName.textContent = author;
      videoDuration.textContent = `Duration: ${formatDuration(Number(data.videoDetails.lengthSeconds))}`;
      videoViews.textContent = `Views: ${Number(data.videoDetails.viewCount || 0).toLocaleString()}`;

      videoDetailsSection.style.display = 'flex';
      updateDownloadOptions();
    } catch (err) {
      errorMessage.textContent = err.message || 'Unknown error';
      errorMessage.style.display = 'block';
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
      const unique = {};
      (currentVideoDetails.formats || []).forEach(f => {
        if (f.qualityLabel && f.container === 'mp4' && f.hasVideo) {
          if (!unique[f.qualityLabel]) unique[f.qualityLabel] = f;
        }
      });
      Object.values(unique)
        .sort((a,b) => parseInt(b.qualityLabel) - parseInt(a.qualityLabel))
        .forEach(f => {
          const btn = document.createElement('button');
          btn.className = 'download-btn';
          const speed = f.hasAudio ? '(Fast)' : '(Slow - Processing)';
          btn.innerHTML = `Download ${f.qualityLabel} <span class="speed-label">${speed}</span>`;
          btn.onclick = () => initiateDownload(videoId, f.itag, title);
          downloadOptionsDiv.appendChild(btn);
        });
      if (!downloadOptionsDiv.children.length) {
        const msg = document.createElement('div');
        msg.textContent = 'No MP4 formats found.';
        downloadOptionsDiv.appendChild(msg);
      }
    } else {
      const btn = document.createElement('button');
      btn.className = 'download-btn audio';
      btn.textContent = 'Download as MP3';
      btn.onclick = () => initiateAudioDownload(videoId, title);
      downloadOptionsDiv.appendChild(btn);
    }
  }

  searchBtn.addEventListener('click', () => {
    const url = (videoUrlInput.value || '').trim();
    if (!url || (!url.includes('youtube.com') && !url.includes('youtu.be'))) {
      errorMessage.textContent = 'Please enter a valid YouTube URL.';
      errorMessage.style.display = 'block';
      return;
    }
    fetchVideoInfo(url);
  });

  videoUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchBtn.click();
  });

  videoDownloadOptionBtn.addEventListener('click', () => {
    videoDownloadOptionBtn.classList.add('active');
    audioDownloadOptionBtn.classList.remove('active');
    if (currentVideoDetails) updateDownloadOptions();
  });

  audioDownloadOptionBtn.addEventListener('click', () => {
    audioDownloadOptionBtn.classList.add('active');
    videoDownloadOptionBtn.classList.remove('active');
    if (currentVideoDetails) updateDownloadOptions();
  });

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds)) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
  }
});
