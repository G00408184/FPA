from flask import Flask, request, render_template, redirect, url_for, jsonify
import cv2
import pika
import pickle
import os
import threading
import subprocess

producer = Flask(__name__)
UPLOAD_FOLDER = "uploads"  # Directory to store uploaded files
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
producer.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# RabbitMQ connection parameters
connection = pika.BlockingConnection(pika.ConnectionParameters("localhost"))
channel = connection.channel()

# Declare the queue, ensuring it is durable so it persists across restarts
channel.queue_declare(queue="frame_queue", durable=True)

processing_status = {"progress": 0, "total_frames": 0, "completed": False}

@producer.route("/")
def upload_file():
    return render_template("upload.html")  # HTML file to render the upload form

@producer.route("/upload", methods=["POST"])
def handle_upload():
    if "video" not in request.files:
        return "No file part", 400

    file = request.files["video"]
    if file.filename == "":
        return "No selected file", 400

    if file:
        file_path = os.path.join(producer.config["UPLOAD_FOLDER"], file.filename)
        file.save(file_path)

        # Start the producer process in a background thread
        thread = threading.Thread(target=process_video, args=(file_path,))
        thread.start()

        return redirect(url_for("progress"))

def process_video(video_path):
    global processing_status
    cap = cv2.VideoCapture(video_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    processing_status["total_frames"] = total_frames
    frame_counter = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        # Serialize the frame to send to the queue
        data = pickle.dumps((frame_counter, frame))
        # Publish the message to the queue
        channel.basic_publish(
            exchange="",
            routing_key="frame_queue",
            body=data,
            properties=pika.BasicProperties(delivery_mode=2),
        )
        frame_counter += 1
        processing_status["progress"] = frame_counter

    # Cleanup
    cap.release()
    processing_status["completed"] = True
    print("All frames have been added to the queue.")

    # Trigger the consumer
    run_consumer()

def run_consumer():
    # Run the consumer.py script as a subprocess
    subprocess.Popen(["python", "consumer.py"])

@producer.route("/progress")
def progress():
    return render_template("progress.html")

@producer.route("/status")
def status():
    return jsonify(processing_status)

if __name__ == "__main__":
    producer.run(debug=True)
