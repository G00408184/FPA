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
rf = Roboflow(api_key="5sviEDrSM3IWkum0z8Vy")
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
        # Track goalkeepers specifically
        self.goalkeeper_ids = {}

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

    def is_goalkeeper(self, bbox, frame_size):
        """Check if player is likely a goalkeeper based on position"""
        x, y, w, h = bbox
        frame_width = frame_size[1]  # Width of the frame

        # Goalkeepers are typically at the far left or right of the field
        if x < 0.2 * frame_width or x > 0.8 * frame_width:
            return True
        return False

    def is_dark_goalkeeper(self, color):
        """Check if color is likely a dark/black goalkeeper"""
        # Dark colors have low RGB sum
        return np.sum(color) < 200

    def is_light_goalkeeper(self, color):
        """Check if color is likely a light/white goalkeeper"""
        # Light colors have high RGB sum
        return np.sum(color) > 600

    def assign_teams(self, frame, player_detections):
        """Initialize team colors by clustering player colors"""
        if self.teams_initialized or len(player_detections) < 4:
            return

        # Extract colors from all detected players
        player_colors = []
        player_ids = []
        player_bboxes = []
        frame_size = frame.shape

        for player_id, detection in player_detections.items():
            x, y, w, h = detection["bbox"]
            bbox = (x, y, w, h)

            # Skip referees detected by model
            if detection.get("class") == "referee":
                self.player_team_dict[player_id] = "referee"
                continue

            player_color = self.get_player_color(frame, bbox)
            player_colors.append(player_color)
            player_ids.append(player_id)
            player_bboxes.append(bbox)

            # Check if this player might be a goalkeeper
            if self.is_goalkeeper(bbox, frame_size):
                if self.is_dark_goalkeeper(player_color):
                    # Dark goalkeeper should be team 1
                    self.goalkeeper_ids[player_id] = 1
                    print(
                        f"Detected dark goalkeeper (ID: {player_id}), assigning to Team 1"
                    )
                elif self.is_light_goalkeeper(player_color):
                    # Light goalkeeper should be team 2
                    self.goalkeeper_ids[player_id] = 2
                    print(
                        f"Detected light goalkeeper (ID: {player_id}), assigning to Team 2"
                    )

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

        # Assign players to teams based on their colors and special cases (goalkeepers)
        team_labels = team_kmeans.labels_
        for i, player_id in enumerate(player_ids):
            if player_id in self.goalkeeper_ids:
                # Use pre-assigned team for goalkeepers
                team_id = self.goalkeeper_ids[player_id]
            else:
                team_id = (
                    1 if team_labels[i] == (0 if dist_1_0 < dist_1_1 else 1) else 2
                )

            self.player_team_dict[player_id] = team_id

        print(f"Team 1 (Light) color: {self.team_colors[1]}")
        print(f"Team 2 (Dark) color: {self.team_colors[2]}")
        self.teams_initialized = True

    def get_player_team(self, frame, bbox, player_id):
        """Determine which team a player belongs to"""
        # First check if this is a known goalkeeper
        if player_id in self.goalkeeper_ids:
            return self.goalkeeper_ids[player_id]

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

        # Check if this might be a goalkeeper we missed earlier
        if self.is_goalkeeper(bbox, frame.shape):
            if self.is_dark_goalkeeper(player_color):
                self.goalkeeper_ids[player_id] = 1
                return 1
            elif self.is_light_goalkeeper(player_color):
                self.goalkeeper_ids[player_id] = 2
                return 2

        dist_team1 = self.color_distance(player_color, self.team_colors[1])
        dist_team2 = self.color_distance(player_color, self.team_colors[2])

        # Assign to closest team
        team_id = 1 if dist_team1 < dist_team2 else 2
        self.player_team_dict[player_id] = team_id

        return team_id


# Initialize team assigner
team_assigner = TeamAssigner()


# Ball possession tracker
class BallPossessionTracker:
    def __init__(self):
        # Start with balanced possession (no team favored)
        self.last_possession = None  # Start with no team having possession
        self.possession_count = {1: 0, 2: 0}  # Start with zero counts
        self.possession_durations = {1: 0, 2: 0}  # Start with zero durations
        self.last_frame_time = None
        self.possession_smoothing = 10  # Reduced from 15 to be more responsive
        self.recent_possessions = []  # Start with empty list
        # Store previous percentage values for smooth transitions
        self.prev_percentages = {1: 50.0, 2: 50.0}
        # Smoothing factor for visual transitions (0-1, where 1 = no smoothing)
        self.transition_smoothing = 0.2  # Increased to make transitions faster
        # Distance threshold for possession
        self.possession_distance_threshold = (
            60  # Adjusted threshold for closer detection
        )
        # Count frames where no team has possession
        self.no_possession_frames = 0

    def update_possession(self, players, ball_position, frame_number):
        """Update ball possession based on proximity to players"""
        min_distance = float("inf")
        closest_player_id = None
        closest_player_team = None

        # Find the closest player to the ball
        for player_id, player_data in players.items():
            # Skip referees
            if player_data.get("team") in ["referee", "unassigned"]:
                continue

            player_position = (player_data["x"], player_data["y"])
            distance = np.sqrt(
                (player_position[0] - ball_position[0]) ** 2
                + (player_position[1] - ball_position[1]) ** 2
            )

            # Check if this player is closer than the current closest
            if distance < min_distance:
                min_distance = distance
                closest_player_id = player_id
                closest_player_team = player_data.get("team")

        # Minimum distance threshold to consider a player has possession
        if (
            min_distance < self.possession_distance_threshold
            and closest_player_team in [1, 2]
        ):
            # Reset no possession counter
            self.no_possession_frames = 0

            # Add to recent possessions
            self.recent_possessions.append(closest_player_team)
            if len(self.recent_possessions) > self.possession_smoothing:
                self.recent_possessions.pop(0)

            # Determine the most common team in recent possessions
            if len(self.recent_possessions) > 0:
                counts = {}
                for team in self.recent_possessions:
                    counts[team] = counts.get(team, 0) + 1

                current_possession = max(counts.items(), key=lambda x: x[1])[0]

                # If possession changes, update counters
                if self.last_possession != current_possession:
                    self.last_possession = current_possession
                    self.possession_count[current_possession] += 1

                # Update duration
                self.possession_durations[current_possession] += 1

                return current_possession, closest_player_id
        else:
            # Ball is far from any player - count as "no possession"
            self.no_possession_frames += 1

            # Only continue last team's possession for a short while (3 frames)
            if self.no_possession_frames <= 3 and self.last_possession:
                # Continue last team's possession briefly
                if self.last_possession in [1, 2]:
                    self.recent_possessions.append(self.last_possession)
                    if len(self.recent_possessions) > self.possession_smoothing:
                        self.recent_possessions.pop(0)
                    self.possession_durations[self.last_possession] += 1
            else:
                # Ball has been away from players too long
                # Don't increment any team's possession counter
                pass

        # Return the last possession (or None if never established)
        return self.last_possession, None

    def get_possession_stats(self, smoothed=False):
        """Get possession statistics as percentages with optional smoothing

        Args:
            smoothed: If True, returns smoothed stats for visual display.
                     If False, returns raw stats for data storage.
        """
        total_duration = sum(self.possession_durations.values())
        if total_duration == 0:
            raw_stats = {1: 50.0, 2: 50.0}  # Default to equal possession
        else:
            raw_stats = {
                1: (self.possession_durations[1] / total_duration) * 100,
                2: (self.possession_durations[2] / total_duration) * 100,
            }

        if not smoothed:
            return raw_stats  # Return raw stats for data storage

        # Apply smoothing between current and previous values for visual display
        smoothed_stats = {}
        for team in [1, 2]:
            smoothed_stats[team] = (
                self.prev_percentages[team] * (1 - self.transition_smoothing)
                + raw_stats[team] * self.transition_smoothing
            )

        # Update previous percentages for next frame
        self.prev_percentages = smoothed_stats.copy()

        return smoothed_stats  # Return smoothed stats for visual display

    def draw_possession_bar(self, frame):
        """Draw a possession bar at the top of the frame that's always visible"""
        # Get smoothed stats for visual display
        stats = self.get_possession_stats(smoothed=True)

        # Create transparent overlay
        overlay = frame.copy()
        cv2.rectangle(
            overlay, (50, 40), (frame.shape[1] - 50, 100), (255, 255, 255), -1
        )
        alpha = 0.7
        cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)

        # Draw title and team labels
        cv2.putText(
            frame,
            "BALL POSSESSION",
            (frame.shape[1] // 2 - 100, 60),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 0, 0),
            2,
        )

        # Team labels
        cv2.putText(
            frame, "Team 1", (80, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 200), 2
        )
        cv2.putText(
            frame,
            "Team 2",
            (frame.shape[1] - 150, 60),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 165, 255),
            2,
        )

        # Draw possession bar
        bar_width = frame.shape[1] - 200
        bar_height = 20
        bar_x = 100
        bar_y = 70

        # Team 1 portion (blue)
        team1_width = int(bar_width * (stats[1] / 100))
        cv2.rectangle(
            frame,
            (bar_x, bar_y),
            (bar_x + team1_width, bar_y + bar_height),
            (200, 0, 0),
            -1,
        )

        # Team 2 portion (orange)
        cv2.rectangle(
            frame,
            (bar_x + team1_width, bar_y),
            (bar_x + bar_width, bar_y + bar_height),
            (0, 165, 255),
            -1,
        )

        # Add percentages
        cv2.putText(
            frame,
            f"{stats[1]:.1f}%",
            (bar_x + team1_width // 2 - 20, bar_y + 15),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 255),
            1,
        )

        cv2.putText(
            frame,
            f"{stats[2]:.1f}%",
            (bar_x + team1_width + (bar_width - team1_width) // 2 - 20, bar_y + 15),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 255),
            1,
        )

        # Add border
        cv2.rectangle(
            frame, (bar_x, bar_y), (bar_x + bar_width, bar_y + bar_height), (0, 0, 0), 1
        )

        return frame


# Initialize ball possession tracker
ball_possession_tracker = BallPossessionTracker()


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

        # Track all players and ball position
        all_players = {}
        ball_position = None

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
                ball_position = (x, y)
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
                all_players[player_id] = {"x": x, "y": y, "team": "referee"}
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
                    all_players[player_id] = {"x": x, "y": y, "team": team_id}
                else:
                    # Fallback if team colors not initialized yet
                    bbox_color = (0, 255, 0)  # Default to green
                    label = f"Team {team_id} {conf:.2f}"
                    team_counts[team_id] += 1
                    all_players[player_id] = {"x": x, "y": y, "team": "unassigned"}

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

        # Update ball possession if ball is detected and teams initialized
        if ball_position and team_assigner.teams_initialized:
            possession_team, closest_player = ball_possession_tracker.update_possession(
                all_players, ball_position, frame_count
            )
        else:
            # If ball is not found in this frame, don't update possession
            possession_team = None

        # Always draw possession bar with smoothed stats for visual display
        display_frame = ball_possession_tracker.draw_possession_bar(display_frame)

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
                "team_stats": {
                    "team1_possession": 50.0,  # Start balanced
                    "team2_possession": 50.0,  # Start balanced
                    "final_possession": {
                        "team1": 50.0,
                        "team2": 50.0,
                        "timestamp": time.time(),
                        "frames_analyzed": 0,
                    },
                },
            }

        status["frames_processed"] = frame_count + 1
        status["last_frame"] = frame_count

        # Only update possession stats if we've tracked some possession
        if sum(ball_possession_tracker.possession_durations.values()) > 0:
            # Get raw stats for data storage
            possession_stats = ball_possession_tracker.get_possession_stats(
                smoothed=False
            )
            status["team_stats"]["team1_possession"] = possession_stats[1]
            status["team_stats"]["team2_possession"] = possession_stats[2]

            # Update final possession result with raw stats
            status["team_stats"]["final_possession"] = {
                "team1": possession_stats[1],
                "team2": possession_stats[2],
                "timestamp": time.time(),
                "frames_analyzed": frame_count + 1,
            }
        else:
            # No possession established yet, maintain 50-50
            status["team_stats"]["team1_possession"] = 50.0
            status["team_stats"]["team2_possession"] = 50.0
            status["team_stats"]["final_possession"] = {
                "team1": 50.0,
                "team2": 50.0,
                "timestamp": time.time(),
                "frames_analyzed": frame_count + 1,
            }

        # Remove the history array if it exists
        if "possession_history" in status["team_stats"]:
            del status["team_stats"]["possession_history"]

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
            try:
                channel.start_consuming()
            except KeyboardInterrupt:
                # On keyboard interrupt, update status to completed before exiting
                try:
                    with open("consumer_status.json", "r") as f:
                        status = json.load(f)
                    status["completed"] = True
                    # Final possession is already continuously updated
                    with open("consumer_status.json", "w") as f:
                        json.dump(status, f)
                    print("Processing marked as completed.")
                except Exception as e:
                    print(f"Error updating completion status: {e}")

                print("Stopping consumer...")
                try:
                    if channel:
                        channel.close()
                    if connection:
                        connection.close()
                except:
                    pass
                # Exit the loop on keyboard interrupt
                break
            except pika.exceptions.ConnectionClosedByBroker:
                print("Connection was closed by broker, retrying in 5 seconds...")
                time.sleep(5)
                continue
            except pika.exceptions.AMQPConnectionError:
                print("Lost connection to RabbitMQ, retrying in 5 seconds...")
                time.sleep(5)
                continue

        except Exception as e:
            print(f"Consumer error: {str(e)}")
            traceback.print_exc()

            # Try to mark as completed even on error
            try:
                with open("consumer_status.json", "r") as f:
                    status = json.load(f)
                status["completed"] = True
                with open("consumer_status.json", "w") as f:
                    json.dump(status, f)
            except:
                pass

            print("Retrying in 5 seconds...")
            time.sleep(5)
            continue


def finalize_processing():
    """Update status file to mark processing as completed and save final stats"""
    try:
        with open("consumer_status.json", "r") as f:
            status = json.load(f)

        status["completed"] = True
        # Make sure the final possession stats are saved
        possession_stats = ball_possession_tracker.get_possession_stats(smoothed=False)
        status["team_stats"]["final_possession"] = {
            "team1": possession_stats[1],
            "team2": possession_stats[2],
            "timestamp": time.time(),
            "frames_analyzed": status.get("frames_processed", 0),
            "final": True,  # Mark this as the definitive final value
        }

        with open("consumer_status.json", "w") as f:
            json.dump(status, f)
        print("Processing finalized with possession stats saved.")
    except Exception as e:
        print(f"Error finalizing processing: {e}")


# Register finalize_processing to run on exit
import atexit

atexit.register(finalize_processing)

if __name__ == "__main__":
    # Ensure the processed frames directory exists
    if not os.path.exists(PROCESSED_FRAMES_DIR):
        os.makedirs(PROCESSED_FRAMES_DIR)

    # Initialize with exactly balanced possession
    status = {
        "frames_processed": 0,
        "total_frames": 0,
        "completed": False,
        "team_stats": {
            "team1_possession": 50.0,
            "team2_possession": 50.0,
            "final_possession": {
                "team1": 50.0,
                "team2": 50.0,
                "timestamp": time.time(),
                "frames_analyzed": 0,
            },
        },
    }

    with open("consumer_status.json", "w") as f:
        json.dump(status, f)

    try:
        print("Starting consumer process...")
        start_consuming()
    except KeyboardInterrupt:
        print("Consumer interrupted by user")
    finally:
        # Ensure we save the final possession stats when exiting
        finalize_processing()
