<script lang="ts">
	/**
	 * The year as a circle: seasons on the rim, blocks as concentric arcs, today
	 * as a hand. Everything is drawn from dates, so the ring is as accurate as
	 * the plan is.
	 */
	type Mark = { id: string; system: string; name: string; detail: string; date: string };
	type Block = {
		id: string;
		kind: string;
		title: string;
		from: string;
		to: string;
	};
	type Season = { name: string; from: string; to: string };

	let {
		from,
		to,
		seasons,
		blocks,
		today,
		marks = [],
		onpick
	}: {
		from: string;
		to: string;
		seasons: Season[];
		blocks: Block[];
		today: string;
		marks?: Mark[];
		onpick?: (date: string) => void;
	} = $props();

	// The canvas is bigger than the wheel: the 72 kō need the ring outside it.
	// Everything below scales with RIM, so the wheel stays a circle of the same
	// proportions whatever the page gives it.
	const SIZE = 800;
	const C = SIZE / 2;
	const RIM = 300;
	const BAND = 263;
	const TICK = 254;
	const MONTH = 239;
	const OUTER = 211;
	const STEP = 22;
	const WIDTH = 14;
	const GLYPH = 13.5;

	const day = (iso: string) => new Date(`${iso}T12:00:00Z`).getTime();
	const DAY = 86_400_000;
	const start = $derived(day(from));
	const end = $derived(day(to));
	const total = $derived(end - start);

	/**
	 * Degrees clockwise from the window's first day. The window starts at the
	 * winter solstice, and that point sits at the left of the circle: the year
	 * turns from 9 o'clock through 12 to 3 and round to 6.
	 */
	function angle(date: string) {
		return ((day(date) - start) / total) * 360 + 180;
	}

	const polar = (radius: number, degrees: number) => {
		const rad = (degrees * Math.PI) / 180;
		return [C + radius * Math.cos(rad), C + radius * Math.sin(rad)] as const;
	};

	function arc(radius: number, a1: number, a2: number) {
		const sweep = ((a2 - a1) % 360 + 360) % 360;
		if (sweep >= 359.9) {
			const [x1, y1] = polar(radius, a1);
			const [x2, y2] = polar(radius, a1 + 180);
			return `M ${x1} ${y1} A ${radius} ${radius} 0 1 1 ${x2} ${y2} A ${radius} ${radius} 0 1 1 ${x1} ${y1}`;
		}
		const [x1, y1] = polar(radius, a1);
		const [x2, y2] = polar(radius, a2);
		return `M ${x1} ${y1} A ${radius} ${radius} 0 ${sweep > 180 ? 1 : 0} 1 ${x2} ${y2}`;
	}

	/** A block clipped to the window, so something running past it still reads. */
	function clipped(block: Block) {
		const a = Math.max(day(block.from), start);
		const b = Math.min(day(block.to), end);
		if (b < a) return null;
		return { a: angle(new Date(a).toISOString().slice(0, 10)), b: angle(new Date(b).toISOString().slice(0, 10)) };
	}

	const seasonTone: Record<string, string> = {
		spring: 'var(--spring)',
		summer: 'var(--summer)',
		autumn: 'var(--autumn)',
		winter: 'var(--winter)'
	};

	/** Two language rails sit inside the season rails, so they get their own two. */
	const PALETTE = ['var(--ink)', '#d98b5f', '#a78bd4', '#7fa6dc', '#4f6d92', '#c9b458'];

	const radiusOf = (index: number) => Math.max(96, OUTER - index * STEP);
	const toneOf = (index: number) => PALETTE[index % PALETTE.length];

	const RAIL: Record<string, number> = { language: 147, 'language-2': 125 };
	const RAIL_TONE: Record<string, string> = { language: '#7fa6dc', 'language-2': '#4f6d92' };

	const tone = (name: string) => seasonTone[name.split(' ')[0]] ?? 'var(--ink)';

	const live = (block: Block) => block.from <= today && today <= block.to;

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

	const weeks = (block: Block) => Math.round((day(block.to) - day(block.from) + DAY) / (7 * DAY));

	const left = (block: Block) => Math.round((day(block.to) - day(today)) / DAY);

	/** How the band stands today: days to go, days until it starts, or done. */
	function standing(block: Block) {
		if (today < block.from) return `starts in ${Math.round((day(block.from) - day(today)) / DAY)} days`;
		const days = left(block);
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
	const sekki = $derived(marks.filter((mark) => mark.system === 'sekki'));

	let shell: HTMLElement | undefined = $state();

	function pick(event: MouseEvent) {
		if (!onpick || !shell) return;
		const box = shell.getBoundingClientRect();
		const x = event.clientX - box.left - (box.width * C) / SIZE;
		const y = event.clientY - box.top - (box.height * C) / SIZE;
		let degrees = (Math.atan2(y, x) * 180) / Math.PI + 90;
		if (degrees < 0) degrees += 360;
		const at = new Date(start + (degrees / 360) * total);
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
			d={arc(BAND + 22, angle(season.from), angle(season.to))}
			stroke={tone(season.name)}
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

	{#each ko as mark (mark.id)}
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
		<text x={x} y={y} class="month" text-anchor="middle" dominant-baseline="middle">
			{new Date(date).toLocaleString('en', { month: 'short' }).toLowerCase()}
		</text>
	{/each}

	{#each blocks as block, index (block.id)}
		{@const span = clipped(block)}
		{@const radius = RAIL[block.kind] ?? radiusOf(index)}
		{@const tone = RAIL_TONE[block.kind] ?? toneOf(index)}
		{#if span}
			<path
				d={arc(radius, span.a, span.b)}
				stroke={tone}
				class="block"
				class:live={live(block)}
				class:dim={!live(block)}
				onmouseenter={(event) =>
					show(event, {
						head: `${block.kind} - ${block.title}`,
						body: `${numDate(block.from)} to ${numDate(block.to)} - ${weeks(block)} weeks - ${standing(block)}`,
						tone
					})}
				onmousemove={follow}
				onmouseleave={hide}
				role="presentation"
			/>
		{/if}
	{/each}

	<line
		x1={polar(78, angle(today))[0]}
		y1={polar(78, angle(today))[1]}
		x2={polar(RIM - 4, angle(today))[0]}
		y2={polar(RIM - 4, angle(today))[1]}
		class="hand"
	/>
	<circle cx={polar(RIM + 7, angle(today))[0]} cy={polar(RIM + 7, angle(today))[1]} r="5" class="dot" />
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
		max-width: min(100%, calc(100dvh - 7rem));
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
		fill: none;
		stroke-width: 22;
		opacity: 0.55;
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

	.block {
		fill: none;
		stroke-width: 14;
		stroke-linecap: butt;
		pointer-events: stroke;
		cursor: default;
	}

	.block:hover {
		stroke-width: 20;
	}

	.block.dim {
		opacity: 0.34;
	}

	.block.live {
		opacity: 1;
	}

	.hand {
		stroke: var(--ink);
		stroke-width: 1.6;
		opacity: 0.75;
	}

	.dot {
		fill: var(--ink);
	}

	.hub {
		fill: #000;
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
		border: 1px solid rgb(255 255 255 / 0.28);
		border-left: 3px solid var(--tip-tone, var(--ink));
		background: #000;
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
