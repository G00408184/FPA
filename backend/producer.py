from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
import cv2
import pika
import pickle
import os
import threading
import subprocess
import json

producer = Flask(__name__, static_folder="../../frontend/dist")
CORS(producer)

UPLOAD_FOLDER = "uploads"
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

producer.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

processing_status = {"progress": 0, "total_frames": 0, "completed": False}
rabbitmq_connection = None
channel = None
consumer_process = None
consumer_status = {"messages": [], "completed": False}


def setup_rabbitmq():
    global rabbitmq_connection, channel
    if not rabbitmq_connection:
        rabbitmq_connection = pika.BlockingConnection(
            pika.ConnectionParameters("localhost")
        )
        channel = rabbitmq_connection.channel()
        channel.queue_declare(queue="frame_queue", durable=True)


def process_video(video_path):
    try:
        setup_rabbitmq()
        cap = cv2.VideoCapture(video_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        processing_status["total_frames"] = total_frames
        processing_status["progress"] = 0

        frame_count = 0
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            # Send individual frame
            channel.basic_publish(
                exchange="",
                routing_key="frame_queue",
                body=pickle.dumps((frame_count, frame)),
                properties=pika.BasicProperties(
                    delivery_mode=2, content_type="application/pickle"
                ),
            )
            frame_count += 1
            processing_status["progress"] = frame_count

        cap.release()
        processing_status["completed"] = True

    except Exception as e:
        print(f"Error processing video: {str(e)}")
        processing_status["completed"] = True


@producer.route("/start-producer", methods=["POST"])
def start_producer():
    try:
        setup_rabbitmq()
        return jsonify({"message": "Producer started successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@producer.route("/upload", methods=["POST"])
def upload_file():
    try:
        # Purge the queue before starting
        if channel:
            channel.queue_purge(queue="frame_queue")

        # Clear processed frames directory
        processed_frames_dir = "processed_frames"
        if os.path.exists(processed_frames_dir):
            for file in os.listdir(processed_frames_dir):
                os.remove(os.path.join(processed_frames_dir, file))

        # Reset status file
        if os.path.exists("consumer_status.json"):
            os.remove("consumer_status.json")

        if "video" not in request.files:
            return jsonify({"error": "No video file provided"}), 400

        file = request.files["video"]
        if file.filename == "":
            return jsonify({"error": "No selected file"}), 400

        if file:
            filename = os.path.join(UPLOAD_FOLDER, file.filename)
            file.save(filename)

            # Reset processing status
            global processing_status
            processing_status = {"progress": 0, "total_frames": 0, "completed": False}

            # Start processing video in a background thread
            thread = threading.Thread(target=process_video, args=(filename,))
            thread.daemon = True
            thread.start()

            return (
                jsonify(
                    {"message": "File uploaded successfully", "filename": file.filename}
                ),
                200,
            )

    except Exception as e:
        print(f"Upload error: {str(e)}")
        return jsonify({"error": str(e)}), 500


@producer.route("/status")
def get_status():
    try:
        # Get queue status
        queue_info = channel.queue_declare(
            queue="frame_queue", durable=True, passive=True
        )
        messages_in_queue = queue_info.method.message_count

        return jsonify(
            {
                "progress": processing_status["progress"],
                "total_frames": processing_status["total_frames"],
                "completed": processing_status["completed"],
                "queue_status": messages_in_queue,
            }
        )
    except Exception as e:
        print(f"Error getting status: {str(e)}")
        return jsonify(
            {"progress": 0, "total_frames": 0, "completed": False, "queue_status": 0}
        )


@producer.route("/start-consumer", methods=["POST"])
def start_consumer():
    global consumer_process
    try:
        consumer_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "consumer.py"
        )
        print(f"\n=== Starting consumer ===")

        # Start multiple consumers for parallel processing
        for _ in range(3):  # Start 3 consumer processes
            subprocess.Popen(["python", consumer_path], shell=True)

        print("Consumer processes started successfully")
        return jsonify({"message": "Consumers started successfully"}), 200

    except Exception as e:
        print(f"Error starting consumer: {str(e)}")
        return jsonify({"error": str(e)}), 500


@producer.route("/consumer-status")
def get_consumer_status():
    try:
        # Initialize default response
        status_data = {
            "frames_processed": 0,
            "total_frames": processing_status.get("total_frames", 0),
            "completed": False,
        }

        # Read status from file if it exists
        if os.path.exists("consumer_status.json"):
            with open("consumer_status.json", "r") as f:
                file_status = json.load(f)
                status_data.update(file_status)

        # Get queue status
        if channel:
            queue_info = channel.queue_declare(
                queue="frame_queue", durable=True, passive=True
            )
            messages_in_queue = queue_info.method.message_count

            # Update completion status
            status_data["completed"] = (
                messages_in_queue == 0
                and status_data["frames_processed"] >= status_data["total_frames"]
                and status_data["total_frames"] > 0
            )

        return jsonify(status_data)

    except Exception as e:
        print(f"Error checking consumer status: {str(e)}")
        return jsonify(
            {
                "frames_processed": 0,
                "total_frames": processing_status.get("total_frames", 0),
                "completed": False,
            }
        )


@producer.route("/generate-video", methods=["POST"])
def generate_video():
    try:
        # Your existing video generation code
        processed_frames_folder = "processed_frames"
        output_video_path = "output_video.mp4"

        frames = sorted(
            [f for f in os.listdir(processed_frames_folder) if f.endswith(".jpg")],
            key=lambda x: int(x.split("_")[1].split(".")[0]),
        )

        if not frames:
            return jsonify({"error": "No frames found"}), 400

        # Read first frame to get dimensions
        first_frame = cv2.imread(os.path.join(processed_frames_folder, frames[0]))
        height, width = first_frame.shape[:2]

        # Create video writer
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        out = cv2.VideoWriter(output_video_path, fourcc, 30.0, (width, height))

        # Add frames to video
        for frame_name in frames:
            frame_path = os.path.join(processed_frames_folder, frame_name)
            frame = cv2.imread(frame_path)
            out.write(frame)

        out.release()
        return jsonify({"message": "Video generated successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@producer.route("/download-video")
def download_video():
    try:
        return send_file(
            "output_video.mp4", as_attachment=True, download_name="processed_video.mp4"
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@producer.route("/cancel-processing", methods=["POST"])
def cancel_processing():
    try:
        # Purge the queue
        if channel:
            channel.queue_purge(queue="frame_queue")

        # Clear processed frames directory
        processed_frames_dir = "processed_frames"
        if os.path.exists(processed_frames_dir):
            for file in os.listdir(processed_frames_dir):
                os.remove(os.path.join(processed_frames_dir, file))

        # Reset status file
        if os.path.exists("consumer_status.json"):
            os.remove("consumer_status.json")

        return jsonify({"message": "Processing cancelled successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@producer.route("/purge-queue", methods=["POST"])
def purge_queue():
    try:
        if channel:
            channel.queue_purge(queue="frame_queue")
        return jsonify({"message": "Queue purged successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Serve React app
@producer.route("/", defaults={"path": ""})
@producer.route("/<path:path>")
def serve(path):
    if path != "" and os.path.exists(producer.static_folder + "/" + path):
        return send_from_directory(producer.static_folder, path)
    else:
        return send_from_directory(producer.static_folder, "index.html")


if __name__ == "__main__":
    print("Starting Flask server on port 5000...")
    producer.run(host="0.0.0.0", port=5000, debug=True)
