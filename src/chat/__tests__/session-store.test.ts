import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { MIGRATIONS } from "../../db/schema.ts";
import { ChatSessionStore } from "../session-store.ts";

let db: Database;
let store: ChatSessionStore;

beforeEach(() => {
	db = new Database(":memory:");
	for (const sql of MIGRATIONS) {
		db.run(sql);
	}
	store = new ChatSessionStore(db);
});

afterEach(() => {
	db.close();
});

describe("ChatSessionStore", () => {
	test("create and retrieve session", () => {
		const session = store.create("Test Session");
		expect(session.id).toBeDefined();
		expect(session.title).toBe("Test Session");
		expect(session.status).toBe("active");

		const fetched = store.get(session.id);
		expect(fetched).not.toBeNull();
		expect(fetched?.title).toBe("Test Session");
	});

	test("create session without title", () => {
		const session = store.create();
		expect(session.title).toBeNull();
	});

	test("list sessions returns empty", () => {
		const result = store.list();
		expect(result.sessions).toHaveLength(0);
		expect(result.nextCursor).toBeNull();
	});

	test("list sessions with pagination", () => {
		for (let i = 0; i < 5; i++) {
			const s = store.create(`Session ${i}`);
			store.incrementMessageCount(s.id);
		}
		const page1 = store.list({ limit: 2 });
		expect(page1.sessions).toHaveLength(2);
		expect(page1.nextCursor).not.toBeNull();

		const page2 = store.list({ limit: 2, cursor: page1.nextCursor ?? undefined });
		expect(page2.sessions).toHaveLength(2);
	});

	test("list filters by status", () => {
		store.create("Active");
		store.create("Archived");
		store.update(store.list().sessions[1].id, { status: "archived" });
		const result = store.list({ status: "active" });
		expect(result.sessions.every((s) => s.status === "active")).toBe(true);
	});

	test("update title sets title_is_manual", () => {
		const session = store.create();
		store.update(session.id, { title: "My Title" });
		const updated = store.get(session.id);
		expect(updated?.title).toBe("My Title");
		expect(updated?.title_is_manual).toBe(1);
	});

	test("update pinned", () => {
		const session = store.create();
		store.update(session.id, { pinned: true });
		const updated = store.get(session.id);
		expect(updated?.pinned).toBe(1);
	});

	test("soft delete sets deleted_at", () => {
		const session = store.create("To Delete");
		store.softDelete(session.id);
		const fetched = store.get(session.id);
		expect(fetched).toBeNull();
	});

	test("hardDeleteExpired removes old soft-deleted sessions", () => {
		const session = store.create("Old Delete");
		db.run("UPDATE chat_sessions SET deleted_at = datetime('now', '-31 days') WHERE id = ?", [session.id]);
		const count = store.hardDeleteExpired(30);
		expect(count).toBe(1);
	});

	test("fork creates new session with source reference", () => {
		const original = store.create("Original");
		const forked = store.fork(original.id, 5);
		expect(forked.forked_from_session_id).toBe(original.id);
		expect(forked.forked_from_message_seq).toBe(5);
	});

	test("incrementMessageCount increments and updates last_message_at", () => {
		const session = store.create();
		store.incrementMessageCount(session.id);
		const updated = store.get(session.id);
		expect(updated?.message_count).toBe(1);
		expect(updated?.last_message_at).not.toBeNull();
	});

	test("resetTitle clears title and manual flag", () => {
		const session = store.create();
		store.update(session.id, { title: "Manual Title" });
		store.resetTitle(session.id);
		const updated = store.get(session.id);
		expect(updated?.title).toBeNull();
		expect(updated?.title_is_manual).toBe(0);
	});

	test("setAutoTitle only sets if title is null and not manual", () => {
		const session = store.create();
		store.setAutoTitle(session.id, "Auto Title");
		const updated = store.get(session.id);
		expect(updated?.title).toBe("Auto Title");

		store.setAutoTitle(session.id, "Should Not Change");
		const unchanged = store.get(session.id);
		expect(unchanged?.title).toBe("Auto Title");
	});

	test("pinned sessions sort first", () => {
		const s1 = store.create("Unpinned");
		store.incrementMessageCount(s1.id);
		const s2 = store.create("Pinned");
		store.incrementMessageCount(s2.id);
		store.update(s2.id, { pinned: true });
		const result = store.list();
		expect(result.sessions[0].pinned).toBe(1);
	});
});
