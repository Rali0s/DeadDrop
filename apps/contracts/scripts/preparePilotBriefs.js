const fs = require("node:fs");
const path = require("node:path");

const resourcesDir = path.resolve(__dirname, "../../../Resources");
const sourcePath = process.env.BRIEF_SOURCE_FILE ? path.resolve(process.env.BRIEF_SOURCE_FILE) : path.resolve(resourcesDir, "briefs.json");
const targetCount = Number(process.env.BRIEF_TARGET_COUNT || 125);
const outPath = path.resolve(__dirname, `../../../Resources/briefs.pilot${targetCount}.json`);
const dropId = String(process.env.BRIEF_DROP_ID || "").trim();
const dedupeById = String(process.env.BRIEF_DEDUPE_BY_ID || "false").toLowerCase() === "true";

function normalizeTag(tag) {
  return String(tag || "")
    .trim()
    .toUpperCase()
    .slice(0, 16);
}

function normalizeItem(item) {
  const tags = Array.isArray(item.tags) ? item.tags.map(normalizeTag).filter(Boolean) : [];
  while (tags.length < 4) {
    tags.push("");
  }

  return {
    id: String(item.id || "").trim(),
    date: String(item.date || "").trim(),
    title: String(item.title || "").trim(),
    lesson: String(item.lesson || "").trim(),
    quote: String(item.quote || "").trim(),
    source: String(item.source || "").trim(),
    tags: tags.slice(0, 4)
  };
}

function parseJsonMaybeMultiple(raw) {
  const decoder = JSON;
  try {
    return [decoder.parse(raw)];
  } catch {
    // fallthrough for concatenated JSON blobs
  }

  const objs = [];
  let idx = 0;
  while (idx < raw.length) {
    while (idx < raw.length && /\s/.test(raw[idx])) {
      idx += 1;
    }
    if (idx >= raw.length) break;
    const slice = raw.slice(idx);
    let depth = 0;
    let inStr = false;
    let esc = false;
    let end = -1;
    for (let i = 0; i < slice.length; i++) {
      const ch = slice[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === "\"") inStr = false;
        continue;
      }
      if (ch === "\"") inStr = true;
      else if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    if (end < 0) break;
    const chunk = slice.slice(0, end);
    objs.push(JSON.parse(chunk));
    idx += end;
  }
  return objs;
}

function collectItemsFromObject(obj) {
  if (obj && Array.isArray(obj.items)) {
    return obj.items;
  }
  return [];
}

function loadAllItems() {
  const aggregated = [];

  const tryRead = (filePath) => {
    if (!fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, "utf8");
    for (const obj of parseJsonMaybeMultiple(raw)) {
      aggregated.push(...collectItemsFromObject(obj));
    }
  };

  // Primary source first.
  tryRead(sourcePath);

  // Expand from all JSON files in Resources, excluding generated pilot outputs.
  for (const name of fs.readdirSync(resourcesDir)) {
    if (!name.endsWith(".json")) continue;
    if (name.startsWith("briefs.pilot")) continue;
    if (name === path.basename(sourcePath)) continue;
    tryRead(path.join(resourcesDir, name));
  }

  return aggregated;
}

function main() {
  const items = loadAllItems();
  const normalized = [];
  for (const item of items) {
    const entry = normalizeItem(item);
    if (!entry.id || !entry.date || !entry.title || !entry.lesson) {
      continue;
    }
    normalized.push(entry);
  }

  let candidates = normalized;
  if (dropId) {
    candidates = candidates.filter((entry) => entry.id !== dropId);
  }
  if (dedupeById) {
    const byId = new Map();
    for (const entry of candidates) byId.set(entry.id, entry);
    candidates = Array.from(byId.values());
  }

  const pilotItems = candidates
    .sort((a, b) => {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      return a.id.localeCompare(b.id);
    })
    .slice(0, targetCount);

  if (pilotItems.length !== targetCount) {
    throw new Error(
      `Expected ${targetCount} pilot items, got ${pilotItems.length}. ` +
        `Set BRIEF_SOURCE_FILE or lower BRIEF_TARGET_COUNT.`
    );
  }

  const output = {
    generatedAt: new Date().toISOString(),
    rule:
      `${dedupeById ? "ID canonical; " : "allow duplicate ids; "}` +
      `${dropId ? `drop ${dropId}; ` : ""}sorted by date/id; first ${targetCount}`,
    items: pilotItems
  };

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(`wrote ${pilotItems.length} pilot items to ${outPath}`);
}

main();
