import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 12345,
    // Fail loudly if 12345 is taken instead of silently moving to 12346.
    // A drifting dev port means the app loads but every API call is aimed at
    // the wrong origin, which looks like a broken backend rather than a
    // port clash.
    strictPort: true,
  },
});
