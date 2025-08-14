// server.js
import express from 'express';
import cors from 'cors';
import ytdl from '@distube/ytdl-core';
import dotenv from 'dotenv';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { fileURLToPath } from 'url';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from a .env file
dotenv.config();

// Create an Express application
const app = express();
app.use(cors());

const PORT = process.env.PORT || 4000;

// Serve static files from the current directory
app.use(express.static(path.join(__dirname, 'public')));
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

        // Use more comprehensive request options to mimic a modern browser.
        const options = {
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'sec-ch-ua': '"Google Chrome";v="91", "Chromium";v="91", ";Not A Brand";v="99"',
                    'sec-ch-ua-mobile': '?0',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-User': '?1',
                    'Upgrade-Insecure-Requests': '1',
                },
            },
        };

        const info = await ytdl.getInfo(cleanUrl, options);
        const formats = info.formats;

        res.status(200).json({
            videoDetails: info.videoDetails,
            formats: formats
        });
    } catch (error) {
        console.error('Error fetching video info:', error);
        res.status(500).json({ error: `Failed to fetch video information. It might be private, restricted, or an invalid link. Details: ${error.message}` });
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

        res.header('Content-Disposition', `attachment; filename="high-quality-video.mp4"`);

        const videoStream = ytdl(videoUrl, {
            filter: format => format.itag == itag,
        });

        const audioStream = ytdl(videoUrl, {
            filter: 'audioonly',
            quality: 'highestaudio',
        });

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

// Serve the main HTML file for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'YT.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
