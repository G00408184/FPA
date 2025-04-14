const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');

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
const fs = require('fs');
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Create processed_frames directory if it doesn't exist
if (!fs.existsSync('processed_frames')) {
    fs.mkdirSync('processed_frames');
}

// Track running processes
let producerProcess = null;
let consumerProcess = null;

// Upload endpoint
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
        if (consumerProcess) {
            consumerProcess.kill();
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

        // Start producer process with the video file path
        console.log('Starting producer.py...');
        const videoPath = path.join(__dirname, 'uploads', req.file.filename);
        producerProcess = spawn('python', ['producer.py', '--video', videoPath]);
        
        producerProcess.stdout.on('data', (data) => {
            console.log(`Producer output: ${data}`);
        });
        
        producerProcess.stderr.on('data', (data) => {
            console.error(`Producer error: ${data}`);
        });

        // Wait for producer to start
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Start multiple consumer processes
        console.log('Starting multiple consumers...');
        const consumerProcesses = [];
        const numConsumers = 3; // Number of consumers to start

        for (let i = 0; i < numConsumers; i++) {
            const consumerProcess = spawn('python', ['consumer.py']);
            consumerProcesses.push(consumerProcess);
            
            consumerProcess.stdout.on('data', (data) => {
                console.log(`Consumer ${i + 1} output: ${data}`);
            });
            
            consumerProcess.stderr.on('data', (data) => {
                console.error(`Consumer ${i + 1} error: ${data}`);
            });

            // Small delay between starting consumers
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        res.json({ 
            message: 'File uploaded successfully and processing started',
            filename: req.file.filename
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

// Start consumer endpoint
app.post('/start-consumer', (req, res) => {
    try {
        // Kill any existing consumer process
        if (consumerProcess) {
            consumerProcess.kill();
        }
        
        console.log('Starting consumer.py...');
        consumerProcess = spawn('python', ['consumer.py']);
        
        consumerProcess.stdout.on('data', (data) => {
            console.log(`Consumer output: ${data}`);
        });
        
        consumerProcess.stderr.on('data', (data) => {
            console.error(`Consumer error: ${data}`);
        });
        
        consumerProcess.on('close', (code) => {
            console.log(`Consumer process exited with code ${code}`);
        });
        
        // Wait a moment to let consumer start up
        setTimeout(() => {
            res.json({ message: 'Consumer started successfully' });
        }, 1000);
    } catch (error) {
        console.error('Error starting consumer:', error);
        res.status(500).json({ error: error.message });
    }
});

// Consumer status endpoint - read from consumer_status.json if it exists
app.get('/consumer-status', (req, res) => {
    try {
        if (fs.existsSync('consumer_status.json')) {
            const status = JSON.parse(fs.readFileSync('consumer_status.json', 'utf8'));
            res.json(status);
        } else {
            res.json({ 
                frames_processed: 0, 
                total_frames: 0, 
                completed: false 
            });
        }
    } catch (error) {
        console.error('Error reading consumer status:', error);
        res.status(500).json({ error: error.message });
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
        
        if (consumerProcess) {
            consumerProcess.kill();
            consumerProcess = null;
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

// Generate video endpoint
app.post('/generate-video', (req, res) => {
    try {
        console.log('Starting generate_video.py...');
        const generateProcess = spawn('python', ['generate_video.py']);
        
        generateProcess.stdout.on('data', (data) => {
            console.log(`Generate video output: ${data}`);
        });
        
        generateProcess.stderr.on('data', (data) => {
            console.error(`Generate video error: ${data}`);
        });
        
        generateProcess.on('close', (code) => {
            console.log(`Generate video process exited with code ${code}`);
            if (code === 0) {
                res.json({ message: 'Video generated successfully' });
            } else {
                res.status(500).json({ error: 'Video generation failed' });
            }
        });
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
        res.status(404).json({ error: 'Video file not found' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Backend is ready at http://localhost:${PORT}`);
});
