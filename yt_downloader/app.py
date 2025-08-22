from flask import Flask, render_template, request, send_file, jsonify
from pytube import YouTube, request as pytube_request
import os

app = Flask(__name__, static_folder="static", template_folder="templates")

# ---- Fix for YouTube 400 Error (set headers) ----
pytube_request.default_headers["User-Agent"] = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/114.0.0.0 Safari/537.36"
)

# ---- Downloads Folder ----
DOWNLOAD_FOLDER = './downloads'
if not os.path.exists(DOWNLOAD_FOLDER):
    os.makedirs(DOWNLOAD_FOLDER)


# ---------- Serve Frontend ----------
@app.route("/")
def home():
    return render_template("index.html")


# ---------- Health Check ----------
@app.route("/api/health")
def health():
    return {"status": "ok"}


# ---------- Get Video Info ----------
@app.route("/api/videoInfo", methods=["GET"])
def get_video_info():
    url = request.args.get("url")
    video_id = request.args.get("videoId")

    try:
        # Build full URL if only videoId is provided
        if not url and video_id:
            url = f"https://www.youtube.com/watch?v={video_id}"

        yt = YouTube(url)
        video_details = {
            "title": yt.title,
            "author": {"name": yt.author},
            "lengthSeconds": yt.length,
            "viewCount": yt.views,
            "thumbnails": [{"url": yt.thumbnail_url}],
            "videoId": yt.video_id
        }

        # Build formats list with full info
        formats = []
        for stream in yt.streams.filter(file_extension="mp4"):
            formats.append({
                "itag": stream.itag,
                "mime_type": stream.mime_type,
                "resolution": stream.resolution,
                "abr": stream.abr,
                "hasVideo": stream.includes_video_track,
                "hasAudio": stream.includes_audio_track,
                "container": stream.subtype,
                "qualityLabel": stream.resolution or stream.abr
            })

        return jsonify({
            "videoDetails": video_details,
            "formats": formats
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# ---------- Download Video ----------
@app.route("/api/download", methods=["GET"])
def download_video():
    video_id = request.args.get("videoId")
    itag = request.args.get("itag")
    title = request.args.get("title", "video")

    try:
        yt = YouTube(f"https://youtube.com/watch?v={video_id}")
        stream = yt.streams.get_by_itag(itag)
        safe_title = "".join([c if c.isalnum() else "_" for c in title])
        file_path = os.path.join(DOWNLOAD_FOLDER, f"{safe_title}.mp4")
        stream.download(output_path=DOWNLOAD_FOLDER, filename=f"{safe_title}.mp4")
        return send_file(file_path, as_attachment=True)
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# ---------- Download Audio ----------
@app.route("/api/audio", methods=["GET"])
def download_audio():
    video_id = request.args.get("videoId")
    title = request.args.get("title", "audio")

    try:
        yt = YouTube(f"https://youtube.com/watch?v={video_id}")
        stream = yt.streams.filter(only_audio=True).first()
        safe_title = "".join([c if c.isalnum() else "_" for c in title])
        file_path = os.path.join(DOWNLOAD_FOLDER, f"{safe_title}.mp3")
        stream.download(output_path=DOWNLOAD_FOLDER, filename=f"{safe_title}.mp3")
        return send_file(file_path, as_attachment=True)
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# ---------- Run on Railway ----------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
