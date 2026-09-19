import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource-variable/manrope';
import '@fontsource/ibm-plex-mono/400.css';
import App from './App';
import './styles.css';
import { registerWebMCP } from './webmcp';
import { update } from './store';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
const registration = registerWebMCP();
if (import.meta.hot) import.meta.hot.dispose(() => { void registration.then(cleanup => cleanup()); });
fetch('/api/assistant/status').then(r => r.ok && r.headers.get('content-type')?.includes('application/json') ? r.json() : null).then(data => { if (data?.available === true) update({ aiAvailable: true }); }).catch(() => {});
