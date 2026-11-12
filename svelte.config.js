import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** SPA: todo se renderiza en el cliente; la capa PHP (share/) sirve index.html. */
export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ pages: 'build', assets: 'build', fallback: 'index.html', strict: false })
  }
};
