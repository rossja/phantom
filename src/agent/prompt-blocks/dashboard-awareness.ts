// Dashboard awareness block: tells the agent that the operator has a
// dashboard at /ui/dashboard where they can edit skills and memory files,
// so the agent can direct them to it when asked "what can I edit" or
// "how do I customize you".
//
// This is one of two complementary paths. The other is the show-my-tools
// built-in skill under skills-builtin/show-my-tools/SKILL.md which actually
// enumerates the current catalog. The block is always-on; the skill fires
// on demand.

export function buildDashboardAwarenessLines(publicUrl: string | undefined): string[] {
	const base = publicUrl?.replace(/\/$/, "") ?? "";
	const dashboardUrl = base ? `${base}/ui/dashboard/` : "/ui/dashboard/";
	const skillsUrl = base ? `${base}/ui/dashboard/#/skills` : "/ui/dashboard/#/skills";
	const memoryUrl = base ? `${base}/ui/dashboard/#/memory-files` : "/ui/dashboard/#/memory-files";
	const pluginsUrl = base ? `${base}/ui/dashboard/#/plugins` : "/ui/dashboard/#/plugins";
	const subagentsUrl = base ? `${base}/ui/dashboard/#/subagents` : "/ui/dashboard/#/subagents";
	const hooksUrl = base ? `${base}/ui/dashboard/#/hooks` : "/ui/dashboard/#/hooks";
	const settingsUrl = base ? `${base}/ui/dashboard/#/settings` : "/ui/dashboard/#/settings";

	const lines: string[] = [];
	lines.push("");
	lines.push("=== YOUR DASHBOARD ===");
	lines.push("");
	lines.push("Your operator has a dashboard they use to shape how you work. It is a");
	lines.push("hand-crafted UI, separate from the pages you generate with phantom_create_page.");
	lines.push("Six tabs are live today:");
	lines.push("");
	lines.push(`- Skills:       ${skillsUrl}`);
	lines.push("    Markdown files under /home/phantom/.claude/skills/<name>/SKILL.md.");
	lines.push("    Your operator creates, edits, and deletes skills here. You read every");
	lines.push("    skill's name, description, and when_to_use at the start of every message,");
	lines.push("    so any edit is live on your next turn. You can write your own skills by");
	lines.push("    creating SKILL.md files at the same path.");
	lines.push("");
	lines.push(`- Memory files: ${memoryUrl}`);
	lines.push("    Arbitrary markdown under /home/phantom/.claude/ including CLAUDE.md,");
	lines.push("    rules/*.md, and memory/*.md. Edits are picked up on your next session.");
	lines.push("");
	lines.push(`- Plugins:      ${pluginsUrl}`);
	lines.push("    Third-party extensions from claude-plugins-official with a trust modal");
	lines.push("    on first install. Four plugins are pre-installed on fresh Phantom VMs:");
	lines.push("    linear, notion, slack, claude-md-management. Every install is audited.");
	lines.push("");
	lines.push(`- Subagents:    ${subagentsUrl}`);
	lines.push("    Flat markdown files at /home/phantom/.claude/agents/<name>.md with");
	lines.push("    frontmatter describing the subagent's tools, model, effort, color, and");
	lines.push("    prompt body. You invoke subagents via the Task tool when the operator");
	lines.push("    asks for specialized behavior.");
	lines.push("");
	lines.push(`- Hooks:        ${hooksUrl}`);
	lines.push("    Visual rule builder over the 26 Claude Agent SDK hook events, stored");
	lines.push("    in /home/phantom/.claude/settings.json under the hooks key. Command,");
	lines.push("    prompt, agent, and http hook types. Hooks fire on your next message and");
	lines.push("    can block tool calls, format on write, or call external services.");
	lines.push("");
	lines.push(`- Settings:     ${settingsUrl}`);
	lines.push("    Curated form over settings.json. Permissions, model, MCP servers,");
	lines.push("    memory, sandbox, UI. Unsafe fields like apiKeyHelper and modelOverrides");
	lines.push("    are hidden. Diff-based writes: untouched fields stay byte-identical.");
	lines.push("");
	lines.push("When your operator asks 'what can I customize', 'how do I edit your skills',");
	lines.push(`'show me the dashboard', point them at ${dashboardUrl}`);
	lines.push("and fire the show-my-tools skill for the current catalog.");
	lines.push("");
	lines.push("When they ask 'install a plugin for X' or 'add a capability', point at the");
	lines.push("plugins tab. 'Add a hook', 'format on edit', 'block dangerous bash' -> hooks");
	lines.push("tab. 'Create a subagent', 'build a specialist' -> subagents tab. 'Change");
	lines.push("permissions', 'change my model' -> settings tab.");
	lines.push("");
	lines.push("Other tabs (sessions, cost, scheduler, evolution, memory explorer) are marked");
	lines.push("Coming Soon in the dashboard today and will light up in later PRs.");
	return lines;
}
