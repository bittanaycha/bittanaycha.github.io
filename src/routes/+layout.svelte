<script lang="ts">
	import '../lib/styles/app.css';
	import { asset, resolve } from '$app/paths';
	import { page } from '$app/state';
	import Ship from '#lib/components/Ship.svelte';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';

	let { children } = $props();

	const here = $derived(page.url.pathname);

	const titles: Record<string, string> = {
		'/running': 'running',
		'/seasons': 'seasons',
		'/dither': 'dither'
	};
	const title = $derived(titles[here] ?? 'index');

	// The seasons pages are a black sheet, not the bark photograph. The class is
	// on the deck so app.css can key the page background off it, instead of each
	// page writing its own global rules that leak onto every other route.
	const dark = $derived(here === '/seasons' || here === '/seasons/edit');
</script>

<svelte:head>
	<title>{title}</title>
	<link rel="icon" href={asset('favicon.png')} type="image/png" />
	<meta name="theme-color" content="#04060d" />
	<meta name="color-scheme" content="dark" />
</svelte:head>

<div class="sea" style:--photo={`url('${asset('background.png')}')`} aria-hidden="true"></div>

<div class="deck" class:dark>
	<header class="site-header">
		<div class="bar">
			<nav class="nav" aria-label="Sections">
				<a href={resolve('/')} aria-current={here === '/' ? 'page' : undefined}>index</a>
				<a href={resolve('/dither')} aria-current={here === '/dither' ? 'page' : undefined}>dither</a>
				<a href={resolve('/running')} aria-current={here === '/running' ? 'page' : undefined}>
					running
				</a>
				<a href={resolve('/seasons')} aria-current={here === '/seasons' ? 'page' : undefined}>
					seasons
				</a>
			</nav>
			{#if dark}
				<ThemeToggle />
			{/if}
		</div>
	</header>

	{@render children()}
</div>

<Ship />
