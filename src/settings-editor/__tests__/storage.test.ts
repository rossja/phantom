import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readCurated, writeCurated } from "../storage.ts";

let tmp: string;
let settingsPath: string;

function writeSettings(obj: unknown): void {
	writeFileSync(settingsPath, `${JSON.stringify(obj, null, 2)}\n`);
}

beforeEach(() => {
	tmp = mkdtempSync(join(tmpdir(), "phantom-settings-editor-"));
	settingsPath = join(tmp, "settings.json");
});

afterEach(() => {
	rmSync(tmp, { recursive: true, force: true });
});

describe("readCurated", () => {
	test("returns an empty object when settings.json does not exist", () => {
		const result = readCurated(settingsPath);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.current).toEqual({});
	});

	test("returns the full current settings including custom fields", () => {
		writeSettings({
			model: "claude-opus-4-6",
			enabledPlugins: { "linear@claude-plugins-official": true },
			x_custom_marker: "preserved",
		});
		const result = readCurated(settingsPath);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.current).toMatchObject({
			model: "claude-opus-4-6",
			enabledPlugins: { "linear@claude-plugins-official": true },
			x_custom_marker: "preserved",
		});
	});
});

describe("writeCurated: byte-for-byte preservation", () => {
	test("untouched fields survive a write that changes only model", () => {
		const initial = {
			model: "claude-sonnet-4-6",
			enabledPlugins: { "linear@claude-plugins-official": true, "notion@claude-plugins-official": true },
			hooks: {
				PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo precheck" }] }],
			},
			permissions: { allow: ["Bash(git:*)"], deny: [] },
			x_custom_field: "preserved byte-for-byte",
		};
		writeSettings(initial);

		const result = writeCurated({ model: "claude-opus-4-6" }, settingsPath);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.dirty.length).toBe(1);
		expect(result.dirty[0].key).toBe("model");

		const after = JSON.parse(readFileSync(settingsPath, "utf-8"));
		expect(after.model).toBe("claude-opus-4-6");
		expect(after.enabledPlugins).toEqual(initial.enabledPlugins);
		expect(after.hooks).toEqual(initial.hooks);
		expect(after.permissions).toEqual(initial.permissions);
		expect(after.x_custom_field).toBe(initial.x_custom_field);
	});

	test("multiple-field update preserves untouched fields", () => {
		writeSettings({
			model: "claude-opus-4-6",
			enabledPlugins: { "notion@claude-plugins-official": true },
			hooks: { SessionStart: [{ hooks: [{ type: "command", command: "echo start" }] }] },
			cleanupPeriodDays: 30,
		});
		const result = writeCurated(
			{ cleanupPeriodDays: 90, autoMemoryEnabled: true, model: "claude-sonnet-4-6" },
			settingsPath,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const after = JSON.parse(readFileSync(settingsPath, "utf-8"));
		expect(after.cleanupPeriodDays).toBe(90);
		expect(after.autoMemoryEnabled).toBe(true);
		expect(after.model).toBe("claude-sonnet-4-6");
		expect(after.enabledPlugins).toEqual({ "notion@claude-plugins-official": true });
		expect(after.hooks.SessionStart[0].hooks[0].command).toBe("echo start");
	});

	test("no-op write produces zero dirty keys and does not modify settings.json content", () => {
		writeSettings({ model: "claude-opus-4-6", x_marker: 1 });
		const result = writeCurated({ model: "claude-opus-4-6" }, settingsPath);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.dirty.length).toBe(0);
		const after = JSON.parse(readFileSync(settingsPath, "utf-8"));
		expect(after.x_marker).toBe(1);
	});

	test("rejects unknown fields per deny-list", () => {
		writeSettings({ model: "claude-opus-4-6" });
		const result = writeCurated({ apiKeyHelper: "/tmp/evil.sh" }, settingsPath);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.status).toBe(422);
	});

	test("rejects hooks in the payload (owned by the hooks editor)", () => {
		writeSettings({});
		const result = writeCurated(
			{ hooks: { PreToolUse: [{ hooks: [{ type: "command", command: "x" }] }] } } as unknown,
			settingsPath,
		);
		expect(result.ok).toBe(false);
	});

	test("rejects enabledPlugins in the payload (owned by the plugins editor)", () => {
		writeSettings({});
		const result = writeCurated(
			{ enabledPlugins: { "linear@claude-plugins-official": true } } as unknown,
			settingsPath,
		);
		expect(result.ok).toBe(false);
	});

	test("nested object updates replace the whole slice (shallow diff)", () => {
		writeSettings({
			permissions: { allow: ["Bash(git:*)"], deny: ["Bash(rm:*)"], defaultMode: "default" },
		});
		const result = writeCurated(
			{ permissions: { allow: ["Bash(git:*)"], deny: [], defaultMode: "default" } },
			settingsPath,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const after = JSON.parse(readFileSync(settingsPath, "utf-8"));
		expect(after.permissions.deny).toEqual([]);
		expect(after.permissions.allow).toEqual(["Bash(git:*)"]);
	});
});

describe("writeCurated: atomic write semantics", () => {
	test("successful write leaves no tmp files", () => {
		writeSettings({ model: "x" });
		writeCurated({ model: "y" }, settingsPath);
		const { readdirSync } = require("node:fs");
		const tmpFiles = readdirSync(tmp).filter((f: string) => f.startsWith("."));
		expect(tmpFiles.length).toBe(0);
	});
});
