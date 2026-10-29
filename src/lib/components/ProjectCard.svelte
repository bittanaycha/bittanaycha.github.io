<script lang="ts">
	import type { Project } from '#lib/projects';

	let { project }: { project: Project } = $props();

	const external = $derived(/^https?:/.test(project.href));
</script>

<a
	class="card"
	href={project.href}
	target={external ? '_blank' : undefined}
	rel={external ? 'noreferrer' : undefined}
>
	<div class="card-top">
		<h3>{project.title}</h3>
		{#if project.tag}
			<span class="tag">{project.tag}</span>
		{/if}
	</div>
	<p>{project.description}</p>
	<span class="card-arrow" aria-hidden="true">↗</span>
</a>
