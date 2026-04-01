import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: path.join(
            path.dirname(require.resolve('cesium/package.json')),
            'Build/Cesium/Workers'
          ),
          dest: 'cesiumStatic'
        },
        {
          src: path.join(
            path.dirname(require.resolve('cesium/package.json')),
            'Build/Cesium/ThirdParty'
          ),
          dest: 'cesiumStatic'
        },
        {
          src: path.join(
            path.dirname(require.resolve('cesium/package.json')),
            'Build/Cesium/Assets'
          ),
          dest: 'cesiumStatic'
        },
        {
          src: path.join(
            path.dirname(require.resolve('cesium/package.json')),
            'Build/Cesium/Widgets'
          ),
          dest: 'cesiumStatic'
        }
      ]
    })
  ],
  define: {
    CESIUM_BASE_URL: JSON.stringify('/cesiumStatic')
  }
})