import express from 'express';
import cors from 'cors';
import ytdl from '@distube/ytdl-core';
import dotenv from 'dotenv';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { fileURLToPath } from 'url';

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

// Serve static files from the current directory
app.use(express.static(__dirname));

// Define a user agent to make requests appear like they're from a browser
const requestOptions = {
    requestOptions: {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
        }
    }
};

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

        const info = await ytdl.getInfo(cleanUrl, requestOptions);
        res.status(200).json({
            videoDetails: info.videoDetails,
            formats: info.formats
        });
    } catch (error) {
        console.error('Error fetching video info:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch video information. It might be private, restricted, or an invalid link.' });
    }
});

// Endpoint to download a standard video (combined audio/video stream)
app.get('/api/download', async (req, res) => {
    try {
        const { videoId, itag } = req.query;
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        
        if (!ytdl.validateID(videoId)) {
            return res.status(400).json({ error: 'Invalid video ID' });
        }
        
        const info = await ytdl.getInfo(videoId, requestOptions);
        const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
        
        res.header('Content-Disposition', `attachment; filename="${title}.mp4"`);

        const videoStream = ytdl(videoUrl, {
            filter: format => format.itag == itag,
            ...requestOptions
        });

        videoStream.on('error', (err) => {
            console.error('ytdl stream error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: err.message || 'Failed to download video stream.' });
            }
        });

        videoStream.pipe(res);
    } catch (error) {
        console.error('Error downloading video:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to download video.' });
        }
    }
});

// Endpoint to download a high-quality video by combining video and audio streams
app.get('/api/hq-download', async (req, res) => {
    try {
        const { videoId } = req.query;
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        if (!ytdl.validateID(videoId)) {
            return res.status(400).json({ error: 'Invalid video ID' });
        }
        
        const info = await ytdl.getInfo(videoId, requestOptions);
        const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
        
        const videoFormat = ytdl.chooseFormat(info.formats, { filter: 'videoonly', quality: 'highestvideo' });
        const audioFormat = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'highestaudio' });

        if (!videoFormat || !audioFormat) {
            return res.status(500).send('Could not find both video and audio streams.');
        }

        res.header('Content-Disposition', `attachment; filename="${title}.mp4"`);
        res.header('Content-Type', 'video/mp4');

        const ffmpegProcess = ffmpeg()
            .input(ytdl(videoUrl, { format: videoFormat, ...requestOptions }))
            .input(ytdl(videoUrl, { format: audioFormat, ...requestOptions }))
            .videoCodec('copy')
            .audioCodec('copy')
            .format('mp4')
            .on('error', (err) => {
                console.error('FFmpeg error:', err.message);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'FFmpeg processing failed: ' + err.message });
                }
            })
            .pipe(res, { end: true });
        
        // Clean up resources if the client disconnects prematurely
        res.once('close', () => {
            if (ffmpegProcess && !ffmpegProcess.killed) {
                ffmpegProcess.kill('SIGKILL');
            }
        });
    } catch (error) {
        console.error('Error in hq-download route:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to download video.' });
        }
    }
});

// Endpoint to download audio
app.get('/api/audio', async (req, res) => {
    try {
        const { videoId } = req.query;
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        if (!ytdl.validateID(videoId)) {
            return res.status(400).json({ error: 'Invalid video ID' });
        }
        
        const info = await ytdl.getInfo(videoId, requestOptions);
        const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
        
        res.header('Content-Disposition', `attachment; filename="${title}.mp3"`);
        
        const audioStream = ytdl(videoUrl, {
            filter: 'audioonly',
            quality: 'highestaudio',
            ...requestOptions
        });
        
        audioStream.on('error', (err) => {
            console.error('ytdl stream error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: err.message || 'Failed to download audio stream.' });
            }
        });

        audioStream.pipe(res);
        
        // Clean up if client disconnects
        res.once('close', () => {
            audioStream.destroy();
        });

    } catch (error) {
        console.error('Error downloading audio:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to download audio.' });
        }
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});