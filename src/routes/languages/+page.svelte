<script lang="ts">
	import { onMount } from 'svelte';
	import { languages, seasons, updated, wheel } from '#lib/seasons';
	import { dateRange, isoDay, shortDate } from '#lib/format';

	const DAY = 86_400_000;
	const at = (iso: string) => new Date(`${iso}T12:00:00`).getTime();
	const days = (from: string, to: string) => Math.round((at(to) - at(from)) / DAY);

	// The build date is the fallback, so the prerendered page has the season it
	// was built in. Hydration replaces it with the real day.
	const BUILT = isoDay(new Date());
	let today = $state<string | null>(BUILT);

	onMount(() => {
		today = isoDay(new Date());
	});

	const spokeById = new Map(wheel.map((spoke) => [spoke.id, spoke]));

	const current = $derived.by(() => {
		const now = today;
		if (!now) return undefined;
		return seasons.find((season) => now >= season.from && now < season.to);
	});

	const next = $derived.by(() => {
		const now = today;
		if (!now) return undefined;
		return seasons.find((season) => season.from > now);
	});

	const across = $derived.by(() => {
		const now = today;
		if (!now) return undefined;
		return wheel.find((spoke) => spoke.date > now);
	});

	const remaining = $derived.by(() => {
		if (!today || !across) return null;
		return Math.round((at(across.date) - at(today)) / DAY);
	});

	const openSpoke = $derived.by(() => (current ? spokeById.get(current.opens) : undefined));
	const closeSpoke = $derived.by(() => (current ? spokeById.get(current.closes) : undefined));
	const gateSpoke = $derived.by(() =>
		current?.gate ? spokeById.get(current.gate.spoke) : undefined
	);

	// ------------------------------------------------------------------- wheel

	// The ring shows one turn: eight spokes from the one that opened the current
	// season. Sectors are drawn in proportion to real days, so the marker is
	// honest about where in the turn today sits.
	const turn = $derived.by(() => {
		const from = current ? wheel.findIndex((spoke) => spoke.id === current.opens) : 0;
		const ring = wheel.slice(Math.max(0, from), Math.max(0, from) + 9);
		if (ring.length < 2) return null;

		const total = days(ring[0].date, ring[ring.length - 1].date);
		const sectors = [];
		let angle = -90;

		for (let i = 0; i < ring.length - 1; i += 1) {
			const sweep = (days(ring[i].date, ring[i + 1].date) / total) * 360;
			sectors.push({ spoke: ring[i], from: angle, to: angle + sweep, days: days(ring[i].date, ring[i + 1].date) });
			angle += sweep;
		}

		return { ring, sectors, total };
	});

	const CX = 180;
	const CY = 180;
	const RI = 96;
	const RO = 132;

	const point = (radius: number, angle: number) => {
		const rad = (angle * Math.PI) / 180;
		return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
	};

	const arc = (radius: number, from: number, to: number, sweep: boolean) => {
		const a = point(radius, from);
		const b = point(radius, to);
		const large = Math.abs(to - from) > 180 ? 1 : 0;
		return `A ${radius} ${radius} 0 ${large} ${sweep ? 1 : 0} ${b.x} ${b.y}`;
	};

	const sectorPath = (from: number, to: number) => {
		const startOuter = point(RO, from);
		const startInner = point(RI, from);
		return `M ${startOuter.x} ${startOuter.y} ${arc(RO, from, to, true)} L ${point(RI, to).x} ${point(RI, to).y} ${arc(RI, to, from, false)} Z`;
	};

	const labelAnchor = (angle: number) => {
		const deg = ((angle % 360) + 360) % 360;
		if (deg > 20 && deg < 160) return 'start';
		if (deg > 200 && deg < 340) return 'end';
		return 'middle';
	};

	const markerAngle = $derived.by(() => {
		if (!turn || !today) return null;
		const sector = turn.sectors.find((entry) => today! >= entry.spoke.date);
		if (!sector) return null;
		const seen = (at(today) - at(sector.spoke.date)) / DAY;
		return sector.from + (seen / sector.days) * (sector.to - sector.from);
	});

	// ------------------------------------------------------------------- roles

	const RANK: Record<string, number> = { active: 0, secondary: 1, anchor: 2, dormant: 3 };

	const order = (season: (typeof seasons)[number] | undefined) => {
		if (!season) return [];
		return [...languages].sort((a, b) => {
			const ra = RANK[season.roles[a.id]?.role ?? 'dormant'];
			const rb = RANK[season.roles[b.id]?.role ?? 'dormant'];
			if (ra !== rb) return ra - rb;
			return a.name.localeCompare(b.name);
		});
	};

	const rows = $derived(order(current));

	const nextActivation = (id: string) => {
		const now = today;
		if (!now) return undefined;
		return seasons.find((season) => season.from > now && season.roles[id]?.role !== 'dormant');
	};

	const vaultLink = (path: string) =>
		`obsidian://open?vault=Yggdrasil&file=${encodeURIComponent(path)}`;

	const seasonName = (season: (typeof seasons)[number]) =>
		`${spokeById.get(season.opens)?.short ?? season.opens} → ${spokeById.get(season.closes)?.short ?? season.closes}`;
</script>

<svelte:head>
	<title>languages</title>
</svelte:head>

<main class="lang">
	<h1 class="sr-only">languages — the eight-spoke season wheel and the language portfolio</h1>

	<header class="lang-head island">
		<div>
			{#if current && openSpoke && closeSpoke}
				<p class="lang-date">{dateRange(current.from, current.to)}</p>
				<p class="eyebrow plain">{openSpoke.name} → {closeSpoke.name}</p>
			{:else}
				<p class="lang-date">{updated}</p>
				<p class="eyebrow plain">calan gaeaf → alban arthan</p>
			{/if}
		</div>
		<div class="countdown">
			<strong>{remaining ?? '—'}</strong>
			<span class="eyebrow">days · {across ? across.short.toLowerCase() : '—'}</span>
		</div>
	</header>

	{#if turn}
		<section class="wheel island" aria-label="The wheel">
			<p class="eyebrow">the turn</p>
			<svg viewBox="0 0 360 360" role="img" aria-label="The eight spokes of the year">
				<g class="ring">
					{#each turn.sectors as sector, index (sector.spoke.id + index)}
						<path
							class="sector"
							class:sector--quarter={sector.spoke.kind === 'quarter'}
							class:sector--open={current ? sector.spoke.id === current.opens : false}
							class:sector--done={today ? sector.spoke.date < today : false}
							d={sectorPath(sector.from, sector.to)}
						/>
					{/each}
				</g>
				{#if markerAngle !== null}
					<g class="marker">
						<line
							x1={point(RI, markerAngle).x}
							y1={point(RI, markerAngle).y}
							x2={point(RO, markerAngle).x}
							y2={point(RO, markerAngle).y}
						/>
						<circle cx={point(RO + 9, markerAngle).x} cy={point(RO + 9, markerAngle).y} r="3.4" />
					</g>
				{/if}
				{#each turn.sectors as sector (sector.spoke.id + 'label')}
					<text
						class="spoke-label"
						class:spoke-label--quarter={sector.spoke.kind === 'quarter'}
						x={point(RO + 18, (sector.from + sector.to) / 2).x}
						y={point(RO + 18, (sector.from + sector.to) / 2).y}
						text-anchor={labelAnchor((sector.from + sector.to) / 2)}
						dominant-baseline="middle">{sector.spoke.short}</text
					>
				{/each}
			</svg>

			<ul class="spokes">
				{#each turn.sectors as sector (sector.spoke.id)}
					<li class:is-now={current ? sector.spoke.id === current.opens : false}>
						<span class="sp-name">{sector.spoke.name}</span>
						<span class="sp-date">{shortDate(sector.spoke.date)}</span>
						<span class="sp-kind">{sector.spoke.label}</span>
					</li>
				{/each}
			</ul>
		</section>

		<section class="season island" aria-label="This season">
			<div class="season-head">
				<p class="eyebrow">this season</p>
				{#if current}
					<p class="season-primary">
						primary —
						{#if current.primary === 'marathon'}
							<a href="/running">marathon</a>
						{:else}
							{current.primary}
						{/if}
					</p>
					{#if current.gate && gateSpoke}
						<p class="eyebrow plain">gate {shortDate(current.gate.date)} · {gateSpoke.short}</p>
					{:else}
						<p class="eyebrow plain">no gate · a short spoke</p>
					{/if}
				{/if}
			</div>

			<dl class="roles">
				{#each rows as language (language.id)}
					{@const entry = current?.roles[language.id]}
					<div class="role" class:role--active={entry?.role === 'active'}>
						<dt>
							<span class="role-mark">{language.mark}</span>
							<span class="role-name">{language.name}</span>
							<span class="role-kind">{entry?.role ?? '—'}</span>
						</dt>
						<dd>
							{#if entry && entry.dose}
								<span class="role-dose">{entry.dose}</span>
								<span class="role-target">{entry.target}</span>
							{:else}
								<span class="role-target">{entry?.target ?? '—'}</span>
							{/if}
						</dd>
					</div>
				{/each}
			</dl>

			{#if next}
				<p class="season-next">
					next · {spokeById.get(next.opens)?.short} {shortDate(next.from)} · primary {next.primary}
				</p>
			{/if}
		</section>

		<section class="portfolio island" aria-label="The portfolio">
			<table class="langs">
				<caption class="eyebrow plain">{languages.length} languages</caption>
				<thead>
					<tr>
						<th scope="col">language</th>
						<th scope="col">level</th>
						<th scope="col">aim</th>
						<th scope="col" class="h-stage">stage</th>
						<th scope="col">role</th>
						<th scope="col">dose</th>
						<th scope="col" class="h-target">target</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as language (language.id)}
						{@const entry = current?.roles[language.id]}
						{@const nextRole = nextActivation(language.id)}
						<tr class:is-dormant={entry?.role === 'dormant'}>
							<td class="l-name"><span class="role-mark">{language.mark}</span>{language.name}</td>
							<td class="l-level">{language.level}</td>
							<td class="l-aim">{language.aim}</td>
							<td class="l-stage">{language.stage}</td>
							<td class="l-role">{entry?.role ?? '—'}</td>
							<td class="l-dose">{entry?.dose || '—'}</td>
							<td class="l-target h-target">
								{#if entry?.role === 'dormant' && nextRole}
									{spokeById.get(nextRole.opens)?.short} · {shortDate(nextRole.from)}
								{:else}
									{entry?.target ?? '—'}
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>

		</section>

		<section class="lang-links island" aria-label="The vault">
			<a href={vaultLink('Seasons/Seasons Index.md')}>seasons index</a>
			<a href={vaultLink('Seasons/Next.md')}>next</a>
			<a href={vaultLink('Seasons/Reviews.md')}>reviews</a>
			<a href={vaultLink('Knowledge/Languages/Language Goals and Overview.md')}>goals</a>
		</section>
	{/if}
</main>

<style>
	.lang {
		display: grid;
		grid-template-columns: repeat(12, minmax(0, 1fr));
		column-gap: clamp(0.7rem, 1.5vw, 1.2rem);
		row-gap: clamp(1.1rem, 2.4vw, 1.9rem);
		align-items: start;
		align-content: start;
		padding-top: clamp(1.2rem, 4vh, 2.5rem);
	}

	.lang > .island {
		padding: clamp(1.1rem, 2.4vw, 1.7rem);
	}

	.lang-head {
		grid-column: 1 / span 6;
		grid-row: 1;
		display: grid;
		gap: 1rem;
		align-items: end;
		grid-template-columns: 1fr auto;
	}

	.lang-date {
		margin: 0;
		font-size: clamp(1.6rem, 3.4vw, 2.3rem);
		line-height: 1;
		letter-spacing: -0.03em;
		color: var(--ink);
	}

	.countdown {
		display: flex;
		flex-direction: column-reverse;
		align-items: flex-end;
		gap: 0.35rem;
		justify-self: end;
		text-align: right;
	}

	.countdown strong {
		font-weight: 400;
		font-size: clamp(2.4rem, 6vw, 3.6rem);
		line-height: 0.9;
		letter-spacing: -0.04em;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}

	.wheel {
		grid-column: 1 / span 7;
		grid-row: 2;
	}

	.wheel svg {
		display: block;
		width: min(100%, 23rem);
		height: auto;
		margin: clamp(0.6rem, 2vw, 1.4rem) auto clamp(1rem, 2.5vw, 1.8rem);
		overflow: visible;
	}

	.sector {
		fill: rgb(247 242 230 / 0.16);
		stroke: var(--card-ink);
		stroke-opacity: 0.28;
		stroke-width: 0.75;
		transition: fill 0.3s ease;
	}

	.sector--quarter {
		fill: rgb(247 242 230 / 0.3);
	}

	.sector--done {
		fill: rgb(247 242 230 / 0.08);
	}

	.sector--open {
		fill: var(--accent);
		stroke: var(--accent);
		stroke-opacity: 1;
	}

	.marker line {
		stroke: var(--accent-deep);
		stroke-width: 2.5;
	}

	.marker circle {
		fill: var(--accent-deep);
	}

	.spoke-label {
		fill: var(--ink-dim);
		font-family: var(--mono);
		font-size: 9px;
		letter-spacing: 0.02em;
	}

	.spoke-label--quarter {
		fill: var(--ink);
	}

	.spokes {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0 1.4rem;
		font-size: 0.7rem;
		font-variant-numeric: tabular-nums;
	}

	.spokes li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0 0.5rem;
		padding: 0.3rem 0;
		border-bottom: 1px solid color-mix(in oklab, var(--rule) 45%, transparent);
		color: var(--ink-faint);
	}

	.spokes .sp-name {
		color: var(--ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.spokes .sp-date {
		color: var(--ink-dim);
	}

	.spokes .sp-kind {
		grid-column: 1 / -1;
		font-size: 0.6rem;
		color: var(--ink-faint);
	}

	.spokes li.is-now .sp-name,
	.spokes li.is-now .sp-date {
		color: var(--accent);
	}

	.season {
		grid-column: 8 / span 5;
		grid-row: 2;
	}

	.season-head {
		display: grid;
		gap: 0.3rem;
		padding-bottom: 0.9rem;
		border-bottom: 1px solid var(--rule);
	}

	.season-head p {
		margin: 0;
	}

	.season-primary {
		font-size: 1.15rem;
		color: var(--ink);
	}

	.season-primary a {
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 3px;
	}

	.roles {
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0;
	}

	.role {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
		gap: 0.5rem;
		padding: 0.55rem 0;
		border-bottom: 1px solid color-mix(in oklab, var(--rule) 45%, transparent);
		font-size: 0.74rem;
	}

	.role:last-child {
		border-bottom: 0;
	}

	.role dt {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.role dd {
		margin: 0;
		display: grid;
		gap: 0.1rem;
	}

	.role-mark {
		margin-right: 0.2rem;
	}

	.role-name {
		color: var(--ink);
	}

	.role-kind {
		font-size: 0.6rem;
		letter-spacing: 0.06em;
		color: var(--ink-faint);
	}

	.role--active .role-kind {
		color: var(--accent);
	}

	.role-dose {
		color: var(--ink-dim);
		font-variant-numeric: tabular-nums;
	}

	.role-target {
		font-size: 0.66rem;
		color: var(--ink-faint);
	}

	.portfolio {
		grid-column: 1 / span 11;
		grid-row: 3;
	}

	.langs {
		width: 100%;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}

	.langs caption {
		text-align: left;
		padding-bottom: 0.75rem;
	}

	.langs th {
		font-family: var(--mono);
		font-size: 0.55rem;
		font-weight: 400;
		letter-spacing: 0.06em;
		color: var(--ink-faint);
		text-align: left;
		padding: 0 0.6rem 0.5rem 0;
		border-bottom: 1px solid var(--rule);
	}

	.langs td {
		border-bottom: 1px solid color-mix(in oklab, var(--rule) 45%, transparent);
		padding: 0.55rem 0.6rem 0.55rem 0;
		vertical-align: baseline;
		font-size: 0.72rem;
	}

	.l-name {
		color: var(--ink);
		white-space: nowrap;
	}

	.l-level,
	.l-aim,
	.l-stage {
		color: var(--ink-dim);
		white-space: nowrap;
	}

	.l-role {
		color: var(--ink);
		white-space: nowrap;
	}

	.l-dose,
	.l-target {
		color: var(--ink-faint);
	}

	tr.is-dormant td {
		color: var(--ink-faint);
	}

	tr.is-dormant .l-name,
	tr.is-dormant .l-role {
		color: var(--ink-dim);
	}

	.season-next {
		margin: 0.9rem 0 0;
		padding-top: 0.7rem;
		border-top: 1px solid var(--rule);
		font-size: 0.66rem;
		letter-spacing: 0.04em;
		color: var(--ink-faint);
	}

	.lang-links {
		grid-column: 8 / span 5;
		grid-row: 4;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1.1rem;
		font-size: 0.68rem;
	}

	.lang-links a {
		color: var(--ink-dim);
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 3px;
	}

	.lang-links a:hover {
		color: var(--ink);
	}

	@media (max-width: 60rem) {
		.lang-head,
		.wheel,
		.season,
		.portfolio,
		.lang-links {
			grid-column: 1 / -1;
			grid-row: auto;
		}

		.wheel {
			grid-template-columns: minmax(0, 1fr);
		}

		.spokes {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.langs .h-target,
		.langs .h-stage {
			display: none;
		}
	}
</style>
