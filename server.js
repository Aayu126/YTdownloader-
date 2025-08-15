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

// Enhanced agent configuration to avoid bot detection
const createAgent = () => {
    return ytdl.createAgent([
        {
            "domain": ".youtube.com",
            "expirationDate": 1728000000,
            "hostOnly": false,
            "httpOnly": false,
            "name": "VISITOR_INFO1_LIVE",
            "path": "/",
            "sameSite": "no_restriction",
            "secure": true,
            "session": false,
            "storeId": "0",
            "value": "abcdefghijklmnop"
        },
        {
            "domain": ".youtube.com",
            "expirationDate": 1728000000,
            "hostOnly": false,
            "httpOnly": false,
            "name": "CONSENT",
            "path": "/",
            "sameSite": "no_restriction",
            "secure": true,
            "session": false,
            "storeId": "0",
            "value": "YES+cb.20210328-17-p0.en+FX+626"
        }
    ]);
};

// Enhanced request options with better browser simulation
const getRequestOptions = () => {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0'
    ];
    
    const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    
    return {
        requestOptions: {
            headers: {
                'User-Agent': randomUserAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'max-age=0',
                'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
                'Connection': 'keep-alive',
                'DNT': '1'
            },
            timeout: 30000
        },
        agent: createAgent()
    };
};

// Helper function to add delay between requests
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to validate and clean YouTube URL
const validateAndCleanUrl = (url) => {
    try {
        // Remove any extra parameters that might cause issues
        const cleanUrl = url.split('&')[0].split('#')[0];
        
        // Extract video ID and reconstruct URL
        const videoId = ytdl.getVideoID(cleanUrl);
        return `https://www.youtube.com/watch?v=${videoId}`;
    } catch (error) {
        throw new Error('Invalid YouTube URL format');
    }
};

// Endpoint to get video information
app.get('/api/videoInfo', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) {
            return res.status(400).json({ error: 'Please provide a YouTube URL' });
        }

        // Validate and clean the URL
        const cleanUrl = validateAndCleanUrl(url);

        if (!ytdl.validateURL(cleanUrl)) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        // Add a small delay to avoid rapid requests
        await delay(1000);

        // Get enhanced request options
        const options = getRequestOptions();

        console.log('Fetching video info for:', cleanUrl);
        
        // Try to get video info with retries
        let info;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                info = await ytdl.getInfo(cleanUrl, options);
                break;
            } catch (error) {
                attempts++;
                console.log(`Attempt ${attempts} failed:`, error.message);
                
                if (attempts === maxAttempts) {
                    throw error;
                }
                
                // Wait longer between retries
                await delay(2000 * attempts);
                
                // Refresh options for retry
                options.requestOptions.headers['User-Agent'] = getRequestOptions().requestOptions.headers['User-Agent'];
            }
        }

        // Filter formats to get only video formats with quality labels
        const videoFormats = info.formats.filter(format => 
            format.hasVideo && 
            format.qualityLabel && 
            !format.hasAudio
        );

        // Get audio formats
        const audioFormats = info.formats.filter(format => 
            format.hasAudio && 
            !format.hasVideo
        );

        // Combine formats for response
        const formats = [...videoFormats, ...audioFormats];

        res.status(200).json({
            videoDetails: {
                videoId: info.videoDetails.videoId,
                title: info.videoDetails.title,
                lengthSeconds: info.videoDetails.lengthSeconds,
                thumbnails: info.videoDetails.thumbnails,
                author: {
                    name: info.videoDetails.author.name
                },
                viewCount: info.videoDetails.viewCount
            },
            formats: formats.map(format => ({
                itag: format.itag,
                qualityLabel: format.qualityLabel,
                hasVideo: format.hasVideo,
                hasAudio: format.hasAudio,
                container: format.container,
                mimeType: format.mimeType
            }))
        });

    } catch (error) {
        console.error('Error fetching video info:', error);
        
        let errorMessage = 'Failed to fetch video information.';
        
        if (error.message.includes('Sign in to confirm')) {
            errorMessage = 'YouTube is temporarily blocking requests. Please try again in a few minutes or try a different video.';
        } else if (error.message.includes('Video unavailable')) {
            errorMessage = 'Video is unavailable, private, or restricted in your region.';
        } else if (error.message.includes('429')) {
            errorMessage = 'Too many requests. Please wait a moment before trying again.';
        }
        
        res.status(500).json({ 
            error: `${errorMessage} Details: ${error.message}` 
        });
    }
});

// Endpoint to download video
app.get('/api/download', async (req, res) => {
    try {
        const { videoId, itag } = req.query;
        
        if (!videoId || !itag) {
            return res.status(400).json({ error: 'Video ID and itag are required' });
        }

        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        if (!ytdl.validateID(videoId)) {
            return res.status(400).json({ error: 'Invalid video ID' });
        }

        // Add delay before download
        await delay(500);

        const options = getRequestOptions();

        // Get video info to determine format details
        const info = await ytdl.getInfo(videoUrl, options);
        const format = info.formats.find(f => f.itag == itag);
        
        if (!format) {
            return res.status(400).json({ error: 'Format not found' });
        }

        const filename = `${info.videoDetails.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_')}.${format.container}`;
        
        res.header('Content-Disposition', `attachment; filename="${filename}"`);
        res.header('Content-Type', format.mimeType || 'video/mp4');

        const stream = ytdl(videoUrl, { 
            format: format,
            ...options
        });

        stream.pipe(res);

        stream.on('error', (error) => {
            console.error('Stream error:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Download failed' });
            }
        });

    } catch (error) {
        console.error('Error downloading video:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to download video.' });
        }
    }
});

// Endpoint to download audio
app.get('/api/audio', async (req, res) => {
    try {
        const { videoId } = req.query;
        
        if (!videoId) {
            return res.status(400).json({ error: 'Video ID is required' });
        }

        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        if (!ytdl.validateID(videoId)) {
            return res.status(400).json({ error: 'Invalid video ID' });
        }

        // Add delay before download
        await delay(500);

        const options = getRequestOptions();

        // Get video info
        const info = await ytdl.getInfo(videoUrl, options);
        const filename = `${info.videoDetails.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_')}.mp3`;

        res.header('Content-Disposition', `attachment; filename="${filename}"`);
        res.header('Content-Type', 'audio/mpeg');

        const stream = ytdl(videoUrl, {
            filter: 'audioonly',
            quality: 'highestaudio',
            ...options
        });

        stream.pipe(res);

        stream.on('error', (error) => {
            console.error('Audio stream error:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Audio download failed' });
            }
        });

    } catch (error) {
        console.error('Error downloading audio:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to download audio.' });
        }
    }
});

// Serve the main HTML file for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check available at http://localhost:${PORT}/health`);
});