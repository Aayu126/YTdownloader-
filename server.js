import express from 'express';
import cors from 'cors';
import ytdl from '@distube/ytdl-core';
import dotenv from 'dotenv';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 4000;

app.get('/api', (req, res) => {
    res.status(200).json({ message: 'Welcome to the YouTube Downloader API! Use /videoInfo and /download endpoints.' });
});

app.get('/api/videoInfo', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url || !ytdl.validateURL(url)) {
            return res.status(400).json({ error: 'Invalid or missing YouTube URL' });
        }

        // --- FIX: Add request options to mimic a browser, which helps prevent blocking ---
        const info = await ytdl.getInfo(url, {
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.101 Safari/537.36',
                },
            },
        });
        
        res.status(200).json({
            videoDetails: info.videoDetails,
            formats: info.formats
        });
    } catch (error) {
        // --- FIX: Log the actual error to the server console for better debugging ---
        console.error('Detailed error fetching video info:', error);
        res.status(500).json({ error: 'Failed to fetch video information. It might be private, restricted, or an invalid link.' });
    }
});

// --- FIX: Reverted to the more robust download method for high-quality video ---
app.get('/api/download', (req, res) => {
    try {
        const { videoId, itag, title } = req.query;
        if (!ytdl.validateID(videoId)) {
            return res.status(400).json({ error: 'Invalid video ID' });
        }
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const safeTitle = (title || 'video').replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_');
        
        res.header('Content-Disposition', `attachment; filename="${safeTitle}.mp4"`);

        const videoStream = ytdl(videoUrl, { filter: format => format.itag == itag });
        const audioStream = ytdl(videoUrl, { filter: 'audioonly', quality: 'highestaudio' });

        ffmpeg()
            .input(videoStream)
            .videoCodec('copy')
            .input(audioStream)
            .audioCodec('aac')
            .format('mp4')
            .outputOptions('-movflags', 'frag_keyframe+empty_moov')
            .on('error', (err, stdout, stderr) => {
                console.error('ffmpeg error:', err.message);
                console.error('ffmpeg stderr:', stderr);
                if (!res.headersSent) {
                    res.status(500).send('Error during video processing');
                }
            })
            .pipe(res, { end: true });
    } catch (error) {
        console.error('Error during download setup:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to start video download.' });
        }
    }
});

app.get('/api/audio', (req, res) => {
    try {
        const { videoId, title } = req.query;
        if (!ytdl.validateID(videoId)) {
            return res.status(400).json({ error: 'Invalid video ID' });
        }
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const safeTitle = (title || 'audio').replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_');

        res.header('Content-Disposition', `attachment; filename="${safeTitle}.mp3"`);

        ffmpeg(ytdl(videoUrl, { filter: 'audioonly', quality: 'highestaudio' }))
            .audioCodec('libmp3lame')
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
        console.error('Error during audio setup:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to start audio download.' });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});