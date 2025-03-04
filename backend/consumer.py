import cv2
import pika
import pickle
import os
import numpy as np
from roboflow import Roboflow
from inference_sdk import InferenceHTTPClient
import json
from time import sleep

QUEUE_ARGUMENTS = {
    'x-max-length': 1000,
    'x-overflow': 'reject-publish',
    'x-queue-mode': 'lazy',
    'x-expires': 300000
}

# Initialize field detection client
FIELD_CLIENT = InferenceHTTPClient(
    api_url="https://detect.roboflow.com",
    api_key="VpUIVQYxyMgXli0e0uC1"
)

# Path to local model
MODEL_PATH = "FPA/football-players-detection-12"

PROCESSED_FRAMES_DIR = "processed_frames"
os.makedirs(PROCESSED_FRAMES_DIR, exist_ok=True)

def is_inside_pitch(point, pitch_coords):
    """Check if a point is inside the pitch area"""
    x, y = point
    pitch_x = pitch_coords['x']
    pitch_y = pitch_coords['y']
    pitch_width = pitch_coords['width']
    pitch_height = pitch_coords['height']
    
    return (pitch_x - pitch_width/2 <= x <= pitch_x + pitch_width/2 and 
            pitch_y - pitch_height/2 <= y <= pitch_y + pitch_height/2)

def process_frame(frame_count, frame):
    try:
        # Save frame temporarily for pitch detection API
        temp_path = os.path.join(PROCESSED_FRAMES_DIR, f"temp_{frame_count}.jpg")
        cv2.imwrite(temp_path, frame)

        # First detect the pitch
        field_result = FIELD_CLIENT.infer(temp_path, model_id="football-field-detection-f07vi/15")
        
        # Get pitch coordinates if detected
        pitch_coords = None
        if field_result.get("predictions"):
            for pred in field_result["predictions"]:
                if pred["class"] == "pitch":
                    pitch_coords = pred
                    # Draw pitch boundary
                    x = pred["x"]
                    y = pred["y"]
                    w = pred["width"]
                    h = pred["height"]
                    cv2.rectangle(
                        frame,
                        (int(x - w/2), int(y - h/2)),
                        (int(x + w/2), int(y + h/2)),
                        (255, 255, 255),  # White color for pitch boundary
                        2
                    )
                    break
        
        if not pitch_coords:
            print(f"No pitch detected in frame {frame_count}")
            return

        # Run player detection using local model
        results = model.predict(frame, confidence=40, overlap=30)

        # Process predictions
        if results:
            for result in results:
                x = result["x"]
                y = result["y"]
                
                # Only process if the detection is inside the pitch
                if is_inside_pitch((x, y), pitch_coords):
                    # Calculate bounding box coordinates
                    x1 = int(x - result["width"] / 2)
                    y1 = int(y - result["height"] / 2)
                    x2 = int(x + result["width"] / 2)
                    y2 = int(y + result["height"] / 2)
                    
                    # Set color based on class
                    if result["class"] == "player":
                        color = (0, 255, 0)  # Green for players
                    elif result["class"] == "goalkeeper":
                        color = (255, 0, 0)  # Blue for goalkeepers
                    elif result["class"] == "referee":
                        color = (0, 0, 255)  # Red for referees
                    else:
                        continue

                    # Draw bounding box
                    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

                    # Add label with confidence
                    conf = result["confidence"]
                    label = f"{result['class']}: {conf:.2f}"
                    cv2.putText(
                        frame,
                        label,
                        (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.5,
                        color,
                        2
                    )

        # Save processed frame
        output_path = os.path.join(PROCESSED_FRAMES_DIR, f"frame_{frame_count}.jpg")
        cv2.imwrite(output_path, frame)

        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)

        # Update status
        update_status(frame_count)

    except Exception as e:
        print(f"Error processing frame {frame_count}: {str(e)}")
        raise e

def update_status(frame_count):
    try:
        status_file = "consumer_status.json"
        status_data = {
            "frames_processed": frame_count + 1,
            "last_processed": frame_count
        }
        
        with open(status_file, "w") as f:
            json.dump(status_data, f)
    except Exception as e:
        print(f"Error updating status: {str(e)}")

def callback(ch, method, properties, body):
    try:
        frame_count, compressed_frame = pickle.loads(body)
        print(f"Processing frame {frame_count}")
        
        # Decompress frame
        frame_array = np.frombuffer(compressed_frame, dtype=np.uint8)
        frame = cv2.imdecode(frame_array, cv2.IMREAD_COLOR)
        
        process_frame(frame_count, frame)
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as e:
        print(f"Error processing frame: {str(e)}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

def start_consuming():
    while True:
        connection = None
        channel = None
        try:
            connection = pika.BlockingConnection(
                pika.ConnectionParameters(
                    host='localhost',
                    port=5672,
                    heartbeat=600,
                    blocked_connection_timeout=300,
                    connection_attempts=3,
                    retry_delay=5
                )
            )
            channel = connection.channel()
            
            channel.queue_declare(
                queue="frame_queue",
                durable=True,
                arguments=QUEUE_ARGUMENTS
            )
            
            channel.basic_qos(prefetch_count=5)

            print("[*] Connected to RabbitMQ. Waiting for frames...")
            
            channel.basic_consume(
                queue="frame_queue",
                on_message_callback=callback
            )
            
            channel.start_consuming()

        except pika.exceptions.ConnectionClosedByBroker as e:
            print(f"Broker closed connection: {e}, retrying in 5s...")
            sleep(5)
        except pika.exceptions.AMQPChannelError as e:
            print(f"Channel error: {e}, recreating channel...")
            sleep(1)
        except pika.exceptions.AMQPConnectionError:
            print("Network error, reconnecting in 5s...")
            sleep(5)
        except Exception as e:
            print(f"Unexpected error: {str(e)}")
            sleep(5)
        finally:
            try:
                if channel is not None:
                    channel.close()
                if connection is not None:
                    connection.close()
            except Exception as e:
                print(f"Error closing connections: {str(e)}")

if __name__ == "__main__":
    print("Starting consumer...")
    # Initialize Roboflow and get the model
    rf = Roboflow(api_key="VpUIVQYxyMgXli0e0uC1")
    project = rf.workspace("roboflow-jvuqo").project("football-players-detection-3zvbc")
    model = project.version(12).model
    print("Model loaded successfully")
    start_consuming()