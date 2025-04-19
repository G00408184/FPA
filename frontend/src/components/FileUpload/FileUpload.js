import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    LinearProgress,
    Alert,
    Snackbar,
    Box,
    Typography,
    styled
} from '@mui/material';
import {
    CloudUpload as CloudUploadIcon,
    VideoLibrary as VideoLibraryIcon,
    Cancel as CancelIcon,
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    PlayArrow as PlayArrowIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// Log the backend URL to help with debugging
console.log('Using backend URL:', BACKEND_URL);

// Check if backend is available every 10 seconds to handle reconnection scenarios
const useBackendStatus = () => {
    const [isAvailable, setIsAvailable] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    
    useEffect(() => {
        const checkAvailability = async () => {
            setIsChecking(true);
            try {
                // Try various endpoints to see if the backend is responsive
                try {
                    await axios.get(`${BACKEND_URL}/health`, { timeout: 3000 });
                    setIsAvailable(true);
                    return;
                } catch (healthError) {
                    console.log('Health endpoint failed, trying status...');
                }
                
                try {
                    await axios.get(`${BACKEND_URL}/status`, { timeout: 3000 });
                    setIsAvailable(true);
                    return;
                } catch (statusError) {
                    console.log('Status endpoint failed, trying root...');
                }
                
                // Last resort - just try to hit the root
                await axios.get(`${BACKEND_URL}`, { timeout: 3000 });
                setIsAvailable(true);
            } catch (error) {
                console.error('Backend connection error:', error);
                setIsAvailable(false);
            } finally {
                setIsChecking(false);
            }
        };
        
        // Initial check
        checkAvailability();
        
        // Set up periodic checking
        const interval = setInterval(checkAvailability, 10000);
        
        return () => clearInterval(interval);
    }, []);
    
    return { isAvailable, isChecking };
};

// Styled components for Material UI + Tailwind integration
const StyledButton = styled(Button)(({ theme }) => ({
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
    borderRadius: 8,
    fontWeight: 500,
}));

const VisuallyHiddenInput = styled('input')({
    clip: 'rect(0 0 0 0)',
    clipPath: 'inset(50%)',
    height: 1,
    overflow: 'hidden',
    position: 'absolute',
    bottom: 0,
    left: 0,
    whiteSpace: 'nowrap',
    width: 1,
});

const FileUpload = () => {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [processingProgress, setProcessingProgress] = useState(0);
    const [error, setError] = useState('');
    const [showSnackbar, setShowSnackbar] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [showGenerateDialog, setShowGenerateDialog] = useState(false);
    const [success, setSuccess] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadComplete, setUploadComplete] = useState(false);
    
    // Use our custom hook to check backend status but add option to force real backend
    const { isAvailable: backendAvailableStatus, isChecking: checkingBackend } = useBackendStatus();
    const [forceRealBackend, setForceRealBackend] = useState(true); // Force using real backend
    
    // Effective backend availability combines status and force flag
    const backendAvailable = backendAvailableStatus || forceRealBackend;

    const handleProcessingComplete = useCallback(() => {
        setUploading(false);
        setIsProcessing(false);
        setSnackbarMessage('Processing completed!');
        setShowSnackbar(true);
        setShowGenerateDialog(true);
        const audio = new Audio('/notification.mp3');
        audio.play().catch(e => console.log('Audio play failed:', e));
    }, []);

    const checkProcessingStatus = useCallback(async () => {
        try {
            const response = await axios.get(`${BACKEND_URL}/consumer-status`);
            const { frames_processed, total_frames, completed } = response.data;
           
            if (total_frames > 0) {
                setIsProcessing(true);
                const progress = (frames_processed / total_frames) * 100;
                setProcessingProgress(progress);
                setSnackbarMessage(`Processing: ${frames_processed}/${total_frames} frames`);
                setShowSnackbar(true);
               
                if (completed) {
                    handleProcessingComplete();
                } else {
                    setTimeout(checkProcessingStatus, 1000);
                }
            }
        } catch (error) {
            console.error('Status check error:', error);
            setTimeout(checkProcessingStatus, 1000);
        }
    }, [handleProcessingComplete]);

    useEffect(() => {
        // Only check processing status if we're actively processing
        if (isProcessing) {
            const intervalId = setInterval(() => {
                checkProcessingStatus();
            }, 3000);
            
            // Clean up the interval when component unmounts or processing stops
            return () => clearInterval(intervalId);
        }
    }, [checkProcessingStatus, isProcessing]);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile && selectedFile.type.startsWith('video/')) {
            setFile(selectedFile);
            setError('');
            setSnackbarMessage(`File selected: ${selectedFile.name}`);
            setShowSnackbar(true);
            setUploadComplete(false);
        } else {
            setError('Please select a valid video file');
            setFile(null);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        setError('');
        setSuccess(false);
        setUploadComplete(false);
        setSnackbarMessage('Starting upload...');
        setShowSnackbar(true);
        setUploadProgress(0);
        setProcessingProgress(0);

        // If backend is not available and not forcing real backend, simulate upload
        if (!backendAvailable) {
            console.log('Backend not available, simulating upload...');
            
            // Simulate upload progress
            let progress = 0;
            const interval = setInterval(() => {
                progress += 10;
                setUploadProgress(progress);
                
                if (progress >= 100) {
                    clearInterval(interval);
                    setSuccess(true);
                    setUploadComplete(true);
                    setSnackbarMessage('Upload complete! Click "Start Analysis" to begin processing.');
                    setShowSnackbar(true);
                    setUploading(false);
                }
            }, 500);
            
            return;
        }

        try {
            // Clear any existing processing queue
            try {
                await axios.post(`${BACKEND_URL}/purge-queue`);
                console.log('Queue purged successfully');
            } catch (purgeError) {
                console.log('Queue purge failed, continuing with upload:', purgeError);
            }
           
            // Create form data with single file field - the backend expects 'video'
            const formData = new FormData();
            formData.append('video', file);
            
            console.log('Uploading file to:', `${BACKEND_URL}/upload`);
            console.log('File details:', {
                name: file.name,
                type: file.type,
                size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`
            });
           
            // Upload the file to the server
            const response = await axios.post(`${BACKEND_URL}/upload`, formData, {
                onUploadProgress: (progressEvent) => {
                    const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(progress);
                    console.log(`Upload progress: ${progress}%`);
                },
            });
            
            console.log('Upload response:', response.data);

            // File is uploaded, now start the producer
            try {
                console.log('Starting producer...');
                await axios.post(`${BACKEND_URL}/start-producer`);
                console.log('Producer started successfully');
            } catch (producerError) {
                console.error('Producer start error:', producerError);
                setError(`Upload complete, but failed to start producer: ${producerError.message}`);
                setSnackbarMessage('Upload complete, but failed to start producer. You can try manually starting the analysis.');
                setShowSnackbar(true);
                // Still mark upload as complete so user can try analysis
            }

            setSuccess(true);
            setUploadComplete(true);
            setSnackbarMessage('Upload complete and producer started! Click "Start Analysis" to begin processing.');
            setShowSnackbar(true);
        } catch (uploadError) {
            console.error('Upload error:', uploadError);
            if (uploadError.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                console.error('Error response:', {
                    data: uploadError.response.data,
                    status: uploadError.response.status,
                    headers: uploadError.response.headers
                });
                setError(`Upload failed (${uploadError.response.status}): ${uploadError.response.data.message || uploadError.response.data || 'Please try again.'}`);
            } else if (uploadError.request) {
                // The request was made but no response was received
                console.error('No response received:', uploadError.request);
                setError('No response from server. Please check if the backend is running.');
            } else {
                // Something happened in setting up the request that triggered an Error
                console.error('Request setup error:', uploadError.message);
                setError(`Upload failed: ${uploadError.message}`);
            }
            setSnackbarMessage('Upload failed. Please check console for details.');
            setShowSnackbar(true);
        } finally {
            setUploading(false);
        }
    };

    const handleStartProcessing = async () => {
        try {
            setIsProcessing(true);
            setSnackbarMessage('Starting video analysis...');
            setShowSnackbar(true);
            
            // If backend is not available and not forcing real backend, simulate processing
            if (!backendAvailable) {
                console.log('Backend not available, simulating processing...');
                
                // Simulate processing progress
                let progress = 0;
                const interval = setInterval(() => {
                    progress += 5;
                    setProcessingProgress(progress);
                    
                    if (progress >= 100) {
                        clearInterval(interval);
                        setIsProcessing(false);
                        setShowGenerateDialog(true);
                        setSnackbarMessage('Processing completed! (SIMULATED)');
                        setShowSnackbar(true);
                    }
                }, 800);
                
                // Clear file reference to prevent duplicate processing
                setFile(null);
                setUploadComplete(false);
                return;
            }
            
            // Only start the consumer - producer already started during upload
            console.log('Starting consumer...');
            await axios.post(`${BACKEND_URL}/start-consumer`);
            
            // Start checking processing status
            console.log('Checking processing status...');
            checkProcessingStatus();
            
            // Clear file reference to prevent duplicate processing
            setFile(null);
            setUploadComplete(false);
        } catch (processingError) {
            console.error('Processing error:', processingError);
            setError(`Error starting video processing: ${processingError.message}`);
            setSnackbarMessage('Error starting video processing. Please check console for details.');
            setShowSnackbar(true);
            setIsProcessing(false);
        }
    };

    const handleGenerateVideo = async () => {
        try {
            setSnackbarMessage('Generating final video...');
            setShowSnackbar(true);
            
            // If backend is not available, simulate video generation
            if (!backendAvailable) {
                console.log('Backend not available, simulating video generation...');
                setTimeout(() => {
                    setSnackbarMessage('Video processing complete! (SIMULATED)');
                    setShowSnackbar(true);
                    setShowGenerateDialog(false);
                }, 2000);
                return;
            }
            
            // Call the generate-video endpoint
            const response = await axios.post(`${BACKEND_URL}/generate-video`);
            console.log('Generate video response:', response.data);
            
            // Check if the video is being generated successfully
            if (response.data && response.data.success) {
                setSnackbarMessage('Video generation in progress... Preparing download.');
                setShowSnackbar(true);
                
                // Poll for video generation status (simplified approach)
                let checkCount = 0;
                const maxChecks = 30; // Maximum 30 checks (30 seconds)
                
                const checkVideoStatus = async () => {
                    try {
                        checkCount++;
                        // Try to fetch a small chunk of the video to see if it exists
                        const videoCheckResponse = await axios.head(`${BACKEND_URL}/output-video-status`);
                        
                        if (videoCheckResponse.status === 200) {
                            console.log('Video is ready for download');
                            // Video is ready, redirect to download
                            window.location.href = `${BACKEND_URL}/download-video`;
                            setSnackbarMessage('Video processing complete! Download starting...');
                            setShowSnackbar(true);
                            setShowGenerateDialog(false);
                            return;
                        }
                    } catch (error) {
                        console.log(`Video not ready yet (check ${checkCount}/${maxChecks})`);
                        if (checkCount < maxChecks) {
                            setTimeout(checkVideoStatus, 1000); // Check again in 1 second
                        } else {
                            // If we've checked too many times, show a direct link
                            setSnackbarMessage('Video generation taking longer than expected. Click to download when ready.');
                            setShowSnackbar(true);
                            
                            // Show a button to manually download
                            const downloadLink = document.createElement('a');
                            downloadLink.href = `${BACKEND_URL}/download-video`;
                            downloadLink.target = '_blank';
                            downloadLink.innerText = 'Download Video';
                            document.body.appendChild(downloadLink);
                            downloadLink.click();
                            document.body.removeChild(downloadLink);
                            
                            setShowGenerateDialog(false);
                        }
                    }
                };
                
                // Start checking for video status
                setTimeout(checkVideoStatus, 2000); // Give it a couple seconds to start generating
            } else {
                // Fallback direct approach if response doesn't have expected format
                window.location.href = `${BACKEND_URL}/download-video`;
                setSnackbarMessage('Video processing complete! Download starting...');
                setShowSnackbar(true);
                setShowGenerateDialog(false);
            }
        } catch (error) {
            console.error('Video generation error:', error);
            
            // Even if there's an error, try to download anyway
            try {
                window.location.href = `${BACKEND_URL}/download-video`;
                setSnackbarMessage('Attempting download despite errors...');
            } catch (downloadError) {
                setError('Error generating and downloading video');
                setSnackbarMessage('Error generating video. Please try again or check server logs.');
            }
            
            setShowSnackbar(true);
        }
    };

    const handleCancelUpload = () => {
        setUploading(false);
        setSnackbarMessage('Upload cancelled');
        setShowSnackbar(true);
    };

    const handleCloseSnackbar = () => {
        setShowSnackbar(false);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
        >
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-center space-y-4"
            >
                <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="inline-block p-4 rounded-full bg-blue-600/20 dark:bg-blue-900/20"
                >
                    <VideoLibraryIcon className="text-6xl text-blue-600 dark:text-blue-400" />
                </motion.div>
                <Typography variant="h4" component="h2" className="font-bold">
                    Upload Your Match Video
                </Typography>
                <Typography variant="body1" className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                    Select a video file to analyze player movements and team performance
                </Typography>
            </motion.div>

            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 space-y-6"
            >
                {!backendAvailableStatus && (
                    <Box className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                        <div className="flex flex-col items-center">
                            <Typography variant="body2" className="text-yellow-800 dark:text-yellow-200 mb-2">
                                Backend connection issue detected. Choose mode:
                            </Typography>
                            <div className="flex space-x-4">
                                <Button 
                                    variant={forceRealBackend ? "contained" : "outlined"}
                                    color="primary"
                                    size="small"
                                    onClick={() => setForceRealBackend(true)}
                                >
                                    Use Real Backend
                                </Button>
                                <Button 
                                    variant={!forceRealBackend ? "contained" : "outlined"}
                                    color="secondary"
                                    size="small"
                                    onClick={() => setForceRealBackend(false)}
                                >
                                    Simulation Mode
                                </Button>
                            </div>
                        </div>
                    </Box>
                )}
                
                {backendAvailable && (
                    <Box className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                        <Typography variant="body2" align="center" className="text-green-800 dark:text-green-200">
                            {backendAvailableStatus 
                                ? `Connected to backend server at: ${BACKEND_URL}` 
                                : `Using real backend at: ${BACKEND_URL} (forced)`}
                        </Typography>
                    </Box>
                )}
                
                {checkingBackend && (
                    <Box className="mb-4 p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex justify-center">
                        <LinearProgress 
                            className="w-full max-w-md rounded-full" 
                            color="primary" 
                        />
                    </Box>
                )}
                
                <Box className="flex flex-col items-center space-y-6">
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        className="p-4 rounded-full bg-blue-600/10 dark:bg-blue-900/20"
                    >
                        <CloudUploadIcon className="text-4xl text-blue-600 dark:text-blue-400" />
                    </motion.div>

                    {file ? (
                        <Box className="w-full max-w-md">
                            <Box className="flex justify-between items-center">
                                <Typography variant="body2" className="truncate max-w-[250px]">
                                    {file.name}
                                </Typography>
                                <Typography variant="body2" color="textSecondary">
                                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                                </Typography>
                            </Box>
                        </Box>
                    ) : (
                        <StyledButton
                            component="label"
                            variant="outlined"
                            startIcon={<CloudUploadIcon />}
                            className="w-full max-w-md"
                        >
                            Choose video file
                            <VisuallyHiddenInput 
                                type="file" 
                                accept="video/*"
                                onChange={handleFileChange}
                            />
                        </StyledButton>
                    )}

                    {error && (
                        <Box className="flex items-center space-x-2 text-red-500">
                            <ErrorIcon />
                            <Typography>{error}</Typography>
                        </Box>
                    )}

                    {uploading && (
                        <Box className="w-full max-w-md space-y-2">
                            <Typography variant="body2" align="center" className="text-gray-600 dark:text-gray-300">
                                Upload Progress
                            </Typography>
                            <LinearProgress 
                                variant="determinate" 
                                value={uploadProgress} 
                                className="rounded-full"
                            />
                            <Typography variant="body2" align="center" className="text-gray-600 dark:text-gray-300">
                                {uploadProgress}% uploaded
                            </Typography>
                            <StyledButton
                                variant="outlined"
                                color="error"
                                onClick={handleCancelUpload}
                                startIcon={<CancelIcon />}
                                fullWidth
                            >
                                Cancel
                            </StyledButton>
                        </Box>
                    )}

                    {isProcessing && (
                        <Box className="w-full max-w-md space-y-2">
                            <Typography variant="body2" align="center" className="text-gray-600 dark:text-gray-300">
                                Processing Progress
                            </Typography>
                            <LinearProgress 
                                variant="determinate" 
                                value={processingProgress} 
                                className="rounded-full"
                                color="secondary"
                            />
                            <Typography variant="body2" align="center" className="text-gray-600 dark:text-gray-300">
                                {processingProgress.toFixed(0)}% processed
                            </Typography>
                        </Box>
                    )}

                    {!uploading && !isProcessing && !file && !uploadComplete && (
                        <Typography variant="body2" align="center" className="text-gray-500 dark:text-gray-400 italic">
                            Select a video file to start analysis
                        </Typography>
                    )}

                    {/* Buttons Container */}
                    <Box className="w-full max-w-md space-y-3">
                        {!uploading && !isProcessing && file && (
                            <StyledButton
                                variant="contained"
                                color="primary"
                                onClick={handleUpload}
                                startIcon={<CloudUploadIcon />}
                                fullWidth
                            >
                                Upload Video
                            </StyledButton>
                        )}

                        {uploadComplete && !isProcessing && (
                            <StyledButton
                                variant="contained"
                                color="secondary"
                                onClick={handleStartProcessing}
                                startIcon={<PlayArrowIcon />}
                                fullWidth
                                className="mt-4"
                            >
                                Start Analysis
                            </StyledButton>
                        )}
                    </Box>

                    {success && !uploadComplete && (
                        <Box className="flex items-center space-x-2 text-green-500">
                            <CheckCircleIcon />
                            <Typography>Upload successful!</Typography>
                        </Box>
                    )}
                </Box>
            </motion.div>

            <Dialog 
                open={showGenerateDialog} 
                onClose={() => setShowGenerateDialog(false)}
                PaperProps={{
                    className: "rounded-xl overflow-hidden"
                }}
            >
                <DialogTitle className="bg-blue-500 text-white">
                    Processing Complete
                </DialogTitle>
                <DialogContent className="py-4">
                    <Typography>
                        Your video has been processed successfully. Would you like to generate the analysis video?
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowGenerateDialog(false)}>Cancel</Button>
                    <Button 
                        onClick={handleGenerateVideo} 
                        variant="contained" 
                        color="primary"
                        startIcon={<CloudUploadIcon />}
                    >
                        Generate Video
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={showSnackbar}
                autoHideDuration={6000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert 
                    onClose={handleCloseSnackbar} 
                    severity={error ? "error" : success ? "success" : "info"}
                    sx={{ width: '100%' }}
                    variant="filled"
                >
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </motion.div>
    );
};

export default FileUpload;
