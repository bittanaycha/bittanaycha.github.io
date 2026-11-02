<script lang="ts">
	import { asset } from '$app/paths';
	import { onMount } from 'svelte';
	import { gates, race, totals, weeks } from '#lib/plan';
	import { days } from '#lib/days';
	import { runs } from '#lib/log';
	import { dateRange, dotted, isoDay, shortDate } from '#lib/format';
	import { distances, paceLabel, parseClock, solve } from '#lib/pace';
	import Segmented from '#lib/components/Segmented.svelte';

	const two = (value: number) => `${value}`.padStart(2, '0');

	const gateWeeks = new Map(gates.map((gate) => [gate.week, gate]));

	function loggedFor(week: (typeof weeks)[number]): number {
		return runs
			.filter((run) => run.date >= week.start && run.date <= week.end)
			.reduce((sum, run) => sum + run.km, 0);
	}

	const logged = weeks.map((week) => loggedFor(week));
	const peak = Math.max(...weeks.map((week) => week.km), ...logged);
	const loggedTotal = runs.reduce((sum, run) => sum + run.km, 0);
	const longestKm = runs.reduce((best, run) => Math.max(best, run.km), 0);
	const recent = [...runs].reverse();

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

	let todayDay = $derived.by(() => (today ? days.find((day) => day.date === today) : undefined));
	let todayWeek = $derived.by(() => {
		const now = today;
		return now ? weeks.find((week) => now >= week.start && now <= week.end) : undefined;
	});

	// A rest day's note is just the word "rest"; only a real session detail is
	// worth printing under the name.
	const detail = $derived.by(() => {
		if (!todayDay) return '';
		const note = todayDay.note.trim();
		if (!note || note === '—' || note === '-') return '';
		return note.toLowerCase() === todayDay.session.toLowerCase() ? '' : note;
	});

	// ------------------------------------------------------------------ tabs

	const tabs = [
		{ id: 'plan', label: 'plan' },
		{ id: 'log', label: 'log' },
		{ id: 'pace', label: 'pace' }
	] as const;

	type Tab = (typeof tabs)[number]['id'];
	let tab = $state<Tab>('plan');

	function onTabKey(event: KeyboardEvent) {
		const index = tabs.findIndex((entry) => entry.id === tab);
		let next: number;
		if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
		else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
		else if (event.key === 'Home') next = 0;
		else if (event.key === 'End') next = tabs.length - 1;
		else return;

		event.preventDefault();
		tab = tabs[next].id;
		document.getElementById(`tab-${tabs[next].id}`)?.focus();
	}

	// --------------------------------------------------------------- obsidian

	const vaultLink = (path: string) =>
		`obsidian://open?vault=Yggdrasil&file=${encodeURIComponent(path)}`;

	// ------------------------------------------------------------------- pace

	let distanceId = $state('5k');
	let time = $state('19:00');
	let rep = $state('3');

	const distance = $derived(distances.find((entry) => entry.id === distanceId) ?? distances[0]);
	const seconds = $derived(parseClock(time));
	const solution = $derived(seconds ? solve(distance.meters, seconds, Number(rep) * 60) : null);

	// Changing the distance carries its reference time with it, so the number on
	// screen is never a 5 km time read as a marathon.
	let lastDistance = '';
	$effect(() => {
		if (lastDistance && lastDistance !== distanceId) time = distance.defaultTime;
		lastDistance = distanceId;
	});

	const distanceOptions = distances.map((entry) => ({ value: entry.id, label: entry.label }));
	const repOptions = ['3', '6', '8', '10', '12'].map((value) => ({ value, label: value }));
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

	{#if todayDay && todayWeek}
		<section class="today" aria-label="Today">
			<div>
				<p class="eyebrow">
					{shortDate(todayDay.date)} · week {two(todayWeek.week)} · {todayWeek.phase}
				</p>
				<p class="today-session">{todayDay.session}</p>
				{#if detail}<p class="eyebrow">{detail}</p>{/if}
			</div>
			<p class="today-km">{todayDay.km ?? '—'}<span class="eyebrow">km</span></p>
		</section>
	{/if}

	<div class="tabs" role="tablist" aria-label="Running" tabindex="-1" onkeydown={onTabKey}>
		{#each tabs as entry (entry.id)}
			<button
				id="tab-{entry.id}"
				class="tab"
				role="tab"
				type="button"
				aria-selected={tab === entry.id}
				aria-controls="panel-{entry.id}"
				tabindex={tab === entry.id ? 0 : -1}
				onclick={() => (tab = entry.id)}
			>
				{entry.label}
			</button>
		{/each}
	</div>

	<div id="panel-plan" role="tabpanel" aria-labelledby="tab-plan" hidden={tab !== 'plan'}>
		<section class="spark" aria-label="Weekly distance, planned and logged">
			<div class="bars">
				{#each weeks as week, index (week.week)}
					<div
						class="plot-col"
						class:plot-col--gate={gateWeeks.has(week.week)}
						class:plot-col--now={status(week.start, week.end) === 'is-now'}
						class:plot-col--done={status(week.start, week.end) === 'is-past'}
						title="{week.week} · {week.km} km planned · {logged[index].toFixed(1)} km logged"
					>
						{#if gateWeeks.has(week.week)}
							<span class="tick">{gateWeeks.get(week.week)?.gate}</span>
						{/if}
						<span class="plot" style="height: {(week.km / peak) * 100}%">
							<span
								class="plot-log"
								style="height: {week.km > 0 ? Math.min(100, (logged[index] / week.km) * 100) : 0}%"
							></span>
						</span>
					</div>
				{/each}
			</div>
			<div class="scale" aria-hidden="true">
				{#each weeks as week (week.week)}
					<span>{week.week % 5 === 0 ? week.week : ''}</span>
				{/each}
			</div>
			<p class="legend">
				<span><i class="swatch swatch--plan"></i>planned</span>
				<span><i class="swatch swatch--log"></i>logged</span>
			</p>
		</section>

		<ul class="gates" aria-label="Gates">
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
					<th scope="col" class="num">logged</th>
					<th scope="col" class="num h-long">long</th>
					<th scope="col" class="num h-runs">runs</th>
				</tr>
			</thead>
			<tbody>
				{#each weeks as week, index (week.week)}
					<tr
						class={status(week.start, week.end)}
						class:gate={gateWeeks.has(week.week)}
					>
						<td class="w-num">{two(week.week)}</td>
						<td class="w-date">{dateRange(week.start, week.end)}</td>
						<td class="w-focus">{week.focus}</td>
						<td class="w-phase">{week.phase}</td>
						<td class="num w-km">{week.km.toFixed(1)}</td>
						<td class="num w-km w-logged">{logged[index] > 0 ? logged[index].toFixed(1) : '—'}</td>
						<td class="num w-sub h-long">{week.long ? week.long.toFixed(1) : '—'}</td>
						<td class="num w-sub h-runs">{week.runs}</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<p class="totals">
			<span><b>{totals.training.toFixed(1)}</b> km training</span>
			<span><b>{totals.distance.toFixed(1)}</b> km with race</span>
			<span>peak <b>{totals.peak.toFixed(0)}</b> km w{totals.peakWeek}</span>
			<span><b>{loggedTotal.toFixed(1)}</b> km logged</span>
		</p>
	</div>

	<div id="panel-log" role="tabpanel" aria-labelledby="tab-log" hidden={tab !== 'log'}>
		<dl class="facts log-facts">
			<div><dt class="eyebrow">runs</dt><dd>{runs.length}</dd></div>
			<div><dt class="eyebrow">km</dt><dd>{loggedTotal.toFixed(1)}</dd></div>
			<div><dt class="eyebrow">longest</dt><dd>{longestKm.toFixed(1)}</dd></div>
			<div><dt class="eyebrow">last</dt><dd>{recent.length ? shortDate(recent[0].date) : '—'}</dd></div>
		</dl>

		<table class="weeks log">
			<thead>
				<tr>
					<th scope="col">date</th>
					<th scope="col">session</th>
					<th scope="col" class="num">km</th>
					<th scope="col" class="num h-time">time</th>
					<th scope="col" class="num h-pace">pace</th>
					<th scope="col" class="num h-rpe">rpe</th>
					<th scope="col" class="h-note">notes</th>
				</tr>
			</thead>
			<tbody>
				{#each recent as run (run.date)}
					<tr>
						<td class="w-date">{shortDate(run.date)}</td>
						<td class="w-focus">{run.session}</td>
						<td class="num w-km">{run.km.toFixed(1)}</td>
						<td class="num w-sub h-time">{run.time}</td>
						<td class="num w-sub h-pace">{run.pace}</td>
						<td class="num w-sub h-rpe">{run.rpe || '—'}</td>
						<td class="run-note">{run.note}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<div id="panel-pace" role="tabpanel" aria-labelledby="tab-pace" hidden={tab !== 'pace'}>
		<div class="pace">
			<div class="pace-form">
				<Segmented label="distance" options={distanceOptions} columns={2} bind:value={distanceId} />
				<label class="field">
					<span class="eyebrow">time</span>
					<input
						class="clock"
						bind:value={time}
						inputmode="numeric"
						autocomplete="off"
						spellcheck="false"
					/>
				</label>
				<Segmented label="rep, min" options={repOptions} columns={5} bind:value={rep} />
			</div>

			<div class="pace-out" aria-live="polite">
				<p class="eyebrow">threshold</p>
				<p class="pace-big">{paceLabel(solution?.threshold ?? 0)}<span>/km</span></p>
				{#if solution}
					<dl class="facts">
						<div><dt class="eyebrow">vdot</dt><dd>{solution.vdot.toFixed(1)}</dd></div>
						<div><dt class="eyebrow">mile</dt><dd>{paceLabel(solution.mile)}/mi</dd></div>
						<div><dt class="eyebrow">speed</dt><dd>{solution.kmh.toFixed(1)} km/h</dd></div>
					</dl>
					<p class="eyebrow">
						{solution.band.label} · {paceLabel(solution.fast)}–{paceLabel(solution.slow)}/km ·
						{solution.shortest}–{solution.longest} m
					</p>
				{:else}
					<p class="eyebrow">mm:ss or h:mm:ss</p>
				{/if}
			</div>
		</div>
	</div>

	<footer class="run-links">
		<span class="eyebrow">obsidian</span>
		<a href={vaultLink('Marathon/Marathon Index.md')}>plan</a>
		{#if todayWeek}
			<a href={vaultLink(`Marathon/Weeks/Week ${two(todayWeek.week)}.md`)}>
				week {two(todayWeek.week)}
			</a>
		{/if}
		<a href={vaultLink('Marathon/Training Log.md')}>log</a>
		<a href={vaultLink('Marathon/Gates.md')}>gates</a>
	</footer>
	<img
		class="margin-plate margin-plate--hare"
		src={asset('animals/hare.webp' as 'animals/deer.webp')}
		alt=""
		aria-hidden="true"
		loading="lazy"
	/>
</main>
