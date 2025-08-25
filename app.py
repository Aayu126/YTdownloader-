import os
from flask import Flask, render_template, request, send_file, jsonify
from pytube import YouTube
import pytube.request as pytube_request

# Patch the User-Agent to prevent getting blocked by YouTube.
if hasattr(pytube_request, "default_headers"):
    pytube_request.default_headers["User-Agent"] = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/117.0.0.0 Safari/537.36"
    )

# Initialize the Flask application, specifying the template and static folders.
app = Flask(__name__, static_folder="static", template_folder="templates")

# Define the folder for temporary video downloads.
DOWNLOAD_FOLDER = './downloads'
if not os.path.exists(DOWNLOAD_FOLDER):
    os.makedirs(DOWNLOAD_FOLDER)

# Helper function to normalize YouTube URLs to a standard format.
def normalize_url(url: str) -> str:
    """
    Converts YouTube URLs (shorts, youtu.be) into the standard /watch?v= format.
    """
    if "youtube.com/shorts/" in url:
        url = url.replace("youtube.com/shorts/", "youtube.com/watch?v=")
    if "youtu.be/" in url:
        url = url.replace("youtu.be/", "youtube.com/watch?v=")
    return url

# Main route for the home page. It renders the index.html template.
@app.route('/')
def home():
    return render_template('index.html')

# API endpoint to fetch video information based on a URL.
@app.route('/api/videoInfo', methods=['GET'])
def get_video_info():
    url = request.args.get('url')
    try:
        yt = YouTube(normalize_url(url))
        video_details = {
            "title": yt.title,
            "author": {"name": yt.author},
            "lengthSeconds": yt.length,
            "viewCount": yt.views,
            "thumbnails": [{"url": yt.thumbnail_url}],
            "videoId": yt.video_id
        }

        formats = []
        # Filter for progressive MP4 streams that include both video and audio.
        for s in yt.streams.filter(progressive=True, file_extension="mp4"):
            formats.append({
                "itag": s.itag,
                "mimeType": s.mime_type,
                "qualityLabel": s.resolution,
                "hasAudio": s.includes_audio_track,
                "hasVideo": s.includes_video_track,
                "container": "mp4"
            })

        return jsonify({"videoDetails": video_details, "formats": formats})
    except Exception as e:
        return jsonify({"error": f"YouTube rejected the request: {str(e)}"}), 400

# API endpoint to download a video stream.
@app.route('/api/download', methods=['GET'])
def download_video():
    video_id = request.args.get('videoId')
    itag = request.args.get('itag')
    title = request.args.get('title', 'video')

    try:
        yt = YouTube(normalize_url(f'https://youtube.com/watch?v={video_id}'))
        stream = yt.streams.get_by_itag(itag)
        # Sanitize the video title for use in the filename.
        safe_title = "".join([c if c.isalnum() else "_" for c in title])
        file_path = os.path.join(DOWNLOAD_FOLDER, f'{safe_title}.mp4')

        # Download the stream and send it as a file.
        stream.download(output_path=DOWNLOAD_FOLDER, filename=f'{safe_title}.mp4')
        return send_file(file_path, as_attachment=True)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# API endpoint to download an audio stream.
@app.route('/api/audio', methods=['GET'])
def download_audio():
    video_id = request.args.get('videoId')
    title = request.args.get('title', 'audio')

    try:
        yt = YouTube(normalize_url(f'https://youtube.com/watch?v={video_id}'))
        # Filter for the first available audio-only stream.
        stream = yt.streams.filter(only_audio=True).first()
        # Sanitize the video title for use in the filename.
        safe_title = "".join([c if c.isalnum() else "_" for c in title])
        file_path = os.path.join(DOWNLOAD_FOLDER, f'{safe_title}.mp3')

        # Download the stream and send it as a file.
        stream.download(output_path=DOWNLOAD_FOLDER, filename=f'{safe_title}.mp3')
        return send_file(file_path, as_attachment=True)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# Health check route for deployment.
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})

if __name__ == '__main__':
    # Run the application on the port specified by the environment variable.
    app.run(host='0.0.0.0', port=int(os.environ.get("PORT", 8080)))

