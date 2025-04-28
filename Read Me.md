# Football Player Analysis (FPA) 🏆
 
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-FFD43B?style=for-the-badge&logo=python&logoColor=blue)](https://www.python.org/)
[![OpenCV](https://img.shields.io/badge/OpenCV-27338e?style=for-the-badge&logo=OpenCV&logoColor=white)](https://opencv.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
 
An advanced football video analysis system that detects players, assigns teams, tracks the ball, and calculates possession statistics using computer vision and machine learning.
 
 
## 🌟 Features
 
- **Player Detection**: Identifies all players on the pitch using YOLOv8
- **Team Assignment**: Automatically groups players into teams using K-means clustering on jersey colors
- **Ball Tracking**: Detects the ball and tracks its position
- **Possession Analysis**: Calculates ball possession statistics in real-time
- **Interactive UI**: User-friendly interface to upload videos and view statistics
- **Video Generation**: Creates processed videos with player bounding boxes, team colors, and possession stats
- **Parallel Processing**: Uses message queuing for efficient video processing
 
## 🏗️ Architecture
 
This project follows a three-tier architecture:
 
1. **Frontend Tier (React.js)**:
   - User interface for video upload and results visualization
   - Real-time progress tracking and stats display
 
2. **Backend Tier (Node.js/Express)**:
   - API server for handling HTTP requests
   - File management and process orchestration
   - Serves processed videos and statistics
 
3. **Processing Tier (Python)**:
   - Computer vision and machine learning pipeline
   - Player detection using YOLOv8
   - Team assignment using K-means clustering
   - Ball possession calculation
   - Video processing with OpenCV
   - RabbitMQ for message queuing
 
## 🛠️ Technologies Used
 
### Frontend
- React.js
- Material-UI
- Tailwind CSS
- Axios for API requests
 
### Backend
- Node.js & Express
- RabbitMQ for message queuing
- Multer for file uploads
 
### Processing
- Python 3.9+
- OpenCV for image processing
- YOLOv8 (via Ultralytics)
- Roboflow for model hosting
- Scikit-learn for K-means clustering
 
## 📋 Prerequisites
 
- Node.js 16+
- Python 3.9+
- RabbitMQ server
- Git
 
## 🚀 Installation
 
1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/football-player-analysis.git
   cd football-player-analysis
   ```
 
2. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   cd ..
   ```
 
3. **Install backend dependencies**
   ```bash
   cd Backend
   npm install
   ```
 
4. **Install Python dependencies**
   ```bash
   pip install -r Requirements.txt
   ```
 
5. **Set up RabbitMQ**
   - Install RabbitMQ server: [Installation Guide](https://www.rabbitmq.com/download.html)
   - Start RabbitMQ service:
     ```bash
     # On Windows
     net start rabbitmq
     
     # On macOS
     brew services start rabbitmq
     
     # On Linux
     sudo systemctl start rabbitmq-server
     ```
 
## 🎮 Usage
 
1. **Start the application**
   ```bash
   # Start the backend server
   node server.js
   
   # In a new terminal, start the frontend
   cd frontend
   npm start
   ```
 
2. **Access the application**
   - Open your browser and navigate to `http://localhost:3000`
 
3. **Upload a video**
   - Click on the upload button and select a football match video
   - The video will be uploaded and prepared for analysis
 
4. **Start analysis**
   - Click the "Start Analysis" button to begin processing
   - Watch the progress bar as the system analyzes the video
 
5. **View results**
   - Once processing is complete, view possession statistics
   - Download the processed video with player tracking visualization
 
## 📁 Code Structure
 
```
football-player-analysis/
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── App.js            # Main application component
│   │   
│   ├── public/               # Static files
│   └── package.json          # Frontend dependencies
├── backend/                  # Python processing code
│   ├── consumer.py           # Video frame processor
│   ├── producer.py           # Frame extraction and queueing
│   ├── generate_video.py     # Video generation from processed frames
│   ├── server.js                 # Express server
│   ├── package.json              # Backend dependencies
│   ├── uploads/                  # Uploaded videos storage
│   ├── processed_frames/         # Processed frame storage
│    ├── package.json              # Backend dependencies
└── Requirements.txt          # Python dependencies
```
 
## 🧠 Technical Details
 
### Team Assignment Algorithm
 
The system uses K-means clustering to identify team jerseys:
 
1. For each detected player, extract pixel colors within their bounding box
2. Apply K-means clustering to group similar colors
3. Use the dominant color clusters to assign players to teams
4. Track team assignments across frames for consistency
 
### Ball Possession Calculation
 
1. Calculate the distance between the ball and each player
2. Determine the closest player to the ball in each frame
3. Assign possession to the team of the closest player using Euclidian Theory
4. Calculate cumulative possession percentage over time
 
### Video Processing Pipeline
 
1. **Producer**: Extracts frames from the video and pushes them to RabbitMQ
2. **Consumer**: Processes frames with player detection and team assignment
3. **Video Generator**: Combines processed frames into a final video

## 🐳 Docker Support

The project includes Docker support with RabbitMQ management:

```bash
# Build the Docker image
docker build -t football-player-analysis .

# Run the container
docker run -p 3000:3000 -p 5000:5000 -p 5672:5672 -p 15672:15672 football-player-analysis
```

Exposed ports:
- 3000: Frontend React application
- 5000: Backend API server
- 5672: RabbitMQ message broker
- 15672: RabbitMQ management UI (accessible at http://localhost:15672)
 
## 🔧 Troubleshooting
 
- **RabbitMQ Connection Issues**: Ensure RabbitMQ service is running
- **Missing Dependencies**: Run `pip install -r Requirements.txt` again
- **Processing Errors**: Check the console logs for specific error messages
- **Video Download Problems**: Verify that the video processing completed successfully
 
## 🚧 Future Improvements
 
- Implement player tracking across frames
- Add pass detection and analysis
- Support for team formation analysis
- Enhanced statistics visualization
- Batch processing of multiple videos
- Cloud deployment with scalable worker nodes
 
## 🙏 Acknowledgments
 
- [Roboflow](https://universe.roboflow.com/roboflow-jvuqo/football-players-detection-3zvbc) for model hosting and management
- [OpenCV](https://opencv.org/) for computer vision capabilities
- [RabbitMQ](https://www.rabbitmq.com/) for messaging
- [React](https://reactjs.org/) and [Material-UI](https://mui.com/) for the frontend
