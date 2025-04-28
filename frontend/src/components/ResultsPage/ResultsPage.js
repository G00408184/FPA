import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  CircularProgress, 
  Button
} from '@mui/material';
import { motion } from 'framer-motion';
import { styled } from '@mui/material/styles';
import { 
    PieChart, 
    Pie, 
    Cell, 
    ResponsiveContainer, 
    Tooltip, 
    Legend 
} from 'recharts';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const StyledPaper = styled(Paper)(({ theme }) => ({
    padding: theme.spacing(4),
    borderRadius: theme.spacing(2),
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    overflow: 'hidden',
    transition: 'transform 0.3s, box-shadow 0.3s',
    '&:hover': {
        transform: 'translateY(-5px)',
        boxShadow: '0 6px 25px rgba(0,0,0,0.15)',
    },
}));

const StyledButton = styled(Button)(({ theme }) => ({
    borderRadius: theme.spacing(1.5),
    padding: '10px 20px',
    fontSize: '1rem',
    fontWeight: 500,
    textTransform: 'none',
    boxShadow: 'none',
    '&:hover': {
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    }
}));

const ResultsPage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [lastFrameUrl, setLastFrameUrl] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setIsLoading(true);
        // Fetch the status data which contains possession statistics
        const statusResponse = await axios.get(`${BACKEND_URL}/status`);
        setResults(statusResponse.data);

        // Get the last frame for display
        const lastFrameResponse = await axios.get(`${BACKEND_URL}/last-frame`);
        setLastFrameUrl(lastFrameResponse.data.url);
        
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching results:', err);
        setError('Failed to load analysis results. Please try again.');
        setIsLoading(false);
      }
    };

    fetchResults();
  }, []);

  // Prepare the data for the possession pie chart
  const preparePossessionData = () => {
    if (!results || !results.team_stats) return [];

    return [
      { 
        name: 'Team 1', 
        value: results.team_stats.final_possession.team1,
        color: '#C00000' // Dark blue (BGR in OpenCV is Blue)
      },
      { 
        name: 'Team 2', 
        value: results.team_stats.final_possession.team2,
        color: '#FF8C00' // Orange (BGR in OpenCV is Orange)
      }
    ];
  };

  const handleBackToUpload = () => {
    navigate('/');
  };

  const handleDownloadVideo = () => {
    window.location.href = `${BACKEND_URL}/download-video`;
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ textAlign: 'center', p: 4 }}>
        <Typography variant="h5" color="error" gutterBottom>
          {error}
        </Typography>
        <StyledButton 
          variant="contained" 
          color="primary" 
          onClick={handleBackToUpload}
        >
          Back to Upload
        </StyledButton>
      </Box>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 4, textAlign: 'center', fontWeight: 'bold' }}>
          Football Analysis Results
        </Typography>

        <Grid container spacing={4}>
          {/* Possession Statistics */}
          <Grid item xs={12} md={6}>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <StyledPaper>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                  Ball Possession Analysis
                </Typography>
                
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={preparePossessionData()}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {preparePossessionData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value) => [`${value.toFixed(1)}%`, 'Possession']}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
                
                <Box sx={{ mt: 3, textAlign: 'center' }}>
                  <Typography variant="h6">
                    Total Frames Analyzed: {results?.frames_processed || 0}
                  </Typography>
                </Box>
              </StyledPaper>
            </motion.div>
          </Grid>

          {/* Last Frame Preview */}
          <Grid item xs={12} md={6}>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <StyledPaper>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                  Final Frame Preview
                </Typography>
                
                <Box 
                  sx={{ 
                    mt: 2, 
                    display: 'flex', 
                    justifyContent: 'center',
                    borderRadius: 2,
                    overflow: 'hidden',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                  }}
                >
                  {lastFrameUrl ? (
                    <img 
                      src={lastFrameUrl} 
                      alt="Final analyzed frame" 
                      style={{ maxWidth: '100%', borderRadius: '8px' }}
                    />
                  ) : (
                    <Typography>No preview available</Typography>
                  )}
                </Box>
              </StyledPaper>
            </motion.div>
          </Grid>
        </Grid>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, gap: 2 }}>
          <StyledButton 
            variant="outlined" 
            color="primary" 
            onClick={handleBackToUpload}
          >
            Back to Upload
          </StyledButton>
          <StyledButton 
            variant="contained" 
            color="primary" 
            onClick={handleDownloadVideo}
          >
            Download Analysis Video
          </StyledButton>
        </Box>
      </Box>
    </motion.div>
  );
};

export default ResultsPage; 