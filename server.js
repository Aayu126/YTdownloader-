import express from 'express';
import cors from 'cors';
import ytdl from '@distube/ytdl-core';
import dotenv from 'dotenv';
import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';

// Load environment variables from a .env file
dotenv.config();

// Create an Express application
const app = express();
// Enable CORS to allow requests from your frontend
app.use(cors());

// Define the port for the server, using the environment variable or defaulting to 4000
const PORT = process.env.PORT || 4000;

// --- FIX: Add a root endpoint to handle base URL requests ---
app.get('/', (req, res) => {
    res.status(200).json({ message: 'Welcome to the YouTube Downloader API! Use the /api endpoints to fetch video info and download content.' });
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
        const formats = info.formats;

        res.status(200).json({
            videoDetails: info.videoDetails,
            formats: formats
        });
    } catch (error) {
        console.error('Error fetching video info:', error.message);
        res.status(500).json({ error: 'Failed to fetch video information. It might be private, restricted, or an invalid link.' });
    }
});

// --- FIX: Main endpoint to download high-quality video by combining streams ---
app.get('/api/download', (req, res) => {
    try {
        const { videoId, itag, title } = req.query;
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        if (!ytdl.validateID(videoId)) {
            return res.status(400).json({ error: 'Invalid video ID' });
        }

        // Get the video stream (video only, based on the provided itag)
        const videoStream = ytdl(videoUrl, {
            filter: format => format.itag == itag
        });

        // Get the audio stream (highest quality audio)
        const audioStream = ytdl(videoUrl, {
            filter: 'audioonly',
            quality: 'highestaudio'
        });

        const safeTitle = (title || 'video').replace(/[^a-zA-Z0-9\s]/g, '_');
        res.header('Content-Disposition', `attachment; filename="${safeTitle}.mp4"`);

        // Use ffmpeg to combine the video and audio streams
        ffmpeg()
            .input(videoStream)
            .videoCodec('copy') // Copy the video codec to avoid re-encoding
            .input(audioStream)
            .audioCodec('aac') // Re-encode audio to AAC for max compatibility
            .format('mp4')
            // Add movflags for better streaming support (important for web players)
            .outputOptions('-movflags', 'frag_keyframe+empty_moov')
            .on('error', (err, stdout, stderr) => {
                console.error('ffmpeg error:', err.message);
                console.error('ffmpeg stderr:', stderr);
                // Don't try to send a response if headers are already sent
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


// --- FIX: Endpoint to download audio only, converted to MP3 ---
app.get('/api/audio', (req, res) => {
    try {
        const { videoId, title } = req.query;
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        if (!ytdl.validateID(videoId)) {
            return res.status(400).json({ error: 'Invalid video ID' });
        }

        const safeTitle = (title || 'audio').replace(/[^a-zA-Z0-9\s]/g, '_');
        res.header('Content-Disposition', `attachment; filename="${safeTitle}.mp3"`);

        // Use ffmpeg to convert to MP3
        ffmpeg()
            .input(ytdl(videoUrl, { filter: 'audioonly', quality: 'highestaudio' }))
            .audioCodec('libmp3lame') // Convert to MP3
            .format('mp3')
            .on('error', (err, stdout, stderr) => {
                console.error('ffmpeg error:', err.message);
                console.error('ffmpeg stderr:', stderr);
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
    console.log(`Server running on port ${PORT}`);
});
