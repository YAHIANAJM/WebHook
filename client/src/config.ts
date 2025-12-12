// API Configuration
// Use environment variable if set, otherwise default to network IP
// For local development, set VITE_API_URL=http://localhost:3000 in .env
export const API_URL = import.meta.env.VITE_API_URL || 'http://192.168.100.179:3000';

