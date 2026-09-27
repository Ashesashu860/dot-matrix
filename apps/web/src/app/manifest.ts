import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Box Hunt',
    short_name: 'Box Hunt',
    description: 'Connect. Capture. Conquer. A dots-and-boxes strategy game.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f5f7fb',
    theme_color: '#3b5bdb',
    categories: ['games', 'entertainment'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}
