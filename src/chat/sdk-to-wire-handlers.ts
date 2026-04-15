// Stream event and assistant message handlers for the SDK-to-wire translator.
// Split from sdk-to-wire.ts to keep both files under 300 lines.

import type { ChatWireFrame } from "./types.ts";

export type TranslationContext = {
	sessionId: string;
	messageId: string;
	nextSeq: () => number;
	turnIndex: number;
	seenBlockLengths: Map<number, number>;
	startedToolIds: Set<string>;
	assistantStartEmitted: boolean;
};

export function handleAssistant(msg: Record<string, unknown>, ctx: TranslationContext): ChatWireFrame[] {
	const frames: ChatWireFrame[] = [];
	const message = msg.message as {
		content: Array<Record<string, unknown>>;
		usage?: { input_tokens?: number; output_tokens?: number };
	};
	if (!message?.content) return frames;

	const parentToolUseId = (msg.parent_tool_use_id as string | null) ?? null;

	if (!ctx.assistantStartEmitted) {
		ctx.assistantStartEmitted = true;
		frames.push({
			event: "message.assistant_start",
			message_id: ctx.messageId,
			parent_tool_use_id: parentToolUseId,
		});
	}

	for (let i = 0; i < message.content.length; i++) {
		const block = message.content[i];
		const blockType = block.type as string;

		if (blockType === "text") {
			const fullText = (block.text as string) ?? "";
			const prevLen = ctx.seenBlockLengths.get(i) ?? 0;
			if (prevLen === 0) {
				frames.push({
					event: "message.text_start",
					message_id: ctx.messageId,
					text_block_id: `tb_${ctx.turnIndex}_${i}`,
					index: i,
				});
			}
			if (fullText.length > prevLen) {
				frames.push({
					event: "message.text_delta",
					text_block_id: `tb_${ctx.turnIndex}_${i}`,
					delta: fullText.slice(prevLen),
				});
			}
			ctx.seenBlockLengths.set(i, fullText.length);
		} else if (blockType === "thinking" || blockType === "redacted_thinking") {
			const thinkingText = (block.thinking as string) ?? "";
			const prevLen = ctx.seenBlockLengths.get(i) ?? 0;
			const redacted = blockType === "redacted_thinking";
			if (prevLen === 0) {
				frames.push({
					event: "message.thinking_start",
					message_id: ctx.messageId,
					thinking_block_id: `tk_${ctx.turnIndex}_${i}`,
					index: i,
					redacted,
				});
			}
			if (!redacted && thinkingText.length > prevLen) {
				frames.push({
					event: "message.thinking_delta",
					thinking_block_id: `tk_${ctx.turnIndex}_${i}`,
					delta: thinkingText.slice(prevLen),
				});
			}
			ctx.seenBlockLengths.set(i, thinkingText.length);
		} else if (blockType === "tool_use") {
			const toolId = (block.id as string) ?? `tool_${i}`;
			if (!ctx.startedToolIds.has(toolId)) {
				ctx.startedToolIds.add(toolId);
				const toolName = (block.name as string) ?? "unknown";
				const isMcp = toolName.includes(":") || toolName.startsWith("mcp_");
				frames.push({
					event: "message.tool_call_start",
					message_id: ctx.messageId,
					tool_call_id: toolId,
					tool_name: toolName,
					parent_tool_use_id: parentToolUseId,
					is_mcp: isMcp,
					mcp_server: isMcp ? toolName.split(":")[0] : undefined,
				});
				if (block.input !== undefined) {
					frames.push({
						event: "message.tool_call_input_end",
						tool_call_id: toolId,
						input: block.input,
					});
					ctx.seenBlockLengths.set(i, JSON.stringify(block.input).length);
				}
			}
		}
	}

	return frames;
}

export function handleStreamEvent(msg: Record<string, unknown>, ctx: TranslationContext): ChatWireFrame[] {
	const frames: ChatWireFrame[] = [];
	const event = msg.event as Record<string, unknown>;
	if (!event) return frames;

	const parentToolUseId = (msg.parent_tool_use_id as string | null) ?? null;
	const eventType = event.type as string;

	if (!ctx.assistantStartEmitted && eventType !== "message_stop") {
		ctx.assistantStartEmitted = true;
		frames.push({
			event: "message.assistant_start",
			message_id: ctx.messageId,
			parent_tool_use_id: parentToolUseId,
		});
	}

	switch (eventType) {
		case "content_block_start": {
			const block = event.content_block as Record<string, unknown>;
			const index = event.index as number;
			const blockType = block?.type as string;

			if (blockType === "text") {
				frames.push({
					event: "message.text_start",
					message_id: ctx.messageId,
					text_block_id: `tb_${ctx.turnIndex}_${index}`,
					index,
				});
			} else if (blockType === "thinking" || blockType === "redacted_thinking") {
				frames.push({
					event: "message.thinking_start",
					message_id: ctx.messageId,
					thinking_block_id: `tk_${ctx.turnIndex}_${index}`,
					index,
					redacted: blockType === "redacted_thinking",
				});
			} else if (blockType === "tool_use") {
				const toolId = (block.id as string) ?? `tool_${index}`;
				ctx.startedToolIds.add(toolId);
				const toolName = (block.name as string) ?? "unknown";
				const isMcp = toolName.includes(":") || toolName.startsWith("mcp_");
				frames.push({
					event: "message.tool_call_start",
					message_id: ctx.messageId,
					tool_call_id: toolId,
					tool_name: toolName,
					parent_tool_use_id: parentToolUseId,
					is_mcp: isMcp,
					mcp_server: isMcp ? toolName.split(":")[0] : undefined,
				});
			}
			break;
		}
		case "content_block_delta": {
			const delta = event.delta as Record<string, unknown>;
			const index = event.index as number;
			const deltaType = delta?.type as string;

			if (deltaType === "text_delta") {
				frames.push({
					event: "message.text_delta",
					text_block_id: `tb_${ctx.turnIndex}_${index}`,
					delta: (delta.text as string) ?? "",
				});
			} else if (deltaType === "thinking_delta") {
				frames.push({
					event: "message.thinking_delta",
					thinking_block_id: `tk_${ctx.turnIndex}_${index}`,
					delta: (delta.thinking as string) ?? "",
				});
			} else if (deltaType === "input_json_delta") {
				frames.push({
					event: "message.tool_call_input_delta",
					tool_call_id: `pending_${index}`,
					json_delta: (delta.partial_json as string) ?? "",
				});
			}
			break;
		}
		case "content_block_stop": {
			const index = event.index as number;
			frames.push({ event: "message.text_end", text_block_id: `tb_${ctx.turnIndex}_${index}` });
			frames.push({ event: "message.thinking_end", thinking_block_id: `tk_${ctx.turnIndex}_${index}` });
			break;
		}
		case "message_stop": {
			if (ctx.assistantStartEmitted) {
				frames.push({
					event: "message.assistant_end",
					message_id: ctx.messageId,
					interrupted: false,
				});
			}
			break;
		}
	}

	return frames;
}
