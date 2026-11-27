import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/jetbrains-mono';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import { installNetGuard } from './lib/net';

installNetGuard();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
