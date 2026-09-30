import z from "@deepseek-ai/schemastery";
import { z as z$1 } from "zod";
import { BlockAssembler, ReasoningEffortId, createAssistantMessage, createUserMessage } from "@deepseek-ai/dsh-llm";
//#region src/routes.ts
/** Cordis plugin name (diagnostics only). */
const name = "museai-routes";
/**
* No top-level `inject` export: the row must ACTIVATE even in headless
* profiles where `webServer` never exists. The routes register through a
* nested inject fiber the moment the webserver and the store are both
* available.
*/
const inject = [];
/** Route prefix owned by this plugin (the browser half calls under it). */
const MUSAI_PATH = "/plugins/museai";
/** Loader schema with deployment defaults (no library defaults). */
const Config = z.object({
	chatTimeoutMs: z.number().step(1).min(1e3).default(12e4),
	completeTimeoutMs: z.number().step(1).min(1e3).default(12e4),
	modelsTimeoutMs: z.number().step(1).min(1e3).default(1e4),
	maxCompleteChars: z.number().step(1).min(256).default(2e4)
});
const wireMessageSchema = z$1.object({
	role: z$1.enum(["user", "assistant"]),
	content: z$1.string()
});
z$1.object({
	followDefault: z$1.boolean().optional(),
	provider: z$1.string().optional(),
	model: z$1.string().optional()
});
const chatBodySchema = z$1.object({
	followDefault: z$1.boolean().optional(),
	provider: z$1.string().optional(),
	model: z$1.string().optional(),
	system: z$1.string().optional(),
	messages: z$1.array(wireMessageSchema).min(1),
	temperature: z$1.number().optional(),
	maxTokens: z$1.number().int().positive().optional(),
	thinkingDepth: z$1.enum([
		"off",
		"low",
		"medium",
		"high"
	]).optional()
});
const completeBodySchema = chatBodySchema;
function readJson(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		req.on("data", (chunk) => chunks.push(chunk));
		req.on("end", () => {
			const raw = Buffer.concat(chunks).toString("utf8");
			if (raw.length === 0) {
				resolve({});
				return;
			}
			try {
				resolve(JSON.parse(raw));
			} catch (error) {
				reject(/* @__PURE__ */ new Error(`请求体不是合法 JSON: ${error instanceof Error ? error.message : String(error)}`));
			}
		});
		req.on("error", reject);
	});
}
function writeJson(res, status, body) {
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(JSON.stringify(body));
}
/** Build the llm `Message[]` from wire messages (fresh identities each call). */
function toLlmMessages(messages) {
	return messages.map((message) => {
		const content = [{
			type: "text",
			text: message.content
		}];
		if (message.role === "user") return createUserMessage({
			content,
			source: { kind: "user" }
		});
		return createAssistantMessage({
			content,
			source: {
				provider: "museai",
				model: "museai"
			}
		});
	});
}
/**
* Resolve the effective provider/model for a request: the DSH default
* selection when `followDefault` is set (or neither provider nor model was
* given), else the explicit ids.
* @param ctx - host context with the llm and default-model services.
* @param target - validated request model target.
* @returns the provider and model, or null when unresolvable.
*/
function resolveModelTarget(ctx, target) {
	if (!(target.provider !== void 0 && target.model !== void 0) || target.followDefault === true) {
		const current = ctx.agentDefaultModel.currentSelection();
		if (current === void 0) return null;
		return {
			provider: current.provider,
			model: current.model
		};
	}
	return {
		provider: target.provider,
		model: target.model
	};
}
/** Assemble stream chunks into one text/reasoning result. */
async function assemble(chunks) {
	const assembler = new BlockAssembler();
	for await (const chunk of chunks) assembler.push(chunk);
	assertSuccessfulFinish(assembler.finish);
	const blocks = assembler.blocks();
	return {
		text: blocks.filter((block) => block.type === "text").map((block) => block.text).join(" ").trim(),
		reasoning: blocks.filter((block) => block.type === "reasoning").map((block) => block.text).join(" ").trim(),
		truncated: assembler.finish.kind === "max-tokens",
		usage: assembler.usage
	};
}
/** DSH 0.2 reports adapter failures as terminal chunks, not rejected streams. */
function assertSuccessfulFinish(finish) {
	if (finish.kind === "error") throw new Error(finish.failure.message);
	if (finish.kind === "aborted") throw new DOMException(finish.failure.message, "AbortError");
}
/**
* Validate the thinking depth against the exact model route; returns the
* reasoning effort when supported (matching dsh-gomoku's fallback policy:
* an unsupported effort is dropped, not fatal).
*/
async function resolveReasoningEffort(ctx, provider, model, thinkingDepth, signal) {
	if (thinkingDepth === void 0 || thinkingDepth === "off") return void 0;
	try {
		if ((await ctx.llm.resolveModelInfo(provider, model, signal)).reasoning?.efforts.some((effort) => effort.id === thinkingDepth)) return ReasoningEffortId(thinkingDepth);
	} catch {}
}
/** Assemble GenerateOptions from a validated body (shared by chat/complete). */
async function buildGenerateOptions(ctx, body, signal) {
	const target = resolveModelTarget(ctx, body);
	if (target === null) return null;
	const reasoningEffort = await resolveReasoningEffort(ctx, target.provider, target.model, body.thinkingDepth, signal);
	return {
		provider: target.provider,
		model: target.model,
		messages: toLlmMessages(body.messages),
		...body.system !== void 0 ? { system: body.system } : {},
		...body.temperature !== void 0 ? { temperature: body.temperature } : {},
		...body.maxTokens !== void 0 ? { maxTokens: body.maxTokens } : {},
		...reasoningEffort !== void 0 ? { reasoningEffort } : {},
		signal
	};
}
/** GET /plugins/museai/models — the DSH model catalog + default selection. */
async function handleModels(ctx, res, timeoutMs) {
	const groups = [];
	const failures = [];
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(/* @__PURE__ */ new Error("museai: 模型目录查询超时")), timeoutMs);
	try {
		for (const provider of ctx.llm.listProviders()) {
			let models;
			try {
				models = await ctx.llm.listModels(provider.id);
			} catch (error) {
				failures.push({
					provider: provider.id,
					error: error instanceof Error ? error.message : String(error)
				});
				continue;
			}
			groups.push({
				provider: provider.id,
				displayName: provider.name,
				models: models.map((model) => ({
					id: model.id,
					name: model.name
				}))
			});
		}
		let defaultSelection = null;
		try {
			const current = ctx.agentDefaultModel.currentSelection();
			if (current !== void 0) defaultSelection = {
				provider: current.provider,
				model: current.model,
				...current.reasoningEffort !== void 0 ? { reasoningEffort: String(current.reasoningEffort) } : {}
			};
		} catch {}
		writeJson(res, 200, {
			groups,
			failures,
			defaultSelection
		});
	} finally {
		clearTimeout(timer);
	}
}
/** POST /plugins/museai/chat — streaming generation, NDJSON events. */
async function handleChat(ctx, req, res, timeoutMs) {
	let body;
	try {
		body = chatBodySchema.parse(await readJson(req));
	} catch (error) {
		writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
		return;
	}
	const runId = `museai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(/* @__PURE__ */ new Error("museai: 生成超时")), timeoutMs);
	const detached = req.socket;
	const onClose = () => controller.abort(/* @__PURE__ */ new Error("client disconnected"));
	detached.on("close", onClose);
	res.writeHead(200, {
		"content-type": "application/x-ndjson; charset=utf-8",
		"cache-control": "no-cache",
		"x-accel-buffering": "no"
	});
	const emit = (event) => {
		res.write(`${JSON.stringify(event)}\n`);
	};
	emit({
		event: "start",
		runId
	});
	try {
		const options = await buildGenerateOptions(ctx, body, controller.signal);
		if (options === null) {
			emit({
				event: "error",
				runId,
				message: "museai: 无法解析模型（未指定 provider/model 且 DSH 无默认模型）"
			});
			return;
		}
		const assembler = new BlockAssembler();
		for await (const chunk of ctx.llm.stream(options)) {
			controller.signal.throwIfAborted();
			if (chunk.type === "text-delta" && chunk.text.length > 0) emit({
				event: "delta",
				runId,
				delta: chunk.text
			});
			else if (chunk.type === "reasoning-delta" && chunk.text.length > 0) emit({
				event: "thinking_delta",
				runId,
				delta: chunk.text
			});
			assembler.push(chunk);
		}
		assertSuccessfulFinish(assembler.finish);
		const blocks = assembler.blocks();
		emit({
			event: "done",
			runId,
			text: blocks.filter((block) => block.type === "text").map((block) => block.text).join(" ").trim(),
			reasoning: blocks.filter((block) => block.type === "reasoning").map((block) => block.text).join(" ").trim()
		});
	} catch (error) {
		if (controller.signal.aborted || error instanceof Error && error.name === "AbortError") emit({
			event: "aborted",
			runId
		});
		else emit({
			event: "error",
			runId,
			message: error instanceof Error ? error.message : String(error)
		});
	} finally {
		clearTimeout(timer);
		detached.removeListener("close", onClose);
		res.end();
	}
}
/** POST /plugins/museai/complete — one-shot generation, JSON response. */
async function handleComplete(ctx, req, res, timeoutMs) {
	let body;
	try {
		body = completeBodySchema.parse(await readJson(req));
	} catch (error) {
		writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
		return;
	}
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(/* @__PURE__ */ new Error("museai: 生成超时")), timeoutMs);
	try {
		const options = await buildGenerateOptions(ctx, body, controller.signal);
		if (options === null) {
			writeJson(res, 400, { error: "museai: 无法解析模型（未指定 provider/model 且 DSH 无默认模型）" });
			return;
		}
		const { text, reasoning } = await assemble(ctx.llm.stream(options));
		writeJson(res, 200, {
			text,
			reasoning
		});
	} catch (error) {
		writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
	} finally {
		clearTimeout(timer);
	}
}
const STORE_KEY_SET = /* @__PURE__ */ new Set([
	"settings",
	"partners",
	"partnerChat",
	"story",
	"stylePresets",
	"agent"
]);
const SESSION_KIND_SET = /* @__PURE__ */ new Set(["partner", "story"]);
/** GET/PUT /plugins/museai/store/<key> */
async function handleStore(ctx, req, res, key) {
	if (!STORE_KEY_SET.has(key)) {
		writeJson(res, 404, { error: `未知 store key: ${key}` });
		return;
	}
	const storeKey = key;
	if (req.method === "GET") {
		const blob = ctx.museaiStore.getStore(storeKey);
		if (blob === void 0) {
			writeJson(res, 200, {
				state: {},
				version: 0
			});
			return;
		}
		writeJson(res, 200, blob);
		return;
	}
	if (req.method === "PUT") {
		let raw;
		try {
			raw = await readJson(req);
		} catch (error) {
			writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
			return;
		}
		const parsed = z$1.object({
			state: z$1.record(z$1.string(), z$1.unknown()),
			version: z$1.number()
		}).safeParse(raw);
		if (!parsed.success) {
			writeJson(res, 400, { error: "store 记录格式非法（需要 { state, version }）" });
			return;
		}
		await ctx.museaiStore.putStore(storeKey, parsed.data);
		writeJson(res, 200, { ok: true });
		return;
	}
	writeJson(res, 405, { error: "method not allowed" });
}
/** GET /plugins/museai/sessions/<kind> */
async function handleSessionList(ctx, res, kind) {
	if (!SESSION_KIND_SET.has(kind)) {
		writeJson(res, 404, { error: `未知会话类型: ${kind}` });
		return;
	}
	const kindTyped = kind;
	writeJson(res, 200, { sessions: ctx.museaiStore.listSessions(kindTyped).map((record) => ({
		id: record.id,
		title: record.title,
		savedAt: record.savedAt,
		sessionKind: record.sessionKind,
		characterCardId: record.characterCardId ?? null,
		characterCardIds: record.characterCardIds ?? null,
		selectedWorldBookId: record.selectedWorldBookId ?? null,
		dynamicRoleLoadingEnabled: record.dynamicRoleLoadingEnabled ?? false,
		messageCount: record.messages.length
	})) });
}
/** GET/PUT/DELETE /plugins/museai/sessions/<kind>/<id> */
async function handleSession(ctx, req, res, kind, id) {
	if (!SESSION_KIND_SET.has(kind)) {
		writeJson(res, 404, { error: `未知会话类型: ${kind}` });
		return;
	}
	const kindTyped = kind;
	if (req.method === "GET") {
		const record = ctx.museaiStore.getSession(kindTyped, id);
		if (record === void 0) {
			writeJson(res, 404, { error: `会话不存在: ${id}` });
			return;
		}
		writeJson(res, 200, record);
		return;
	}
	if (req.method === "PUT") {
		let raw;
		try {
			raw = await readJson(req);
		} catch (error) {
			writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
			return;
		}
		const parsed = z$1.object({
			id: z$1.string(),
			title: z$1.string(),
			savedAt: z$1.number(),
			sessionKind: z$1.enum([
				"chat",
				"story",
				"bookTravel"
			]).optional(),
			characterCardId: z$1.string().nullable().optional(),
			characterCardIds: z$1.array(z$1.string()).nullable().optional(),
			selectedWorldBookId: z$1.string().nullable().optional(),
			dynamicRoleLoadingEnabled: z$1.boolean().optional(),
			messages: z$1.array(z$1.unknown()).default([]),
			todos: z$1.array(z$1.unknown()).optional(),
			contextCompaction: z$1.unknown().optional(),
			isArchived: z$1.boolean().optional(),
			selectedStylePresetIds: z$1.array(z$1.string()).optional(),
			initialStylePresetIds: z$1.array(z$1.string()).optional(),
			initialSystemPromptSnapshot: z$1.string().nullable().optional(),
			bookTravelState: z$1.unknown().optional()
		}).safeParse(raw);
		if (!parsed.success) {
			writeJson(res, 400, { error: "会话记录格式非法" });
			return;
		}
		if (parsed.data.id !== id) {
			writeJson(res, 400, { error: "会话 id 与路径不一致" });
			return;
		}
		await ctx.museaiStore.putSession(kindTyped, parsed.data);
		writeJson(res, 200, { ok: true });
		return;
	}
	if (req.method === "DELETE") {
		writeJson(res, 200, { ok: await ctx.museaiStore.deleteSession(kindTyped, id) });
		return;
	}
	writeJson(res, 405, { error: "method not allowed" });
}
/**
* Mount the museai routes the moment the webserver and the store service are
* both available; headless profiles simply never reach this fiber.
* @param ctx - host cordis context.
* @param config - validated loader configuration.
*/
function apply(ctx, config) {
	config.chatTimeoutMs, config.completeTimeoutMs, config.modelsTimeoutMs, config.maxCompleteChars;
	ctx.inject([
		"webServer",
		"llm",
		"agentDefaultModel",
		"museaiStore"
	], (scope) => {
		const dispose = scope.webServer.register({
			kind: "prefix",
			path: MUSAI_PATH,
			handler: (req, res) => {
				(async () => {
					try {
						const segments = new URL(req.url ?? "/", "http://museai.internal").pathname.slice(15).split("/").filter(Boolean);
						if (req.method === "GET" && segments.length === 1 && segments[0] === "models") {
							await handleModels(scope, res, config.modelsTimeoutMs);
							return;
						}
						if (req.method === "POST" && segments.length === 1 && segments[0] === "chat") {
							await handleChat(scope, req, res, config.chatTimeoutMs);
							return;
						}
						if (req.method === "POST" && segments.length === 1 && segments[0] === "complete") {
							await handleComplete(scope, req, res, config.completeTimeoutMs);
							return;
						}
						if (segments.length === 2 && segments[0] === "store") {
							await handleStore(scope, req, res, decodeURIComponent(segments[1]));
							return;
						}
						if (segments.length === 2 && segments[0] === "sessions") {
							await handleSessionList(scope, res, decodeURIComponent(segments[1]));
							return;
						}
						if (segments.length === 3 && segments[0] === "sessions") {
							await handleSession(scope, req, res, decodeURIComponent(segments[1]), decodeURIComponent(segments[2]));
							return;
						}
						writeJson(res, 404, { error: "not found" });
					} catch (error) {
						writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
					}
				})();
			}
		});
		scope.effect(() => () => {
			dispose();
		}, "museai: routes");
	});
}
//#endregion
export { Config, MUSAI_PATH, apply, assemble, buildGenerateOptions, chatBodySchema, completeBodySchema, handleChat, handleComplete, handleModels, handleSession, handleSessionList, handleStore, inject, name, resolveModelTarget };
