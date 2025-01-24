import cv2
import pika
import pickle
import os
import numpy as np
from roboflow import Roboflow
import json
from time import sleep

# Set up the Roboflow client
rf = Roboflow(api_key="VpUIVQYxyMgXli0e0uC1")
project = rf.workspace("roboflow-jvuqo").project("football-players-detection-3zvbc")
model = project.version(12).model

# Ensure directories exist
PROCESSED_FRAMES_DIR = "processed_frames"
os.makedirs(PROCESSED_FRAMES_DIR, exist_ok=True)


def get_dominant_color(image, x, y, w, h):
    # Extract the region of interest (ROI)
    roi = image[int(y - h / 2) : int(y + h / 2), int(x - w / 2) : int(x + w / 2)]

    # Reshape the ROI to be a list of pixels
    pixels = roi.reshape(-1, 3)

    # Calculate the average color
    average_color = np.mean(pixels, axis=0)

    # Convert to HSV
    hsv_color = cv2.cvtColor(np.uint8([[average_color]]), cv2.COLOR_BGR2HSV)[0][0]

    # Define color ranges
    if hsv_color[1] < 50:  # Low saturation means white/gray/black
        if hsv_color[2] < 64:
            return "black", (0, 0, 0)
        elif hsv_color[2] > 192:
            return "white", (255, 255, 255)
        else:
            return "gray", (128, 128, 128)
    else:
        # Color ranges in HSV
        if hsv_color[0] < 30 or hsv_color[0] > 150:
            return "red", (0, 0, 255)
        elif 30 <= hsv_color[0] < 90:
            return "green", (0, 255, 0)
        else:
            return "blue", (255, 0, 0)


def process_frame(ch, method, properties, body):
    try:
        # Unpickle the frame data
        frame_count, frame = pickle.loads(body)

        if not isinstance(frame, np.ndarray):
            raise ValueError("Invalid frame data received")

        # Save frame temporarily for Roboflow
        temp_path = os.path.join(PROCESSED_FRAMES_DIR, f"temp_{frame_count}.jpg")
        cv2.imwrite(temp_path, frame)

        # Run inference
        predictions = model.predict(temp_path, confidence=40, overlap=30).json()

        # Draw predictions on frame
        for prediction in predictions["predictions"]:
            x = prediction["x"]
            y = prediction["y"]
            w = prediction["width"]
            h = prediction["height"]

            # Get dominant color
            color_name, bbox_color = get_dominant_color(frame, x, y, w, h)

            # Draw bounding box
            cv2.rectangle(
                frame,
                (int(x - w / 2), int(y - h / 2)),
                (int(x + w / 2), int(y + h / 2)),
                bbox_color,
                2,
            )

            # Add confidence score and color name
            conf = prediction["confidence"]
            label = f"{color_name} {conf:.2f}"
            cv2.putText(
                frame,
                label,
                (int(x - w / 2), int(y - h / 2) - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                bbox_color,
                2,
            )

        # Save processed frame
        output_path = os.path.join(PROCESSED_FRAMES_DIR, f"frame_{frame_count}.jpg")
        cv2.imwrite(output_path, frame)

        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)

        # Acknowledge message
        ch.basic_ack(delivery_tag=method.delivery_tag)

    except Exception as e:
        print(
            f"Error processing frame {frame_count if 'frame_count' in locals() else 'unknown'}: {str(e)}"
        )
        ch.basic_nack(delivery_tag=method.delivery_tag)


def start_consuming():
    while True:
        try:
            # Connect to RabbitMQ
            connection = pika.BlockingConnection(pika.ConnectionParameters("localhost"))
            channel = connection.channel()

            # Declare queue
            channel.queue_declare(queue="frame_queue", durable=True)

            # Set prefetch count to 1 for better load balancing
            channel.basic_qos(prefetch_count=1)

            # Start consuming
            print("Consumer started. Waiting for frames...")

            channel.basic_consume(
                queue="frame_queue", on_message_callback=process_frame
            )

            channel.start_consuming()

        except pika.exceptions.ConnectionClosedByBroker:
            print("Connection was closed by broker, retrying...")
            continue
        except pika.exceptions.AMQPConnectionError:
            print("Lost connection to RabbitMQ, retrying...")
            sleep(5)
            continue
        except Exception as e:
            print(f"Consumer error: {str(e)}")
            sleep(5)
            continue


if __name__ == "__main__":
    # Clean up any temporary files
    for f in os.listdir(PROCESSED_FRAMES_DIR):
        if f.startswith("temp_"):
            os.remove(os.path.join(PROCESSED_FRAMES_DIR, f))

    # Start consuming
    start_consuming()
