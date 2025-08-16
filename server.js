import express from 'express';
import cors from 'cors';
import ytdl from '@distube/ytdl-core';
import dotenv from 'dotenv';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from a .env file
dotenv.config();

// --- FIX: Setup for ES Modules to handle __dirname ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create an Express application
const app = express();
// Enable CORS to allow requests from your frontend
app.use(cors());

// --- FIX: Serve the frontend static files from the 'public' directory ---
app.use(express.static(path.join(__dirname, 'public')));

// Define the port for the server, using the environment variable or defaulting to 4000
const PORT = process.env.PORT || 4000;

// Welcome endpoint for the API itself
app.get('/api', (req, res) => {
    res.status(200).json({ message: 'Welcome to the YouTube Downloader API! Use /videoInfo and /download endpoints.' });
});

// Endpoint to get video information
app.get('/api/videoInfo', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) {
            return res.status(400).json({ error: 'Please provide a YouTube URL' });
        }
        
        const cleanUrl = url.split('&')[0];

        if (!ytdl.validateURL(cleanUrl)) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        const info = await ytdl.getInfo(cleanUrl);
        
        res.status(200).json({
            videoDetails: info.videoDetails,
            formats: ytdl.filterFormats(info.formats, 'videoandaudio')
        });
    } catch (error) {
        console.error('Error fetching video info:', error.message);
        res.status(500).json({ error: 'Failed to fetch video information. It might be private, restricted, or an invalid link.' });
    }
});

// Main endpoint to download video
app.get('/api/download', (req, res) => {
    try {
        const { videoId, itag, title } = req.query;
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        if (!ytdl.validateID(videoId)) {
            return res.status(400).json({ error: 'Invalid video ID' });
        }
        
        // --- FIX: Improved filename sanitization ---
        const safeTitle = (title || 'video').replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_');
        res.header('Content-Disposition', `attachment; filename="${safeTitle}.mp4"`);

        const videoStream = ytdl(videoUrl, { quality: itag });

        // Pipe the video stream directly to ffmpeg
        ffmpeg(videoStream)
            .audioCodec('aac')
            .videoCodec('copy')
            .format('mp4')
            .on('error', (err) => {
                console.error('ffmpeg error:', err.message);
                if (!res.headersSent) {
                    res.status(500).send('Error during video processing');
                }
            })
            .pipe(res, { end: true });

    } catch (error) {
        console.error('Error downloading video:', error.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to download video.' });
        }
    }
});


// Endpoint to download audio only, converted to MP3
app.get('/api/audio', (req, res) => {
    try {
        const { videoId, title } = req.query;
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        if (!ytdl.validateID(videoId)) {
            return res.status(400).json({ error: 'Invalid video ID' });
        }
        
        // --- FIX: Improved filename sanitization ---
        const safeTitle = (title || 'audio').replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_');
        res.header('Content-Disposition', `attachment; filename="${safeTitle}.mp3"`);

        // Use ffmpeg to convert to MP3
        ffmpeg()
            .input(ytdl(videoUrl, { filter: 'audioonly', quality: 'highestaudio' }))
            .audioCodec('libmp3lame')
            .format('mp3')
            .on('error', (err) => {
                console.error('ffmpeg error:', err.message);
                if (!res.headersSent) {
                    res.status(500).send('Error during audio processing');
                }
            })
            .pipe(res, { end: true });

    } catch (error) {
        console.error('Error downloading audio:', error.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to download audio.' });
        }
    }
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});