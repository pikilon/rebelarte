// SPA pura: sin SSR ni prerender. La capa PHP (share/) sirve index.html para cualquier ruta.
export const ssr = false;
export const prerender = false;
export const trailingSlash = 'never';
