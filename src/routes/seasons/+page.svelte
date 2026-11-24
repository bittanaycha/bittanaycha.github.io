<script lang="ts">
	import Ring from '#lib/components/Ring.svelte';
	import { dotted, isoDay, shortDate } from '#lib/format';
	import { KINDS, SLOTS, type Assignment } from '#lib/plan-rules';

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

	/** The window the strip covers: from the first start to the last end. */
	const first = $derived(blocks.map((block) => block.from).sort()[0] ?? today);
	const last = $derived(blocks.map((block) => block.to).sort().at(-1) ?? today);
	const total = $derived(span(first, last) + 1);

	const season = $derived(
		data.ready
			? (data.seasons.find((entry) => entry.from <= today && today < entry.to) ?? data.seasons[0])
			: null
	);

	/** Slots held today, by language id. Anything unassigned is tertiary. */
	const holding = $derived.by(() => {
		const map = new Map<string, Assignment>();
		for (const item of assignments) {
			if (item.from <= today && today <= item.to) map.set(item.language, item);
		}
		return map;
	});

	const slotOf = (id: string) => holding.get(id)?.slot ?? 'tertiary';

	const bySlot = $derived.by(() => {
		const out: Record<string, { language: string; name: string; assignment: Assignment | null }[]> =
			{ primary: [], secondary: [], tertiary: [] };
		for (const language of languages) {
			const assignment = holding.get(language.id) ?? null;
			out[assignment?.slot ?? 'tertiary'].push({
				language: language.id,
				name: language.name,
				assignment
			});
		}
		return out;
	});

	const live = $derived(blocks.filter((block) => block.from <= today && today <= block.to));

	const nextChange = $derived.by(() => {
		const dates = [...blocks, ...assignments]
			.flatMap((row) => [row.from, row.to])
			.filter((date) => date > today);
		return dates.length ? Math.min(...dates.map((date) => span(today, date))) : 0;
	});

	function lane(kind: string) {
		return blocks.filter((block) => block.kind === kind);
	}

	/** Left edge and width of a date range on the strip, as percentages. */
	function place(from: string, to: string) {
		const a = Math.max(0, span(first, from));
		const b = Math.min(total, span(first, to) + 1);
		return `left: ${(a / total) * 100}%; width: ${(Math.max(b - a, 0) / total) * 100}%`;
	}

	/** The assignments as bars on the language lane, so the slot changes show. */
	const languageBars = $derived(
		assignments.map((item) => ({
			id: `${item.language}-${item.from}`,
			slot: item.slot,
			name: languages.find((language) => language.id === item.language)?.name ?? item.language,
			from: item.from,
			to: item.to
		}))
	);

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
	<header class="now">
		<div>
			<p class="tag">seasons</p>
			<h1>{data.seasonName?.toLowerCase() ?? 'the year'}</h1>
			<p class="line">
				{shortDate(today)} - {live.length} season{live.length === 1 ? '' : 's'} live - next change in
				{nextChange} days
			</p>
		</div>
		<div class="legend">
			{#each KINDS as kind (kind)}
				<span class="tag">{kind}</span>
			{/each}
			<span class="tag">language</span>
		</div>
	</header>

	<section class="ring-card">
		{#if data.ready}
			<Ring
				from={data.window.from}
				to={data.window.to}
				seasons={data.seasons}
				blocks={[
					...blocks.map((block) => ({ id: block.id, kind: block.kind, title: block.title, from: block.from, to: block.to })),
					...languageBars
						.filter((bar) => bar.slot !== 'tertiary')
						.map((bar) => ({
							id: bar.id,
							kind: bar.slot === 'secondary' ? 'language-2' : 'language',
							title: bar.name,
							from: bar.from,
							to: bar.to
						}))
				]}
				{today}
				marks={data.marks}
			/>
		{/if}
		<div class="ring-note">
			{#if data.ready && data.ko}
				<p class="tag">this kō</p>
				<p class="ko">{data.ko.name}</p>
				<p class="dim">{data.ko.detail}</p>
			{/if}
			{#if data.ready}
				<p class="dim">
					{dotted(data.window.from)} to {dotted(data.window.to)} - 24 sekki and 72 kō on the rim
				</p>
			{/if}
		</div>
	</section>

	<section class="slots">
		{#each SLOTS as slot (slot)}
			<div class="slot" class:slot-dim={slot === 'tertiary'}>
				<p class="tag">{slot}</p>
				{#each bySlot[slot] as held (held.language)}
					<p class="slot-name">{held.name}</p>
					{#if held.assignment}
						<p class="dim">{held.assignment.dose || '-'}</p>
						<p class="dim">{held.assignment.target || '-'}</p>
						<p class="dim slot-dates">
							{shortDate(held.assignment.from)} - {shortDate(held.assignment.to)}
						</p>
					{:else}
						<p class="dim">maintenance only</p>
					{/if}
				{:else}
					<p class="slot-name dim">-</p>
				{/each}
			</div>
		{/each}
	</section>

	<section class="strip">
		<div class="axis">
			{#each data.ready ? data.seasons : [] as entry (entry.from)}
				{#if at(entry.to) > at(first) && at(entry.from) < at(last)}
					<div class="axis-mark" style={place(entry.from, entry.to)}>
						<span>{entry.name.toLowerCase()}</span>
					</div>
				{/if}
			{/each}
		</div>

		{#each KINDS as kind (kind)}
			{@const laneBlocks = lane(kind)}
			<div class="lane" class:empty={laneBlocks.length === 0}>
				<p class="lane-name">{kind}</p>
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

		{#each ['primary', 'secondary'] as slot (slot)}
			{@const bars = languageBars.filter((bar) => bar.slot === slot)}
			<div class="lane" class:empty={bars.length === 0}>
				<p class="lane-name">language {slot === 'primary' ? '1' : '2'}</p>
				<div class="rail">
					{#each bars as bar (bar.id)}
						<div
							class="bar bar-language"
							class:bar-live={bar.from <= today && today <= bar.to}
							style={place(bar.from, bar.to)}
						>
							<span>{bar.name}</span>
							<span class="bar-weeks">{bar.to.slice(5)}</span>
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
					<span class="code">{block.kind}</span>
					<span class="name">{block.title}</span>
					<span class="dim">{shortDate(block.from)} - {shortDate(block.to)}</span>
					<span class="dim">day {span(block.from, today) + 1} of {block.weeks * 7}</span>
					{#if block.dose}<span class="dim">{block.dose}</span>{/if}
				</li>
			{/each}
		</ul>
	</section>

	<section class="panel">
		<p class="tag">languages - one primary, one secondary, the rest maintenance</p>
		<table>
			<thead>
				<tr>
					<th>language</th>
					<th>level</th>
					<th>state</th>
					<th>aim</th>
					<th>stage</th>
					<th>now</th>
					<th>dose</th>
					<th>target</th>
				</tr>
			</thead>
			<tbody>
				{#each languages as language (language.id)}
					{@const held = holding.get(language.id) ?? null}
					<tr class:off={!held || held.slot === 'tertiary'}>
						<td class="cell-name">{language.name}</td>
						<td>{language.level}</td>
						<td class="dim">{language.state || '-'}</td>
						<td>{language.aim}</td>
						<td>{language.stage}</td>
						<td class="dim">{held?.slot ?? 'tertiary'}</td>
						<td>{held?.dose || '-'}</td>
						<td>{held?.target || '-'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>

	<section class="panel">
		<p class="tag">how this is set</p>
		<p class="note">
			Six languages, three slots: one primary, one secondary, the rest maintenance. The slots carry
			dates, so the year can be planned. Running, music and study are seasons instead: a kind, a
			name and two dates, as long or as short as the thing is. Start and end can be set on the ring,
			or snapped to a quarter day, a fire festival, a meteorological season or any of the 24 sekki
			and 72 kō.
			{#if data.editor}
				<a href="/seasons/edit">Edit the plan</a>.
			{:else}
				The plan is yours to read.
			{/if}
		</p>
		<ul class="links">
			<li><a href={vaultLink('Seasons/Seasons Index.md')}>seasons index</a></li>
			<li><a href={vaultLink('Seasons/Next.md')}>next</a></li>
			<li><a href={vaultLink('Seasons/Reviews.md')}>reviews</a></li>
			<li><a href={vaultLink('Knowledge/Languages/Language Goals and Overview.md')}>goals</a></li>
		</ul>
		<p class="tag stamp">synced {shortDate(data.updated ?? today)}</p>
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

	.ring-card {
		display: grid;
		grid-template-columns: minmax(0, 26rem) minmax(0, 1fr);
		align-items: center;
		column-gap: clamp(1rem, 3vw, 2.5rem);
		border-bottom: 1px solid var(--rule);
		padding-bottom: 1.6rem;
		margin-bottom: 1.6rem;
	}

	.ring-note {
		align-self: end;
		padding-bottom: 1rem;
	}

	.ring-note .ko {
		font-size: clamp(1.4rem, 2.4vw, 2rem);
		letter-spacing: 0.06em;
		margin: 0.2rem 0 0.1rem;
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

		.ring-card {
			grid-template-columns: minmax(0, 1fr);
			row-gap: 1.2rem;
		}

		.slots {
			grid-template-columns: minmax(0, 1fr);
			row-gap: 1.2rem;
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
	.slots {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: clamp(1rem, 2.5vw, 2rem);
		border-bottom: 1px solid var(--rule);
		padding-bottom: 1.5rem;
	}

	.slot p {
		margin: 0.1rem 0;
	}

	.slot-name {
		font-size: 1.2rem;
		letter-spacing: 0.06em;
		margin-top: 0.35rem !important;
	}

	.slot-dim {
		opacity: 0.55;
	}

	.slot-dates {
		margin-top: 0.35rem !important;
	}

	.bar-language {
		border-color: rgb(127 166 220 / 0.7);
	}

	.bar {
		overflow: hidden;
	}

	.bar span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

</style>
