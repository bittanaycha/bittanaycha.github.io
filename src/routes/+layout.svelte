<script lang="ts">
	import '../lib/styles/app.css';
	import { asset, resolve } from '$app/paths';
	import { page } from '$app/state';

	let { children } = $props();

	const here = $derived(page.url.pathname);

	const titles: Record<string, string> = {
		'/running': 'running',
		'/languages': 'languages',
		'/dither': 'dither'
	};
	const title = $derived(titles[here] ?? 'index');
</script>

<svelte:head>
	<title>{title}</title>
	<link rel="icon" href={asset('favicon.svg')} type="image/svg+xml" />
	<meta name="theme-color" content="#e8dcc4" />
	<meta name="color-scheme" content="light" />
</svelte:head>

<div
	class="paper"
	style:--photo={`url('${asset('background.webp')}')`}
	aria-hidden="true"
></div>

<header class="site-header">
	<div class="bar">
		<nav class="nav" aria-label="Sections">
			<a href={resolve('/')} aria-current={here === '/' ? 'page' : undefined}>index</a>
			<a href={resolve('/dither')} aria-current={here === '/dither' ? 'page' : undefined}>dither</a>
			<a href={resolve('/running')} aria-current={here === '/running' ? 'page' : undefined}>
				running
			</a>
			<a href={resolve('/languages')} aria-current={here === '/languages' ? 'page' : undefined}>
				languages
			</a>
		</nav>
	</div>
</header>

{@render children()}
