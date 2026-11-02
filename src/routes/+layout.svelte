<script lang="ts">
	import '../lib/styles/app.css';
	import { asset, resolve } from '$app/paths';
	import { page } from '$app/state';
	import Ship from '#lib/components/Ship.svelte';

	let { children } = $props();

	const here = $derived(page.url.pathname);

	const titles: Record<string, string> = {
		'/running': 'running',
		'/dither': 'dither'
	};
	const title = $derived(titles[here] ?? 'index');
</script>

<svelte:head>
	<title>{title}</title>
	<link rel="icon" href={asset('favicon.png')} type="image/png" />
	<meta name="theme-color" content="#04060d" />
	<meta name="color-scheme" content="dark" />
</svelte:head>

<div class="sea" style:--photo={`url('${asset('background.png')}')`} aria-hidden="true"></div>

<div class="deck">
	<header class="site-header">
		<div class="bar">
			<nav class="nav" aria-label="Sections">
				<a href={resolve('/')} aria-current={here === '/' ? 'page' : undefined}>index</a>
				<a href={resolve('/dither')} aria-current={here === '/dither' ? 'page' : undefined}>dither</a>
				<a href={resolve('/running')} aria-current={here === '/running' ? 'page' : undefined}>
					running
				</a>
			</nav>
		</div>
	</header>

	{@render children()}
</div>

<Ship />
