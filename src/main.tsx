import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './App.css';
import { SigmaClientProvider, client } from '@sigmacomputing/plugin';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SigmaClientProvider client={client}>
      <App />
    </SigmaClientProvider>
  </React.StrictMode>,
);

