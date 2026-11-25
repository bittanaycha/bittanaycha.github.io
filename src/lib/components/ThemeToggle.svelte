<script lang="ts">
	import { toggleSeasonsTheme } from '#lib/theme';
</script>

<button
	type="button"
	class="theme-toggle"
	onclick={() => toggleSeasonsTheme()}
	aria-label="Switch between light and dark mode"
	title="Switch between light and dark mode"
>
	<span class="when-dark" aria-hidden="true">
		<!-- Lucide sun -->
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
			stroke-linecap="round">
			<circle cx="12" cy="12" r="4" />
			<path
				d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
			/>
		</svg>
	</span>
	<span class="when-light" aria-hidden="true">
		<!-- Lucide moon -->
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
			stroke-linejoin="round">
			<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
		</svg>
	</span>
</button>

<style>
	.theme-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: 1px solid var(--rule);
		background: color-mix(in srgb, var(--bg) 72%, transparent);
		color: var(--ink);
		cursor: pointer;
	}

	.theme-toggle:hover {
		border-color: var(--ink);
		background: color-mix(in srgb, var(--summer) 24%, var(--bg));
	}

	.theme-toggle:focus-visible {
		outline: 1px solid var(--ink);
		outline-offset: 2px;
	}

	.theme-toggle svg {
		display: block;
		width: 1rem;
		height: 1rem;
	}

	.when-light {
		display: none;
	}

	:global(html[data-seasons-theme='light']) .when-dark {
		display: none;
	}

	:global(html[data-seasons-theme='light']) .when-light {
		display: inline;
	}
</style>
