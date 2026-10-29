<script lang="ts">
	import { onMount } from 'svelte';

	type Theme = 'light' | 'dark';

	let theme = $state<Theme>('light');
	let ready = $state(false);

	onMount(() => {
		const current = document.documentElement.dataset.theme;
		if (current === 'dark' || current === 'light') theme = current;
		ready = true;
	});

	function toggle() {
		theme = theme === 'dark' ? 'light' : 'dark';
		document.documentElement.dataset.theme = theme;
		try {
			localStorage.setItem('theme', theme);
		} catch {
			/* private mode — the page still works, it just will not remember */
		}
	}
</script>

<button
	type="button"
	class="theme-toggle"
	onclick={toggle}
	aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
	aria-pressed={theme === 'dark'}
	title="Toggle theme"
	data-ready={ready}
>
	{#if theme === 'dark'}
		<!-- sun: switch back to light -->
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
			<circle cx="12" cy="12" r="4.2" />
			<path
				d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6"
				stroke-linecap="round"
			/>
		</svg>
	{:else}
		<!-- moon: switch to dark -->
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
			<path
				d="M20.5 14.3A8.6 8.6 0 1 1 9.7 3.5a6.8 6.8 0 0 0 10.8 10.8Z"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	{/if}
</button>
