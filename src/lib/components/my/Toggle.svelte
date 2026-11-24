<script lang="ts">
  // Interruptor accesible (checkbox con role=switch).
  interface Props { checked: boolean; label: string; hint?: string; disabled?: boolean; onchange?: () => void }
  let { checked = $bindable(), label, hint, disabled = false, onchange }: Props = $props();
  const uid = $props.id();
</script>

<div class="toggle">
  <input id="{uid}-i" type="checkbox" role="switch" bind:checked {disabled} {onchange} aria-describedby={hint ? `${uid}-h` : undefined} />
  <label for="{uid}-i">
    <span class="track" aria-hidden="true"><span class="knob"></span></span>
    <span class="txt"><span class="l">{label}</span>{#if hint}<small id="{uid}-h" class="muted">{hint}</small>{/if}</span>
  </label>
</div>

<style>
  .toggle { position: relative; }
  input { position: absolute; opacity: 0; width: 44px; height: 24px; margin: 0; top: 2px; left: 0; }
  label { display: flex; gap: var(--space-3); align-items: flex-start; cursor: pointer; }
  .track { flex: none; width: 44px; height: 24px; border-radius: 999px; background: var(--line); position: relative; transition: background 0.15s; margin-top: 2px; }
  .knob { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: var(--surface); box-shadow: 0 1px 2px rgb(0 0 0 / 0.3); transition: transform 0.15s; }
  input:checked + label .track { background: var(--accent); }
  input:checked + label .knob { transform: translateX(20px); }
  input:focus-visible + label .track { outline: 3px solid var(--focus); outline-offset: 2px; }
  input:disabled + label { opacity: 0.55; cursor: not-allowed; }
  .txt { display: grid; gap: 2px; }
  .l { font-weight: 600; font-size: 0.95rem; }
  small { font-size: 0.82rem; }
</style>
