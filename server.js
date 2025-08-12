import express from 'express';
import cors from 'cors';
import ytdl from '@distube/ytdl-core';
import dotenv from 'dotenv';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path'; // Import the 'path' module
import { fileURLToPath } from 'url'; // Import fileURLToPath to resolve the current directory

// Load environment variables from a .env file
dotenv.config();

// Create an Express application
const app = express();
// Enable CORS to allow requests from your frontend
app.use(cors());

// Define the port for the server, using the environment variable or defaulting to 4000
const PORT = process.env.PORT || 4000;

// Resolve the directory name to be used for serving static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from the current directory (where YT.html, Script.js, and styles.css are located)
app.use(express.static(__dirname));

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
        const formats = info.formats;

        res.status(200).json({
            videoDetails: info.videoDetails,
            formats: formats
        });
    } catch (error) {
        // Log the full error for server-side debugging
        console.error('Error fetching video info:', error);

        // Send a more informative message to the frontend
        res.status(500).json({ error: error.message || 'Failed to fetch video information. It might be private, restricted, or an invalid link.' });
    }
});

// Endpoint to download a standard video (combined audio/video stream)
app.get('/api/download', (req, res) => {
    try {
        const { videoId, itag } = req.query;
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        
        if (!ytdl.validateID(videoId)) {
            return res.status(400).json({ error: 'Invalid video ID' });
        }

        res.header('Content-Disposition', `attachment; filename="video.mp4"`);

        ytdl(videoUrl, {
            filter: format => format.itag == itag
        }).pipe(res);
    } catch (error) {
        console.error('Error downloading video:', error);
        res.status(500).json({ error: 'Failed to download video.' });
    }
});

// Endpoint to download a high-quality video by combining video and audio streams
app.get('/api/hq-download', (req, res) => {
    try {
        const { videoId, itag } = req.query;
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        if (!ytdl.validateID(videoId)) {
            return res.status(400).json({ error: 'Invalid video ID' });
        }

        const videoStream = ytdl(videoUrl, {
            filter: format => format.itag == itag
        });

        const audioStream = ytdl(videoUrl, {
            filter: 'audioonly',
            quality: 'highestaudio'
        });

        res.header('Content-Disposition', `attachment; filename="high-quality-video.mp4"`);

        ffmpeg()
            .input(videoStream)
            .videoCodec('copy')
            .input(audioStream)
            .audioCodec('copy')
            .format('mp4')
            .on('error', (err) => {
                console.error('ffmpeg error:', err);
                res.status(500).send('Error during video processing');
            })
            .pipe(res, { end: true });
    } catch (error) {
        console.error('Error downloading video:', error);
        res.status(500).json({ error: 'Failed to download video.' });
    }
});

// Endpoint to download audio
app.get('/api/audio', (req, res) => {
    try {
        const { videoId } = req.query;
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        if (!ytdl.validateID(videoId)) {
            return res.status(400).json({ error: 'Invalid video ID' });
        }

        res.header('Content-Disposition', `attachment; filename="audio.mp3"`);

        ytdl(videoUrl, {
            filter: 'audioonly',
            quality: 'highestaudio'
        }).pipe(res);
    } catch (error) {
        console.error('Error downloading audio:', error);
        res.status(500).json({ error: 'Failed to download audio.' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
