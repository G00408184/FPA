import cv2
import pika
import pickle

# RabbitMQ connection parameters
connection = pika.BlockingConnection(pika.ConnectionParameters("localhost"))
channel = connection.channel()
channel.queue_declare(queue="frame_queue")

# Load video
video_path = "C:/Users/G00408184@atu.ie/Downloads/08fd33_4.mp4"
cap = cv2.VideoCapture(video_path)

frame_counter = 0
while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    # Serialize the frame to send to the queue
    data = pickle.dumps((frame_counter, frame))
    channel.basic_publish(exchange="", routing_key="frame_queue", body=data)
    frame_counter += 1

# Cleanup
cap.release()
connection.close()

print("All frames have been added to the queue.")
