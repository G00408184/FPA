import cv2
import pika
import pickle
import numpy as np
from roboflow import Roboflow
import os

# Set up the Roboflow client
rf = Roboflow(api_key="VpUIVQYxyMgXli0e0uC1")
project = rf.workspace("roboflow-jvuqo").project("football-players-detection-3zvbc")
version = project.version(12)
dataset = version.download("yolov11")

# RabbitMQ connection parameters
connection = pika.BlockingConnection(pika.ConnectionParameters("localhost"))
channel = connection.channel()

# Declare the queue with durability to match the producer
channel.queue_declare(queue="frame_queue", durable=True)

# Ensure the processed frames directory exists
processed_frames_folder = "processed_frames"
os.makedirs(processed_frames_folder, exist_ok=True)

def callback(ch, method, properties, body):
    # Deserialize the frame
    frame_counter, frame = pickle.loads(body)

    # Use pitch detection API
    pitch_detected = False
    # Assuming pitch detection code here that sets pitch_detected to True if the pitch is found
    pitch_detected = True  # For now, assuming the pitch is always detected

    if not pitch_detected:
        return

    # Run player detection using the downloaded model
    model = version.model  # Load the YOLO model from Roboflow
    results = model.predict(frame)

    if results:
        for result in results:
            if result["class"] == "player":
                x1, y1, x2, y2 = map(
                    int,
                    [
                        result["x"] - result["width"] / 2,
                        result["y"] - result["height"] / 2,
                        result["x"] + result["width"] / 2,
                        result["y"] + result["height"] / 2,
                        ],
                )
                cv2.rectangle(
                    frame, (x1, y1), (x2, y2), (0, 255, 0), 2
                )  # Green for players

    # Save or send the processed frame
    processed_frame_path = os.path.join(processed_frames_folder, f"processed_frame_{frame_counter}.jpg")
    cv2.imwrite(processed_frame_path, frame)

    print(f"Processed frame {frame_counter}")


# Consume messages from the queue
channel.basic_consume(queue="frame_queue", on_message_callback=callback, auto_ack=True)

print("Waiting for frames...")
channel.start_consuming()
