import os
from flask import Flask, render_template, request, send_file, jsonify
import yt_dlp

# Initialize the Flask application, specifying the template and static folders.
app = Flask(__name__, static_folder="static", template_folder="templates")

# Define the folder for temporary downloads.
DOWNLOAD_FOLDER = './downloads'
if not os.path.exists(DOWNLOAD_FOLDER):
    os.makedirs(DOWNLOAD_FOLDER)

# ✅ If YT_COOKIES env var is set, save it to cookies.txt
COOKIE_FILE = "cookies.txt"
if os.getenv("YT_COOKIES"):
    with open(COOKIE_FILE, "w", encoding="utf-8") as f:
        f.write(os.getenv("YT_COOKIES"))

# Helper function to normalize YouTube URLs to a standard format.
def normalize_url(url: str) -> str:
    if "youtube.com/shorts/" in url:
        url = url.replace("youtube.com/shorts/", "youtube.com/watch?v=")
    if "youtu.be/" in url:
        url = url.replace("youtu.be/", "youtube.com/watch?v=")
    return url


# ---------------- Routes ----------------

@app.route('/')
def home():
    return render_template('index.html')


# API endpoint to fetch video information based on a URL.
@app.route('/api/videoInfo', methods=['GET'])
def get_video_info():
    url = request.args.get('url')
    try:
        ydl_opts = {
            "quiet": True,
            "noplaylist": True,
            "cookiefile": COOKIE_FILE if os.path.exists(COOKIE_FILE) else None
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(normalize_url(url), download=False)

            video_details = {
                "title": info.get("title"),
                "author": {"name": info.get("uploader")},
                "lengthSeconds": info.get("duration"),
                "viewCount": info.get("view_count"),
                "thumbnails": info.get("thumbnails", []),
                "videoId": info.get("id"),
            }

            formats = [
                {
                    "format_id": f.get("format_id"),
                    "mimeType": f.get("ext"),
                    "qualityLabel": f.get("format_note"),
                    "hasAudio": f.get("acodec") != "none",
                    "hasVideo": f.get("vcodec") != "none",
                    "container": f.get("ext"),
                }
                for f in info.get("formats", [])
                if f.get("url") and f.get("ext") in ["mp4", "webm"]
            ]

        return jsonify({"videoDetails": video_details, "formats": formats})
    except Exception as e:
        return jsonify({"error": f"YouTube rejected the request: {str(e)}"}), 400


# API endpoint to download a video stream.
@app.route('/api/download', methods=['GET'])
def download_video():
    video_id = request.args.get('videoId')
    title = request.args.get('title', 'video')
    url = f"https://youtube.com/watch?v={video_id}"

    try:
        safe_title = "".join([c if c.isalnum() else "_" for c in title])
        file_path = os.path.join(DOWNLOAD_FOLDER, f"{safe_title}.mp4")

        ydl_opts = {
            "format": "best[ext=mp4]",
            "outtmpl": file_path,
            "cookiefile": COOKIE_FILE if os.path.exists(COOKIE_FILE) else None
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        return send_file(file_path, as_attachment=True)
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# API endpoint to download an audio stream.
@app.route('/api/audio', methods=['GET'])
def download_audio():
    video_id = request.args.get('videoId')
    title = request.args.get('title', 'audio')
    url = f"https://youtube.com/watch?v={video_id}"

    try:
        safe_title = "".join([c if c.isalnum() else "_" for c in title])
        file_path = os.path.join(DOWNLOAD_FOLDER, f"{safe_title}.mp3")

        ydl_opts = {
            "format": "bestaudio/best",
            "outtmpl": file_path,
            "cookiefile": COOKIE_FILE if os.path.exists(COOKIE_FILE) else None,
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "192",
                }
            ],
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        return send_file(file_path, as_attachment=True)
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# Health check route for deployment.
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get("PORT", 8080)))
