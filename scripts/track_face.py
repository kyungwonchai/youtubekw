#!/usr/bin/env python3
import sys
import os
import json
import subprocess
import cv2

def get_stream_url(video_id):
    yt_url = f"https://www.youtube.com/watch?v={video_id}"
    cmd = [
        "yt-dlp",
        "-f", "best[height<=360]/worst[ext=mp4]/worst",
        "-g",
        yt_url
    ]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        if res.returncode == 0 and res.stdout.strip():
            urls = res.stdout.strip().split("\n")
            return urls[0]
    except Exception as e:
        sys.stderr.write(f"yt-dlp error: {e}\n")
    return None

def analyze_video_faces(video_id, max_duration=900, step_sec=0.5):
    cache_dir = os.path.join(os.path.dirname(__file__), "..", "data", "face_tracks")
    os.makedirs(cache_dir, exist_ok=True)
    cache_file = os.path.join(cache_dir, f"{video_id}.json")

    if os.path.exists(cache_file):
        try:
            with open(cache_file, "r") as f:
                return json.load(f)
        except Exception:
            pass

    stream_url = get_stream_url(video_id)
    if not stream_url:
        return {"ok": False, "error": "Failed to resolve stream URL"}

    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    profile_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_profileface.xml")

    cap = cv2.VideoCapture(stream_url)
    if not cap.isOpened():
        return {"ok": False, "error": "Cannot open video stream"}

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_step = int(fps * step_sec)
    if frame_step < 1:
        frame_step = 15

    tracks = []
    frame_idx = 0
    last_x, last_y, last_r = 50.0, 35.0, 70.0

    while True:
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        if not ret:
            break

        timestamp = round(frame_idx / fps, 2)
        if timestamp > max_duration:
            break

        h, w = frame.shape[:2]
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Detect faces
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.15, minNeighbors=4, minSize=(30, 30))
        if len(faces) == 0:
            faces = profile_cascade.detectMultiScale(gray, scaleFactor=1.15, minNeighbors=4, minSize=(30, 30))

        if len(faces) > 0:
            # Pick the largest face (main speaker)
            best_face = max(faces, key=lambda b: b[2] * b[3])
            bx, by, bw, bh = best_face
            
            # Center of face in percentage (0~100)
            cx = round(((bx + bw / 2.0) / w) * 100.0, 1)
            cy = round(((by + bh * 0.45) / h) * 100.0, 1) # slightly higher than center for eyes/mouth view
            radius = round((max(bw, bh) / w) * 100.0, 1)

            last_x, last_y, last_r = cx, cy, radius
            tracks.append({
                "t": timestamp,
                "x": cx,
                "y": cy,
                "r": radius,
                "detected": True
            })
        else:
            tracks.append({
                "t": timestamp,
                "x": last_x,
                "y": last_y,
                "r": last_r,
                "detected": False
            })

        frame_idx += frame_step

    cap.release()

    result = {
        "ok": True,
        "videoId": video_id,
        "tracks": tracks,
        "totalPoints": len(tracks)
    }

    try:
        with open(cache_file, "w") as f:
            json.dump(result, f)
    except Exception as e:
        sys.stderr.write(f"Save cache error: {e}\n")

    return result

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "No videoId provided"}))
        sys.exit(1)

    vid = sys.argv[1]
    res = analyze_video_faces(vid)
    print(json.dumps(res))
