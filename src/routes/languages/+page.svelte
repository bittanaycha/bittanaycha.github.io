<script lang="ts">
	import { CEFR, index as rung, languages } from '#lib/languages';
</script>

<svelte:head>
	<title>languages</title>
</svelte:head>

<main class="languages">
	<h1 class="sr-only">languages</h1>

	<ul class="langs">
		{#each languages as language (language.code)}
			<li class="lang">
				<span
					class="lang-code"
					class:assumed={!language.stated}
					title={language.stated ? undefined : 'level assumed, not stated in the vault'}
				>
					{language.code}
				</span>
				<span class="lang-name">{language.name}</span>
				<ol class="ladder" aria-label="{language.name}: {language.level} to {language.target}">
					{#each CEFR as level, i}
						<li
							class:held={i <= rung(language.level)}
							class:gap={i > rung(language.level) && i < rung(language.target)}
							class:aim={level === language.target}
						>
							{level}
						</li>
					{/each}
				</ol>
				<span class="lang-move">
					{language.level}<span class="arrow">→</span>{language.target}
				</span>
			</li>
		{/each}
	</ul>
</main>
