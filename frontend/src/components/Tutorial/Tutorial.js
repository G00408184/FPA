import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Help, 
  Upload, 
  Analytics, 
  LightbulbOutlined,
  VideoLibrary,
  BarChart,
  CloudDownload,
  CheckCircle
} from '@mui/icons-material';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { 
      staggerChildren: 0.15,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { 
      type: "spring", 
      stiffness: 100,
      damping: 13
    }
  }
};

const steps = [
  {
    icon: <Upload />,
    title: "Upload Your Video",
    description: "Select a football match video from your device. Supported formats include MP4, AVI, and MOV.",
    details: "Simply drag and drop your file or browse for it. Our system can handle high-definition videos up to 4K resolution for the best analysis results.",
    color: "bg-blue-500"
  },
  {
    icon: <VideoLibrary />,
    title: "Video Processing",
    description: "Our AI system processes your footage frame by frame, identifying players, the ball, and tracking movements.",
    details: "Advanced computer vision algorithms detect and track each player throughout the match, even with occlusions and varying lighting conditions.",
    color: "bg-purple-500"
  },
  {
    icon: <Analytics />,
    title: "View Analysis",
    description: "Watch as our system tracks players, identifies teams, and generates performance statistics in real-time.",
    details: "Interactive visualizations allow you to explore player positioning, movement patterns, and team formations at any point during the match.",
    color: "bg-indigo-500"
  },
  {
    icon: <BarChart />,
    title: "Get Detailed Metrics",
    description: "Access comprehensive reports on player movements, team formations, and match statistics.",
    details: "Review key performance indicators like player speed, distance covered, successful passes, and positional heat maps.",
    color: "bg-green-500"
  },
  {
    icon: <CloudDownload />,
    title: "Export Results",
    description: "Download your analysis results in various formats for further review and team sharing.",
    details: "Choose from PDF reports, CSV data exports, or annotated video replays that highlight key insights and observations.",
    color: "bg-amber-500"
  }
];

const tips = [
  "Use high-quality video footage for better player detection",
  "Ensure good lighting conditions in the video",
  "Videos should be at least 720p resolution",
  "Processing time depends on video length and quality",
  "Avoid videos with excessive camera movement",
  "Best results are achieved with footage showing the entire field"
];

const Tutorial = () => {
  const [expandedStep, setExpandedStep] = useState(null);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="space-y-16"
    >
      {/* Header */}
      <div className="relative mb-16">
        <motion.div 
          className="absolute inset-0 -z-10 bg-gradient-to-b from-blue-100/20 to-transparent dark:from-blue-900/10 rounded-3xl"
          animate={{ 
            opacity: [0.5, 0.8, 0.5],
            scale: [0.98, 1, 0.98]
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            repeatType: "reverse"
          }}
        />
        
        <motion.div
          variants={itemVariants}
          className="text-center space-y-6 max-w-3xl mx-auto px-4 py-8"
        >
          <div className="relative inline-block">
            <motion.div
              whileHover={{ rotate: 15 }}
              transition={{ duration: 0.3 }}
              className="mx-auto inline-flex items-center justify-center p-3 rounded-xl bg-gradient-to-br from-blue-600 to-blue-400 shadow-lg shadow-blue-500/20"
            >
              <Help className="text-3xl text-white" />
            </motion.div>
            
            <motion.div 
              className="absolute -top-2 -right-2 w-3 h-3 rounded-full bg-yellow-400"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
          
          <motion.h1 
            variants={itemVariants}
            className="text-4xl font-bold"
          >
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-400">
              How to Use the Analyzer
            </span>
          </motion.h1>
          
          <motion.p 
            variants={itemVariants}
            className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed"
          >
            Follow these simple steps to analyze your football match and get detailed insights
          </motion.p>
        </motion.div>
      </div>

      {/* Steps Timeline */}
      <motion.div 
        variants={itemVariants}
        className="max-w-4xl mx-auto px-4"
      >
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-400 to-green-400 transform md:translate-x-px"></div>
          
          {/* Steps */}
          <div className="space-y-16">
          {steps.map((step, index) => (
              <motion.div
                key={index}
                className={`relative flex flex-col md:flex-row ${
                  index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                }`}
                variants={itemVariants}
                custom={index}
                whileHover={{ scale: 1.01 }}
              >
                {/* Timeline dot */}
                <div className="absolute left-5 md:left-1/2 top-5 w-8 h-8 rounded-full bg-white dark:bg-gray-800 border-4 border-blue-500 transform -translate-x-1/2 md:-translate-x-1/2 flex items-center justify-center z-10 shadow-md">
                  <span className="text-xs font-bold text-blue-600">{index + 1}</span>
                </div>
                
                {/* Content */}
                <motion.div 
                  className={`ml-16 md:ml-0 md:w-1/2 ${
                    index % 2 === 0 ? 'md:pr-12 md:text-right' : 'md:pl-12'
                  }`}
                  whileHover={{ y: -5 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                >
                  <div className={`p-6 rounded-xl bg-white dark:bg-gray-800 shadow-lg border border-gray-100 dark:border-gray-700 h-full`}>
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${step.color} text-white`}>
                          {step.icon}
                        </div>
                        <h3 className="text-xl font-bold">{step.title}</h3>
                      </div>
                      
                      <p className="text-gray-600 dark:text-gray-300">
                        {step.description}
                      </p>
                      
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ 
                          height: expandedStep === index ? 'auto' : 0,
                          opacity: expandedStep === index ? 1 : 0
                        }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-3 text-gray-500 dark:text-gray-400 text-sm border-t border-gray-100 dark:border-gray-700">
                          {step.details}
                        </div>
                      </motion.div>
                      
                      <button 
                        onClick={() => setExpandedStep(expandedStep === index ? null : index)}
                        className="text-blue-500 hover:text-blue-600 text-sm font-medium"
                      >
                        {expandedStep === index ? 'Show less' : 'Learn more'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            ))}
            
            {/* Final step with checkmark */}
            <motion.div
              className="relative flex"
              variants={itemVariants}
            >
              <div className="absolute left-5 md:left-1/2 top-5 w-10 h-10 rounded-full bg-green-500 transform -translate-x-1/2 md:-translate-x-1/2 flex items-center justify-center z-10 shadow-lg">
                <CheckCircle className="text-white" />
              </div>
              
              <div className="ml-16 md:ml-0 md:w-full text-center">
                <motion.div
                  whileHover={{ y: -5 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  className="inline-block px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-full shadow-lg"
                >
                  You're ready to analyze your matches!
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Tips Section */}
      <motion.div
        variants={itemVariants}
        className="relative rounded-3xl overflow-hidden max-w-5xl mx-auto"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-orange-100 dark:from-gray-800 dark:to-gray-900 opacity-90"></div>
        <div className="absolute inset-0 opacity-5 bg-[url('https://images.unsplash.com/photo-1511426463457-0571e247d816?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center mix-blend-overlay"></div>
        
        <div className="relative z-10 p-10 space-y-8">
          <div className="flex items-center space-x-4 mb-8">
            <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <LightbulbOutlined className="text-3xl" />
            </div>
            <h3 className="text-2xl font-bold">Tips for Best Results</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
            {tips.map((tip, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                className="flex items-start space-x-3"
              >
                <div className="flex-shrink-0 mt-1">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                    <span className="text-xs font-bold">{index + 1}</span>
                  </div>
                </div>
                <p className="text-gray-700 dark:text-gray-300">{tip}</p>
              </motion.div>
            ))}
          </div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="text-center mt-8 pt-6 border-t border-amber-200/50 dark:border-gray-700/50"
          >
            <span className="text-amber-700 dark:text-amber-400 font-medium">⭐ Pro Tip: </span>
            <span className="text-gray-700 dark:text-gray-300">For team sports, capturing footage from an elevated angle gives the best analysis results.</span>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Tutorial; 