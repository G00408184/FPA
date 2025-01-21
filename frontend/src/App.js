import React, { useState } from 'react';
import { Box, Container, Typography, Paper, Tabs, Tab, AppBar, useTheme, alpha, IconButton } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import FileUpload from './components/FileUpload/FileUpload';
import Welcome from './components/Welcome/Welcome';
import About from './components/About/About';
import Tutorial from './components/Tutorial/Tutorial';
import SportsIcon from '@mui/icons-material/Sports';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import HelpIcon from '@mui/icons-material/Help';
import InfoIcon from '@mui/icons-material/Info';

const getDesignTokens = (mode) => ({
  palette: {
    mode,
    ...(mode === 'light' ? {
      // Light mode colors
      primary: {
        main: '#1976d2',
        light: '#42a5f5',
        dark: '#1565c0',
      },
      secondary: {
        main: '#7c4dff',
        light: '#9670ff',
        dark: '#5635b2',
      },
      background: {
        default: '#f5f5f5',
        paper: '#ffffff',
      },
      text: {
        primary: '#1a2027',
        secondary: '#424242',
      },
    } : {
      // Dark mode colors
      primary: {
        main: '#00b0ff',
        light: '#33bfff',
        dark: '#007bb2',
      },
      secondary: {
        main: '#7c4dff',
        light: '#9670ff',
        dark: '#5635b2',
      },
      background: {
        default: '#0a1929',
        paper: '#1a2027',
      },
      text: {
        primary: '#ffffff',
        secondary: '#b3e5fc',
      },
    }),
  },
  typography: {
    fontFamily: '"Poppins", "Roboto", "Helvetica", "Arial", sans-serif',
    h2: {
      fontWeight: 700,
      letterSpacing: '-0.5px',
    },
    h4: {
      fontWeight: 600,
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '10px 24px',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontSize: '1rem',
          minHeight: 64,
        },
      },
    },
  },
});

function App() {
  const [currentTab, setCurrentTab] = useState(0);
  const [mode, setMode] = useState('dark');
  const theme = createTheme(getDesignTokens(mode));

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  const toggleColorMode = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ 
        minHeight: '100vh',
        bgcolor: 'background.default',
        pt: 4,
        background: `linear-gradient(45deg, ${alpha(theme.palette.primary.dark, 0.1)} 0%, ${alpha(theme.palette.secondary.dark, 0.1)} 100%)`,
      }}>
        <Container maxWidth="lg">
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            mb: 6,
          }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center',
              gap: 2,
            }}>
              <SportsIcon sx={{ fontSize: 48, color: 'primary.main' }} />
              <Typography 
                variant="h2" 
                sx={{ 
                  color: 'text.primary',
                  fontWeight: 'bold',
                  textShadow: mode === 'dark' ? '2px 2px 4px rgba(0,0,0,0.3)' : 'none',
                }}
              >
                Football Performance Analyzer
              </Typography>
            </Box>
            
            <IconButton 
              onClick={toggleColorMode} 
              color="primary"
              sx={{ 
                p: 2,
                border: 1,
                borderColor: 'primary.main',
                borderRadius: 2,
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                }
              }}
            >
              {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </Box>

          <Paper 
            elevation={24} 
            sx={{ 
              mb: 4,
              borderRadius: 3,
              overflow: 'hidden',
              backdropFilter: 'blur(20px)',
              background: alpha(theme.palette.background.paper, mode === 'dark' ? 0.8 : 1),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              boxShadow: `0 0 40px ${alpha(theme.palette.primary.main, 0.2)}`,
            }}
          >
            <AppBar 
              position="static" 
              color="transparent" 
              elevation={0}
              sx={{
                borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              }}
            >
              <Tabs
                value={currentTab}
                onChange={handleTabChange}
                indicatorColor="primary"
                textColor="primary"
                variant="fullWidth"
                sx={{
                  '& .MuiTab-root': {
                    py: 3,
                    fontSize: '1rem',
                    color: 'text.primary',
                  },
                }}
              >
                <Tab icon={<SportsIcon />} label="Welcome" />
                <Tab icon={<VideoLibraryIcon />} label="Analyze Video" />
                <Tab icon={<HelpIcon />} label="Tutorial" />
                <Tab icon={<InfoIcon />} label="About" />
              </Tabs>
            </AppBar>

            <Box sx={{ p: 4 }}>
              {currentTab === 0 && <Welcome />}
              {currentTab === 1 && <FileUpload />}
              {currentTab === 2 && <Tutorial />}
              {currentTab === 3 && <About />}
            </Box>
          </Paper>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;