// Each test file gets its own throwaway SQLite file, set before lib/db.ts is imported.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const dir = mkdtempSync(path.join(tmpdir(), "gh-unit-"));
process.env.GH_DATA_DIR = dir;
process.env.GH_DB = path.join(dir, "t.db");
