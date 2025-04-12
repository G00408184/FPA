import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Box,
    Button,
    Card,
    CardContent,
    Typography,
    LinearProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Snackbar,
    Alert
} from '@mui/material';
import {
    CloudUpload as CloudUploadIcon,
    Cancel as CancelIcon,
    CheckCircle as CheckCircleIcon,
    Download as DownloadIcon
} from '@mui/icons-material';
 
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
        const audio = new Audio('/notification.mp3');
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
            setStatus('Processing cancelled');
        } catch (error) {
            console.error('Cancel processing error:', error);
            setError('Failed to cancel processing');
        }
    };
 
    return (
        <div className="max-w-3xl mx-auto p-4">
            <Card elevation={3} className="mb-6 bg-white rounded-lg shadow-lg overflow-hidden">
                <CardContent className="p-6">
                    <Typography variant="h5" className="text-center font-bold text-gray-800 mb-6">
                        Football Player Analysis
                    </Typography>
 
                    <div className="text-center mb-6">
                        <input
                            type="file"
                            accept="video/*"
                            onChange={handleFileSelect}
                            className="hidden"
                            id="video-upload-input"
                        />
                        <label htmlFor="video-upload-input">
                            <Button
                                variant="contained"
                                component="span"
                                startIcon={<CloudUploadIcon />}
                                disabled={uploading}
                                className="mb-4 bg-primary-600 hover:bg-primary-700 transition-all duration-300"
                                sx={{ mb: 2 }}
                            >
                                Select Video
                            </Button>
                        </label>
 
                        {selectedFile && (
                            <Typography variant="body2" className="text-gray-600 italic">
                                Selected file: {selectedFile.name}
                            </Typography>
                        )}
                    </div>
 
                    {selectedFile && !uploading && (
                        <div className="text-center">
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={handleUpload}
                                disabled={uploading}
                                className="bg-primary-600 hover:bg-primary-700 transition-all duration-300 px-6 py-2"
                            >
                                Upload and Process
                            </Button>
                        </div>
                    )}
 
                    {uploading && (
                        <div className="mt-6 space-y-4">
                            <div>
                                <Typography variant="body2" className="font-medium text-gray-700 mb-1">
                                    Upload Progress:
                                </Typography>
                                <LinearProgress
                                    variant="determinate"
                                    value={uploadProgress}
                                    className="h-2 rounded-full"
                                    sx={{ mb: 2, height: 8, borderRadius: 2 }}
                                />
                            </div>
 
                            <div>
                                <Typography variant="body2" className="font-medium text-gray-700 mb-1">
                                    Processing Progress:
                                </Typography>
                                <LinearProgress
                                    variant="determinate"
                                    value={processingProgress}
                                    className="h-2 rounded-full"
                                    sx={{ mb: 2, height: 8, borderRadius: 2 }}
                                />
                            </div>
 
                            <div className="flex justify-center items-center gap-4 mt-4">
                                <div className="text-center text-gray-700 font-medium">
                                    {status}
                                </div>
                                <Button
                                    variant="contained"
                                    color="error"
                                    startIcon={<CancelIcon />}
                                    onClick={handleCancelProcessing}
                                    className="bg-red-600 hover:bg-red-700"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}
 
                    {error && (
                        <Typography className="text-center text-red-600 mt-4 font-medium">
                            {error}
                        </Typography>
                    )}
                </CardContent>
            </Card>
 
            {/* Completion Dialog */}
            <Dialog
                open={showGenerateDialog}
                onClose={() => setShowGenerateDialog(false)}
                PaperProps={{
                    className: "rounded-lg"
                }}
            >
                <DialogTitle className="flex items-center gap-2 bg-green-50 text-green-800 py-4">
                    <CheckCircleIcon className="text-green-600" />
                    Processing Complete
                </DialogTitle>
                <DialogContent className="py-6">
                    <Typography className="text-gray-700">
                        Video processing has been completed successfully. Would you like to generate and download the processed video?
                    </Typography>
                </DialogContent>
                <DialogActions className="p-4">
                    <Button 
                        onClick={() => setShowGenerateDialog(false)}
                        className="text-gray-700 hover:bg-gray-100"
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<DownloadIcon />}
                        onClick={handleGenerateVideo}
                        className="bg-primary-600 hover:bg-primary-700"
                    >
                        Generate & Download
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
};
 
export default FileUpload;
