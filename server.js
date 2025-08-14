// Polyfill for File in Node.js
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
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import path from 'path';
import { fileURLToPath } from 'url';

// Set FFmpeg binary path explicitly
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
console.log("Using FFmpeg binary:", ffmpegInstaller.path);

// Load .env
dotenv.config();

const app = express();
app.use(cors());

const PORT = process.env.PORT || 4000;

// Static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(__dirname));

// User-Agent
const requestOptions = {
    requestOptions: {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
        }
    }
};

// Get video info (unique qualities)
app.get('/api/videoInfo', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ error: 'Please provide a YouTube URL' });

        const cleanUrl = url.split('&')[0];
        if (!ytdl.validateURL(cleanUrl)) return res.status(400).json({ error: 'Invalid YouTube URL' });

        const info = await ytdl.getInfo(cleanUrl, requestOptions);

        // Keep unique quality labels
        const seenQualities = new Set();
        const uniqueFormats = info.formats.filter(f => {
            if (!f.qualityLabel) return false;
            if (seenQualities.has(f.qualityLabel)) return false;
            seenQualities.add(f.qualityLabel);
            return true;
        });

        res.json({
            videoDetails: info.videoDetails,
            formats: uniqueFormats
        });
    } catch (err) {
        console.error('Error fetching video info:', err);
        res.status(500).json({ error: err.message || 'Failed to fetch video information.' });
    }
});

// Standard download
app.get('/api/download', async (req, res) => {
    try {
        const { videoId, itag } = req.query;
        if (!ytdl.validateID(videoId)) return res.status(400).json({ error: 'Invalid video ID' });

        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const info = await ytdl.getInfo(videoId, requestOptions);
        const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');

        res.header('Content-Disposition', `attachment; filename="${title}.mp4"`);

        ytdl(videoUrl, { filter: f => f.itag == itag, ...requestOptions })
            .on('error', err => {
                console.error('ytdl stream error:', err);
                if (!res.headersSent) res.status(500).json({ error: err.message });
            })
            .pipe(res);
    } catch (err) {
        console.error('Error downloading video:', err);
        if (!res.headersSent) res.status(500).json({ error: 'Failed to download video.' });
    }
});

// HQ download (video + audio merge)
app.get('/api/hq-download', async (req, res) => {
    try {
        const { videoId, itag, audioItag } = req.query;
        if (!ytdl.validateID(videoId)) return res.status(400).json({ error: 'Invalid video ID' });

        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const info = await ytdl.getInfo(videoId, requestOptions);
        const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');

        const videoFormat = info.formats.find(f => f.itag == itag);
        const audioFormat = info.formats.find(f => f.itag == audioItag);

        if (!videoFormat || !audioFormat) {
            return res.status(500).send('Could not find both video and audio streams.');
        }

        res.header('Content-Disposition', `attachment; filename="${title}.mp4"`);
        res.header('Content-Type', 'video/mp4');

        console.log(`Merging HQ video (${itag}) + audio (${audioItag}) for: ${title}`);

        const ffmpegProcess = ffmpeg()
            .input(ytdl(videoUrl, { format: videoFormat, ...requestOptions }))
            .input(ytdl(videoUrl, { format: audioFormat, ...requestOptions }))
            .outputOptions('-movflags frag_keyframe+empty_moov') // streamable MP4
            .videoCodec('copy')
            .audioCodec('copy')
            .format('mp4')
            .on('start', cmd => console.log('FFmpeg started:', cmd))
            .on('error', err => {
                console.error('FFmpeg error:', err.message);
                if (!res.headersSent) res.status(500).json({ error: 'FFmpeg processing failed: ' + err.message });
            })
            .on('end', () => console.log('Merge complete'))
            .pipe(res, { end: true });

        res.once('close', () => {
            if (ffmpegProcess && !ffmpegProcess.killed) ffmpegProcess.kill('SIGKILL');
        });
    } catch (err) {
        console.error('Error in hq-download route:', err);
        if (!res.headersSent) res.status(500).json({ error: 'Failed to download video.' });
    }
});

// Audio download
app.get('/api/audio', async (req, res) => {
    try {
        const { videoId } = req.query;
        if (!ytdl.validateID(videoId)) return res.status(400).json({ error: 'Invalid video ID' });

        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const info = await ytdl.getInfo(videoId, requestOptions);
        const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');

        res.header('Content-Disposition', `attachment; filename="${title}.mp3"`);

        const audioStream = ytdl(videoUrl, { filter: 'audioonly', quality: 'highestaudio', ...requestOptions })
            .on('error', err => {
                console.error('ytdl stream error:', err);
                if (!res.headersSent) res.status(500).json({ error: err.message });
            });

        audioStream.pipe(res);

        res.once('close', () => {
            audioStream.destroy();
        });
    } catch (err) {
        console.error('Error downloading audio:', err);
        if (!res.headersSent) res.status(500).json({ error: 'Failed to download audio.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
