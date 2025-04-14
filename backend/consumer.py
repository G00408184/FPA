import cv2
import pika
import pickle
import os
import numpy as np
from roboflow import Roboflow
import json
from time import sleep
from sklearn.cluster import KMeans
import traceback
import time

# Set up the Roboflow client
rf = Roboflow(api_key="VpUIVQYxyMgXli0e0uC1")
project = rf.workspace("roboflow-jvuqo").project("football-players-detection-3zvbc")
model = project.version(12).model

# Ensure directories exist
PROCESSED_FRAMES_DIR = "processed_frames"
os.makedirs(PROCESSED_FRAMES_DIR, exist_ok=True)


# Team assignments
class TeamAssigner:
    def __init__(self):
        self.team_colors = {}
        self.player_team_dict = {}
        self.teams_initialized = False
        # Reference colors for teams (RGB format)
        self.reference_colors = {
            1: np.array([255, 255, 255]),  # White/Light team
            2: np.array([0, 0, 0]),  # Dark team
        }
        # Color distance threshold for team reassignment
        self.color_distance_threshold = 150.0

    def color_distance(self, color1, color2):
        """Calculate Euclidean distance between two colors"""
        return np.sqrt(np.sum((color1 - color2) ** 2))

    def get_player_color(self, frame, bbox):
        """Extract player jersey color using K-means clustering"""
        x, y, w, h = bbox

        # Extract the player region (top half for jersey color)
        player_image = frame[int(y - h / 2) : int(y), int(x - w / 2) : int(x + w / 2)]

        # If region is too small or invalid, return default color
        if (
            player_image.size == 0
            or player_image.shape[0] < 2
            or player_image.shape[1] < 2
        ):
            return np.array([0, 0, 0])

        # Reshape the image for clustering
        image_2d = player_image.reshape(-1, 3)

        # K-means clustering with 2 clusters (player jersey and background)
        kmeans = KMeans(
            n_clusters=2, random_state=42
        )  # Fixed random state for consistency
        kmeans.fit(image_2d)

        # Get cluster labels
        labels = kmeans.labels_

        # Reshape labels to original image shape
        clustered_image = labels.reshape(player_image.shape[0], player_image.shape[1])

        # Find non-player cluster (background) by checking corners
        corner_clusters = [
            clustered_image[0, 0],
            clustered_image[0, -1],
            clustered_image[-1, 0],
            clustered_image[-1, -1],
        ]
        non_player_cluster = max(set(corner_clusters), key=corner_clusters.count)

        # Player cluster is the opposite of non-player cluster
        player_cluster = 1 - non_player_cluster

        # Return the color center of the player cluster
        return kmeans.cluster_centers_[player_cluster]

    def assign_teams(self, frame, player_detections):
        """Initialize team colors by clustering player colors"""
        if self.teams_initialized or len(player_detections) < 4:
            return

        # Extract colors from all detected players
        player_colors = []
        player_ids = []

        for player_id, detection in player_detections.items():
            x, y, w, h = detection["bbox"]

            # Skip referees detected by model
            if detection.get("class") == "referee":
                self.player_team_dict[player_id] = "referee"
                continue

            player_color = self.get_player_color(frame, (x, y, w, h))
            player_colors.append(player_color)
            player_ids.append(player_id)

        # If we don't have enough players after removing referees, return
        if len(player_colors) < 4:
            return

        # Cluster player colors into two teams
        team_kmeans = KMeans(
            n_clusters=2, random_state=42
        )  # Fixed random state for consistency
        team_kmeans.fit(np.array(player_colors))

        # Get cluster centers
        centers = team_kmeans.cluster_centers_

        # Assign teams based on similarity to reference colors
        dist_1_0 = self.color_distance(centers[0], self.reference_colors[1])
        dist_1_1 = self.color_distance(centers[1], self.reference_colors[1])

        if dist_1_0 < dist_1_1:
            self.team_colors[1] = centers[0]  # Lighter team
            self.team_colors[2] = centers[1]  # Darker team
        else:
            self.team_colors[1] = centers[1]  # Lighter team
            self.team_colors[2] = centers[0]  # Darker team

        # Assign players to teams based on their colors
        team_labels = team_kmeans.labels_
        for i, player_id in enumerate(player_ids):
            team_id = 1 if team_labels[i] == (0 if dist_1_0 < dist_1_1 else 1) else 2
            self.player_team_dict[player_id] = team_id

        print(f"Team 1 (Light) color: {self.team_colors[1]}")
        print(f"Team 2 (Dark) color: {self.team_colors[2]}")
        self.teams_initialized = True

    def get_player_team(self, frame, bbox, player_id):
        """Determine which team a player belongs to"""
        if player_id in self.player_team_dict:
            # Get the current color and compare with stored team colors
            current_color = self.get_player_color(frame, bbox)
            team_id = self.player_team_dict[player_id]

            if team_id in [1, 2]:  # Only check if it's a team player (not referee)
                stored_color = self.team_colors[team_id]
                color_diff = self.color_distance(current_color, stored_color)

                # If color has changed significantly, reassign team
                if color_diff > self.color_distance_threshold:
                    # Calculate distances to both team colors
                    dist_team1 = self.color_distance(current_color, self.team_colors[1])
                    dist_team2 = self.color_distance(current_color, self.team_colors[2])

                    # Assign to closest team
                    new_team_id = 1 if dist_team1 < dist_team2 else 2
                    if new_team_id != team_id:
                        print(
                            f"Reassigning player {player_id} from team {team_id} to team {new_team_id}"
                        )
                        self.player_team_dict[player_id] = new_team_id
                        return new_team_id

            return team_id

        # For new players, calculate distances to team colors
        player_color = self.get_player_color(frame, bbox)
        dist_team1 = self.color_distance(player_color, self.team_colors[1])
        dist_team2 = self.color_distance(player_color, self.team_colors[2])

        # Assign to closest team
        team_id = 1 if dist_team1 < dist_team2 else 2
        self.player_team_dict[player_id] = team_id

        return team_id


# Initialize team assigner
team_assigner = TeamAssigner()


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
        frame_count, compressed_frame = pickle.loads(body)

        # Decompress the frame
        frame_array = np.frombuffer(compressed_frame, dtype=np.uint8)
        frame = cv2.imdecode(frame_array, cv2.IMREAD_COLOR)

        if not isinstance(frame, np.ndarray):
            raise ValueError("Invalid frame data received")

        # Create a frame to display
        display_frame = frame.copy()

        # Save frame temporarily for Roboflow
        temp_path = os.path.join(PROCESSED_FRAMES_DIR, f"temp_{frame_count}.jpg")
        cv2.imwrite(temp_path, frame)

        # Run inference with optimized parameters
        predictions = model.predict(temp_path, confidence=40, overlap=30).json()

        # Count of detections per team
        team_counts = {1: 0, 2: 0, "referee": 0, "unassigned": 0}

        # Initialize teams if not done yet
        if not team_assigner.teams_initialized and len(predictions["predictions"]) >= 4:
            team_assigner.assign_teams(
                frame,
                {
                    f"player_{frame_count}_{i}": {
                        "bbox": (pred["x"], pred["y"], pred["width"], pred["height"]),
                        "class": pred.get("class", "player"),
                    }
                    for i, pred in enumerate(predictions["predictions"])
                },
            )

        # Draw predictions on frame
        for i, prediction in enumerate(predictions["predictions"]):
            x = prediction["x"]
            y = prediction["y"]
            w = prediction["width"]
            h = prediction["height"]
            conf = prediction["confidence"]
            class_name = prediction.get("class", "player")

            # Create a bbox tuple for convenience
            bbox = (x, y, w, h)

            # For balls, use default detection
            if class_name == "football" or class_name == "ball":
                cv2.circle(display_frame, (int(x), int(y)), int(w / 2), (0, 0, 255), 2)
                label = f"ball {conf:.2f}"
                cv2.putText(
                    display_frame,
                    label,
                    (int(x - w / 2), int(y - h / 2) - 10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    (0, 0, 255),
                    2,
                )
                continue

            # For players, determine team
            player_id = f"player_{frame_count}_{i}"

            # Check if this is a referee from the model
            if class_name == "referee":
                # Use yellow for referees detected by model
                bbox_color = (0, 255, 255)  # Yellow for referees
                label = f"referee {conf:.2f}"
                team_counts["referee"] += 1
            else:
                # Get team assignment
                team_id = team_assigner.get_player_team(frame, (x, y, w, h), player_id)
                if team_id in team_assigner.team_colors:
                    team_color = team_assigner.team_colors[team_id]
                    # Convert to BGR for OpenCV
                    bbox_color = (
                        int(team_color[2]),
                        int(team_color[1]),
                        int(team_color[0]),
                    )
                    label = f"Team {team_id} {conf:.2f}"
                    team_counts[team_id] += 1
                else:
                    # Fallback if team colors not initialized yet
                    bbox_color = (0, 255, 0)  # Default to green
                    label = f"Team {team_id} {conf:.2f}"
                    team_counts[team_id] += 1

            # Draw bounding box
            cv2.rectangle(
                display_frame,
                (int(x - w / 2), int(y - h / 2)),
                (int(x + w / 2), int(y + h / 2)),
                bbox_color,
                2,
            )

            # Add label
            cv2.putText(
                display_frame,
                label,
                (int(x - w / 2), int(y - h / 2) - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                bbox_color,
                2,
            )

        # Add team statistics to the frame
        if team_assigner.teams_initialized:
            stats_text = f"Team 1: {team_counts[1]} | Team 2: {team_counts[2]} | Refs: {team_counts['referee']}"
            cv2.putText(
                display_frame,
                stats_text,
                (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (255, 255, 255),
                2,
            )

        # Save processed frame with optimized compression
        output_path = os.path.join(PROCESSED_FRAMES_DIR, f"frame_{frame_count}.jpg")
        cv2.imwrite(output_path, display_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])

        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)

        # Update status file with frame count and team stats
        try:
            with open("consumer_status.json", "r") as f:
                status = json.load(f)
        except:
            status = {
                "frames_processed": 0,
                "total_frames": 0,
                "completed": False,
                "team_stats": {"team1_possession": 0, "team2_possession": 0},
            }

        status["frames_processed"] = frame_count + 1
        status["last_frame"] = frame_count

        with open("consumer_status.json", "w") as f:
            json.dump(status, f)

        print(f"Processed frame {frame_count}")

    except Exception as e:
        print(f"Error processing frame {frame_count}: {str(e)}")
        traceback.print_exc()
    finally:
        # Always acknowledge the message to remove it from the queue
        ch.basic_ack(delivery_tag=method.delivery_tag)


def start_consuming():
    while True:
        try:
            print("Attempting to connect to RabbitMQ...")
            # Create a connection to RabbitMQ with retry parameters
            connection = pika.BlockingConnection(
                pika.ConnectionParameters(
                    host="localhost",
                    heartbeat=600,
                    blocked_connection_timeout=300,
                    connection_attempts=3,
                    retry_delay=5,
                )
            )
            channel = connection.channel()

            print("Connected to RabbitMQ successfully")

            # Declare the queue with proper settings - use passive=True to only check if it exists
            try:
                channel.queue_declare(
                    queue="frame_queue",
                    passive=True,  # Only check if exists, don't try to create
                )
                print("Connected to existing queue")
            except Exception as e:
                print(
                    f"Queue doesn't exist yet, waiting for producer to create it: {str(e)}"
                )
                time.sleep(2)
                continue

            # Set QoS - process one message at a time
            channel.basic_qos(prefetch_count=1)

            print("Consumer started. Waiting for frames...")

            # Set up consumer with manual acknowledgment
            channel.basic_consume(
                queue="frame_queue",
                on_message_callback=process_frame,
                auto_ack=False,  # Important: manual acknowledgment
            )

            # Start consuming
            channel.start_consuming()

        except pika.exceptions.ConnectionClosedByBroker:
            print("Connection was closed by broker, retrying in 5 seconds...")
            time.sleep(5)
            continue
        except pika.exceptions.AMQPConnectionError:
            print("Lost connection to RabbitMQ, retrying in 5 seconds...")
            time.sleep(5)
            continue
        except KeyboardInterrupt:
            print("Stopping consumer...")
            try:
                if channel:
                    channel.close()
                if connection:
                    connection.close()
            except:
                pass
            break
        except Exception as e:
            print(f"Consumer error: {str(e)}")
            traceback.print_exc()
            print("Retrying in 5 seconds...")
            time.sleep(5)
            continue


if __name__ == "__main__":
    # Ensure the processed frames directory exists
    if not os.path.exists(PROCESSED_FRAMES_DIR):
        os.makedirs(PROCESSED_FRAMES_DIR)

    # Initialize status file
    status = {
        "frames_processed": 0,
        "total_frames": 0,
        "completed": False,
        "team_stats": {"team1_possession": 0, "team2_possession": 0},
    }
    with open("consumer_status.json", "w") as f:
        json.dump(status, f)

    print("Starting consumer process...")
    start_consuming()
