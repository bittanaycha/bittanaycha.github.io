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

	const SIZE = 420;
	const C = SIZE / 2;
	const RIM = 196;
	const BAND = 172;
	const TICK = 166;
	const MONTH = 156;
	const RINGS: Record<string, number> = { running: 138, music: 124, study: 110, language: 96, 'language-2': 82 };
	const WIDTH = 9;

	const day = (iso: string) => new Date(`${iso}T12:00:00Z`).getTime();
	const DAY = 86_400_000;
	const start = $derived(day(from));
	const end = $derived(day(to));
	const total = $derived(end - start);

	/** 0 at the top of the circle, clockwise, as a fraction of the window. */
	function angle(date: string) {
		return ((day(date) - start) / total) * 360 - 90;
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

	const kindTone: Record<string, string> = {
		running: 'var(--ink)',
		music: '#d98b5f',
		study: '#a78bd4',
		language: '#7fa6dc',
		'language-2': '#4f6d92'
	};

	const tone = (name: string) => seasonTone[name.split(' ')[0]] ?? 'var(--ink)';

	const live = (block: Block) => block.from <= today && today <= block.to;

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
	<svg class="ring" class:pickable={Boolean(onpick)} viewBox="0 0 {SIZE} {SIZE}" aria-hidden="true">
	<circle cx={C} cy={C} r={RIM} class="rim" />

	{#each seasons as season (season.name + season.from)}
		<path d={arc(BAND + 10, angle(season.from), angle(season.to))} stroke={tone(season.name)} class="season" />
	{/each}

	{#each sekki as mark (mark.id)}
		<line
			x1={polar(RIM - 2, angle(mark.date))[0]}
			y1={polar(RIM - 2, angle(mark.date))[1]}
			x2={polar(TICK - 2, angle(mark.date))[0]}
			y2={polar(TICK - 2, angle(mark.date))[1]}
			class="sekki"
		/>
	{/each}

	{#each ko as mark (mark.id)}
		<line
			x1={polar(RIM - 2, angle(mark.date))[0]}
			y1={polar(RIM - 2, angle(mark.date))[1]}
			x2={polar(RIM - 6, angle(mark.date))[0]}
			y2={polar(RIM - 6, angle(mark.date))[1]}
			class="ko"
		/>
	{/each}

	{#each Array.from({ length: 12 }, (_, index) => index) as index (index)}
		{@const date = new Date(new Date(start).getUTCFullYear(), index, 1).toISOString().slice(0, 10)}
		{#if day(date) > start && day(date) < end}
			{@const [x, y] = polar(MONTH + 18, angle(date))}
			<text x={x} y={y} class="month" text-anchor="middle" dominant-baseline="middle">
				{new Date(date).toLocaleString('en', { month: 'short' }).toLowerCase()}
			</text>
		{/if}
	{/each}

	{#each blocks as block (block.id)}
		{@const span = clipped(block)}
		{#if span}
			<path
				d={arc(RINGS[block.kind] ?? 96, span.a, span.b)}
				stroke={kindTone[block.kind] ?? 'var(--ink)'}
				class="block"
				class:live={live(block)}
				class:dim={!live(block)}
			/>
		{/if}
	{/each}

	<line
		x1={polar(52, angle(today))[0]}
		y1={polar(52, angle(today))[1]}
		x2={polar(RIM - 1, angle(today))[0]}
		y2={polar(RIM - 1, angle(today))[1]}
		class="hand"
	/>
	<circle cx={polar(RIM + 4, angle(today))[0]} cy={polar(RIM + 4, angle(today))[1]} r="3.5" class="dot" />
	<circle cx={C} cy={C} r="44" class="hub" />
	</svg>
</svelte:element>

<style>
	.shell {
		display: block;
		width: 100%;
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
		stroke-width: 14;
		opacity: 0.55;
	}

	.sekki {
		stroke: var(--ink);
		stroke-width: 0.9;
		opacity: 0.5;
	}

	.ko {
		stroke: var(--ink);
		stroke-width: 0.6;
		opacity: 0.28;
	}

	.month {
		fill: var(--dim);
		font-size: 9px;
		letter-spacing: 0.08em;
	}

	.block {
		fill: none;
		stroke-width: 9;
		stroke-linecap: butt;
	}

	.block.dim {
		opacity: 0.34;
	}

	.block.live {
		opacity: 1;
	}

	.hand {
		stroke: var(--ink);
		stroke-width: 1;
		opacity: 0.75;
	}

	.dot {
		fill: var(--ink);
	}

	.hub {
		fill: #000;
		stroke: var(--rule);
	}
</style>
