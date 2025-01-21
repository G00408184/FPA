import React, { useState } from 'react';
import axios from 'axios';
import { 
    Box, 
    Button, 
    LinearProgress, 
    Typography, 
    Paper,
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
import WarningIcon from '@mui/icons-material/Warning';
import CancelIcon from '@mui/icons-material/Cancel';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const FileUpload = () => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [processingProgress, setProcessingProgress] = useState(0);
    const [error, setError] = useState('');
    const [status, setStatus] = useState('');
    const [videoReady, setVideoReady] = useState(false);
    const [showWarning, setShowWarning] = useState(false);
    const [showSnackbar, setShowSnackbar] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);

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

    const pollProcessingStatus = async () => {
        try {
            const response = await axios.get(`${BACKEND_URL}/consumer-status`);
            const { frames_processed, total_frames, completed } = response.data;
            
            if (total_frames > 0) {
                const progress = (frames_processed / total_frames) * 100;
                setProcessingProgress(progress);
                setStatus(`Processing: ${frames_processed}/${total_frames} frames`);
            }

            if (!completed) {
                setTimeout(pollProcessingStatus, 1000);
            } else {
                setStatus('Processing completed! Generating final video...');
                // Automatically start video reconstruction
                await handleGenerateVideo();
            }
        } catch (error) {
            console.error('Status polling error:', error);
            setTimeout(pollProcessingStatus, 1000);
        }
    };

    const handleCancelProcessing = async () => {
        try {
            // Call backend to stop processing and clean up
            await axios.post(`${BACKEND_URL}/cancel-processing`);
            
            setUploading(false);
            setUploadProgress(0);
            setProcessingProgress(0);
            setStatus('Processing cancelled');
            setShowCancelConfirm(false);
            setSnackbarMessage('Processing cancelled successfully');
            setShowSnackbar(true);
        } catch (error) {
            console.error('Cancel error:', error);
            setError('Failed to cancel processing');
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        setShowWarning(false);
        setUploading(true);
        setError('');
        setStatus('Starting upload...');
        setVideoReady(false);
        setUploadProgress(0);
        setProcessingProgress(0);

        try {
            // Purge queue before starting
            await axios.post(`${BACKEND_URL}/purge-queue`);
            
            // Upload file
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
            
            // Start processing
            await axios.post(`${BACKEND_URL}/start-producer`);
            await axios.post(`${BACKEND_URL}/start-consumer`);
            
            // Start polling for progress
            pollProcessingStatus();

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
            setStatus('Video processing complete!');
            setVideoReady(true);
            setUploading(false);
            setSnackbarMessage('Processing complete! You can now download your video.');
            setShowSnackbar(true);
        } catch (error) {
            setError('Error generating video');
            console.error('Video generation error:', error);
        }
    };

    const handleStartUpload = () => {
        setShowWarning(true);
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
                                onClick={handleStartUpload}
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
                                    onClick={() => setShowCancelConfirm(true)}
                                    sx={{ ml: 2 }}
                                >
                                    Cancel Processing
                                </Button>
                            </Box>
                        </Box>
                    )}

                    {videoReady && (
                        <Box sx={{ textAlign: 'center', mt: 2 }}>
                            <Button
                                variant="contained"
                                color="success"
                                onClick={() => window.location.href = `${BACKEND_URL}/download-video`}
                                startIcon={<DownloadIcon />}
                            >
                                Download Processed Video
                            </Button>
                        </Box>
                    )}

                    {error && (
                        <Typography color="error" align="center" sx={{ mt: 2 }}>
                            {error}
                        </Typography>
                    )}
                </CardContent>
            </Card>

            {/* Warning Dialog */}
            <Dialog open={showWarning} onClose={() => setShowWarning(false)}>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningIcon color="warning" />
                    Important Notice
                </DialogTitle>
                <DialogContent>
                    <Typography>
                        Please do not close this tab or navigate away while the video is being processed. 
                        This process may take several minutes depending on the video length.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowWarning(false)}>Cancel</Button>
                    <Button onClick={handleUpload} variant="contained" color="primary">
                        Proceed
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Cancel Confirmation Dialog */}
            <Dialog
                open={showCancelConfirm}
                onClose={() => setShowCancelConfirm(false)}
            >
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningIcon color="error" />
                    Cancel Processing?
                </DialogTitle>
                <DialogContent>
                    <Typography>
                        This will stop all processing and delete all processed frames. 
                        This action cannot be undone. Are you sure you want to continue?
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowCancelConfirm(false)}>
                        No, Continue Processing
                    </Button>
                    <Button 
                        onClick={handleCancelProcessing}
                        variant="contained" 
                        color="error"
                    >
                        Yes, Cancel Processing
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Status Snackbar */}
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