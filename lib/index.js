import z from "@deepseek-ai/schemastery";
import { defineDomain, domainTable } from "@deepseek-ai/dsh-storage-domain";
import { z as z$1 } from "zod";
//#region src/domain.ts
/** Session kinds, mirroring MuseAI session prefixes. */
const SESSION_KINDS = ["partner", "story"];
const sessionMessageSchema = z$1.object({
	id: z$1.string(),
	role: z$1.enum(["user", "agent"]),
	content: z$1.string(),
	thinking: z$1.string().optional(),
	thinkingBlocks: z$1.array(z$1.object({
		id: z$1.string(),
		content: z$1.string(),
		signature: z$1.string().optional()
	})).optional(),
	tools: z$1.array(z$1.object({
		id: z$1.string().optional(),
		name: z$1.string(),
		result: z$1.string(),
		status: z$1.string().optional(),
		arguments: z$1.string().optional()
	})).optional(),
	articleType: z$1.string().optional(),
	suggestedChoices: z$1.array(z$1.string()).optional()
});
/** Durable session record schema (validated at the storage boundary). */
const sessionRecordSchema = z$1.object({
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
	messages: z$1.array(sessionMessageSchema).default([]),
	todos: z$1.array(z$1.object({
		content: z$1.string(),
		status: z$1.string()
	})).optional(),
	contextCompaction: z$1.unknown().optional(),
	isArchived: z$1.boolean().optional(),
	selectedStylePresetIds: z$1.array(z$1.string()).optional(),
	initialStylePresetIds: z$1.array(z$1.string()).optional(),
	initialSystemPromptSnapshot: z$1.string().nullable().optional(),
	bookTravelState: z$1.unknown().optional()
});
/** Durable store-envelope schema. */
const storeBlobSchema = z$1.object({
	state: z$1.record(z$1.string(), z$1.unknown()),
	version: z$1.number()
});
/** The `museai` domain declaration. */
const museaiDomainSpec = defineDomain({
	name: "museai",
	version: 1,
	tables: {
		store: domainTable(storeBlobSchema),
		sessions: domainTable(sessionRecordSchema)
	}
});
/** Session table key: `"<kind>:<id>"`. */
function sessionKey(kind, id) {
	return `${kind}:${id}`;
}
/** Split a session table key back into kind and id; null when malformed. */
function parseSessionKey(key) {
	const sepIndex = key.indexOf(":");
	if (sepIndex <= 0) return null;
	const kind = key.slice(0, sepIndex);
	if (!SESSION_KINDS.includes(kind)) return null;
	return {
		kind,
		id: key.slice(sepIndex + 1)
	};
}
/** Memory-backed implementation used before/without the storage domain. */
var MemoryMuseaiStore = class {
	durable = false;
	storeBlobs = /* @__PURE__ */ new Map();
	sessions = /* @__PURE__ */ new Map();
	getStore(key) {
		return this.storeBlobs.get(key);
	}
	async putStore(key, value) {
		this.storeBlobs.set(key, value);
	}
	listSessions(kind) {
		const records = [];
		for (const [key, record] of this.sessions) {
			const parsed = parseSessionKey(key);
			if (parsed !== null && parsed.kind === kind) records.push(record);
		}
		return records.sort((a, b) => b.savedAt - a.savedAt);
	}
	getSession(kind, id) {
		return this.sessions.get(sessionKey(kind, id));
	}
	async putSession(kind, record) {
		this.sessions.set(sessionKey(kind, record.id), record);
	}
	async deleteSession(kind, id) {
		return this.sessions.delete(sessionKey(kind, id));
	}
	/** Snapshot the memory contents for the upgrade flush. */
	snapshot() {
		return {
			storeBlobs: [...this.storeBlobs.entries()],
			sessions: [...this.sessions.entries()]
		};
	}
};
/** Domain-backed implementation over the opened `museai` domain. */
var DomainMuseaiStore = class {
	domain;
	durable = true;
	storeTable;
	sessionTable;
	constructor(domain) {
		this.domain = domain;
		this.storeTable = domain.table("store");
		this.sessionTable = domain.table("sessions");
	}
	getStore(key) {
		return this.storeTable.get(key);
	}
	async putStore(key, value) {
		await this.storeTable.put(key, value);
	}
	listSessions(kind) {
		const records = [];
		for (const [key, record] of this.sessionTable.entries()) {
			const parsed = parseSessionKey(key);
			if (parsed !== null && parsed.kind === kind) records.push(record);
		}
		return records.sort((a, b) => b.savedAt - a.savedAt);
	}
	getSession(kind, id) {
		return this.sessionTable.get(sessionKey(kind, id));
	}
	async putSession(kind, record) {
		await this.sessionTable.put(sessionKey(kind, record.id), record);
	}
	async deleteSession(kind, id) {
		return this.sessionTable.delete(sessionKey(kind, id));
	}
};
/**
* The facade service: starts memory-backed and upgrades to the domain once it
* opens. Every method delegates to the current backend; the upgrade swaps the
* backend after flushing the memory snapshot into the domain.
*/
var StoreFacade = class {
	memory = new MemoryMuseaiStore();
	domainStore = null;
	get durable() {
		return this.domainStore !== null;
	}
	backend() {
		return this.domainStore ?? this.memory;
	}
	getStore(key) {
		return this.backend().getStore(key);
	}
	async putStore(key, value) {
		await this.backend().putStore(key, value);
	}
	listSessions(kind) {
		return this.backend().listSessions(kind);
	}
	getSession(kind, id) {
		return this.backend().getSession(kind, id);
	}
	async putSession(kind, record) {
		await this.backend().putSession(kind, record);
	}
	async deleteSession(kind, id) {
		return this.backend().deleteSession(kind, id);
	}
	/**
	* Upgrade to the opened domain: flush memory contents into the domain
	* tables, then swap the backend. Idempotent (a second call with a domain
	* already active is a no-op).
	* @param domain - the opened museai domain.
	*/
	async upgrade(domain) {
		if (this.domainStore !== null) return;
		const next = new DomainMuseaiStore(domain);
		const { storeBlobs, sessions } = this.memory.snapshot();
		for (const [key, blob] of storeBlobs) await next.putStore(key, blob);
		for (const [key, record] of sessions) {
			const parsed = parseSessionKey(key);
			if (parsed !== null) await next.putSession(parsed.kind, record);
		}
		this.domainStore = next;
		this.memory = new MemoryMuseaiStore();
	}
};
/**
* Create the `museaiStore` service: memory-backed immediately, upgraded to
* the storage domain as soon as the storage-domain facility mounts (nested
* inject fiber — the form activates late in the composition). When the
* facility is already present the fiber resolves at once.
* @param ctx - host context.
* @returns the store service facade.
*/
function createMuseaiStore(ctx) {
	const facade = new StoreFacade();
	let warned = false;
	const warnFallback = () => {
		if (warned) return;
		warned = true;
		ctx.logger.warn("museai: storage domain facility absent — keeping the in-memory store (data is not persisted)");
	};
	const existing = ctx.get("storageDomain");
	if (existing !== void 0) openInto(ctx, facade, existing, warnFallback);
	else warnFallback();
	ctx.inject(["storageDomain"], (scope) => {
		openInto(scope, facade, scope.storageDomain, warnFallback);
	});
	return facade;
}
/** Open the domain through one facility and upgrade the facade on success. */
async function openInto(ctx, facade, facility, warnFallback) {
	try {
		const domain = await facility.open(museaiDomainSpec);
		ctx.effect(() => () => {
			domain.close();
		}, "museai: domain lifecycle");
		await facade.upgrade(domain);
		ctx.logger.info("museai: opened storage domain \"museai\" (durable)");
	} catch (error) {
		warnFallback();
		ctx.logger.warn("museai: failed to open storage domain (%s) — keeping the in-memory store (data is not persisted)", error instanceof Error ? error.message : String(error));
	}
}
//#endregion
//#region src/index.ts
/** Cordis plugin name (diagnostics only). */
const name = "museai";
/** Services required before the store can serve. */
const inject = [];
/** Loader schema with deployment defaults (no library defaults). */
const Config = z.object({
	chatTimeoutMs: z.number().step(1).min(1e3).default(12e4),
	completeTimeoutMs: z.number().step(1).min(1e3).default(12e4),
	modelsTimeoutMs: z.number().step(1).min(1e3).default(1e4),
	maxCompleteChars: z.number().step(1).min(256).default(2e4)
});
/**
* Mount the museai host row: open the storage domain (or fall back to
* memory) and expose the store service.
* @param ctx - host cordis context.
* @param config - validated loader configuration.
*/
async function apply(ctx, config) {
	const store = await createMuseaiStore(ctx);
	ctx.provide("museaiStore", store);
	ctx.logger.info("museai: store ready (durable=%s)", store.durable);
}
//#endregion
export { Config, apply, inject, name };
