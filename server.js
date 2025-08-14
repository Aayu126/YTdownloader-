// Polyfill for File in Node.js (needed for undici / fetch)
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
import ffmpegPath from 'ffmpeg-static';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from a .env file
dotenv.config();

// Set FFmpeg binary path
ffmpeg.setFfmpegPath(ffmpegPath);

// Create an Express application
const app = express();
app.use(cors());

const PORT = process.env.PORT || 4000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(__dirname));

const requestOptions = {
    requestOptions: {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
        }
    }
};

// Get video info (unique quality formats only)
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

        res.status(200).json({
            videoDetails: info.videoDetails,
            formats: uniqueFormats
        });
    } catch (error) {
        console.error('Error fetching video info:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch video information.' });
    }
});

// Standard video download
app.get('/api/download', async (req, res) => {
    try {
        const { videoId, itag } = req.query;
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        if (!ytdl.validateID(videoId)) return res.status(400).json({ error: 'Invalid video ID' });

        const info = await ytdl.getInfo(videoId, requestOptions);
        const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
        res.header('Content-Disposition', `attachment; filename="${title}.mp4"`);

        const videoStream = ytdl(videoUrl, { filter: f => f.itag == itag, ...requestOptions });
        videoStream.pipe(res);
    } catch (error) {
        console.error('Error downloading video:', error);
        if (!res.headersSent) res.status(500).json({ error: 'Failed to download video.' });
    }
});

// HQ video + audio merged (container-aware)
app.get('/api/hq-download', async (req, res) => {
    try {
        const { videoId } = req.query;
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        if (!ytdl.validateID(videoId)) return res.status(400).json({ error: 'Invalid video ID' });

        const info = await ytdl.getInfo(videoId, requestOptions);
        const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');

        const videoFormat = ytdl.chooseFormat(info.formats, { filter: 'videoonly', quality: 'highestvideo' });
        const audioFormat = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'highestaudio' });
        if (!videoFormat || !audioFormat) return res.status(500).send('Could not find both video and audio streams.');

        // Decide container type based on codecs
        const isMp4 = videoFormat.container === 'mp4' && audioFormat.container === 'mp4';
        const outputExt = isMp4 ? 'mp4' : 'webm';

        res.header('Content-Disposition', `attachment; filename="${title}.${outputExt}"`);
        res.header('Content-Type', `video/${outputExt}`);

        const ffmpegProcess = ffmpeg()
            .input(ytdl(videoUrl, { format: videoFormat, ...requestOptions }))
            .input(ytdl(videoUrl, { format: audioFormat, ...requestOptions }))
            .outputOptions(['-c:v copy', '-c:a copy'])
            .format(outputExt)
            .on('error', (err) => {
                console.error('FFmpeg error:', err.message);
                if (!res.headersSent) res.status(500).json({ error: 'FFmpeg processing failed: ' + err.message });
            })
            .pipe(res, { end: true });

        res.once('close', () => {
            if (ffmpegProcess && !ffmpegProcess.killed) ffmpegProcess.kill('SIGKILL');
        });
    } catch (error) {
        console.error('Error in hq-download route:', error);
        if (!res.headersSent) res.status(500).json({ error: 'Failed to download video.' });
    }
});

// Audio download
app.get('/api/audio', async (req, res) => {
    try {
        const { videoId } = req.query;
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        if (!ytdl.validateID(videoId)) return res.status(400).json({ error: 'Invalid video ID' });

        const info = await ytdl.getInfo(videoId, requestOptions);
        const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
        res.header('Content-Disposition', `attachment; filename="${title}.mp3"`);

        const audioStream = ytdl(videoUrl, { filter: 'audioonly', quality: 'highestaudio', ...requestOptions });
        audioStream.pipe(res);
    } catch (error) {
        console.error('Error downloading audio:', error);
        if (!res.headersSent) res.status(500).json({ error: 'Failed to download audio.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
