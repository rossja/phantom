import type { AgentRuntime } from "../agent/runtime.ts";
import { isAuthenticated } from "../ui/serve.ts";
import type { ChatAttachmentStore } from "./attachment-store.ts";
import type { ChatEventLog } from "./event-log.ts";
import {
	handleAbort,
	handleDeleteSession,
	handleForkSession,
	handleGetSession,
	handleResume,
	handleStream,
	handleUpdateSession,
} from "./http-handlers.ts";
import type { ChatMessageStore } from "./message-store.ts";
import { handleChatStaticRequest } from "./serve.ts";
import type { ChatSessionStore } from "./session-store.ts";
import type { StreamBus } from "./stream-bus.ts";

export type ChatHandlerDeps = {
	runtime: AgentRuntime;
	sessionStore: ChatSessionStore;
	messageStore: ChatMessageStore;
	eventLog: ChatEventLog;
	attachmentStore: ChatAttachmentStore;
	streamBus: StreamBus;
	getBootstrapData?: () => Record<string, unknown>;
};

export function createChatHandler(deps: ChatHandlerDeps): (req: Request) => Promise<Response | null> {
	return async (req: Request): Promise<Response | null> => {
		const url = new URL(req.url);
		const path = url.pathname;

		if (path.startsWith("/chat") && isApiPath(path)) {
			if (!isAuthenticated(req)) {
				return Response.json({ error: "Unauthorized" }, { status: 401 });
			}
			const response = await routeApi(req, url, path, deps);
			if (response) return response;
		}

		return handleChatStaticRequest(req);
	};
}

function isApiPath(path: string): boolean {
	return (
		path === "/chat/bootstrap" ||
		path === "/chat/sessions" ||
		path === "/chat/stream" ||
		path === "/chat/focus" ||
		path.startsWith("/chat/sessions/") ||
		path.startsWith("/chat/events/")
	);
}

async function routeApi(req: Request, url: URL, path: string, deps: ChatHandlerDeps): Promise<Response | null> {
	if (path === "/chat/bootstrap" && req.method === "GET") {
		return Response.json(deps.getBootstrapData?.() ?? {});
	}

	if (path === "/chat/sessions" && req.method === "POST") {
		return handleCreateSession(req, deps);
	}

	if (path === "/chat/sessions" && req.method === "GET") {
		return handleListSessions(url, deps);
	}

	if (path === "/chat/stream" && req.method === "POST") {
		return handleStream(req, deps);
	}

	if (path === "/chat/focus" && req.method === "POST") {
		return new Response(null, { status: 204 });
	}

	const sessionMatch = path.match(/^\/chat\/sessions\/([^/]+)(\/.*)?$/);
	if (sessionMatch) {
		const sessionId = sessionMatch[1];
		const suffix = sessionMatch[2] ?? "";
		return routeSessionApi(req, sessionId, suffix, deps);
	}

	const eventsMatch = path.match(/^\/chat\/events\/(\d+)\/full-output$/);
	if (eventsMatch && req.method === "GET") {
		return Response.json({ error: "Not implemented" }, { status: 501 });
	}

	return null;
}

async function routeSessionApi(
	req: Request,
	sessionId: string,
	suffix: string,
	deps: ChatHandlerDeps,
): Promise<Response | null> {
	if (suffix === "" && req.method === "GET") return handleGetSession(sessionId, deps);
	if (suffix === "" && req.method === "PATCH") return handleUpdateSession(req, sessionId, deps);
	if (suffix === "" && req.method === "DELETE") return handleDeleteSession(sessionId, deps);

	if (suffix === "/fork" && req.method === "POST") return handleForkSession(req, sessionId, deps);

	if (suffix === "/title/reset" && req.method === "POST") {
		deps.sessionStore.resetTitle(sessionId);
		return Response.json({ ok: true });
	}

	if (suffix === "/resume" && req.method === "POST") return handleResume(req, sessionId, deps);
	if (suffix === "/abort" && req.method === "POST") return handleAbort(sessionId);

	return null;
}

async function handleCreateSession(req: Request, deps: ChatHandlerDeps): Promise<Response> {
	let body: { title?: string } = {};
	try {
		body = (await req.json()) as { title?: string };
	} catch {
		/* empty body */
	}
	const session = deps.sessionStore.create(body.title);
	return Response.json({ id: session.id, created_at: session.created_at }, { status: 201 });
}

function handleListSessions(url: URL, deps: ChatHandlerDeps): Response {
	const limit = Number(url.searchParams.get("limit")) || 50;
	const cursor = url.searchParams.get("cursor") ?? undefined;
	const status = (url.searchParams.get("status") as "active" | "archived" | "deleted") ?? "active";
	const result = deps.sessionStore.list({ limit, cursor, status });
	return Response.json({ sessions: result.sessions, next_cursor: result.nextCursor });
}
