// Diff-based read-modify-write for the curated settings form.
//
// The form submits a partial settings object (only the fields the user
// touched). We load the current settings.json, compute the set of top-level
// keys that actually changed, and write back ONLY those keys. Every other
// field stays byte-for-byte identical.
//
// This is the safety floor: untouched fields must survive a round trip
// through the form unchanged. The test at src/settings-editor/__tests__/
// storage.test.ts asserts byte-for-byte preservation of enabledPlugins,
// hooks, and arbitrary custom fields.

import { getUserSettingsPath } from "../plugins/paths.ts";
import { readSettings, writeSettings } from "../plugins/settings-io.ts";
import { type CuratedSettings, CuratedSettingsSchema } from "./schema.ts";

export type ReadCuratedResult = { ok: true; current: Record<string, unknown> } | { ok: false; error: string };

// Reads the full settings.json and returns it as-is. The dashboard form
// only renders the whitelisted keys, but we hand over the full payload so
// the dashboard can show the operator what else is on disk without the form.
export function readCurated(settingsPath: string = getUserSettingsPath()): ReadCuratedResult {
	const read = readSettings(settingsPath);
	if (!read.ok) return { ok: false, error: read.error };
	return { ok: true, current: read.settings as Record<string, unknown> };
}

export type DirtyKey = {
	key: keyof CuratedSettings;
	previous: unknown;
	next: unknown;
};

export type WriteCuratedResult =
	| { ok: true; dirty: DirtyKey[]; current: Record<string, unknown>; previous: Record<string, unknown> }
	| { ok: false; status: 400 | 422 | 500; error: string };

// Compute a shallow diff between a partial form submission and the on-disk
// settings. A key is dirty if the stringified JSON differs. This covers
// both primitive and object values (permissions, worktree, sandbox) while
// avoiding the complexity of a deep field-level merge.
function computeDirtyKeys(next: CuratedSettings, current: Record<string, unknown>): DirtyKey[] {
	const dirty: DirtyKey[] = [];
	for (const key of Object.keys(next) as Array<keyof CuratedSettings>) {
		const nextVal = next[key];
		const currentVal = current[key];
		if (nextVal === undefined) continue;
		if (JSON.stringify(nextVal) !== JSON.stringify(currentVal)) {
			dirty.push({ key, previous: currentVal, next: nextVal });
		}
	}
	return dirty;
}

export function writeCurated(submitted: unknown, settingsPath: string = getUserSettingsPath()): WriteCuratedResult {
	const parsed = CuratedSettingsSchema.safeParse(submitted);
	if (!parsed.success) {
		const issue = parsed.error.issues[0];
		const path = issue.path.length > 0 ? issue.path.join(".") : "body";
		return { ok: false, status: 422, error: `${path}: ${issue.message}` };
	}

	const read = readSettings(settingsPath);
	if (!read.ok) return { ok: false, status: 500, error: read.error };
	const previousFull = { ...read.settings } as Record<string, unknown>;

	const dirty = computeDirtyKeys(parsed.data, previousFull);
	if (dirty.length === 0) {
		return { ok: true, dirty: [], current: previousFull, previous: previousFull };
	}

	// Build the merged settings: take the previous settings as a base and
	// overwrite only the dirty keys. Every other key (enabledPlugins, hooks,
	// permissions we did not touch, unknown custom fields) stays as-is.
	const merged: Record<string, unknown> = { ...previousFull };
	for (const entry of dirty) {
		merged[entry.key] = entry.next;
	}

	const write = writeSettings(merged, settingsPath);
	if (!write.ok) return { ok: false, status: 500, error: write.error };

	return { ok: true, dirty, current: merged, previous: previousFull };
}
