<script lang="ts" module>
  // Iconos de «Mi Rebelarte», inspirados en los de la maqueta original
  // (preferencias = casillas con cursor, currículum = ficha, mis obras = lienzo con la R).
  export const SECTION_ICON_PATHS: Record<string, string> = {
    '': '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    perfil: '<rect x="4.5" y="3.5" width="11" height="14" rx="1.5"/><path d="M7.5 7.5h2.5v2.5H7.5zM7.5 13.5l2.5 2.5M10 13.5l-2.5 2.5M12.5 8.5h1M12.5 14.5h1"/><path d="m14 12 6 2.2-2.6 1 -1 2.6z" fill="currentColor"/>',
    cv: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="8.5" cy="10" r="2"/><path d="M5.8 15.5c.4-1.6 1.5-2.4 2.7-2.4s2.3.8 2.7 2.4M13.5 9h4M13.5 12h4M13.5 15h3"/>',
    obras: '<rect x="3.5" y="3.5" width="17" height="14" rx="1.5"/><path d="M9.5 15V7h3a2 2 0 0 1 0 4h-3m3 0 2.5 4M8 20.5h8"/>',
    participaciones: '<circle cx="8.5" cy="8" r="3"/><circle cx="16.5" cy="9.5" r="2.5"/><path d="M3.5 19c.5-3 2.5-4.8 5-4.8s4.5 1.8 5 4.8M14 14.4c.7-.4 1.6-.6 2.5-.6 2 0 3.6 1.5 4 4.2"/>',
    mensajes: '<path d="M4 5.5h16a.5.5 0 0 1 .5.5v10a.5.5 0 0 1-.5.5H9l-4.5 3.5v-3.5H4a.5.5 0 0 1-.5-.5V6a.5.5 0 0 1 .5-.5z"/><path d="M7.5 9.5h9M7.5 12.5h6"/>',
    notificaciones: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    reclamar: '<path d="M8 11V7.5a4 4 0 0 1 8 0"/><rect x="5" y="11" width="14" height="9.5" rx="2"/><path d="M12 14.5v2.5"/>'
  };
</script>

<script lang="ts">
  let { name, size = 22 }: { name: string; size?: number } = $props();
</script>

<svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
  stroke-linejoin="round" aria-hidden="true">{@html SECTION_ICON_PATHS[name] ?? SECTION_ICON_PATHS['']}</svg>

<style>
  svg { flex: none; display: inline-block; vertical-align: middle; }
</style>
