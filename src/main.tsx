/** This module implements main. */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { bootActiveDomain } from './domains/boot'
import App from './App.tsx'

// Resolve + install the active domain and bind the retrieval graph before
// first render, so every component and retrieval strategy sees a ready domain.
bootActiveDomain()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
