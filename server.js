import express from 'express';
import cors from 'cors';
import ytdl from '@distube/ytdl-core';
import dotenv from 'dotenv';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import path from 'path';
import { fileURLToPath } from 'url';

// Set ffmpeg binary path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Load environment variables
dotenv.config();

// Create app
const app = express();
app.use(cors());

const PORT = process.env.PORT || 4000;

// Resolve current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve your HTML page
app.use(express.static(__dirname));

// Video info endpoint
app.get('/api/videoInfo', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ error: 'Please provide a YouTube URL' });

        const cleanUrl = url.split('&')[0];
        if (!ytdl.validateURL(cleanUrl)) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        const info = await ytdl.getInfo(cleanUrl);

        // Keep all formats (frontend handles video/audio selection)
        res.json({
            videoDetails: info.videoDetails,
            formats: info.formats
        });
    } catch (error) {
        console.error('Error fetching video info:', error);
        res.status(500).json({ error: 'Failed to fetch video info' });
    }
});

// Normal download (progressive streams with audio)
app.get('/api/download', (req, res) => {
    try {
        const { videoId, itag } = req.query;
        if (!ytdl.validateID(videoId)) {
            return res.status(400).json({ error: 'Invalid video ID' });
        }

        res.header('Content-Disposition', `attachment; filename="video.mp4"`);
        ytdl(`https://www.youtube.com/watch?v=${videoId}`, {
            filter: format => format.itag == itag
        }).pipe(res);

    } catch (error) {
        console.error('Error downloading video:', error);
        res.status(500).json({ error: 'Failed to download video' });
    }
});

// HQ download (merge video-only + chosen audio)
app.get('/api/hq-download', async (req, res) => {
    try {
        const { videoId, itag, audioItag } = req.query;
        if (!ytdl.validateID(videoId)) {
            return res.status(400).json({ error: 'Invalid video ID' });
        }
        if (!itag || !audioItag) {
            return res.status(400).json({ error: 'Both video itag and audio itag are required' });
        }

        const videoStream = ytdl(`https://www.youtube.com/watch?v=${videoId}`, {
            filter: format => format.itag == itag
        });

        const audioStream = ytdl(`https://www.youtube.com/watch?v=${videoId}`, {
            filter: format => format.itag == audioItag
        });

        res.header('Content-Disposition', `attachment; filename="video_with_audio.mp4"`);
        res.header('Content-Type', 'video/mp4');

        ffmpeg()
            .input(videoStream)
            .input(audioStream)
            .videoCodec('copy') // keep original video codec
            .audioCodec('aac') // re-encode audio for compatibility
            .audioBitrate(128)
            .format('mp4')
            .on('error', err => {
                console.error('FFmpeg error:', err);
                if (!res.headersSent) {
                    res.status(500).send('Error during video processing');
                }
            })
            .pipe(res, { end: true });

    } catch (error) {
        console.error('Error in HQ download:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to download video' });
        }
    }
});

// Audio-only download
app.get('/api/audio', (req, res) => {
    try {
        const { videoId } = req.query;
        if (!ytdl.validateID(videoId)) {
            return res.status(400).json({ error: 'Invalid video ID' });
        }

        res.header('Content-Disposition', `attachment; filename="audio.mp3"`);
        ytdl(`https://www.youtube.com/watch?v=${videoId}`, {
            filter: 'audioonly',
            quality: 'highestaudio'
        }).pipe(res);

    } catch (error) {
        console.error('Error downloading audio:', error);
        res.status(500).json({ error: 'Failed to download audio' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
