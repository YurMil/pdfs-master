import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import { App } from '@/app/App';
import { ThemeSync } from '@/components/ThemeSync/ThemeSync';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeSync />
    <App />
  </StrictMode>,
);
