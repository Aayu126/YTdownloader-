// server.js
// --- Polyfill for File in Node.js (for undici/fetch in deps) ---
import { Blob } from 'buffer';
global.File = class File extends Blob {
  constructor(chunks, filename, options = {}) {
    super(chunks, options);
    this.name = filename;
    this.lastModified = options.lastModified || Date.now();
  }
};

import express from 'express';
import cors from 'cors';
import ytdl from '@distube/ytdl-core';
import dotenv from 'dotenv';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { fileURLToPath } from 'url';

// Ensure ffmpeg exists in Railway: use packaged binary
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Static (serves your YT.html, Script.js, styles.css if you deploy them with server)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(__dirname));

const PORT = process.env.PORT || 4000;

// Helper: make a safe filename
const safeName = (s) => (s || 'video')
  .replace(/[\\/:*?"<>|]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

// Helper: detect mp4-h264 + aac compatibility
const isMp4H264 = (f) =>
  f?.container === 'mp4' &&
  /avc1|h264/i.test(f.codecs || '') &&
  f.hasVideo === true;

const isAacAudio = (f) =>
  f?.container === 'mp4' &&
  f.hasAudio === true &&
  f.hasVideo === false &&
  (/mp4a/i.test(f.codecs || '') || f.itag === 140);

// Choose the best MP4 video-only (H.264) and the standard AAC audio (itag 140)
function pickMp4BestPairs(formats) {
  const videoOnly = formats
    .filter((f) => isMp4H264(f) && f.hasAudio === false && f.qualityLabel)
    .sort((a, b) => (parseInt(b.qualityLabel) || 0) - (parseInt(a.qualityLabel) || 0));

  // common m4a/AAC audio stream on YouTube is itag 140
  const audioCandidates = formats.filter(isAacAudio);
  const audio140 = audioCandidates.find((f) => f.itag === 140) || audioCandidates[0];

  return { videoOnly, audio: audio140 || null };
}

// GET video info – return unique MP4 options (no WebM duplicates)
app.get('/api/videoInfo', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Please provide a YouTube URL' });

    const cleanUrl = String(url).split('&')[0];
    if (!ytdl.validateURL(cleanUrl)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    const info = await ytdl.getInfo(cleanUrl, {
      requestOptions: {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        },
      },
    });

    const { videoOnly, audio } = pickMp4BestPairs(info.formats);

    // Also allow progressive MP4 (video+audio in one) for lower qualities
    const progressiveMp4 = info.formats
      .filter((f) => f.container === 'mp4' && f.hasVideo && f.hasAudio && f.qualityLabel)
      .sort((a, b) => (parseInt(b.qualityLabel) || 0) - (parseInt(a.qualityLabel) || 0));

    // Build a unique-by-quality list: prefer video-only (HQ) option; else progressive
    const seen = new Set();
    const options = [];
    for (const f of [...videoOnly, ...progressiveMp4]) {
      const q = f.qualityLabel;
      if (!q || seen.has(q)) continue;
      seen.add(q);
      options.push({
        itag: f.itag,
        qualityLabel: q,
        isVideoOnly: f.hasAudio === false,
        container: f.container,
        codecs: f.codecs,
      });
    }

    res.json({
      videoDetails: info.videoDetails,
      formats: options,
      audioItag: audio?.itag || 140, // tell frontend which audio we’ll pair with
    });
  } catch (err) {
    console.error('Error fetching video info:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch video info.' });
  }
});

// Download progressive MP4 (has audio)
app.get('/api/download', async (req, res) => {
  try {
    const { videoId, itag } = req.query;
    if (!ytdl.validateID(videoId)) {
      return res.status(400).json({ error: 'Invalid video ID' });
    }

    const info = await ytdl.getInfo(videoId);
    const fmt = info.formats.find((f) => String(f.itag) === String(itag));
    if (!fmt || !(fmt.hasVideo && fmt.hasAudio) || fmt.container !== 'mp4') {
      return res.status(400).json({ error: 'Selected itag is not a progressive MP4 stream.' });
    }

    const title = safeName(info.videoDetails.title);
    res.setHeader('Content-Disposition', `attachment; filename="${title}.mp4"`);

    ytdl(videoId, { quality: String(itag) }).on('error', (e) => {
      console.error('ytdl progressive error:', e);
      if (!res.headersSent) res.status(500).end('Download failed.');
    }).pipe(res);
  } catch (err) {
    console.error('Error in /api/download:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to download video.' });
  }
});

// High-quality: merge MP4 H.264 (video-only) + AAC without re-encoding
app.get('/api/hq-download', async (req, res) => {
  try {
    const { videoId, itag, audioItag } = req.query;
    if (!ytdl.validateID(videoId)) {
      return res.status(400).json({ error: 'Invalid video ID' });
    }

    const info = await ytdl.getInfo(videoId);
    const videoFmt = info.formats.find((f) => String(f.itag) === String(itag));
    if (!videoFmt) return res.status(400).json({ error: 'Video format not found.' });

    // Only allow MP4/H.264 video-only here to avoid container/codec mismatch
    if (!(isMp4H264(videoFmt) && videoFmt.hasAudio === false)) {
      return res
        .status(400)
        .json({ error: 'Selected itag is not MP4 H.264 video-only. Pick an MP4 option.' });
    }

    // Pick AAC audio (prefer 140)
    const audioFmt =
      info.formats.find((f) => String(f.itag) === String(audioItag || 140)) ||
      info.formats.find(isAacAudio);
    if (!audioFmt) {
      return res.status(500).json({ error: 'No compatible AAC audio stream found.' });
    }

    const title = safeName(info.videoDetails.title);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${title}.mp4"`);

    const videoStream = ytdl(videoId, { quality: String(itag) });
    const audioStream = ytdl(videoId, { quality: String(audioFmt.itag) });

    const proc = ffmpeg()
      .input(videoStream)
      .input(audioStream)
      .videoCodec('copy')
      .audioCodec('copy') // no transcode = fast & cheap
      .format('mp4')
      .on('error', (err) => {
        console.error('FFmpeg error:', err?.message || err);
        if (!res.headersSent) res.status(500).end('FFmpeg processing failed.');
      })
      .on('end', () => {
        // Completed
      });

    // Pipe to client
    proc.pipe(res, { end: true });

    // Clean up on client abort
    res.once('close', () => {
      try { videoStream.destroy(); } catch {}
      try { audioStream.destroy(); } catch {}
      try { proc.kill('SIGKILL'); } catch {}
    });
  } catch (err) {
    console.error('Error in /api/hq-download:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to download HQ video.' });
  }
});

// Audio only (MP3 isn’t produced here; it streams the best audio. Frontend can label as “Audio”)
app.get('/api/audio', async (req, res) => {
  try {
    const { videoId } = req.query;
    if (!ytdl.validateID(videoId)) {
      return res.status(400).json({ error: 'Invalid video ID' });
    }
    const info = await ytdl.getInfo(videoId);
    const title = safeName(info.videoDetails.title);
    res.setHeader('Content-Disposition', `attachment; filename="${title}.m4a"`);

    // Use AAC m4a if available
    const aac = info.formats.find(isAacAudio);
    const stream = ytdl(videoId, { quality: String(aac?.itag || 140), filter: 'audioonly' });
    stream.on('error', (e) => {
      console.error('ytdl audio error:', e);
      if (!res.headersSent) res.status(500).end('Audio download failed.');
    });
    stream.pipe(res);
  } catch (err) {
    console.error('Error in /api/audio:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to download audio.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
