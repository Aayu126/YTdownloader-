// Script.js
document.addEventListener('DOMContentLoaded', () => {
  const apiBase = `${window.location.origin}`; // works on Railway and locally

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

  let current = null;

  function createNotification(message, details, type) {
    const div = document.createElement('div');
    div.className = `toast-notification show ${type}`;
    div.innerHTML = `<div><strong>${message}</strong><p>${details || ''}</p></div>`;
    document.body.appendChild(div);
    setTimeout(() => {
      div.style.opacity = '0';
      div.style.transform = 'translateY(100px)';
      setTimeout(() => div.remove(), 300);
    }, 4000);
  }

  function dl(url) {
    window.location.href = url;
  }

  function initiateVideoDownload(videoId, opt, audioItag) {
    if (opt.isVideoOnly) {
      // merge MP4 video-only + AAC
      const u = `${apiBase}/api/hq-download?videoId=${encodeURIComponent(
        videoId
      )}&itag=${encodeURIComponent(opt.itag)}&audioItag=${encodeURIComponent(audioItag || 140)}`;
      dl(u);
      createNotification('Download started', `Merging ${opt.qualityLabel} (MP4)`, 'success');
    } else {
      // progressive MP4
      const u = `${apiBase}/api/download?videoId=${encodeURIComponent(
        videoId
      )}&itag=${encodeURIComponent(opt.itag)}`;
      dl(u);
      createNotification('Download started', `${opt.qualityLabel} (MP4)`, 'success');
    }
  }

  function initiateAudioDownload(videoId) {
    const u = `${apiBase}/api/audio?videoId=${encodeURIComponent(videoId)}`;
    dl(u);
    createNotification('Audio download started', 'Fetching best available AAC audio', 'success');
  }

  async function fetchVideoInfo(url) {
    loader.style.display = 'block';
    errorMessage.style.display = 'none';
    videoDetailsSection.style.display = 'none';
    downloadOptionsDiv.innerHTML = '';

    try {
      const resp = await fetch(`${apiBase}/api/videoInfo?url=${encodeURIComponent(url)}`);
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || resp.statusText);
      }
      const data = await resp.json();
      current = data;

      const thumbs = data.videoDetails.thumbnails || [];
      videoThumbnail.src = thumbs[thumbs.length - 1]?.url || thumbs[0]?.url || '';
      videoTitle.textContent = data.videoDetails.title;
      channelName.textContent = data.videoDetails.author?.name || '';
      videoDuration.textContent = `Duration: ${formatDuration(+data.videoDetails.lengthSeconds || 0)}`;

      videoDetailsSection.style.display = 'block';
      updateDownloadButtons();
    } catch (e) {
      errorMessage.textContent = e.message;
      errorMessage.style.display = 'block';
      createNotification('Error', e.message, 'error');
    } finally {
      loader.style.display = 'none';
    }
  }

  function updateDownloadButtons() {
    if (!current) return;
    downloadOptionsDiv.innerHTML = '';
    const isVideo = videoDownloadOptionBtn.classList.contains('active');

    if (isVideo) {
      // Many options, unique by quality, already filtered server-side to MP4-compatible
      const list = current.formats
        .filter((f) => f.qualityLabel)
        .sort((a, b) => (parseInt(b.qualityLabel) || 0) - (parseInt(a.qualityLabel) || 0));

      list.forEach((opt) => {
        const btn = document.createElement('button');
        btn.className = 'download-btn';
        btn.textContent = `${opt.qualityLabel}${opt.isVideoOnly ? ' (HQ merge)' : ''}`;
        btn.onclick = () =>
          initiateVideoDownload(current.videoDetails.videoId, opt, current.audioItag);
        downloadOptionsDiv.appendChild(btn);
      });
    } else {
      const btn = document.createElement('button');
      btn.className = 'download-btn audio';
      btn.textContent = 'Download Audio';
      btn.onclick = () => initiateAudioDownload(current.videoDetails.videoId);
      downloadOptionsDiv.appendChild(btn);
    }
  }

  searchBtn.addEventListener('click', () => {
    const url = videoUrlInput.value.trim();
    if (!url) {
      createNotification('Invalid URL', 'Please paste a YouTube URL.', 'error');
      return;
    }
    fetchVideoInfo(url);
  });

  videoDownloadOptionBtn.addEventListener('click', () => {
    videoDownloadOptionBtn.classList.add('active');
    audioDownloadOptionBtn.classList.remove('active');
    updateDownloadButtons();
  });

  audioDownloadOptionBtn.addEventListener('click', () => {
    audioDownloadOptionBtn.classList.add('active');
    videoDownloadOptionBtn.classList.remove('active');
    updateDownloadButtons();
  });

  function formatDuration(total) {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
});
