<script lang="ts">
	import '../lib/styles/app.css';
	import { asset, resolve } from '$app/paths';
	import { site } from '#lib/site';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';

	let { children } = $props();

	const year = new Date().getFullYear();
</script>

<svelte:head>
	<link rel="icon" href="{asset('/favicon.svg')}" type="image/svg+xml" />
	<meta name="theme-color" content="#f7f2e8" media="(prefers-color-scheme: light)" />
	<meta name="theme-color" content="#171613" media="(prefers-color-scheme: dark)" />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={site.title} />
	<meta property="og:description" content={site.description} />
	<meta name="twitter:card" content="summary" />
</svelte:head>

<a class="skip-link" href="#main">Skip to content</a>

<header class="site-header">
	<div class="container header-inner">
		<a class="wordmark" href={resolve('/')}>{site.name}<span>.</span></a>
		<nav aria-label="Primary">
			<a href={resolve('/#projects')}>Projects</a>
			<a href={resolve('/#about')}>About</a>
			{#if site.email}
				<a href="mailto:{site.email}">Email</a>
			{/if}
			<a href="https://github.com/{site.github}" rel="me noreferrer" target="_blank">GitHub</a>
			<ThemeToggle />
		</nav>
	</div>
</header>

{@render children()}

<footer class="site-footer">
	<div class="container footer-inner">
		<p>© {year} {site.name}. Built with SvelteKit.</p>
		<div class="footer-links">
			<a href="https://github.com/{site.github}" target="_blank" rel="noreferrer">Source</a>
			<a href={resolve('/#top')}>Back to top</a>
		</div>
	</div>
</footer>
