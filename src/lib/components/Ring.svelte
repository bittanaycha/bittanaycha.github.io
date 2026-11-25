<script lang="ts">
	/**
	 * The year as a circle: seasons on the rim, blocks as concentric arcs, today
	 * as a hand. Everything is drawn from dates, so the ring is as accurate as
	 * the plan is.
	 */
	type Mark = { id: string; system: string; name: string; detail: string; date: string };
	type Bar = {
		id: string;
		title: string;
		from: string;
		to: string;
		/** The season's glyph, centred on its arc. Empty for a language. */
		icon?: string;
	};
	type Lane = {
		id: string;
		label: string;
		tone: string;
		/** Seasons and languages are two groups on the strip; the ring opens a gap. */
		group?: 'season' | 'language';
		bars: Bar[];
	};
	type Season = { name: string; from: string; to: string };

	let {
		from,
		to,
		seasons,
		lanes,
		today,
		anchor,
		marks = [],
		labels = true,
		onpick,
		cursor
	}: {
		from: string;
		to: string;
		seasons: Season[];
		lanes: Lane[];
		today: string;
		/** The winter solstice pinned to nine o'clock. */
		anchor: string;
		marks?: Mark[];
		/** The kō names around the rim. Off where the ring is a date picker. */
		labels?: boolean;
		onpick?: (date: string) => void;
		/** A date being edited, marked on the rim. */
		cursor?: string | null;
	} = $props();

	// The canvas is bigger than the wheel: the 72 kō need the ring outside it.
	// Everything below scales with RIM, so the wheel stays a circle of the same
	// proportions whatever the page gives it.
	const SIZE = 800;
	const C = SIZE / 2;
	const RIM = 300;
	const BAND = 263;
	const MONTH = 239;
	const OUTER = 211;
	const INSET = 88;
	const STEP = 24;
	const WIDTH = 15;
	const GLYPH = 13.5;

	const day = (iso: string) => new Date(`${iso}T12:00:00Z`).getTime();
	const DAY = 86_400_000;
	const start = $derived(day(from));
	const end = $derived(day(to));
	const total = $derived(end - start);

	/**
	 * Degrees clockwise from nine o'clock. The winter solstice is always at
	 * 180, so the left of the wheel is the same point in the year whatever the
	 * window holds.
	 */
	const opening = $derived(180 + ((start - day(anchor)) / total) * 360);

	function angle(date: string) {
		const raw = 180 + ((day(date) - day(anchor)) / total) * 360;
		return Math.min(opening + 360, Math.max(opening, raw));
	}

	const polar = (radius: number, degrees: number) => {
		const rad = (degrees * Math.PI) / 180;
		return [C + radius * Math.cos(rad), C + radius * Math.sin(rad)] as const;
	};

	function arc(radius: number, a1: number, a2: number) {
		const sweep = Math.max(0, Math.min(360, a2 - a1));
		if (sweep >= 359.9) {
			const [x1, y1] = polar(radius, a1);
			const [x2, y2] = polar(radius, a1 + 180);
			return `M ${x1} ${y1} A ${radius} ${radius} 0 1 1 ${x2} ${y2} A ${radius} ${radius} 0 1 1 ${x1} ${y1}`;
		}
		const [x1, y1] = polar(radius, a1);
		const [x2, y2] = polar(radius, a2);
		return `M ${x1} ${y1} A ${radius} ${radius} 0 ${sweep > 180 ? 1 : 0} 1 ${x2} ${y2}`;
	}

	/**
	 * The season band is a filled wedge rather than a thick stroke. Angles
	 * follow the same clamp as `angle`.
	 */
	function band(inner: number, outer: number, a1: number, a2: number) {
		const sweep = Math.max(0, Math.min(360, a2 - a1));
		const large = sweep > 180 ? 1 : 0;
		if (sweep >= 359.9) {
			const [ox, oy] = polar(outer, a1);
			const [ox2, oy2] = polar(outer, a1 + 180);
			const [ix, iy] = polar(inner, a1);
			const [ix2, iy2] = polar(inner, a1 + 180);
			return [
				`M ${ox} ${oy} A ${outer} ${outer} 0 1 1 ${ox2} ${oy2} A ${outer} ${outer} 0 1 1 ${ox} ${oy} Z`,
				`M ${ix} ${iy} A ${inner} ${inner} 0 1 0 ${ix2} ${iy2} A ${inner} ${inner} 0 1 0 ${ix} ${iy} Z`
			].join(' ');
		}
		const [ox, oy] = polar(outer, a1);
		const [ox2, oy2] = polar(outer, a2);
		const [ix2, iy2] = polar(inner, a2);
		const [ix, iy] = polar(inner, a1);
		return `M ${ox} ${oy} A ${outer} ${outer} 0 ${large} 1 ${ox2} ${oy2} L ${ix2} ${iy2} A ${inner} ${inner} 0 ${large} 0 ${ix} ${iy} Z`;
	}

	/**
	 * The spokes a bar covers inside the window. Dates outside are clipped, not
	 * carried round the seam: the window is one turn of real time, so a bar that
	 * runs past the end belongs in the next turn, not at the start of this one.
	 */
	function spans(bar: Bar): { from: number; to: number }[] {
		const a = Math.max(day(bar.from), start);
		const b = Math.min(day(bar.to), end);
		if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return [];
		return [{ from: a - start, to: b - start }];
	}

	const degrees = (offset: number) => opening + (offset / total) * 360;

	const seasonTone: Record<string, string> = {
		spring: 'var(--season-spring)',
		summer: 'var(--season-summer)',
		autumn: 'var(--season-autumn)',
		winter: 'var(--season-winter)'
	};

	/**
	 * Every lane gets a ring; the rings shrink to fit however many there are.
	 * The language lanes sit in a second group, so a gap wider than the lane
	 * spacing opens where the seasons end.
	 */
	const split = $derived(lanes.findIndex((lane) => lane.group === 'language'));
	const groupGap = $derived(split > 0 ? STEP : 0);
	const gap = $derived(
		lanes.length > 1 ? Math.min(STEP, (OUTER - INSET - groupGap) / (lanes.length - 1)) : 0
	);
	const laneWidth = $derived(Math.max(5, Math.min(WIDTH, gap * 0.62)));
	/** The icon sits on a disc wide enough to cut the arc cleanly. */
	const badge = $derived(Math.max(6, laneWidth * 0.7));
	const radiusOf = (index: number) =>
		OUTER - index * gap - (split > 0 && index >= split ? groupGap : 0);

	const tone = (name: string) => seasonTone[name.split(' ')[0]] ?? 'var(--ink)';

	const live = (bar: Bar) => bar.from <= today && today <= bar.to;

	const inside = (date: string) => date >= from && date <= to;

	/** Whatever the pointer is over, and where it is, so the label can follow it. */
	type Tip = { head: string; body: string; tone: string };
	let tip = $state<Tip | null>(null);
	let at = $state({ x: 0, y: 0 });

	function follow(event: MouseEvent) {
		at = { x: event.clientX, y: event.clientY };
	}

	function show(event: MouseEvent, next: Tip) {
		follow(event);
		tip = next;
	}

	function hide() {
		tip = null;
	}

	const weeks = (bar: Bar) => Math.round((day(bar.to) - day(bar.from) + DAY) / (7 * DAY));

	const left = (bar: Bar) => Math.round((day(bar.to) - day(today)) / DAY);

	/** How the bar stands today: days to go, days until it starts, or done. */
	function standing(bar: Bar) {
		if (today < bar.from) return `starts in ${Math.round((day(bar.from) - day(today)) / DAY)} days`;
		const days = left(bar);
		if (days < 0) return 'done';
		if (days === 0) return 'last day';
		return `${days} days left`;
	}

	/** Day first, everywhere: 11/04/2027. */
	function numDate(iso: string) {
		const [year, month, date] = iso.split('-');
		return `${date}/${month}/${year}`;
	}

	/** The first of every month the window covers, so the band can carry names. */
	// total is milliseconds; a turn of the year is 365 or 366 days.
	const long = $derived(total / DAY > 400);

	const months = $derived.by(() => {
		const out: string[] = [];
		const first = new Date(start);
		let year = first.getUTCFullYear();
		let month = first.getUTCMonth();
		for (;;) {
			const date = Date.UTC(year, month, 1);
			if (date > end) break;
			if (date > start) out.push(new Date(date).toISOString().slice(0, 10));
			month += 1;
			if (month > 11) {
				month = 0;
				year += 1;
			}
		}
		return out;
	});

	const ko = $derived(marks.filter((mark) => mark.system === 'ko'));

	// Year-and-a-bit windows pack in more than one kō per degree of arc, so a
	// label is only drawn when it has room: the rest keep their tick.
	const koLabels = $derived(
		[...ko]
			.sort((a, b) => angle(a.date) - angle(b.date))
			.reduce<typeof ko>((kept, mark) => {
				const last = kept[kept.length - 1];
				if (last && angle(mark.date) - angle(last.date) < (long ? 6.5 : 4.2)) return kept;
				return [...kept, mark];
			}, [])
	);
	const sekki = $derived(marks.filter((mark) => mark.system === 'sekki'));

	let shell: HTMLElement | undefined = $state();

	function pick(event: MouseEvent) {
		if (!onpick || !shell) return;
		const box = shell.getBoundingClientRect();
		const x = event.clientX - (box.left + box.width / 2);
		const y = event.clientY - (box.top + box.height / 2);
		// The hub is not a date; leave clicks there alone. Follow the drawn
		// size, or the inner lanes of a small ring fall inside the dead zone.
		const hub = (66 + 2) * (box.width / SIZE);
		if (Math.hypot(x, y) < hub) return;
		let turned = (Math.atan2(y, x) * 180) / Math.PI;
		while (turned < opening) turned += 360;
		while (turned >= opening + 360) turned -= 360;
		const at = new Date(day(anchor) + ((turned - 180) / 360) * total);
		onpick(at.toISOString().slice(0, 10));
	}
</script>

<svelte:element
	this={onpick ? 'button' : 'div'}
	type={onpick ? 'button' : undefined}
	class="shell"
	bind:this={shell}
	role={onpick ? 'button' : 'img'}
	aria-label={onpick ? 'The year: click a date to pick it' : 'The year in blocks and seasons'}
	onclick={pick}
>
	<svg
		class="ring"
		class:pickable={Boolean(onpick)}
		viewBox="0 0 800 800"
		aria-hidden="true"
		onmouseleave={hide}
	>
	<circle cx={C} cy={C} r={RIM} class="rim" />

	{#each seasons as season (season.name + season.from)}
		<path
			d={band(BAND + 11, BAND + 33, angle(season.from), angle(season.to))}
			fill={tone(season.name)}
			class="season"
			onmouseenter={(event) =>
				show(event, {
					head: season.name,
					body: `${numDate(season.from)} to ${numDate(season.to)}`,
					tone: tone(season.name)
				})}
			onmousemove={follow}
			onmouseleave={hide}
			role="presentation"
		/>
	{/each}

	{#each sekki as mark (mark.id)}
		<line
			x1={polar(RIM - 3, angle(mark.date))[0]}
			y1={polar(RIM - 3, angle(mark.date))[1]}
			x2={polar(RIM - 22, angle(mark.date))[0]}
			y2={polar(RIM - 22, angle(mark.date))[1]}
			class="sekki"
		/>
	{/each}

	{#each ko as mark (mark.id)}
		<line
			x1={polar(RIM - 3, angle(mark.date))[0]}
			y1={polar(RIM - 3, angle(mark.date))[1]}
			x2={polar(RIM - 11, angle(mark.date))[0]}
			y2={polar(RIM - 11, angle(mark.date))[1]}
			class="ko"
		/>
	{/each}

	{#each labels ? koLabels : [] as mark (mark.id)}
		{@const degrees = angle(mark.date)}
		{@const outset = RIM + 22}
		{@const glyphs = [...mark.name]}
		<g
			class="ko-label"
			role="presentation"
			onmouseenter={(event) =>
				show(event, { head: mark.name, body: mark.detail, tone: 'var(--ink)' })}
			onmousemove={follow}
			onmouseleave={hide}
		>
			{#each glyphs as glyph, index (index)}
				{@const [x, y] = polar(outset + (glyphs.length - 1 - index) * GLYPH, degrees)}
				<text
					x={x}
					y={y}
					class="ko-glyph"
					text-anchor="middle"
					dominant-baseline="middle"
					transform="rotate({degrees + 90} {x} {y})">{glyph}</text>
			{/each}
		</g>
	{/each}

	{#each months as date (date)}
		{@const degrees = angle(date)}
		{@const [x, y] = polar(MONTH - 6, degrees)}
		<line
			x1={polar(BAND + 11, degrees)[0]}
			y1={polar(BAND + 11, degrees)[1]}
			x2={polar(BAND - 11, degrees)[0]}
			y2={polar(BAND - 11, degrees)[1]}
			class="month-tick"
		/>
		{#if labels}
			<text x={x} y={y} class="month" text-anchor="middle" dominant-baseline="middle">
				{new Date(date).toLocaleString('en', { month: 'short' }).toLowerCase()}{long
					? ` ${date.slice(2, 4)}`
					: ''}
			</text>
		{/if}
	{/each}

	{#each lanes as lane, index (lane.id)}
		{@const radius = radiusOf(index)}
		<g style:--lane-width={`${laneWidth}px`}>
			<circle
				cx={C}
				cy={C}
				r={radius}
				class="rail"
				class:empty={lane.bars.length === 0}
				style:stroke={lane.tone}
			/>
			{#each lane.bars as bar (bar.id)}
				{#each spans(bar) as piece (piece.from)}
					<path
						d={arc(radius, degrees(piece.from), degrees(piece.to))}
						stroke={lane.tone}
						class="block"
						class:live={live(bar)}
						class:dim={!live(bar)}
						onmouseenter={(event) =>
							show(event, {
								head: bar.title === lane.label ? bar.title : `${lane.label} - ${bar.title}`,
								body: `${numDate(bar.from)} to ${numDate(bar.to)} - ${weeks(bar)} weeks - ${standing(bar)}`,
								tone: lane.tone
							})}
						onmousemove={follow}
						onmouseleave={hide}
						role="presentation"
					/>
					{#if bar.icon && ((piece.to - piece.from) / total) * 2 * Math.PI * radius > badge * 2.6}
						{@const [ix, iy] = polar(radius, degrees((piece.from + piece.to) / 2))}
						<g class="lane-icon" aria-hidden="true">
							<circle cx={ix} cy={iy} r={badge} />
							<text x={ix} y={iy} text-anchor="middle" dominant-baseline="central">
								{bar.icon}
							</text>
						</g>
					{/if}
				{/each}
			{/each}
		</g>
	{/each}

	{#if inside(today)}
		<line
			x1={polar(78, angle(today))[0]}
			y1={polar(78, angle(today))[1]}
			x2={polar(RIM - 4, angle(today))[0]}
			y2={polar(RIM - 4, angle(today))[1]}
			class="hand"
		/>
		<circle cx={polar(RIM + 7, angle(today))[0]} cy={polar(RIM + 7, angle(today))[1]} r="5" class="dot" />
	{/if}

	{#if cursor && inside(cursor)}
		<circle
			cx={polar(RIM + 7, angle(cursor))[0]}
			cy={polar(RIM + 7, angle(cursor))[1]}
			r="4"
			class="cursor"
		/>
	{/if}

	<circle cx={C} cy={C} r="66" class="hub" />
	</svg>

	{#if tip}
		<div
			class="tip"
			style:left={`${Math.min(at.x + 16, window.innerWidth - 236)}px`}
			style:top={`${Math.min(at.y + 18, window.innerHeight - 72)}px`}
			style:--tip-tone={tip.tone}
		>
			<span class="tip-head">{tip.head}</span>
			<span class="tip-body">{tip.body}</span>
		</div>
	{/if}
</svelte:element>

<style>
	.shell {
		display: block;
		width: 100%;
		max-width: min(100%, 60rem, calc(100dvh - 5.5rem));
		margin-inline: auto;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		outline-offset: 4px;
	}

	.ring {
		width: 100%;
		height: auto;
		display: block;
		overflow: visible;
	}

	.pickable {
		cursor: crosshair;
	}

	.rim {
		fill: none;
		stroke: var(--rule);
		stroke-width: 1;
	}

	.season {
		opacity: 1;
	}

	.sekki {
		stroke: var(--ink);
		stroke-width: 1.6;
		opacity: 0.5;
	}

	.ko {
		stroke: var(--ink);
		stroke-width: 1;
		opacity: 0.28;
	}

	.month {
		fill: var(--dim);
		font-size: 9.5px;
		letter-spacing: 0.04em;
		font-family: 'DotGothic16', ui-monospace, monospace;
	}

	.month-tick {
		stroke: var(--ink);
		stroke-width: 1;
		opacity: 0.22;
	}

	.ko-glyph {
		fill: var(--ink);
		fill-opacity: 0.8;
		font-size: 13px;
		font-family: 'DotGothic16', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Noto Sans JP', sans-serif;
		letter-spacing: 0;
	}

	.ko-label:hover .ko-glyph {
		fill-opacity: 1;
		font-weight: 600;
	}

	/* Seventy-two names need the room that a phone does not have. */
	@media (max-width: 60rem) {
		.ko-label {
			display: none;
		}
	}

	/* A rail is the lane's whole turn: the slot exists even where it is empty. */
	.rail {
		fill: none;
		stroke-width: var(--lane-width);
		opacity: 0.16;
		pointer-events: none;
	}

	.rail.empty {
		opacity: 0.05;
	}

	.block {
		fill: none;
		stroke-width: var(--lane-width);
		stroke-linecap: butt;
		pointer-events: stroke;
		cursor: default;
	}

	.block:hover {
		stroke-width: calc(var(--lane-width) + 4px);
	}

	.block.dim {
		opacity: 0.34;
	}

	.block.live {
		opacity: 1;
	}

	/* A season's glyph sits in a disc cut out of its arc, so the bar reads as
	   the thing carrying the icon rather than as a background for it. */
	.lane-icon {
		pointer-events: none;
	}

	.lane-icon circle {
		fill: var(--bg, #000);
	}

	.lane-icon text {
		fill: var(--ink);
		font-size: calc(var(--lane-width) * 0.96);
		font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
		filter: var(--icon-filter, none);
	}

	.hand {
		stroke: var(--ink);
		stroke-width: 1.6;
		opacity: 0.75;
	}

	.dot {
		fill: var(--ink);
	}

	.cursor {
		fill: var(--bg, #000);
		stroke: var(--ink);
		stroke-width: 1.5;
	}

	.hub {
		fill: color-mix(in srgb, var(--bg, #000) 55%, transparent);
		stroke: var(--rule);
	}

	.tip {
		position: fixed;
		z-index: 20;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		max-width: 15rem;
		padding: 0.45rem 0.6rem;
		border: 1px solid var(--rule, rgb(255 255 255 / 0.28));
		border-left: 3px solid var(--tip-tone, var(--ink));
		background: var(--bg, #000);
		color: var(--ink);
		font-size: 0.68rem;
		line-height: 1.35;
		letter-spacing: 0.04em;
		pointer-events: none;
	}

	.tip-head {
		text-transform: lowercase;
	}

	.tip-body {
		color: var(--dim, rgb(255 255 255 / 0.62));
	}
</style>
