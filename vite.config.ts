import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const sourceRoot = resolve(projectRoot, 'src');

function copyExtensionAssets(): Plugin {
    return {
        name: 'copy-extension-assets',
        generateBundle() {
            this.emitFile({
                type: 'asset',
                fileName: 'manifest.json',
                source: readFileSync(resolve(projectRoot, 'manifest.json'), 'utf8'),
            });
            this.emitFile({
                type: 'asset',
                fileName: 'assets/icons/drop.svg',
                source: readFileSync(resolve(projectRoot, 'assets/icons/drop.svg'), 'utf8'),
            });
            this.emitFile({
                type: 'asset',
                fileName: 'assets/logo.svg',
                source: readFileSync(resolve(projectRoot, 'assets/logo.svg'), 'utf8'),
            });
        },
    };
}

export default defineConfig({
    root: sourceRoot,
    base: './',
    plugins: [tailwindcss(), copyExtensionAssets()],
    build: {
        outDir: resolve(projectRoot, 'dist'),
        emptyOutDir: true,
        rollupOptions: {
            input: {
                popup: resolve(sourceRoot, 'popup/popup.html'),
                content: resolve(sourceRoot, 'content/content.ts'),
                'service-worker': resolve(sourceRoot, 'background/service-worker.ts'),
            },
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash][extname]',
            },
        },
    },
});