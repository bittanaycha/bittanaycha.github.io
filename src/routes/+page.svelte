<script lang="ts">
	import { resolve } from '$app/paths';
	import { site } from '#lib/site';
	import { projects } from '#lib/projects';
	import ProjectCard from '#lib/components/ProjectCard.svelte';

	const notes = [
		{ year: '2026', text: 'Mimir, a desktop app that teaches instead of answering.' },
		{ year: '2026', text: 'A set of Obsidian plugins for reading on warm paper.' },
		{ year: '2025', text: 'Tomodoro, a timer that respects your attention.' }
	];
</script>

<svelte:head>
	<title>{site.title}</title>
	<meta name="description" content={site.description} />
</svelte:head>

<main id="main">
	<section class="hero" id="top">
		<div class="container">
			<p class="kicker">Local-first · offline by default</p>
			<h1>{site.tagline}</h1>
			<p class="lede">{site.intro}</p>
			<div class="actions">
				<a class="btn btn--primary" href={resolve('/#projects')}>
					See the projects
					<span aria-hidden="true">↓</span>
				</a>
				<a class="btn" href="https://github.com/{site.github}" target="_blank" rel="noreferrer">
					GitHub
					<span aria-hidden="true">↗</span>
				</a>
			</div>
		</div>
	</section>

	<section class="section" id="projects">
		<div class="container">
			<div class="section-head">
				<h2>Projects</h2>
				<p>{projects.length} things, most of them small.</p>
			</div>
			<div class="grid">
				{#each projects as project (project.href)}
					<ProjectCard {project} />
				{/each}
			</div>
		</div>
	</section>

	<section class="section" id="about">
		<div class="container about">
			<div>
				<div class="section-head">
					<h2>About</h2>
				</div>
				<p>
					I like software that does one thing and then stops talking. The tools here are built to be
					read, kept and understood — no accounts, no telemetry, no remote assets that break when a
					CDN goes down.
				</p>
				<p>
					If something here is useful to you, or you want to argue about the tradeoffs, email is the
					best way to reach me.
				</p>
			</div>

			<div class="now">
				<h3>Recently</h3>
				<ul>
					{#each notes as note}
						<li>
							<span>{note.year}</span>
							<span>{note.text}</span>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</section>
</main>
