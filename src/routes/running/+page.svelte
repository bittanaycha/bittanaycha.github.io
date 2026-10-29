<script lang="ts">
	import { onMount } from 'svelte';
	import { gates, race, totals, weeks } from '#lib/plan';
	import { dateRange, dotted, isoDay, shortDate } from '#lib/format';

	const peak = Math.max(...weeks.map((week) => week.km));
	const gateWeeks = new Set(gates.map((gate) => gate.week));

	// "Today" is read in the browser: the page is prerendered, so anything
	// computed at build time would be wrong by the time it is read.
	let today = $state<string | null>(null);
	let daysLeft = $state<number | null>(null);

	onMount(() => {
		const now = new Date();
		today = isoDay(now);
		daysLeft = Math.ceil((new Date(`${race.date}T08:30:00`).getTime() - now.getTime()) / 86_400_000);
	});

	const status = (start: string, end: string) => {
		if (!today) return '';
		if (today > end) return 'is-past';
		if (today >= start) return 'is-now';
		return '';
	};
</script>

<svelte:head>
	<title>running</title>
</svelte:head>

<main class="run">
	<h1 class="sr-only">running</h1>

	<header class="run-head">
		<div>
			<p class="run-date">{dotted(race.date)}</p>
			<p class="eyebrow">
				{race.time} · {race.place.toLowerCase()} · {race.distance} km
			</p>
		</div>
		<div class="countdown">
			<strong>{daysLeft ?? '—'}</strong>
			<span class="eyebrow">days</span>
		</div>
	</header>

	<section class="spark" aria-label="Weekly distance">
		<div class="bars">
			{#each weeks as week (week.week)}
				<div
					class="bar-col"
					class:bar-col--gate={gateWeeks.has(week.week)}
					class:bar-col--now={status(week.start, week.end) === 'is-now'}
					class:bar-col--done={status(week.start, week.end) === 'is-past'}
					title="{week.week} · {week.km} km"
				>
					{#if gateWeeks.has(week.week)}
						<span class="tick">{gates.find((gate) => gate.week === week.week)?.gate}</span>
					{/if}
					<div class="bar-fill" style="height: {(week.km / peak) * 100}%"></div>
				</div>
			{/each}
		</div>
		<div class="scale" aria-hidden="true">
			{#each weeks as week (week.week)}
				<span>{week.week % 5 === 0 ? week.week : ''}</span>
			{/each}
		</div>
	</section>

	<ul class="gates">
		{#each gates as gate (gate.gate)}
			<li>
				<span class="g-letter">{gate.gate}</span>
				<span class="g-date">{shortDate(gate.date)}</span>
				<span class="g-meta">{gate.distance.toLowerCase()} · {gate.place.toLowerCase()}</span>
			</li>
		{/each}
	</ul>

	<table class="weeks">
		<caption class="eyebrow">{totals.weekCount} weeks</caption>
		<thead>
			<tr>
				<th scope="col" class="w-num">wk</th>
				<th scope="col" class="h-date">dates</th>
				<th scope="col"></th>
				<th scope="col" class="h-phase">phase</th>
				<th scope="col" class="num">km</th>
				<th scope="col" class="num">long</th>
				<th scope="col" class="num">runs</th>
			</tr>
		</thead>
		<tbody>
			{#each weeks as week (week.week)}
				<tr class={status(week.start, week.end)}>
					<td class="w-num">{String(week.week).padStart(2, '0')}</td>
					<td class="w-date">{dateRange(week.start, week.end)}</td>
					<td class="w-focus">{week.focus}</td>
					<td class="w-phase">{week.phase}</td>
					<td class="num w-km">{week.km.toFixed(1)}</td>
					<td class="num w-sub">{week.long ? week.long.toFixed(1) : '—'}</td>
					<td class="num w-sub">{week.runs}</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<p class="totals">
		<span><b>{totals.training.toFixed(1)}</b> km training</span>
		<span><b>{totals.distance.toFixed(1)}</b> km with race</span>
		<span>peak <b>{totals.peak.toFixed(0)}</b> km w{totals.peakWeek}</span>
	</p>
</main>
