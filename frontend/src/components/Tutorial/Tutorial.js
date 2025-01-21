import React from 'react';
import { Box, Typography, Stepper, Step, StepLabel, StepContent, Paper } from '@mui/material';

const steps = [
  {
    label: 'Select Video',
    description: 'Click on "Analyze Video" tab and select your football match video file.',
  },
  {
    label: 'Upload and Process',
    description: 'Click "Upload and Process" to start the analysis. The system will detect players and their team colors.',
  },
  {
    label: 'View Results',
    description: 'Once processing is complete, you can download the analyzed video with player detection and team identification.',
  },
];

const Tutorial = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom align="center" sx={{ mb: 4 }}>
        How to Use
      </Typography>

      <Paper elevation={0} sx={{ p: 3 }}>
        <Stepper orientation="vertical">
          {steps.map((step, index) => (
            <Step key={step.label} active={true}>
              <StepLabel>
                <Typography variant="h6">{step.label}</Typography>
              </StepLabel>
              <StepContent>
                <Typography>{step.description}</Typography>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </Paper>
    </Box>
  );
};

export default Tutorial; 