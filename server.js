import express from 'express';
import cors from 'cors';
import ytdl from '@distube/ytdl-core';
import dotenv from 'dotenv';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

// Load environment variables from a .env file
dotenv.config();

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

// Get video info
app.get('/api/videoInfo', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ error: 'Please provide a YouTube URL' });
        
        const cleanUrl = url.split('&')[0];
        if (!ytdl.validateURL(cleanUrl)) return res.status(400).json({ error: 'Invalid YouTube URL' });

        const info = await ytdl.getInfo(cleanUrl, requestOptions);
        res.status(200).json({
            videoDetails: info.videoDetails,
            formats: info.formats
        });
    } catch (error) {
        console.error('Error fetching video info:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch video information.' });
    }
});

// Standard download
app.get('/api/download', (req, res) => {
    try {
        const { videoId, itag } = req.query;
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        if (!ytdl.validateID(videoId)) return res.status(400).json({ error: 'Invalid video ID' });

        res.header('Content-Disposition', `attachment; filename="video.mp4"`);
        const videoStream = ytdl(videoUrl, { filter: f => f.itag == itag, ...requestOptions });
        videoStream.on('error', (err) => {
            console.error('ytdl stream error:', err);
            if (!res.headersSent) res.status(500).json({ error: err.message || 'Failed to download video stream.' });
        });
        videoStream.pipe(res);
    } catch (error) {
        console.error('Error downloading video:', error);
        res.status(500).json({ error: 'Failed to download video.' });
    }
});

// High-quality download (merges first, then sends)
app.get('/api/hq-download', async (req, res) => {
    try {
        const { videoId, itag } = req.query;
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        if (!ytdl.validateID(videoId)) return res.status(400).json({ error: 'Invalid video ID' });

        const tempPath = path.join(os.tmpdir(), `${videoId}-${Date.now()}.mp4`);
        const videoStream = ytdl(videoUrl, { filter: f => f.itag == itag, ...requestOptions });
        const audioStream = ytdl(videoUrl, { filter: 'audioonly', quality: 'highestaudio', ...requestOptions });

        ffmpeg()
            .input(videoStream)
            .videoCodec('copy')
            .input(audioStream)
            .audioCodec('copy')
            .format('mp4')
            .save(tempPath)
            .on('start', () => {
                console.log(`Merging video for ${videoId}...`);
            })
            .on('end', () => {
                console.log(`Merge complete: ${tempPath}`);
                res.download(tempPath, 'high-quality-video.mp4', (err) => {
                    fs.unlink(tempPath, () => {}); // cleanup
                    if (err) console.error('Error sending file:', err);
                });
            })
            .on('error', (err) => {
                console.error('FFmpeg error:', err);
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                if (!res.headersSent) res.status(500).json({ error: 'FFmpeg processing failed: ' + err.message });
            });

    } catch (error) {
        console.error('Error in hq-download route:', error);
        if (!res.headersSent) res.status(500).json({ error: error.message || 'Failed to download video.' });
    }
});

// Audio download
app.get('/api/audio', (req, res) => {
    try {
        const { videoId } = req.query;
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        if (!ytdl.validateID(videoId)) return res.status(400).json({ error: 'Invalid video ID' });

        res.header('Content-Disposition', `attachment; filename="audio.mp3"`);
        const audioStream = ytdl(videoUrl, { filter: 'audioonly', quality: 'highestaudio', ...requestOptions });
        audioStream.on('error', (err) => {
            console.error('ytdl stream error:', err);
            if (!res.headersSent) res.status(500).json({ error: err.message || 'Failed to download audio stream.' });
        });
        audioStream.pipe(res);
        res.once('close', () => audioStream.destroy());
    } catch (error) {
        console.error('Error downloading audio:', error);
        if (!res.headersSent) res.status(500).json({ error: 'Failed to download audio.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
