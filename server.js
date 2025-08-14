import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import ytdl from '@distube/ytdl-core';
import dotenv from 'dotenv';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

dotenv.config();

const app = express();
app.use(cors());
const PORT = process.env.PORT || 4000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'YT.html'));
});

// Get video info (unique qualities)
app.get('/api/videoInfo', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ error: 'Please provide a YouTube URL' });

        const cleanUrl = url.split('&')[0];
        if (!ytdl.validateURL(cleanUrl)) return res.status(400).json({ error: 'Invalid YouTube URL' });

        const info = await ytdl.getInfo(cleanUrl);

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
        res.status(500).json({ error: 'Failed to fetch video information.' });
    }
});

// Standard download
app.get('/api/download', (req, res) => {
    try {
        const { videoId, itag } = req.query;
        if (!ytdl.validateID(videoId)) return res.status(400).json({ error: 'Invalid video ID' });

        res.header('Content-Disposition', `attachment; filename="video.mp4"`);
        ytdl(`https://www.youtube.com/watch?v=${videoId}`, { filter: f => f.itag == itag }).pipe(res);
    } catch (error) {
        console.error('Error downloading video:', error);
        res.status(500).json({ error: 'Failed to download video.' });
    }
});

// HQ download with merged audio
app.get('/api/hq-download', (req, res) => {
    try {
        const { videoId, itag } = req.query;
        if (!ytdl.validateID(videoId)) return res.status(400).json({ error: 'Invalid video ID' });

        const videoStream = ytdl(`https://www.youtube.com/watch?v=${videoId}`, { filter: f => f.itag == itag });
        const audioStream = ytdl(`https://www.youtube.com/watch?v=${videoId}`, { filter: 'audioonly', quality: 'highestaudio' });

        res.header('Content-Disposition', `attachment; filename="high-quality-video.mp4"`);
        ffmpeg()
            .input(videoStream)
            .videoCodec('copy')
            .input(audioStream)
            .audioCodec('copy')
            .format('mp4')
            .on('error', err => {
                console.error('ffmpeg error:', err);
                res.status(500).send('Error during video processing');
            })
            .pipe(res, { end: true });
    } catch (error) {
        console.error('Error downloading HQ video:', error);
        res.status(500).json({ error: 'Failed to download HQ video.' });
    }
});

// Audio only
app.get('/api/audio', (req, res) => {
    try {
        const { videoId } = req.query;
        if (!ytdl.validateID(videoId)) return res.status(400).json({ error: 'Invalid video ID' });

        res.header('Content-Disposition', `attachment; filename="audio.mp3"`);
        ytdl(`https://www.youtube.com/watch?v=${videoId}`, { filter: 'audioonly', quality: 'highestaudio' }).pipe(res);
    } catch (error) {
        console.error('Error downloading audio:', error);
        res.status(500).json({ error: 'Failed to download audio.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
