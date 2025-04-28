import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
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
    const [statusInterval, setStatusInterval] = useState(null);
    
    // Use our custom hook to check backend status but add option to force real backend
    const { isAvailable: backendAvailableStatus, isChecking: checkingBackend } = useBackendStatus();
    const [forceRealBackend, setForceRealBackend] = useState(true); // Force using real backend
    
    // Effective backend availability combines status and force flag
    const backendAvailable = backendAvailableStatus || forceRealBackend;

    const navigate = useNavigate();

    const handleProcessingComplete = useCallback(() => {
        if (statusInterval) {
            clearInterval(statusInterval);
            setStatusInterval(null);
        }
        
        setUploading(false);
        setIsProcessing(false);
        setProcessingProgress(100);
        setSnackbarMessage('Processing completed!');
        setShowSnackbar(true);
        setShowGenerateDialog(true);
        const audio = new Audio('/notification.mp3');
        audio.play().catch(e => console.log('Audio play failed:', e));
    }, [statusInterval]);

    const checkProcessingStatus = useCallback(async () => {
        try {
            const response = await axios.get(`${BACKEND_URL}/consumer-status`);
            console.log('Processing status:', response.data);
            
            // Extract data from response
            const { frames_processed, total_frames, completed } = response.data;
            
            // If we're in processing mode but getting no frames_processed, show indeterminate progress
            if (isProcessing && frames_processed === 0) {
                // Keep the indeterminate progress bar
                setProcessingProgress(0);
                console.log('Still waiting for frames to be processed...');
            }
            // Update UI when we get frame data
            else if (frames_processed > 0) {
                setIsProcessing(true);
                
                // When we have both frames_processed and total_frames, show accurate progress
                if (total_frames > 0) {
                    const progress = Math.min(100, Math.round((frames_processed / total_frames) * 100));
                    setProcessingProgress(progress);
                    
                    // Show message with detailed progress info - Add +1 to frames_processed for display since counting starts at 0
                    const progressMessage = `Processing: ${frames_processed+1}/${total_frames} frames (${progress}%)`;
                    setSnackbarMessage(progressMessage);
                    setShowSnackbar(true);
                } else {
                    // Just show processed frame count but no percentage
                    setSnackbarMessage(`Processing started: ${frames_processed} frames processed. Waiting for total frame count...`);
                    setShowSnackbar(true);
                }
                
                // Check if processing is complete
                if (completed || (total_frames > 0 && frames_processed+1 >= total_frames)) {
                    console.log('Processing completed!');
                    // Clear any existing intervals
                    if (statusInterval) {
                        clearInterval(statusInterval);
                        setStatusInterval(null);
                    }
                    
                    handleProcessingComplete();
                }
            }
        } catch (error) {
            console.error('Status check error:', error);
            // Don't stop checking if we hit a temporary error
            if (isProcessing) {
                console.log('Continuing to check status despite error...');
            }
        }
    }, [handleProcessingComplete, statusInterval, isProcessing]);

    useEffect(() => {
        // Clean up interval on unmount
        return () => {
            if (statusInterval) {
                clearInterval(statusInterval);
            }
        };
    }, [statusInterval]);

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

        try {
            // Clear any existing processing queue
            await axios.post(`${BACKEND_URL}/purge-queue`);
            console.log('Queue purged successfully');
           
            // Create form data with single file field
            const formData = new FormData();
            formData.append('video', file);
            
            console.log('Uploading file to:', `${BACKEND_URL}/upload`);
            console.log('File details:', {
                name: file.name,
                type: file.type,
                size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`
            });
           
            // Upload with progress tracking
            const response = await axios.post(`${BACKEND_URL}/upload`, formData, {
                onUploadProgress: (progressEvent) => {
                    const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(progress);
                    console.log(`Upload progress: ${progress}%`);
                },
            });
            
            console.log('Upload response:', response.data);
            setSuccess(true);
            setUploadComplete(true);
            setSnackbarMessage('Upload complete! Click "Start Analysis" to begin processing.');
            setShowSnackbar(true);
        } catch (uploadError) {
            console.error('Upload error:', uploadError);
            if (uploadError.response) {
                console.error('Error response:', {
                    data: uploadError.response.data,
                    status: uploadError.response.status,
                    headers: uploadError.response.headers
                });
                setError(`Upload failed (${uploadError.response.status}): ${uploadError.response.data.message || uploadError.response.data || 'Please try again.'}`);
            } else if (uploadError.request) {
                console.error('No response received:', uploadError.request);
                setError('No response from server. Please check if the backend is running.');
            } else {
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
            setProcessingProgress(0);
            setSnackbarMessage('Starting video analysis...');
            setShowSnackbar(true);
            
            // Start the consumer process for analysis
            console.log('Starting analysis...');
            await axios.post(`${BACKEND_URL}/start-analysis`);
            
            // Start checking processing status immediately
            checkProcessingStatus();
            
            // Set up polling interval for status updates
            const interval = setInterval(() => {
                checkProcessingStatus();
            }, 1000);
            
            // Store interval ID for cleanup
            setStatusInterval(interval);
            
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
            
            // Add loading state
            const generatingElement = document.getElementById('generateBtn');
            if (generatingElement) {
                generatingElement.disabled = true;
                generatingElement.textContent = 'Generating...';
            }
            
            console.log('Calling generate-video endpoint...');
            
            // Set a timeout for the request
            const response = await axios.post(`${BACKEND_URL}/generate-video`, {}, {
                timeout: 300000 // 5 minute timeout for video generation
            });
            
            console.log('Generate video response:', response.data);
            
            if (response.status === 200) {
                setSnackbarMessage('Video generated successfully! Redirecting to results...');
                setShowSnackbar(true);
                
                // Close the dialog
                setShowGenerateDialog(false);
                
                // Navigate to results page
                navigate('/results');
            } else {
                throw new Error(`Server responded with status code: ${response.status}`);
            }
        } catch (error) {
            console.error('Error generating video:', error);
            let errorMessage = 'Error generating video';
            
            if (error.response) {
                // Server responded with an error status code
                errorMessage = `Error: ${error.response.status} - ${error.response.data.error || 'Server error'}`;
                console.error('Error response data:', error.response.data);
            } else if (error.request) {
                // Request was made but no response received
                errorMessage = 'No response from server. The video might still be generating.';
            } else {
                // Error setting up the request
                errorMessage = `Request error: ${error.message}`;
            }
            
            setError(errorMessage);
            setSnackbarMessage(errorMessage);
            setShowSnackbar(true);
        } finally {
            // Reset button state
            const generatingElement = document.getElementById('generateBtn');
            if (generatingElement) {
                generatingElement.disabled = false;
                generatingElement.textContent = 'Generate Video';
            }
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
                                variant={processingProgress > 0 ? "determinate" : "indeterminate"}
                                value={processingProgress} 
                                className="rounded-full"
                                color="secondary"
                            />
                            <Typography variant="body2" align="center" className="text-gray-600 dark:text-gray-300">
                                {processingProgress > 0 
                                    ? `${processingProgress.toFixed(0)}% processed` 
                                    : "Processing starting... This may take a moment"}
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

            {/* Generate Video Dialog */}
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
                    <Button 
                        onClick={() => setShowGenerateDialog(false)}
                        variant="outlined"
                    >
                        Cancel
                    </Button>
                    <Button 
                        id="generateBtn"
                        onClick={handleGenerateVideo} 
                        variant="contained" 
                        color="primary"
                        startIcon={<VideoLibraryIcon />}
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
