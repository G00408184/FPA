const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Configure multer for video upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/') // Make sure this directory exists
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname))
    }
});

const upload = multer({ storage: storage });

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Create processed_frames directory if it doesn't exist
if (!fs.existsSync('processed_frames')) {
    fs.mkdirSync('processed_frames');
}

// Track running processes
let producerProcess = null;
let consumerProcesses = [];
let uploadedVideoPath = null; // Store path to the uploaded video

// Upload endpoint - only run producer to process video
app.post('/upload', upload.single('video'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        console.log('File uploaded successfully:', req.file.filename);

        // Kill any existing processes
        if (producerProcess) {
            producerProcess.kill();
        }
        if (consumerProcesses.length > 0) {
            consumerProcesses.forEach(process => process.kill());
            consumerProcesses = [];
        }

        // Clear processed frames directory
        const processedFramesDir = 'processed_frames';
        if (fs.existsSync(processedFramesDir)) {
            const files = fs.readdirSync(processedFramesDir);
            for (const file of files) {
                fs.unlinkSync(path.join(processedFramesDir, file));
            }
        }

        // Clear consumer status file if it exists
        if (fs.existsSync('consumer_status.json')) {
            fs.unlinkSync('consumer_status.json');
        }

        // Store path to the uploaded video
        uploadedVideoPath = path.join(__dirname, 'uploads', req.file.filename);
        
        // Set fixed frame count - no ffprobe detection
        const totalFrames = 750;
        console.log('Using fixed frame count of 750');
        
        // Create initial status file with total frames
        const initialStatus = {
            frames_processed: 0,
            total_frames: totalFrames,
            completed: false,
            team_stats: {
                team1: 50,
                team2: 50
            }
        };
        
        fs.writeFileSync('consumer_status.json', JSON.stringify(initialStatus));
        
        
        // Start producer process with the video file path
        console.log('Starting producer.py...');
        producerProcess = spawn('python', ['producer.py', '--video', uploadedVideoPath]);
        
        producerProcess.stdout.on('data', (data) => {
            console.log(`Producer output: ${data}`);
        });
        
        producerProcess.stderr.on('data', (data) => {
            console.error(`Producer error: ${data}`);
        });

        // No longer auto-starting consumers - will be started on demand
        
        res.json({ 
            message: 'File uploaded successfully and queued for processing',
            filename: req.file.filename,
            total_frames: totalFrames
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start producer endpoint
app.post('/start-producer', (req, res) => {
    try {
        // Kill any existing producer process
        if (producerProcess) {
            producerProcess.kill();
        }
        
        console.log('Starting producer.py...');
        producerProcess = spawn('python', ['producer.py']);
        
        producerProcess.stdout.on('data', (data) => {
            console.log(`Producer output: ${data}`);
        });
        
        producerProcess.stderr.on('data', (data) => {
            console.error(`Producer error: ${data}`);
        });
        
        producerProcess.on('close', (code) => {
            console.log(`Producer process exited with code ${code}`);
        });
        
        // Wait a moment to let producer start up
        setTimeout(() => {
            res.json({ message: 'Producer started successfully' });
        }, 1000);
    } catch (error) {
        console.error('Error starting producer:', error);
        res.status(500).json({ error: error.message });
    }
});

// Status endpoint
app.get('/status', (req, res) => {
    res.json({ status: 'running' });
});

// Start Analysis endpoint (renamed from start-consumer)
app.post('/start-analysis', (req, res) => {
    try {
        // Kill any existing consumer process
        if (consumerProcesses.length > 0) {
            consumerProcesses.forEach(process => process.kill());
            consumerProcesses = [];
        }
        
        console.log('Starting analysis with consumer.py...');
        consumerProcesses = startConsumers(1);
        
        consumerProcesses.forEach(process => {
            process.stdout.on('data', (data) => {
                console.log(`Consumer output: ${data}`);
            });
            
            process.stderr.on('data', (data) => {
                console.error(`Consumer error: ${data}`);
            });
            
            process.on('close', (code) => {
                console.log(`Consumer process exited with code ${code}`);
            });
        });
        
        // Wait a moment to let consumer start up
        setTimeout(() => {
            res.json({ message: 'Analysis started successfully' });
        }, 1000);
    } catch (error) {
        console.error('Error starting analysis:', error);
        res.status(500).json({ error: error.message });
    }
});

// Consumer status endpoint - read from consumer_status.json if it exists
app.get('/consumer-status', (req, res) => {
    try {
        if (fs.existsSync('consumer_status.json')) {
            const status = JSON.parse(fs.readFileSync('consumer_status.json', 'utf8'));
            
            if (!status.total_frames || status.total_frames <= 0) {
                status.total_frames = 749;
            }
            
            // Make sure we have a progress percent
            if (status.frames_processed > 0) {
                status.progress_percent = Math.min(100, Math.round((status.frames_processed / status.total_frames) * 100));
            } else {
                status.progress_percent = 0;
            }
            
            res.json(status);
        } else {
            res.json({ 
                frames_processed: 0, 
                total_frames: 750,
                completed: false,
                progress_percent: 0
            });
        }
    } catch (error) {
        console.error('Error reading consumer status:', error);
        res.status(500).json({ 
            error: error.message,
            frames_processed: 0, 
            total_frames: 750,
            completed: false,
            progress_percent: 0
        });
    }
});

// Purge queue endpoint
app.post('/purge-queue', (req, res) => {
    try {
        // Cleanup any existing processes
        if (producerProcess) {
            producerProcess.kill();
            producerProcess = null;
        }
        
        if (consumerProcesses.length > 0) {
            consumerProcesses.forEach(process => process.kill());
            consumerProcesses = [];
        }
        
        // Clear processed frames
        if (fs.existsSync('processed_frames')) {
            const files = fs.readdirSync('processed_frames');
            for (const file of files) {
                fs.unlinkSync(path.join('processed_frames', file));
            }
        }
        
        res.json({ message: 'Queue purged successfully' });
    } catch (error) {
        console.error('Error purging queue:', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper function to start multiple consumer processes
function startConsumers(count = 1) {
    const consumers = [];
    for (let i = 0; i < count; i++) {
        const process = spawn('python', ['consumer.py'], {
            cwd: __dirname,
            stdio: ['ignore', 'pipe', 'pipe']
        });
        
        process.on('exit', (code) => {
            console.log(`Consumer process ${i+1} exited with code ${code}`);
            // Remove from the array
            const index = consumers.indexOf(process);
            if (index > -1) {
                consumers.splice(index, 1);
            }
        });
        
        consumers.push(process);
    }
    return consumers;
}

// Serve processed frames
app.use('/processed-frames', express.static('processed_frames'));

// Serve processed_frame.jpg directly
app.get('/latest-frame', (req, res) => {
    const latestFrame = path.join(__dirname, 'processed_frame.jpg');
    if (fs.existsSync(latestFrame)) {
        res.sendFile(latestFrame);
    } else {
        res.status(404).send('No processed frame available');
    }
});

// Generate video endpoint
app.post('/generate-video', (req, res) => {
    try {
        // Code to generate final video here
        // This is just a placeholder - implement actual video generation
        
        res.json({ message: 'Video generation started' });
    } catch (error) {
        console.error('Error generating video:', error);
        res.status(500).json({ error: error.message });
    }
});

// Download video endpoint
app.get('/download-video', (req, res) => {
    const videoPath = path.join(__dirname, 'output_video.mp4');
    if (fs.existsSync(videoPath)) {
        res.download(videoPath);
    } else {
        res.status(404).send('Video not found');
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 