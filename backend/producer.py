from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
import cv2
import pika
import pickle
import os
import threading
import subprocess
import json
import sys
import traceback

producer = Flask(__name__, static_folder="../../frontend/dist")
CORS(producer)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
producer.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

processing_status = {"progress": 0, "total_frames": 0, "completed": False}
rabbitmq_connection = None
channel = None

def setup_rabbitmq():
    global rabbitmq_connection, channel
    try:
        if rabbitmq_connection is None or rabbitmq_connection.is_closed:
            print("Creating new RabbitMQ connection...")
            rabbitmq_connection = pika.BlockingConnection(
                pika.ConnectionParameters(
                    host='localhost',
                    heartbeat=600,
                    connection_attempts=3,
                    retry_delay=5
                )
            )
        
        if channel is None or channel.is_closed:
            print("Creating new channel...")
            channel = rabbitmq_connection.channel()
            # Remove x-max-priority argument to match existing queue
            channel.queue_declare(queue="frame_queue", durable=True)

    except Exception as e:
        print(f"RabbitMQ connection error: {str(e)}")
        rabbitmq_connection = None
        channel = None
        raise e

def process_video(video_path):
    try:
        setup_rabbitmq()
        cap = cv2.VideoCapture(video_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        processing_status.update({"total_frames": total_frames, "progress": 0, "completed": False})

        frame_count = 0
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            channel.basic_publish(
                exchange="",
                routing_key="frame_queue",
                body=pickle.dumps((frame_count, frame)),
                properties=pika.BasicProperties(
                    delivery_mode=2,
                    content_type="application/pickle"
                ),
            )
            frame_count += 1
            processing_status["progress"] = frame_count

        cap.release()
        processing_status["completed"] = True

    except Exception as e:
        print(f"Video processing error: {str(e)}")
        processing_status["completed"] = True

@producer.route("/start-producer", methods=["POST"])
def start_producer():
    try:
        setup_rabbitmq()
        return jsonify({"message": "Producer started"}), 200
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
        setup_rabbitmq()
        queue_info = channel.queue_declare(queue="frame_queue", durable=True, passive=True)
        return jsonify({
            "progress": processing_status["progress"],
            "total_frames": processing_status["total_frames"],
            "completed": processing_status["completed"],
            "queue_status": queue_info.method.message_count
        })
    except Exception as e:
        return jsonify({"progress": 0, "total_frames": 0, "completed": False, "queue_status": 0})

@producer.route("/start-consumer", methods=["POST"])
def start_consumer():
    try:
        consumer_path = os.path.join(os.path.dirname(__file__), "consumer.py")
        print("\n=== Starting 3 consumers ===")

        for _ in range(3):
            subprocess.Popen(
                [sys.executable, consumer_path],
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
            )

        return jsonify({"message": "Consumers started"}), 200
    except Exception as e:
        print(f"Consumer start error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@producer.route("/purge-queue", methods=["POST"])
def purge_queue():
    try:
        setup_rabbitmq()
        if channel:
            channel.queue_purge(queue="frame_queue")
        return jsonify({"message": "Queue purged successfully"}), 200
    except Exception as e:
        print(f"Purge error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@producer.route("/consumer-status")
def get_consumer_status():
    try:
        setup_rabbitmq()
        status_data = {
            "frames_processed": 0,
            "total_frames": processing_status.get("total_frames", 0),
            "completed": False,
        }

        if os.path.exists("consumer_status.json"):
            with open("consumer_status.json", "r") as f:
                status_data.update(json.load(f))

        queue_info = channel.queue_declare(queue="frame_queue", passive=True)
        messages_in_queue = queue_info.method.message_count

        status_data["completed"] = (
            messages_in_queue == 0 and
            status_data["frames_processed"] >= status_data["total_frames"] and
            status_data["total_frames"] > 0
        )

        return jsonify(status_data)
    except Exception as e:
        return jsonify({
            "frames_processed": 0,
            "total_frames": processing_status.get("total_frames", 0),
            "completed": False
        })

# ... Keep the remaining routes (generate-video, download-video, etc.) the same as in your original code ...

if __name__ == "__main__":
    print("Starting producer on port 5000")
    producer.run(host="0.0.0.0", port=5000, debug=True)