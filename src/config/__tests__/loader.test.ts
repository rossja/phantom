import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { loadConfig, loadConfigSync } from "../loader.ts";

const TEST_DIR = "/tmp/phantom-test-config";

function writeYaml(filename: string, content: string): string {
	mkdirSync(TEST_DIR, { recursive: true });
	const path = `${TEST_DIR}/${filename}`;
	writeFileSync(path, content);
	return path;
}

function cleanup(): void {
	rmSync(TEST_DIR, { recursive: true, force: true });
}

describe("loadConfig", () => {
	test("loads a valid config file", async () => {
		const path = writeYaml(
			"valid.yaml",
			`
name: test-phantom
port: 3200
role: swe
model: claude-opus-4-6
effort: high
max_budget_usd: 25
`,
		);
		try {
			const config = await loadConfig(path);
			expect(config.name).toBe("test-phantom");
			expect(config.port).toBe(3200);
			expect(config.role).toBe("swe");
			expect(config.model).toBe("claude-opus-4-6");
			expect(config.effort).toBe("high");
			expect(config.max_budget_usd).toBe(25);
		} finally {
			cleanup();
		}
	});

	test("applies defaults for optional fields", async () => {
		const path = writeYaml(
			"minimal.yaml",
			`
name: minimal
`,
		);
		try {
			const config = await loadConfig(path);
			expect(config.name).toBe("minimal");
			expect(config.port).toBe(3100);
			expect(config.role).toBe("swe");
			expect(config.effort).toBe("max");
			expect(config.max_budget_usd).toBe(0);
		} finally {
			cleanup();
		}
	});

	test("throws on missing file", async () => {
		await expect(loadConfig("/tmp/phantom-nonexistent.yaml")).rejects.toThrow("Config file not found");
	});

	test("throws on invalid config", async () => {
		const path = writeYaml(
			"invalid.yaml",
			`
port: -1
`,
		);
		try {
			await expect(loadConfig(path)).rejects.toThrow("Invalid config");
		} finally {
			cleanup();
		}
	});

	test("throws on invalid effort value", async () => {
		const path = writeYaml(
			"bad-effort.yaml",
			`
name: test
effort: turbo
`,
		);
		try {
			await expect(loadConfig(path)).rejects.toThrow("Invalid config");
		} finally {
			cleanup();
		}
	});

	test("env var overrides YAML model", async () => {
		const path = writeYaml(
			"env-model.yaml",
			`
name: test-phantom
model: claude-opus-4-6
`,
		);
		const saved = process.env.PHANTOM_MODEL;
		try {
			process.env.PHANTOM_MODEL = "claude-sonnet-4-6";
			const config = await loadConfig(path);
			expect(config.model).toBe("claude-sonnet-4-6");
		} finally {
			if (saved !== undefined) {
				process.env.PHANTOM_MODEL = saved;
			} else {
				process.env.PHANTOM_MODEL = undefined;
			}
			cleanup();
		}
	});

	test("env var overrides YAML domain", async () => {
		const path = writeYaml(
			"env-domain.yaml",
			`
name: test-phantom
domain: old.example.com
`,
		);
		const saved = process.env.PHANTOM_DOMAIN;
		try {
			process.env.PHANTOM_DOMAIN = "new.ghostwright.dev";
			const config = await loadConfig(path);
			expect(config.domain).toBe("new.ghostwright.dev");
		} finally {
			if (saved !== undefined) {
				process.env.PHANTOM_DOMAIN = saved;
			} else {
				process.env.PHANTOM_DOMAIN = undefined;
			}
			cleanup();
		}
	});

	test("PHANTOM_NAME env var overrides YAML name", async () => {
		const path = writeYaml(
			"env-name.yaml",
			`
name: phantom-dev
`,
		);
		const saved = process.env.PHANTOM_NAME;
		try {
			process.env.PHANTOM_NAME = "cheema";
			const config = await loadConfig(path);
			expect(config.name).toBe("cheema");
		} finally {
			if (saved !== undefined) {
				process.env.PHANTOM_NAME = saved;
			} else {
				process.env.PHANTOM_NAME = undefined;
			}
			cleanup();
		}
	});

	test("PHANTOM_NAME env var is trimmed", async () => {
		const path = writeYaml(
			"env-name-trim.yaml",
			`
name: phantom-dev
`,
		);
		const saved = process.env.PHANTOM_NAME;
		try {
			process.env.PHANTOM_NAME = "  cheema  ";
			const config = await loadConfig(path);
			expect(config.name).toBe("cheema");
		} finally {
			if (saved !== undefined) {
				process.env.PHANTOM_NAME = saved;
			} else {
				process.env.PHANTOM_NAME = undefined;
			}
			cleanup();
		}
	});

	test("empty PHANTOM_NAME env var does not override YAML", async () => {
		const path = writeYaml(
			"env-name-empty.yaml",
			`
name: phantom-dev
`,
		);
		const saved = process.env.PHANTOM_NAME;
		try {
			process.env.PHANTOM_NAME = "";
			const config = await loadConfig(path);
			expect(config.name).toBe("phantom-dev");
		} finally {
			if (saved !== undefined) {
				process.env.PHANTOM_NAME = saved;
			} else {
				process.env.PHANTOM_NAME = undefined;
			}
			cleanup();
		}
	});

	test("PHANTOM_ROLE env var overrides YAML role", async () => {
		const path = writeYaml(
			"env-role.yaml",
			`
name: test
role: swe
`,
		);
		const saved = process.env.PHANTOM_ROLE;
		try {
			process.env.PHANTOM_ROLE = "base";
			const config = await loadConfig(path);
			expect(config.role).toBe("base");
		} finally {
			if (saved !== undefined) {
				process.env.PHANTOM_ROLE = saved;
			} else {
				process.env.PHANTOM_ROLE = undefined;
			}
			cleanup();
		}
	});

	test("PHANTOM_EFFORT env var overrides YAML effort with valid value", async () => {
		const path = writeYaml(
			"env-effort.yaml",
			`
name: test
effort: max
`,
		);
		const saved = process.env.PHANTOM_EFFORT;
		try {
			process.env.PHANTOM_EFFORT = "low";
			const config = await loadConfig(path);
			expect(config.effort).toBe("low");
		} finally {
			if (saved !== undefined) {
				process.env.PHANTOM_EFFORT = saved;
			} else {
				process.env.PHANTOM_EFFORT = undefined;
			}
			cleanup();
		}
	});

	test("PHANTOM_EFFORT env var with invalid value falls back to YAML", async () => {
		const path = writeYaml(
			"env-effort-invalid.yaml",
			`
name: test
effort: high
`,
		);
		const saved = process.env.PHANTOM_EFFORT;
		try {
			process.env.PHANTOM_EFFORT = "turbo";
			const config = await loadConfig(path);
			expect(config.effort).toBe("high");
		} finally {
			if (saved !== undefined) {
				process.env.PHANTOM_EFFORT = saved;
			} else {
				process.env.PHANTOM_EFFORT = undefined;
			}
			cleanup();
		}
	});

	test("PORT env var overrides YAML port", async () => {
		const path = writeYaml(
			"env-port.yaml",
			`
name: test
port: 3100
`,
		);
		const saved = process.env.PORT;
		try {
			process.env.PORT = "8080";
			const config = await loadConfig(path);
			expect(config.port).toBe(8080);
		} finally {
			if (saved !== undefined) {
				process.env.PORT = saved;
			} else {
				process.env.PORT = undefined;
			}
			cleanup();
		}
	});

	test("PORT env var with non-numeric value falls back to YAML", async () => {
		const path = writeYaml(
			"env-port-nan.yaml",
			`
name: test
port: 3100
`,
		);
		const saved = process.env.PORT;
		try {
			process.env.PORT = "abc";
			const config = await loadConfig(path);
			expect(config.port).toBe(3100);
		} finally {
			if (saved !== undefined) {
				process.env.PORT = saved;
			} else {
				process.env.PORT = undefined;
			}
			cleanup();
		}
	});

	test("PORT env var with out-of-range value falls back to YAML", async () => {
		const path = writeYaml(
			"env-port-range.yaml",
			`
name: test
port: 3100
`,
		);
		const saved = process.env.PORT;
		try {
			process.env.PORT = "70000";
			const config = await loadConfig(path);
			expect(config.port).toBe(3100);
		} finally {
			if (saved !== undefined) {
				process.env.PORT = saved;
			} else {
				process.env.PORT = undefined;
			}
			cleanup();
		}
	});

	test("defaults provider to anthropic when block is absent", async () => {
		const path = writeYaml(
			"no-provider.yaml",
			`
name: test
`,
		);
		try {
			const config = await loadConfig(path);
			expect(config.provider.type).toBe("anthropic");
			expect(config.provider.base_url).toBeUndefined();
		} finally {
			cleanup();
		}
	});

	test("loads a zai provider block", async () => {
		const path = writeYaml(
			"zai-provider.yaml",
			`
name: test
provider:
  type: zai
  api_key_env: ZAI_API_KEY
  model_mappings:
    opus: glm-5.1
`,
		);
		try {
			const config = await loadConfig(path);
			expect(config.provider.type).toBe("zai");
			expect(config.provider.api_key_env).toBe("ZAI_API_KEY");
			expect(config.provider.model_mappings?.opus).toBe("glm-5.1");
		} finally {
			cleanup();
		}
	});

	test("PHANTOM_PROVIDER_TYPE env var overrides YAML provider.type", async () => {
		const path = writeYaml(
			"env-provider-type.yaml",
			`
name: test
provider:
  type: anthropic
`,
		);
		const saved = process.env.PHANTOM_PROVIDER_TYPE;
		try {
			process.env.PHANTOM_PROVIDER_TYPE = "ollama";
			const config = await loadConfig(path);
			expect(config.provider.type).toBe("ollama");
		} finally {
			if (saved !== undefined) {
				process.env.PHANTOM_PROVIDER_TYPE = saved;
			} else {
				process.env.PHANTOM_PROVIDER_TYPE = undefined;
			}
			cleanup();
		}
	});

	test("PHANTOM_PROVIDER_TYPE with unknown value leaves YAML provider.type alone", async () => {
		const path = writeYaml(
			"env-provider-type-bad.yaml",
			`
name: test
provider:
  type: zai
`,
		);
		const saved = process.env.PHANTOM_PROVIDER_TYPE;
		try {
			process.env.PHANTOM_PROVIDER_TYPE = "mystery-llm";
			const config = await loadConfig(path);
			expect(config.provider.type).toBe("zai");
		} finally {
			if (saved !== undefined) {
				process.env.PHANTOM_PROVIDER_TYPE = saved;
			} else {
				process.env.PHANTOM_PROVIDER_TYPE = undefined;
			}
			cleanup();
		}
	});

	test("PHANTOM_PROVIDER_BASE_URL env var overrides YAML provider.base_url", async () => {
		const path = writeYaml(
			"env-provider-baseurl.yaml",
			`
name: test
provider:
  type: custom
  base_url: http://old.example.com
`,
		);
		const saved = process.env.PHANTOM_PROVIDER_BASE_URL;
		try {
			process.env.PHANTOM_PROVIDER_BASE_URL = "https://new.example.com/v1";
			const config = await loadConfig(path);
			expect(config.provider.base_url).toBe("https://new.example.com/v1");
		} finally {
			if (saved !== undefined) {
				process.env.PHANTOM_PROVIDER_BASE_URL = saved;
			} else {
				process.env.PHANTOM_PROVIDER_BASE_URL = undefined;
			}
			cleanup();
		}
	});

	test("PHANTOM_PROVIDER_BASE_URL with malformed URL is ignored", async () => {
		const path = writeYaml(
			"env-provider-baseurl-bad.yaml",
			`
name: test
provider:
  type: custom
  base_url: http://old.example.com
`,
		);
		const saved = process.env.PHANTOM_PROVIDER_BASE_URL;
		try {
			process.env.PHANTOM_PROVIDER_BASE_URL = "not a url";
			const config = await loadConfig(path);
			expect(config.provider.base_url).toBe("http://old.example.com");
		} finally {
			if (saved !== undefined) {
				process.env.PHANTOM_PROVIDER_BASE_URL = saved;
			} else {
				process.env.PHANTOM_PROVIDER_BASE_URL = undefined;
			}
			cleanup();
		}
	});

	test("loadConfigSync remains synchronous for legacy callers", () => {
		const path = writeYaml(
			"sync.yaml",
			`
name: sync-test
`,
		);
		try {
			const config = loadConfigSync(path);
			expect(config.name).toBe("sync-test");
			expect(config.secret_source).toBe("env");
		} finally {
			cleanup();
		}
	});
});

describe("loadConfig secret_source", () => {
	const originalFetch = globalThis.fetch;
	const savedKey = process.env.ANTHROPIC_API_KEY;
	const savedToken = process.env.ANTHROPIC_AUTH_TOKEN;

	beforeEach(() => {
		process.env.ANTHROPIC_API_KEY = undefined;
		process.env.ANTHROPIC_AUTH_TOKEN = undefined;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		if (savedKey !== undefined) {
			process.env.ANTHROPIC_API_KEY = savedKey;
		} else {
			process.env.ANTHROPIC_API_KEY = undefined;
		}
		if (savedToken !== undefined) {
			process.env.ANTHROPIC_AUTH_TOKEN = savedToken;
		} else {
			process.env.ANTHROPIC_AUTH_TOKEN = undefined;
		}
		cleanup();
	});

	test("secret_source defaults to 'env' when omitted from YAML", async () => {
		const path = writeYaml("default-source.yaml", "name: default-source");
		const config = await loadConfig(path);
		expect(config.secret_source).toBe("env");
		expect(config.secret_source_url).toBeUndefined();
	});

	test("secret_source: metadata populates ANTHROPIC_API_KEY and ANTHROPIC_AUTH_TOKEN from gateway", async () => {
		// Body deliberately not asserted as a string literal anywhere; we read it
		// back from process.env and compare to the stub-injected reference.
		const stubBody = "stub-token-value";
		globalThis.fetch = mock((url: string | Request) => {
			expect(String(url)).toBe("http://gateway.test/v1/secrets/provider_token");
			return Promise.resolve(
				new Response(stubBody, {
					status: 200,
					headers: { "X-Phantom-Rotation-Id": "1" },
				}),
			);
		}) as unknown as typeof fetch;

		const path = writeYaml(
			"metadata-source.yaml",
			`
name: metadata-tenant
secret_source: metadata
secret_source_url: http://gateway.test
`,
		);
		await loadConfig(path);
		expect(process.env.ANTHROPIC_API_KEY).toBe(stubBody);
		expect(process.env.ANTHROPIC_AUTH_TOKEN).toBe(stubBody);
	});

	test("secret_source: metadata resolves whole-string ${secret:NAME} references in nested config", async () => {
		// Use peers.test_peer.token, an existing schema field that accepts an
		// arbitrary string and is nested. We assert the resolved value via a
		// non-logging path: read it back from the returned config object.
		const peerSecret = "peer-secret-payload";
		globalThis.fetch = mock((url: string | Request) => {
			const u = String(url);
			if (u.endsWith("/v1/secrets/provider_token")) {
				return Promise.resolve(
					new Response("provider-token-value", { status: 200, headers: { "X-Phantom-Rotation-Id": "1" } }),
				);
			}
			if (u.endsWith("/v1/secrets/peer_token")) {
				return Promise.resolve(new Response(peerSecret, { status: 200, headers: { "X-Phantom-Rotation-Id": "1" } }));
			}
			throw new Error(`unexpected URL in test: ${u}`);
		}) as unknown as typeof fetch;

		const path = writeYaml(
			"metadata-walker.yaml",
			`
name: walker-tenant
secret_source: metadata
secret_source_url: http://gateway.test
peers:
  test_peer:
    url: https://peer.test
    token: \${secret:peer_token}
`,
		);
		const config = await loadConfig(path);
		expect(config.peers?.test_peer?.token).toBe(peerSecret);
	});

	test("secret_source: metadata does NOT resolve partial-string ${secret:NAME} (security invariant)", async () => {
		// Whole-string-only matching guards against secret leakage via logged
		// URLs or composed strings. If this test ever fails, the regex changed
		// in a way that allows partial interpolation, which is a security regression.
		const partial = "https://peer.test/?token=${secret:peer_token}";
		globalThis.fetch = mock((url: string | Request) => {
			const u = String(url);
			if (u.endsWith("/v1/secrets/provider_token")) {
				return Promise.resolve(
					new Response("provider-token-value", { status: 200, headers: { "X-Phantom-Rotation-Id": "1" } }),
				);
			}
			throw new Error(`unexpected URL in test (partial-string should NOT trigger fetch): ${u}`);
		}) as unknown as typeof fetch;

		const path = writeYaml(
			"metadata-partial.yaml",
			`
name: partial-tenant
secret_source: metadata
secret_source_url: http://gateway.test
peers:
  test_peer:
    url: ${partial}
    token: keep-as-is
`,
		);
		const config = await loadConfig(path);
		expect(config.peers?.test_peer?.url).toBe(partial);
		expect(config.peers?.test_peer?.token).toBe("keep-as-is");
	});

	test("secret_source: metadata surfaces fetch failures as errors that include the secret name", async () => {
		globalThis.fetch = mock(() =>
			Promise.resolve(new Response("internal error", { status: 500, statusText: "Internal Server Error" })),
		) as unknown as typeof fetch;

		const path = writeYaml(
			"metadata-fail.yaml",
			`
name: fail-tenant
secret_source: metadata
secret_source_url: http://gateway.test
`,
		);
		await expect(loadConfig(path)).rejects.toThrow(/provider_token/);
		await expect(loadConfig(path)).rejects.toThrow(/500/);
	});
});
