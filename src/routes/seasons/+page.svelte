<script lang="ts">
	import Ring from '#lib/components/Ring.svelte';
	import { isoDay, numDate } from '#lib/format';
	import { SLOTS, weeks, type Assignment } from '#lib/plan-rules';

	let { data } = $props();

	const DAY = 86_400_000;
	const at = (iso: string) => new Date(`${iso}T12:00:00Z`).getTime();
	const span = (from: string, to: string) => Math.round((at(to) - at(from)) / DAY);

	// The server's day is the fallback; hydration refreshes it in case the page
	// was cached across midnight.
	// svelte-ignore state_referenced_locally
	let today = $state(data.today);

	$effect(() => {
		const now = isoDay(new Date());
		if (now !== today) today = now;
	});

	const blocks = $derived(data.ready ? data.blocks : []);
	const assignments = $derived(data.ready ? data.assignments : []);
	const languages = $derived(data.ready ? data.languages : []);

	/** The strip covers the same turn as the ring, never a longer plan. */
	const first = $derived(data.window.from);
	const last = $derived(data.window.to);
	const total = $derived(span(first, last) + 1);

	/** Slots held today, by language id. Unassigned is not a slot. */
	const holding = $derived.by(() => {
		const map = new Map<string, Assignment>();
		for (const item of assignments) {
			if (item.from <= today && today <= item.to) map.set(item.language, item);
		}
		return map;
	});

	/** A bar that misses the window entirely has no width, only overflow. */
	const inWindow = (from: string, to: string) => from <= last && to >= first;

	/**
	 * One rail per season and then one per slot, outward to inward. A slot is a
	 * lane even when it is empty: that is what makes it a slot rather than a
	 * label on a language. Every lane shares one tone; the group headings and
	 * the gap between them do the separating.
	 */
	const lanes = $derived.by(() => {
		const seasons = [...blocks]
			.sort((a, b) => (a.from < b.from ? -1 : 1))
			.map((block) => ({
				id: `block-${block.id}`,
				group: 'season' as const,
				slot: null,
				label: block.title,
				tone: 'var(--ink)',
				bars: inWindow(block.from, block.to)
					? [
							{
								id: block.id,
								title: block.title,
								icon: block.icon,
								from: block.from,
								to: block.to,
							}
						]
					: []
			}));

		const slots = SLOTS.map((slot) => ({
			id: `slot-${slot}`,
			group: 'language' as const,
			label: slot,
			slot,
			tone: 'var(--ink)',
			bars: assignments
				.filter((item) => item.slot === slot && inWindow(item.from, item.to))
				.sort((a, b) => (a.from < b.from ? -1 : 1))
				.map((item) => ({
					id: `${item.language}-${item.from}`,
					title: languages.find((language) => language.id === item.language)?.name ?? item.language,
					icon: '',
					from: item.from,
					to: item.to,
				}))
		}));

		return [...seasons, ...slots];
	});

	const groups = $derived(
		[
			{ id: 'seasons', label: 'seasons', lanes: lanes.filter((lane) => lane.group === 'season') },
			{
				id: 'languages',
				label: 'languages',
				lanes: lanes.filter((lane) => lane.group === 'language')
			}
		].filter((group) => group.lanes.length > 0)
	);

	/** Left edge and width of a date range on the strip, as percentages. */
	function place(from: string, to: string) {
		const a = Math.max(0, span(first, from));
		const b = Math.min(total, span(first, to) + 1);
		return `left: ${(a / total) * 100}%; width: ${(Math.max(b - a, 0) / total) * 100}%`;
	}

	const vaultLink = (path: string) =>
		`obsidian://open?vault=Yggdrasil&file=${encodeURIComponent(path)}`;
</script>

<svelte:head>
	<title>seasons - bittanaycha</title>
	<meta
		name="description"
		content="Six languages in three slots, and the seasons for running, music and study."
	/>
</svelte:head>

<main class="blocks">
	<h1 class="sr-only">seasons - {data.seasonName?.toLowerCase() ?? 'the year'}</h1>

	<section class="ring-card">
		<div class="ring-wrap">
		{#if data.ready}
			<Ring
				from={data.window.from}
				to={data.window.to}
				seasons={data.seasons}
				anchor={data.solstice}
				{lanes}
				{today}
				marks={data.marks}
			/>
		{/if}
		</div>
		<div class="ring-note">
			{#if data.ready && data.ko}
				<p class="tag">this kō</p>
				<p class="ko">{data.ko.name}</p>
				<p class="kana">{data.ko.detail}</p>
			{/if}
		</div>
	</section>

	<section class="strip">
		{#each groups as group (group.id)}
			<div class="group">
				<p class="group-name">{group.label}</p>
				<span class="group-rule" aria-hidden="true"></span>
			</div>
			{#each group.lanes as lane (lane.id)}
				<div class="lane" class:empty={lane.bars.length === 0} style:--tone={lane.tone}>
					<p class="lane-name">{lane.label}</p>
					<div class="rail">
						{#each lane.bars as bar (bar.id)}
							<div
								class="bar"
								class:bar-language={Boolean(lane.slot)}
								class:bar-live={bar.from <= today && today <= bar.to}
								style={place(bar.from, bar.to)}
								style:--tone={lane.tone}
							>
								<span class="bar-title">
									{#if bar.icon}<span class="bar-icon" aria-hidden="true">{bar.icon}</span>{/if}
									<span class="bar-name">{bar.title}</span>
								</span>
								<span class="bar-weeks">{lane.slot
										? `${bar.to.slice(8)}/${bar.to.slice(5, 7)}`
										: weeks(bar.from, bar.to)}</span>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		{/each}
	</section>

	<section class="panel">
		<p class="tag">languages</p>
		<table>
			<thead>
				<tr>
					<th>language</th>
					<th>level</th>
					<th>state</th>
					<th>aim</th>
					<th>stage</th>
					<th>now</th>
				</tr>
			</thead>
			<tbody>
				{#each languages as language (language.id)}
					{@const held = holding.get(language.id) ?? null}
					<tr class:off={!held}>
						<td class="cell-name">{language.name}</td>
						<td>{language.level}</td>
						<td class="dim">{language.state || '-'}</td>
						<td>{language.aim}</td>
						<td>{language.stage}</td>
						<td class="dim">{held?.slot ?? '-'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>

	<section class="panel">
		<ul class="links">
			<li><a href="/seasons/edit">{data.editor ? 'edit' : 'edit the plan'}</a></li>
			<li><a href={vaultLink('Seasons/Seasons Index.md')}>seasons index</a></li>
			<li><a href={vaultLink('Seasons/Next.md')}>next</a></li>
			<li><a href={vaultLink('Seasons/Reviews.md')}>reviews</a></li>
			<li><a href={vaultLink('Knowledge/Languages/Language Goals and Overview.md')}>goals</a></li>
		</ul>
		<p class="tag stamp">synced {numDate(data.updated ?? today)}</p>
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

	main {
		font-family: 'Nothing', ui-monospace, monospace;
		color: var(--ink);
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

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.dim {
		color: var(--dim);
	}

	.ring-card {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: clamp(1rem, 2.5vw, 2.5rem);
		border-bottom: 1px dotted var(--rule);
		padding-bottom: 1.6rem;
		margin-bottom: 1.6rem;
	}

	.ring-wrap {
		flex: 1 1 100%;
		max-width: min(100%, 60rem, calc(100dvh - 5.5rem));
		margin-inline: auto;
	}

	.ring-note {
		align-self: end;
		padding-bottom: 1rem;
	}

	.ring-note .ko {
		font-family: 'DotGothic16', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Noto Sans JP', sans-serif;
		font-size: clamp(1.4rem, 2.4vw, 2rem);
		letter-spacing: 0.06em;
		margin: 0.2rem 0 0.1rem;
		color: var(--summer);
	}

	.kana {
		color: var(--dim);
		margin: 0;
		font-size: 0.76rem;
		letter-spacing: 0.04em;
	}

	.strip {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.group {
		display: grid;
		grid-template-columns: 9rem 1fr;
		align-items: center;
		gap: 1rem;
		margin-top: 0.9rem;
	}

	.strip .group:first-child {
		margin-top: 0;
	}

	.group-name {
		margin: 0;
		color: var(--dim);
		font-size: 0.62rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	.group-rule {
		border-top: 1px dotted var(--rule);
	}

	.lane {
		display: grid;
		grid-template-columns: 9rem 1fr;
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
		border-left: 1px dotted var(--rule);
		border-right: 1px dotted var(--rule);
		background-image: radial-gradient(circle, var(--faint) 0.55px, transparent 0.8px);
		background-size: 6px 6px;
		background-position: 0 0;
	}

	.bar {
		position: absolute;
		top: 0.2rem;
		bottom: 0.2rem;
		border: 1px solid color-mix(in srgb, var(--tone, var(--ink)) 48%, transparent);
		background-color: color-mix(in srgb, var(--tone, var(--ink)) 14%, transparent);
		background-image: radial-gradient(
			circle at 1px 1px,
			color-mix(in srgb, var(--tone, var(--ink)) 72%, transparent) 0.85px,
			transparent 1.1px
		);
		background-size: 4px 4px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0 0.45rem;
		font-size: 0.74rem;
		color: var(--ink);
		overflow: hidden;
		white-space: nowrap;
	}

	.bar-live {
		background-color: var(--tone, var(--ink));
		background-image: radial-gradient(
			circle at 1px 1px,
			color-mix(in srgb, var(--bg) 34%, transparent) 1px,
			transparent 1.2px
		);
		background-size: 4px 4px;
		color: var(--live-ink);
		border-color: var(--tone, var(--ink));
	}

	.bar-weeks {
		flex: none;
		opacity: 0.7;
	}

	.bar-title {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
	}

	.bar-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/*
	 * Emoji arrive as colour glyphs, so they are flattened to a silhouette and
	 * then tinted by the theme: light on the dark sheet, dark on the light one.
	 * Only the live bar inverts, because its ground is the ink itself.
	 */
	.bar-icon {
		flex: none;
		font-size: 0.95rem;
		line-height: 1;
		opacity: 0.85;
		filter: var(--icon-filter);
	}

	.bar-live .bar-icon {
		filter: var(--icon-filter-live);
	}

	.panel {
		border-top: 1px dotted var(--rule);
		padding-top: 1rem;
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
		border-top: 1px dotted var(--rule);
		vertical-align: baseline;
	}

	.cell-name {
		white-space: nowrap;
	}

	.cell-name::before {
		content: '';
		display: inline-block;
		width: 5px;
		height: 5px;
		margin-right: 0.55rem;
		background: var(--summer);
		vertical-align: 0.05em;
	}

	:global(code) {
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
		border-bottom: 1px dotted var(--rule);
	}

	a:hover {
		background: var(--summer);
		color: var(--live-ink);
		border-color: var(--summer);
	}

	.stamp {
		margin-top: 1.4rem;
	}

	@media (max-width: 60rem) {
		.ring-wrap {
			flex-basis: 100%;
		}

		.group {
			grid-template-columns: 1fr;
			gap: 0.35rem;
		}

		.lane {
			grid-template-columns: 1fr;
			gap: 0.3rem;
		}

		table {
			font-size: 0.74rem;
		}

		table th:nth-child(2),
		table td:nth-child(2),
		table th:nth-child(3),
		table td:nth-child(3),
		table th:nth-child(5),
		table td:nth-child(5) {
			display: none;
		}
	}

</style>
