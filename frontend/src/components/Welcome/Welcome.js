import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Analytics, 
  Speed, 
  PeopleAlt, 
  SportsSoccer, 
  ArrowForward,
  Insights,
  Psychology,
  DataUsage
} from '@mui/icons-material';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.3,
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 100 }
  }
};

const cardVariants = {
  hidden: { y: 30, opacity: 0 },
  visible: (i) => ({
    y: 0,
    opacity: 1,
    transition: {
      delay: i * 0.1 + 0.3,
      duration: 0.5,
      type: "spring",
      stiffness: 50
    }
  }),
  hover: {
    y: -10,
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
    transition: {
      type: "spring",
      stiffness: 150,
      damping: 15
    }
  },
  tap: {
    y: -5,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 20
    }
  }
};

const bulletPointVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.1 + 0.5,
      duration: 0.4
    }
  })
};

const features = [
  {
    icon: <Analytics />,
    title: "Advanced Analytics",
    description: "Get detailed insights into player movements, team formations, and match statistics.",
    color: "from-blue-500 to-blue-600"
  },
  {
    icon: <Speed />,
    title: "Real-time Processing",
    description: "Analyze football matches in real-time with our cutting-edge AI technology.",
    color: "from-purple-500 to-purple-600"
  },
  {
    icon: <PeopleAlt />,
    title: "Team Analysis",
    description: "Track player positions, team formations, and tactical patterns throughout the match.",
    color: "from-green-500 to-green-600"
  },
  {
    icon: <Insights />,
    title: "Performance Metrics",
    description: "Measure sprint speeds, distances covered, positioning, and other key performance indicators.",
    color: "from-indigo-500 to-indigo-600"
  },
  {
    icon: <Psychology />,
    title: "AI-Powered Insights",
    description: "Leverage machine learning to identify patterns and improvement opportunities.",
    color: "from-amber-500 to-amber-600"
  },
  {
    icon: <DataUsage />,
    title: "Data Visualization",
    description: "Intuitive charts and heatmaps help you understand complex match data at a glance.",
    color: "from-cyan-500 to-cyan-600"
  }
];

const benefits = [
  "Identify strengths and weaknesses in your team's performance",
  "Develop data-driven training strategies",
  "Track player development over time",
  "Compare performance across multiple matches",
  "Make informed tactical decisions based on objective data"
];

const Welcome = () => {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-20"
    >
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/80 to-indigo-700/80 mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1574629810360-7efbbe195018?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center opacity-30"></div>
        
        <div className="relative z-10 px-6 py-16 sm:py-24 sm:px-10 lg:px-16 text-white">
          <div className="max-w-3xl mx-auto text-center">
            <motion.h1
              variants={itemVariants}
              className="text-4xl md:text-5xl font-extrabold tracking-tight"
            >
              Transform Your Football Analysis 
              <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-indigo-200">
                With AI Technology
              </span>
            </motion.h1>
            
            <motion.p
              variants={itemVariants}
              className="mt-6 text-xl leading-relaxed text-blue-100"
            >
              Unlock the power of advanced video processing to analyze player movements, team formations,
              and match statistics with unprecedented accuracy and detail.
            </motion.p>
            
            <motion.div
              variants={itemVariants}
              className="mt-10 flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4"
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link 
                  to="/analyze-video"
                  className="flex items-center justify-center px-8 py-4 text-base font-medium rounded-full text-blue-700 bg-white hover:bg-blue-50 shadow-lg shadow-blue-800/30 transition-all duration-200"
                >
                  Start Analyzing
                  <ArrowForward className="ml-2" />
                </Link>
              </motion.div>
              
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link 
                  to="/tutorial"
                  className="flex items-center justify-center px-8 py-4 text-base font-medium rounded-full text-white bg-blue-500/20 hover:bg-blue-500/30 border border-blue-300/30 backdrop-blur-sm transition-all duration-200"
                >
                  How It Works
                </Link>
              </motion.div>
            </motion.div>
          </div>
          
          {/* Floating elements */}
          <motion.div
            className="absolute top-10 right-10 w-16 h-16 rounded-2xl bg-gradient-to-r from-blue-400/40 to-indigo-400/40 backdrop-blur-xl border border-white/20"
            animate={{
              y: [0, -15, 0],
              rotate: [0, 10, 0],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <div className="flex items-center justify-center h-full">
              <SportsSoccer className="text-3xl text-white" />
            </div>
          </motion.div>
          
          <motion.div
            className="absolute -bottom-2 left-1/4 w-20 h-20 rounded-full bg-gradient-to-r from-indigo-400/30 to-blue-400/30 backdrop-blur-xl border border-white/20"
            animate={{
              y: [0, 20, 0],
              x: [0, 15, 0],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1
            }}
          >
            <div className="flex items-center justify-center h-full">
              <Analytics className="text-3xl text-white" />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Features Grid */}
      <motion.div
        variants={itemVariants}
        className="px-4"
      >
        <div className="text-center mb-16">
          <motion.h2 
            variants={itemVariants}
            className="text-3xl font-bold mb-2"
          >
            Powerful Features
          </motion.h2>
          <motion.div
            variants={itemVariants}
            className="w-24 h-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 mx-auto rounded-full"
          />
          <motion.p
            variants={itemVariants}
            className="mt-6 text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto"
          >
            Our platform combines state-of-the-art computer vision with AI to deliver comprehensive football analytics
          </motion.p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              custom={index}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              whileHover="hover"
              whileTap="tap"
              className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-100 dark:border-gray-700 h-full"
            >
              <div className="p-1">
                <div className={`bg-gradient-to-r ${feature.color} rounded-t-lg h-2`} />
              </div>
              <div className="p-6">
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br ${feature.color} text-white mb-4 shadow-lg`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-300">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Benefits Section */}
      <motion.div
        variants={itemVariants}
        className="relative rounded-3xl overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-800"></div>
        <div className="absolute inset-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1459865264687-595d652de67e?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center mix-blend-overlay"></div>
        
        <div className="relative z-10 px-6 py-16 md:px-10 lg:px-16">
          <div className="max-w-4xl mx-auto">
            <motion.h2 
              variants={itemVariants}
              className="text-3xl font-bold text-white mb-12 text-center"
            >
              How Football Performance Analyzer Benefits Your Team
            </motion.h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={index}
                  custom={index}
                  variants={bulletPointVariants}
                  className="flex items-start space-x-3"
                >
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-lg text-gray-300">{benefit}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Call to Action */}
      <motion.div
        variants={itemVariants}
        className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-700 shadow-2xl"
      >
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-white/5 rounded-full blur-3xl"></div>
          
          <div className="absolute top-0 left-0 w-full h-full opacity-20">
            <svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <circle cx="20" cy="20" r="1" fill="white" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
        </div>
        
        <div className="relative z-10 px-6 py-16 sm:py-20 sm:px-10 lg:px-16 text-center">
          <motion.h2
            variants={itemVariants}
            className="text-3xl font-bold text-white"
          >
            Ready to Transform Your Match Analysis?
          </motion.h2>
          <motion.p
            variants={itemVariants}
            className="mt-4 text-xl text-blue-100 max-w-2xl mx-auto"
          >
            Upload your football match video and let our AI do the analysis for you.
            Get started in minutes and unlock powerful insights about your team's performance.
          </motion.p>
          
          <motion.div
            variants={itemVariants}
            className="mt-10"
          >
            <motion.div
              whileHover={{ scale: 1.05, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)" }}
              whileTap={{ scale: 0.98 }}
              className="inline-block"
            >
              <Link
                to="/analyze-video"
                className="inline-flex items-center px-10 py-5 rounded-full font-medium text-lg bg-white text-blue-700 hover:bg-blue-50 shadow-lg transition-colors duration-200"
              >
                Start Analyzing Now
                <ArrowForward className="ml-2" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Welcome; 