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
import time
import argparse

producer = Flask(__name__, static_folder="../../frontend/dist")
CORS(producer)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
producer.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

processing_status = {"progress": 0, "total_frames": 0, "completed": False}
rabbitmq_connection = None
channel = None

# Define queue arguments as a global constant at the top of the file
QUEUE_ARGUMENTS = {
    "x-max-length": 1000,
    "x-overflow": "reject-publish",
    "x-queue-mode": "lazy",
    "x-expires": 300000,  # 5 minutes in milliseconds
}

# Add command line argument parsing
parser = argparse.ArgumentParser(description="Process video frames")
parser.add_argument("--video", type=str, help="Path to the video file to process")
args = parser.parse_args()


def setup_rabbitmq():
    global rabbitmq_connection, channel
    try:
        if rabbitmq_connection is None or rabbitmq_connection.is_closed:
            print("Creating new RabbitMQ connection...")
            rabbitmq_connection = pika.BlockingConnection(
                pika.ConnectionParameters(
                    host="localhost",
                    heartbeat=600,
                    blocked_connection_timeout=300,
                    connection_attempts=3,
                    retry_delay=5,
                )
            )

        if channel is None or channel.is_closed:
            print("Creating new channel...")
            channel = rabbitmq_connection.channel()

            # First, try to delete the queue if it exists
            try:
                channel.queue_delete(queue="frame_queue")
                print("Deleted existing queue")
            except Exception as e:
                print(
                    f"Queue delete error (this is normal if queue doesn't exist): {str(e)}"
                )

            # Now declare the queue with our settings
            print("Declaring queue with new settings...")
            channel.queue_declare(
                queue="frame_queue",
                durable=True,
                arguments={
                    "x-max-length": 1000,
                    "x-overflow": "reject-publish",
                    "x-queue-mode": "lazy",
                },
            )

            print("RabbitMQ connection and channel setup complete")

    except Exception as e:
        print(f"RabbitMQ connection error: {str(e)}")
        if channel:
            try:
                channel.close()
            except Exception:
                pass
        if rabbitmq_connection:
            try:
                rabbitmq_connection.close()
            except Exception:
                pass
        rabbitmq_connection = None
        channel = None
        raise e


def process_video(video_path):
    try:
        setup_rabbitmq()
        cap = cv2.VideoCapture(video_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        processing_status.update(
            {"total_frames": total_frames, "progress": 0, "completed": False}
        )

        print(f"Starting to process video with {total_frames} frames")
        frame_count = 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            try:
                # Compress frame with higher quality
                encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 95]
                _, buffer = cv2.imencode(".jpg", frame, encode_param)
                compressed_frame = buffer.tobytes()

                # Ensure connection is alive
                if channel.is_closed or rabbitmq_connection.is_closed:
                    print("Connection lost, attempting to reconnect...")
                    setup_rabbitmq()

                # Publish frame with mandatory flag and confirmation
                channel.confirm_delivery()
                channel.basic_publish(
                    exchange="",
                    routing_key="frame_queue",
                    body=pickle.dumps((frame_count, compressed_frame)),
                    properties=pika.BasicProperties(
                        delivery_mode=2,  # make message persistent
                        content_type="application/pickle",
                    ),
                    mandatory=True,
                )

                frame_count += 1
                processing_status["progress"] = frame_count

                if frame_count % 10 == 0:
                    print(f"Published frame {frame_count}/{total_frames}")

                # Add small delay to prevent overwhelming the queue
                if frame_count % 5 == 0:
                    time.sleep(0.05)  # Reduced delay to speed up processing

            except pika.exceptions.ChannelClosedByBroker:
                print("Queue full or unreachable! Attempting to reconnect...")
                setup_rabbitmq()
                continue
            except Exception as e:
                print(f"Error publishing frame {frame_count}: {str(e)}")
                setup_rabbitmq()
                continue

        cap.release()
        processing_status["completed"] = True
        print("Video processing completed")

    except Exception as e:
        print(f"Video processing error: {str(e)}")
        traceback.print_exc()
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
        setup_rabbitmq()
        queue_info = channel.queue_declare(
            queue="frame_queue", durable=True, arguments=QUEUE_ARGUMENTS, passive=False
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
        print(f"Status error: {str(e)}")
        return jsonify(
            {"progress": 0, "total_frames": 0, "completed": False, "queue_status": 0}
        )


@producer.route("/start-consumer", methods=["POST"])
def start_consumer():
    try:
        consumer_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "consumer.py"
        )
        print(f"\n=== Starting consumer ===")

        # Start multiple consumers for parallel processing
        for _ in range(3):  # Start 3 consumer processes
            subprocess.Popen(
                [sys.executable, consumer_path]
            )  # Use sys.executable for Python path

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
                queue="frame_queue",
                durable=True,
                passive=True,
                arguments={"x-max-length": 1000, "x-overflow": "reject-publish"},
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
def generate_video_endpoint():
    try:
        from generate_video import generate_video

        processed_frames_folder = "processed_frames"
        output_video_path = "output_video.mp4"
        temp_video_path = "temp_output.mp4"

        print("Starting video generation process...")
        success = generate_video(
            frames_folder=processed_frames_folder,
            output_path=output_video_path,
            temp_path=temp_video_path,
            fps=None,  # Let it automatically detect the FPS from original video
        )

        if not success:
            return jsonify({"error": "Failed to generate video"}), 500

        # Verify the video was created successfully
        if (
            not os.path.exists(output_video_path)
            or os.path.getsize(output_video_path) == 0
        ):
            return jsonify({"error": "Video file is missing or empty"}), 500

        return (
            jsonify(
                {"message": "Video generated successfully", "path": output_video_path}
            ),
            200,
        )

    except Exception as e:
        print(f"Error generating video: {str(e)}")
        traceback.print_exc()
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
        setup_rabbitmq()
        if channel:
            channel.queue_purge(queue="frame_queue")
        return jsonify({"message": "Queue purged successfully"}), 200
    except Exception as e:
        print(f"Purge error: {str(e)}")
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
    print("Starting producer on port 5001")
    try:
        # If video path is provided, process it immediately
        if args.video:
            print(f"Processing video: {args.video}")
            setup_rabbitmq()
            process_video(args.video)

        producer.run(host="0.0.0.0", port=5001, debug=False)
    finally:
        if channel:
            try:
                channel.close()
            except Exception:
                pass
        if rabbitmq_connection and rabbitmq_connection.is_open:
            try:
                rabbitmq_connection.close()
            except Exception:
                pass
