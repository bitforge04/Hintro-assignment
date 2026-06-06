# AI Approach

This document explains how the AI-powered meeting analysis works, how hallucinations are prevented, and what the known limitations are.

---

## Overview

When a user calls `POST /api/meetings/:id/analyze`, the service:

1. Fetches all transcript entries for the meeting from the database
2. Formats them into a readable string
3. Sends the formatted transcript to Groq along with a strict system prompt
4. Parses the JSON response
5. Stores the result in `MeetingAnalysis` (upsert — re-analysis overwrites the previous result)
6. Returns the structured analysis to the client

---

## Prompt Design

The system prompt does three things:

**1. Defines the role clearly**

> "You are a meeting analyst. Your job is to analyze meeting transcripts and extract structured insights."

This sets a narrow, specific role so the model doesn't wander into creative territory.

**2. Enforces grounding explicitly**

> "You must ONLY use information explicitly present in the transcript. Never invent attendees, decisions, action items, or outcomes not directly stated."

This is the core hallucination guard. It tells the model exactly what it is not allowed to do.

**3. Specifies the exact output format**

The prompt includes the full JSON schema the model must return:

```json
{
  "summary": [{ "text": "...", "citations": [{ "timestamp": "00:10" }] }],
  "actionItems": [{ "task": "...", "assignee": "...", "citations": [{ "timestamp": "00:20" }] }],
  "decisions": [{ "text": "...", "citations": [{ "timestamp": "00:10" }] }],
  "followUps": [{ "text": "...", "citations": [{ "timestamp": "00:20" }] }]
}
```

By showing the exact structure, the model knows what to produce — no guessing.

---

## Citation Strategy

Every insight the model generates must include at least one citation. A citation is an object with a `timestamp` field that matches a timestamp from the provided transcript.

For example, if the transcript has:

```
[00:10] John: We should launch next Friday.
[00:20] Alice: I will prepare release notes.
```

A valid action item would be:

```json
{
  "task": "Prepare release notes",
  "assignee": "Alice",
  "citations": [{ "timestamp": "00:20" }]
}
```

The prompt explicitly states:

> "Timestamps in citations MUST exactly match timestamps from the transcript provided."

This means the model can't fabricate a timestamp — it must use one from the input it was given, which serves as a direct traceability link back to the source.

---

## Hallucination Prevention

Four layers work together:

| Layer | What it does |
|---|---|
| System prompt instruction | Explicitly tells the model not to invent anything |
| Grounded transcript input | The model only has the transcript — it has no external context to draw from |
| Citation requirement | Forces the model to anchor every claim to a timestamp |
| Low temperature (0.1) | Reduces creative/random outputs, keeps responses factual and deterministic |

The model is also instructed:

> "If nothing qualifies for a category, return an empty array for that category."

This prevents the model from filling categories with made-up content just to avoid returning an empty array.

---

## Output Validation

After the model responds, the raw string is passed through `JSON.parse()`. If parsing fails for any reason (model returned explanation text, markdown code fences, partial output), the service throws:

```
Error: AI returned invalid JSON
```

This surfaces as a 500 error to the client with a trace ID. The error is logged with full details via Pino so it can be debugged.

In the future, Zod schema validation on the parsed output would make this more robust — catching cases where the JSON parses but is missing required fields.

---

## Model Choice

Model: `llama-3.3-70b-versatile` on Groq

This model was chosen because:
- It reliably follows structured JSON output instructions
- It's fast (Groq's hardware acceleration)
- It's available on the free tier

The original spec called for `llama3-70b-8192`, which was decommissioned by Groq mid-development. Switched to `llama-3.3-70b-versatile` as the recommended replacement.

---

## Known Limitations

- **Short transcripts** — with very little content (e.g., one line), the model may return mostly empty arrays. This is correct behavior, not a bug.
- **Ambiguous speakers** — if the transcript uses vague speaker names like "Speaker 1", the assignee in action items will also be vague.
- **No JSON schema enforcement at the model level** — we rely on the prompt to produce valid JSON. If Groq ever returns markdown-wrapped JSON (` ```json ... ``` `), parsing will fail. A pre-processing strip of code fences would make this more resilient.
- **Re-analysis overwrites previous results** — calling the analyze endpoint twice replaces the existing analysis. There's no history of previous analyses stored.
