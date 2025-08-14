document.addEventListener('DOMContentLoaded', () => {
  const apiBase = `${window.location.origin}`;

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
    if (opt.hasAudio) {
      const u = `${apiBase}/api/download?videoId=${encodeURIComponent(videoId)}&itag=${encodeURIComponent(opt.itag)}`;
      dl(u);
      createNotification('Download started', `${opt.qualityLabel} (MP4)`, 'success');
    } else {
      const u = `${apiBase}/api/hq-download?videoId=${encodeURIComponent(videoId)}&itag=${encodeURIComponent(opt.itag)}&audioItag=${encodeURIComponent(audioItag || 140)}`;
      dl(u);
      createNotification('Download started', `Merging ${opt.qualityLabel} video + audio`, 'success');
    }
  }

  function initiateAudioDownload(videoId) {
    const u = `${apiBase}/api/audio?videoId=${encodeURIComponent(videoId)}`;
    dl(u);
    createNotification('Audio download started', 'Fetching best quality audio', 'success');
  }

  async function fetchVideoInfo(url) {
    loader.style.display = 'block';
    errorMessage.style.display = 'none';
    videoDetailsSection.style.display = 'none';
    downloadOptionsDiv.innerHTML = '';

    try {
      const resp = await fetch(`${apiBase}/api/videoInfo?url=${encodeURIComponent(url)}`);
      if (!resp.ok) throw new Error((await resp.json()).error || resp.statusText);

      const data = await resp.json();
      current = data;

      // Find best audio itag
      const audioOnly = data.formats.filter(f => f.mimeType.includes('audio'));
      const bestAudio = audioOnly.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];
      current.audioItag = bestAudio ? bestAudio.itag : 140;

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
      const seen = new Set();
      const list = current.formats
        .filter(f => f.qualityLabel && f.mimeType.includes('video'))
        .sort((a, b) => (parseInt(b.qualityLabel) || 0) - (parseInt(a.qualityLabel) || 0))
        .filter(f => {
          if (seen.has(f.qualityLabel)) return false;
          seen.add(f.qualityLabel);
          return true;
        })
        .map(f => ({
          ...f,
          hasAudio: f.hasAudio || f.mimeType.includes('audio'),
          isVideoOnly: !f.mimeType.includes('audio')
        }));

      list.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'download-btn';
        btn.textContent = `${opt.qualityLabel}${opt.isVideoOnly ? ' (HQ merge)' : ''}`;
        btn.onclick = () => initiateVideoDownload(current.videoDetails.videoId, opt, current.audioItag);
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
