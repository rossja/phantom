import type { ChatAttachmentStore } from "./attachment-store.ts";
import type { ChatEventLog } from "./event-log.ts";
import type { ChatSessionStore } from "./session-store.ts";

export type SweepDeps = {
	sessionStore: ChatSessionStore;
	eventLog: ChatEventLog;
	attachmentStore: ChatAttachmentStore;
};

export type SweepResult = {
	sessionsDeleted: number;
	orphansDeleted: number;
	eventsSwept: number;
};

const HARD_DELETE_DAYS = 30;
const ORPHAN_HOURS = 24;
const EVENT_HOURS = 24;

export function runSweep(deps: SweepDeps): SweepResult {
	const sessionsDeleted = deps.sessionStore.hardDeleteExpired(HARD_DELETE_DAYS);
	const eventsSwept = deps.eventLog.sweep(EVENT_HOURS);

	const orphans = deps.attachmentStore.getOrphans(ORPHAN_HOURS);
	let orphansDeleted = 0;
	for (const orphan of orphans) {
		deps.attachmentStore.deleteById(orphan.id);
		orphansDeleted++;
	}

	if (sessionsDeleted > 0 || orphansDeleted > 0 || eventsSwept > 0) {
		console.log(
			`[chat-sweep] Cleaned up: ${sessionsDeleted} expired sessions, ${orphansDeleted} orphan attachments, ${eventsSwept} old events`,
		);
	}

	return { sessionsDeleted, orphansDeleted, eventsSwept };
}

export function startSweepInterval(deps: SweepDeps, intervalMs: number = 60 * 60 * 1000): NodeJS.Timeout {
	// Run once at startup
	try {
		runSweep(deps);
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		console.warn(`[chat-sweep] Startup sweep failed: ${msg}`);
	}

	return setInterval(() => {
		try {
			runSweep(deps);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			console.warn(`[chat-sweep] Periodic sweep failed: ${msg}`);
		}
	}, intervalMs);
}
