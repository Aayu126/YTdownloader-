import express from 'express';
import cors from 'cors';
import ytdl from '@distube/ytdl-core';
import dotenv from 'dotenv';
import ffmpeg from 'fluent-ffmpeg'; // NEW: Import the ffmpeg library

// Load environment variables from a .env file
dotenv.config();

// Create an Express application
const app = express();
// Enable CORS to allow requests from your frontend
app.use(cors());

// Define the port for the server, using the environment variable or defaulting to 4000
const PORT = process.env.PORT || 4000;

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
        // UPDATED: No longer filtering for combined video/audio formats. 
        // This will expose all available formats, including high-quality video-only streams.
        const formats = info.formats;

        res.status(200).json({
            videoDetails: info.videoDetails,
            formats: formats
        });
    } catch (error) {
        console.error('Error fetching video info:', error);
        res.status(500).json({ error: 'Failed to fetch video information. It might be private, restricted, or an invalid link.' });
    }
});

// Endpoint to download a standard video (combined audio/video stream)
// This endpoint is for backwards compatibility.
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

// NEW: Endpoint to download a high-quality video by combining video and audio streams
app.get('/api/hq-download', (req, res) => {
    try {
        const { videoId, itag } = req.query;
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

        res.header('Content-Disposition', `attachment; filename="high-quality-video.mp4"`);

        // Use ffmpeg to combine the video and audio streams and pipe them to the response
        ffmpeg()
            .input(videoStream)
            .videoCodec('copy') // Copy the video codec to avoid re-encoding
            .input(audioStream)
            .audioCodec('copy') // Copy the audio codec to avoid re-encoding
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