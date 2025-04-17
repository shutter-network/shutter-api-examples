import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
    define: {
        'process.env': process.env,
        global: {}, // Needed for Buffer polyfill
    },
    plugins: [react()],
    resolve: {
        alias: {
            '@/': '/src/',
            buffer: 'buffer', // Polyfill alias
        },
    },
    optimizeDeps: {
        include: ['buffer'], // Ensure it's included in the build
    },
});
