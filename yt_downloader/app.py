import os
import re
import urllib.request
import urllib.parse
from flask import Flask, render_template, request, send_file, jsonify
from pytube import YouTube

app = Flask(__name__, static_folder="static", template_folder="templates")

# ---- Force a desktop User-Agent (fixes many 400 errors on some hosts) ----
opener = urllib.request.build_opener()
opener.addheaders = [(
    "User-Agent",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/114.0.0.0 Safari/537.36"
)]
urllib.request.install_opener(opener)

# ---- Downloads folder (ephemeral on Railway) ----
DOWNLOAD_FOLDER = "./downloads"
os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)

# -------- Helpers --------
YT_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{11}$")

def extract_video_id(any_url_or_id: str) -> str | None:
    s = any_url_or_id.strip()
    if YT_ID_RE.match(s):
        return s

    # youtu.be/<id>
    if "youtu.be/" in s:
        vid = s.split("youtu.be/")[-1].split("?")[0].split("/")[0]
        return vid if YT_ID_RE.match(vid) else None

    # /shorts/<id>
    if "/shorts/" in s:
        vid = s.split("/shorts/")[-1].split("?")[0].split("/")[0]
        return vid if YT_ID_RE.match(vid) else None

    # /embed/<id>
    if "/embed/" in s:
        vid = s.split("/embed/")[-1].split("?")[0].split("/")[0]
        return vid if YT_ID_RE.match(vid) else None

    # watch?v=<id>
    try:
        parsed = urllib.parse.urlparse(s)
        qs = urllib.parse.parse_qs(parsed.query)
        if "v" in qs and qs["v"]:
            vid = qs["v"][0]
            return vid if YT_ID_RE.match(vid) else None
    except Exception:
        pass

    return None

def normalize_watch_url(any_url_or_id: str) -> str:
    vid = extract_video_id(any_url_or_id)
    if not vid:
        raise ValueError("Invalid YouTube URL or Video ID")
    return f"https://www.youtube.com/watch?v={vid}"

# -------- Routes --------
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/api/health")
def health():
    return {"status": "ok"}

@app.route("/api/videoInfo", methods=["GET"])
def get_video_info():
    raw = request.args.get("url") or request.args.get("videoId")
    if not raw:
        return jsonify({"error": "Missing 'url' or 'videoId' parameter"}), 400

    try:
        url = normalize_watch_url(raw)
        yt = YouTube(url)  # You can also try YouTube(url, use_oauth=False, allow_oauth_cache=True)

        video_details = {
            "title": yt.title,
            "author": {"name": yt.author},
            "lengthSeconds": yt.length,
            "viewCount": yt.views,
            "thumbnails": [{"url": yt.thumbnail_url}],
            "videoId": yt.video_id
        }

        # Build detailed formats list (both progressive and adaptive mp4 streams)
        formats = []
        for s in yt.streams.filter(file_extension="mp4"):
            # Some attrs might be None
            resolution = getattr(s, "resolution", None)
            abr = getattr(s, "abr", None)
            has_video = getattr(s, "includes_video_track", False)
            has_audio = getattr(s, "includes_audio_track", False)
            container = getattr(s, "subtype", "mp4")

            formats.append({
                "itag": s.itag,
                "mime_type": s.mime_type,
                "resolution": resolution,
                "abr": abr,
                "hasVideo": has_video,
                "hasAudio": has_audio,
                "container": container,
                "qualityLabel": resolution or abr or "unknown"
            })

        # Prefer highest quality first on client, but we just return all
        return jsonify({"videoDetails": video_details, "formats": formats})

    except Exception as e:
        msg = str(e)
        # Friendlier messages for common cases
        if "HTTP Error 410" in msg or "HTTP Error 404" in msg or "regex_search" in msg:
            msg = "YouTube changed something or the video is unavailable. Try another video."
        elif "410" in msg or "membersOnly" in msg or "age" in msg or "private" in msg:
            msg = "Video is age-restricted/private/members-only. This cannot be fetched without cookies."
        elif "HTTP Error 400" in msg:
            msg = "YouTube rejected the request (400). Try a different link or convert a /shorts/ link to a normal watch URL."
        return jsonify({"error": msg}), 400

@app.route("/api/download", methods=["GET"])
def download_video():
    video_id = request.args.get("videoId")
    itag = request.args.get("itag")
    title = request.args.get("title", "video")

    if not video_id or not itag:
        return jsonify({"error": "Missing videoId or itag"}), 400

    try:
        url = normalize_watch_url(video_id)
        yt = YouTube(url)
        stream = yt.streams.get_by_itag(itag)
        if not stream:
            return jsonify({"error": "Stream not found for that itag"}), 400

        safe_title = "".join([c if c.isalnum() else "_" for c in title])[:120]
        file_path = os.path.join(DOWNLOAD_FOLDER, f"{safe_title}.mp4")
        stream.download(output_path=DOWNLOAD_FOLDER, filename=f"{safe_title}.mp4")
        return send_file(file_path, as_attachment=True)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/api/audio", methods=["GET"])
def download_audio():
    video_id = request.args.get("videoId")
    title = request.args.get("title", "audio")

    if not video_id:
        return jsonify({"error": "Missing videoId"}), 400

    try:
        url = normalize_watch_url(video_id)
        yt = YouTube(url)
        stream = yt.streams.filter(only_audio=True).first()
        if not stream:
            return jsonify({"error": "No audio stream found"}), 400

        safe_title = "".join([c if c.isalnum() else "_" for c in title])[:120]
        file_path = os.path.join(DOWNLOAD_FOLDER, f"{safe_title}.mp3")
        stream.download(output_path=DOWNLOAD_FOLDER, filename=f"{safe_title}.mp3")
        return send_file(file_path, as_attachment=True)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
