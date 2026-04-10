import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// على Vercel يُمرَّر VERCEL_GIT_COMMIT_SHA تلقائياً وقت البناء — لمعرفة إن الموقع يعرض آخر نشر
const deployRef =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
  process.env.VITE_BUILD_REF ||
  'محلي'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_DEPLOY_REF__: JSON.stringify(deployRef),
  },
})
