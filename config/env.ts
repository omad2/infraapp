import Constants from 'expo-constants';

// Get the environment variables from app.config.js
const ENV = {
  dev: {
    apiUrl: 'http://192.168.0.109:8081',
    openaiApiKey: process.env.OPENAI_API_KEY,
  },
  prod: {
    apiUrl: 'YOUR_PRODUCTION_API_URL',
    openaiApiKey: process.env.OPENAI_API_KEY,
  },
};

// Get the current environment
const getEnvVars = () => {
  if (__DEV__) {
    return ENV.dev;
  }
  return ENV.prod;
};

export default getEnvVars(); 