import cv2
import pika
import pickle

# RabbitMQ connection parameters
connection = pika.BlockingConnection(pika.ConnectionParameters("localhost"))
channel = connection.channel()

# Declare the queue, ensuring it is durable so it persists across restarts
channel.queue_declare(queue="frame_queue", durable=True)

# Load video
video_path = "C:/Users/kubam/Desktop/Project/08fd33_4.mp4"
cap = cv2.VideoCapture(video_path)

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
    )  # Make message persistent
    frame_counter += 1

# Cleanup
cap.release()
connection.close()

print("All frames have been added to the queue.")
