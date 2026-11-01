<script lang="ts">
	import '../lib/styles/app.css';
	import { asset, resolve } from '$app/paths';
	import { page } from '$app/state';

	let { children } = $props();

	const here = $derived(page.url.pathname);

	const titles: Record<string, string> = { '/running': 'running', '/plate': 'plate' };
	const title = $derived(titles[here] ?? 'index');
</script>

<svelte:head>
	<title>{title}</title>
	<link rel="icon" href={asset('favicon.svg')} type="image/svg+xml" />
	<meta name="theme-color" content="#463523" />
	<meta name="color-scheme" content="dark" />
</svelte:head>

<header class="site-header">
	<div class="bar">
		<nav class="nav" aria-label="Sections">
			<a href={resolve('/')} aria-current={here === '/' ? 'page' : undefined}>index</a>
			<a href={resolve('/plate')} aria-current={here === '/plate' ? 'page' : undefined}>plate</a>
			<a href={resolve('/running')} aria-current={here === '/running' ? 'page' : undefined}>
				running
			</a>
		</nav>
	</div>
</header>

{@render children()}
