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
        
        // Set fixed frame count 
        const totalFrames = 749;
        
        
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
        console.log('Created initial status file with total frames:', totalFrames);
        
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

// Add the startProducer function here
function startProducer() {
    try {
        console.log('Starting producer.py...');
        
        producerProcess = spawn('python', ['producer.py'], {
            cwd: __dirname,
            stdio: ['ignore', 'pipe', 'pipe']
        });
        
        producerProcess.stdout.on('data', (data) => {
            console.log(`Producer output: ${data}`);
        });
        
        producerProcess.stderr.on('data', (data) => {
            console.error(`Producer error: ${data}`);
        });
        
        producerProcess.on('exit', (code) => {
            console.log(`Producer process exited with code ${code}`);
            producerProcess = null;
        });
        
        return producerProcess;
    } catch (error) {
        console.error('Error starting producer:', error);
        return null;
    }
}

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
        
        console.log('Starting analysis with multiple consumers...');
        consumerProcesses = startConsumers(3); // Start 3 consumer processes
        
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
        
        // Wait a moment to let consumers start up
        setTimeout(() => {
            res.json({ 
                message: 'Analysis started successfully', 
                consumers_started: consumerProcesses.length 
            });
        }, 1000);
    } catch (error) {
        console.error('Error starting analysis:', error);
        res.status(500).json({ error: error.message });
    }
});

// Keep legacy endpoint for compatibility
app.post('/start-consumer', (req, res) => {
    try {
        // Redirect to the new endpoint
        console.log('Redirecting to start-analysis endpoint');
        // Kill any existing consumer process
        if (consumerProcesses.length > 0) {
            consumerProcesses.forEach(process => process.kill());
            consumerProcesses = [];
        }
        
        console.log('Starting multiple consumers...');
        consumerProcesses = startConsumers(3); // Start 3 consumer processes
        
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
        
        // Wait a moment to let consumers start up
        setTimeout(() => {
            res.json({ 
                message: 'Consumers started successfully',
                consumers_started: consumerProcesses.length
            });
        }, 1000);
    } catch (error) {
        console.error('Error starting consumers:', error);
        res.status(500).json({ error: error.message });
    }
});

// Consumer status endpoint - read from consumer_status.json if it exists
app.get('/consumer-status', (req, res) => {
    try {
        if (fs.existsSync('consumer_status.json')) {
            const status = JSON.parse(fs.readFileSync('consumer_status.json', 'utf8'));
            
            // If total_frames is missing or zero, use default 750
            if (!status.total_frames || status.total_frames <= 0) {
                status.total_frames = 750;
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
function startConsumers(count = 3) {
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

// Helper function to stop all consumers
function stopConsumers() {
    if (consumerProcesses.length > 0) {
        console.log('Stopping all consumers...');
        consumerProcesses.forEach(process => {
            try {
                process.kill();
            } catch (error) {
                console.error('Error stopping consumer:', error);
            }
        });
        consumerProcesses = [];
    }
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

// Possession statistics endpoint
app.get('/possession-stats', (req, res) => {
    try {
        if (fs.existsSync('consumer_status.json')) {
            try {
                const fileContent = fs.readFileSync('consumer_status.json', 'utf8');
                if (!fileContent || fileContent.trim() === '') {
                    return res.json({
                        team1: 0,
                        team2: 0,
                        frames_analyzed: 0,
                        last_possession: null,
                        message: 'No data available yet'
                    });
                }
                
                const status = JSON.parse(fileContent);
                
                // Extract team stats if available
                if (status.team_stats && status.team_stats.final_possession) {
                    const possession = status.team_stats.final_possession;
                    return res.json({
                        team1: possession.team1,
                        team2: possession.team2,
                        frames_analyzed: possession.frames_analyzed || status.frames_processed,
                        last_possession: status.team_stats.last_possession || null,
                        timestamp: possession.timestamp,
                        message: 'Possession data retrieved successfully'
                    });
                } else if (status.team_stats) {
                    // Fall back to current possession if final is not available
                    return res.json({
                        team1: status.team_stats.team1_possession,
                        team2: status.team_stats.team2_possession,
                        frames_analyzed: status.frames_processed,
                        last_possession: status.team_stats.last_possession || null,
                        message: 'Current possession data retrieved'
                    });
                } else {
                    // Default values if no possession data
                    return res.json({
                        team1: 0,
                        team2: 0,
                        frames_analyzed: status.frames_processed || 0,
                        message: 'No possession data available yet'
                    });
                }
            } catch (parseError) {
                console.error('JSON parse error in possession stats:', parseError);
                return res.json({
                    team1: 0,
                    team2: 0,
                    frames_analyzed: 0,
                    error: 'Could not parse possession data',
                    message: 'Error retrieving possession data'
                });
            }
        } else {
            return res.json({
                team1: 0,
                team2: 0,
                frames_analyzed: 0,
                message: 'No possession data available yet'
            });
        }
    } catch (error) {
        console.error('Error reading possession stats:', error);
        return res.status(500).json({
            team1: 0,
            team2: 0,
            frames_analyzed: 0,
            error: error.message,
            message: 'Error retrieving possession data'
        });
    }
});

// Serve a sample processed frame for possession verification
app.get('/latest-possession-frame', (req, res) => {
    // Find the latest frame in the processed_frames directory
    try {
        const processedFramesDir = 'processed_frames';
        if (!fs.existsSync(processedFramesDir)) {
            return res.status(404).send('No processed frames directory found');
        }
        
        const files = fs.readdirSync(processedFramesDir);
        if (files.length === 0) {
            return res.status(404).send('No processed frames available');
        }
        
        // Sort files by frame number (numerically)
        const frameFiles = files
            .filter(file => file.endsWith('.jpg'))
            .sort((a, b) => {
                const frameNumA = parseInt(a.replace('frame_', '').replace('.jpg', ''));
                const frameNumB = parseInt(b.replace('frame_', '').replace('.jpg', ''));
                return frameNumB - frameNumA; // Latest frame first
            });
            
        if (frameFiles.length === 0) {
            return res.status(404).send('No jpg frames available');
        }
        
        // Send the most recent frame
        const latestFrame = path.join(processedFramesDir, frameFiles[0]);
        res.sendFile(path.resolve(latestFrame));
    } catch (error) {
        console.error('Error getting latest possession frame:', error);
        res.status(500).send('Error retrieving latest frame');
    }
});

// Generate video endpoint
app.post('/generate-video', (req, res) => {
    try {
        console.log('Starting video generation process...');
        
        // Make sure the processed_frames directory exists
        if (!fs.existsSync('processed_frames')) {
            console.error('Error: processed_frames directory not found');
            return res.status(404).json({ error: 'processed_frames directory not found' });
        }
        
        // Count processed frames to make sure we have something to work with
        const frameCount = fs.readdirSync('processed_frames').filter(f => f.endsWith('.jpg')).length;
        console.log(`Found ${frameCount} frames in processed_frames directory`);
        
        if (frameCount === 0) {
            console.error('Error: No frames found in processed_frames directory');
            return res.status(404).json({ error: 'No frames found in processed_frames directory' });
        }
        
        // Spawn the generate_video.py script
        const generateProcess = spawn('python', ['generate_video.py'], {
            cwd: __dirname
        });
        
        let stdoutData = '';
        let stderrData = '';
        
        generateProcess.stdout.on('data', (data) => {
            stdoutData += data.toString();
            console.log(`Generate video output: ${data}`);
        });
        
        generateProcess.stderr.on('data', (data) => {
            stderrData += data.toString();
            console.error(`Generate video error: ${data}`);
        });
        
        generateProcess.on('close', (code) => {
            console.log(`Generate video process exited with code ${code}`);
            
            // Check if output file exists to confirm success
            const videoPath = path.join(__dirname, 'output_video.mp4');
            if (code === 0 && fs.existsSync(videoPath)) {
                console.log('Video generation completed successfully');
                res.json({ 
                    message: 'Video generation completed successfully',
                    video_path: '/download-video'
                });
            } else {
                console.error('Video generation failed:', stderrData);
                res.status(500).json({ 
                    error: 'Video generation failed', 
                    details: stderrData,
                    stdout: stdoutData
                });
            }
        });
    } catch (error) {
        console.error('Error generating video:', error);
        res.status(500).json({ error: error.message });
    }
});

// Download video endpoint
app.get('/download-video', (req, res) => {
    // Try multiple possible paths for the video file
    const possiblePaths = [
        path.join(__dirname, 'output_video.mp4'),          // Direct in current directory
        path.join(__dirname, 'processed_frames', 'output_video.mp4') // Another possibility
    ];
    
    console.log('Looking for video file in multiple locations...');
    
    // Try each path
    for (const videoPath of possiblePaths) {
        console.log('Checking path:', videoPath);
        if (fs.existsSync(videoPath)) {
            console.log('Video file found at:', videoPath);
            return res.download(videoPath);
        }
    }
    
    // If we get here, we couldn't find the file
    console.error('Error: Video file not found in any of the expected locations');
    return res.status(404).send('Video not found. Please try generating it again.');
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
