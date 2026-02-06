import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { applyLinuxFixes, applyMacFixes } from './utils/platform-fixes';

// Apply platform fixes immediately
applyLinuxFixes();
applyMacFixes();

// Ensure root element has proper background before React renders
const root = document.getElementById('root');
if (root) {
  root.style.backgroundColor = '#0b0f0c';
  root.style.minHeight = '100vh';
}

// Render React app
ReactDOM.createRoot(root!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
