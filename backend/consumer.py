import cv2
import pika
import pickle
import os
import numpy as np
from roboflow import Roboflow
import json
from time import sleep

rf = Roboflow(api_key="VpUIVQYxyMgXli0e0uC1")
project = rf.workspace("roboflow-jvuqo").project("football-players-detection-3zvbc")
model = project.version(12).model

PROCESSED_FRAMES_DIR = "processed_frames"
os.makedirs(PROCESSED_FRAMES_DIR, exist_ok=True)

# ... Keep get_dominant_color and process_frame functions the same ...

def start_consuming():
    while True:
        try:
            connection = pika.BlockingConnection(
                pika.ConnectionParameters(
                    host='localhost',
                    heartbeat=600,
                    blocked_connection_timeout=300
                )
            )
            channel = connection.channel()
            # Match queue declaration with producer (no x-max-priority)
            channel.queue_declare(queue="frame_queue", durable=True)
            channel.basic_qos(prefetch_count=1)

            print("[✓] Connected to RabbitMQ. Waiting for frames...")
            channel.basic_consume(queue="frame_queue", on_message_callback=process_frame)
            channel.start_consuming()

        except pika.exceptions.ConnectionClosedByBroker as e:
            print(f"Broker closed connection: {e}, retrying in 5s...")
            sleep(5)
        except pika.exceptions.AMQPChannelError as e:
            print(f"Channel error: {e}, recreating channel...")
            if connection and connection.is_open:
                channel = connection.channel()
            sleep(1)
        except pika.exceptions.AMQPConnectionError:
            print("Network error, reconnecting in 5s...")
            sleep(5)
        except Exception as e:
            print(f"Unexpected error: {str(e)}")
            sleep(5)

if __name__ == "__main__":
    for f in os.listdir(PROCESSED_FRAMES_DIR):
        if f.startswith("temp_"):
            os.remove(os.path.join(PROCESSED_FRAMES_DIR, f))
    start_consuming()