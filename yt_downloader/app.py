from flask import Flask, request, send_file, jsonify
from pytube import YouTube
from flask_cors import CORS
import os, re

app = Flask(__name__)
CORS(app)  # enable CORS for all routes (frontend can be on any domain)

DOWNLOAD_FOLDER = './downloads'
os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)

def safe_filename(title: str) -> str:
    # Keep letters, numbers, spaces and a few safe symbols
    return re.sub(r'[^a-zA-Z0-9 \-_.()]+', '_', title or 'video')

@app.get("/")
def health():
    return jsonify({"status": "ok"})

@app.get("/api/videoInfo")
def get_video_info():
    url = request.args.get('url', '')
    if not url:
        return jsonify({'error': 'Missing url parameter'}), 400
    try:
        yt = YouTube(url)
        video_details = {
            'videoId': yt.video_id,
            'title': yt.title,
            'author': {'name': yt.author},
            'lengthSeconds': yt.length,
            'viewCount': yt.views,
            # frontend expects an array of objects with 'url'
            'thumbnails': [{'url': yt.thumbnail_url}] if yt.thumbnail_url else []
        }

        # Only progressive MP4 streams (contain both audio & video, easy to serve)
        formats = []
        for s in yt.streams.filter(progressive=True, file_extension="mp4").order_by('resolution').desc():
            try:
                container = (s.mime_type or 'video/mp4').split('/')[-1]
            except Exception:
                container = 'mp4'
            formats.append({
                'itag': s.itag,
                'qualityLabel': s.resolution,
                'container': container,
                'hasVideo': True,
                'hasAudio': getattr(s, 'includes_audio_track', True)
            })

        return jsonify({'videoDetails': video_details, 'formats': formats})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.get("/api/download")
def download_video():
    video_id = request.args.get('videoId', '')
    itag = request.args.get('itag', '')
    title = request.args.get('title', 'video')
    if not video_id or not itag:
        return jsonify({'error': 'Missing videoId or itag'}), 400
    try:
        yt = YouTube(f'https://youtube.com/watch?v={video_id}')
        stream = yt.streams.get_by_itag(itag)
        if stream is None:
            return jsonify({'error': 'Format not found for requested itag'}), 404
        fname = safe_filename(title) + '.mp4'
        path = os.path.join(DOWNLOAD_FOLDER, fname)
        stream.download(output_path=DOWNLOAD_FOLDER, filename=fname)
        # send_file will stream the file; after sending we can optionally remove it
        return send_file(path, as_attachment=True, download_name=fname)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.get("/api/audio")
def download_audio():
    video_id = request.args.get('videoId', '')
    title = request.args.get('title', 'audio')
    if not video_id:
        return jsonify({'error': 'Missing videoId'}), 400
    try:
        yt = YouTube(f'https://youtube.com/watch?v={video_id}')
        stream = yt.streams.filter(only_audio=True).first()
        if stream is None:
            return jsonify({'error': 'Audio stream not found'}), 404
        fname = safe_filename(title) + '.mp3'
        path = os.path.join(DOWNLOAD_FOLDER, fname)
        stream.download(output_path=DOWNLOAD_FOLDER, filename=fname)
        return send_file(path, as_attachment=True, download_name=fname)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
