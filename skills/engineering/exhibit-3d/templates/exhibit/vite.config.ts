import { defineConfig, type PluginOption } from 'vite';

// `npm run build:single` (vite build --mode single) inlines every script, style and font into one
// shareable HTML file; fonts are self-hosted through @fontsource, so nothing loads from the network.
export default defineConfig(async ({ mode }) => {
  const plugins: PluginOption[] = [];
  if (mode === 'single') {
    const { viteSingleFile } = await import('vite-plugin-singlefile');
    plugins.push(viteSingleFile());
  }
  return {
    plugins,
    server: { port: 5173 },
    build: { target: 'es2024', assetsInlineLimit: mode === 'single' ? 100_000_000 : 4096 },
  };
});
