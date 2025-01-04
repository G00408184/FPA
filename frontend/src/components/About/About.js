import React from 'react';
import { Box, Typography, Paper, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const About = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom align="center" sx={{ mb: 4 }}>
        About Football Performance Analyzer
      </Typography>

      <Paper elevation={0} sx={{ p: 3 }}>
        <Typography variant="body1" paragraph>
          Football Performance Analyzer is an advanced tool that uses AI to help coaches and analysts better understand player movements and team dynamics during matches.
        </Typography>

        <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
          Key Features:
        </Typography>

        <List>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="primary" />
            </ListItemIcon>
            <ListItemText 
              primary="AI Player Detection" 
              secondary="Advanced machine learning models to detect players on the field"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="primary" />
            </ListItemIcon>
            <ListItemText 
              primary="Team Color Detection" 
              secondary="Automatic identification of team colors and player assignments"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="primary" />
            </ListItemIcon>
            <ListItemText 
              primary="Real-time Processing" 
              secondary="Fast and efficient video processing with parallel computing"
            />
          </ListItem>
        </List>
      </Paper>
    </Box>
  );
};

export default About; 