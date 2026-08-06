# AI visibility benchmark protocol

What we measure, how, and what we are careful not to claim.

## What this is

A **controlled API visibility benchmark**. We send a fixed prompt set to a
pinned model version and record whether the brand appears in the answer.

**This is not the same as consumer ChatGPT, Gemini, Claude, Perplexity, or
Copilot.** Those surfaces use different retrieval, different system prompts, and
different model builds. Reports must say "API benchmark", never "ChatGPT
visibility".

## What is pinned per run

Every `AnalysisBatch` records all of these. A change to any one of them makes
runs non-comparable, and the UI must say so rather than drawing a trend line.

| Field                                  | Why                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| `promptSetHash`                        | A prompt edit silently invalidates history. Model pinning alone is not enough. |
| `provider`, `model`, `providerVersion` | Providers ship silent model updates.                                           |
| `marketId` (country, language, device) | Answers are locale-sensitive.                                                  |
| `repetitions`                          | Output is stochastic. n=1 is an anecdote.                                      |
| `extractionVersion`                    | Changing the extractor changes the number.                                     |
| `runAt`                                | Retrieval-backed answers drift with the web.                                   |

`PromptRun` is unique on `(batchId, promptId, provider, model, repetitionIndex)`.
The repetition index is what makes n>1 sampling — and therefore any statement
about variance — possible at all.

## Extraction is deterministic

`analyzeAnswer(answerText, brandAliases, competitorAliases)` is a **pure
function**. Normalized, word-boundary alias matching produces `brandMentioned`,
`mentionCount`, and `firstMentionCharIndex`, from which `position` is derived.

The LLM is used only for sentiment, and for _proposing_ new aliases which a
human reviews before they are stored.

This is deliberate. It makes "aggregates reconcile exactly to underlying runs"
provable rather than aspirational, keeps reruns comparable, and removes roughly
60% of extraction cost.

## Definitions

Every run lands in exactly one bucket:

- **completed** — the provider returned a usable answer.
- **refused** — the model declined to answer.
- **failed** — timeout, transport error, malformed output, or quota exhaustion.

```
visibility    = runs mentioning the brand / completed runs
shareOfVoice  = brand mentions / all tracked-brand mentions, within one run set
```

**The denominator is completed runs.** Never the count of configured prompts.

**Refusals are their own bucket.** They are neither failures nor non-mentions;
folding them into the denominator biases visibility downward. `refusedCount` is
displayed next to `sampleSize` wherever a visibility figure appears.

**Citations are kept separate from other provider-retrieved sources.**
`Source.isCitation` distinguishes them. A retrieved page the model did not cite
is not a citation.

## Reporting rules

- Always show sample size and date range. A percentage without a denominator is
  not a measurement.
- Report partial batch failure explicitly.
- A rerun creates a **new** observation set. Results are never overwritten.
- Never compare providers across different prompt sets, dates, locales, or
  sample sizes without labelling the mismatch.
- Do not publish a rank-time prediction or an average rank gain until there is a
  defined cohort, baseline window, observation window, sample size, and
  survivor-bias treatment.

## Related first-party signals

The benchmark is a proxy. Two signals in the roadmap are direct measurements and
should be weighted more heavily once available:

- **AI referral traffic** (Phase 7) — real sessions referred by `chatgpt.com`,
  `perplexity.ai`, `gemini.google.com`, `copilot.microsoft.com`, `claude.ai`.
- **Google AI Overview citations** (Phase 3) — Google's actual AI answer surface
  for the customer's real keywords, captured as `SerpResult.type = AI_OVERVIEW`.
