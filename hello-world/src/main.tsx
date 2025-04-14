import React from 'react';
import ReactDOM from 'react-dom/client';
import { NextUIProvider } from '@nextui-org/react';
import { Toaster } from 'sonner';

import App from './App';
import './index.css';

import { Buffer } from 'buffer'
window.Buffer = Buffer

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <NextUIProvider>
            <App />

            <Toaster position="top-right" />
        </NextUIProvider>
    </React.StrictMode>,
);
