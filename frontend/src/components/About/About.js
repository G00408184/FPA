import React from 'react';
import { motion } from 'framer-motion';
import {  GitHub, } from '@mui/icons-material';



const techStack = [
  { name: 'React', bgColor: 'bg-blue-500' },
  { name: 'Yolo', bgColor: 'bg-orange-500' },
  { name: 'OpenCV', bgColor: 'bg-green-500' },
  { name: 'Python', bgColor: 'bg-yellow-500' }
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { 
      staggerChildren: 0.1,
      delayChildren: 0.3
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 }
};

const About = () => {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="space-y-16 py-8"
    >
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background elements */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-green-600/10 rounded-full blur-3xl"></div>
        
        <motion.div
          variants={itemVariants}
          className="relative z-10 text-center space-y-8 max-w-4xl mx-auto px-4"
        >
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-400">
              About Our Project
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
              A powerful tool for analyzing football matches using computer vision and AI.
              Get detailed insights into player movements, team formations, and match statistics.
            </p>
          </div>
        </motion.div>
      </div>

      <motion.div variants={itemVariants} className="px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-2">Key Features</h2>
          <div className="w-20 h-1 bg-blue-500 mx-auto rounded-full"></div>
        </div>
      </motion.div>

      {/* Technology Stack */}
      <motion.div variants={itemVariants} className="px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-2">Technology Stack</h2>
          <div className="w-20 h-1 bg-blue-500 mx-auto rounded-full"></div>
        </div>
        
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {techStack.map((tech, index) => (
              <motion.div
                key={index}
                whileHover={{ scale: 1.05, rotate: 2 }}
                className="relative overflow-hidden rounded-xl shadow-lg"
              >
                <div className={`absolute inset-0 ${tech.bgColor} opacity-20`}></div>
                <div className={`absolute top-0 left-0 w-2 h-full ${tech.bgColor}`}></div>
                <div className="p-6 flex flex-col items-center justify-center space-y-2">
                  <span className="text-lg font-bold">{tech.name}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Technology</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* GitHub Link Section */}
      <motion.div
        variants={itemVariants}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 to-blue-900 max-w-5xl mx-auto shadow-2xl"
      >
        {/* Background decoration */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 p-12 text-center space-y-6">
          <h3 className="text-3xl font-bold text-white">Project Repository</h3>
          <p className="text-blue-100 max-w-2xl mx-auto">
            Check out the source code for this project on GitHub.
          </p>
          
          <div className="flex justify-center space-x-4 pt-4">
            <motion.a
              href="https://github.com/G00408184/FPA"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.1, y: -5 }}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white"
            >
              <GitHub />
            </motion.a>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default About; 