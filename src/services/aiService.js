"use strict";

const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are a meeting analyst. Your job is to analyze meeting transcripts and extract structured insights. You must ONLY use information explicitly present in the transcript. Never invent attendees, decisions, action items, or outcomes not directly stated.

Return a JSON object with exactly this structure:
{
  "summary": [{ "text": "summary point", "citations": [{ "timestamp": "00:10" }] }],
  "actionItems": [{ "task": "task description", "assignee": "name", "citations": [{ "timestamp": "00:20" }] }],
  "decisions": [{ "text": "decision made", "citations": [{ "timestamp": "00:10" }] }],
  "followUps": [{ "text": "follow up suggestion", "citations": [{ "timestamp": "00:20" }] }]
}

Rules:
- Every item in every array MUST have a citations array with at least one timestamp
- Timestamps in citations MUST exactly match timestamps from the transcript provided
- Do not add any text before or after the JSON
- If nothing qualifies for a category, return an empty array for that category`;

/**
 * Format transcript entries into a readable string.
 * @param {Array<{timestamp: string, speaker: string, text: string}>} transcript
 * @returns {string}
 */
function formatTranscript(transcript) {
  return transcript
    .map((entry) => `[${entry.timestamp}] ${entry.speaker}: ${entry.text}`)
    .join("\n");
}

/**
 * Analyse a meeting transcript using Groq AI.
 * @param {Array<{timestamp: string, speaker: string, text: string}>} transcript
 * @returns {Promise<object>}
 */
async function analyzeMeeting(transcript) {
  const formattedTranscript = formatTranscript(transcript);

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Analyze this transcript:\n${formattedTranscript}` },
    ],
    temperature: 0.1,
    max_tokens: 4096,
  });

  const rawContent = completion.choices[0]?.message?.content ?? "";

  // Strip markdown code fences if the model wraps its response in them
  const cleaned = rawContent
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("AI returned invalid JSON");
  }

  return parsed;
}

module.exports = { analyzeMeeting };
