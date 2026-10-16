import type { ChatMessage } from "../types";

/** Said once, when an agent starts a conversation; the user never sees it. */
const PREFACE =
  "You are talking to the user through the chat panel of the jewellery CAD app that your tools control. " +
  "They see only your replies there. Answer in the language they write in, and keep it short.";

const KEEP = 20;
const CLIP = 600;

/** What to send as the first message of a conversation the agent does not know yet. */
export function opening(text: string, summary: string | undefined, earlier: ChatMessage[]): string {
  let context = "";
  if (summary) {
    context = `Summary of the conversation so far:\n${summary}\n\n`;
  } else if (earlier.length) {
    const lines = earlier
      .filter((m) => m.role !== "note")
      .slice(-KEEP)
      .map((m) => {
        const files = m.files?.length ? ` [attached: ${m.files.map((f) => f.name).join(", ")}]` : "";
        return `${m.role === "user" ? "User" : "You"}: ${m.text.slice(0, CLIP)}${files}`;
      });
    context = `The conversation so far (another assistant may have said some of it):\n${lines.join("\n")}\n\n`;
  }
  return `${PREFACE}\n\n${context}${text}`;
}

export const COMPACT_PROMPT =
  "Write a summary of this conversation for your own future reference, as notes that let you carry on without " +
  "the earlier messages: what the user wants, every measurement and decision, what is in the model now, and what is " +
  "still open. Do not use any tools. Plain text, under 400 words.";

/** Lines added to and removed from a source, as a multiset difference (cheap, and good enough for a badge). */
export function lineChange(before: string, after: string): { added: number; removed: number } {
  const count = new Map<string, number>();
  for (const l of before.split("\n")) count.set(l, (count.get(l) ?? 0) + 1);
  let added = 0;
  for (const l of after.split("\n")) {
    const n = count.get(l) ?? 0;
    if (n > 0) count.set(l, n - 1);
    else added++;
  }
  let removed = 0;
  for (const n of count.values()) removed += n;
  return { added, removed };
}
