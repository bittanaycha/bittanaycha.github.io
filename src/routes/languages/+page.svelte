<script lang="ts">
	import { CEFR, index as rung, languages } from '#lib/languages';

	/* One cubic for every branch: M0 26 C200 26 400 7 600 7 in a 600×34 box.
	   The leaves are placed on the same curve so they sit on the wood. */
	const TOP = 34;
	const P = [26, 26, 7, 7] as const;

	const onCurve = (t: number): number => {
		const u = 1 - t;
		return u * u * u * P[0] + 3 * u * u * t * P[1] + 3 * u * t * t * P[2] + t * t * t * P[3];
	};

	const spots = CEFR.map((_, i) => {
		const t = i / (CEFR.length - 1);
		return { x: `${i * 20}%`, y: `${(onCurve(t) / TOP) * 100}%` };
	});
</script>

<svelte:head>
	<title>languages</title>
</svelte:head>

<main class="languages">
	<h1 class="sr-only">languages</h1>

	<div class="tree">
		<span class="trunk" aria-hidden="true"></span>

		<ol class="branches">
			{#each languages as language (language.code)}
				<li class="branch" style:--pigment={language.colour}>
					<div class="branch-head">
						<span
							class="lang-code"
							class:assumed={!language.stated}
							title={language.stated ? undefined : 'level assumed, not stated in the vault'}
						>
							{language.code}
						</span>
						<span class="lang-name">{language.name}</span>
						<span class="lang-move">
							{language.level}<span class="arrow">→</span>{language.target}
						</span>
					</div>

					<div class="branch-plot">
						<svg
							class="branch-line"
							viewBox="0 0 600 {TOP}"
							preserveAspectRatio="none"
							aria-hidden="true"
						>
							<path d="M0 26C200 26 400 7 600 7" />
						</svg>

						<ol class="leaves" aria-label="{language.name}: {language.level} to {language.target}">
							{#each CEFR as level, i}
								<li
									class="leaf"
									class:held={i <= rung(language.level)}
									class:gap={i > rung(language.level) && i < rung(language.target)}
									class:aim={level === language.target}
									style:left={spots[i].x}
									style:top={spots[i].y}
									aria-current={level === language.level ? 'true' : undefined}
								>
									{level}
								</li>
							{/each}
						</ol>
					</div>
				</li>
			{/each}
		</ol>
	</div>
</main>
