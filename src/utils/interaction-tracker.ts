import fs from "fs";
import path from "path";
import { logger } from "./logger";

interface InteractionEntry {
  authorId: string;
  authorUsername?: string;
  type: "mention_reply" | "shill_request" | "quote_tweet";
  timestamp: number;
}

const DATA_PATH = path.join(process.cwd(), "data", "interacted-authors.json");

let entries: InteractionEntry[] = [];
const authorIds: Set<string> = new Set();

function load(): void {
  try {
    if (fs.existsSync(DATA_PATH)) {
      entries = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
      for (const e of entries) {
        authorIds.add(e.authorId);
      }
      logger.info({ count: entries.length }, "Loaded interaction history");
    }
  } catch {
    entries = [];
  }
}

function save(): void {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(entries, null, 2));
}

// Load on import
load();

/**
 * Check if we've already interacted with this author (any type).
 */
export function hasInteracted(authorId: string): boolean {
  return authorIds.has(authorId);
}

/**
 * Record that we interacted with this author.
 */
export function trackInteraction(
  authorId: string,
  type: InteractionEntry["type"],
  authorUsername?: string
): void {
  if (authorIds.has(authorId)) return; // Already tracked
  authorIds.add(authorId);
  entries.push({
    authorId,
    authorUsername,
    type,
    timestamp: Date.now(),
  });
  save();
}

/**
 * Seed existing interactions from shill records and mention rewards on startup.
 */
export function seedFromExisting(authorIdsToSeed: string[]): void {
  let added = 0;
  for (const id of authorIdsToSeed) {
    if (!authorIds.has(id)) {
      authorIds.add(id);
      entries.push({ authorId: id, type: "mention_reply", timestamp: 0 });
      added++;
    }
  }
  if (added > 0) {
    save();
    logger.info({ added }, "Seeded interaction tracker from existing records");
  }
}
