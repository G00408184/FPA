import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Box, 
    Button, 
    LinearProgress, 
    Typography, 
    Card,
    CardContent,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Alert,
    Snackbar
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const FileUpload = () => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [processingProgress, setProcessingProgress] = useState(0);
    const [error, setError] = useState('');
    const [status, setStatus] = useState('');
    const [videoReady, setVideoReady] = useState(false);
    const [showSnackbar, setShowSnackbar] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [showGenerateDialog, setShowGenerateDialog] = useState(false);
    const [isProcessingComplete, setIsProcessingComplete] = useState(false);

    useEffect(() => {
        // Check if there's an ongoing processing when component mounts
        checkProcessingStatus();
    }, []);

    const checkProcessingStatus = async () => {
        try {
            const response = await axios.get(`${BACKEND_URL}/consumer-status`);
            const { frames_processed, total_frames, completed } = response.data;
            
            if (total_frames > 0) {
                setUploading(true);
                const progress = (frames_processed / total_frames) * 100;
                setProcessingProgress(progress);
                setStatus(`Processing: ${frames_processed}/${total_frames} frames`);

                if (completed) {
                    handleProcessingComplete();
                } else {
                    // Continue polling
                    setTimeout(checkProcessingStatus, 1000);
                }
            }
        } catch (error) {
            console.error('Status check error:', error);
            setTimeout(checkProcessingStatus, 1000);
        }
    };

    const handleProcessingComplete = () => {
        setIsProcessingComplete(true);
        setUploading(false);
        setStatus('Processing completed!');
        setShowGenerateDialog(true);
        // Play a notification sound
        const audio = new Audio('/notification.mp3'); // Add a notification sound file to your public folder
        audio.play().catch(e => console.log('Audio play failed:', e));
    };

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (file && file.type.startsWith('video/')) {
            setSelectedFile(file);
            setError('');
            setVideoReady(false);
        } else {
            setError('Please select a valid video file');
            setSelectedFile(null);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        setUploading(true);
        setError('');
        setStatus('Starting upload...');
        setVideoReady(false);
        setUploadProgress(0);
        setProcessingProgress(0);
        setIsProcessingComplete(false);

        try {
            // Purge queue before starting
            await axios.post(`${BACKEND_URL}/purge-queue`);
            
            const formData = new FormData();
            formData.append('video', selectedFile);
            
            await axios.post(`${BACKEND_URL}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    const progress = (progressEvent.loaded / progressEvent.total * 100);
                    setUploadProgress(progress);
                },
            });

            setStatus('Upload complete. Starting processing...');
            
            await axios.post(`${BACKEND_URL}/start-producer`);
            await axios.post(`${BACKEND_URL}/start-consumer`);
            
            checkProcessingStatus();

        } catch (error) {
            console.error('Upload/Processing error:', error);
            setError(error.response?.data?.error || 'Upload failed. Please try again.');
            setUploading(false);
        }
    };

    const handleGenerateVideo = async () => {
        try {
            setStatus('Generating final video...');
            await axios.post(`${BACKEND_URL}/generate-video`);
            window.location.href = `${BACKEND_URL}/download-video`;
            setStatus('Video processing complete!');
            setShowGenerateDialog(false);
        } catch (error) {
            setError('Error generating video');
            console.error('Video generation error:', error);
        }
    };

    const handleCancelProcessing = async () => {
        try {
            await axios.post(`${BACKEND_URL}/cancel-processing`);
            setUploading(false);
            setUploadProgress(0);
            setProcessingProgress(0);
            setStatus('Processing cancelled');
            setSnackbarMessage('Processing cancelled successfully');
            setShowSnackbar(true);
        } catch (error) {
            console.error('Cancel error:', error);
            setError('Failed to cancel processing');
        }
    };

    return (
        <Box sx={{ maxWidth: 600, margin: '0 auto' }}>
            <Card elevation={3} sx={{ mb: 3, bgcolor: 'background.paper' }}>
                <CardContent>
                    <Typography variant="h5" gutterBottom align="center">
                        Video Analysis
                    </Typography>

                    <Box sx={{ textAlign: 'center', mb: 3 }}>
                        <input
                            type="file"
                            accept="video/*"
                            onChange={handleFileSelect}
                            style={{ display: 'none' }}
                            id="video-upload-input"
                        />
                        <label htmlFor="video-upload-input">
                            <Button
                                variant="contained"
                                component="span"
                                startIcon={<CloudUploadIcon />}
                                disabled={uploading}
                                sx={{ mb: 2 }}
                            >
                                Select Video
                            </Button>
                        </label>

                        {selectedFile && (
                            <Typography variant="body2" color="textSecondary">
                                Selected file: {selectedFile.name}
                            </Typography>
                        )}
                    </Box>

                    {selectedFile && !uploading && (
                        <Box sx={{ textAlign: 'center' }}>
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={handleUpload}
                                disabled={uploading}
                            >
                                Upload and Process
                            </Button>
                        </Box>
                    )}

                    {uploading && (
                        <Box sx={{ mt: 3 }}>
                            <Typography variant="body2" gutterBottom>
                                Upload Progress:
                            </Typography>
                            <LinearProgress 
                                variant="determinate" 
                                value={uploadProgress} 
                                sx={{ mb: 2, height: 8, borderRadius: 2 }}
                            />

                            <Typography variant="body2" gutterBottom>
                                Processing Progress:
                            </Typography>
                            <LinearProgress 
                                variant="determinate" 
                                value={processingProgress} 
                                sx={{ mb: 2, height: 8, borderRadius: 2 }}
                            />

                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}>
                                <Typography variant="body2" align="center">
                                    {status}
                                </Typography>
                                <Button
                                    variant="contained"
                                    color="error"
                                    startIcon={<CancelIcon />}
                                    onClick={handleCancelProcessing}
                                    sx={{ ml: 2 }}
                                >
                                    Cancel Processing
                                </Button>
                            </Box>
                        </Box>
                    )}

                    {error && (
                        <Typography color="error" align="center" sx={{ mt: 2 }}>
                            {error}
                        </Typography>
                    )}
                </CardContent>
            </Card>

            {/* Completion Dialog */}
            <Dialog
                open={showGenerateDialog}
                onClose={() => setShowGenerateDialog(false)}
            >
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircleIcon color="success" />
                    Processing Complete
                </DialogTitle>
                <DialogContent>
                    <Typography>
                        Video processing has been completed successfully. Would you like to generate and download the processed video?
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowGenerateDialog(false)}>
                        Not Now
                    </Button>
                    <Button 
                        onClick={handleGenerateVideo}
                        variant="contained" 
                        color="primary"
                        startIcon={<DownloadIcon />}
                    >
                        Generate and Download Video
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={showSnackbar}
                autoHideDuration={6000}
                onClose={() => setShowSnackbar(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setShowSnackbar(false)} severity="info" sx={{ width: '100%' }}>
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default FileUpload;