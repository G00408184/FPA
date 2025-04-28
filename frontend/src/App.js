import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import SportsIcon from '@mui/icons-material/Sports';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import HelpIcon from '@mui/icons-material/Help';
import InfoIcon from '@mui/icons-material/Info';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import GitHubIcon from '@mui/icons-material/GitHub';
import FileUpload from './components/FileUpload/FileUpload';
import Welcome from './components/Welcome/Welcome';
import About from './components/About/About';
import Tutorial from './components/Tutorial/Tutorial';
import ResultsPage from './components/ResultsPage/ResultsPage';
import './index.css';

// Router wrapper component with location for animations
const AnimatedRoutes = () => {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1.0] }}
          >
            <Welcome />
          </motion.div>
        } />
        <Route path="/analyze-video" element={
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1.0] }}
          >
            <FileUpload />
          </motion.div>
        } />
        <Route path="/results" element={
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1.0] }}
          >
            <ResultsPage />
          </motion.div>
        } />
        <Route path="/tutorial" element={
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1.0] }}
          >
            <Tutorial />
          </motion.div>
        } />
        <Route path="/about" element={
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1.0] }}
          >
            <About />
          </motion.div>
        } />
      </Routes>
    </AnimatePresence>
  );
};

function App() {
  const [currentTab, setCurrentTab] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  
  // Handle scroll effect for header
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Create Material UI theme
  const theme = createTheme({
  palette: {
      mode: isDarkMode ? 'dark' : 'light',
      primary: {
        main: '#0073ff',
      },
      secondary: {
        main: '#2dd4bf',
      },
      background: {
        default: isDarkMode ? '#111827' : '#f9fafb',
        paper: isDarkMode ? '#1f2937' : '#ffffff',
      },
  },
  typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
            borderRadius: '8px',
            textTransform: 'none',
            fontWeight: 500,
        },
      },
    },
  },
});

  const tabs = [
    { icon: <SportsIcon className="text-xl" />, label: 'Welcome', path: "/" },
    { icon: <VideoLibraryIcon className="text-xl" />, label: 'Analyze Video', path: "/analyze-video" },
    { icon: <HelpIcon className="text-xl" />, label: 'Tutorial', path: "/tutorial" },
    { icon: <InfoIcon className="text-xl" />, label: 'About', path: "/about" },
  ];

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <div className={`min-h-screen transition-colors duration-500 ${isDarkMode ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white' : 'bg-gradient-to-br from-blue-50 via-white to-blue-50 text-gray-900'}`}>
          {/* Background decorations */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-24 right-0 w-[800px] h-[800px] bg-blue-600/5 rounded-full blur-3xl"></div>
            <div className="absolute top-1/3 -left-96 w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-96 left-1/4 w-[800px] h-[800px] bg-cyan-600/5 rounded-full blur-3xl"></div>
            
            {/* Animated gradient orbs */}
            <motion.div 
              className="absolute w-[300px] h-[300px] rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 blur-3xl"
              animate={{
                x: [0, 100, 50, 0],
                y: [0, 50, 100, 0],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                repeatType: "reverse",
              }}
              style={{ top: '20%', right: '15%' }}
            />
            
            <motion.div 
              className="absolute w-[200px] h-[200px] rounded-full bg-gradient-to-r from-green-500/10 to-teal-500/10 blur-3xl"
              animate={{
                x: [0, -50, -100, 0],
                y: [0, 100, 50, 0],
              }}
              transition={{
                duration: 25,
                repeat: Infinity,
                repeatType: "reverse",
              }}
              style={{ bottom: '15%', left: '10%' }}
            />
          </div>
          
          {/* Header */}
          <motion.header 
            className={`fixed top-0 left-0 right-0 z-50 px-4 py-3 transition-all duration-300 ${
              scrolled 
                ? isDarkMode 
                  ? 'bg-gray-900/80 backdrop-blur-lg shadow-lg' 
                  : 'bg-white/80 backdrop-blur-lg shadow-lg'
                : 'bg-transparent'
            }`}
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1.0] }}
          >
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <Link to="/" className="flex items-center space-x-3 group">
                <motion.div
                  whileHover={{ rotate: 10, scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className={`p-2 rounded-xl bg-gradient-to-br ${isDarkMode ? 'from-blue-600 to-indigo-700' : 'from-blue-500 to-indigo-600'} shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/30 transition-all duration-300`}
                >
                  <SportsIcon className="text-2xl text-white" />
                </motion.div>
                <motion.h1 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className={`text-2xl sm:text-3xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'} hidden sm:block`}
                >
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-600">
                    Football Analyzer
                  </span>
                </motion.h1>
              </Link>

              {/* Desktop navigation */}
              <div className="hidden md:flex items-center space-x-1">
                <nav className="flex items-center rounded-full px-2 py-1 mr-2 bg-gray-100/50 dark:bg-gray-800/50 backdrop-blur-lg">
                  {tabs.map((tab, index) => (
                    <Link
                      key={index}
                      to={tab.path}
                      className="relative"
                      onClick={() => setCurrentTab(index)}
                    >
                      <motion.div
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                          currentTab === index
                            ? 'text-white'
                            : isDarkMode
                              ? 'text-gray-300 hover:text-white'
                              : 'text-gray-700 hover:text-gray-900'
                        }`}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <span className="relative z-10 flex items-center space-x-1">
                          {tab.icon}
                          <span>{tab.label}</span>
                        </span>
                        
                        {currentTab === index && (
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-400 rounded-full"
                            layoutId="navigationIndicator"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                          />
                        )}
                      </motion.div>
                    </Link>
                  ))}
                </nav>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className={`p-3 rounded-full shadow-lg ${
                    isDarkMode 
                      ? 'bg-gray-800 hover:bg-gray-700 text-yellow-300' 
                      : 'bg-white hover:bg-gray-100 text-blue-900'
                  } transition-colors duration-300`}
                  aria-label="Toggle theme"
                >
                  {isDarkMode ? '☀️' : '🌙'}
                </motion.button>
                
                <motion.a
                  href="https://github.com/G00408184/FPA"
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`p-3 rounded-full shadow-lg ${
                    isDarkMode 
                      ? 'bg-gray-800 hover:bg-gray-700 text-white' 
                      : 'bg-white hover:bg-gray-100 text-gray-900'
                  } transition-colors duration-300`}
                  aria-label="GitHub"
                >
                  <GitHubIcon fontSize="small" />
                </motion.a>
              </div>
              
              {/* Mobile menu button */}
              <div className="flex md:hidden items-center space-x-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className={`p-2 rounded-full ${
                    isDarkMode 
                      ? 'bg-gray-800 text-yellow-300' 
                      : 'bg-white text-blue-900'
                  }`}
                  aria-label="Toggle theme"
                >
                  {isDarkMode ? '☀️' : '🌙'}
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className={`p-2 rounded-full ${
                    isDarkMode 
                      ? 'bg-gray-800 text-white' 
                      : 'bg-white text-gray-900'
                  }`}
                  aria-label="Menu"
                >
                  {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
                </motion.button>
              </div>
            </div>
          </motion.header>
          
          {/* Mobile Menu */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="fixed inset-0 z-40 pt-16 pb-6 px-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg md:hidden overflow-y-auto"
              >
                <nav className="flex flex-col space-y-2 mt-6">
                  {tabs.map((tab, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Link
                        to={tab.path}
                        className={`flex items-center space-x-3 p-4 rounded-xl ${
                          currentTab === index
                            ? 'bg-gradient-to-r from-blue-600 to-blue-400 text-white'
                            : isDarkMode 
                              ? 'text-gray-300 hover:bg-gray-800' 
                              : 'text-gray-700 hover:bg-gray-100'
                        }`}
                        onClick={() => {
                          setCurrentTab(index);
                          setMobileMenuOpen(false);
                        }}
                      >
                        <span className="p-2 bg-white/10 rounded-lg">{tab.icon}</span>
                        <span className="font-medium">{tab.label}</span>
                      </Link>
                    </motion.div>
                  ))}
                  
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-800"
                  >
                    <a
                      href="https://github.com/G00408184/FPA"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center space-x-3 p-4 rounded-xl ${
                        isDarkMode ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span className="p-2 bg-white/10 rounded-lg"><GitHubIcon /></span>
                      <span className="font-medium">GitHub</span>
                    </a>
                  </motion.div>
                </nav>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Content */}
          <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className={`rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md ${
                isDarkMode 
                  ? 'bg-gray-800/80 border border-gray-700/50' 
                  : 'bg-white/90 border border-gray-200/50'
              }`}
            >
              <div className="p-6 sm:p-8">
                <AnimatedRoutes />
              </div>
            </motion.div>
            
            {/* Footer */}
            <motion.footer
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400"
            >
              
            </motion.footer>
          </div>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;