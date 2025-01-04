import cv2
import pika
import pickle
from roboflow import Roboflow
import os

# Set up the Roboflow client
rf = Roboflow(api_key="VpUIVQYxyMgXli0e0uC1")
project = rf.workspace("roboflow-jvuqo").project("football-players-detection-3zvbc")
version = project.version(12)

# Ensure the processed frames directory exists
processed_frames_folder = "processed_frames"
os.makedirs(processed_frames_folder, exist_ok=True)

# RabbitMQ connection parameters
connection = pika.BlockingConnection(pika.ConnectionParameters("localhost"))
channel = connection.channel()

# Declare the queue with durability to match the producer
channel.queue_declare(queue="frame_queue", durable=True)

# Function to process each frame
def callback(ch, method, properties, body):
    try:
        # Deserialize the frame
        frame_counter, frame = pickle.loads(body)

        # Placeholder for pitch detection logic
        pitch_detected = True  # Assume pitch is detected for now

        if pitch_detected:
            # Run player detection using the YOLO model
            model = version.model  # Load the YOLO model from Roboflow
            results = model.predict(frame)

            # Debugging: Print all detected classes
            detected_classes = [result["class"] for result in results]
            print(f"Frame {frame_counter}: Detected classes - {detected_classes}")

            if results:
                for result in results:
                    # Handle detection for multiple classes
                    if result["class"] == "player":
                        color = (0, 255, 0)  # Green for players
                    elif result["class"] == "goalkeeper":
                        color = (255, 0, 0)  # Blue for goalkeepers
                    elif result["class"] == "referee":
                        color = (0, 0, 255)  # Red for referees
                    elif result["class"] == "ball":
                        color = (255, 255, 0) # Light blue for ball
                    else:
                        continue

                    # Get bounding box coordinates
                    x1, y1, x2, y2 = map(
                        int,
                        [
                            result["x"] - result["width"] / 2,
                            result["y"] - result["height"] / 2,
                            result["x"] + result["width"] / 2,
                            result["y"] + result["height"] / 2,
                            ],
                    )

                    # Draw a rectangle for the detected object
                    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

            # Save the processed frame
            processed_frame_path = os.path.join(
                processed_frames_folder, f"processed_frame_{frame_counter}.jpg"
            )
            cv2.imwrite(processed_frame_path, frame)

            print(f"Processed frame {frame_counter}")

        # Acknowledge the message manually to ensure RabbitMQ removes it from the queue
        ch.basic_ack(delivery_tag=method.delivery_tag)

    except Exception as e:
        print(f"Error processing frame: {e}")
        # Optionally, you can reject the message and requeue it:
        # ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

# Start consuming frames
channel.basic_consume(queue="frame_queue", on_message_callback=callback, auto_ack=False)

print("Waiting for frames...")
try:
    channel.start_consuming()
except KeyboardInterrupt:
    print("Consumer stopped.")
    channel.stop_consuming()
    connection.close()
