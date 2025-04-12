import cv2
import pika
import pickle
import os
import numpy as np
from roboflow import Roboflow
import json
from time import sleep
from sklearn.cluster import KMeans
 
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
        self.referee_colors = []  # Store known referee colors to improve detection
    
    def get_player_color(self, frame, bbox):
        """Extract player jersey color using K-means clustering"""
        x, y, w, h = bbox
        
        # Extract the player region (top half for jersey color)
        player_image = frame[int(y - h/2):int(y), int(x - w/2):int(x + w/2)]
        
        # If region is too small or invalid, return default color
        if player_image.size == 0 or player_image.shape[0] < 2 or player_image.shape[1] < 2:
            return np.array([0, 0, 0])
        
        # Reshape the image for clustering
        image_2d = player_image.reshape(-1, 3)
        
        # K-means clustering with 2 clusters (player jersey and background)
        kmeans = KMeans(n_clusters=2, random_state=0)
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
            clustered_image[-1, -1]
        ]
        non_player_cluster = max(set(corner_clusters), key=corner_clusters.count)
        
        # Player cluster is the opposite of non-player cluster
        player_cluster = 1 - non_player_cluster
        
        # Return the color center of the player cluster
        return kmeans.cluster_centers_[player_cluster]
    
    def is_referee(self, color):
        """Check if a color is likely to be a referee (black, bright yellow, etc.)"""
        # Convert RGB to HSV for better color analysis
        color_bgr = np.uint8([[color.astype(int)[::-1]]])  # Convert to BGR for OpenCV
        color_hsv = cv2.cvtColor(color_bgr, cv2.COLOR_BGR2HSV)[0][0]
        
        h, s, v = color_hsv
        
        # Referee typically wears black (low value) or bright yellow/green
        is_black = v < 70 and s < 70  # Low value and saturation for black
        is_yellow = 25 <= h <= 35 and s > 100 and v > 150  # Yellow with high saturation
        is_bright_green = 45 <= h <= 65 and s > 100 and v > 150  # Bright green referees
        
        # Check against previously identified referee colors
        if len(self.referee_colors) > 0:
            for ref_color in self.referee_colors:
                # Compute distance to known referee colors
                dist = np.sum((color - ref_color) ** 2)
                if dist < 1000:  # Threshold for similarity
                    return True
        
        return is_black or is_yellow or is_bright_green
    
    def update_referee_colors(self, frame, player_id, bbox):
        """Store this color as a referee color for improved detection"""
        color = self.get_player_color(frame, bbox)
        self.referee_colors.append(color)
        print(f"Added referee color: {color}")
        
        # Limit the number of stored referee colors
        if len(self.referee_colors) > 10:
            self.referee_colors.pop(0)  # Remove oldest color
        
        return color
    
    def assign_teams(self, frame, player_detections):
        """Initialize team colors by clustering player colors"""
        if len(player_detections) < 4:  # Need enough players for reliable clustering
            return
            
        # Extract colors from all detected players
        player_colors = []
        player_ids = []
        referee_ids = set()
        
        for player_id, detection in player_detections.items():
            x, y, w, h = detection['bbox']
            
            # Check if this player is already marked as a referee by the model
            if detection.get('class') == 'referee':
                self.player_team_dict[player_id] = "referee"
                referee_ids.add(player_id)
                print(f"Model detected referee: {player_id}")
                continue
                
            player_color = self.get_player_color(frame, (x, y, w, h))
            
            # Check if this might be a referee based on color
            if self.is_referee(player_color):
                self.player_team_dict[player_id] = "referee"
                referee_ids.add(player_id)
                print(f"Color-based referee detection: {player_id} with color {player_color}")
                continue
                
            player_colors.append(player_color)
            player_ids.append(player_id)
        
        # If we don't have enough players after removing referees, return
        if len(player_colors) < 4:
            return
            
        # Cluster player colors into two teams
        team_kmeans = KMeans(n_clusters=2, random_state=0)
        team_labels = team_kmeans.fit_predict(np.array(player_colors))
        
        # Store team colors
        self.team_colors[1] = team_kmeans.cluster_centers_[0]
        self.team_colors[2] = team_kmeans.cluster_centers_[1]
        
        # Assign players to teams
        for i, player_id in enumerate(player_ids):
            self.player_team_dict[player_id] = team_labels[i] + 1  # Teams 1 and 2
        
        print(f"Team 1 color: {self.team_colors[1]}")
        print(f"Team 2 color: {self.team_colors[2]}")
        print(f"Detected {len(referee_ids)} referees")
        self.teams_initialized = True
    
    def get_player_team(self, frame, bbox, player_id):
        """Determine which team a player belongs to"""
        if player_id in self.player_team_dict:
            return self.player_team_dict[player_id]
            
        player_color = self.get_player_color(frame, bbox)
        
        # Check if this is a referee
        if self.is_referee(player_color):
            self.player_team_dict[player_id] = "referee"
            return "referee"
        
        # Calculate distance to each team's color center
        dist_team1 = np.sum((player_color - self.team_colors[1]) ** 2)
        dist_team2 = np.sum((player_color - self.team_colors[2]) ** 2)
        
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
 
        # Save frame temporarily for Roboflow
        temp_path = os.path.join(PROCESSED_FRAMES_DIR, f"temp_{frame_count}.jpg")
        cv2.imwrite(temp_path, frame)
 
        # Run inference
        predictions = model.predict(temp_path, confidence=40, overlap=30).json()
        
        # Collect player detections for team assignment
        player_detections = {}
        for i, prediction in enumerate(predictions["predictions"]):
            # Skip balls
            if prediction.get("class") == "football" or prediction.get("class") == "ball":
                continue
                
            # Check if the model detected a referee
            is_ref = prediction.get("class") == "referee"
            
            player_id = f"player_{frame_count}_{i}"
            player_detections[player_id] = {
                'bbox': (
                    prediction["x"], 
                    prediction["y"], 
                    prediction["width"], 
                    prediction["height"]
                ),
                'class': "referee" if is_ref else "player"
            }
        
        # Assign teams if not already done and we have enough players
        global team_assigner
        if not team_assigner.teams_initialized and len(player_detections) >= 4:
            team_assigner.assign_teams(frame, player_detections)
 
        # Create a frame to display
        display_frame = frame.copy()
        
        # Count of detections per team
        team_counts = {1: 0, 2: 0, "referee": 0, "unassigned": 0}
        
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
                cv2.circle(display_frame, (int(x), int(y)), int(w/2), (0, 0, 255), 2)
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
                # Special handling for referees detected by model
                bbox_color = (0, 255, 255)  # Yellow for referees
                label = f"referee {conf:.2f}"
                team_counts["referee"] += 1
                
                # Update referee colors
                team_assigner.update_referee_colors(frame, player_id, bbox)
            elif team_assigner.teams_initialized:
                # Get team assignment
                team_result = team_assigner.get_player_team(frame, (x, y, w, h), player_id)
                
                if team_result == "referee":
                    # Special handling for referees detected by color
                    bbox_color = (0, 0, 0)  # Black for referees
                    label = f"referee {conf:.2f}"
                    prediction["class"] = "referee"  # Update class for future reference
                    team_counts["referee"] += 1
                    
                    # Update referee colors
                    team_assigner.update_referee_colors(frame, player_id, bbox)
                else:
                    # Regular team player
                    team_id = team_result
                    team_color = team_assigner.team_colors[team_id]
                    
                    # Convert to BGR for OpenCV
                    bbox_color = (int(team_color[2]), int(team_color[1]), int(team_color[0]))
                    label = f"Team {team_id} {conf:.2f}"
                    team_counts[team_id] += 1
            else:
                # Fallback to dominant color if teams not yet assigned
                color_name, bbox_color = get_dominant_color(frame, x, y, w, h)
                label = f"{color_name} {conf:.2f}"
                team_counts["unassigned"] += 1
 
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
 
        # Save processed frame
        output_path = os.path.join(PROCESSED_FRAMES_DIR, f"frame_{frame_count}.jpg")
        cv2.imwrite(output_path, display_frame)
 
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
            connection = pika.BlockingConnection(
                pika.ConnectionParameters(
                    host='localhost',
                    heartbeat=600,
                    blocked_connection_timeout=300,
                    connection_attempts=3,
                    retry_delay=5
                )
            )
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
 
        except pika.exceptions.ConnectionClosedByBroker as e:
            print(f"Connection was closed by broker: {e}, retrying...")
            sleep(5)
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
    
    # Create or reset the consumer status file
    status_data = {
        "frames_processed": 0,
        "last_frame": 0,
        "team_stats": {
            "team1_possession": 0,
            "team2_possession": 0
        }
    }
    
    with open("consumer_status.json", "w") as f:
        json.dump(status_data, f)
 
    # Start consuming
    start_consuming() 