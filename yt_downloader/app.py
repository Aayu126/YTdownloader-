from flask import Flask, render_template, request, send_file, jsonify
from pytube import YouTube
import os

app = Flask(__name__, static_folder="static", template_folder="templates")

DOWNLOAD_FOLDER = './downloads'
if not os.path.exists(DOWNLOAD_FOLDER):
    os.makedirs(DOWNLOAD_FOLDER)

@app.route("/")
def home():
    return render_template("index.html")

@app.route('/api/videoInfo', methods=['GET'])
def get_video_info():
    url = request.args.get('url')
    try:
        yt = YouTube(url)
        video_details = {
            "title": yt.title,
            "author": {"name": yt.author},
            "lengthSeconds": yt.length,
            "viewCount": yt.views,
            "thumbnails": [{"url": yt.thumbnail_url}]
        }
        formats = yt.streams.filter(progressive=True, file_extension="mp4").order_by('resolution').desc()
        formats = [f.itag for f in formats]

        return jsonify({
            "videoDetails": video_details,
            "formats": formats
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/download', methods=['GET'])
def download_video():
    video_id = request.args.get('videoId')
    itag = request.args.get('itag')
    title = request.args.get('title', 'video')

    try:
        yt = YouTube(f'https://youtube.com/watch?v={video_id}')
        stream = yt.streams.get_by_itag(itag)
        safe_title = "".join([c if c.isalnum() else "_" for c in title])
        file_path = os.path.join(DOWNLOAD_FOLDER, f'{safe_title}.mp4')
        stream.download(output_path=DOWNLOAD_FOLDER, filename=f'{safe_title}.mp4')
        return send_file(file_path, as_attachment=True)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/audio', methods=['GET'])
def download_audio():
    video_id = request.args.get('videoId')
    title = request.args.get('title', 'audio')

    try:
        yt = YouTube(f'https://youtube.com/watch?v={video_id}')
        stream = yt.streams.filter(only_audio=True).first()
        safe_title = "".join([c if c.isalnum() else "_" for c in title])
        file_path = os.path.join(DOWNLOAD_FOLDER, f'{safe_title}.mp3')
        stream.download(output_path=DOWNLOAD_FOLDER, filename=f'{safe_title}.mp3')
        return send_file(file_path, as_attachment=True)
    except Exception as e:
        return jsonify({"error": str(e)}), 400
