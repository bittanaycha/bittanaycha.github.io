<script lang="ts">
	import { onMount } from 'svelte';
	import { anchors, blocks, languages, seasons, updated } from '#lib/seasons';
	import { isoDay, shortDate } from '#lib/format';

	const DOMAINS = ['running', 'music', 'language', 'study'] as const;

	const DAY = 86_400_000;
	const at = (iso: string) => new Date(`${iso}T12:00:00`).getTime();
	const span = (from: string, to: string) => Math.round((at(to) - at(from)) / DAY);

	// The build date is the fallback, so the prerendered page shows the day it
	// was built. Hydration replaces it with the real day.
	const BUILT = isoDay(new Date());
	let today = $state(BUILT);

	onMount(() => {
		today = isoDay(new Date());
	});

	const first = blocks.map((block) => block.from).sort()[0];
	const last = blocks.map((block) => block.to).sort().at(-1)!;
	const total = span(first, last) + 1;

	const live = $derived(blocks.filter((block) => block.from <= today && today <= block.to));
	const season = $derived(seasons.find((s) => today >= s.from && today < s.to) ?? seasons[0]);

	/** Days until the next block starts or ends, wherever that is. */
	const nextChange = $derived(
		Math.min(
			...blocks
				.flatMap((block) => [block.from, block.to])
				.filter((date) => date > today)
				.map((date) => span(today, date))
		)
	);

	function lane(domain: (typeof DOMAINS)[number]) {
		return blocks.filter((block) => block.domain === domain);
	}

	/** Left edge and width of a date range on the strip, as percentages. */
	function place(from: string, to: string) {
		const a = Math.max(0, span(first, from));
		const b = Math.min(total, span(first, to) + 1);
		return `left: ${(a / total) * 100}%; width: ${(Math.max(b - a, 0) / total) * 100}%`;
	}

	function role(id: string) {
		const active = blocks.find(
			(block) =>
				block.domain === 'language' &&
				block.language === id &&
				block.from <= today &&
				today <= block.to
		);
		if (active) return { role: 'active' as const, dose: active.dose, target: active.target };

		const anchor = anchors.find(
			(item) => item.language === id && item.from <= today && today <= item.to
		);
		if (anchor) return { role: 'anchor' as const, dose: anchor.dose, target: anchor.target };

		const next = blocks
			.filter((block) => block.domain === 'language' && block.language === id && block.from > today)
			.sort((a, b) => (a.from < b.from ? -1 : 1))[0];

		return {
			role: 'dormant' as const,
			dose: '',
			target: next ? `opens ${shortDate(next.from)}` : '-'
		};
	}

	const roster = $derived(languages.map((language) => ({ ...language, ...role(language.id) })));

	const rank = { active: 0, anchor: 1, dormant: 2 } as const;
	const ordered = $derived([...roster].sort((a, b) => rank[a.role] - rank[b.role]));

	const vaultLink = (path: string) =>
		`obsidian://open?vault=Yggdrasil&file=${encodeURIComponent(path)}`;
</script>

<svelte:head>
	<title>seasons - bittanaycha</title>
	<meta
		name="description"
		content="Running, music, languages and study as blocks with a set length in weeks, side by side."
	/>
</svelte:head>

<main class="blocks">
	<header class="now">
		<div>
			<p class="tag">seasons</p>
			<h1>{season.name.toLowerCase()}</h1>
			<p class="line">
				{shortDate(today)} - {live.length} blocks live - next change in {nextChange} days
			</p>
		</div>
		<div class="legend">
			{#each DOMAINS as domain (domain)}
				<span class="tag">{domain}</span>
			{/each}
		</div>
	</header>

	<section class="strip">
		<div class="axis">
			{#each seasons as entry (entry.id)}
				{#if at(entry.to) > at(first) && at(entry.from) < at(last)}
					<div class="axis-mark" style={place(entry.from, entry.to)}>
						<span>{entry.name.toLowerCase()}</span>
					</div>
				{/if}
			{/each}
		</div>

		{#each DOMAINS as domain (domain)}
			{@const laneBlocks = lane(domain)}
			<div class="lane" class:empty={laneBlocks.length === 0}>
				<p class="lane-name">{domain}</p>
				<div class="rail">
					{#each laneBlocks as block (block.id)}
						<div
							class="bar"
							class:bar-live={live.some((item) => item.id === block.id)}
							style={place(block.from, block.to)}
						>
							<span>{block.title}</span>
							<span class="bar-weeks">{block.weeks}</span>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</section>

	<section class="panel">
		<p class="tag">running now</p>
		<ul class="live">
			{#each live as block (block.id)}
				<li>
					<span class="code">{block.domain}</span>
					<span class="name">{block.title}</span>
					<span class="dim">{shortDate(block.from)} - {shortDate(block.to)}</span>
					<span class="dim">{span(today, block.to) + 1} days left of {block.weeks} weeks</span>
					{#if block.dose}<span class="dim">{block.dose}</span>{/if}
				</li>
			{/each}
		</ul>
	</section>

	<section class="panel">
		<p class="tag">languages - one active at a time</p>
		<table>
			<thead>
				<tr>
					<th>language</th>
					<th>level</th>
					<th>aim</th>
					<th>stage</th>
					<th>now</th>
					<th>dose</th>
					<th>target</th>
				</tr>
			</thead>
			<tbody>
				{#each ordered as language (language.id)}
					<tr class:off={language.role === 'dormant'}>
						<td class="cell-name">{language.name}</td>
						<td>{language.level}</td>
						<td>{language.aim}</td>
						<td>{language.stage}</td>
						<td class="dim">{language.role}</td>
						<td>{language.dose || '-'}</td>
						<td>{language.target}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>

	<section class="panel">
		<p class="tag">how this is set</p>
		<p class="note">
			A block is a title, a start date and a length: <code>weeks</code> in the plan, four to the
			month. Running, music, one language and one study subject can all be going at once. Two
			blocks of the same kind cannot overlap, and only one language is ever active. Give a subject
			a start date and a length and it appears here. Everything lives in
			<code>seasons/plan.json</code>, then <code>npm run sync</code>.
		</p>
		<ul class="links">
			<li><a href={vaultLink('Seasons/Seasons Index.md')}>seasons index</a></li>
			<li><a href={vaultLink('Seasons/Next.md')}>next</a></li>
			<li><a href={vaultLink('Seasons/Reviews.md')}>reviews</a></li>
			<li><a href={vaultLink('Knowledge/Languages/Language Goals and Overview.md')}>goals</a></li>
		</ul>
		<p class="tag stamp">synced {shortDate(updated)}</p>
	</section>
</main>

<style>
	@font-face {
		font-family: 'Nothing';
		src: url('/fonts/nothing-font-5x7.otf') format('opentype');
		font-weight: 400;
		font-style: normal;
		font-display: block;
	}

	:global(html),
	:global(body) {
		background: #000;
		background-image: none;
	}

	/* The bark and the paper margins are for the other pages. On this one the
	   page itself is the sheet. */
	:global(.sea) {
		display: none;
	}

	:global(.deck) {
		max-width: none;
		padding: 1rem clamp(1rem, 4vw, 3rem) 0;
	}

	/* No islands on this page, so the ship has nothing to moor to. */
	:global(.ship) {
		display: none;
	}

	main {
		--ink: #fff;
		--dim: rgb(255 255 255 / 0.62);
		--faint: rgb(255 255 255 / 0.34);
		--rule: rgb(255 255 255 / 0.22);
		font-family: 'Nothing', ui-monospace, monospace;
		color: var(--ink);
		background: #000;
		padding: 2.2rem 0 6rem;
		width: 100%;
		max-width: 88rem;
		margin-inline: auto;
		display: flex;
		flex-direction: column;
		gap: clamp(1.5rem, 3vw, 2.4rem);
	}

	.tag {
		font-size: 0.7rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--faint);
		margin: 0;
	}

	.now {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 1.5rem;
		border-bottom: 1px solid var(--rule);
		padding-bottom: 1.1rem;
	}

	h1 {
		font-family: inherit;
		font-size: clamp(2.4rem, 6vw, 4rem);
		font-weight: 400;
		line-height: 0.95;
		margin: 0.4rem 0 0.7rem;
	}

	.line {
		margin: 0.15rem 0 0;
		font-size: 0.92rem;
		color: var(--dim);
	}

	.legend {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		justify-content: flex-end;
		max-width: 18rem;
	}

	.dim {
		color: var(--dim);
	}

	.strip {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.axis {
		position: relative;
		height: 1.5rem;
		border-bottom: 1px solid var(--rule);
		margin-left: 7.5rem;
	}

	.axis-mark {
		position: absolute;
		bottom: 0;
		height: 100%;
		border-left: 1px solid var(--rule);
	}

	.axis-mark span {
		position: absolute;
		bottom: 0.35rem;
		left: 0.35rem;
		font-size: 0.66rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--faint);
		white-space: nowrap;
	}

	.lane {
		display: grid;
		grid-template-columns: 6.5rem 1fr;
		align-items: center;
		gap: 1rem;
		font-size: 0.84rem;
	}

	.lane-name {
		margin: 0;
		color: var(--dim);
		font-size: 0.72rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.lane.empty .lane-name {
		color: var(--faint);
	}

	.rail {
		position: relative;
		height: 1.9rem;
		border-left: 1px solid var(--rule);
		border-right: 1px solid var(--rule);
	}

	.bar {
		position: absolute;
		top: 0.2rem;
		bottom: 0.2rem;
		border: 1px solid var(--rule);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0 0.45rem;
		font-size: 0.74rem;
		color: var(--dim);
		overflow: hidden;
		white-space: nowrap;
	}

	.bar-live {
		background: #fff;
		color: #000;
		border-color: #fff;
	}

	.bar-weeks {
		opacity: 0.65;
	}

	.panel {
		border-top: 1px solid var(--rule);
		padding-top: 1rem;
	}

	.live {
		list-style: none;
		margin: 0.8rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.live li {
		display: grid;
		grid-template-columns: 5.5rem 9rem 9rem 7rem 1fr;
		gap: 0.8rem;
		font-size: 0.86rem;
		align-items: baseline;
	}

	.code {
		color: var(--faint);
		text-transform: uppercase;
		font-size: 0.7rem;
		letter-spacing: 0.1em;
	}

	.off {
		color: var(--faint);
	}

	table {
		width: 100%;
		max-width: 100%;
		table-layout: fixed;
		border-collapse: collapse;
		margin-top: 0.9rem;
		font-size: 0.84rem;
	}

	td {
		word-break: break-word;
	}

	th {
		text-align: left;
		font-weight: 400;
		font-size: 0.66rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--faint);
		padding: 0 0.6rem 0.5rem 0;
	}

	td {
		padding: 0.45rem 0.6rem 0.45rem 0;
		border-top: 1px solid rgb(255 255 255 / 0.1);
		vertical-align: baseline;
	}

	.cell-name {
		white-space: nowrap;
	}

	.note {
		margin: 0.8rem 0 0;
		max-width: 46rem;
		font-size: 0.88rem;
		line-height: 1.55;
		color: var(--dim);
	}

	code {
		font-family: inherit;
		color: var(--ink);
	}

	.links {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 1.4rem;
		margin: 1.1rem 0 0;
		padding: 0;
		font-size: 0.84rem;
	}

	a {
		color: var(--ink);
		text-decoration: none;
		border-bottom: 1px solid var(--rule);
	}

	a:hover {
		background: #fff;
		color: #000;
	}

	.stamp {
		margin-top: 1.4rem;
	}

	@media (max-width: 60rem) {
		.now {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.8rem;
		}

		.legend {
			justify-content: flex-start;
			max-width: none;
		}

		.axis {
			margin-left: 0;
			margin-top: 1rem;
		}

		.lane {
			grid-template-columns: 1fr;
			gap: 0.3rem;
		}

		.live li {
			grid-template-columns: 4.6rem 1fr;
			row-gap: 0.1rem;
		}

		.live li > :nth-child(3),
		.live li > :nth-child(4),
		.live li > :nth-child(5) {
			grid-column: 1 / -1;
		}

		table {
			font-size: 0.74rem;
		}

		table th:nth-child(2),
		table td:nth-child(2),
		table th:nth-child(3),
		table td:nth-child(3),
		table th:nth-child(4),
		table td:nth-child(4),
		table th:nth-child(6),
		table td:nth-child(6) {
			display: none;
		}
	}
</style>
