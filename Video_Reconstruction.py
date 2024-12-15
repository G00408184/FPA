import cv2
import os
from flask import Flask, render_template, jsonify, redirect, url_for

app = Flask(__name__)

# Path to processed frames and output video
PROCESSED_FRAMES_FOLDER = "processed_frames"
OUTPUT_VIDEO_PATH = "output_video.mp4"

@app.route("/")
def home():
    return render_template("home.html")  # Add a button in home.html for generating the video

@app.route("/generate_video", methods=["POST"])
def generate_video():
    # Get list of all processed frames
    frames = sorted(
        [f for f in os.listdir(PROCESSED_FRAMES_FOLDER) if f.endswith(".jpg")],
        key=lambda x: int(x.split("_")[2].split(".")[0]),  # Extract frame number
    )

    if not frames:
        return jsonify({"status": "error", "message": "No frames found for video reconstruction."})

    # Read the first frame to get video properties
    first_frame_path = os.path.join(PROCESSED_FRAMES_FOLDER, frames[0])
    first_frame = cv2.imread(first_frame_path)
    height, width, _ = first_frame.shape

    # Define video writer
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")  # MPEG-4 codec
    video_writer = cv2.VideoWriter(OUTPUT_VIDEO_PATH, fourcc, 25, (width, height))

    # Add frames to the video
    for frame_name in frames:
        frame_path = os.path.join(PROCESSED_FRAMES_FOLDER, frame_name)
        frame = cv2.imread(frame_path)
        video_writer.write(frame)

    # Release the video writer
    video_writer.release()

    return jsonify({"status": "success", "message": "Video generated successfully!", "path": OUTPUT_VIDEO_PATH})

@app.route("/get_video")
def get_video():
    # Serve the generated video file for download
    return redirect(url_for("static", filename=OUTPUT_VIDEO_PATH))

if __name__ == "__main__":
    app.run(debug=True)
