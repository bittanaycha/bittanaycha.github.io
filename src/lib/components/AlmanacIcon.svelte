<script lang="ts">
	// Two woodcut signs for the almanac: a sun with a face and flames, and a
	// crescent moon with a face in profile. The halftone fill is a dot pattern,
	// so the marks read as printed rather than drawn.
	let { kind }: { kind: 'sun' | 'moon' } = $props();

	const dots = $props.id();
</script>

<svg class="almanac-icon" viewBox="0 0 64 64" aria-hidden="true">
	<defs>
		<pattern id={dots} width="4" height="4" patternUnits="userSpaceOnUse">
			<circle cx="2" cy="2" r="0.55" fill="currentColor" />
		</pattern>
	</defs>

	{#if kind === 'sun'}
		<circle cx="32" cy="32" r="15.5" fill={`url(#${dots})`} />
		<circle cx="32" cy="32" r="15.5" />
		{#each [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330] as angle (angle)}
			<path d="M32 6.4c1.5 2.4 1.5 4.4 0 6.8" transform={`rotate(${angle} 32 32)`} />
		{/each}
		<circle cx="25.8" cy="29.6" r="1.8" fill="currentColor" />
		<circle cx="38.2" cy="29.6" r="1.8" fill="currentColor" />
		<path d="M22.4 24.6c1.9-1.5 4.2-1.5 6.1 0M35.5 24.6c1.9-1.5 4.2-1.5 6.1 0" />
		<path d="M32 30.4v4.4c0 1.2-1 2-2.1 2" />
		<path d="M27.2 41.4c2.7 2.1 6.9 2.1 9.6 0" />
	{:else}
		<path
			d="M40 6.5a25.5 25.5 0 1 0 0 51C37.5 52 36 47 36.5 41L39 38l-3-4.5 5-3-5.5-4C31 21 33 14 40 6.5Z"
			fill={`url(#${dots})`}
		/>
		<path
			d="M40 6.5a25.5 25.5 0 1 0 0 51C37.5 52 36 47 36.5 41L39 38l-3-4.5 5-3-5.5-4C31 21 33 14 40 6.5Z"
		/>
		<circle cx="28.6" cy="25.6" r="1.8" fill="currentColor" />
		<path d="M25.4 21.8c1.5-1.1 3.3-1.3 4.8-.6" />
		<path d="M50 12.5l1.1 2.9 2.9 1.1-2.9 1.1-1.1 2.9-1.1-2.9-2.9-1.1 2.9-1.1z" />
	{/if}
</svg>

<style>
	.almanac-icon {
		display: block;
		width: 1.55rem;
		height: 1.55rem;
		flex: none;
		color: var(--ink);
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
