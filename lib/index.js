import { createRequire } from "node:module";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import z from "@deepseek-ai/schemastery";
import { exec } from "node:child_process";

//#region rolldown:runtime
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function() {
	return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
var __require = /* @__PURE__ */ createRequire(import.meta.url);

//#endregion
//#region src/stats.ts
/**
* Usage statistics: did the agent still reach for a capability AFTER the user
* turned it off? That answer drives the panel's optimization direction, so it
* must be measured, not guessed.
*
* Detection is pure (this module has no I/O): the host feeds every
* `tools/result` observation through {@link classifyBlockedCall} and appends
* the returned record to a JSONL log. Two blocked shapes exist:
*
* - skill: the `skill` loader tool is still registered (only the catalog entry
*   is shadowed), so a blocked attempt fails INSIDE the tool with
*   "not available for model invocation". The skill name rides the arguments.
* - mcp: a restricted tool is invisible, so dispatch fails BEFORE the body
*   with code UNKNOWN_TOOL. The tool name is the call name itself.
*
* Toggle operations are logged too (kind 'disable'/'enable') so later analysis
* can correlate "turned off at T" with "attempted at T+n".
*/
/** Stable prefix of the guard's denial text, marking a hard call to a preset-layer tool the user turned off. */
const GUARD_DENIAL_PREFIX = "capability-panel: tool disabled";
/**
* Classify one settled call against the session's CURRENT disabled sets.
* Returns null for everything that is not a blocked attempt — including
* unknown-tool failures for tools nobody disabled (genuine model typos).
*/
function classifyBlockedCall(call, disabledSkills, disabledToolNames) {
	if (call.error === void 0) return null;
	const sessionId = typeof call.agent?.id === "string" ? call.agent.id : null;
	if (call.name === "skill") {
		if (!(typeof call.error.message === "string" ? call.error.message : "").includes("not available for model invocation")) return null;
		const args = call.arguments;
		const skillName = args !== null && typeof args === "object" && typeof args.name === "string" ? args.name : null;
		if (skillName === null || !disabledSkills.has(skillName)) return null;
		return {
			kind: "blocked-skill",
			name: skillName,
			sessionId
		};
	}
	if (typeof call.name === "string" && disabledToolNames.has(call.name)) {
		const message = typeof call.error.message === "string" ? call.error.message : "";
		if (call.error.info?.code !== "UNKNOWN_TOOL" && !message.startsWith(GUARD_DENIAL_PREFIX)) return null;
		return {
			kind: "blocked-tool",
			name: call.name,
			sessionId
		};
	}
	return null;
}
/** Aggregate a JSONL log into a name → blocked-attempt count map. */
function aggregateBlocked(lines) {
	const counts = {};
	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed === "") continue;
		let record;
		try {
			record = JSON.parse(trimmed);
		} catch {
			continue;
		}
		if (record.kind !== "blocked-skill" && record.kind !== "blocked-tool" && record.kind !== "blocked-mcp") continue;
		if (typeof record.name !== "string") continue;
		counts[record.name] = (counts[record.name] ?? 0) + 1;
	}
	return counts;
}

//#endregion
//#region src/load-state.ts
/** Pull the skill name out of a `skill` tool call's stringified arguments. */
function skillNameOf(args) {
	if (typeof args !== "string") return null;
	try {
		const parsed = JSON.parse(args);
		if (parsed !== null && typeof parsed === "object" && "name" in parsed) {
			const name = parsed.name;
			return typeof name === "string" && name !== "" ? name : null;
		}
	} catch {}
	return null;
}
function collectLoadRecords(events) {
	const out = [];
	for (const event of events) {
		if (event.type !== "tool/call") continue;
		if (event.data?.name !== "skill") continue;
		const skillName = skillNameOf(event.data.arguments);
		if (skillName === null) continue;
		const seq$6 = event.seq;
		if (typeof seq$6 !== "number") continue;
		out.push({
			seq: seq$6,
			skillName,
			callId: event.data.callId ?? ""
		});
	}
	return out;
}
/**
* Map a tool result's pairing callId to its seq.
*
* Verified against real logs: `tool/result` events carry no
* top-level callId; the pairing lives at `data.message.source.callId` and
* matches the call's `data.callId` exactly.
*
* Last write wins on purpose: the middle-pruner appends a stub `tool/result`
* carrying the SAME callId and a replace surfaceOp over the original's seq
* (verified against a real compacted session), so the callId resolves to the
* stub — the node whose fold verdict actually tracks the surface position.
*/
function indexToolResultSeqs(events) {
	const out = /* @__PURE__ */ new Map();
	for (const event of events) {
		if (event.type !== "tool/result") continue;
		const callId = event.data?.message?.source?.callId;
		const seq$6 = event.seq;
		if (typeof callId !== "string" || callId === "" || typeof seq$6 !== "number") continue;
		out.set(callId, seq$6);
	}
	return out;
}
/**
* The load seqs whose skill content is gone from the model surface.
*
* A `tool/call` never joins the surface itself — SURFACE_EVENT_TYPES in
* dsh-session is exactly { user/message, assistant/message, tool/result }, and
* real skill calls carry `surfaceOp: null`. What the model actually sees of a
* skill is its tool RESULT (a surface node), so eviction keys on the paired
* result's surface membership, not on the call's position.
*
* `surfaceSeqs` is the live session's CURRENT surface (`session.surface.nodes`),
* which the session maintains incrementally — reading it is O(1), no log fold
* is ever run for this panel. A paired result seq absent from that set was
* displaced by a prune stub's or a summary's `replace` op, i.e. shadowed.
*
* A load with no paired result is in flight or its result never landed; it is
* NOT counted as shadowed, so it reports `loaded` — the honest reading of "the
* model is about to see it".
*/
function shadowedLoadSeqs(loads, resultSeqByCallId, surfaceSeqs) {
	const out = /* @__PURE__ */ new Set();
	for (const load of loads) {
		const resultSeq = resultSeqByCallId.get(load.callId);
		if (resultSeq === void 0) continue;
		if (!surfaceSeqs.has(resultSeq)) out.add(load.seq);
	}
	return out;
}
/**
* Substring of dsh-compaction-tool-result-pruner's PRUNE_MARKER. Matching on
* the bracketed phrase (without the surrounding newlines) keeps the check
* robust to marker framing changes across pruner versions.
*/
const PRUNE_MARKER_TEXT = "[... tool result middle pruned ...]";
function textBlocksOf(event) {
	const content = event.data?.message?.content;
	if (!Array.isArray(content)) return [];
	const out = [];
	const walk = (blocks) => {
		for (const block of blocks) {
			if (block === null || typeof block !== "object") continue;
			const record = block;
			if (record.type === "text" && typeof record.text === "string") out.push(record.text);
			else if (Array.isArray(record.content)) walk(record.content);
		}
	};
	walk(content);
	return out;
}
/**
* The load seqs whose paired tool result sits on the surface TRUNCATED —
* head and tail visible, middle replaced by the pruner's marker. The model
* partially sees these skills, so they read as their own state rather than
* either extreme. Only surface-resident results are inspected; a shadowed
* result is already reported by shadowedLoadSeqs and its content is
* irrelevant to the model now.
*/
function prunedLoadSeqs(loads, resultSeqByCallId, surfaceSeqs, events) {
	const prunedResults = /* @__PURE__ */ new Set();
	for (const event of events) {
		if (event.type !== "tool/result") continue;
		const seq$6 = event.seq;
		if (typeof seq$6 !== "number" || !surfaceSeqs.has(seq$6)) continue;
		if (textBlocksOf(event).some((text) => text.includes(PRUNE_MARKER_TEXT))) prunedResults.add(seq$6);
	}
	const out = /* @__PURE__ */ new Set();
	for (const load of loads) {
		const resultSeq = resultSeqByCallId.get(load.callId);
		if (resultSeq !== void 0 && prunedResults.has(resultSeq)) out.add(load.seq);
	}
	return out;
}
/**
* Decide each skill's state.
*
* `shadowedSeqs` holds LOAD seqs whose paired tool result is absent from the
* current surface (see shadowedLoadSeqs for why the result, not the call,
* carries the verdict); `prunedSeqs` holds load seqs whose result survives on
* the surface with its middle truncated. Do NOT re-derive either from
* replacement ranges here: after a replacement lands, a high-seq summary node
* sits at the shadowed range's *position*, so surface order stops tracking
* seq order and a numeric `start <= seq <= end` test silently misjudges later
* compactions.
*
* Verified against real data: the middle-pruner had replaced the lark-shared /
* lark-im / lark-event results with stubs (those now read `pruned`), and a
* later full-history compaction (one replace over [7..16114]) shadowed those
* stubs plus the find-skills / git-worktree-discipline results (those read
* `evicted`).
*/
function decideStates(available, loads, shadowedSeqs, disabledSkills = /* @__PURE__ */ new Set(), prunedSeqs = /* @__PURE__ */ new Set()) {
	const byName = /* @__PURE__ */ new Map();
	for (const record of loads) {
		const bucket = byName.get(record.skillName);
		if (bucket === void 0) byName.set(record.skillName, [record]);
		else bucket.push(record);
	}
	return available.map(({ name, description, masked, source, provider, path, fileAddress, group }) => {
		const records = byName.get(name) ?? [];
		let state = "unloaded";
		if (records.length > 0) {
			const current = records.filter((r) => !shadowedSeqs.has(r.seq));
			if (current.length === 0) state = "evicted";
			else state = current.some((r) => !prunedSeqs.has(r.seq)) ? "loaded" : "pruned";
		}
		return {
			name,
			...description === void 0 ? {} : { description },
			state,
			enabled: !disabledSkills.has(name) && masked !== true,
			loadCount: records.length,
			source,
			provider,
			...path === void 0 ? {} : { path },
			...fileAddress === void 0 ? {} : { fileAddress },
			...group === void 0 ? {} : { group }
		};
	});
}
/** Group MCP tools by server: `mcp__<server>__<tool>`. */
function groupMcpTools(toolNames) {
	const byServer = /* @__PURE__ */ new Map();
	for (const raw of toolNames) {
		if (!raw.startsWith("mcp__")) continue;
		const rest = raw.slice(5);
		const cut = rest.indexOf("__");
		if (cut <= 0) continue;
		const server = rest.slice(0, cut);
		const tool = rest.slice(cut + 2);
		if (tool === "") continue;
		const bucket = byServer.get(server);
		if (bucket === void 0) byServer.set(server, [tool]);
		else bucket.push(tool);
	}
	return [...byServer.entries()].map(([server, tools]) => ({
		server,
		tools: tools.sort()
	})).sort((a, b) => a.server.localeCompare(b.server));
}

//#endregion
//#region src/host/errors.ts
var HttpError = class extends Error {
	constructor(status, message) {
		super(message);
		this.status = status;
	}
};
function errorMessage(error) {
	return error instanceof Error ? error.message : String(error);
}

//#endregion
//#region src/host/reserved.ts
/**
* `run_code` is the Code Mode transport the harness itself depends on. It must
* stay reachable in every session, so it can never be switched off: the
* settings route rejects the attempt with 409, the panels render its switch
* disabled, and enforcement ignores a stored entry naming it. One constant
* keeps the four of those from drifting apart.
*/
const RESERVED_TOOL = "run_code";

//#endregion
//#region src/host/capabilities.ts
function renderDisabledNote(state) {
	const lines = [];
	if (state.skills.size > 0) lines.push(`- Skills: ${[...state.skills.keys()].join(", ")}`);
	if (state.mcpServers.size > 0) lines.push(`- MCP servers: ${[...state.mcpServers.keys()].join(", ")}`);
	if (state.mcpTools.size > 0) lines.push(`- MCP tools: ${[...state.mcpTools.keys()].join(", ")}`);
	if (state.systemTools.size > 0) lines.push(`- System tools: ${[...state.systemTools.keys()].join(", ")}`);
	if (lines.length === 0) return "";
	return [
		"The user has turned off the following capabilities for this session:",
		...lines,
		"Do not attempt to call them. If the user's request depends on one, say it is disabled and can be re-enabled from the Capability Panel."
	].join("\n");
}
function createCapabilityController(ctx, appendStats, blockedCounts) {
	const states = /* @__PURE__ */ new Map();
	const stateFor = (sessionId) => {
		let state = states.get(sessionId);
		if (state === void 0) {
			state = {
				skills: /* @__PURE__ */ new Map(),
				mcpServers: /* @__PURE__ */ new Map(),
				mcpTools: /* @__PURE__ */ new Map(),
				systemTools: /* @__PURE__ */ new Map(),
				userToggled: /* @__PURE__ */ new Set()
			};
			states.set(sessionId, state);
		}
		return state;
	};
	const disabledToolNames = (state) => {
		const names = new Set([...state.mcpTools.keys(), ...state.systemTools.keys()]);
		for (const schema$6 of state.mcpServers.size > 0 ? ctx.get("tools", false)?.schemas() ?? [] : []) {
			if (typeof schema$6.name !== "string" || !schema$6.name.startsWith("mcp__")) continue;
			const server = schema$6.name.slice(5, schema$6.name.indexOf("__", 5));
			if (state.mcpServers.has(server)) names.add(schema$6.name);
		}
		return names;
	};
	ctx.on("system-prompt/assemble", async (_assembly, context, next) => {
		const assembled = await next();
		const sessionId = typeof context.agent?.id === "string" ? context.agent.id : null;
		const state = sessionId === null ? void 0 : states.get(sessionId);
		if (state === void 0 || state.systemTools.size === 0 || assembled.tools === void 0) return assembled;
		return {
			...assembled,
			tools: assembled.tools.filter((tool) => !state.systemTools.has(String(tool.name)))
		};
	});
	let guardRegistered = false;
	const ensureGuard = () => {
		if (guardRegistered) return;
		const guardDispose = ctx.get("tools", false)?.guard?.((execution) => {
			const sessionId = typeof execution.agent?.id === "string" ? execution.agent.id : null;
			const state = sessionId === null ? void 0 : states.get(sessionId);
			const name = typeof execution.name === "string" ? execution.name : null;
			if (state === void 0 || name === null || !state.systemTools.has(name)) return void 0;
			return `${GUARD_DENIAL_PREFIX} "${name}" (re-enable from the Capability Panel)`;
		});
		if (guardDispose === void 0) return;
		guardRegistered = true;
		ctx.effect(() => guardDispose, "capability-panel: tool guard");
	};
	ensureGuard();
	ctx.on("tools/result", (exec$1, result) => {
		const agent = exec$1.agent;
		if (agent === void 0 || typeof agent.id !== "string") return;
		const state = states.get(agent.id);
		if (state === void 0) return;
		const hit = classifyBlockedCall({
			name: exec$1.name,
			arguments: exec$1.arguments,
			agent,
			...result.isError && result.error !== void 0 ? { error: result.error } : {}
		}, new Set(state.skills.keys()), disabledToolNames(state));
		if (hit === null) return;
		blockedCounts[hit.name] = (blockedCounts[hit.name] ?? 0) + 1;
		appendStats({
			ts: (/* @__PURE__ */ new Date()).toISOString(),
			sessionId: agent.id,
			kind: hit.kind,
			name: hit.name
		});
	});
	const ensurePromptNote = (agent, state) => {
		if (state.noteDispose !== void 0) return;
		const systemPrompt = agent.ctx?.get("systemPrompt");
		if (systemPrompt === void 0) return;
		state.noteDispose = systemPrompt.context({
			name: "capability-panel:disabled-capabilities",
			order: 900,
			text: () => renderDisabledNote(state)
		});
	};
	const getAgentTools = (sessionId) => {
		const agent = ctx.get("agents", false)?.get(sessionId);
		const tools = agent?.ctx?.get("tools");
		if (agent === void 0) throw new HttpError(404, "session agent is not available");
		if (tools === void 0) throw new HttpError(503, "session tools service is not available");
		return {
			agent,
			tools
		};
	};
	const setSkill = async (sessionId, name, enabled) => {
		const state = stateFor(sessionId);
		const existing = state.skills.get(name);
		if (enabled && existing !== void 0) {
			existing();
			state.skills.delete(name);
			return;
		}
		const agent = ctx.get("agents", false)?.get(sessionId);
		const scopedSkills = agent?.ctx?.get("skills");
		if (agent === void 0 || scopedSkills === void 0) throw new HttpError(agent === void 0 ? 404 : 503, agent === void 0 ? "session agent is not available" : "session skills service is not available");
		if (enabled || existing !== void 0) return;
		const skills = ctx.get("skills", false);
		if (skills === void 0) throw new HttpError(503, "skills service unavailable");
		const cwd = agent.session?.header?.cwd;
		const original = await skills.get(name, {
			...cwd === void 0 ? {} : { cwd },
			scope: agent
		});
		if (original === void 0 || typeof original.name !== "string" || typeof original.description !== "string" || typeof original.content !== "string") throw new HttpError(404, `skill "${name}" is not available in this session`);
		state.skills.set(name, scopedSkills.register({
			name: original.name,
			description: original.description,
			content: original.content,
			source: typeof original.source === "string" ? original.source : "custom",
			provider: typeof original.provider === "string" ? original.provider : "capability-panel",
			...original.resourceBase === void 0 ? {} : { resourceBase: original.resourceBase },
			...typeof original.path === "string" ? { path: original.path } : {},
			invocation: {
				modelInvocable: false,
				userInvocable: true
			}
		}));
		ensurePromptNote(agent, state);
	};
	const setServer = (sessionId, server, enabled) => {
		const state = stateFor(sessionId);
		const existing = state.mcpServers.get(server);
		if (enabled) {
			const prefix$1 = `mcp__${server}__`;
			for (const [name, dispose] of [...state.mcpTools]) if (name.startsWith(prefix$1)) {
				dispose();
				state.mcpTools.delete(name);
			}
			if (existing !== void 0) {
				existing.dispose();
				state.mcpServers.delete(server);
			}
			return;
		}
		if (existing !== void 0) return;
		const { agent, tools } = getAgentTools(sessionId);
		const toolService = ctx.get("tools", false);
		if (toolService === void 0) throw new HttpError(503, "tools service unavailable");
		const prefix = `mcp__${server}__`;
		const names = [...toolService.schemas()].map((schema$6) => schema$6.name).filter((name) => typeof name === "string" && name.startsWith(prefix));
		if (names.length === 0) throw new HttpError(404, `MCP server "${server}" exposes no tools`);
		state.mcpServers.set(server, {
			dispose: tools.restrict({ deny: names }),
			names
		});
		ensurePromptNote(agent, state);
	};
	const setTool = (sessionId, name, enabled, system) => {
		const state = stateFor(sessionId);
		const map$6 = system ? state.systemTools : state.mcpTools;
		const existing = map$6.get(name);
		if (enabled) {
			if (existing !== void 0) {
				existing();
				map$6.delete(name);
			}
			return;
		}
		if (existing !== void 0) return;
		if (system && name === RESERVED_TOOL) throw new HttpError(409, "run_code is the reserved Code Mode transport and cannot be restricted");
		const { agent, tools } = getAgentTools(sessionId);
		const toolService = ctx.get("tools", false);
		if (toolService === void 0) throw new HttpError(503, "tools service unavailable");
		const globalNames = new Set([...toolService.schemas()].map((schema$6) => schema$6.name).filter((entry) => typeof entry === "string"));
		const scopedNames = system ? new Set([...toolService.schemas(agent)].map((schema$6) => schema$6.name).filter((entry) => typeof entry === "string")) : globalNames;
		if (!(system ? scopedNames.has(name) : globalNames.has(name) && name.startsWith("mcp__"))) throw new HttpError(404, `${system ? "system tool" : "MCP tool"} "${name}" is not available in this session`);
		if (system) ensureGuard();
		map$6.set(name, globalNames.has(name) ? tools.restrict({ deny: [name] }) : () => {});
		ensurePromptNote(agent, state);
	};
	ctx.effect(() => () => {
		for (const state of states.values()) {
			for (const dispose of state.skills.values()) dispose();
			for (const mask of state.mcpServers.values()) mask.dispose();
			for (const dispose of state.mcpTools.values()) dispose();
			for (const dispose of state.systemTools.values()) dispose();
			state.noteDispose?.();
		}
		states.clear();
	}, "capability-panel: capability masks");
	const seed = async (sessionId, defaults, includeSkills = true) => {
		const agent = ctx.get("agents", false)?.get(sessionId);
		if (agent === void 0) return;
		let state = states.get(sessionId);
		const ensureState = () => {
			if (state === void 0) state = stateFor(sessionId);
			return state;
		};
		let maskedAny = false;
		const scopedTools = agent.ctx?.get("tools");
		const toolsService = ctx.get("tools", false);
		if (scopedTools !== void 0 && toolsService !== void 0) {
			const globalNames = /* @__PURE__ */ new Set();
			const scopedNames = /* @__PURE__ */ new Set();
			for (const schema$6 of toolsService.schemas()) if (typeof schema$6.name === "string") globalNames.add(schema$6.name);
			for (const schema$6 of toolsService.schemas(agent)) if (typeof schema$6.name === "string") scopedNames.add(schema$6.name);
			for (const name of defaults.tools) {
				if (!globalNames.has(name)) continue;
				if (name.startsWith("mcp__")) continue;
				if (name === RESERVED_TOOL || state?.systemTools.has(name) === true) continue;
				if (!scopedNames.has(name)) continue;
				ensureState().systemTools.set(name, scopedTools.restrict({ deny: [name] }));
				ensureGuard();
				maskedAny = true;
			}
			const mcpDefaults = defaults.tools.filter((name) => globalNames.has(name));
			const fullByServer = new Map(groupMcpTools([...globalNames]).map((group) => [group.server, group.tools]));
			for (const group of groupMcpTools(mcpDefaults)) {
				const full = fullByServer.get(group.server);
				if (full.every((tool) => group.tools.includes(tool))) {
					const st = ensureState();
					const prefix = `mcp__${group.server}__`;
					const fullNames = full.map((tool) => `${prefix}${tool}`);
					const existingMask = st.mcpServers.get(group.server);
					if (existingMask !== void 0 && fullNames.every((name) => existingMask.names.includes(name))) continue;
					for (const [name, dispose] of [...st.mcpTools]) if (name.startsWith(prefix)) {
						dispose();
						st.mcpTools.delete(name);
					}
					existingMask?.dispose();
					st.mcpServers.set(group.server, {
						dispose: scopedTools.restrict({ deny: fullNames }),
						names: fullNames
					});
					maskedAny = true;
					continue;
				}
				for (const tool of group.tools) {
					const name = `mcp__${group.server}__${tool}`;
					if (state?.mcpTools.has(name) === true) continue;
					ensureState().mcpTools.set(name, scopedTools.restrict({ deny: [name] }));
					maskedAny = true;
				}
			}
		}
		const scopedSkills = agent.ctx?.get("skills");
		const skillsService = ctx.get("skills", false);
		if (includeSkills && scopedSkills !== void 0 && skillsService !== void 0) {
			const cwd = agent.session?.header?.cwd;
			const lookup = {
				...cwd === void 0 ? {} : { cwd },
				scope: agent
			};
			const disposers = await Promise.all(defaults.skills.map(async (name) => {
				if (state?.skills.has(name) === true) return void 0;
				try {
					const original = await skillsService.get(name, lookup);
					if (original === void 0) return void 0;
					if (typeof original.name !== "string" || typeof original.description !== "string") return void 0;
					if (typeof original.content !== "string") return void 0;
					return scopedSkills.register({
						name: original.name,
						description: original.description,
						content: original.content,
						source: typeof original.source === "string" ? original.source : "custom",
						provider: typeof original.provider === "string" ? original.provider : "capability-panel",
						...original.resourceBase === void 0 ? {} : { resourceBase: original.resourceBase },
						...typeof original.path === "string" ? { path: original.path } : {},
						invocation: {
							modelInvocable: false,
							userInvocable: true
						}
					});
				} catch {
					return;
				}
			}));
			for (let i = 0; i < disposers.length; i += 1) {
				const dispose = disposers[i];
				const name = defaults.skills[i];
				if (dispose !== void 0 && name !== void 0 && state?.skills.has(name) !== true) {
					ensureState().skills.set(name, dispose);
					maskedAny = true;
				}
			}
		}
		if (maskedAny) ensurePromptNote(agent, ensureState());
	};
	const mutationQueues = /* @__PURE__ */ new Map();
	const enqueue = (sessionId, op) => {
		const next = (mutationQueues.get(sessionId) ?? Promise.resolve()).then(op, op);
		mutationQueues.set(sessionId, next.then(() => void 0, () => void 0));
		return next;
	};
	const restoreImpl = async (sessionId, overrides) => {
		const groups = [
			["skill", overrides.skills],
			["mcp-server", overrides.mcpServers],
			["mcp-tool", overrides.mcpTools],
			["system-tool", overrides.systemTools]
		];
		for (const [kind, positions] of groups) for (const [name, enabled] of Object.entries(positions)) {
			if (states.get(sessionId)?.userToggled.has(`${kind}:${name}`) === true) continue;
			try {
				if (kind === "skill") await setSkill(sessionId, name, enabled);
				else if (kind === "mcp-server") setServer(sessionId, name, enabled);
				else setTool(sessionId, name, enabled, kind === "system-tool");
			} catch {}
		}
		const st = states.get(sessionId);
		if (st !== void 0 && st.userToggled.size === 0 && st.skills.size === 0 && st.mcpServers.size === 0 && st.mcpTools.size === 0 && st.systemTools.size === 0) {
			st.noteDispose?.();
			delete st.noteDispose;
			states.delete(sessionId);
		}
	};
	return {
		states,
		state: (sessionId) => states.get(sessionId),
		seed: (sessionId, defaults) => enqueue(sessionId, () => seed(sessionId, defaults)),
		restore: (sessionId, overrides) => enqueue(sessionId, () => restoreImpl(sessionId, overrides)),
		reseed: (sessionId, defaults, overrides) => enqueue(sessionId, async () => {
			const st = states.get(sessionId);
			if (st !== void 0) {
				for (const dispose of st.systemTools.values()) dispose();
				for (const mask of st.mcpServers.values()) mask.dispose();
				for (const dispose of st.mcpTools.values()) dispose();
				for (const dispose of st.skills.values()) dispose();
				for (const map$6 of [
					st.systemTools,
					st.mcpServers,
					st.mcpTools,
					st.skills
				]) map$6.clear();
				st.noteDispose?.();
				delete st.noteDispose;
				st.userToggled.clear();
				states.delete(sessionId);
			}
			if (defaults.tools.length > 0 || defaults.skills.length > 0) await seed(sessionId, defaults);
			if (overrides !== void 0) await restoreImpl(sessionId, overrides);
		}),
		remask: (sessionId, defaults, overrides) => enqueue(sessionId, async () => {
			if (defaults.tools.length > 0) await seed(sessionId, defaults, false);
			if (overrides !== void 0) await restoreImpl(sessionId, {
				skills: {},
				mcpServers: overrides.mcpServers,
				mcpTools: overrides.mcpTools,
				systemTools: overrides.systemTools
			});
		}),
		set: (sessionId, kind, name, enabled) => enqueue(sessionId, async () => {
			stateFor(sessionId).userToggled.add(`${kind}:${name}`);
			if (kind === "skill") await setSkill(sessionId, name, enabled);
			else if (kind === "mcp-server") setServer(sessionId, name, enabled);
			else setTool(sessionId, name, enabled, kind === "system-tool");
			appendStats({
				ts: (/* @__PURE__ */ new Date()).toISOString(),
				sessionId,
				kind: enabled ? "enable" : "disable",
				name: `${kind}:${name}`
			});
		})
	};
}

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/identity.js
var require_identity = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/identity.js": ((exports) => {
	const ALIAS = Symbol.for("yaml.alias");
	const DOC = Symbol.for("yaml.document");
	const MAP = Symbol.for("yaml.map");
	const PAIR = Symbol.for("yaml.pair");
	const SCALAR$1 = Symbol.for("yaml.scalar");
	const SEQ = Symbol.for("yaml.seq");
	const NODE_TYPE = Symbol.for("yaml.node.type");
	const isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
	const isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
	const isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
	const isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
	const isScalar$1 = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR$1;
	const isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
	function isCollection$1(node) {
		if (node && typeof node === "object") switch (node[NODE_TYPE]) {
			case MAP:
			case SEQ: return true;
		}
		return false;
	}
	function isNode(node) {
		if (node && typeof node === "object") switch (node[NODE_TYPE]) {
			case ALIAS:
			case MAP:
			case SCALAR$1:
			case SEQ: return true;
		}
		return false;
	}
	const hasAnchor = (node) => (isScalar$1(node) || isCollection$1(node)) && !!node.anchor;
	exports.ALIAS = ALIAS;
	exports.DOC = DOC;
	exports.MAP = MAP;
	exports.NODE_TYPE = NODE_TYPE;
	exports.PAIR = PAIR;
	exports.SCALAR = SCALAR$1;
	exports.SEQ = SEQ;
	exports.hasAnchor = hasAnchor;
	exports.isAlias = isAlias;
	exports.isCollection = isCollection$1;
	exports.isDocument = isDocument;
	exports.isMap = isMap;
	exports.isNode = isNode;
	exports.isPair = isPair;
	exports.isScalar = isScalar$1;
	exports.isSeq = isSeq;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/visit.js
var require_visit = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/visit.js": ((exports) => {
	var identity$32 = require_identity();
	const BREAK$1 = Symbol("break visit");
	const SKIP$1 = Symbol("skip children");
	const REMOVE$1 = Symbol("remove node");
	/**
	* Apply a visitor to an AST node or document.
	*
	* Walks through the tree (depth-first) starting from `node`, calling a
	* `visitor` function with three arguments:
	*   - `key`: For sequence values and map `Pair`, the node's index in the
	*     collection. Within a `Pair`, `'key'` or `'value'`, correspondingly.
	*     `null` for the root node.
	*   - `node`: The current node.
	*   - `path`: The ancestry of the current node.
	*
	* The return value of the visitor may be used to control the traversal:
	*   - `undefined` (default): Do nothing and continue
	*   - `visit.SKIP`: Do not visit the children of this node, continue with next
	*     sibling
	*   - `visit.BREAK`: Terminate traversal completely
	*   - `visit.REMOVE`: Remove the current node, then continue with the next one
	*   - `Node`: Replace the current node, then continue by visiting it
	*   - `number`: While iterating the items of a sequence or map, set the index
	*     of the next step. This is useful especially if the index of the current
	*     node has changed.
	*
	* If `visitor` is a single function, it will be called with all values
	* encountered in the tree, including e.g. `null` values. Alternatively,
	* separate visitor functions may be defined for each `Map`, `Pair`, `Seq`,
	* `Alias` and `Scalar` node. To define the same visitor function for more than
	* one node type, use the `Collection` (map and seq), `Value` (map, seq & scalar)
	* and `Node` (alias, map, seq & scalar) targets. Of all these, only the most
	* specific defined one will be used for each node.
	*/
	function visit$5(node, visitor) {
		const visitor_ = initVisitor(visitor);
		if (identity$32.isDocument(node)) {
			if (visit_(null, node.contents, visitor_, Object.freeze([node])) === REMOVE$1) node.contents = null;
		} else visit_(null, node, visitor_, Object.freeze([]));
	}
	/** Terminate visit traversal completely */
	visit$5.BREAK = BREAK$1;
	/** Do not visit the children of the current node */
	visit$5.SKIP = SKIP$1;
	/** Remove the current node */
	visit$5.REMOVE = REMOVE$1;
	function visit_(key, node, visitor, path) {
		const ctrl = callVisitor(key, node, visitor, path);
		if (identity$32.isNode(ctrl) || identity$32.isPair(ctrl)) {
			replaceNode(key, path, ctrl);
			return visit_(key, ctrl, visitor, path);
		}
		if (typeof ctrl !== "symbol") {
			if (identity$32.isCollection(node)) {
				path = Object.freeze(path.concat(node));
				for (let i = 0; i < node.items.length; ++i) {
					const ci = visit_(i, node.items[i], visitor, path);
					if (typeof ci === "number") i = ci - 1;
					else if (ci === BREAK$1) return BREAK$1;
					else if (ci === REMOVE$1) {
						node.items.splice(i, 1);
						i -= 1;
					}
				}
			} else if (identity$32.isPair(node)) {
				path = Object.freeze(path.concat(node));
				const ck = visit_("key", node.key, visitor, path);
				if (ck === BREAK$1) return BREAK$1;
				else if (ck === REMOVE$1) node.key = null;
				const cv = visit_("value", node.value, visitor, path);
				if (cv === BREAK$1) return BREAK$1;
				else if (cv === REMOVE$1) node.value = null;
			}
		}
		return ctrl;
	}
	/**
	* Apply an async visitor to an AST node or document.
	*
	* Walks through the tree (depth-first) starting from `node`, calling a
	* `visitor` function with three arguments:
	*   - `key`: For sequence values and map `Pair`, the node's index in the
	*     collection. Within a `Pair`, `'key'` or `'value'`, correspondingly.
	*     `null` for the root node.
	*   - `node`: The current node.
	*   - `path`: The ancestry of the current node.
	*
	* The return value of the visitor may be used to control the traversal:
	*   - `Promise`: Must resolve to one of the following values
	*   - `undefined` (default): Do nothing and continue
	*   - `visit.SKIP`: Do not visit the children of this node, continue with next
	*     sibling
	*   - `visit.BREAK`: Terminate traversal completely
	*   - `visit.REMOVE`: Remove the current node, then continue with the next one
	*   - `Node`: Replace the current node, then continue by visiting it
	*   - `number`: While iterating the items of a sequence or map, set the index
	*     of the next step. This is useful especially if the index of the current
	*     node has changed.
	*
	* If `visitor` is a single function, it will be called with all values
	* encountered in the tree, including e.g. `null` values. Alternatively,
	* separate visitor functions may be defined for each `Map`, `Pair`, `Seq`,
	* `Alias` and `Scalar` node. To define the same visitor function for more than
	* one node type, use the `Collection` (map and seq), `Value` (map, seq & scalar)
	* and `Node` (alias, map, seq & scalar) targets. Of all these, only the most
	* specific defined one will be used for each node.
	*/
	async function visitAsync(node, visitor) {
		const visitor_ = initVisitor(visitor);
		if (identity$32.isDocument(node)) {
			if (await visitAsync_(null, node.contents, visitor_, Object.freeze([node])) === REMOVE$1) node.contents = null;
		} else await visitAsync_(null, node, visitor_, Object.freeze([]));
	}
	/** Terminate visit traversal completely */
	visitAsync.BREAK = BREAK$1;
	/** Do not visit the children of the current node */
	visitAsync.SKIP = SKIP$1;
	/** Remove the current node */
	visitAsync.REMOVE = REMOVE$1;
	async function visitAsync_(key, node, visitor, path) {
		const ctrl = await callVisitor(key, node, visitor, path);
		if (identity$32.isNode(ctrl) || identity$32.isPair(ctrl)) {
			replaceNode(key, path, ctrl);
			return visitAsync_(key, ctrl, visitor, path);
		}
		if (typeof ctrl !== "symbol") {
			if (identity$32.isCollection(node)) {
				path = Object.freeze(path.concat(node));
				for (let i = 0; i < node.items.length; ++i) {
					const ci = await visitAsync_(i, node.items[i], visitor, path);
					if (typeof ci === "number") i = ci - 1;
					else if (ci === BREAK$1) return BREAK$1;
					else if (ci === REMOVE$1) {
						node.items.splice(i, 1);
						i -= 1;
					}
				}
			} else if (identity$32.isPair(node)) {
				path = Object.freeze(path.concat(node));
				const ck = await visitAsync_("key", node.key, visitor, path);
				if (ck === BREAK$1) return BREAK$1;
				else if (ck === REMOVE$1) node.key = null;
				const cv = await visitAsync_("value", node.value, visitor, path);
				if (cv === BREAK$1) return BREAK$1;
				else if (cv === REMOVE$1) node.value = null;
			}
		}
		return ctrl;
	}
	function initVisitor(visitor) {
		if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) return Object.assign({
			Alias: visitor.Node,
			Map: visitor.Node,
			Scalar: visitor.Node,
			Seq: visitor.Node
		}, visitor.Value && {
			Map: visitor.Value,
			Scalar: visitor.Value,
			Seq: visitor.Value
		}, visitor.Collection && {
			Map: visitor.Collection,
			Seq: visitor.Collection
		}, visitor);
		return visitor;
	}
	function callVisitor(key, node, visitor, path) {
		if (typeof visitor === "function") return visitor(key, node, path);
		if (identity$32.isMap(node)) return visitor.Map?.(key, node, path);
		if (identity$32.isSeq(node)) return visitor.Seq?.(key, node, path);
		if (identity$32.isPair(node)) return visitor.Pair?.(key, node, path);
		if (identity$32.isScalar(node)) return visitor.Scalar?.(key, node, path);
		if (identity$32.isAlias(node)) return visitor.Alias?.(key, node, path);
	}
	function replaceNode(key, path, node) {
		const parent = path[path.length - 1];
		if (identity$32.isCollection(parent)) parent.items[key] = node;
		else if (identity$32.isPair(parent)) if (key === "key") parent.key = node;
		else parent.value = node;
		else if (identity$32.isDocument(parent)) parent.contents = node;
		else {
			const pt = identity$32.isAlias(parent) ? "alias" : "scalar";
			throw new Error(`Cannot replace node with ${pt} parent`);
		}
	}
	exports.visit = visit$5;
	exports.visitAsync = visitAsync;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/directives.js
var require_directives = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/directives.js": ((exports) => {
	var identity$31 = require_identity();
	var visit$4 = require_visit();
	const escapeChars = {
		"!": "%21",
		",": "%2C",
		"[": "%5B",
		"]": "%5D",
		"{": "%7B",
		"}": "%7D"
	};
	const escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
	var Directives = class Directives {
		constructor(yaml, tags$1) {
			/**
			* The directives-end/doc-start marker `---`. If `null`, a marker may still be
			* included in the document's stringified representation.
			*/
			this.docStart = null;
			/** The doc-end marker `...`.  */
			this.docEnd = false;
			this.yaml = Object.assign({}, Directives.defaultYaml, yaml);
			this.tags = Object.assign({}, Directives.defaultTags, tags$1);
		}
		clone() {
			const copy = new Directives(this.yaml, this.tags);
			copy.docStart = this.docStart;
			return copy;
		}
		/**
		* During parsing, get a Directives instance for the current document and
		* update the stream state according to the current version's spec.
		*/
		atDocument() {
			const res = new Directives(this.yaml, this.tags);
			switch (this.yaml.version) {
				case "1.1":
					this.atNextDocument = true;
					break;
				case "1.2":
					this.atNextDocument = false;
					this.yaml = {
						explicit: Directives.defaultYaml.explicit,
						version: "1.2"
					};
					this.tags = Object.assign({}, Directives.defaultTags);
					break;
			}
			return res;
		}
		/**
		* @param onError - May be called even if the action was successful
		* @returns `true` on success
		*/
		add(line, onError) {
			if (this.atNextDocument) {
				this.yaml = {
					explicit: Directives.defaultYaml.explicit,
					version: "1.1"
				};
				this.tags = Object.assign({}, Directives.defaultTags);
				this.atNextDocument = false;
			}
			const parts = line.trim().split(/[ \t]+/);
			const name = parts.shift();
			switch (name) {
				case "%TAG": {
					if (parts.length !== 2) {
						onError(0, "%TAG directive should contain exactly two parts");
						if (parts.length < 2) return false;
					}
					const [handle, prefix] = parts;
					this.tags[handle] = prefix;
					return true;
				}
				case "%YAML": {
					this.yaml.explicit = true;
					if (parts.length !== 1) {
						onError(0, "%YAML directive should contain exactly one part");
						return false;
					}
					const [version] = parts;
					if (version === "1.1" || version === "1.2") {
						this.yaml.version = version;
						return true;
					} else {
						const isValid = /^\d+\.\d+$/.test(version);
						onError(6, `Unsupported YAML version ${version}`, isValid);
						return false;
					}
				}
				default:
					onError(0, `Unknown directive ${name}`, true);
					return false;
			}
		}
		/**
		* Resolves a tag, matching handles to those defined in %TAG directives.
		*
		* @returns Resolved tag, which may also be the non-specific tag `'!'` or a
		*   `'!local'` tag, or `null` if unresolvable.
		*/
		tagName(source, onError) {
			if (source === "!") return "!";
			if (source[0] !== "!") {
				onError(`Not a valid tag: ${source}`);
				return null;
			}
			if (source[1] === "<") {
				const verbatim = source.slice(2, -1);
				if (verbatim === "!" || verbatim === "!!") {
					onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
					return null;
				}
				if (source[source.length - 1] !== ">") onError("Verbatim tags must end with a >");
				return verbatim;
			}
			const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
			if (!suffix) onError(`The ${source} tag has no suffix`);
			const prefix = this.tags[handle];
			if (prefix) try {
				return prefix + decodeURIComponent(suffix);
			} catch (error) {
				onError(String(error));
				return null;
			}
			if (handle === "!") return source;
			onError(`Could not resolve tag: ${source}`);
			return null;
		}
		/**
		* Given a fully resolved tag, returns its printable string form,
		* taking into account current tag prefixes and defaults.
		*/
		tagString(tag) {
			for (const [handle, prefix] of Object.entries(this.tags)) if (tag.startsWith(prefix)) return handle + escapeTagName(tag.substring(prefix.length));
			return tag[0] === "!" ? tag : `!<${tag}>`;
		}
		toString(doc) {
			const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
			const tagEntries = Object.entries(this.tags);
			let tagNames;
			if (doc && tagEntries.length > 0 && identity$31.isNode(doc.contents)) {
				const tags$1 = {};
				visit$4.visit(doc.contents, (_key, node) => {
					if (identity$31.isNode(node) && node.tag) tags$1[node.tag] = true;
				});
				tagNames = Object.keys(tags$1);
			} else tagNames = [];
			for (const [handle, prefix] of tagEntries) {
				if (handle === "!!" && prefix === "tag:yaml.org,2002:") continue;
				if (!doc || tagNames.some((tn) => tn.startsWith(prefix))) lines.push(`%TAG ${handle} ${prefix}`);
			}
			return lines.join("\n");
		}
	};
	Directives.defaultYaml = {
		explicit: false,
		version: "1.2"
	};
	Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
	exports.Directives = Directives;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/anchors.js
var require_anchors = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/anchors.js": ((exports) => {
	var identity$30 = require_identity();
	var visit$3 = require_visit();
	/**
	* Verify that the input string is a valid anchor.
	*
	* Will throw on errors.
	*/
	function anchorIsValid(anchor) {
		if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
			const msg = `Anchor must not contain whitespace or control characters: ${JSON.stringify(anchor)}`;
			throw new Error(msg);
		}
		return true;
	}
	function anchorNames(root) {
		const anchors$3 = /* @__PURE__ */ new Set();
		visit$3.visit(root, { Value(_key, node) {
			if (node.anchor) anchors$3.add(node.anchor);
		} });
		return anchors$3;
	}
	/** Find a new anchor name with the given `prefix` and a one-indexed suffix. */
	function findNewAnchor(prefix, exclude) {
		for (let i = 1;; ++i) {
			const name = `${prefix}${i}`;
			if (!exclude.has(name)) return name;
		}
	}
	function createNodeAnchors(doc, prefix) {
		const aliasObjects = [];
		const sourceObjects = /* @__PURE__ */ new Map();
		let prevAnchors = null;
		return {
			onAnchor: (source) => {
				aliasObjects.push(source);
				prevAnchors ?? (prevAnchors = anchorNames(doc));
				const anchor = findNewAnchor(prefix, prevAnchors);
				prevAnchors.add(anchor);
				return anchor;
			},
			setAnchors: () => {
				for (const source of aliasObjects) {
					const ref = sourceObjects.get(source);
					if (typeof ref === "object" && ref.anchor && (identity$30.isScalar(ref.node) || identity$30.isCollection(ref.node))) ref.node.anchor = ref.anchor;
					else {
						const error = /* @__PURE__ */ new Error("Failed to resolve repeated object (this should not happen)");
						error.source = source;
						throw error;
					}
				}
			},
			sourceObjects
		};
	}
	exports.anchorIsValid = anchorIsValid;
	exports.anchorNames = anchorNames;
	exports.createNodeAnchors = createNodeAnchors;
	exports.findNewAnchor = findNewAnchor;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/applyReviver.js": ((exports) => {
	/**
	* Applies the JSON.parse reviver algorithm as defined in the ECMA-262 spec,
	* in section 24.5.1.1 "Runtime Semantics: InternalizeJSONProperty" of the
	* 2021 edition: https://tc39.es/ecma262/#sec-json.parse
	*
	* Includes extensions for handling Map and Set objects.
	*/
	function applyReviver$2(reviver, obj, key, val) {
		if (val && typeof val === "object") if (Array.isArray(val)) for (let i = 0, len = val.length; i < len; ++i) {
			const v0 = val[i];
			const v1 = applyReviver$2(reviver, val, String(i), v0);
			if (v1 === void 0) delete val[i];
			else if (v1 !== v0) val[i] = v1;
		}
		else if (val instanceof Map) for (const k of Array.from(val.keys())) {
			const v0 = val.get(k);
			const v1 = applyReviver$2(reviver, val, k, v0);
			if (v1 === void 0) val.delete(k);
			else if (v1 !== v0) val.set(k, v1);
		}
		else if (val instanceof Set) for (const v0 of Array.from(val)) {
			const v1 = applyReviver$2(reviver, val, v0, v0);
			if (v1 === void 0) val.delete(v0);
			else if (v1 !== v0) {
				val.delete(v0);
				val.add(v1);
			}
		}
		else for (const [k, v0] of Object.entries(val)) {
			const v1 = applyReviver$2(reviver, val, k, v0);
			if (v1 === void 0) delete val[k];
			else if (v1 !== v0) val[k] = v1;
		}
		return reviver.call(obj, key, val);
	}
	exports.applyReviver = applyReviver$2;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/toJS.js
var require_toJS = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/toJS.js": ((exports) => {
	var identity$29 = require_identity();
	/**
	* Recursively convert any node or its contents to native JavaScript
	*
	* @param value - The input value
	* @param arg - If `value` defines a `toJSON()` method, use this
	*   as its first argument
	* @param ctx - Conversion context, originally set in Document#toJS(). If
	*   `{ keep: true }` is not set, output should be suitable for JSON
	*   stringification.
	*/
	function toJS$7(value, arg, ctx) {
		if (Array.isArray(value)) return value.map((v, i) => toJS$7(v, String(i), ctx));
		if (value && typeof value.toJSON === "function") {
			if (!ctx || !identity$29.hasAnchor(value)) return value.toJSON(arg, ctx);
			const data = {
				aliasCount: 0,
				count: 1,
				res: void 0
			};
			ctx.anchors.set(value, data);
			ctx.onCreate = (res$1) => {
				data.res = res$1;
				delete ctx.onCreate;
			};
			const res = value.toJSON(arg, ctx);
			if (ctx.onCreate) ctx.onCreate(res);
			return res;
		}
		if (typeof value === "bigint" && !ctx?.keep) return Number(value);
		return value;
	}
	exports.toJS = toJS$7;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Node.js
var require_Node = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Node.js": ((exports) => {
	var applyReviver$1 = require_applyReviver();
	var identity$28 = require_identity();
	var toJS$6 = require_toJS();
	var NodeBase = class {
		constructor(type) {
			Object.defineProperty(this, identity$28.NODE_TYPE, { value: type });
		}
		/** Create a copy of this node.  */
		clone() {
			const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
			if (this.range) copy.range = this.range.slice();
			return copy;
		}
		/** A plain JavaScript representation of this node. */
		toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
			if (!identity$28.isDocument(doc)) throw new TypeError("A document argument is required");
			const ctx = {
				anchors: /* @__PURE__ */ new Map(),
				doc,
				keep: true,
				mapAsMap: mapAsMap === true,
				mapKeyWarned: false,
				maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
			};
			const res = toJS$6.toJS(this, "", ctx);
			if (typeof onAnchor === "function") for (const { count, res: res$1 } of ctx.anchors.values()) onAnchor(res$1, count);
			return typeof reviver === "function" ? applyReviver$1.applyReviver(reviver, { "": res }, "", res) : res;
		}
	};
	exports.NodeBase = NodeBase;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Alias.js
var require_Alias = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Alias.js": ((exports) => {
	var anchors$2 = require_anchors();
	var visit$2 = require_visit();
	var identity$27 = require_identity();
	var Node$2 = require_Node();
	var toJS$5 = require_toJS();
	var Alias$4 = class extends Node$2.NodeBase {
		constructor(source) {
			super(identity$27.ALIAS);
			this.source = source;
			Object.defineProperty(this, "tag", { set() {
				throw new Error("Alias nodes cannot have tags");
			} });
		}
		/**
		* Resolve the value of this alias within `doc`, finding the last
		* instance of the `source` anchor before this node.
		*/
		resolve(doc, ctx) {
			if (ctx?.maxAliasCount === 0) throw new ReferenceError("Alias resolution is disabled");
			let nodes;
			if (ctx?.aliasResolveCache) nodes = ctx.aliasResolveCache;
			else {
				nodes = [];
				visit$2.visit(doc, { Node: (_key, node) => {
					if (identity$27.isAlias(node) || identity$27.hasAnchor(node)) nodes.push(node);
				} });
				if (ctx) ctx.aliasResolveCache = nodes;
			}
			let found = void 0;
			for (const node of nodes) {
				if (node === this) break;
				if (node.anchor === this.source) found = node;
			}
			if (found && ctx) {
				const { anchors: anchors$3, doc: doc$1, maxAliasCount } = ctx;
				let data = anchors$3.get(found);
				if (!data) {
					toJS$5.toJS(found, null, ctx);
					data = anchors$3.get(found);
				}
				/* istanbul ignore if */
				if (data?.res === void 0) throw new ReferenceError("This should not happen: Alias anchor was not resolved?");
				if (maxAliasCount >= 0) {
					data.count += 1;
					if (data.aliasCount === 0) data.aliasCount = getAliasCount(doc$1, found, anchors$3);
					if (data.count * data.aliasCount > maxAliasCount) throw new ReferenceError("Excessive alias count indicates a resource exhaustion attack");
				}
			}
			return found;
		}
		toJSON(_arg, ctx) {
			if (!ctx) return { source: this.source };
			const source = this.resolve(ctx.doc, ctx);
			if (!source) {
				const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
				throw new ReferenceError(msg);
			}
			return ctx.anchors.get(source).res;
		}
		toString(ctx, _onComment, _onChompKeep) {
			const src = `*${this.source}`;
			if (ctx) {
				anchors$2.anchorIsValid(this.source);
				if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
					const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
					throw new Error(msg);
				}
				if (ctx.implicitKey) return `${src} `;
			}
			return src;
		}
	};
	function getAliasCount(doc, node, anchors$3) {
		if (identity$27.isAlias(node)) {
			const source = node.resolve(doc);
			const anchor = anchors$3 && source && anchors$3.get(source);
			return anchor ? anchor.count * anchor.aliasCount : 0;
		} else if (identity$27.isCollection(node)) {
			let count = 0;
			for (const item of node.items) {
				const c = getAliasCount(doc, item, anchors$3);
				if (c > count) count = c;
			}
			return count;
		} else if (identity$27.isPair(node)) {
			const kc = getAliasCount(doc, node.key, anchors$3);
			const vc = getAliasCount(doc, node.value, anchors$3);
			return Math.max(kc, vc);
		}
		return 1;
	}
	exports.Alias = Alias$4;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Scalar.js": ((exports) => {
	var identity$26 = require_identity();
	var Node$1 = require_Node();
	var toJS$4 = require_toJS();
	const isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
	var Scalar$19 = class extends Node$1.NodeBase {
		constructor(value) {
			super(identity$26.SCALAR);
			this.value = value;
		}
		toJSON(arg, ctx) {
			return ctx?.keep ? this.value : toJS$4.toJS(this.value, arg, ctx);
		}
		toString() {
			return String(this.value);
		}
	};
	Scalar$19.BLOCK_FOLDED = "BLOCK_FOLDED";
	Scalar$19.BLOCK_LITERAL = "BLOCK_LITERAL";
	Scalar$19.PLAIN = "PLAIN";
	Scalar$19.QUOTE_DOUBLE = "QUOTE_DOUBLE";
	Scalar$19.QUOTE_SINGLE = "QUOTE_SINGLE";
	exports.Scalar = Scalar$19;
	exports.isScalarValue = isScalarValue;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/createNode.js
var require_createNode = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/createNode.js": ((exports) => {
	var Alias$3 = require_Alias();
	var identity$25 = require_identity();
	var Scalar$18 = require_Scalar();
	const defaultTagPrefix = "tag:yaml.org,2002:";
	function findTagObject(value, tagName, tags$1) {
		if (tagName) {
			const match = tags$1.filter((t) => t.tag === tagName);
			const tagObj = match.find((t) => !t.format) ?? match[0];
			if (!tagObj) throw new Error(`Tag ${tagName} not found`);
			return tagObj;
		}
		return tags$1.find((t) => t.identify?.(value) && !t.format);
	}
	function createNode$4(value, tagName, ctx) {
		if (identity$25.isDocument(value)) value = value.contents;
		if (identity$25.isNode(value)) return value;
		if (identity$25.isPair(value)) {
			const map$6 = ctx.schema[identity$25.MAP].createNode?.(ctx.schema, null, ctx);
			map$6.items.push(value);
			return map$6;
		}
		if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) value = value.valueOf();
		const { aliasDuplicateObjects, onAnchor, onTagObj, schema: schema$6, sourceObjects } = ctx;
		let ref = void 0;
		if (aliasDuplicateObjects && value && typeof value === "object") {
			ref = sourceObjects.get(value);
			if (ref) {
				ref.anchor ?? (ref.anchor = onAnchor(value));
				return new Alias$3.Alias(ref.anchor);
			} else {
				ref = {
					anchor: null,
					node: null
				};
				sourceObjects.set(value, ref);
			}
		}
		if (tagName?.startsWith("!!")) tagName = defaultTagPrefix + tagName.slice(2);
		let tagObj = findTagObject(value, tagName, schema$6.tags);
		if (!tagObj) {
			if (value && typeof value.toJSON === "function") value = value.toJSON();
			if (!value || typeof value !== "object") {
				const node$1 = new Scalar$18.Scalar(value);
				if (ref) ref.node = node$1;
				return node$1;
			}
			tagObj = value instanceof Map ? schema$6[identity$25.MAP] : Symbol.iterator in Object(value) ? schema$6[identity$25.SEQ] : schema$6[identity$25.MAP];
		}
		if (onTagObj) {
			onTagObj(tagObj);
			delete ctx.onTagObj;
		}
		const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar$18.Scalar(value);
		if (tagName) node.tag = tagName;
		else if (!tagObj.default) node.tag = tagObj.tag;
		if (ref) ref.node = node;
		return node;
	}
	exports.createNode = createNode$4;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Collection.js
var require_Collection = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Collection.js": ((exports) => {
	var createNode$3 = require_createNode();
	var identity$24 = require_identity();
	var Node = require_Node();
	function collectionFromPath(schema$6, path, value) {
		let v = value;
		for (let i = path.length - 1; i >= 0; --i) {
			const k = path[i];
			if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
				const a = [];
				a[k] = v;
				v = a;
			} else v = new Map([[k, v]]);
		}
		return createNode$3.createNode(v, void 0, {
			aliasDuplicateObjects: false,
			keepUndefined: false,
			onAnchor: () => {
				throw new Error("This should not happen, please report a bug.");
			},
			schema: schema$6,
			sourceObjects: /* @__PURE__ */ new Map()
		});
	}
	const isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
	var Collection$3 = class extends Node.NodeBase {
		constructor(type, schema$6) {
			super(type);
			Object.defineProperty(this, "schema", {
				value: schema$6,
				configurable: true,
				enumerable: false,
				writable: true
			});
		}
		/**
		* Create a copy of this collection.
		*
		* @param schema - If defined, overwrites the original's schema
		*/
		clone(schema$6) {
			const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
			if (schema$6) copy.schema = schema$6;
			copy.items = copy.items.map((it) => identity$24.isNode(it) || identity$24.isPair(it) ? it.clone(schema$6) : it);
			if (this.range) copy.range = this.range.slice();
			return copy;
		}
		/**
		* Adds a value to the collection. For `!!map` and `!!omap` the value must
		* be a Pair instance or a `{ key, value }` object, which may not have a key
		* that already exists in the map.
		*/
		addIn(path, value) {
			if (isEmptyPath(path)) this.add(value);
			else {
				const [key, ...rest] = path;
				const node = this.get(key, true);
				if (identity$24.isCollection(node)) node.addIn(rest, value);
				else if (node === void 0 && this.schema) this.set(key, collectionFromPath(this.schema, rest, value));
				else throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
			}
		}
		/**
		* Removes a value from the collection.
		* @returns `true` if the item was found and removed.
		*/
		deleteIn(path) {
			const [key, ...rest] = path;
			if (rest.length === 0) return this.delete(key);
			const node = this.get(key, true);
			if (identity$24.isCollection(node)) return node.deleteIn(rest);
			else throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
		}
		/**
		* Returns item at `key`, or `undefined` if not found. By default unwraps
		* scalar values from their surrounding node; to disable set `keepScalar` to
		* `true` (collections are always returned intact).
		*/
		getIn(path, keepScalar) {
			const [key, ...rest] = path;
			const node = this.get(key, true);
			if (rest.length === 0) return !keepScalar && identity$24.isScalar(node) ? node.value : node;
			else return identity$24.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
		}
		hasAllNullValues(allowScalar) {
			return this.items.every((node) => {
				if (!identity$24.isPair(node)) return false;
				const n = node.value;
				return n == null || allowScalar && identity$24.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
			});
		}
		/**
		* Checks if the collection includes a value with the key `key`.
		*/
		hasIn(path) {
			const [key, ...rest] = path;
			if (rest.length === 0) return this.has(key);
			const node = this.get(key, true);
			return identity$24.isCollection(node) ? node.hasIn(rest) : false;
		}
		/**
		* Sets a value in this collection. For `!!set`, `value` needs to be a
		* boolean to add/remove the item from the set.
		*/
		setIn(path, value) {
			const [key, ...rest] = path;
			if (rest.length === 0) this.set(key, value);
			else {
				const node = this.get(key, true);
				if (identity$24.isCollection(node)) node.setIn(rest, value);
				else if (node === void 0 && this.schema) this.set(key, collectionFromPath(this.schema, rest, value));
				else throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
			}
		}
	};
	exports.Collection = Collection$3;
	exports.collectionFromPath = collectionFromPath;
	exports.isEmptyPath = isEmptyPath;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyComment.js": ((exports) => {
	/**
	* Stringifies a comment.
	*
	* Empty comment lines are left empty,
	* lines consisting of a single space are replaced by `#`,
	* and all other lines are prefixed with a `#`.
	*/
	const stringifyComment$4 = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
	function indentComment(comment, indent) {
		if (/^\n+$/.test(comment)) return comment.substring(1);
		return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
	}
	const lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
	exports.indentComment = indentComment;
	exports.lineComment = lineComment;
	exports.stringifyComment = stringifyComment$4;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/foldFlowLines.js": ((exports) => {
	const FOLD_FLOW = "flow";
	const FOLD_BLOCK = "block";
	const FOLD_QUOTED = "quoted";
	/**
	* Tries to keep input at up to `lineWidth` characters, splitting only on spaces
	* not followed by newlines or spaces unless `mode` is `'quoted'`. Lines are
	* terminated with `\n` and started with `indent`.
	*/
	function foldFlowLines$1(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
		if (!lineWidth || lineWidth < 0) return text;
		if (lineWidth < minContentWidth) minContentWidth = 0;
		const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
		if (text.length <= endStep) return text;
		const folds = [];
		const escapedFolds = {};
		let end = lineWidth - indent.length;
		if (typeof indentAtStart === "number") if (indentAtStart > lineWidth - Math.max(2, minContentWidth)) folds.push(0);
		else end = lineWidth - indentAtStart;
		let split = void 0;
		let prev = void 0;
		let overflow = false;
		let i = -1;
		let escStart = -1;
		let escEnd = -1;
		if (mode === FOLD_BLOCK) {
			i = consumeMoreIndentedLines(text, i, indent.length);
			if (i !== -1) end = i + endStep;
		}
		for (let ch; ch = text[i += 1];) {
			if (mode === FOLD_QUOTED && ch === "\\") {
				escStart = i;
				switch (text[i + 1]) {
					case "x":
						i += 3;
						break;
					case "u":
						i += 5;
						break;
					case "U":
						i += 9;
						break;
					default: i += 1;
				}
				escEnd = i;
			}
			if (ch === "\n") {
				if (mode === FOLD_BLOCK) i = consumeMoreIndentedLines(text, i, indent.length);
				end = i + indent.length + endStep;
				split = void 0;
			} else {
				if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
					const next = text[i + 1];
					if (next && next !== " " && next !== "\n" && next !== "	") split = i;
				}
				if (i >= end) if (split) {
					folds.push(split);
					end = split + endStep;
					split = void 0;
				} else if (mode === FOLD_QUOTED) {
					while (prev === " " || prev === "	") {
						prev = ch;
						ch = text[i += 1];
						overflow = true;
					}
					const j = i > escEnd + 1 ? i - 2 : escStart - 1;
					if (escapedFolds[j]) return text;
					folds.push(j);
					escapedFolds[j] = true;
					end = j + endStep;
					split = void 0;
				} else overflow = true;
			}
			prev = ch;
		}
		if (overflow && onOverflow) onOverflow();
		if (folds.length === 0) return text;
		if (onFold) onFold();
		let res = text.slice(0, folds[0]);
		for (let i$1 = 0; i$1 < folds.length; ++i$1) {
			const fold = folds[i$1];
			const end$1 = folds[i$1 + 1] || text.length;
			if (fold === 0) res = `\n${indent}${text.slice(0, end$1)}`;
			else {
				if (mode === FOLD_QUOTED && escapedFolds[fold]) res += `${text[fold]}\\`;
				res += `\n${indent}${text.slice(fold + 1, end$1)}`;
			}
		}
		return res;
	}
	/**
	* Presumes `i + 1` is at the start of a line
	* @returns index of last newline in more-indented block
	*/
	function consumeMoreIndentedLines(text, i, indent) {
		let end = i;
		let start = i + 1;
		let ch = text[start];
		while (ch === " " || ch === "	") if (i < start + indent) ch = text[++i];
		else {
			do
				ch = text[++i];
			while (ch && ch !== "\n");
			end = i;
			start = i + 1;
			ch = text[start];
		}
		return end;
	}
	exports.FOLD_BLOCK = FOLD_BLOCK;
	exports.FOLD_FLOW = FOLD_FLOW;
	exports.FOLD_QUOTED = FOLD_QUOTED;
	exports.foldFlowLines = foldFlowLines$1;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyString.js": ((exports) => {
	var Scalar$17 = require_Scalar();
	var foldFlowLines = require_foldFlowLines();
	const getFoldOptions = (ctx, isBlock$1) => ({
		indentAtStart: isBlock$1 ? ctx.indent.length : ctx.indentAtStart,
		lineWidth: ctx.options.lineWidth,
		minContentWidth: ctx.options.minContentWidth
	});
	const containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
	function lineLengthOverLimit(str, lineWidth, indentLength) {
		if (!lineWidth || lineWidth < 0) return false;
		const limit = lineWidth - indentLength;
		const strLen = str.length;
		if (strLen <= limit) return false;
		for (let i = 0, start = 0; i < strLen; ++i) if (str[i] === "\n") {
			if (i - start > limit) return true;
			start = i + 1;
			if (strLen - start <= limit) return false;
		}
		return true;
	}
	function doubleQuotedString(value, ctx) {
		const json$1 = JSON.stringify(value);
		if (ctx.options.doubleQuotedAsJSON) return json$1;
		const { implicitKey } = ctx;
		const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
		const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
		let str = "";
		let start = 0;
		for (let i = 0, ch = json$1[i]; ch; ch = json$1[++i]) {
			if (ch === " " && json$1[i + 1] === "\\" && json$1[i + 2] === "n") {
				str += json$1.slice(start, i) + "\\ ";
				i += 1;
				start = i;
				ch = "\\";
			}
			if (ch === "\\") switch (json$1[i + 1]) {
				case "u":
					{
						str += json$1.slice(start, i);
						const code = json$1.substr(i + 2, 4);
						switch (code) {
							case "0000":
								str += "\\0";
								break;
							case "0007":
								str += "\\a";
								break;
							case "000b":
								str += "\\v";
								break;
							case "001b":
								str += "\\e";
								break;
							case "0085":
								str += "\\N";
								break;
							case "00a0":
								str += "\\_";
								break;
							case "2028":
								str += "\\L";
								break;
							case "2029":
								str += "\\P";
								break;
							default: if (code.substr(0, 2) === "00") str += "\\x" + code.substr(2);
							else str += json$1.substr(i, 6);
						}
						i += 5;
						start = i + 1;
					}
					break;
				case "n":
					if (implicitKey || json$1[i + 2] === "\"" || json$1.length < minMultiLineLength) i += 1;
					else {
						str += json$1.slice(start, i) + "\n\n";
						while (json$1[i + 2] === "\\" && json$1[i + 3] === "n" && json$1[i + 4] !== "\"") {
							str += "\n";
							i += 2;
						}
						str += indent;
						if (json$1[i + 2] === " ") str += "\\";
						i += 1;
						start = i + 1;
					}
					break;
				default: i += 1;
			}
		}
		str = start ? str + json$1.slice(start) : json$1;
		return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
	}
	function singleQuotedString(value, ctx) {
		if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value)) return doubleQuotedString(value, ctx);
		const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
		const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&\n${indent}`) + "'";
		return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
	}
	function quotedString(value, ctx) {
		const { singleQuote } = ctx.options;
		let qs;
		if (singleQuote === false) qs = doubleQuotedString;
		else {
			const hasDouble = value.includes("\"");
			const hasSingle = value.includes("'");
			if (hasDouble && !hasSingle) qs = singleQuotedString;
			else if (hasSingle && !hasDouble) qs = doubleQuotedString;
			else qs = singleQuote ? singleQuotedString : doubleQuotedString;
		}
		return qs(value, ctx);
	}
	let blockEndNewlines;
	try {
		blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
	} catch {
		blockEndNewlines = /\n+(?!\n|$)/g;
	}
	function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
		const { blockQuote, commentString, lineWidth } = ctx.options;
		if (!blockQuote || /\n[\t ]+$/.test(value)) return quotedString(value, ctx);
		const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
		const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar$17.Scalar.BLOCK_FOLDED ? false : type === Scalar$17.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
		if (!value) return literal ? "|\n" : ">\n";
		let chomp;
		let endStart;
		for (endStart = value.length; endStart > 0; --endStart) {
			const ch = value[endStart - 1];
			if (ch !== "\n" && ch !== "	" && ch !== " ") break;
		}
		let end = value.substring(endStart);
		const endNlPos = end.indexOf("\n");
		if (endNlPos === -1) chomp = "-";
		else if (value === end || endNlPos !== end.length - 1) {
			chomp = "+";
			if (onChompKeep) onChompKeep();
		} else chomp = "";
		if (end) {
			value = value.slice(0, -end.length);
			if (end[end.length - 1] === "\n") end = end.slice(0, -1);
			end = end.replace(blockEndNewlines, `$&${indent}`);
		}
		let startWithSpace = false;
		let startEnd;
		let startNlPos = -1;
		for (startEnd = 0; startEnd < value.length; ++startEnd) {
			const ch = value[startEnd];
			if (ch === " ") startWithSpace = true;
			else if (ch === "\n") startNlPos = startEnd;
			else break;
		}
		let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
		if (start) {
			value = value.substring(start.length);
			start = start.replace(/\n+/g, `$&${indent}`);
		}
		let header = (startWithSpace ? indent ? "2" : "1" : "") + chomp;
		if (comment) {
			header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
			if (onComment) onComment();
		}
		if (!literal) {
			const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
			let literalFallback = false;
			const foldOptions = getFoldOptions(ctx, true);
			if (blockQuote !== "folded" && type !== Scalar$17.Scalar.BLOCK_FOLDED) foldOptions.onOverflow = () => {
				literalFallback = true;
			};
			const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
			if (!literalFallback) return `>${header}\n${indent}${body}`;
		}
		value = value.replace(/\n+/g, `$&${indent}`);
		return `|${header}\n${indent}${start}${value}${end}`;
	}
	function plainString(item, ctx, onComment, onChompKeep) {
		const { type, value } = item;
		const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
		if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) return quotedString(value, ctx);
		if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
		if (!implicitKey && !inFlow && type !== Scalar$17.Scalar.PLAIN && value.includes("\n")) return blockString(item, ctx, onComment, onChompKeep);
		if (containsDocumentMarker(value)) {
			if (indent === "") {
				ctx.forceBlockIndent = true;
				return blockString(item, ctx, onComment, onChompKeep);
			} else if (implicitKey && indent === indentStep) return quotedString(value, ctx);
		}
		const str = value.replace(/\n+/g, `$&\n${indent}`);
		if (actualString) {
			const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
			const { compat, tags: tags$1 } = ctx.doc.schema;
			if (tags$1.some(test) || compat?.some(test)) return quotedString(value, ctx);
		}
		return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
	}
	function stringifyString$4(item, ctx, onComment, onChompKeep) {
		const { implicitKey, inFlow } = ctx;
		const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
		let { type } = item;
		if (type !== Scalar$17.Scalar.QUOTE_DOUBLE) {
			if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value)) type = Scalar$17.Scalar.QUOTE_DOUBLE;
		}
		const _stringify = (_type) => {
			switch (_type) {
				case Scalar$17.Scalar.BLOCK_FOLDED:
				case Scalar$17.Scalar.BLOCK_LITERAL: return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
				case Scalar$17.Scalar.QUOTE_DOUBLE: return doubleQuotedString(ss.value, ctx);
				case Scalar$17.Scalar.QUOTE_SINGLE: return singleQuotedString(ss.value, ctx);
				case Scalar$17.Scalar.PLAIN: return plainString(ss, ctx, onComment, onChompKeep);
				default: return null;
			}
		};
		let res = _stringify(type);
		if (res === null) {
			const { defaultKeyType, defaultStringType } = ctx.options;
			const t = implicitKey && defaultKeyType || defaultStringType;
			res = _stringify(t);
			if (res === null) throw new Error(`Unsupported default string type ${t}`);
		}
		return res;
	}
	exports.stringifyString = stringifyString$4;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringify.js
var require_stringify = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringify.js": ((exports) => {
	var anchors$1 = require_anchors();
	var identity$23 = require_identity();
	var stringifyComment$3 = require_stringifyComment();
	var stringifyString$3 = require_stringifyString();
	function createStringifyContext(doc, options) {
		const opt = Object.assign({
			blockQuote: true,
			commentString: stringifyComment$3.stringifyComment,
			defaultKeyType: null,
			defaultStringType: "PLAIN",
			directives: null,
			doubleQuotedAsJSON: false,
			doubleQuotedMinMultiLineLength: 40,
			falseStr: "false",
			flowCollectionPadding: true,
			indentSeq: true,
			lineWidth: 80,
			minContentWidth: 20,
			nullStr: "null",
			simpleKeys: false,
			singleQuote: null,
			trailingComma: false,
			trueStr: "true",
			verifyAliasOrder: true
		}, doc.schema.toStringOptions, options);
		let inFlow;
		switch (opt.collectionStyle) {
			case "block":
				inFlow = false;
				break;
			case "flow":
				inFlow = true;
				break;
			default: inFlow = null;
		}
		return {
			anchors: /* @__PURE__ */ new Set(),
			doc,
			flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
			indent: "",
			indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
			inFlow,
			options: opt
		};
	}
	function getTagObject(tags$1, item) {
		if (item.tag) {
			const match = tags$1.filter((t) => t.tag === item.tag);
			if (match.length > 0) return match.find((t) => t.format === item.format) ?? match[0];
		}
		let tagObj = void 0;
		let obj;
		if (identity$23.isScalar(item)) {
			obj = item.value;
			let match = tags$1.filter((t) => t.identify?.(obj));
			if (match.length > 1) {
				const testMatch = match.filter((t) => t.test);
				if (testMatch.length > 0) match = testMatch;
			}
			tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
		} else {
			obj = item;
			tagObj = tags$1.find((t) => t.nodeClass && obj instanceof t.nodeClass);
		}
		if (!tagObj) {
			const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
			throw new Error(`Tag not resolved for ${name} value`);
		}
		return tagObj;
	}
	function stringifyProps(node, tagObj, { anchors: anchors$1$1, doc }) {
		if (!doc.directives) return "";
		const props = [];
		const anchor = (identity$23.isScalar(node) || identity$23.isCollection(node)) && node.anchor;
		if (anchor && anchors$1.anchorIsValid(anchor)) {
			anchors$1$1.add(anchor);
			props.push(`&${anchor}`);
		}
		const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
		if (tag) props.push(doc.directives.tagString(tag));
		return props.join(" ");
	}
	function stringify$6(item, ctx, onComment, onChompKeep) {
		if (identity$23.isPair(item)) return item.toString(ctx, onComment, onChompKeep);
		if (identity$23.isAlias(item)) {
			if (ctx.doc.directives) return item.toString(ctx);
			if (ctx.resolvedAliases?.has(item)) throw new TypeError(`Cannot stringify circular structure without alias nodes`);
			else {
				if (ctx.resolvedAliases) ctx.resolvedAliases.add(item);
				else ctx.resolvedAliases = new Set([item]);
				item = item.resolve(ctx.doc);
			}
		}
		let tagObj = void 0;
		const node = identity$23.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
		tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
		const props = stringifyProps(node, tagObj, ctx);
		if (props.length > 0) ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
		const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity$23.isScalar(node) ? stringifyString$3.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
		if (!props) return str;
		return identity$23.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}\n${ctx.indent}${str}`;
	}
	exports.createStringifyContext = createStringifyContext;
	exports.stringify = stringify$6;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyPair.js": ((exports) => {
	var identity$22 = require_identity();
	var Scalar$16 = require_Scalar();
	var stringify$5 = require_stringify();
	var stringifyComment$2 = require_stringifyComment();
	function stringifyPair$1({ key, value }, ctx, onComment, onChompKeep) {
		const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
		let keyComment = identity$22.isNode(key) && key.comment || null;
		if (simpleKeys) {
			if (keyComment) throw new Error("With simple keys, key nodes cannot have comments");
			if (identity$22.isCollection(key) || !identity$22.isNode(key) && typeof key === "object") throw new Error("With simple keys, collection cannot be used as a key value");
		}
		let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity$22.isCollection(key) || (identity$22.isScalar(key) ? key.type === Scalar$16.Scalar.BLOCK_FOLDED || key.type === Scalar$16.Scalar.BLOCK_LITERAL : typeof key === "object"));
		ctx = Object.assign({}, ctx, {
			allNullValues: false,
			implicitKey: !explicitKey && (simpleKeys || !allNullValues),
			indent: indent + indentStep
		});
		let keyCommentDone = false;
		let chompKeep = false;
		let str = stringify$5.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
		if (!explicitKey && !ctx.inFlow && str.length > 1024) {
			if (simpleKeys) throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
			explicitKey = true;
		}
		if (ctx.inFlow) {
			if (allNullValues || value == null) {
				if (keyCommentDone && onComment) onComment();
				return str === "" ? "?" : explicitKey ? `? ${str}` : str;
			}
		} else if (allNullValues && !simpleKeys || value == null && explicitKey) {
			str = `? ${str}`;
			if (keyComment && !keyCommentDone) str += stringifyComment$2.lineComment(str, ctx.indent, commentString(keyComment));
			else if (chompKeep && onChompKeep) onChompKeep();
			return str;
		}
		if (keyCommentDone) keyComment = null;
		if (explicitKey) {
			if (keyComment) str += stringifyComment$2.lineComment(str, ctx.indent, commentString(keyComment));
			str = `? ${str}\n${indent}:`;
		} else {
			str = `${str}:`;
			if (keyComment) str += stringifyComment$2.lineComment(str, ctx.indent, commentString(keyComment));
		}
		let vsb, vcb, valueComment;
		if (identity$22.isNode(value)) {
			vsb = !!value.spaceBefore;
			vcb = value.commentBefore;
			valueComment = value.comment;
		} else {
			vsb = false;
			vcb = null;
			valueComment = null;
			if (value && typeof value === "object") value = doc.createNode(value);
		}
		ctx.implicitKey = false;
		if (!explicitKey && !keyComment && identity$22.isScalar(value)) ctx.indentAtStart = str.length + 1;
		chompKeep = false;
		if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity$22.isSeq(value) && !value.flow && !value.tag && !value.anchor) ctx.indent = ctx.indent.substring(2);
		let valueCommentDone = false;
		const valueStr = stringify$5.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
		let ws = " ";
		if (keyComment || vsb || vcb) {
			ws = vsb ? "\n" : "";
			if (vcb) {
				const cs = commentString(vcb);
				ws += `\n${stringifyComment$2.indentComment(cs, ctx.indent)}`;
			}
			if (valueStr === "" && !ctx.inFlow) {
				if (ws === "\n" && valueComment) ws = "\n\n";
			} else ws += `\n${ctx.indent}`;
		} else if (!explicitKey && identity$22.isCollection(value)) {
			const vs0 = valueStr[0];
			const nl0 = valueStr.indexOf("\n");
			const hasNewline = nl0 !== -1;
			const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
			if (hasNewline || !flow) {
				let hasPropsLine = false;
				if (hasNewline && (vs0 === "&" || vs0 === "!")) {
					let sp0 = valueStr.indexOf(" ");
					if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") sp0 = valueStr.indexOf(" ", sp0 + 1);
					if (sp0 === -1 || nl0 < sp0) hasPropsLine = true;
				}
				if (!hasPropsLine) ws = `\n${ctx.indent}`;
			}
		} else if (valueStr === "" || valueStr[0] === "\n") ws = "";
		str += ws + valueStr;
		if (ctx.inFlow) {
			if (valueCommentDone && onComment) onComment();
		} else if (valueComment && !valueCommentDone) str += stringifyComment$2.lineComment(str, ctx.indent, commentString(valueComment));
		else if (chompKeep && onChompKeep) onChompKeep();
		return str;
	}
	exports.stringifyPair = stringifyPair$1;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/log.js
var require_log = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/log.js": ((exports) => {
	var node_process$2 = __require("process");
	function debug(logLevel, ...messages) {
		if (logLevel === "debug") console.log(...messages);
	}
	function warn(logLevel, warning) {
		if (logLevel === "debug" || logLevel === "warn") if (typeof node_process$2.emitWarning === "function") node_process$2.emitWarning(warning);
		else console.warn(warning);
	}
	exports.debug = debug;
	exports.warn = warn;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/merge.js": ((exports) => {
	var identity$21 = require_identity();
	var Scalar$15 = require_Scalar();
	const MERGE_KEY = "<<";
	const merge$3 = {
		identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
		default: "key",
		tag: "tag:yaml.org,2002:merge",
		test: /^<<$/,
		resolve: () => Object.assign(new Scalar$15.Scalar(Symbol(MERGE_KEY)), { addToJSMap: addMergeToJSMap }),
		stringify: () => MERGE_KEY
	};
	const isMergeKey = (ctx, key) => (merge$3.identify(key) || identity$21.isScalar(key) && (!key.type || key.type === Scalar$15.Scalar.PLAIN) && merge$3.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge$3.tag && tag.default);
	function addMergeToJSMap(ctx, map$6, value) {
		const source = resolveAliasValue(ctx, value);
		if (identity$21.isSeq(source)) for (const it of source.items) mergeValue(ctx, map$6, it);
		else if (Array.isArray(source)) for (const it of source) mergeValue(ctx, map$6, it);
		else mergeValue(ctx, map$6, source);
	}
	function mergeValue(ctx, map$6, value) {
		const source = resolveAliasValue(ctx, value);
		if (!identity$21.isMap(source)) throw new Error("Merge sources must be maps or map aliases");
		const srcMap = source.toJSON(null, ctx, Map);
		for (const [key, value$1] of srcMap) if (map$6 instanceof Map) {
			if (!map$6.has(key)) map$6.set(key, value$1);
		} else if (map$6 instanceof Set) map$6.add(key);
		else if (!Object.prototype.hasOwnProperty.call(map$6, key)) Object.defineProperty(map$6, key, {
			value: value$1,
			writable: true,
			enumerable: true,
			configurable: true
		});
		return map$6;
	}
	function resolveAliasValue(ctx, value) {
		return ctx && identity$21.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
	}
	exports.addMergeToJSMap = addMergeToJSMap;
	exports.isMergeKey = isMergeKey;
	exports.merge = merge$3;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/addPairToJSMap.js": ((exports) => {
	var log$1 = require_log();
	var merge$2 = require_merge();
	var stringify$4 = require_stringify();
	var identity$20 = require_identity();
	var toJS$3 = require_toJS();
	function addPairToJSMap$2(ctx, map$6, { key, value }) {
		if (identity$20.isNode(key) && key.addToJSMap) key.addToJSMap(ctx, map$6, value);
		else if (merge$2.isMergeKey(ctx, key)) merge$2.addMergeToJSMap(ctx, map$6, value);
		else {
			const jsKey = toJS$3.toJS(key, "", ctx);
			if (map$6 instanceof Map) map$6.set(jsKey, toJS$3.toJS(value, jsKey, ctx));
			else if (map$6 instanceof Set) map$6.add(jsKey);
			else {
				const stringKey = stringifyKey(key, jsKey, ctx);
				const jsValue = toJS$3.toJS(value, stringKey, ctx);
				if (stringKey in map$6) Object.defineProperty(map$6, stringKey, {
					value: jsValue,
					writable: true,
					enumerable: true,
					configurable: true
				});
				else map$6[stringKey] = jsValue;
			}
		}
		return map$6;
	}
	function stringifyKey(key, jsKey, ctx) {
		if (jsKey === null) return "";
		if (typeof jsKey !== "object") return String(jsKey);
		if (identity$20.isNode(key) && ctx?.doc) {
			const strCtx = stringify$4.createStringifyContext(ctx.doc, {});
			strCtx.anchors = /* @__PURE__ */ new Set();
			for (const node of ctx.anchors.keys()) strCtx.anchors.add(node.anchor);
			strCtx.inFlow = true;
			strCtx.inStringifyKey = true;
			const strKey = key.toString(strCtx);
			if (!ctx.mapKeyWarned) {
				let jsonStr = JSON.stringify(strKey);
				if (jsonStr.length > 40) jsonStr = jsonStr.substring(0, 36) + "...\"";
				log$1.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
				ctx.mapKeyWarned = true;
			}
			return strKey;
		}
		return JSON.stringify(jsKey);
	}
	exports.addPairToJSMap = addPairToJSMap$2;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Pair.js
var require_Pair = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/Pair.js": ((exports) => {
	var createNode$2 = require_createNode();
	var stringifyPair = require_stringifyPair();
	var addPairToJSMap$1 = require_addPairToJSMap();
	var identity$19 = require_identity();
	function createPair(key, value, ctx) {
		return new Pair$7(createNode$2.createNode(key, void 0, ctx), createNode$2.createNode(value, void 0, ctx));
	}
	var Pair$7 = class Pair$7 {
		constructor(key, value = null) {
			Object.defineProperty(this, identity$19.NODE_TYPE, { value: identity$19.PAIR });
			this.key = key;
			this.value = value;
		}
		clone(schema$6) {
			let { key, value } = this;
			if (identity$19.isNode(key)) key = key.clone(schema$6);
			if (identity$19.isNode(value)) value = value.clone(schema$6);
			return new Pair$7(key, value);
		}
		toJSON(_, ctx) {
			const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
			return addPairToJSMap$1.addPairToJSMap(ctx, pair, this);
		}
		toString(ctx, onComment, onChompKeep) {
			return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
		}
	};
	exports.Pair = Pair$7;
	exports.createPair = createPair;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyCollection.js": ((exports) => {
	var identity$18 = require_identity();
	var stringify$3 = require_stringify();
	var stringifyComment$1 = require_stringifyComment();
	function stringifyCollection$2(collection, ctx, options) {
		return (ctx.inFlow ?? collection.flow ? stringifyFlowCollection : stringifyBlockCollection)(collection, ctx, options);
	}
	function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
		const { indent, options: { commentString } } = ctx;
		const itemCtx = Object.assign({}, ctx, {
			indent: itemIndent,
			type: null
		});
		let chompKeep = false;
		const lines = [];
		for (let i = 0; i < items.length; ++i) {
			const item = items[i];
			let comment$1 = null;
			if (identity$18.isNode(item)) {
				if (!chompKeep && item.spaceBefore) lines.push("");
				addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
				if (item.comment) comment$1 = item.comment;
			} else if (identity$18.isPair(item)) {
				const ik = identity$18.isNode(item.key) ? item.key : null;
				if (ik) {
					if (!chompKeep && ik.spaceBefore) lines.push("");
					addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
				}
			}
			chompKeep = false;
			let str$1 = stringify$3.stringify(item, itemCtx, () => comment$1 = null, () => chompKeep = true);
			if (comment$1) str$1 += stringifyComment$1.lineComment(str$1, itemIndent, commentString(comment$1));
			if (chompKeep && comment$1) chompKeep = false;
			lines.push(blockItemPrefix + str$1);
		}
		let str;
		if (lines.length === 0) str = flowChars.start + flowChars.end;
		else {
			str = lines[0];
			for (let i = 1; i < lines.length; ++i) {
				const line = lines[i];
				str += line ? `\n${indent}${line}` : "\n";
			}
		}
		if (comment) {
			str += "\n" + stringifyComment$1.indentComment(commentString(comment), indent);
			if (onComment) onComment();
		} else if (chompKeep && onChompKeep) onChompKeep();
		return str;
	}
	function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
		const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
		itemIndent += indentStep;
		const itemCtx = Object.assign({}, ctx, {
			indent: itemIndent,
			inFlow: true,
			type: null
		});
		let reqNewline = false;
		let linesAtValue = 0;
		const lines = [];
		for (let i = 0; i < items.length; ++i) {
			const item = items[i];
			let comment = null;
			if (identity$18.isNode(item)) {
				if (item.spaceBefore) lines.push("");
				addCommentBefore(ctx, lines, item.commentBefore, false);
				if (item.comment) comment = item.comment;
			} else if (identity$18.isPair(item)) {
				const ik = identity$18.isNode(item.key) ? item.key : null;
				if (ik) {
					if (ik.spaceBefore) lines.push("");
					addCommentBefore(ctx, lines, ik.commentBefore, false);
					if (ik.comment) reqNewline = true;
				}
				const iv = identity$18.isNode(item.value) ? item.value : null;
				if (iv) {
					if (iv.comment) comment = iv.comment;
					if (iv.commentBefore) reqNewline = true;
				} else if (item.value == null && ik?.comment) comment = ik.comment;
			}
			if (comment) reqNewline = true;
			let str = stringify$3.stringify(item, itemCtx, () => comment = null);
			reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
			if (i < items.length - 1) str += ",";
			else if (ctx.options.trailingComma) {
				if (ctx.options.lineWidth > 0) reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
				if (reqNewline) str += ",";
			}
			if (comment) str += stringifyComment$1.lineComment(str, itemIndent, commentString(comment));
			lines.push(str);
			linesAtValue = lines.length;
		}
		const { start, end } = flowChars;
		if (lines.length === 0) return start + end;
		else {
			if (!reqNewline) {
				const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
				reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
			}
			if (reqNewline) {
				let str = start;
				for (const line of lines) str += line ? `\n${indentStep}${indent}${line}` : "\n";
				return `${str}\n${indent}${end}`;
			} else return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
		}
	}
	function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
		if (comment && chompKeep) comment = comment.replace(/^\n+/, "");
		if (comment) {
			const ic = stringifyComment$1.indentComment(commentString(comment), indent);
			lines.push(ic.trimStart());
		}
	}
	exports.stringifyCollection = stringifyCollection$2;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/YAMLMap.js": ((exports) => {
	var stringifyCollection$1 = require_stringifyCollection();
	var addPairToJSMap = require_addPairToJSMap();
	var Collection$2 = require_Collection();
	var identity$17 = require_identity();
	var Pair$6 = require_Pair();
	var Scalar$14 = require_Scalar();
	function findPair(items, key) {
		const k = identity$17.isScalar(key) ? key.value : key;
		for (const it of items) if (identity$17.isPair(it)) {
			if (it.key === key || it.key === k) return it;
			if (identity$17.isScalar(it.key) && it.key.value === k) return it;
		}
	}
	var YAMLMap$7 = class extends Collection$2.Collection {
		static get tagName() {
			return "tag:yaml.org,2002:map";
		}
		constructor(schema$6) {
			super(identity$17.MAP, schema$6);
			this.items = [];
		}
		/**
		* A generic collection parsing method that can be extended
		* to other node classes that inherit from YAMLMap
		*/
		static from(schema$6, obj, ctx) {
			const { keepUndefined, replacer } = ctx;
			const map$6 = new this(schema$6);
			const add = (key, value) => {
				if (typeof replacer === "function") value = replacer.call(obj, key, value);
				else if (Array.isArray(replacer) && !replacer.includes(key)) return;
				if (value !== void 0 || keepUndefined) map$6.items.push(Pair$6.createPair(key, value, ctx));
			};
			if (obj instanceof Map) for (const [key, value] of obj) add(key, value);
			else if (obj && typeof obj === "object") for (const key of Object.keys(obj)) add(key, obj[key]);
			if (typeof schema$6.sortMapEntries === "function") map$6.items.sort(schema$6.sortMapEntries);
			return map$6;
		}
		/**
		* Adds a value to the collection.
		*
		* @param overwrite - If not set `true`, using a key that is already in the
		*   collection will throw. Otherwise, overwrites the previous value.
		*/
		add(pair, overwrite) {
			let _pair;
			if (identity$17.isPair(pair)) _pair = pair;
			else if (!pair || typeof pair !== "object" || !("key" in pair)) _pair = new Pair$6.Pair(pair, pair?.value);
			else _pair = new Pair$6.Pair(pair.key, pair.value);
			const prev = findPair(this.items, _pair.key);
			const sortEntries = this.schema?.sortMapEntries;
			if (prev) {
				if (!overwrite) throw new Error(`Key ${_pair.key} already set`);
				if (identity$17.isScalar(prev.value) && Scalar$14.isScalarValue(_pair.value)) prev.value.value = _pair.value;
				else prev.value = _pair.value;
			} else if (sortEntries) {
				const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
				if (i === -1) this.items.push(_pair);
				else this.items.splice(i, 0, _pair);
			} else this.items.push(_pair);
		}
		delete(key) {
			const it = findPair(this.items, key);
			if (!it) return false;
			return this.items.splice(this.items.indexOf(it), 1).length > 0;
		}
		get(key, keepScalar) {
			const node = findPair(this.items, key)?.value;
			return (!keepScalar && identity$17.isScalar(node) ? node.value : node) ?? void 0;
		}
		has(key) {
			return !!findPair(this.items, key);
		}
		set(key, value) {
			this.add(new Pair$6.Pair(key, value), true);
		}
		/**
		* @param ctx - Conversion context, originally set in Document#toJS()
		* @param {Class} Type - If set, forces the returned collection type
		* @returns Instance of Type, Map, or Object
		*/
		toJSON(_, ctx, Type) {
			const map$6 = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
			if (ctx?.onCreate) ctx.onCreate(map$6);
			for (const item of this.items) addPairToJSMap.addPairToJSMap(ctx, map$6, item);
			return map$6;
		}
		toString(ctx, onComment, onChompKeep) {
			if (!ctx) return JSON.stringify(this);
			for (const item of this.items) if (!identity$17.isPair(item)) throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
			if (!ctx.allNullValues && this.hasAllNullValues(false)) ctx = Object.assign({}, ctx, { allNullValues: true });
			return stringifyCollection$1.stringifyCollection(this, ctx, {
				blockItemPrefix: "",
				flowChars: {
					start: "{",
					end: "}"
				},
				itemIndent: ctx.indent || "",
				onChompKeep,
				onComment
			});
		}
	};
	exports.YAMLMap = YAMLMap$7;
	exports.findPair = findPair;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/map.js
var require_map = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/map.js": ((exports) => {
	var identity$16 = require_identity();
	var YAMLMap$6 = require_YAMLMap();
	const map$5 = {
		collection: "map",
		default: true,
		nodeClass: YAMLMap$6.YAMLMap,
		tag: "tag:yaml.org,2002:map",
		resolve(map$6, onError) {
			if (!identity$16.isMap(map$6)) onError("Expected a mapping for this tag");
			return map$6;
		},
		createNode: (schema$6, obj, ctx) => YAMLMap$6.YAMLMap.from(schema$6, obj, ctx)
	};
	exports.map = map$5;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/nodes/YAMLSeq.js": ((exports) => {
	var createNode$1 = require_createNode();
	var stringifyCollection = require_stringifyCollection();
	var Collection$1 = require_Collection();
	var identity$15 = require_identity();
	var Scalar$13 = require_Scalar();
	var toJS$2 = require_toJS();
	var YAMLSeq$7 = class extends Collection$1.Collection {
		static get tagName() {
			return "tag:yaml.org,2002:seq";
		}
		constructor(schema$6) {
			super(identity$15.SEQ, schema$6);
			this.items = [];
		}
		add(value) {
			this.items.push(value);
		}
		/**
		* Removes a value from the collection.
		*
		* `key` must contain a representation of an integer for this to succeed.
		* It may be wrapped in a `Scalar`.
		*
		* @returns `true` if the item was found and removed.
		*/
		delete(key) {
			const idx = asItemIndex(key);
			if (typeof idx !== "number") return false;
			return this.items.splice(idx, 1).length > 0;
		}
		get(key, keepScalar) {
			const idx = asItemIndex(key);
			if (typeof idx !== "number") return void 0;
			const it = this.items[idx];
			return !keepScalar && identity$15.isScalar(it) ? it.value : it;
		}
		/**
		* Checks if the collection includes a value with the key `key`.
		*
		* `key` must contain a representation of an integer for this to succeed.
		* It may be wrapped in a `Scalar`.
		*/
		has(key) {
			const idx = asItemIndex(key);
			return typeof idx === "number" && idx < this.items.length;
		}
		/**
		* Sets a value in this collection. For `!!set`, `value` needs to be a
		* boolean to add/remove the item from the set.
		*
		* If `key` does not contain a representation of an integer, this will throw.
		* It may be wrapped in a `Scalar`.
		*/
		set(key, value) {
			const idx = asItemIndex(key);
			if (typeof idx !== "number") throw new Error(`Expected a valid index, not ${key}.`);
			const prev = this.items[idx];
			if (identity$15.isScalar(prev) && Scalar$13.isScalarValue(value)) prev.value = value;
			else this.items[idx] = value;
		}
		toJSON(_, ctx) {
			const seq$6 = [];
			if (ctx?.onCreate) ctx.onCreate(seq$6);
			let i = 0;
			for (const item of this.items) seq$6.push(toJS$2.toJS(item, String(i++), ctx));
			return seq$6;
		}
		toString(ctx, onComment, onChompKeep) {
			if (!ctx) return JSON.stringify(this);
			return stringifyCollection.stringifyCollection(this, ctx, {
				blockItemPrefix: "- ",
				flowChars: {
					start: "[",
					end: "]"
				},
				itemIndent: (ctx.indent || "") + "  ",
				onChompKeep,
				onComment
			});
		}
		static from(schema$6, obj, ctx) {
			const { replacer } = ctx;
			const seq$6 = new this(schema$6);
			if (obj && Symbol.iterator in Object(obj)) {
				let i = 0;
				for (let it of obj) {
					if (typeof replacer === "function") {
						const key = obj instanceof Set ? it : String(i++);
						it = replacer.call(obj, key, it);
					}
					seq$6.items.push(createNode$1.createNode(it, void 0, ctx));
				}
			}
			return seq$6;
		}
	};
	function asItemIndex(key) {
		let idx = identity$15.isScalar(key) ? key.value : key;
		if (idx && typeof idx === "string") idx = Number(idx);
		return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
	}
	exports.YAMLSeq = YAMLSeq$7;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/seq.js
var require_seq = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/seq.js": ((exports) => {
	var identity$14 = require_identity();
	var YAMLSeq$6 = require_YAMLSeq();
	const seq$5 = {
		collection: "seq",
		default: true,
		nodeClass: YAMLSeq$6.YAMLSeq,
		tag: "tag:yaml.org,2002:seq",
		resolve(seq$6, onError) {
			if (!identity$14.isSeq(seq$6)) onError("Expected a sequence for this tag");
			return seq$6;
		},
		createNode: (schema$6, obj, ctx) => YAMLSeq$6.YAMLSeq.from(schema$6, obj, ctx)
	};
	exports.seq = seq$5;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/string.js
var require_string = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/string.js": ((exports) => {
	var stringifyString$2 = require_stringifyString();
	const string$4 = {
		identify: (value) => typeof value === "string",
		default: true,
		tag: "tag:yaml.org,2002:str",
		resolve: (str) => str,
		stringify(item, ctx, onComment, onChompKeep) {
			ctx = Object.assign({ actualString: true }, ctx);
			return stringifyString$2.stringifyString(item, ctx, onComment, onChompKeep);
		}
	};
	exports.string = string$4;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/null.js
var require_null = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/common/null.js": ((exports) => {
	var Scalar$12 = require_Scalar();
	const nullTag = {
		identify: (value) => value == null,
		createNode: () => new Scalar$12.Scalar(null),
		default: true,
		tag: "tag:yaml.org,2002:null",
		test: /^(?:~|[Nn]ull|NULL)?$/,
		resolve: () => new Scalar$12.Scalar(null),
		stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
	};
	exports.nullTag = nullTag;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/bool.js
var require_bool$1 = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/bool.js": ((exports) => {
	var Scalar$11 = require_Scalar();
	const boolTag = {
		identify: (value) => typeof value === "boolean",
		default: true,
		tag: "tag:yaml.org,2002:bool",
		test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
		resolve: (str) => new Scalar$11.Scalar(str[0] === "t" || str[0] === "T"),
		stringify({ source, value }, ctx) {
			if (source && boolTag.test.test(source)) {
				if (value === (source[0] === "t" || source[0] === "T")) return source;
			}
			return value ? ctx.options.trueStr : ctx.options.falseStr;
		}
	};
	exports.boolTag = boolTag;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyNumber.js": ((exports) => {
	function stringifyNumber$5({ format, minFractionDigits, tag, value }) {
		if (typeof value === "bigint") return String(value);
		const num = typeof value === "number" ? value : Number(value);
		if (!isFinite(num)) return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
		let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
		if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
			let i = n.indexOf(".");
			if (i < 0) {
				i = n.length;
				n += ".";
			}
			let d = minFractionDigits - (n.length - i - 1);
			while (d-- > 0) n += "0";
		}
		return n;
	}
	exports.stringifyNumber = stringifyNumber$5;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/float.js
var require_float$1 = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/float.js": ((exports) => {
	var Scalar$10 = require_Scalar();
	var stringifyNumber$4 = require_stringifyNumber();
	const floatNaN$1 = {
		identify: (value) => typeof value === "number",
		default: true,
		tag: "tag:yaml.org,2002:float",
		test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
		resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
		stringify: stringifyNumber$4.stringifyNumber
	};
	const floatExp$1 = {
		identify: (value) => typeof value === "number",
		default: true,
		tag: "tag:yaml.org,2002:float",
		format: "EXP",
		test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
		resolve: (str) => parseFloat(str),
		stringify(node) {
			const num = Number(node.value);
			return isFinite(num) ? num.toExponential() : stringifyNumber$4.stringifyNumber(node);
		}
	};
	const float$4 = {
		identify: (value) => typeof value === "number",
		default: true,
		tag: "tag:yaml.org,2002:float",
		test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
		resolve(str) {
			const node = new Scalar$10.Scalar(parseFloat(str));
			const dot = str.indexOf(".");
			if (dot !== -1 && str[str.length - 1] === "0") node.minFractionDigits = str.length - dot - 1;
			return node;
		},
		stringify: stringifyNumber$4.stringifyNumber
	};
	exports.float = float$4;
	exports.floatExp = floatExp$1;
	exports.floatNaN = floatNaN$1;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/int.js
var require_int$1 = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/int.js": ((exports) => {
	var stringifyNumber$3 = require_stringifyNumber();
	const intIdentify$2 = (value) => typeof value === "bigint" || Number.isInteger(value);
	const intResolve$1 = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
	function intStringify$1(node, radix, prefix) {
		const { value } = node;
		if (intIdentify$2(value) && value >= 0) return prefix + value.toString(radix);
		return stringifyNumber$3.stringifyNumber(node);
	}
	const intOct$1 = {
		identify: (value) => intIdentify$2(value) && value >= 0,
		default: true,
		tag: "tag:yaml.org,2002:int",
		format: "OCT",
		test: /^0o[0-7]+$/,
		resolve: (str, _onError, opt) => intResolve$1(str, 2, 8, opt),
		stringify: (node) => intStringify$1(node, 8, "0o")
	};
	const int$4 = {
		identify: intIdentify$2,
		default: true,
		tag: "tag:yaml.org,2002:int",
		test: /^[-+]?[0-9]+$/,
		resolve: (str, _onError, opt) => intResolve$1(str, 0, 10, opt),
		stringify: stringifyNumber$3.stringifyNumber
	};
	const intHex$1 = {
		identify: (value) => intIdentify$2(value) && value >= 0,
		default: true,
		tag: "tag:yaml.org,2002:int",
		format: "HEX",
		test: /^0x[0-9a-fA-F]+$/,
		resolve: (str, _onError, opt) => intResolve$1(str, 2, 16, opt),
		stringify: (node) => intStringify$1(node, 16, "0x")
	};
	exports.int = int$4;
	exports.intHex = intHex$1;
	exports.intOct = intOct$1;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/schema.js
var require_schema$2 = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/core/schema.js": ((exports) => {
	var map$4 = require_map();
	var _null$2 = require_null();
	var seq$4 = require_seq();
	var string$3 = require_string();
	var bool$2 = require_bool$1();
	var float$3 = require_float$1();
	var int$3 = require_int$1();
	const schema$5 = [
		map$4.map,
		seq$4.seq,
		string$3.string,
		_null$2.nullTag,
		bool$2.boolTag,
		int$3.intOct,
		int$3.int,
		int$3.intHex,
		float$3.floatNaN,
		float$3.floatExp,
		float$3.float
	];
	exports.schema = schema$5;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/json/schema.js
var require_schema$1 = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/json/schema.js": ((exports) => {
	var Scalar$9 = require_Scalar();
	var map$3 = require_map();
	var seq$3 = require_seq();
	function intIdentify$1(value) {
		return typeof value === "bigint" || Number.isInteger(value);
	}
	const stringifyJSON = ({ value }) => JSON.stringify(value);
	const jsonScalars = [
		{
			identify: (value) => typeof value === "string",
			default: true,
			tag: "tag:yaml.org,2002:str",
			resolve: (str) => str,
			stringify: stringifyJSON
		},
		{
			identify: (value) => value == null,
			createNode: () => new Scalar$9.Scalar(null),
			default: true,
			tag: "tag:yaml.org,2002:null",
			test: /^null$/,
			resolve: () => null,
			stringify: stringifyJSON
		},
		{
			identify: (value) => typeof value === "boolean",
			default: true,
			tag: "tag:yaml.org,2002:bool",
			test: /^true$|^false$/,
			resolve: (str) => str === "true",
			stringify: stringifyJSON
		},
		{
			identify: intIdentify$1,
			default: true,
			tag: "tag:yaml.org,2002:int",
			test: /^-?(?:0|[1-9][0-9]*)$/,
			resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
			stringify: ({ value }) => intIdentify$1(value) ? value.toString() : JSON.stringify(value)
		},
		{
			identify: (value) => typeof value === "number",
			default: true,
			tag: "tag:yaml.org,2002:float",
			test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
			resolve: (str) => parseFloat(str),
			stringify: stringifyJSON
		}
	];
	const schema$4 = [map$3.map, seq$3.seq].concat(jsonScalars, {
		default: true,
		tag: "",
		test: /^/,
		resolve(str, onError) {
			onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
			return str;
		}
	});
	exports.schema = schema$4;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/binary.js": ((exports) => {
	var node_buffer = __require("buffer");
	var Scalar$8 = require_Scalar();
	var stringifyString$1 = require_stringifyString();
	const binary$2 = {
		identify: (value) => value instanceof Uint8Array,
		default: false,
		tag: "tag:yaml.org,2002:binary",
		resolve(src, onError) {
			if (typeof node_buffer.Buffer === "function") return node_buffer.Buffer.from(src, "base64");
			else if (typeof atob === "function") {
				const str = atob(src.replace(/[\n\r]/g, ""));
				const buffer = new Uint8Array(str.length);
				for (let i = 0; i < str.length; ++i) buffer[i] = str.charCodeAt(i);
				return buffer;
			} else {
				onError("This environment does not support reading binary tags; either Buffer or atob is required");
				return src;
			}
		},
		stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
			if (!value) return "";
			const buf = value;
			let str;
			if (typeof node_buffer.Buffer === "function") str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
			else if (typeof btoa === "function") {
				let s = "";
				for (let i = 0; i < buf.length; ++i) s += String.fromCharCode(buf[i]);
				str = btoa(s);
			} else throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
			type ?? (type = Scalar$8.Scalar.BLOCK_LITERAL);
			if (type !== Scalar$8.Scalar.QUOTE_DOUBLE) {
				const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
				const n = Math.ceil(str.length / lineWidth);
				const lines = new Array(n);
				for (let i = 0, o = 0; i < n; ++i, o += lineWidth) lines[i] = str.substr(o, lineWidth);
				str = lines.join(type === Scalar$8.Scalar.BLOCK_LITERAL ? "\n" : " ");
			}
			return stringifyString$1.stringifyString({
				comment,
				type,
				value: str
			}, ctx, onComment, onChompKeep);
		}
	};
	exports.binary = binary$2;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/pairs.js": ((exports) => {
	var identity$13 = require_identity();
	var Pair$5 = require_Pair();
	var Scalar$7 = require_Scalar();
	var YAMLSeq$5 = require_YAMLSeq();
	function resolvePairs(seq$6, onError) {
		if (identity$13.isSeq(seq$6)) for (let i = 0; i < seq$6.items.length; ++i) {
			let item = seq$6.items[i];
			if (identity$13.isPair(item)) continue;
			else if (identity$13.isMap(item)) {
				if (item.items.length > 1) onError("Each pair must have its own sequence indicator");
				const pair = item.items[0] || new Pair$5.Pair(new Scalar$7.Scalar(null));
				if (item.commentBefore) pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}\n${pair.key.commentBefore}` : item.commentBefore;
				if (item.comment) {
					const cn = pair.value ?? pair.key;
					cn.comment = cn.comment ? `${item.comment}\n${cn.comment}` : item.comment;
				}
				item = pair;
			}
			seq$6.items[i] = identity$13.isPair(item) ? item : new Pair$5.Pair(item);
		}
		else onError("Expected a sequence for this tag");
		return seq$6;
	}
	function createPairs(schema$6, iterable, ctx) {
		const { replacer } = ctx;
		const pairs$4 = new YAMLSeq$5.YAMLSeq(schema$6);
		pairs$4.tag = "tag:yaml.org,2002:pairs";
		let i = 0;
		if (iterable && Symbol.iterator in Object(iterable)) for (let it of iterable) {
			if (typeof replacer === "function") it = replacer.call(iterable, String(i++), it);
			let key, value;
			if (Array.isArray(it)) if (it.length === 2) {
				key = it[0];
				value = it[1];
			} else throw new TypeError(`Expected [key, value] tuple: ${it}`);
			else if (it && it instanceof Object) {
				const keys = Object.keys(it);
				if (keys.length === 1) {
					key = keys[0];
					value = it[key];
				} else throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
			} else key = it;
			pairs$4.items.push(Pair$5.createPair(key, value, ctx));
		}
		return pairs$4;
	}
	const pairs$3 = {
		collection: "seq",
		default: false,
		tag: "tag:yaml.org,2002:pairs",
		resolve: resolvePairs,
		createNode: createPairs
	};
	exports.createPairs = createPairs;
	exports.pairs = pairs$3;
	exports.resolvePairs = resolvePairs;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/omap.js": ((exports) => {
	var identity$12 = require_identity();
	var toJS$1 = require_toJS();
	var YAMLMap$5 = require_YAMLMap();
	var YAMLSeq$4 = require_YAMLSeq();
	var pairs$2 = require_pairs();
	var YAMLOMap = class YAMLOMap extends YAMLSeq$4.YAMLSeq {
		constructor() {
			super();
			this.add = YAMLMap$5.YAMLMap.prototype.add.bind(this);
			this.delete = YAMLMap$5.YAMLMap.prototype.delete.bind(this);
			this.get = YAMLMap$5.YAMLMap.prototype.get.bind(this);
			this.has = YAMLMap$5.YAMLMap.prototype.has.bind(this);
			this.set = YAMLMap$5.YAMLMap.prototype.set.bind(this);
			this.tag = YAMLOMap.tag;
		}
		/**
		* If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
		* but TypeScript won't allow widening the signature of a child method.
		*/
		toJSON(_, ctx) {
			if (!ctx) return super.toJSON(_);
			const map$6 = /* @__PURE__ */ new Map();
			if (ctx?.onCreate) ctx.onCreate(map$6);
			for (const pair of this.items) {
				let key, value;
				if (identity$12.isPair(pair)) {
					key = toJS$1.toJS(pair.key, "", ctx);
					value = toJS$1.toJS(pair.value, key, ctx);
				} else key = toJS$1.toJS(pair, "", ctx);
				if (map$6.has(key)) throw new Error("Ordered maps must not include duplicate keys");
				map$6.set(key, value);
			}
			return map$6;
		}
		static from(schema$6, iterable, ctx) {
			const pairs$1$1 = pairs$2.createPairs(schema$6, iterable, ctx);
			const omap$3 = new this();
			omap$3.items = pairs$1$1.items;
			return omap$3;
		}
	};
	YAMLOMap.tag = "tag:yaml.org,2002:omap";
	const omap$2 = {
		collection: "seq",
		identify: (value) => value instanceof Map,
		nodeClass: YAMLOMap,
		default: false,
		tag: "tag:yaml.org,2002:omap",
		resolve(seq$6, onError) {
			const pairs$1$1 = pairs$2.resolvePairs(seq$6, onError);
			const seenKeys = [];
			for (const { key } of pairs$1$1.items) if (identity$12.isScalar(key)) if (seenKeys.includes(key.value)) onError(`Ordered maps must not include duplicate keys: ${key.value}`);
			else seenKeys.push(key.value);
			return Object.assign(new YAMLOMap(), pairs$1$1);
		},
		createNode: (schema$6, iterable, ctx) => YAMLOMap.from(schema$6, iterable, ctx)
	};
	exports.YAMLOMap = YAMLOMap;
	exports.omap = omap$2;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/bool.js": ((exports) => {
	var Scalar$6 = require_Scalar();
	function boolStringify({ value, source }, ctx) {
		if (source && (value ? trueTag : falseTag).test.test(source)) return source;
		return value ? ctx.options.trueStr : ctx.options.falseStr;
	}
	const trueTag = {
		identify: (value) => value === true,
		default: true,
		tag: "tag:yaml.org,2002:bool",
		test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
		resolve: () => new Scalar$6.Scalar(true),
		stringify: boolStringify
	};
	const falseTag = {
		identify: (value) => value === false,
		default: true,
		tag: "tag:yaml.org,2002:bool",
		test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
		resolve: () => new Scalar$6.Scalar(false),
		stringify: boolStringify
	};
	exports.falseTag = falseTag;
	exports.trueTag = trueTag;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/float.js": ((exports) => {
	var Scalar$5 = require_Scalar();
	var stringifyNumber$2 = require_stringifyNumber();
	const floatNaN = {
		identify: (value) => typeof value === "number",
		default: true,
		tag: "tag:yaml.org,2002:float",
		test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
		resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
		stringify: stringifyNumber$2.stringifyNumber
	};
	const floatExp = {
		identify: (value) => typeof value === "number",
		default: true,
		tag: "tag:yaml.org,2002:float",
		format: "EXP",
		test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
		resolve: (str) => parseFloat(str.replace(/_/g, "")),
		stringify(node) {
			const num = Number(node.value);
			return isFinite(num) ? num.toExponential() : stringifyNumber$2.stringifyNumber(node);
		}
	};
	const float$2 = {
		identify: (value) => typeof value === "number",
		default: true,
		tag: "tag:yaml.org,2002:float",
		test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
		resolve(str) {
			const node = new Scalar$5.Scalar(parseFloat(str.replace(/_/g, "")));
			const dot = str.indexOf(".");
			if (dot !== -1) {
				const f = str.substring(dot + 1).replace(/_/g, "");
				if (f[f.length - 1] === "0") node.minFractionDigits = f.length;
			}
			return node;
		},
		stringify: stringifyNumber$2.stringifyNumber
	};
	exports.float = float$2;
	exports.floatExp = floatExp;
	exports.floatNaN = floatNaN;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/int.js": ((exports) => {
	var stringifyNumber$1 = require_stringifyNumber();
	const intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
	function intResolve(str, offset, radix, { intAsBigInt }) {
		const sign = str[0];
		if (sign === "-" || sign === "+") offset += 1;
		str = str.substring(offset).replace(/_/g, "");
		if (intAsBigInt) {
			switch (radix) {
				case 2:
					str = `0b${str}`;
					break;
				case 8:
					str = `0o${str}`;
					break;
				case 16:
					str = `0x${str}`;
					break;
			}
			const n$1 = BigInt(str);
			return sign === "-" ? BigInt(-1) * n$1 : n$1;
		}
		const n = parseInt(str, radix);
		return sign === "-" ? -1 * n : n;
	}
	function intStringify(node, radix, prefix) {
		const { value } = node;
		if (intIdentify(value)) {
			const str = value.toString(radix);
			return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
		}
		return stringifyNumber$1.stringifyNumber(node);
	}
	const intBin = {
		identify: intIdentify,
		default: true,
		tag: "tag:yaml.org,2002:int",
		format: "BIN",
		test: /^[-+]?0b[0-1_]+$/,
		resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
		stringify: (node) => intStringify(node, 2, "0b")
	};
	const intOct = {
		identify: intIdentify,
		default: true,
		tag: "tag:yaml.org,2002:int",
		format: "OCT",
		test: /^[-+]?0[0-7_]+$/,
		resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
		stringify: (node) => intStringify(node, 8, "0")
	};
	const int$2 = {
		identify: intIdentify,
		default: true,
		tag: "tag:yaml.org,2002:int",
		test: /^[-+]?[0-9][0-9_]*$/,
		resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
		stringify: stringifyNumber$1.stringifyNumber
	};
	const intHex = {
		identify: intIdentify,
		default: true,
		tag: "tag:yaml.org,2002:int",
		format: "HEX",
		test: /^[-+]?0x[0-9a-fA-F_]+$/,
		resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
		stringify: (node) => intStringify(node, 16, "0x")
	};
	exports.int = int$2;
	exports.intBin = intBin;
	exports.intHex = intHex;
	exports.intOct = intOct;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/set.js": ((exports) => {
	var identity$11 = require_identity();
	var Pair$4 = require_Pair();
	var YAMLMap$4 = require_YAMLMap();
	var YAMLSet = class YAMLSet extends YAMLMap$4.YAMLMap {
		constructor(schema$6) {
			super(schema$6);
			this.tag = YAMLSet.tag;
		}
		add(key) {
			let pair;
			if (identity$11.isPair(key)) pair = key;
			else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null) pair = new Pair$4.Pair(key.key, null);
			else pair = new Pair$4.Pair(key, null);
			if (!YAMLMap$4.findPair(this.items, pair.key)) this.items.push(pair);
		}
		/**
		* If `keepPair` is `true`, returns the Pair matching `key`.
		* Otherwise, returns the value of that Pair's key.
		*/
		get(key, keepPair) {
			const pair = YAMLMap$4.findPair(this.items, key);
			return !keepPair && identity$11.isPair(pair) ? identity$11.isScalar(pair.key) ? pair.key.value : pair.key : pair;
		}
		set(key, value) {
			if (typeof value !== "boolean") throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
			const prev = YAMLMap$4.findPair(this.items, key);
			if (prev && !value) this.items.splice(this.items.indexOf(prev), 1);
			else if (!prev && value) this.items.push(new Pair$4.Pair(key));
		}
		toJSON(_, ctx) {
			return super.toJSON(_, ctx, Set);
		}
		toString(ctx, onComment, onChompKeep) {
			if (!ctx) return JSON.stringify(this);
			if (this.hasAllNullValues(true)) return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
			else throw new Error("Set items must all have null values");
		}
		static from(schema$6, iterable, ctx) {
			const { replacer } = ctx;
			const set$3 = new this(schema$6);
			if (iterable && Symbol.iterator in Object(iterable)) for (let value of iterable) {
				if (typeof replacer === "function") value = replacer.call(iterable, value, value);
				set$3.items.push(Pair$4.createPair(value, null, ctx));
			}
			return set$3;
		}
	};
	YAMLSet.tag = "tag:yaml.org,2002:set";
	const set$2 = {
		collection: "map",
		identify: (value) => value instanceof Set,
		nodeClass: YAMLSet,
		default: false,
		tag: "tag:yaml.org,2002:set",
		createNode: (schema$6, iterable, ctx) => YAMLSet.from(schema$6, iterable, ctx),
		resolve(map$6, onError) {
			if (identity$11.isMap(map$6)) if (map$6.hasAllNullValues(true)) return Object.assign(new YAMLSet(), map$6);
			else onError("Set items must all have null values");
			else onError("Expected a mapping for this tag");
			return map$6;
		}
	};
	exports.YAMLSet = YAMLSet;
	exports.set = set$2;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/timestamp.js": ((exports) => {
	var stringifyNumber = require_stringifyNumber();
	/** Internal types handle bigint as number, because TS can't figure it out. */
	function parseSexagesimal(str, asBigInt) {
		const sign = str[0];
		const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
		const num = (n) => asBigInt ? BigInt(n) : Number(n);
		const res = parts.replace(/_/g, "").split(":").reduce((res$1, p) => res$1 * num(60) + num(p), num(0));
		return sign === "-" ? num(-1) * res : res;
	}
	/**
	* hhhh:mm:ss.sss
	*
	* Internal types handle bigint as number, because TS can't figure it out.
	*/
	function stringifySexagesimal(node) {
		let { value } = node;
		let num = (n) => n;
		if (typeof value === "bigint") num = (n) => BigInt(n);
		else if (isNaN(value) || !isFinite(value)) return stringifyNumber.stringifyNumber(node);
		let sign = "";
		if (value < 0) {
			sign = "-";
			value *= num(-1);
		}
		const _60 = num(60);
		const parts = [value % _60];
		if (value < 60) parts.unshift(0);
		else {
			value = (value - parts[0]) / _60;
			parts.unshift(value % _60);
			if (value >= 60) {
				value = (value - parts[0]) / _60;
				parts.unshift(value);
			}
		}
		return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
	}
	const intTime = {
		identify: (value) => typeof value === "bigint" || Number.isInteger(value),
		default: true,
		tag: "tag:yaml.org,2002:int",
		format: "TIME",
		test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
		resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
		stringify: stringifySexagesimal
	};
	const floatTime = {
		identify: (value) => typeof value === "number",
		default: true,
		tag: "tag:yaml.org,2002:float",
		format: "TIME",
		test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
		resolve: (str) => parseSexagesimal(str, false),
		stringify: stringifySexagesimal
	};
	const timestamp$2 = {
		identify: (value) => value instanceof Date,
		default: true,
		tag: "tag:yaml.org,2002:timestamp",
		test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
		resolve(str) {
			const match = str.match(timestamp$2.test);
			if (!match) throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
			const [, year, month, day, hour, minute, second] = match.map(Number);
			const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
			let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
			const tz = match[8];
			if (tz && tz !== "Z") {
				let d = parseSexagesimal(tz, false);
				if (Math.abs(d) < 30) d *= 60;
				date -= 6e4 * d;
			}
			return new Date(date);
		},
		stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
	};
	exports.floatTime = floatTime;
	exports.intTime = intTime;
	exports.timestamp = timestamp$2;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/yaml-1.1/schema.js": ((exports) => {
	var map$2 = require_map();
	var _null$1 = require_null();
	var seq$2 = require_seq();
	var string$2 = require_string();
	var binary$1 = require_binary();
	var bool$1 = require_bool();
	var float$1 = require_float();
	var int$1 = require_int();
	var merge$1 = require_merge();
	var omap$1 = require_omap();
	var pairs$1 = require_pairs();
	var set$1 = require_set();
	var timestamp$1 = require_timestamp();
	const schema$3 = [
		map$2.map,
		seq$2.seq,
		string$2.string,
		_null$1.nullTag,
		bool$1.trueTag,
		bool$1.falseTag,
		int$1.intBin,
		int$1.intOct,
		int$1.int,
		int$1.intHex,
		float$1.floatNaN,
		float$1.floatExp,
		float$1.float,
		binary$1.binary,
		merge$1.merge,
		omap$1.omap,
		pairs$1.pairs,
		set$1.set,
		timestamp$1.intTime,
		timestamp$1.floatTime,
		timestamp$1.timestamp
	];
	exports.schema = schema$3;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/tags.js
var require_tags = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/tags.js": ((exports) => {
	var map$1 = require_map();
	var _null = require_null();
	var seq$1 = require_seq();
	var string$1 = require_string();
	var bool = require_bool$1();
	var float = require_float$1();
	var int = require_int$1();
	var schema = require_schema$2();
	var schema$1 = require_schema$1();
	var binary = require_binary();
	var merge = require_merge();
	var omap = require_omap();
	var pairs = require_pairs();
	var schema$2 = require_schema();
	var set = require_set();
	var timestamp = require_timestamp();
	const schemas = new Map([
		["core", schema.schema],
		["failsafe", [
			map$1.map,
			seq$1.seq,
			string$1.string
		]],
		["json", schema$1.schema],
		["yaml11", schema$2.schema],
		["yaml-1.1", schema$2.schema]
	]);
	const tagsByName = {
		binary: binary.binary,
		bool: bool.boolTag,
		float: float.float,
		floatExp: float.floatExp,
		floatNaN: float.floatNaN,
		floatTime: timestamp.floatTime,
		int: int.int,
		intHex: int.intHex,
		intOct: int.intOct,
		intTime: timestamp.intTime,
		map: map$1.map,
		merge: merge.merge,
		null: _null.nullTag,
		omap: omap.omap,
		pairs: pairs.pairs,
		seq: seq$1.seq,
		set: set.set,
		timestamp: timestamp.timestamp
	};
	const coreKnownTags = {
		"tag:yaml.org,2002:binary": binary.binary,
		"tag:yaml.org,2002:merge": merge.merge,
		"tag:yaml.org,2002:omap": omap.omap,
		"tag:yaml.org,2002:pairs": pairs.pairs,
		"tag:yaml.org,2002:set": set.set,
		"tag:yaml.org,2002:timestamp": timestamp.timestamp
	};
	function getTags(customTags, schemaName, addMergeTag) {
		const schemaTags = schemas.get(schemaName);
		if (schemaTags && !customTags) return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
		let tags$1 = schemaTags;
		if (!tags$1) if (Array.isArray(customTags)) tags$1 = [];
		else {
			const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
			throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
		}
		if (Array.isArray(customTags)) for (const tag of customTags) tags$1 = tags$1.concat(tag);
		else if (typeof customTags === "function") tags$1 = customTags(tags$1.slice());
		if (addMergeTag) tags$1 = tags$1.concat(merge.merge);
		return tags$1.reduce((tags$2, tag) => {
			const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
			if (!tagObj) {
				const tagName = JSON.stringify(tag);
				const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
				throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
			}
			if (!tags$2.includes(tagObj)) tags$2.push(tagObj);
			return tags$2;
		}, []);
	}
	exports.coreKnownTags = coreKnownTags;
	exports.getTags = getTags;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/Schema.js
var require_Schema = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/schema/Schema.js": ((exports) => {
	var identity$10 = require_identity();
	var map = require_map();
	var seq = require_seq();
	var string = require_string();
	var tags = require_tags();
	const sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
	var Schema$2 = class Schema$2 {
		constructor({ compat, customTags, merge: merge$4, resolveKnownTags, schema: schema$6, sortMapEntries, toStringDefaults }) {
			this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
			this.name = typeof schema$6 === "string" && schema$6 || "core";
			this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
			this.tags = tags.getTags(customTags, this.name, merge$4);
			this.toStringOptions = toStringDefaults ?? null;
			Object.defineProperty(this, identity$10.MAP, { value: map.map });
			Object.defineProperty(this, identity$10.SCALAR, { value: string.string });
			Object.defineProperty(this, identity$10.SEQ, { value: seq.seq });
			this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
		}
		clone() {
			const copy = Object.create(Schema$2.prototype, Object.getOwnPropertyDescriptors(this));
			copy.tags = this.tags.slice();
			return copy;
		}
	};
	exports.Schema = Schema$2;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyDocument.js": ((exports) => {
	var identity$9 = require_identity();
	var stringify$2 = require_stringify();
	var stringifyComment = require_stringifyComment();
	function stringifyDocument$1(doc, options) {
		const lines = [];
		let hasDirectives = options.directives === true;
		if (options.directives !== false && doc.directives) {
			const dir = doc.directives.toString(doc);
			if (dir) {
				lines.push(dir);
				hasDirectives = true;
			} else if (doc.directives.docStart) hasDirectives = true;
		}
		if (hasDirectives) lines.push("---");
		const ctx = stringify$2.createStringifyContext(doc, options);
		const { commentString } = ctx.options;
		if (doc.commentBefore) {
			if (lines.length !== 1) lines.unshift("");
			const cs = commentString(doc.commentBefore);
			lines.unshift(stringifyComment.indentComment(cs, ""));
		}
		let chompKeep = false;
		let contentComment = null;
		if (doc.contents) {
			if (identity$9.isNode(doc.contents)) {
				if (doc.contents.spaceBefore && hasDirectives) lines.push("");
				if (doc.contents.commentBefore) {
					const cs = commentString(doc.contents.commentBefore);
					lines.push(stringifyComment.indentComment(cs, ""));
				}
				ctx.forceBlockIndent = !!doc.comment;
				contentComment = doc.contents.comment;
			}
			const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
			let body = stringify$2.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
			if (contentComment) body += stringifyComment.lineComment(body, "", commentString(contentComment));
			if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") lines[lines.length - 1] = `--- ${body}`;
			else lines.push(body);
		} else lines.push(stringify$2.stringify(doc.contents, ctx));
		if (doc.directives?.docEnd) if (doc.comment) {
			const cs = commentString(doc.comment);
			if (cs.includes("\n")) {
				lines.push("...");
				lines.push(stringifyComment.indentComment(cs, ""));
			} else lines.push(`... ${cs}`);
		} else lines.push("...");
		else {
			let dc = doc.comment;
			if (dc && chompKeep) dc = dc.replace(/^\n+/, "");
			if (dc) {
				if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "") lines.push("");
				lines.push(stringifyComment.indentComment(commentString(dc), ""));
			}
		}
		return lines.join("\n") + "\n";
	}
	exports.stringifyDocument = stringifyDocument$1;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/Document.js
var require_Document = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/doc/Document.js": ((exports) => {
	var Alias$2 = require_Alias();
	var Collection = require_Collection();
	var identity$8 = require_identity();
	var Pair$3 = require_Pair();
	var toJS = require_toJS();
	var Schema$1 = require_Schema();
	var stringifyDocument = require_stringifyDocument();
	var anchors = require_anchors();
	var applyReviver = require_applyReviver();
	var createNode = require_createNode();
	var directives$1 = require_directives();
	var Document$4 = class Document$4 {
		constructor(value, replacer, options) {
			/** A comment before this Document */
			this.commentBefore = null;
			/** A comment immediately after this Document */
			this.comment = null;
			/** Errors encountered during parsing. */
			this.errors = [];
			/** Warnings encountered during parsing. */
			this.warnings = [];
			Object.defineProperty(this, identity$8.NODE_TYPE, { value: identity$8.DOC });
			let _replacer = null;
			if (typeof replacer === "function" || Array.isArray(replacer)) _replacer = replacer;
			else if (options === void 0 && replacer) {
				options = replacer;
				replacer = void 0;
			}
			const opt = Object.assign({
				intAsBigInt: false,
				keepSourceTokens: false,
				logLevel: "warn",
				prettyErrors: true,
				strict: true,
				stringKeys: false,
				uniqueKeys: true,
				version: "1.2"
			}, options);
			this.options = opt;
			let { version } = opt;
			if (options?._directives) {
				this.directives = options._directives.atDocument();
				if (this.directives.yaml.explicit) version = this.directives.yaml.version;
			} else this.directives = new directives$1.Directives({ version });
			this.setSchema(version, options);
			this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
		}
		/**
		* Create a deep copy of this Document and its contents.
		*
		* Custom Node values that inherit from `Object` still refer to their original instances.
		*/
		clone() {
			const copy = Object.create(Document$4.prototype, { [identity$8.NODE_TYPE]: { value: identity$8.DOC } });
			copy.commentBefore = this.commentBefore;
			copy.comment = this.comment;
			copy.errors = this.errors.slice();
			copy.warnings = this.warnings.slice();
			copy.options = Object.assign({}, this.options);
			if (this.directives) copy.directives = this.directives.clone();
			copy.schema = this.schema.clone();
			copy.contents = identity$8.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
			if (this.range) copy.range = this.range.slice();
			return copy;
		}
		/** Adds a value to the document. */
		add(value) {
			if (assertCollection(this.contents)) this.contents.add(value);
		}
		/** Adds a value to the document. */
		addIn(path, value) {
			if (assertCollection(this.contents)) this.contents.addIn(path, value);
		}
		/**
		* Create a new `Alias` node, ensuring that the target `node` has the required anchor.
		*
		* If `node` already has an anchor, `name` is ignored.
		* Otherwise, the `node.anchor` value will be set to `name`,
		* or if an anchor with that name is already present in the document,
		* `name` will be used as a prefix for a new unique anchor.
		* If `name` is undefined, the generated anchor will use 'a' as a prefix.
		*/
		createAlias(node, name) {
			if (!node.anchor) {
				const prev = anchors.anchorNames(this);
				node.anchor = !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
			}
			return new Alias$2.Alias(node.anchor);
		}
		createNode(value, replacer, options) {
			let _replacer = void 0;
			if (typeof replacer === "function") {
				value = replacer.call({ "": value }, "", value);
				_replacer = replacer;
			} else if (Array.isArray(replacer)) {
				const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
				const asStr = replacer.filter(keyToStr).map(String);
				if (asStr.length > 0) replacer = replacer.concat(asStr);
				_replacer = replacer;
			} else if (options === void 0 && replacer) {
				options = replacer;
				replacer = void 0;
			}
			const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
			const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(this, anchorPrefix || "a");
			const ctx = {
				aliasDuplicateObjects: aliasDuplicateObjects ?? true,
				keepUndefined: keepUndefined ?? false,
				onAnchor,
				onTagObj,
				replacer: _replacer,
				schema: this.schema,
				sourceObjects
			};
			const node = createNode.createNode(value, tag, ctx);
			if (flow && identity$8.isCollection(node)) node.flow = true;
			setAnchors();
			return node;
		}
		/**
		* Convert a key and a value into a `Pair` using the current schema,
		* recursively wrapping all values as `Scalar` or `Collection` nodes.
		*/
		createPair(key, value, options = {}) {
			const k = this.createNode(key, null, options);
			const v = this.createNode(value, null, options);
			return new Pair$3.Pair(k, v);
		}
		/**
		* Removes a value from the document.
		* @returns `true` if the item was found and removed.
		*/
		delete(key) {
			return assertCollection(this.contents) ? this.contents.delete(key) : false;
		}
		/**
		* Removes a value from the document.
		* @returns `true` if the item was found and removed.
		*/
		deleteIn(path) {
			if (Collection.isEmptyPath(path)) {
				if (this.contents == null) return false;
				this.contents = null;
				return true;
			}
			return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
		}
		/**
		* Returns item at `key`, or `undefined` if not found. By default unwraps
		* scalar values from their surrounding node; to disable set `keepScalar` to
		* `true` (collections are always returned intact).
		*/
		get(key, keepScalar) {
			return identity$8.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
		}
		/**
		* Returns item at `path`, or `undefined` if not found. By default unwraps
		* scalar values from their surrounding node; to disable set `keepScalar` to
		* `true` (collections are always returned intact).
		*/
		getIn(path, keepScalar) {
			if (Collection.isEmptyPath(path)) return !keepScalar && identity$8.isScalar(this.contents) ? this.contents.value : this.contents;
			return identity$8.isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
		}
		/**
		* Checks if the document includes a value with the key `key`.
		*/
		has(key) {
			return identity$8.isCollection(this.contents) ? this.contents.has(key) : false;
		}
		/**
		* Checks if the document includes a value at `path`.
		*/
		hasIn(path) {
			if (Collection.isEmptyPath(path)) return this.contents !== void 0;
			return identity$8.isCollection(this.contents) ? this.contents.hasIn(path) : false;
		}
		/**
		* Sets a value in this document. For `!!set`, `value` needs to be a
		* boolean to add/remove the item from the set.
		*/
		set(key, value) {
			if (this.contents == null) this.contents = Collection.collectionFromPath(this.schema, [key], value);
			else if (assertCollection(this.contents)) this.contents.set(key, value);
		}
		/**
		* Sets a value in this document. For `!!set`, `value` needs to be a
		* boolean to add/remove the item from the set.
		*/
		setIn(path, value) {
			if (Collection.isEmptyPath(path)) this.contents = value;
			else if (this.contents == null) this.contents = Collection.collectionFromPath(this.schema, Array.from(path), value);
			else if (assertCollection(this.contents)) this.contents.setIn(path, value);
		}
		/**
		* Change the YAML version and schema used by the document.
		* A `null` version disables support for directives, explicit tags, anchors, and aliases.
		* It also requires the `schema` option to be given as a `Schema` instance value.
		*
		* Overrides all previously set schema options.
		*/
		setSchema(version, options = {}) {
			if (typeof version === "number") version = String(version);
			let opt;
			switch (version) {
				case "1.1":
					if (this.directives) this.directives.yaml.version = "1.1";
					else this.directives = new directives$1.Directives({ version: "1.1" });
					opt = {
						resolveKnownTags: false,
						schema: "yaml-1.1"
					};
					break;
				case "1.2":
				case "next":
					if (this.directives) this.directives.yaml.version = version;
					else this.directives = new directives$1.Directives({ version });
					opt = {
						resolveKnownTags: true,
						schema: "core"
					};
					break;
				case null:
					if (this.directives) delete this.directives;
					opt = null;
					break;
				default: {
					const sv = JSON.stringify(version);
					throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
				}
			}
			if (options.schema instanceof Object) this.schema = options.schema;
			else if (opt) this.schema = new Schema$1.Schema(Object.assign(opt, options));
			else throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
		}
		toJS({ json: json$1, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
			const ctx = {
				anchors: /* @__PURE__ */ new Map(),
				doc: this,
				keep: !json$1,
				mapAsMap: mapAsMap === true,
				mapKeyWarned: false,
				maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
			};
			const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
			if (typeof onAnchor === "function") for (const { count, res: res$1 } of ctx.anchors.values()) onAnchor(res$1, count);
			return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
		}
		/**
		* A JSON representation of the document `contents`.
		*
		* @param jsonArg Used by `JSON.stringify` to indicate the array index or
		*   property name.
		*/
		toJSON(jsonArg, onAnchor) {
			return this.toJS({
				json: true,
				jsonArg,
				mapAsMap: false,
				onAnchor
			});
		}
		/** A YAML representation of the document. */
		toString(options = {}) {
			if (this.errors.length > 0) throw new Error("Document with errors cannot be stringified");
			if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
				const s = JSON.stringify(options.indent);
				throw new Error(`"indent" option must be a positive integer, not ${s}`);
			}
			return stringifyDocument.stringifyDocument(this, options);
		}
	};
	function assertCollection(contents) {
		if (identity$8.isCollection(contents)) return true;
		throw new Error("Expected a YAML collection as document contents");
	}
	exports.Document = Document$4;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/errors.js
var require_errors = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/errors.js": ((exports) => {
	var YAMLError = class extends Error {
		constructor(name, pos, code, message) {
			super();
			this.name = name;
			this.code = code;
			this.message = message;
			this.pos = pos;
		}
	};
	var YAMLParseError = class extends YAMLError {
		constructor(pos, code, message) {
			super("YAMLParseError", pos, code, message);
		}
	};
	var YAMLWarning = class extends YAMLError {
		constructor(pos, code, message) {
			super("YAMLWarning", pos, code, message);
		}
	};
	const prettifyError = (src, lc) => (error) => {
		if (error.pos[0] === -1) return;
		error.linePos = error.pos.map((pos) => lc.linePos(pos));
		const { line, col } = error.linePos[0];
		error.message += ` at line ${line}, column ${col}`;
		let ci = col - 1;
		let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
		if (ci >= 60 && lineStr.length > 80) {
			const trimStart = Math.min(ci - 39, lineStr.length - 79);
			lineStr = "…" + lineStr.substring(trimStart);
			ci -= trimStart - 1;
		}
		if (lineStr.length > 80) lineStr = lineStr.substring(0, 79) + "…";
		if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
			let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
			if (prev.length > 80) prev = prev.substring(0, 79) + "…\n";
			lineStr = prev + lineStr;
		}
		if (/[^ ]/.test(lineStr)) {
			let count = 1;
			const end = error.linePos[1];
			if (end?.line === line && end.col > col) count = Math.max(1, Math.min(end.col - col, 80 - ci));
			const pointer = " ".repeat(ci) + "^".repeat(count);
			error.message += `:\n\n${lineStr}\n${pointer}\n`;
		}
	};
	exports.YAMLError = YAMLError;
	exports.YAMLParseError = YAMLParseError;
	exports.YAMLWarning = YAMLWarning;
	exports.prettifyError = prettifyError;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-props.js": ((exports) => {
	function resolveProps$4(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
		let spaceBefore = false;
		let atNewline = startOnNewline;
		let hasSpace = startOnNewline;
		let comment = "";
		let commentSep = "";
		let hasNewline = false;
		let reqSpace = false;
		let tab = null;
		let anchor = null;
		let tag = null;
		let newlineAfterProp = null;
		let comma = null;
		let found = null;
		let start = null;
		for (const token of tokens) {
			if (reqSpace) {
				if (token.type !== "space" && token.type !== "newline" && token.type !== "comma") onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
				reqSpace = false;
			}
			if (tab) {
				if (atNewline && token.type !== "comment" && token.type !== "newline") onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
				tab = null;
			}
			switch (token.type) {
				case "space":
					if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) tab = token;
					hasSpace = true;
					break;
				case "comment": {
					if (!hasSpace) onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
					const cb = token.source.substring(1) || " ";
					if (!comment) comment = cb;
					else comment += commentSep + cb;
					commentSep = "";
					atNewline = false;
					break;
				}
				case "newline":
					if (atNewline) {
						if (comment) comment += token.source;
						else if (!found || indicator !== "seq-item-ind") spaceBefore = true;
					} else commentSep += token.source;
					atNewline = true;
					hasNewline = true;
					if (anchor || tag) newlineAfterProp = token;
					hasSpace = true;
					break;
				case "anchor":
					if (anchor) onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
					if (token.source.endsWith(":")) onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
					anchor = token;
					start ?? (start = token.offset);
					atNewline = false;
					hasSpace = false;
					reqSpace = true;
					break;
				case "tag":
					if (tag) onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
					tag = token;
					start ?? (start = token.offset);
					atNewline = false;
					hasSpace = false;
					reqSpace = true;
					break;
				case indicator:
					if (anchor || tag) onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
					if (found) onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
					found = token;
					atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
					hasSpace = false;
					break;
				case "comma": if (flow) {
					if (comma) onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
					comma = token;
					atNewline = false;
					hasSpace = false;
					break;
				}
				default:
					onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
					atNewline = false;
					hasSpace = false;
			}
		}
		const last = tokens[tokens.length - 1];
		const end = last ? last.offset + last.source.length : offset;
		if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
		if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq")) onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
		return {
			comma,
			found,
			spaceBefore,
			comment,
			hasNewline,
			anchor,
			tag,
			newlineAfterProp,
			end,
			start: start ?? end
		};
	}
	exports.resolveProps = resolveProps$4;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-contains-newline.js": ((exports) => {
	function containsNewline(key) {
		if (!key) return null;
		switch (key.type) {
			case "alias":
			case "scalar":
			case "double-quoted-scalar":
			case "single-quoted-scalar":
				if (key.source.includes("\n")) return true;
				if (key.end) {
					for (const st of key.end) if (st.type === "newline") return true;
				}
				return false;
			case "flow-collection":
				for (const it of key.items) {
					for (const st of it.start) if (st.type === "newline") return true;
					if (it.sep) {
						for (const st of it.sep) if (st.type === "newline") return true;
					}
					if (containsNewline(it.key) || containsNewline(it.value)) return true;
				}
				return false;
			default: return true;
		}
	}
	exports.containsNewline = containsNewline;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-flow-indent-check.js": ((exports) => {
	var utilContainsNewline$2 = require_util_contains_newline();
	function flowIndentCheck(indent, fc, onError) {
		if (fc?.type === "flow-collection") {
			const end = fc.end[0];
			if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline$2.containsNewline(fc)) onError(end, "BAD_INDENT", "Flow end indicator should be more indented than parent", true);
		}
	}
	exports.flowIndentCheck = flowIndentCheck;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-map-includes.js": ((exports) => {
	var identity$7 = require_identity();
	function mapIncludes(ctx, items, search) {
		const { uniqueKeys } = ctx.options;
		if (uniqueKeys === false) return false;
		const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity$7.isScalar(a) && identity$7.isScalar(b) && a.value === b.value;
		return items.some((pair) => isEqual(pair.key, search));
	}
	exports.mapIncludes = mapIncludes;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-map.js": ((exports) => {
	var Pair$2 = require_Pair();
	var YAMLMap$3 = require_YAMLMap();
	var resolveProps$3 = require_resolve_props();
	var utilContainsNewline$1 = require_util_contains_newline();
	var utilFlowIndentCheck$1 = require_util_flow_indent_check();
	var utilMapIncludes$1 = require_util_map_includes();
	const startColMsg = "All mapping items must start at the same column";
	function resolveBlockMap$1({ composeNode: composeNode$2, composeEmptyNode: composeEmptyNode$1 }, ctx, bm, onError, tag) {
		const map$6 = new (tag?.nodeClass ?? YAMLMap$3.YAMLMap)(ctx.schema);
		if (ctx.atRoot) ctx.atRoot = false;
		let offset = bm.offset;
		let commentEnd = null;
		for (const collItem of bm.items) {
			const { start, key, sep, value } = collItem;
			const keyProps = resolveProps$3.resolveProps(start, {
				indicator: "explicit-key-ind",
				next: key ?? sep?.[0],
				offset,
				onError,
				parentIndent: bm.indent,
				startOnNewline: true
			});
			const implicitKey = !keyProps.found;
			if (implicitKey) {
				if (key) {
					if (key.type === "block-seq") onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
					else if ("indent" in key && key.indent !== bm.indent) onError(offset, "BAD_INDENT", startColMsg);
				}
				if (!keyProps.anchor && !keyProps.tag && !sep) {
					commentEnd = keyProps.end;
					if (keyProps.comment) if (map$6.comment) map$6.comment += "\n" + keyProps.comment;
					else map$6.comment = keyProps.comment;
					continue;
				}
				if (keyProps.newlineAfterProp || utilContainsNewline$1.containsNewline(key)) onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
			} else if (keyProps.found?.indent !== bm.indent) onError(offset, "BAD_INDENT", startColMsg);
			ctx.atKey = true;
			const keyStart = keyProps.end;
			const keyNode = key ? composeNode$2(ctx, key, keyProps, onError) : composeEmptyNode$1(ctx, keyStart, start, null, keyProps, onError);
			if (ctx.schema.compat) utilFlowIndentCheck$1.flowIndentCheck(bm.indent, key, onError);
			ctx.atKey = false;
			if (utilMapIncludes$1.mapIncludes(ctx, map$6.items, keyNode)) onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
			const valueProps = resolveProps$3.resolveProps(sep ?? [], {
				indicator: "map-value-ind",
				next: value,
				offset: keyNode.range[2],
				onError,
				parentIndent: bm.indent,
				startOnNewline: !key || key.type === "block-scalar"
			});
			offset = valueProps.end;
			if (valueProps.found) {
				if (implicitKey) {
					if (value?.type === "block-map" && !valueProps.hasNewline) onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
					if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024) onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
				}
				const valueNode = value ? composeNode$2(ctx, value, valueProps, onError) : composeEmptyNode$1(ctx, offset, sep, null, valueProps, onError);
				if (ctx.schema.compat) utilFlowIndentCheck$1.flowIndentCheck(bm.indent, value, onError);
				offset = valueNode.range[2];
				const pair = new Pair$2.Pair(keyNode, valueNode);
				if (ctx.options.keepSourceTokens) pair.srcToken = collItem;
				map$6.items.push(pair);
			} else {
				if (implicitKey) onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
				if (valueProps.comment) if (keyNode.comment) keyNode.comment += "\n" + valueProps.comment;
				else keyNode.comment = valueProps.comment;
				const pair = new Pair$2.Pair(keyNode);
				if (ctx.options.keepSourceTokens) pair.srcToken = collItem;
				map$6.items.push(pair);
			}
		}
		if (commentEnd && commentEnd < offset) onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
		map$6.range = [
			bm.offset,
			offset,
			commentEnd ?? offset
		];
		return map$6;
	}
	exports.resolveBlockMap = resolveBlockMap$1;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-seq.js": ((exports) => {
	var YAMLSeq$3 = require_YAMLSeq();
	var resolveProps$2 = require_resolve_props();
	var utilFlowIndentCheck = require_util_flow_indent_check();
	function resolveBlockSeq$1({ composeNode: composeNode$2, composeEmptyNode: composeEmptyNode$1 }, ctx, bs, onError, tag) {
		const seq$6 = new (tag?.nodeClass ?? YAMLSeq$3.YAMLSeq)(ctx.schema);
		if (ctx.atRoot) ctx.atRoot = false;
		if (ctx.atKey) ctx.atKey = false;
		let offset = bs.offset;
		let commentEnd = null;
		for (const { start, value } of bs.items) {
			const props = resolveProps$2.resolveProps(start, {
				indicator: "seq-item-ind",
				next: value,
				offset,
				onError,
				parentIndent: bs.indent,
				startOnNewline: true
			});
			if (!props.found) if (props.anchor || props.tag || value) if (value?.type === "block-seq") onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
			else onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
			else {
				commentEnd = props.end;
				if (props.comment) seq$6.comment = props.comment;
				continue;
			}
			const node = value ? composeNode$2(ctx, value, props, onError) : composeEmptyNode$1(ctx, props.end, start, null, props, onError);
			if (ctx.schema.compat) utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
			offset = node.range[2];
			seq$6.items.push(node);
		}
		seq$6.range = [
			bs.offset,
			offset,
			commentEnd ?? offset
		];
		return seq$6;
	}
	exports.resolveBlockSeq = resolveBlockSeq$1;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-end.js": ((exports) => {
	function resolveEnd$5(end, offset, reqSpace, onError) {
		let comment = "";
		if (end) {
			let hasSpace = false;
			let sep = "";
			for (const token of end) {
				const { source, type } = token;
				switch (type) {
					case "space":
						hasSpace = true;
						break;
					case "comment": {
						if (reqSpace && !hasSpace) onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
						const cb = source.substring(1) || " ";
						if (!comment) comment = cb;
						else comment += sep + cb;
						sep = "";
						break;
					}
					case "newline":
						if (comment) sep += source;
						hasSpace = true;
						break;
					default: onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
				}
				offset += source.length;
			}
		}
		return {
			comment,
			offset
		};
	}
	exports.resolveEnd = resolveEnd$5;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-flow-collection.js": ((exports) => {
	var identity$6 = require_identity();
	var Pair$1 = require_Pair();
	var YAMLMap$2 = require_YAMLMap();
	var YAMLSeq$2 = require_YAMLSeq();
	var resolveEnd$4 = require_resolve_end();
	var resolveProps$1 = require_resolve_props();
	var utilContainsNewline = require_util_contains_newline();
	var utilMapIncludes = require_util_map_includes();
	const blockMsg = "Block collections are not allowed within flow collections";
	const isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
	function resolveFlowCollection$1({ composeNode: composeNode$2, composeEmptyNode: composeEmptyNode$1 }, ctx, fc, onError, tag) {
		const isMap$1 = fc.start.source === "{";
		const fcName = isMap$1 ? "flow map" : "flow sequence";
		const coll = new (tag?.nodeClass ?? (isMap$1 ? YAMLMap$2.YAMLMap : YAMLSeq$2.YAMLSeq))(ctx.schema);
		coll.flow = true;
		const atRoot = ctx.atRoot;
		if (atRoot) ctx.atRoot = false;
		if (ctx.atKey) ctx.atKey = false;
		let offset = fc.offset + fc.start.source.length;
		for (let i = 0; i < fc.items.length; ++i) {
			const collItem = fc.items[i];
			const { start, key, sep, value } = collItem;
			const props = resolveProps$1.resolveProps(start, {
				flow: fcName,
				indicator: "explicit-key-ind",
				next: key ?? sep?.[0],
				offset,
				onError,
				parentIndent: fc.indent,
				startOnNewline: false
			});
			if (!props.found) {
				if (!props.anchor && !props.tag && !sep && !value) {
					if (i === 0 && props.comma) onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
					else if (i < fc.items.length - 1) onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
					if (props.comment) if (coll.comment) coll.comment += "\n" + props.comment;
					else coll.comment = props.comment;
					offset = props.end;
					continue;
				}
				if (!isMap$1 && ctx.options.strict && utilContainsNewline.containsNewline(key)) onError(key, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
			}
			if (i === 0) {
				if (props.comma) onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
			} else {
				if (!props.comma) onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
				if (props.comment) {
					let prevItemComment = "";
					loop: for (const st of start) switch (st.type) {
						case "comma":
						case "space": break;
						case "comment":
							prevItemComment = st.source.substring(1);
							break loop;
						default: break loop;
					}
					if (prevItemComment) {
						let prev = coll.items[coll.items.length - 1];
						if (identity$6.isPair(prev)) prev = prev.value ?? prev.key;
						if (prev.comment) prev.comment += "\n" + prevItemComment;
						else prev.comment = prevItemComment;
						props.comment = props.comment.substring(prevItemComment.length + 1);
					}
				}
			}
			if (!isMap$1 && !sep && !props.found) {
				const valueNode = value ? composeNode$2(ctx, value, props, onError) : composeEmptyNode$1(ctx, props.end, sep, null, props, onError);
				coll.items.push(valueNode);
				offset = valueNode.range[2];
				if (isBlock(value)) onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
			} else {
				ctx.atKey = true;
				const keyStart = props.end;
				const keyNode = key ? composeNode$2(ctx, key, props, onError) : composeEmptyNode$1(ctx, keyStart, start, null, props, onError);
				if (isBlock(key)) onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
				ctx.atKey = false;
				const valueProps = resolveProps$1.resolveProps(sep ?? [], {
					flow: fcName,
					indicator: "map-value-ind",
					next: value,
					offset: keyNode.range[2],
					onError,
					parentIndent: fc.indent,
					startOnNewline: false
				});
				if (valueProps.found) {
					if (!isMap$1 && !props.found && ctx.options.strict) {
						if (sep) for (const st of sep) {
							if (st === valueProps.found) break;
							if (st.type === "newline") {
								onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
								break;
							}
						}
						if (props.start < valueProps.found.offset - 1024) onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
					}
				} else if (value) if ("source" in value && value.source?.[0] === ":") onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
				else onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
				const valueNode = value ? composeNode$2(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode$1(ctx, valueProps.end, sep, null, valueProps, onError) : null;
				if (valueNode) {
					if (isBlock(value)) onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
				} else if (valueProps.comment) if (keyNode.comment) keyNode.comment += "\n" + valueProps.comment;
				else keyNode.comment = valueProps.comment;
				const pair = new Pair$1.Pair(keyNode, valueNode);
				if (ctx.options.keepSourceTokens) pair.srcToken = collItem;
				if (isMap$1) {
					const map$6 = coll;
					if (utilMapIncludes.mapIncludes(ctx, map$6.items, keyNode)) onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
					map$6.items.push(pair);
				} else {
					const map$6 = new YAMLMap$2.YAMLMap(ctx.schema);
					map$6.flow = true;
					map$6.items.push(pair);
					const endRange = (valueNode ?? keyNode).range;
					map$6.range = [
						keyNode.range[0],
						endRange[1],
						endRange[2]
					];
					coll.items.push(map$6);
				}
				offset = valueNode ? valueNode.range[2] : valueProps.end;
			}
		}
		const expectedEnd = isMap$1 ? "}" : "]";
		const [ce, ...ee] = fc.end;
		let cePos = offset;
		if (ce?.source === expectedEnd) cePos = ce.offset + ce.source.length;
		else {
			const name = fcName[0].toUpperCase() + fcName.substring(1);
			const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
			onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
			if (ce && ce.source.length !== 1) ee.unshift(ce);
		}
		if (ee.length > 0) {
			const end = resolveEnd$4.resolveEnd(ee, cePos, ctx.options.strict, onError);
			if (end.comment) if (coll.comment) coll.comment += "\n" + end.comment;
			else coll.comment = end.comment;
			coll.range = [
				fc.offset,
				cePos,
				end.offset
			];
		} else coll.range = [
			fc.offset,
			cePos,
			cePos
		];
		return coll;
	}
	exports.resolveFlowCollection = resolveFlowCollection$1;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-collection.js": ((exports) => {
	var identity$5 = require_identity();
	var Scalar$4 = require_Scalar();
	var YAMLMap$1 = require_YAMLMap();
	var YAMLSeq$1 = require_YAMLSeq();
	var resolveBlockMap = require_resolve_block_map();
	var resolveBlockSeq = require_resolve_block_seq();
	var resolveFlowCollection = require_resolve_flow_collection();
	function resolveCollection(CN$1, ctx, token, onError, tagName, tag) {
		const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN$1, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN$1, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN$1, ctx, token, onError, tag);
		const Coll = coll.constructor;
		if (tagName === "!" || tagName === Coll.tagName) {
			coll.tag = Coll.tagName;
			return coll;
		}
		if (tagName) coll.tag = tagName;
		return coll;
	}
	function composeCollection$1(CN$1, ctx, token, props, onError) {
		const tagToken = props.tag;
		const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
		if (token.type === "block-seq") {
			const { anchor, newlineAfterProp: nl } = props;
			const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
			if (lastProp && (!nl || nl.offset < lastProp.offset)) onError(lastProp, "MISSING_CHAR", "Missing newline after block sequence props");
		}
		const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
		if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap$1.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq$1.YAMLSeq.tagName && expType === "seq") return resolveCollection(CN$1, ctx, token, onError, tagName);
		let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
		if (!tag) {
			const kt = ctx.schema.knownTags[tagName];
			if (kt?.collection === expType) {
				ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
				tag = kt;
			} else {
				if (kt) onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
				else onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
				return resolveCollection(CN$1, ctx, token, onError, tagName);
			}
		}
		const coll = resolveCollection(CN$1, ctx, token, onError, tagName, tag);
		const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
		const node = identity$5.isNode(res) ? res : new Scalar$4.Scalar(res);
		node.range = coll.range;
		node.tag = tagName;
		if (tag?.format) node.format = tag.format;
		return node;
	}
	exports.composeCollection = composeCollection$1;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-block-scalar.js": ((exports) => {
	var Scalar$3 = require_Scalar();
	function resolveBlockScalar$2(ctx, scalar, onError) {
		const start = scalar.offset;
		const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
		if (!header) return {
			value: "",
			type: null,
			comment: "",
			range: [
				start,
				start,
				start
			]
		};
		const type = header.mode === ">" ? Scalar$3.Scalar.BLOCK_FOLDED : Scalar$3.Scalar.BLOCK_LITERAL;
		const lines = scalar.source ? splitLines(scalar.source) : [];
		let chompStart = lines.length;
		for (let i = lines.length - 1; i >= 0; --i) {
			const content = lines[i][1];
			if (content === "" || content === "\r") chompStart = i;
			else break;
		}
		if (chompStart === 0) {
			const value$1 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
			let end$1 = start + header.length;
			if (scalar.source) end$1 += scalar.source.length;
			return {
				value: value$1,
				type,
				comment: header.comment,
				range: [
					start,
					end$1,
					end$1
				]
			};
		}
		let trimIndent = scalar.indent + header.indent;
		let offset = scalar.offset + header.length;
		let contentStart = 0;
		for (let i = 0; i < chompStart; ++i) {
			const [indent, content] = lines[i];
			if (content === "" || content === "\r") {
				if (header.indent === 0 && indent.length > trimIndent) trimIndent = indent.length;
			} else {
				if (indent.length < trimIndent) onError(offset + indent.length, "MISSING_CHAR", "Block scalars with more-indented leading empty lines must use an explicit indentation indicator");
				if (header.indent === 0) trimIndent = indent.length;
				contentStart = i;
				if (trimIndent === 0 && !ctx.atRoot) onError(offset, "BAD_INDENT", "Block scalar values in collections must be indented");
				break;
			}
			offset += indent.length + content.length + 1;
		}
		for (let i = lines.length - 1; i >= chompStart; --i) if (lines[i][0].length > trimIndent) chompStart = i + 1;
		let value = "";
		let sep = "";
		let prevMoreIndented = false;
		for (let i = 0; i < contentStart; ++i) value += lines[i][0].slice(trimIndent) + "\n";
		for (let i = contentStart; i < chompStart; ++i) {
			let [indent, content] = lines[i];
			offset += indent.length + content.length + 1;
			const crlf = content[content.length - 1] === "\r";
			if (crlf) content = content.slice(0, -1);
			/* istanbul ignore if already caught in lexer */
			if (content && indent.length < trimIndent) {
				const message = `Block scalar lines must not be less indented than their ${header.indent ? "explicit indentation indicator" : "first line"}`;
				onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
				indent = "";
			}
			if (type === Scalar$3.Scalar.BLOCK_LITERAL) {
				value += sep + indent.slice(trimIndent) + content;
				sep = "\n";
			} else if (indent.length > trimIndent || content[0] === "	") {
				if (sep === " ") sep = "\n";
				else if (!prevMoreIndented && sep === "\n") sep = "\n\n";
				value += sep + indent.slice(trimIndent) + content;
				sep = "\n";
				prevMoreIndented = true;
			} else if (content === "") if (sep === "\n") value += "\n";
			else sep = "\n";
			else {
				value += sep + content;
				sep = " ";
				prevMoreIndented = false;
			}
		}
		switch (header.chomp) {
			case "-": break;
			case "+":
				for (let i = chompStart; i < lines.length; ++i) value += "\n" + lines[i][0].slice(trimIndent);
				if (value[value.length - 1] !== "\n") value += "\n";
				break;
			default: value += "\n";
		}
		const end = start + header.length + scalar.source.length;
		return {
			value,
			type,
			comment: header.comment,
			range: [
				start,
				end,
				end
			]
		};
	}
	function parseBlockScalarHeader({ offset, props }, strict, onError) {
		/* istanbul ignore if should not happen */
		if (props[0].type !== "block-scalar-header") {
			onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
			return null;
		}
		const { source } = props[0];
		const mode = source[0];
		let indent = 0;
		let chomp = "";
		let error = -1;
		for (let i = 1; i < source.length; ++i) {
			const ch = source[i];
			if (!chomp && (ch === "-" || ch === "+")) chomp = ch;
			else {
				const n = Number(ch);
				if (!indent && n) indent = n;
				else if (error === -1) error = offset + i;
			}
		}
		if (error !== -1) onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
		let hasSpace = false;
		let comment = "";
		let length = source.length;
		for (let i = 1; i < props.length; ++i) {
			const token = props[i];
			switch (token.type) {
				case "space": hasSpace = true;
				case "newline":
					length += token.source.length;
					break;
				case "comment":
					if (strict && !hasSpace) onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
					length += token.source.length;
					comment = token.source.substring(1);
					break;
				case "error":
					onError(token, "UNEXPECTED_TOKEN", token.message);
					length += token.source.length;
					break;
				default: {
					onError(token, "UNEXPECTED_TOKEN", `Unexpected token in block scalar header: ${token.type}`);
					const ts = token.source;
					if (ts && typeof ts === "string") length += ts.length;
				}
			}
		}
		return {
			mode,
			indent,
			chomp,
			comment,
			length
		};
	}
	/** @returns Array of lines split up as `[indent, content]` */
	function splitLines(source) {
		const split = source.split(/\n( *)/);
		const first = split[0];
		const m = first.match(/^( *)/);
		const lines = [m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first]];
		for (let i = 1; i < split.length; i += 2) lines.push([split[i], split[i + 1]]);
		return lines;
	}
	exports.resolveBlockScalar = resolveBlockScalar$2;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/resolve-flow-scalar.js": ((exports) => {
	var Scalar$2 = require_Scalar();
	var resolveEnd$3 = require_resolve_end();
	function resolveFlowScalar$2(scalar, strict, onError) {
		const { offset, type, source, end } = scalar;
		let _type;
		let value;
		const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
		switch (type) {
			case "scalar":
				_type = Scalar$2.Scalar.PLAIN;
				value = plainValue(source, _onError);
				break;
			case "single-quoted-scalar":
				_type = Scalar$2.Scalar.QUOTE_SINGLE;
				value = singleQuotedValue(source, _onError);
				break;
			case "double-quoted-scalar":
				_type = Scalar$2.Scalar.QUOTE_DOUBLE;
				value = doubleQuotedValue(source, _onError);
				break;
			default:
				onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
				return {
					value: "",
					type: null,
					comment: "",
					range: [
						offset,
						offset + source.length,
						offset + source.length
					]
				};
		}
		const valueEnd = offset + source.length;
		const re = resolveEnd$3.resolveEnd(end, valueEnd, strict, onError);
		return {
			value,
			type: _type,
			comment: re.comment,
			range: [
				offset,
				valueEnd,
				re.offset
			]
		};
	}
	function plainValue(source, onError) {
		let badChar = "";
		switch (source[0]) {
			case "	":
				badChar = "a tab character";
				break;
			case ",":
				badChar = "flow indicator character ,";
				break;
			case "%":
				badChar = "directive indicator character %";
				break;
			case "|":
			case ">":
				badChar = `block scalar indicator ${source[0]}`;
				break;
			case "@":
			case "`":
				badChar = `reserved character ${source[0]}`;
				break;
		}
		if (badChar) onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
		return unfoldLines(source);
	}
	function singleQuotedValue(source, onError) {
		if (source[source.length - 1] !== "'" || source.length === 1) onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
		return unfoldLines(source.slice(1, -1)).replace(/''/g, "'");
	}
	function unfoldLines(source) {
		const line = /(.*?)\r?\n/sy;
		let match = line.exec(source);
		if (!match) return source;
		/**
		* The negative lookbehinds in these RegExps are to
		* prevent causing a polynomial search time in certain cases.
		*
		* The try-catch is for Safari < 16.4 and other old browsers:
		* https://caniuse.com/js-regexp-lookbehind
		*/
		let trimEnd, trimBoth;
		try {
			trimEnd = /* @__PURE__ */ new RegExp("(?<![ 	])[ 	]+$");
			trimBoth = new RegExp("^[ 	]+|(?<![ 	])[ 	]+$", "g");
		} catch {
			trimEnd = /[ \t]+$/;
			trimBoth = /^[ \t]+|[ \t]+$/g;
		}
		let res = match[1].replace(trimEnd, "");
		let sep = " ";
		let pos = line.lastIndex;
		while (match = line.exec(source)) {
			const lm = match[1].replace(trimBoth, "");
			if (lm === "") if (sep === "\n") res += sep;
			else sep = "\n";
			else {
				res += sep + lm;
				sep = " ";
			}
			pos = line.lastIndex;
		}
		const last = /[ \t]*(.*)/sy;
		last.lastIndex = pos;
		match = last.exec(source);
		return res + sep + (match?.[1] ?? "");
	}
	function doubleQuotedValue(source, onError) {
		let res = "";
		for (let i = 1; i < source.length - 1; ++i) {
			const ch = source[i];
			if (ch === "\r" && source[i + 1] === "\n") continue;
			if (ch === "\n") {
				const { fold, offset } = foldNewline(source, i);
				res += fold;
				i = offset;
			} else if (ch === "\\") {
				let next = source[++i];
				const cc = escapeCodes[next];
				if (cc) res += cc;
				else if (next === "\n") {
					next = source[i + 1];
					while (next === " " || next === "	") next = source[++i + 1];
				} else if (next === "\r" && source[i + 1] === "\n") {
					next = source[++i + 1];
					while (next === " " || next === "	") next = source[++i + 1];
				} else if (next === "x" || next === "u" || next === "U") {
					const length = next === "x" ? 2 : next === "u" ? 4 : 8;
					res += parseCharCode(source, i + 1, length, onError);
					i += length;
				} else {
					const raw = source.substr(i - 1, 2);
					onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
					res += raw;
				}
			} else if (ch === " " || ch === "	") {
				const wsStart = i;
				let next = source[i + 1];
				while (next === " " || next === "	") next = source[++i + 1];
				if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n")) res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
			} else res += ch;
		}
		if (source[source.length - 1] !== "\"" || source.length === 1) onError(source.length, "MISSING_CHAR", "Missing closing \"quote");
		return res;
	}
	/**
	* Fold a single newline into a space, multiple newlines to N - 1 newlines.
	* Presumes `source[offset] === '\n'`
	*/
	function foldNewline(source, offset) {
		let fold = "";
		let ch = source[offset + 1];
		while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
			if (ch === "\r" && source[offset + 2] !== "\n") break;
			if (ch === "\n") fold += "\n";
			offset += 1;
			ch = source[offset + 1];
		}
		if (!fold) fold = " ";
		return {
			fold,
			offset
		};
	}
	const escapeCodes = {
		"0": "\0",
		a: "\x07",
		b: "\b",
		e: "\x1B",
		f: "\f",
		n: "\n",
		r: "\r",
		t: "	",
		v: "\v",
		N: "",
		_: "\xA0",
		L: "\u2028",
		P: "\u2029",
		" ": " ",
		"\"": "\"",
		"/": "/",
		"\\": "\\",
		"	": "	"
	};
	function parseCharCode(source, offset, length, onError) {
		const cc = source.substr(offset, length);
		const code = cc.length === length && /^[0-9a-fA-F]+$/.test(cc) ? parseInt(cc, 16) : NaN;
		try {
			return String.fromCodePoint(code);
		} catch {
			const raw = source.substr(offset - 2, length + 2);
			onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
			return raw;
		}
	}
	exports.resolveFlowScalar = resolveFlowScalar$2;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-scalar.js": ((exports) => {
	var identity$4 = require_identity();
	var Scalar$1 = require_Scalar();
	var resolveBlockScalar$1 = require_resolve_block_scalar();
	var resolveFlowScalar$1 = require_resolve_flow_scalar();
	function composeScalar$1(ctx, token, tagToken, onError) {
		const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar$1.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar$1.resolveFlowScalar(token, ctx.options.strict, onError);
		const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
		let tag;
		if (ctx.options.stringKeys && ctx.atKey) tag = ctx.schema[identity$4.SCALAR];
		else if (tagName) tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
		else if (token.type === "scalar") tag = findScalarTagByTest(ctx, value, token, onError);
		else tag = ctx.schema[identity$4.SCALAR];
		let scalar;
		try {
			const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
			scalar = identity$4.isScalar(res) ? res : new Scalar$1.Scalar(res);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
			scalar = new Scalar$1.Scalar(value);
		}
		scalar.range = range;
		scalar.source = value;
		if (type) scalar.type = type;
		if (tagName) scalar.tag = tagName;
		if (tag.format) scalar.format = tag.format;
		if (comment) scalar.comment = comment;
		return scalar;
	}
	function findScalarTagByName(schema$6, value, tagName, tagToken, onError) {
		if (tagName === "!") return schema$6[identity$4.SCALAR];
		const matchWithTest = [];
		for (const tag of schema$6.tags) if (!tag.collection && tag.tag === tagName) if (tag.default && tag.test) matchWithTest.push(tag);
		else return tag;
		for (const tag of matchWithTest) if (tag.test?.test(value)) return tag;
		const kt = schema$6.knownTags[tagName];
		if (kt && !kt.collection) {
			schema$6.tags.push(Object.assign({}, kt, {
				default: false,
				test: void 0
			}));
			return kt;
		}
		onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
		return schema$6[identity$4.SCALAR];
	}
	function findScalarTagByTest({ atKey, directives: directives$2, schema: schema$6 }, value, token, onError) {
		const tag = schema$6.tags.find((tag$1) => (tag$1.default === true || atKey && tag$1.default === "key") && tag$1.test?.test(value)) || schema$6[identity$4.SCALAR];
		if (schema$6.compat) {
			const compat = schema$6.compat.find((tag$1) => tag$1.default && tag$1.test?.test(value)) ?? schema$6[identity$4.SCALAR];
			if (tag.tag !== compat.tag) onError(token, "TAG_RESOLVE_FAILED", `Value may be parsed as either ${directives$2.tagString(tag.tag)} or ${directives$2.tagString(compat.tag)}`, true);
		}
		return tag;
	}
	exports.composeScalar = composeScalar$1;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/util-empty-scalar-position.js": ((exports) => {
	function emptyScalarPosition(offset, before, pos) {
		if (before) {
			pos ?? (pos = before.length);
			for (let i = pos - 1; i >= 0; --i) {
				let st = before[i];
				switch (st.type) {
					case "space":
					case "comment":
					case "newline":
						offset -= st.source.length;
						continue;
				}
				st = before[++i];
				while (st?.type === "space") {
					offset += st.source.length;
					st = before[++i];
				}
				break;
			}
		}
		return offset;
	}
	exports.emptyScalarPosition = emptyScalarPosition;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-node.js": ((exports) => {
	var Alias$1 = require_Alias();
	var identity$3 = require_identity();
	var composeCollection = require_compose_collection();
	var composeScalar = require_compose_scalar();
	var resolveEnd$2 = require_resolve_end();
	var utilEmptyScalarPosition = require_util_empty_scalar_position();
	const CN = {
		composeNode: composeNode$1,
		composeEmptyNode
	};
	function composeNode$1(ctx, token, props, onError) {
		const atKey = ctx.atKey;
		const { spaceBefore, comment, anchor, tag } = props;
		let node;
		let isSrcToken = true;
		switch (token.type) {
			case "alias":
				node = composeAlias(ctx, token, onError);
				if (anchor || tag) onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
				break;
			case "scalar":
			case "single-quoted-scalar":
			case "double-quoted-scalar":
			case "block-scalar":
				node = composeScalar.composeScalar(ctx, token, tag, onError);
				if (anchor) node.anchor = anchor.source.substring(1);
				break;
			case "block-map":
			case "block-seq":
			case "flow-collection":
				try {
					node = composeCollection.composeCollection(CN, ctx, token, props, onError);
					if (anchor) node.anchor = anchor.source.substring(1);
				} catch (error) {
					onError(token, "RESOURCE_EXHAUSTION", error instanceof Error ? error.message : String(error));
				}
				break;
			default:
				onError(token, "UNEXPECTED_TOKEN", token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`);
				isSrcToken = false;
		}
		node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
		if (anchor && node.anchor === "") onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
		if (atKey && ctx.options.stringKeys && (!identity$3.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) onError(tag ?? token, "NON_STRING_KEY", "With stringKeys, all keys must be strings");
		if (spaceBefore) node.spaceBefore = true;
		if (comment) if (token.type === "scalar" && token.source === "") node.comment = comment;
		else node.commentBefore = comment;
		if (ctx.options.keepSourceTokens && isSrcToken) node.srcToken = token;
		return node;
	}
	function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
		const token = {
			type: "scalar",
			offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
			indent: -1,
			source: ""
		};
		const node = composeScalar.composeScalar(ctx, token, tag, onError);
		if (anchor) {
			node.anchor = anchor.source.substring(1);
			if (node.anchor === "") onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
		}
		if (spaceBefore) node.spaceBefore = true;
		if (comment) {
			node.comment = comment;
			node.range[2] = end;
		}
		return node;
	}
	function composeAlias({ options }, { offset, source, end }, onError) {
		const alias = new Alias$1.Alias(source.substring(1));
		if (alias.source === "") onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
		if (alias.source.endsWith(":")) onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
		const valueEnd = offset + source.length;
		const re = resolveEnd$2.resolveEnd(end, valueEnd, options.strict, onError);
		alias.range = [
			offset,
			valueEnd,
			re.offset
		];
		if (re.comment) alias.comment = re.comment;
		return alias;
	}
	exports.composeEmptyNode = composeEmptyNode;
	exports.composeNode = composeNode$1;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/compose-doc.js": ((exports) => {
	var Document$3 = require_Document();
	var composeNode = require_compose_node();
	var resolveEnd$1 = require_resolve_end();
	var resolveProps = require_resolve_props();
	function composeDoc$1(options, directives$2, { offset, start, value, end }, onError) {
		const opts = Object.assign({ _directives: directives$2 }, options);
		const doc = new Document$3.Document(void 0, opts);
		const ctx = {
			atKey: false,
			atRoot: true,
			directives: doc.directives,
			options: doc.options,
			schema: doc.schema
		};
		const props = resolveProps.resolveProps(start, {
			indicator: "doc-start",
			next: value ?? end?.[0],
			offset,
			onError,
			parentIndent: 0,
			startOnNewline: true
		});
		if (props.found) {
			doc.directives.docStart = true;
			if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline) onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
		}
		doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
		const contentEnd = doc.contents.range[2];
		const re = resolveEnd$1.resolveEnd(end, contentEnd, false, onError);
		if (re.comment) doc.comment = re.comment;
		doc.range = [
			offset,
			contentEnd,
			re.offset
		];
		return doc;
	}
	exports.composeDoc = composeDoc$1;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/composer.js
var require_composer = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/compose/composer.js": ((exports) => {
	var node_process$1 = __require("process");
	var directives = require_directives();
	var Document$2 = require_Document();
	var errors$3 = require_errors();
	var identity$2 = require_identity();
	var composeDoc = require_compose_doc();
	var resolveEnd = require_resolve_end();
	function getErrorPos(src) {
		if (typeof src === "number") return [src, src + 1];
		if (Array.isArray(src)) return src.length === 2 ? src : [src[0], src[1]];
		const { offset, source } = src;
		return [offset, offset + (typeof source === "string" ? source.length : 1)];
	}
	function parsePrelude(prelude) {
		let comment = "";
		let atComment = false;
		let afterEmptyLine = false;
		for (let i = 0; i < prelude.length; ++i) {
			const source = prelude[i];
			switch (source[0]) {
				case "#":
					comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
					atComment = true;
					afterEmptyLine = false;
					break;
				case "%":
					if (prelude[i + 1]?.[0] !== "#") i += 1;
					atComment = false;
					break;
				default:
					if (!atComment) afterEmptyLine = true;
					atComment = false;
			}
		}
		return {
			comment,
			afterEmptyLine
		};
	}
	/**
	* Compose a stream of CST nodes into a stream of YAML Documents.
	*
	* ```ts
	* import { Composer, Parser } from 'yaml'
	*
	* const src: string = ...
	* const tokens = new Parser().parse(src)
	* const docs = new Composer().compose(tokens)
	* ```
	*/
	var Composer = class {
		constructor(options = {}) {
			this.doc = null;
			this.atDirectives = false;
			this.prelude = [];
			this.errors = [];
			this.warnings = [];
			this.onError = (source, code, message, warning) => {
				const pos = getErrorPos(source);
				if (warning) this.warnings.push(new errors$3.YAMLWarning(pos, code, message));
				else this.errors.push(new errors$3.YAMLParseError(pos, code, message));
			};
			this.directives = new directives.Directives({ version: options.version || "1.2" });
			this.options = options;
		}
		decorate(doc, afterDoc) {
			const { comment, afterEmptyLine } = parsePrelude(this.prelude);
			if (comment) {
				const dc = doc.contents;
				if (afterDoc) doc.comment = doc.comment ? `${doc.comment}\n${comment}` : comment;
				else if (afterEmptyLine || doc.directives.docStart || !dc) doc.commentBefore = comment;
				else if (identity$2.isCollection(dc) && !dc.flow && dc.items.length > 0) {
					let it = dc.items[0];
					if (identity$2.isPair(it)) it = it.key;
					const cb = it.commentBefore;
					it.commentBefore = cb ? `${comment}\n${cb}` : comment;
				} else {
					const cb = dc.commentBefore;
					dc.commentBefore = cb ? `${comment}\n${cb}` : comment;
				}
			}
			if (afterDoc) {
				for (let i = 0; i < this.errors.length; ++i) doc.errors.push(this.errors[i]);
				for (let i = 0; i < this.warnings.length; ++i) doc.warnings.push(this.warnings[i]);
			} else {
				doc.errors = this.errors;
				doc.warnings = this.warnings;
			}
			this.prelude = [];
			this.errors = [];
			this.warnings = [];
		}
		/**
		* Current stream status information.
		*
		* Mostly useful at the end of input for an empty stream.
		*/
		streamInfo() {
			return {
				comment: parsePrelude(this.prelude).comment,
				directives: this.directives,
				errors: this.errors,
				warnings: this.warnings
			};
		}
		/**
		* Compose tokens into documents.
		*
		* @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
		* @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
		*/
		*compose(tokens, forceDoc = false, endOffset = -1) {
			for (const token of tokens) yield* this.next(token);
			yield* this.end(forceDoc, endOffset);
		}
		/** Advance the composer by one CST token. */
		*next(token) {
			if (node_process$1.env.LOG_STREAM) console.dir(token, { depth: null });
			switch (token.type) {
				case "directive":
					this.directives.add(token.source, (offset, message, warning) => {
						const pos = getErrorPos(token);
						pos[0] += offset;
						this.onError(pos, "BAD_DIRECTIVE", message, warning);
					});
					this.prelude.push(token.source);
					this.atDirectives = true;
					break;
				case "document": {
					const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
					if (this.atDirectives && !doc.directives.docStart) this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
					this.decorate(doc, false);
					if (this.doc) yield this.doc;
					this.doc = doc;
					this.atDirectives = false;
					break;
				}
				case "byte-order-mark":
				case "space": break;
				case "comment":
				case "newline":
					this.prelude.push(token.source);
					break;
				case "error": {
					const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
					const error = new errors$3.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
					if (this.atDirectives || !this.doc) this.errors.push(error);
					else this.doc.errors.push(error);
					break;
				}
				case "doc-end": {
					if (!this.doc) {
						this.errors.push(new errors$3.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", "Unexpected doc-end without preceding document"));
						break;
					}
					this.doc.directives.docEnd = true;
					const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
					this.decorate(this.doc, true);
					if (end.comment) {
						const dc = this.doc.comment;
						this.doc.comment = dc ? `${dc}\n${end.comment}` : end.comment;
					}
					this.doc.range[2] = end.offset;
					break;
				}
				default: this.errors.push(new errors$3.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
			}
		}
		/**
		* Call at end of input to yield any remaining document.
		*
		* @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
		* @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
		*/
		*end(forceDoc = false, endOffset = -1) {
			if (this.doc) {
				this.decorate(this.doc, true);
				yield this.doc;
				this.doc = null;
			} else if (forceDoc) {
				const opts = Object.assign({ _directives: this.directives }, this.options);
				const doc = new Document$2.Document(void 0, opts);
				if (this.atDirectives) this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
				doc.range = [
					0,
					endOffset,
					endOffset
				];
				this.decorate(doc, false);
				yield doc;
			}
		}
	};
	exports.Composer = Composer;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst-scalar.js": ((exports) => {
	var resolveBlockScalar = require_resolve_block_scalar();
	var resolveFlowScalar = require_resolve_flow_scalar();
	var errors$2 = require_errors();
	var stringifyString = require_stringifyString();
	function resolveAsScalar(token, strict = true, onError) {
		if (token) {
			const _onError = (pos, code, message) => {
				const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
				if (onError) onError(offset, code, message);
				else throw new errors$2.YAMLParseError([offset, offset + 1], code, message);
			};
			switch (token.type) {
				case "scalar":
				case "single-quoted-scalar":
				case "double-quoted-scalar": return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
				case "block-scalar": return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
			}
		}
		return null;
	}
	/**
	* Create a new scalar token with `value`
	*
	* Values that represent an actual string but may be parsed as a different type should use a `type` other than `'PLAIN'`,
	* as this function does not support any schema operations and won't check for such conflicts.
	*
	* @param value The string representation of the value, which will have its content properly indented.
	* @param context.end Comments and whitespace after the end of the value, or after the block scalar header. If undefined, a newline will be added.
	* @param context.implicitKey Being within an implicit key may affect the resolved type of the token's value.
	* @param context.indent The indent level of the token.
	* @param context.inFlow Is this scalar within a flow collection? This may affect the resolved type of the token's value.
	* @param context.offset The offset position of the token.
	* @param context.type The preferred type of the scalar token. If undefined, the previous type of the `token` will be used, defaulting to `'PLAIN'`.
	*/
	function createScalarToken(value, context) {
		const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
		const source = stringifyString.stringifyString({
			type,
			value
		}, {
			implicitKey,
			indent: indent > 0 ? " ".repeat(indent) : "",
			inFlow,
			options: {
				blockQuote: true,
				lineWidth: -1
			}
		});
		const end = context.end ?? [{
			type: "newline",
			offset: -1,
			indent,
			source: "\n"
		}];
		switch (source[0]) {
			case "|":
			case ">": {
				const he = source.indexOf("\n");
				const head = source.substring(0, he);
				const body = source.substring(he + 1) + "\n";
				const props = [{
					type: "block-scalar-header",
					offset,
					indent,
					source: head
				}];
				if (!addEndtoBlockProps(props, end)) props.push({
					type: "newline",
					offset: -1,
					indent,
					source: "\n"
				});
				return {
					type: "block-scalar",
					offset,
					indent,
					props,
					source: body
				};
			}
			case "\"": return {
				type: "double-quoted-scalar",
				offset,
				indent,
				source,
				end
			};
			case "'": return {
				type: "single-quoted-scalar",
				offset,
				indent,
				source,
				end
			};
			default: return {
				type: "scalar",
				offset,
				indent,
				source,
				end
			};
		}
	}
	/**
	* Set the value of `token` to the given string `value`, overwriting any previous contents and type that it may have.
	*
	* Best efforts are made to retain any comments previously associated with the `token`,
	* though all contents within a collection's `items` will be overwritten.
	*
	* Values that represent an actual string but may be parsed as a different type should use a `type` other than `'PLAIN'`,
	* as this function does not support any schema operations and won't check for such conflicts.
	*
	* @param token Any token. If it does not include an `indent` value, the value will be stringified as if it were an implicit key.
	* @param value The string representation of the value, which will have its content properly indented.
	* @param context.afterKey In most cases, values after a key should have an additional level of indentation.
	* @param context.implicitKey Being within an implicit key may affect the resolved type of the token's value.
	* @param context.inFlow Being within a flow collection may affect the resolved type of the token's value.
	* @param context.type The preferred type of the scalar token. If undefined, the previous type of the `token` will be used, defaulting to `'PLAIN'`.
	*/
	function setScalarValue(token, value, context = {}) {
		let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
		let indent = "indent" in token ? token.indent : null;
		if (afterKey && typeof indent === "number") indent += 2;
		if (!type) switch (token.type) {
			case "single-quoted-scalar":
				type = "QUOTE_SINGLE";
				break;
			case "double-quoted-scalar":
				type = "QUOTE_DOUBLE";
				break;
			case "block-scalar": {
				const header = token.props[0];
				if (header.type !== "block-scalar-header") throw new Error("Invalid block scalar header");
				type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
				break;
			}
			default: type = "PLAIN";
		}
		const source = stringifyString.stringifyString({
			type,
			value
		}, {
			implicitKey: implicitKey || indent === null,
			indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
			inFlow,
			options: {
				blockQuote: true,
				lineWidth: -1
			}
		});
		switch (source[0]) {
			case "|":
			case ">":
				setBlockScalarValue(token, source);
				break;
			case "\"":
				setFlowScalarValue(token, source, "double-quoted-scalar");
				break;
			case "'":
				setFlowScalarValue(token, source, "single-quoted-scalar");
				break;
			default: setFlowScalarValue(token, source, "scalar");
		}
	}
	function setBlockScalarValue(token, source) {
		const he = source.indexOf("\n");
		const head = source.substring(0, he);
		const body = source.substring(he + 1) + "\n";
		if (token.type === "block-scalar") {
			const header = token.props[0];
			if (header.type !== "block-scalar-header") throw new Error("Invalid block scalar header");
			header.source = head;
			token.source = body;
		} else {
			const { offset } = token;
			const indent = "indent" in token ? token.indent : -1;
			const props = [{
				type: "block-scalar-header",
				offset,
				indent,
				source: head
			}];
			if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0)) props.push({
				type: "newline",
				offset: -1,
				indent,
				source: "\n"
			});
			for (const key of Object.keys(token)) if (key !== "type" && key !== "offset") delete token[key];
			Object.assign(token, {
				type: "block-scalar",
				indent,
				props,
				source: body
			});
		}
	}
	/** @returns `true` if last token is a newline */
	function addEndtoBlockProps(props, end) {
		if (end) for (const st of end) switch (st.type) {
			case "space":
			case "comment":
				props.push(st);
				break;
			case "newline":
				props.push(st);
				return true;
		}
		return false;
	}
	function setFlowScalarValue(token, source, type) {
		switch (token.type) {
			case "scalar":
			case "double-quoted-scalar":
			case "single-quoted-scalar":
				token.type = type;
				token.source = source;
				break;
			case "block-scalar": {
				const end = token.props.slice(1);
				let oa = source.length;
				if (token.props[0].type === "block-scalar-header") oa -= token.props[0].source.length;
				for (const tok of end) tok.offset += oa;
				delete token.props;
				Object.assign(token, {
					type,
					source,
					end
				});
				break;
			}
			case "block-map":
			case "block-seq": {
				const nl = {
					type: "newline",
					offset: token.offset + source.length,
					indent: token.indent,
					source: "\n"
				};
				delete token.items;
				Object.assign(token, {
					type,
					source,
					end: [nl]
				});
				break;
			}
			default: {
				const indent = "indent" in token ? token.indent : -1;
				const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
				for (const key of Object.keys(token)) if (key !== "type" && key !== "offset") delete token[key];
				Object.assign(token, {
					type,
					indent,
					source,
					end
				});
			}
		}
	}
	exports.createScalarToken = createScalarToken;
	exports.resolveAsScalar = resolveAsScalar;
	exports.setScalarValue = setScalarValue;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst-stringify.js": ((exports) => {
	/**
	* Stringify a CST document, token, or collection item
	*
	* Fair warning: This applies no validation whatsoever, and
	* simply concatenates the sources in their logical order.
	*/
	const stringify$1 = (cst$3) => "type" in cst$3 ? stringifyToken(cst$3) : stringifyItem(cst$3);
	function stringifyToken(token) {
		switch (token.type) {
			case "block-scalar": {
				let res = "";
				for (const tok of token.props) res += stringifyToken(tok);
				return res + token.source;
			}
			case "block-map":
			case "block-seq": {
				let res = "";
				for (const item of token.items) res += stringifyItem(item);
				return res;
			}
			case "flow-collection": {
				let res = token.start.source;
				for (const item of token.items) res += stringifyItem(item);
				for (const st of token.end) res += st.source;
				return res;
			}
			case "document": {
				let res = stringifyItem(token);
				if (token.end) for (const st of token.end) res += st.source;
				return res;
			}
			default: {
				let res = token.source;
				if ("end" in token && token.end) for (const st of token.end) res += st.source;
				return res;
			}
		}
	}
	function stringifyItem({ start, key, sep, value }) {
		let res = "";
		for (const st of start) res += st.source;
		if (key) res += stringifyToken(key);
		if (sep) for (const st of sep) res += st.source;
		if (value) res += stringifyToken(value);
		return res;
	}
	exports.stringify = stringify$1;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst-visit.js": ((exports) => {
	const BREAK = Symbol("break visit");
	const SKIP = Symbol("skip children");
	const REMOVE = Symbol("remove item");
	/**
	* Apply a visitor to a CST document or item.
	*
	* Walks through the tree (depth-first) starting from the root, calling a
	* `visitor` function with two arguments when entering each item:
	*   - `item`: The current item, which included the following members:
	*     - `start: SourceToken[]` – Source tokens before the key or value,
	*       possibly including its anchor or tag.
	*     - `key?: Token | null` – Set for pair values. May then be `null`, if
	*       the key before the `:` separator is empty.
	*     - `sep?: SourceToken[]` – Source tokens between the key and the value,
	*       which should include the `:` map value indicator if `value` is set.
	*     - `value?: Token` – The value of a sequence item, or of a map pair.
	*   - `path`: The steps from the root to the current node, as an array of
	*     `['key' | 'value', number]` tuples.
	*
	* The return value of the visitor may be used to control the traversal:
	*   - `undefined` (default): Do nothing and continue
	*   - `visit.SKIP`: Do not visit the children of this token, continue with
	*      next sibling
	*   - `visit.BREAK`: Terminate traversal completely
	*   - `visit.REMOVE`: Remove the current item, then continue with the next one
	*   - `number`: Set the index of the next step. This is useful especially if
	*     the index of the current token has changed.
	*   - `function`: Define the next visitor for this item. After the original
	*     visitor is called on item entry, next visitors are called after handling
	*     a non-empty `key` and when exiting the item.
	*/
	function visit$1(cst$3, visitor) {
		if ("type" in cst$3 && cst$3.type === "document") cst$3 = {
			start: cst$3.start,
			value: cst$3.value
		};
		_visit(Object.freeze([]), cst$3, visitor);
	}
	/** Terminate visit traversal completely */
	visit$1.BREAK = BREAK;
	/** Do not visit the children of the current item */
	visit$1.SKIP = SKIP;
	/** Remove the current item */
	visit$1.REMOVE = REMOVE;
	/** Find the item at `path` from `cst` as the root */
	visit$1.itemAtPath = (cst$3, path) => {
		let item = cst$3;
		for (const [field, index] of path) {
			const tok = item?.[field];
			if (tok && "items" in tok) item = tok.items[index];
			else return void 0;
		}
		return item;
	};
	/**
	* Get the immediate parent collection of the item at `path` from `cst` as the root.
	*
	* Throws an error if the collection is not found, which should never happen if the item itself exists.
	*/
	visit$1.parentCollection = (cst$3, path) => {
		const parent = visit$1.itemAtPath(cst$3, path.slice(0, -1));
		const field = path[path.length - 1][0];
		const coll = parent?.[field];
		if (coll && "items" in coll) return coll;
		throw new Error("Parent collection not found");
	};
	function _visit(path, item, visitor) {
		let ctrl = visitor(item, path);
		if (typeof ctrl === "symbol") return ctrl;
		for (const field of ["key", "value"]) {
			const token = item[field];
			if (token && "items" in token) {
				for (let i = 0; i < token.items.length; ++i) {
					const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
					if (typeof ci === "number") i = ci - 1;
					else if (ci === BREAK) return BREAK;
					else if (ci === REMOVE) {
						token.items.splice(i, 1);
						i -= 1;
					}
				}
				if (typeof ctrl === "function" && field === "key") ctrl = ctrl(item, path);
			}
		}
		return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
	}
	exports.visit = visit$1;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst.js
var require_cst = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/cst.js": ((exports) => {
	var cstScalar = require_cst_scalar();
	var cstStringify = require_cst_stringify();
	var cstVisit = require_cst_visit();
	/** The byte order mark */
	const BOM = "﻿";
	/** Start of doc-mode */
	const DOCUMENT = "";
	/** Unexpected end of flow-mode */
	const FLOW_END = "";
	/** Next token is a scalar value */
	const SCALAR = "";
	/** @returns `true` if `token` is a flow or block collection */
	const isCollection = (token) => !!token && "items" in token;
	/** @returns `true` if `token` is a flow or block scalar; not an alias */
	const isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
	/* istanbul ignore next */
	/** Get a printable representation of a lexer token */
	function prettyToken(token) {
		switch (token) {
			case BOM: return "<BOM>";
			case DOCUMENT: return "<DOC>";
			case FLOW_END: return "<FLOW_END>";
			case SCALAR: return "<SCALAR>";
			default: return JSON.stringify(token);
		}
	}
	/** Identify the type of a lexer token. May return `null` for unknown tokens. */
	function tokenType(source) {
		switch (source) {
			case BOM: return "byte-order-mark";
			case DOCUMENT: return "doc-mode";
			case FLOW_END: return "flow-error-end";
			case SCALAR: return "scalar";
			case "---": return "doc-start";
			case "...": return "doc-end";
			case "":
			case "\n":
			case "\r\n": return "newline";
			case "-": return "seq-item-ind";
			case "?": return "explicit-key-ind";
			case ":": return "map-value-ind";
			case "{": return "flow-map-start";
			case "}": return "flow-map-end";
			case "[": return "flow-seq-start";
			case "]": return "flow-seq-end";
			case ",": return "comma";
		}
		switch (source[0]) {
			case " ":
			case "	": return "space";
			case "#": return "comment";
			case "%": return "directive-line";
			case "*": return "alias";
			case "&": return "anchor";
			case "!": return "tag";
			case "'": return "single-quoted-scalar";
			case "\"": return "double-quoted-scalar";
			case "|":
			case ">": return "block-scalar-header";
		}
		return null;
	}
	exports.createScalarToken = cstScalar.createScalarToken;
	exports.resolveAsScalar = cstScalar.resolveAsScalar;
	exports.setScalarValue = cstScalar.setScalarValue;
	exports.stringify = cstStringify.stringify;
	exports.visit = cstVisit.visit;
	exports.BOM = BOM;
	exports.DOCUMENT = DOCUMENT;
	exports.FLOW_END = FLOW_END;
	exports.SCALAR = SCALAR;
	exports.isCollection = isCollection;
	exports.isScalar = isScalar;
	exports.prettyToken = prettyToken;
	exports.tokenType = tokenType;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/lexer.js
var require_lexer = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/lexer.js": ((exports) => {
	var cst$2 = require_cst();
	function isEmpty(ch) {
		switch (ch) {
			case void 0:
			case " ":
			case "\n":
			case "\r":
			case "	": return true;
			default: return false;
		}
	}
	const hexDigits = /* @__PURE__ */ new Set("0123456789ABCDEFabcdef");
	const tagChars = /* @__PURE__ */ new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
	const flowIndicatorChars = /* @__PURE__ */ new Set(",[]{}");
	const invalidAnchorChars = /* @__PURE__ */ new Set(" ,[]{}\n\r	");
	const isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
	/**
	* Splits an input string into lexical tokens, i.e. smaller strings that are
	* easily identifiable by `tokens.tokenType()`.
	*
	* Lexing starts always in a "stream" context. Incomplete input may be buffered
	* until a complete token can be emitted.
	*
	* In addition to slices of the original input, the following control characters
	* may also be emitted:
	*
	* - `\x02` (Start of Text): A document starts with the next token
	* - `\x18` (Cancel): Unexpected end of flow-mode (indicates an error)
	* - `\x1f` (Unit Separator): Next token is a scalar value
	* - `\u{FEFF}` (Byte order mark): Emitted separately outside documents
	*/
	var Lexer = class {
		constructor() {
			/**
			* Flag indicating whether the end of the current buffer marks the end of
			* all input
			*/
			this.atEnd = false;
			/**
			* Explicit indent set in block scalar header, as an offset from the current
			* minimum indent, so e.g. set to 1 from a header `|2+`. Set to -1 if not
			* explicitly set.
			*/
			this.blockScalarIndent = -1;
			/**
			* Block scalars that include a + (keep) chomping indicator in their header
			* include trailing empty lines, which are otherwise excluded from the
			* scalar's contents.
			*/
			this.blockScalarKeep = false;
			/** Current input */
			this.buffer = "";
			/**
			* Flag noting whether the map value indicator : can immediately follow this
			* node within a flow context.
			*/
			this.flowKey = false;
			/** Count of surrounding flow collection levels. */
			this.flowLevel = 0;
			/**
			* Minimum level of indentation required for next lines to be parsed as a
			* part of the current scalar value.
			*/
			this.indentNext = 0;
			/** Indentation level of the current line. */
			this.indentValue = 0;
			/** Position of the next \n character. */
			this.lineEndPos = null;
			/** Stores the state of the lexer if reaching the end of incpomplete input */
			this.next = null;
			/** A pointer to `buffer`; the current position of the lexer. */
			this.pos = 0;
		}
		/**
		* Generate YAML tokens from the `source` string. If `incomplete`,
		* a part of the last line may be left as a buffer for the next call.
		*
		* @returns A generator of lexical tokens
		*/
		*lex(source, incomplete = false) {
			if (source) {
				if (typeof source !== "string") throw TypeError("source is not a string");
				this.buffer = this.buffer ? this.buffer + source : source;
				this.lineEndPos = null;
			}
			this.atEnd = !incomplete;
			let next = this.next ?? "stream";
			while (next && (incomplete || this.hasChars(1))) next = yield* this.parseNext(next);
		}
		atLineEnd() {
			let i = this.pos;
			let ch = this.buffer[i];
			while (ch === " " || ch === "	") ch = this.buffer[++i];
			if (!ch || ch === "#" || ch === "\n") return true;
			if (ch === "\r") return this.buffer[i + 1] === "\n";
			return false;
		}
		charAt(n) {
			return this.buffer[this.pos + n];
		}
		continueScalar(offset) {
			let ch = this.buffer[offset];
			if (this.indentNext > 0) {
				let indent = 0;
				while (ch === " ") ch = this.buffer[++indent + offset];
				if (ch === "\r") {
					const next = this.buffer[indent + offset + 1];
					if (next === "\n" || !next && !this.atEnd) return offset + indent + 1;
				}
				return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
			}
			if (ch === "-" || ch === ".") {
				const dt = this.buffer.substr(offset, 3);
				if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3])) return -1;
			}
			return offset;
		}
		getLine() {
			let end = this.lineEndPos;
			if (typeof end !== "number" || end !== -1 && end < this.pos) {
				end = this.buffer.indexOf("\n", this.pos);
				this.lineEndPos = end;
			}
			if (end === -1) return this.atEnd ? this.buffer.substring(this.pos) : null;
			if (this.buffer[end - 1] === "\r") end -= 1;
			return this.buffer.substring(this.pos, end);
		}
		hasChars(n) {
			return this.pos + n <= this.buffer.length;
		}
		setNext(state) {
			this.buffer = this.buffer.substring(this.pos);
			this.pos = 0;
			this.lineEndPos = null;
			this.next = state;
			return null;
		}
		peek(n) {
			return this.buffer.substr(this.pos, n);
		}
		*parseNext(next) {
			switch (next) {
				case "stream": return yield* this.parseStream();
				case "line-start": return yield* this.parseLineStart();
				case "block-start": return yield* this.parseBlockStart();
				case "doc": return yield* this.parseDocument();
				case "flow": return yield* this.parseFlowCollection();
				case "quoted-scalar": return yield* this.parseQuotedScalar();
				case "block-scalar": return yield* this.parseBlockScalar();
				case "plain-scalar": return yield* this.parsePlainScalar();
			}
		}
		*parseStream() {
			let line = this.getLine();
			if (line === null) return this.setNext("stream");
			if (line[0] === cst$2.BOM) {
				yield* this.pushCount(1);
				line = line.substring(1);
			}
			if (line[0] === "%") {
				let dirEnd = line.length;
				let cs = line.indexOf("#");
				while (cs !== -1) {
					const ch = line[cs - 1];
					if (ch === " " || ch === "	") {
						dirEnd = cs - 1;
						break;
					} else cs = line.indexOf("#", cs + 1);
				}
				while (true) {
					const ch = line[dirEnd - 1];
					if (ch === " " || ch === "	") dirEnd -= 1;
					else break;
				}
				const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
				yield* this.pushCount(line.length - n);
				this.pushNewline();
				return "stream";
			}
			if (this.atLineEnd()) {
				const sp = yield* this.pushSpaces(true);
				yield* this.pushCount(line.length - sp);
				yield* this.pushNewline();
				return "stream";
			}
			yield cst$2.DOCUMENT;
			return yield* this.parseLineStart();
		}
		*parseLineStart() {
			const ch = this.charAt(0);
			if (!ch && !this.atEnd) return this.setNext("line-start");
			if (ch === "-" || ch === ".") {
				if (!this.atEnd && !this.hasChars(4)) return this.setNext("line-start");
				const s = this.peek(3);
				if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
					yield* this.pushCount(3);
					this.indentValue = 0;
					this.indentNext = 0;
					return s === "---" ? "doc" : "stream";
				}
			}
			this.indentValue = yield* this.pushSpaces(false);
			if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1))) this.indentNext = this.indentValue;
			return yield* this.parseBlockStart();
		}
		*parseBlockStart() {
			const [ch0, ch1] = this.peek(2);
			if (!ch1 && !this.atEnd) return this.setNext("block-start");
			if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
				const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
				this.indentNext = this.indentValue + 1;
				this.indentValue += n;
				return "block-start";
			}
			return "doc";
		}
		*parseDocument() {
			yield* this.pushSpaces(true);
			const line = this.getLine();
			if (line === null) return this.setNext("doc");
			let n = yield* this.pushIndicators();
			switch (line[n]) {
				case "#": yield* this.pushCount(line.length - n);
				case void 0:
					yield* this.pushNewline();
					return yield* this.parseLineStart();
				case "{":
				case "[":
					yield* this.pushCount(1);
					this.flowKey = false;
					this.flowLevel = 1;
					return "flow";
				case "}":
				case "]":
					yield* this.pushCount(1);
					return "doc";
				case "*":
					yield* this.pushUntil(isNotAnchorChar);
					return "doc";
				case "\"":
				case "'": return yield* this.parseQuotedScalar();
				case "|":
				case ">":
					n += yield* this.parseBlockScalarHeader();
					n += yield* this.pushSpaces(true);
					yield* this.pushCount(line.length - n);
					yield* this.pushNewline();
					return yield* this.parseBlockScalar();
				default: return yield* this.parsePlainScalar();
			}
		}
		*parseFlowCollection() {
			let nl, sp;
			let indent = -1;
			do {
				nl = yield* this.pushNewline();
				if (nl > 0) {
					sp = yield* this.pushSpaces(false);
					this.indentValue = indent = sp;
				} else sp = 0;
				sp += yield* this.pushSpaces(true);
			} while (nl + sp > 0);
			const line = this.getLine();
			if (line === null) return this.setNext("flow");
			if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
				if (!(indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}"))) {
					this.flowLevel = 0;
					yield cst$2.FLOW_END;
					return yield* this.parseLineStart();
				}
			}
			let n = 0;
			while (line[n] === ",") {
				n += yield* this.pushCount(1);
				n += yield* this.pushSpaces(true);
				this.flowKey = false;
			}
			n += yield* this.pushIndicators();
			switch (line[n]) {
				case void 0: return "flow";
				case "#":
					yield* this.pushCount(line.length - n);
					return "flow";
				case "{":
				case "[":
					yield* this.pushCount(1);
					this.flowKey = false;
					this.flowLevel += 1;
					return "flow";
				case "}":
				case "]":
					yield* this.pushCount(1);
					this.flowKey = true;
					this.flowLevel -= 1;
					return this.flowLevel ? "flow" : "doc";
				case "*":
					yield* this.pushUntil(isNotAnchorChar);
					return "flow";
				case "\"":
				case "'":
					this.flowKey = true;
					return yield* this.parseQuotedScalar();
				case ":": {
					const next = this.charAt(1);
					if (this.flowKey || isEmpty(next) || next === ",") {
						this.flowKey = false;
						yield* this.pushCount(1);
						yield* this.pushSpaces(true);
						return "flow";
					}
				}
				default:
					this.flowKey = false;
					return yield* this.parsePlainScalar();
			}
		}
		*parseQuotedScalar() {
			const quote = this.charAt(0);
			let end = this.buffer.indexOf(quote, this.pos + 1);
			if (quote === "'") while (end !== -1 && this.buffer[end + 1] === "'") end = this.buffer.indexOf("'", end + 2);
			else while (end !== -1) {
				let n = 0;
				while (this.buffer[end - 1 - n] === "\\") n += 1;
				if (n % 2 === 0) break;
				end = this.buffer.indexOf("\"", end + 1);
			}
			const qb = this.buffer.substring(0, end);
			let nl = qb.indexOf("\n", this.pos);
			if (nl !== -1) {
				while (nl !== -1) {
					const cs = this.continueScalar(nl + 1);
					if (cs === -1) break;
					nl = qb.indexOf("\n", cs);
				}
				if (nl !== -1) end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
			}
			if (end === -1) {
				if (!this.atEnd) return this.setNext("quoted-scalar");
				end = this.buffer.length;
			}
			yield* this.pushToIndex(end + 1, false);
			return this.flowLevel ? "flow" : "doc";
		}
		*parseBlockScalarHeader() {
			this.blockScalarIndent = -1;
			this.blockScalarKeep = false;
			let i = this.pos;
			while (true) {
				const ch = this.buffer[++i];
				if (ch === "+") this.blockScalarKeep = true;
				else if (ch > "0" && ch <= "9") this.blockScalarIndent = Number(ch) - 1;
				else if (ch !== "-") break;
			}
			return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
		}
		*parseBlockScalar() {
			let nl = this.pos - 1;
			let indent = 0;
			let ch;
			loop: for (let i$1 = this.pos; ch = this.buffer[i$1]; ++i$1) switch (ch) {
				case " ":
					indent += 1;
					break;
				case "\n":
					nl = i$1;
					indent = 0;
					break;
				case "\r": {
					const next = this.buffer[i$1 + 1];
					if (!next && !this.atEnd) return this.setNext("block-scalar");
					if (next === "\n") break;
				}
				default: break loop;
			}
			if (!ch && !this.atEnd) return this.setNext("block-scalar");
			if (indent >= this.indentNext) {
				if (this.blockScalarIndent === -1) this.indentNext = indent;
				else this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
				do {
					const cs = this.continueScalar(nl + 1);
					if (cs === -1) break;
					nl = this.buffer.indexOf("\n", cs);
				} while (nl !== -1);
				if (nl === -1) {
					if (!this.atEnd) return this.setNext("block-scalar");
					nl = this.buffer.length;
				}
			}
			let i = nl + 1;
			ch = this.buffer[i];
			while (ch === " ") ch = this.buffer[++i];
			if (ch === "	") {
				while (ch === "	" || ch === " " || ch === "\r" || ch === "\n") ch = this.buffer[++i];
				nl = i - 1;
			} else if (!this.blockScalarKeep) do {
				let i$1 = nl - 1;
				let ch$1 = this.buffer[i$1];
				if (ch$1 === "\r") ch$1 = this.buffer[--i$1];
				const lastChar = i$1;
				while (ch$1 === " ") ch$1 = this.buffer[--i$1];
				if (ch$1 === "\n" && i$1 >= this.pos && i$1 + 1 + indent > lastChar) nl = i$1;
				else break;
			} while (true);
			yield cst$2.SCALAR;
			yield* this.pushToIndex(nl + 1, true);
			return yield* this.parseLineStart();
		}
		*parsePlainScalar() {
			const inFlow = this.flowLevel > 0;
			let end = this.pos - 1;
			let i = this.pos - 1;
			let ch;
			while (ch = this.buffer[++i]) if (ch === ":") {
				const next = this.buffer[i + 1];
				if (isEmpty(next) || inFlow && flowIndicatorChars.has(next)) break;
				end = i;
			} else if (isEmpty(ch)) {
				let next = this.buffer[i + 1];
				if (ch === "\r") if (next === "\n") {
					i += 1;
					ch = "\n";
					next = this.buffer[i + 1];
				} else end = i;
				if (next === "#" || inFlow && flowIndicatorChars.has(next)) break;
				if (ch === "\n") {
					const cs = this.continueScalar(i + 1);
					if (cs === -1) break;
					i = Math.max(i, cs - 2);
				}
			} else {
				if (inFlow && flowIndicatorChars.has(ch)) break;
				end = i;
			}
			if (!ch && !this.atEnd) return this.setNext("plain-scalar");
			yield cst$2.SCALAR;
			yield* this.pushToIndex(end + 1, true);
			return inFlow ? "flow" : "doc";
		}
		*pushCount(n) {
			if (n > 0) {
				yield this.buffer.substr(this.pos, n);
				this.pos += n;
				return n;
			}
			return 0;
		}
		*pushToIndex(i, allowEmpty) {
			const s = this.buffer.slice(this.pos, i);
			if (s) {
				yield s;
				this.pos += s.length;
				return s.length;
			} else if (allowEmpty) yield "";
			return 0;
		}
		*pushIndicators() {
			let n = 0;
			loop: while (true) {
				switch (this.charAt(0)) {
					case "!":
						n += yield* this.pushTag();
						n += yield* this.pushSpaces(true);
						continue loop;
					case "&":
						n += yield* this.pushUntil(isNotAnchorChar);
						n += yield* this.pushSpaces(true);
						continue loop;
					case "-":
					case "?":
					case ":": {
						const inFlow = this.flowLevel > 0;
						const ch1 = this.charAt(1);
						if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
							if (!inFlow) this.indentNext = this.indentValue + 1;
							else if (this.flowKey) this.flowKey = false;
							n += yield* this.pushCount(1);
							n += yield* this.pushSpaces(true);
							continue loop;
						}
					}
				}
				break loop;
			}
			return n;
		}
		*pushTag() {
			if (this.charAt(1) === "<") {
				let i = this.pos + 2;
				let ch = this.buffer[i];
				while (!isEmpty(ch) && ch !== ">") ch = this.buffer[++i];
				return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
			} else {
				let i = this.pos + 1;
				let ch = this.buffer[i];
				while (ch) if (tagChars.has(ch)) ch = this.buffer[++i];
				else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) ch = this.buffer[i += 3];
				else break;
				return yield* this.pushToIndex(i, false);
			}
		}
		*pushNewline() {
			const ch = this.buffer[this.pos];
			if (ch === "\n") return yield* this.pushCount(1);
			else if (ch === "\r" && this.charAt(1) === "\n") return yield* this.pushCount(2);
			else return 0;
		}
		*pushSpaces(allowTabs) {
			let i = this.pos - 1;
			let ch;
			do
				ch = this.buffer[++i];
			while (ch === " " || allowTabs && ch === "	");
			const n = i - this.pos;
			if (n > 0) {
				yield this.buffer.substr(this.pos, n);
				this.pos = i;
			}
			return n;
		}
		*pushUntil(test) {
			let i = this.pos;
			let ch = this.buffer[i];
			while (!test(ch)) ch = this.buffer[++i];
			return yield* this.pushToIndex(i, false);
		}
	};
	exports.Lexer = Lexer;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/line-counter.js": ((exports) => {
	/**
	* Tracks newlines during parsing in order to provide an efficient API for
	* determining the one-indexed `{ line, col }` position for any offset
	* within the input.
	*/
	var LineCounter = class {
		constructor() {
			this.lineStarts = [];
			/**
			* Should be called in ascending order. Otherwise, call
			* `lineCounter.lineStarts.sort()` before calling `linePos()`.
			*/
			this.addNewLine = (offset) => this.lineStarts.push(offset);
			/**
			* Performs a binary search and returns the 1-indexed { line, col }
			* position of `offset`. If `line === 0`, `addNewLine` has never been
			* called or `offset` is before the first known newline.
			*/
			this.linePos = (offset) => {
				let low = 0;
				let high = this.lineStarts.length;
				while (low < high) {
					const mid = low + high >> 1;
					if (this.lineStarts[mid] < offset) low = mid + 1;
					else high = mid;
				}
				if (this.lineStarts[low] === offset) return {
					line: low + 1,
					col: 1
				};
				if (low === 0) return {
					line: 0,
					col: offset
				};
				const start = this.lineStarts[low - 1];
				return {
					line: low,
					col: offset - start + 1
				};
			};
		}
	};
	exports.LineCounter = LineCounter;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/parser.js
var require_parser = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/parse/parser.js": ((exports) => {
	var node_process = __require("process");
	var cst$1 = require_cst();
	var lexer$1 = require_lexer();
	function includesToken(list, type) {
		for (let i = 0; i < list.length; ++i) if (list[i].type === type) return true;
		return false;
	}
	function findNonEmptyIndex(list) {
		for (let i = 0; i < list.length; ++i) switch (list[i].type) {
			case "space":
			case "comment":
			case "newline": break;
			default: return i;
		}
		return -1;
	}
	function isFlowToken(token) {
		switch (token?.type) {
			case "alias":
			case "scalar":
			case "single-quoted-scalar":
			case "double-quoted-scalar":
			case "flow-collection": return true;
			default: return false;
		}
	}
	function getPrevProps(parent) {
		switch (parent.type) {
			case "document": return parent.start;
			case "block-map": {
				const it = parent.items[parent.items.length - 1];
				return it.sep ?? it.start;
			}
			case "block-seq": return parent.items[parent.items.length - 1].start;
			default: return [];
		}
	}
	/** Note: May modify input array */
	function getFirstKeyStartProps(prev) {
		if (prev.length === 0) return [];
		let i = prev.length;
		loop: while (--i >= 0) switch (prev[i].type) {
			case "doc-start":
			case "explicit-key-ind":
			case "map-value-ind":
			case "seq-item-ind":
			case "newline": break loop;
		}
		while (prev[++i]?.type === "space");
		return prev.splice(i, prev.length);
	}
	function arrayPushArray(target, source) {
		if (source.length < 1e5) Array.prototype.push.apply(target, source);
		else for (let i = 0; i < source.length; ++i) target.push(source[i]);
	}
	function fixFlowSeqItems(fc) {
		if (fc.start.type === "flow-seq-start") {
			for (const it of fc.items) if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
				if (it.key) it.value = it.key;
				delete it.key;
				if (isFlowToken(it.value)) if (it.value.end) arrayPushArray(it.value.end, it.sep);
				else it.value.end = it.sep;
				else arrayPushArray(it.start, it.sep);
				delete it.sep;
			}
		}
	}
	/**
	* A YAML concrete syntax tree (CST) parser
	*
	* ```ts
	* const src: string = ...
	* for (const token of new Parser().parse(src)) {
	*   // token: Token
	* }
	* ```
	*
	* To use the parser with a user-provided lexer:
	*
	* ```ts
	* function* parse(source: string, lexer: Lexer) {
	*   const parser = new Parser()
	*   for (const lexeme of lexer.lex(source))
	*     yield* parser.next(lexeme)
	*   yield* parser.end()
	* }
	*
	* const src: string = ...
	* const lexer = new Lexer()
	* for (const token of parse(src, lexer)) {
	*   // token: Token
	* }
	* ```
	*/
	var Parser = class {
		/**
		* @param onNewLine - If defined, called separately with the start position of
		*   each new line (in `parse()`, including the start of input).
		*/
		constructor(onNewLine) {
			/** If true, space and sequence indicators count as indentation */
			this.atNewLine = true;
			/** If true, next token is a scalar value */
			this.atScalar = false;
			/** Current indentation level */
			this.indent = 0;
			/** Current offset since the start of parsing */
			this.offset = 0;
			/** On the same line with a block map key */
			this.onKeyLine = false;
			/** Top indicates the node that's currently being built */
			this.stack = [];
			/** The source of the current token, set in parse() */
			this.source = "";
			/** The type of the current token, set in parse() */
			this.type = "";
			this.lexer = new lexer$1.Lexer();
			this.onNewLine = onNewLine;
		}
		/**
		* Parse `source` as a YAML stream.
		* If `incomplete`, a part of the last line may be left as a buffer for the next call.
		*
		* Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
		*
		* @returns A generator of tokens representing each directive, document, and other structure.
		*/
		*parse(source, incomplete = false) {
			if (this.onNewLine && this.offset === 0) this.onNewLine(0);
			for (const lexeme of this.lexer.lex(source, incomplete)) yield* this.next(lexeme);
			if (!incomplete) yield* this.end();
		}
		/**
		* Advance the parser by the `source` of one lexical token.
		*/
		*next(source) {
			this.source = source;
			if (node_process.env.LOG_TOKENS) console.log("|", cst$1.prettyToken(source));
			if (this.atScalar) {
				this.atScalar = false;
				yield* this.step();
				this.offset += source.length;
				return;
			}
			const type = cst$1.tokenType(source);
			if (!type) {
				const message = `Not a YAML token: ${source}`;
				yield* this.pop({
					type: "error",
					offset: this.offset,
					message,
					source
				});
				this.offset += source.length;
			} else if (type === "scalar") {
				this.atNewLine = false;
				this.atScalar = true;
				this.type = "scalar";
			} else {
				this.type = type;
				yield* this.step();
				switch (type) {
					case "newline":
						this.atNewLine = true;
						this.indent = 0;
						if (this.onNewLine) this.onNewLine(this.offset + source.length);
						break;
					case "space":
						if (this.atNewLine && source[0] === " ") this.indent += source.length;
						break;
					case "explicit-key-ind":
					case "map-value-ind":
					case "seq-item-ind":
						if (this.atNewLine) this.indent += source.length;
						break;
					case "doc-mode":
					case "flow-error-end": return;
					default: this.atNewLine = false;
				}
				this.offset += source.length;
			}
		}
		/** Call at end of input to push out any remaining constructions */
		*end() {
			while (this.stack.length > 0) yield* this.pop();
		}
		get sourceToken() {
			return {
				type: this.type,
				offset: this.offset,
				indent: this.indent,
				source: this.source
			};
		}
		*step() {
			const top = this.peek(1);
			if (this.type === "doc-end" && top?.type !== "doc-end") {
				while (this.stack.length > 0) yield* this.pop();
				this.stack.push({
					type: "doc-end",
					offset: this.offset,
					source: this.source
				});
				return;
			}
			if (!top) return yield* this.stream();
			switch (top.type) {
				case "document": return yield* this.document(top);
				case "alias":
				case "scalar":
				case "single-quoted-scalar":
				case "double-quoted-scalar": return yield* this.scalar(top);
				case "block-scalar": return yield* this.blockScalar(top);
				case "block-map": return yield* this.blockMap(top);
				case "block-seq": return yield* this.blockSequence(top);
				case "flow-collection": return yield* this.flowCollection(top);
				case "doc-end": return yield* this.documentEnd(top);
			}
			/* istanbul ignore next should not happen */
			yield* this.pop();
		}
		peek(n) {
			return this.stack[this.stack.length - n];
		}
		*pop(error) {
			const token = error ?? this.stack.pop();
			/* istanbul ignore if should not happen */
			if (!token) yield {
				type: "error",
				offset: this.offset,
				source: "",
				message: "Tried to pop an empty stack"
			};
			else if (this.stack.length === 0) yield token;
			else {
				const top = this.peek(1);
				if (token.type === "block-scalar") token.indent = "indent" in top ? top.indent : 0;
				else if (token.type === "flow-collection" && top.type === "document") token.indent = 0;
				if (token.type === "flow-collection") fixFlowSeqItems(token);
				switch (top.type) {
					case "document":
						top.value = token;
						break;
					case "block-scalar":
						top.props.push(token);
						break;
					case "block-map": {
						const it = top.items[top.items.length - 1];
						if (it.value) {
							top.items.push({
								start: [],
								key: token,
								sep: []
							});
							this.onKeyLine = true;
							return;
						} else if (it.sep) it.value = token;
						else {
							Object.assign(it, {
								key: token,
								sep: []
							});
							this.onKeyLine = !it.explicitKey;
							return;
						}
						break;
					}
					case "block-seq": {
						const it = top.items[top.items.length - 1];
						if (it.value) top.items.push({
							start: [],
							value: token
						});
						else it.value = token;
						break;
					}
					case "flow-collection": {
						const it = top.items[top.items.length - 1];
						if (!it || it.value) top.items.push({
							start: [],
							key: token,
							sep: []
						});
						else if (it.sep) it.value = token;
						else Object.assign(it, {
							key: token,
							sep: []
						});
						return;
					}
					default:
						yield* this.pop();
						yield* this.pop(token);
				}
				if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
					const last = token.items[token.items.length - 1];
					if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
						if (top.type === "document") top.end = last.start;
						else top.items.push({ start: last.start });
						token.items.splice(-1, 1);
					}
				}
			}
		}
		*stream() {
			switch (this.type) {
				case "directive-line":
					yield {
						type: "directive",
						offset: this.offset,
						source: this.source
					};
					return;
				case "byte-order-mark":
				case "space":
				case "comment":
				case "newline":
					yield this.sourceToken;
					return;
				case "doc-mode":
				case "doc-start": {
					const doc = {
						type: "document",
						offset: this.offset,
						start: []
					};
					if (this.type === "doc-start") doc.start.push(this.sourceToken);
					this.stack.push(doc);
					return;
				}
			}
			yield {
				type: "error",
				offset: this.offset,
				message: `Unexpected ${this.type} token in YAML stream`,
				source: this.source
			};
		}
		*document(doc) {
			if (doc.value) return yield* this.lineEnd(doc);
			switch (this.type) {
				case "doc-start":
					if (findNonEmptyIndex(doc.start) !== -1) {
						yield* this.pop();
						yield* this.step();
					} else doc.start.push(this.sourceToken);
					return;
				case "anchor":
				case "tag":
				case "space":
				case "comment":
				case "newline":
					doc.start.push(this.sourceToken);
					return;
			}
			const bv = this.startBlockValue(doc);
			if (bv) this.stack.push(bv);
			else yield {
				type: "error",
				offset: this.offset,
				message: `Unexpected ${this.type} token in YAML document`,
				source: this.source
			};
		}
		*scalar(scalar) {
			if (this.type === "map-value-ind") {
				const start = getFirstKeyStartProps(getPrevProps(this.peek(2)));
				let sep;
				if (scalar.end) {
					sep = scalar.end;
					sep.push(this.sourceToken);
					delete scalar.end;
				} else sep = [this.sourceToken];
				const map$6 = {
					type: "block-map",
					offset: scalar.offset,
					indent: scalar.indent,
					items: [{
						start,
						key: scalar,
						sep
					}]
				};
				this.onKeyLine = true;
				this.stack[this.stack.length - 1] = map$6;
			} else yield* this.lineEnd(scalar);
		}
		*blockScalar(scalar) {
			switch (this.type) {
				case "space":
				case "comment":
				case "newline":
					scalar.props.push(this.sourceToken);
					return;
				case "scalar":
					scalar.source = this.source;
					this.atNewLine = true;
					this.indent = 0;
					if (this.onNewLine) {
						let nl = this.source.indexOf("\n") + 1;
						while (nl !== 0) {
							this.onNewLine(this.offset + nl);
							nl = this.source.indexOf("\n", nl) + 1;
						}
					}
					yield* this.pop();
					break;
				default:
					yield* this.pop();
					yield* this.step();
			}
		}
		*blockMap(map$6) {
			const it = map$6.items[map$6.items.length - 1];
			switch (this.type) {
				case "newline":
					this.onKeyLine = false;
					if (it.value) {
						const end = "end" in it.value ? it.value.end : void 0;
						if ((Array.isArray(end) ? end[end.length - 1] : void 0)?.type === "comment") end?.push(this.sourceToken);
						else map$6.items.push({ start: [this.sourceToken] });
					} else if (it.sep) it.sep.push(this.sourceToken);
					else it.start.push(this.sourceToken);
					return;
				case "space":
				case "comment":
					if (it.value) map$6.items.push({ start: [this.sourceToken] });
					else if (it.sep) it.sep.push(this.sourceToken);
					else {
						if (this.atIndentedComment(it.start, map$6.indent)) {
							const end = map$6.items[map$6.items.length - 2]?.value?.end;
							if (Array.isArray(end)) {
								arrayPushArray(end, it.start);
								end.push(this.sourceToken);
								map$6.items.pop();
								return;
							}
						}
						it.start.push(this.sourceToken);
					}
					return;
			}
			if (this.indent >= map$6.indent) {
				const atMapIndent = !this.onKeyLine && this.indent === map$6.indent;
				const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
				let start = [];
				if (atNextItem && it.sep && !it.value) {
					const nl = [];
					for (let i = 0; i < it.sep.length; ++i) {
						const st = it.sep[i];
						switch (st.type) {
							case "newline":
								nl.push(i);
								break;
							case "space": break;
							case "comment":
								if (st.indent > map$6.indent) nl.length = 0;
								break;
							default: nl.length = 0;
						}
					}
					if (nl.length >= 2) start = it.sep.splice(nl[1]);
				}
				switch (this.type) {
					case "anchor":
					case "tag":
						if (atNextItem || it.value) {
							start.push(this.sourceToken);
							map$6.items.push({ start });
							this.onKeyLine = true;
						} else if (it.sep) it.sep.push(this.sourceToken);
						else it.start.push(this.sourceToken);
						return;
					case "explicit-key-ind":
						if (!it.sep && !it.explicitKey) {
							it.start.push(this.sourceToken);
							it.explicitKey = true;
						} else if (atNextItem || it.value) {
							start.push(this.sourceToken);
							map$6.items.push({
								start,
								explicitKey: true
							});
						} else this.stack.push({
							type: "block-map",
							offset: this.offset,
							indent: this.indent,
							items: [{
								start: [this.sourceToken],
								explicitKey: true
							}]
						});
						this.onKeyLine = true;
						return;
					case "map-value-ind":
						if (it.explicitKey) if (!it.sep) if (includesToken(it.start, "newline")) Object.assign(it, {
							key: null,
							sep: [this.sourceToken]
						});
						else {
							const start$1 = getFirstKeyStartProps(it.start);
							this.stack.push({
								type: "block-map",
								offset: this.offset,
								indent: this.indent,
								items: [{
									start: start$1,
									key: null,
									sep: [this.sourceToken]
								}]
							});
						}
						else if (it.value) map$6.items.push({
							start: [],
							key: null,
							sep: [this.sourceToken]
						});
						else if (includesToken(it.sep, "map-value-ind")) this.stack.push({
							type: "block-map",
							offset: this.offset,
							indent: this.indent,
							items: [{
								start,
								key: null,
								sep: [this.sourceToken]
							}]
						});
						else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
							const start$1 = getFirstKeyStartProps(it.start);
							const key = it.key;
							const sep = it.sep;
							sep.push(this.sourceToken);
							delete it.key;
							delete it.sep;
							this.stack.push({
								type: "block-map",
								offset: this.offset,
								indent: this.indent,
								items: [{
									start: start$1,
									key,
									sep
								}]
							});
						} else if (start.length > 0) it.sep = it.sep.concat(start, this.sourceToken);
						else it.sep.push(this.sourceToken);
						else if (!it.sep) Object.assign(it, {
							key: null,
							sep: [this.sourceToken]
						});
						else if (it.value || atNextItem) map$6.items.push({
							start,
							key: null,
							sep: [this.sourceToken]
						});
						else if (includesToken(it.sep, "map-value-ind")) this.stack.push({
							type: "block-map",
							offset: this.offset,
							indent: this.indent,
							items: [{
								start: [],
								key: null,
								sep: [this.sourceToken]
							}]
						});
						else it.sep.push(this.sourceToken);
						this.onKeyLine = true;
						return;
					case "alias":
					case "scalar":
					case "single-quoted-scalar":
					case "double-quoted-scalar": {
						const fs = this.flowScalar(this.type);
						if (atNextItem || it.value) {
							map$6.items.push({
								start,
								key: fs,
								sep: []
							});
							this.onKeyLine = true;
						} else if (it.sep) this.stack.push(fs);
						else {
							Object.assign(it, {
								key: fs,
								sep: []
							});
							this.onKeyLine = true;
						}
						return;
					}
					default: {
						const bv = this.startBlockValue(map$6);
						if (bv) {
							if (bv.type === "block-seq") {
								if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
									yield* this.pop({
										type: "error",
										offset: this.offset,
										message: "Unexpected block-seq-ind on same line with key",
										source: this.source
									});
									return;
								}
							} else if (atMapIndent) map$6.items.push({ start });
							this.stack.push(bv);
							return;
						}
					}
				}
			}
			yield* this.pop();
			yield* this.step();
		}
		*blockSequence(seq$6) {
			const it = seq$6.items[seq$6.items.length - 1];
			switch (this.type) {
				case "newline":
					if (it.value) {
						const end = "end" in it.value ? it.value.end : void 0;
						if ((Array.isArray(end) ? end[end.length - 1] : void 0)?.type === "comment") end?.push(this.sourceToken);
						else seq$6.items.push({ start: [this.sourceToken] });
					} else it.start.push(this.sourceToken);
					return;
				case "space":
				case "comment":
					if (it.value) seq$6.items.push({ start: [this.sourceToken] });
					else {
						if (this.atIndentedComment(it.start, seq$6.indent)) {
							const end = seq$6.items[seq$6.items.length - 2]?.value?.end;
							if (Array.isArray(end)) {
								arrayPushArray(end, it.start);
								end.push(this.sourceToken);
								seq$6.items.pop();
								return;
							}
						}
						it.start.push(this.sourceToken);
					}
					return;
				case "anchor":
				case "tag":
					if (it.value || this.indent <= seq$6.indent) break;
					it.start.push(this.sourceToken);
					return;
				case "seq-item-ind":
					if (this.indent !== seq$6.indent) break;
					if (it.value || includesToken(it.start, "seq-item-ind")) seq$6.items.push({ start: [this.sourceToken] });
					else it.start.push(this.sourceToken);
					return;
			}
			if (this.indent > seq$6.indent) {
				const bv = this.startBlockValue(seq$6);
				if (bv) {
					this.stack.push(bv);
					return;
				}
			}
			yield* this.pop();
			yield* this.step();
		}
		*flowCollection(fc) {
			const it = fc.items[fc.items.length - 1];
			if (this.type === "flow-error-end") {
				let top;
				do {
					yield* this.pop();
					top = this.peek(1);
				} while (top?.type === "flow-collection");
			} else if (fc.end.length === 0) {
				switch (this.type) {
					case "comma":
					case "explicit-key-ind":
						if (!it || it.sep) fc.items.push({ start: [this.sourceToken] });
						else it.start.push(this.sourceToken);
						return;
					case "map-value-ind":
						if (!it || it.value) fc.items.push({
							start: [],
							key: null,
							sep: [this.sourceToken]
						});
						else if (it.sep) it.sep.push(this.sourceToken);
						else Object.assign(it, {
							key: null,
							sep: [this.sourceToken]
						});
						return;
					case "space":
					case "comment":
					case "newline":
					case "anchor":
					case "tag":
						if (!it || it.value) fc.items.push({ start: [this.sourceToken] });
						else if (it.sep) it.sep.push(this.sourceToken);
						else it.start.push(this.sourceToken);
						return;
					case "alias":
					case "scalar":
					case "single-quoted-scalar":
					case "double-quoted-scalar": {
						const fs = this.flowScalar(this.type);
						if (!it || it.value) fc.items.push({
							start: [],
							key: fs,
							sep: []
						});
						else if (it.sep) this.stack.push(fs);
						else Object.assign(it, {
							key: fs,
							sep: []
						});
						return;
					}
					case "flow-map-end":
					case "flow-seq-end":
						fc.end.push(this.sourceToken);
						return;
				}
				const bv = this.startBlockValue(fc);
				/* istanbul ignore else should not happen */
				if (bv) this.stack.push(bv);
				else {
					yield* this.pop();
					yield* this.step();
				}
			} else {
				const parent = this.peek(2);
				if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
					yield* this.pop();
					yield* this.step();
				} else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
					const start = getFirstKeyStartProps(getPrevProps(parent));
					fixFlowSeqItems(fc);
					const sep = fc.end.splice(1, fc.end.length);
					sep.push(this.sourceToken);
					const map$6 = {
						type: "block-map",
						offset: fc.offset,
						indent: fc.indent,
						items: [{
							start,
							key: fc,
							sep
						}]
					};
					this.onKeyLine = true;
					this.stack[this.stack.length - 1] = map$6;
				} else yield* this.lineEnd(fc);
			}
		}
		flowScalar(type) {
			if (this.onNewLine) {
				let nl = this.source.indexOf("\n") + 1;
				while (nl !== 0) {
					this.onNewLine(this.offset + nl);
					nl = this.source.indexOf("\n", nl) + 1;
				}
			}
			return {
				type,
				offset: this.offset,
				indent: this.indent,
				source: this.source
			};
		}
		startBlockValue(parent) {
			switch (this.type) {
				case "alias":
				case "scalar":
				case "single-quoted-scalar":
				case "double-quoted-scalar": return this.flowScalar(this.type);
				case "block-scalar-header": return {
					type: "block-scalar",
					offset: this.offset,
					indent: this.indent,
					props: [this.sourceToken],
					source: ""
				};
				case "flow-map-start":
				case "flow-seq-start": return {
					type: "flow-collection",
					offset: this.offset,
					indent: this.indent,
					start: this.sourceToken,
					items: [],
					end: []
				};
				case "seq-item-ind": return {
					type: "block-seq",
					offset: this.offset,
					indent: this.indent,
					items: [{ start: [this.sourceToken] }]
				};
				case "explicit-key-ind": {
					this.onKeyLine = true;
					const start = getFirstKeyStartProps(getPrevProps(parent));
					start.push(this.sourceToken);
					return {
						type: "block-map",
						offset: this.offset,
						indent: this.indent,
						items: [{
							start,
							explicitKey: true
						}]
					};
				}
				case "map-value-ind": {
					this.onKeyLine = true;
					const start = getFirstKeyStartProps(getPrevProps(parent));
					return {
						type: "block-map",
						offset: this.offset,
						indent: this.indent,
						items: [{
							start,
							key: null,
							sep: [this.sourceToken]
						}]
					};
				}
			}
			return null;
		}
		atIndentedComment(start, indent) {
			if (this.type !== "comment") return false;
			if (this.indent <= indent) return false;
			return start.every((st) => st.type === "newline" || st.type === "space");
		}
		*documentEnd(docEnd) {
			if (this.type !== "doc-mode") {
				if (docEnd.end) docEnd.end.push(this.sourceToken);
				else docEnd.end = [this.sourceToken];
				if (this.type === "newline") yield* this.pop();
			}
		}
		*lineEnd(token) {
			switch (this.type) {
				case "comma":
				case "doc-start":
				case "doc-end":
				case "flow-seq-end":
				case "flow-map-end":
				case "map-value-ind":
					yield* this.pop();
					yield* this.step();
					break;
				case "newline": this.onKeyLine = false;
				case "space":
				case "comment":
				default:
					if (token.end) token.end.push(this.sourceToken);
					else token.end = [this.sourceToken];
					if (this.type === "newline") yield* this.pop();
			}
		}
	};
	exports.Parser = Parser;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/public-api.js
var require_public_api = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/public-api.js": ((exports) => {
	var composer$1 = require_composer();
	var Document$1 = require_Document();
	var errors$1 = require_errors();
	var log = require_log();
	var identity$1 = require_identity();
	var lineCounter$1 = require_line_counter();
	var parser$1 = require_parser();
	function parseOptions(options) {
		const prettyErrors = options.prettyErrors !== false;
		return {
			lineCounter: options.lineCounter || prettyErrors && new lineCounter$1.LineCounter() || null,
			prettyErrors
		};
	}
	/**
	* Parse the input as a stream of YAML documents.
	*
	* Documents should be separated from each other by `...` or `---` marker lines.
	*
	* @returns If an empty `docs` array is returned, it will be of type
	*   EmptyStream and contain additional stream information. In
	*   TypeScript, you should use `'empty' in docs` as a type guard for it.
	*/
	function parseAllDocuments(source, options = {}) {
		const { lineCounter: lineCounter$2, prettyErrors } = parseOptions(options);
		const parser$1$1 = new parser$1.Parser(lineCounter$2?.addNewLine);
		const composer$1$1 = new composer$1.Composer(options);
		const docs = Array.from(composer$1$1.compose(parser$1$1.parse(source)));
		if (prettyErrors && lineCounter$2) for (const doc of docs) {
			doc.errors.forEach(errors$1.prettifyError(source, lineCounter$2));
			doc.warnings.forEach(errors$1.prettifyError(source, lineCounter$2));
		}
		if (docs.length > 0) return docs;
		return Object.assign([], { empty: true }, composer$1$1.streamInfo());
	}
	/** Parse an input string into a single YAML.Document */
	function parseDocument(source, options = {}) {
		const { lineCounter: lineCounter$2, prettyErrors } = parseOptions(options);
		const parser$1$1 = new parser$1.Parser(lineCounter$2?.addNewLine);
		const composer$1$1 = new composer$1.Composer(options);
		let doc = null;
		for (const _doc of composer$1$1.compose(parser$1$1.parse(source), true, source.length)) if (!doc) doc = _doc;
		else if (doc.options.logLevel !== "silent") {
			doc.errors.push(new errors$1.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
			break;
		}
		if (prettyErrors && lineCounter$2) {
			doc.errors.forEach(errors$1.prettifyError(source, lineCounter$2));
			doc.warnings.forEach(errors$1.prettifyError(source, lineCounter$2));
		}
		return doc;
	}
	function parse$1(src, reviver, options) {
		let _reviver = void 0;
		if (typeof reviver === "function") _reviver = reviver;
		else if (options === void 0 && reviver && typeof reviver === "object") options = reviver;
		const doc = parseDocument(src, options);
		if (!doc) return null;
		doc.warnings.forEach((warning) => log.warn(doc.options.logLevel, warning));
		if (doc.errors.length > 0) if (doc.options.logLevel !== "silent") throw doc.errors[0];
		else doc.errors = [];
		return doc.toJS(Object.assign({ reviver: _reviver }, options));
	}
	function stringify(value, replacer, options) {
		let _replacer = null;
		if (typeof replacer === "function" || Array.isArray(replacer)) _replacer = replacer;
		else if (options === void 0 && replacer) options = replacer;
		if (typeof options === "string") options = options.length;
		if (typeof options === "number") {
			const indent = Math.round(options);
			options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
		}
		if (value === void 0) {
			const { keepUndefined } = options ?? replacer ?? {};
			if (!keepUndefined) return void 0;
		}
		if (identity$1.isDocument(value) && !_replacer) return value.toString(options);
		return new Document$1.Document(value, _replacer, options).toString(options);
	}
	exports.parse = parse$1;
	exports.parseAllDocuments = parseAllDocuments;
	exports.parseDocument = parseDocument;
	exports.stringify = stringify;
}) });

//#endregion
//#region node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/index.js
var require_dist = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/index.js": ((exports) => {
	var composer = require_composer();
	var Document = require_Document();
	var Schema = require_Schema();
	var errors = require_errors();
	var Alias = require_Alias();
	var identity = require_identity();
	var Pair = require_Pair();
	var Scalar = require_Scalar();
	var YAMLMap = require_YAMLMap();
	var YAMLSeq = require_YAMLSeq();
	var cst = require_cst();
	var lexer = require_lexer();
	var lineCounter = require_line_counter();
	var parser = require_parser();
	var publicApi = require_public_api();
	var visit = require_visit();
	exports.Composer = composer.Composer;
	exports.Document = Document.Document;
	exports.Schema = Schema.Schema;
	exports.YAMLError = errors.YAMLError;
	exports.YAMLParseError = errors.YAMLParseError;
	exports.YAMLWarning = errors.YAMLWarning;
	exports.Alias = Alias.Alias;
	exports.isAlias = identity.isAlias;
	exports.isCollection = identity.isCollection;
	exports.isDocument = identity.isDocument;
	exports.isMap = identity.isMap;
	exports.isNode = identity.isNode;
	exports.isPair = identity.isPair;
	exports.isScalar = identity.isScalar;
	exports.isSeq = identity.isSeq;
	exports.Pair = Pair.Pair;
	exports.Scalar = Scalar.Scalar;
	exports.YAMLMap = YAMLMap.YAMLMap;
	exports.YAMLSeq = YAMLSeq.YAMLSeq;
	exports.Lexer = lexer.Lexer;
	exports.LineCounter = lineCounter.LineCounter;
	exports.Parser = parser.Parser;
	exports.parse = publicApi.parse;
	exports.parseAllDocuments = publicApi.parseAllDocuments;
	exports.parseDocument = publicApi.parseDocument;
	exports.stringify = publicApi.stringify;
	exports.visit = visit.visit;
	exports.visitAsync = visit.visitAsync;
}) });

//#endregion
//#region src/host/settings-schema.ts
var import_dist = /* @__PURE__ */ __toESM(require_dist(), 1);
/**
* The plugin's own Config schema — and the reason this file exists at all.
*
* dsh ≤ 0.1.6 stored this plugin's data in a settings namespace addressed by a
* literal name: the plugin called `settings.register('capability-panel', schema)`
* and the settings service owned both the storage and the shape. The 0.1.7
* settings rewrite deleted `register` outright. Values now live on the plugin
* entry's OWN Config, reads come from `describe()` descriptors derived from that
* schema, and writes go through `replace(entryId, section)`.
*
* The consequence is that the namespace is no longer a string this plugin
* chooses: it is the profile entry id, and the entry is configurable ONLY when
* its Config declares at least one volatile field — `volatileForm` otherwise
* returns undefined and a write refuses with "has no volatile fields". A plugin
* with no Config is invisible to the settings surface, which is exactly the
* breakage this file repairs.
*
* Marking the three FIELDS volatile (rather than the root object) is the shape
* the form model requires, for two independent reasons:
*  - A volatile field nested beneath an enclosing volatile field is rejected
*    outright ("volatile fields require a fixed object path without an enclosing
*    volatile field"), so the two styles cannot be mixed.
*  - A root-volatile schema collapses the whole config into one live form. This
*    Config is the plugin's entire persisted surface, so from 0.1.7 it is also
*    the only place a future non-live (restart-guarded) setting could live;
*    keeping the volatile marker on the data fields preserves that room.
* Field-level marking also matches the first-party idiom
* (`dsh-permission-presets`, `dsh-agent-preset-registry`).
*
* `presets`, `presetSkills` and `sessions` stay dynamic-keyed maps: their keys
* are user-chosen preset and session ids. `isVolatilePath` short-circuits on a
* volatile ancestor, so a write may address any key beneath them.
*
* The marker is applied with `.extra('volatile', true)` rather than `.volatile()`
* on purpose. Both emit the same `meta.volatile` and, on a copy that implements
* it, the same live reference wrapping — but `.volatile()` only exists from
* schemastery 3.18.4, so a host resolving an older copy would throw a TypeError
* while merely LOADING this module. `.extra()` is present in every supported
* version, so an older host degrades to metadata it ignores instead of failing
* to start. (The repo's own dependency is pinned to 3.18.4, matching the
* `~3.18.4` peer that dsh-settings 0.1.7 declares.) This is also why the field
* type stays a plain schema: `.extra()` does not widen it to `Volatile<T>`.
*/
const volatileField = (schema$6) => schema$6.extra("volatile", true);
const SessionOverrideSchema = z.object({
	skills: z.dict(z.boolean()).default({}),
	mcpServers: z.dict(z.boolean()).default({}),
	mcpTools: z.dict(z.boolean()).default({}),
	systemTools: z.dict(z.boolean()).default({})
});
/**
* This plugin's Config: the live half of its persisted state.
*
* Every field carries a `.default({})`, so a profile that has never stored
* anything still resolves all three keys. That matters because `describe()`'s
* `value` is projected from the resolved config: without defaults a fresh
* install would surface `undefined` for each key and every reader would have to
* guard, while with them the access layer can hand back a complete section.
*/
const ToolkitSettingsSchema = z.object({
	presets: volatileField(z.dict(z.array(z.string())).default({})),
	presetSkills: volatileField(z.dict(z.array(z.string())).default({})),
	sessions: volatileField(z.dict(SessionOverrideSchema).default({}))
});
/**
* A schema-free stand-in for the legacy `register` path.
*
* dsh ≤ 0.1.6 takes the schema as `unknown` and validates against it, so the
* same shape works there; but volatile metadata is meaningless to that service,
* and annotating this as `unknown` keeps the non-portable declaration type that
* `z.object` infers out of this module's public surface.
*/
const ToolkitSettingsSchemaShape = z.object({
	presets: z.dict(z.array(z.string())).default({}),
	presetSkills: z.dict(z.array(z.string())).default({}),
	sessions: z.dict(SessionOverrideSchema).default({})
});
/** Fill in the schema defaults, so no reader has to guard three maps. */
function normalizeToolkitSettings(value) {
	const section = value ?? {};
	return {
		presets: section.presets ?? {},
		presetSkills: section.presetSkills ?? {},
		sessions: section.sessions ?? {}
	};
}

//#endregion
//#region src/host/settings-scope.ts
const TOOLKIT_SETTINGS_NAMESPACE = "capability-panel";
/**
* Resolve the namespace this plugin's data lives under.
*
* dsh ≤ 0.1.6 addressed settings by a literal name, so `capability-panel` was
* the whole answer. 0.1.7 re-keyed every configurable namespace to the PROFILE
* ENTRY ID, and the settings service looks entries up by exactly that id — so
* asking for the literal would miss whenever a profile mounts this bundle under
* a different row id. The id is read from this plugin's own fiber, which is only
* absent when the plugin was mounted without the Loader (a bare `ctx.plugin`
* call); the historical literal is the graceful fallback, and it is also what
* this repo's own bundle patch inserts, so the common case resolves either way.
*/
function entryNamespace(ctx) {
	const id = ctx.fiber?.entry?.options?.id;
	return typeof id === "string" && id !== "" ? id : TOOLKIT_SETTINGS_NAMESPACE;
}
/**
* Build the read/write pair off whichever settings API the live service offers.
*
* dsh ≤ 0.1.6 exposed `register(ns, schema)` returning a scope with
* get/replace. The 0.1.7 forms rewrite dropped `register` entirely: values now
* live on the plugin entry's own Config (volatile fields), reads come through
* `describe()` descriptors, and writes go through `replace(ns, section)` —
* which resets every live field before applying the section, so passing the
* complete three-key section is exactly what that verb expects. The caller
* caches the pair against the service instance; a replaced service rebinds.
*/
function bindSection(settings, namespace) {
	if (settings === null || typeof settings !== "object") return void 0;
	const host = settings;
	if (typeof host.register === "function") {
		let scope;
		const bind = () => scope ??= host.register(namespace, ToolkitSettingsSchemaShape, { applies: "live" });
		return {
			read: () => normalizeToolkitSettings(bind().get()),
			write: (section) => bind().replace(section)
		};
	}
	if (typeof host.describe === "function" && typeof host.replace === "function") {
		const read = () => {
			for (const descriptor of host.describe()) {
				if (descriptor.ns !== namespace) continue;
				return normalizeToolkitSettings(descriptor.value);
			}
			throw new Error(`settings entry "${namespace}" is not configurable`);
		};
		return {
			read,
			write: (section) => host.replace(namespace, section)
		};
	}
}
function createToolkitSettingsAccess(ctx) {
	let writeQueue = Promise.resolve();
	let cachedService;
	let cachedPair;
	return {
		scope() {
			const settings = ctx.get("settings", false);
			if (settings === void 0) return void 0;
			if (settings !== cachedService || cachedPair === void 0) {
				cachedService = settings;
				cachedPair = bindSection(settings, entryNamespace(ctx));
			}
			if (cachedPair === void 0) return void 0;
			return {
				get: cachedPair.read,
				replace: cachedPair.write
			};
		},
		serialize(work) {
			const next = writeQueue.then(work, work);
			writeQueue = next.then(() => void 0, () => void 0);
			return next;
		}
	};
}

//#endregion
//#region src/host/legacy-import.ts
/** `$DSH_HOME` 解析，与 stats-store 保持同一惯例。 */
function legacySettingsDir(environment = process.env, home = homedir()) {
	return environment["DSH_HOME"] ?? join(home, ".dsh");
}
/**
* 从 `.imported` 文档里读出本插件的遗留分节。
*
* 任何一步不符预期都返回 undefined 而不是抛出：这是恢复路径，不是配置加载，
* 一个损坏或陌生的文件绝不能影响插件激活。0.1.6 时代分节按注册命名空间
* （字面量 `capability-panel`）存储，与 profile 条目 id 无关，所以这里只按
* 字面量查找。
*/
function readLegacyToolkitSection(file) {
	let text;
	try {
		text = readFileSync(file, "utf8");
	} catch {
		return;
	}
	let parsed;
	try {
		parsed = (0, import_dist.parse)(text);
	} catch {
		return;
	}
	if (parsed === null || typeof parsed !== "object") return void 0;
	const section = parsed[TOOLKIT_SETTINGS_NAMESPACE];
	if (section === null || typeof section !== "object") return void 0;
	return normalizeToolkitSettings(section);
}
function isEmptySection(section) {
	return Object.keys(section.presets).length === 0 && Object.keys(section.presetSkills).length === 0 && Object.keys(section.sessions).length === 0;
}
/**
* 执行一次恢复尝试。除 'seeded' 外的返回值都是安全跳过；唯一会真正写入的
* 情况是：宿主的迁移器已经跑过（无 settings.yaml）、`.imported` 里有我们的
* 分节、当前存储完全为空（绝不覆盖更新后的数据）、且遗留分节本身非空。
*/
async function recoverLegacyToolkitSection(access, isDisposed, environment = process.env) {
	if (isDisposed()) return "skipped:disposed";
	const dir = legacySettingsDir(environment);
	if (existsSync(join(dir, "settings.yaml"))) return "skipped:active-document-present";
	const legacy = readLegacyToolkitSection(join(dir, "settings.yaml.imported"));
	if (legacy === void 0) return "skipped:no-imported-section";
	if (isEmptySection(legacy)) return "skipped:legacy-section-empty";
	const scope = access.scope();
	if (scope === void 0) return "skipped:no-scope";
	if (!isEmptySection(scope.get())) return "skipped:section-not-empty";
	try {
		await scope.replace(legacy);
	} catch {
		return "skipped:write-failed";
	}
	return "seeded";
}
/**
* 编排恢复：等 Loader 初次装载落定（与 dsh-settings 导入遗留文档用的是同一个
* 信号）再执行，保证我们的条目已激活、settings 服务已发布。没有 loader.await
* 的宿主直接执行。整个过程 fire-and-forget，所有失败都在 recover 内部降级。
*/
function scheduleLegacyRecovery(ctx, access) {
	let disposed = false;
	ctx.effect(() => () => {
		disposed = true;
	}, "capability-panel: legacy settings recovery (temporary)");
	const loader = ctx.get("loader", false);
	(typeof loader?.await === "function" ? loader.await() : Promise.resolve()).then(() => recoverLegacyToolkitSection(access, () => disposed), () => recoverLegacyToolkitSection(access, () => disposed));
}

//#endregion
//#region src/host/preset-enforcement.ts
/**
* Applies stored capability positions to freshly created agents, in two
* layers: the preset's stored defaults first, then the session's own recorded
* toggles. The second layer is what survives a restart — a restored session
* creates a new agent, and its session-bound overrides land on top of the
* preset defaults, so the user's last word wins (including an explicit
* re-enable of a preset default).
*
* This is deliberately NOT part of the HTTP controller: the listener has no
* request, and living next to one is how it grew a settings schema, a write
* queue, and two event subscriptions in a single file. Here it owns exactly
* one job -- at agent/created, read both stored layers and seed them into the
* session's capability state.
*
* Seeding into the session state (rather than registering private masks) is
* the point: the session panel's enable path disposes whatever the state
* holds, whichever layer put it there, so a stored position remains a
* starting point the user can flip in the session instead of an invisible
* wall. Session overrides are keyed by session id, so one session's switches
* can never leak into another.
*/
function registerPresetEnforcement(ctx, capabilities, presetTools, sessionOverrides) {
	/**
	* Subscribe to `agent/created` so that NOTHING this plugin does can veto the
	* agent. Cordis treats a synchronous listener failure as a veto and only
	* reports a rejected promise, so both halves are contained: the synchronous
	* prelude (reading settings, resolving services) is wrapped here, and the
	* asynchronous body reports through the returned promise. Applying a stored
	* preference is never worth costing the user their session.
	*/
	ctx.on("agent/created", ({ agent }) => {
		try {
			if (typeof agent.id !== "string") return void 0;
			const sessionId = agent.id;
			const presetId = ctx.get("agentPresets", false)?.composedPreset(agent.ctx);
			const defaults = presetId === void 0 ? void 0 : presetTools.defaultsFor(presetId);
			const hasDefaults = defaults !== void 0 && (defaults.tools.length > 0 || defaults.skills.length > 0);
			const overrides = sessionOverrides.overridesFor(sessionId);
			if (!hasDefaults && overrides === void 0) return void 0;
			return (async () => {
				if (hasDefaults && defaults !== void 0) await capabilities.seed(sessionId, defaults);
				if (overrides !== void 0) await capabilities.restore(sessionId, overrides);
			})();
		} catch {
			return;
		}
	});
	/**
	* A preset switch lands AFTER creation (the session header records the
	* composing preset at creation, and the picker's select() recomposes the
	* blank session later): the first agent/created seeded the ORIGINAL
	* preset's defaults, so the new preset's defaults must re-seed on top of a
	* clean slate. Session overrides replay last — the user's own switches in
	* this session outrank either preset's defaults.
	*/
	ctx.on("agent-preset/selected", (sessionId, presetId) => {
		try {
			if (typeof sessionId !== "string" || typeof presetId !== "string") return void 0;
			const defaults = presetTools.defaultsFor(presetId) ?? {
				tools: [],
				skills: []
			};
			const overrides = sessionOverrides.overridesFor(sessionId);
			return capabilities.reseed(sessionId, defaults, overrides);
		} catch {
			return;
		}
	});
	/**
	* Re-mask when the tool registry changes. seed() can only mask names that
	* are registered at that moment (tools.restrict refuses unknown names), so
	* an on-demand MCP server that connects AFTER the session was created would
	* otherwise arrive with every tool enabled, preset default or not. The
	* registry broadcasts every layer change through this event — late
	* registration, a reconnect's fresh generation, a teardown — and remask is
	* idempotent over names already masked.
	*
	* The guard breaks the echo loop: our own restrict() calls re-emit
	* tools/change, and without it every mask write would schedule another
	* sweep. A change arriving mid-sweep is not lost, though: it is marked
	* pending and one trailing sweep runs when the current one settles, so an
	* external registration landing while a session's slow queue is still
	* processing does not leave stale masks behind.
	*/
	let remasking = false;
	let pendingSweep = false;
	ctx.on("tools/change", () => {
		if (remasking) {
			pendingSweep = true;
			return;
		}
		try {
			const agents = ctx.get("agents", false);
			if (agents === void 0 || typeof agents.list !== "function") return void 0;
			return (async () => {
				do {
					remasking = true;
					pendingSweep = false;
					try {
						let live;
						try {
							live = agents.list();
						} catch {
							return;
						}
						for (const agent of live) try {
							const sessionId = agent?.id;
							if (typeof sessionId !== "string") continue;
							const presetId = ctx.get("agentPresets", false)?.composedPreset(agent.ctx);
							const defaults = presetId === void 0 ? void 0 : presetTools.defaultsFor(presetId);
							const overrides = sessionOverrides.overridesFor(sessionId);
							const hasToolDefaults = defaults !== void 0 && defaults.tools.length > 0;
							const hasToolOverrides = overrides !== void 0 && (Object.keys(overrides.mcpServers).length > 0 || Object.keys(overrides.mcpTools).length > 0 || Object.keys(overrides.systemTools).length > 0);
							if (!hasToolDefaults && !hasToolOverrides) continue;
							await capabilities.remask(sessionId, defaults ?? {
								tools: [],
								skills: []
							}, overrides);
						} catch {}
					} finally {
						remasking = false;
					}
				} while (pendingSweep);
			})();
		} catch {
			return;
		}
	});
}

//#endregion
//#region src/host/mcp-connections.ts
const MCP_CLIENT_NAME = "@deepseek-ai/dsh-mcp-client";
function entryConfig(entry) {
	const config = entry.options?.config;
	if (config === null || typeof config !== "object" || Array.isArray(config)) return void 0;
	return config;
}
function declaredServerName(entry) {
	if (entry.options?.name !== MCP_CLIENT_NAME) return void 0;
	const serverName = entryConfig(entry)?.["serverName"];
	return typeof serverName === "string" && serverName !== "" ? serverName : void 0;
}
/**
* Server names the host composition declares via `@deepseek-ai/dsh-mcp-client`
* entries — connected or not. Matched by plugin name, not by the `serverName`
* key: an unrelated entry carrying a same-named config key is not an MCP
* server.
*/
function readConfiguredMcpServers(ctx) {
	const servers = /* @__PURE__ */ new Set();
	const loader = ctx.get?.("loader", false);
	if (loader === void 0) return servers;
	try {
		for (const entry of loader.entries()) {
			if (entry.disabled === true) continue;
			const name = declaredServerName(entry);
			if (name !== void 0) servers.add(name);
		}
	} catch {}
	return servers;
}
function entryFor(ctx, server) {
	const loader = ctx.get?.("loader", false);
	if (loader === void 0) return void 0;
	try {
		for (const entry of loader.entries()) if (declaredServerName(entry) === server) return entry;
	} catch {
		return;
	}
}
/**
* Reload one declared MCP server's plugin instance: dispose its fiber, then
* refresh the entry — the loader's own hot-swap pair. This is exactly a
* manual HMR reload: it tears down the current connection (and stops its
* reconnect timer) and re-initializes the client, which reconnects and re-syncs
* the whole tool generation.
*
* Honest scope of what this guarantees: only that a fresh connection attempt
* starts NOW instead of waiting out the client's backoff. It does NOT prove
* the server was "down" (the panel cannot observe connection state), and for a
* stdio transport the reload respawns the child process. Registration lands
* asynchronously after refresh resolves; the registry's `tools/change`
* broadcast re-applies stored defaults, so callers need no readiness wait.
*
* Assumes a globally unique serverName: the settings view is host-global, and
* dsh reserves one serverName per global mcp-client instance, so at most one
* entry matches here. Agent-scoped instances may reuse a name across Agents,
* but those are not reachable from this global walk.
*/
async function restartMcpServer(ctx, server) {
	const entry = entryFor(ctx, server);
	if (entry === void 0) throw new HttpError(404, `MCP server "${server}" is not configured on this host`);
	if (entry.disabled === true) throw new HttpError(409, `MCP server "${server}" is disabled in the host composition; enable it there instead of reloading it`);
	await entry._dispose();
	await entry.refresh();
}

//#endregion
//#region src/host/skill-preview.ts
/** The single member used from `@deepseek-ai/dsh-util-workspace-path`. */
function pickFileAddressFor(module) {
	const candidate = module.fileAddressFor;
	return typeof candidate === "function" ? candidate : void 0;
}
let probed = false;
let builder;
/**
* Resolve the Host's address helper once, or `undefined` when this deployment
* has no such export. The probe result is remembered either way: a missing
* package cannot appear later in one process's life.
* @returns the helper, when the running Host ships it.
*/
async function loadFileAddressFor() {
	if (!probed) {
		probed = true;
		try {
			builder = pickFileAddressFor(await import("@deepseek-ai/dsh-util-workspace-path"));
		} catch {
			builder = void 0;
		}
	}
	return builder;
}
/**
* The address that opens `file` in the Host's right-sidebar preview.
* @param forFile - the resolved helper; `undefined` means this Host cannot.
* @param sessionId - the Session whose workspace resolves the path.
* @param cwd - that Session's workspace root, when the Host reported one.
* @param file - the skill's absolute instruction file path.
* @returns the address, or `undefined` when the preview is unavailable.
*/
function previewAddressFor(forFile, sessionId, cwd, file) {
	return forFile === void 0 ? void 0 : forFile(sessionId, cwd, file);
}

//#endregion
//#region src/host/catalog.ts
/** Coerce a skill summary field to a string, falling back when the runtime shape is wrong. */
function coerceString(value, fallback) {
	return typeof value === "string" ? value : fallback;
}
/**
* The source ROOT a skill was discovered under. The skills service reports
* each skill's own directory as resourceBase (`<root>/<name>`), so the group
* folder is its parent.
*/
function parentDir(path) {
	const trimmed = path.replace(/[\\/]+$/, "");
	if (trimmed === "") return "/";
	const slash = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
	return slash > 0 ? trimmed.slice(0, slash) : trimmed;
}
/**
* Abbreviate a host path for display: the session cwd becomes a relative
* path, the user's home becomes `~`. Everything else stays absolute.
*/
function displayPath(path, cwd) {
	if (cwd !== void 0 && cwd !== "" && path.startsWith(`${cwd}/`)) return path.slice(cwd.length + 1);
	const home = process.env["HOME"];
	if (home !== void 0 && home !== "" && (path === home || path.startsWith(`${home}/`))) return `~${path.slice(home.length)}`;
	return path;
}
/** The DSH home, matching the runtime's own resolution order. */
function dshHome() {
	return process.env["DSH_HOME"] ?? (process.env["HOME"] !== void 0 ? `${process.env["HOME"]}/.dsh` : void 0);
}
const EMPTY_STATE = {
	skills: /* @__PURE__ */ new Map(),
	mcpServers: /* @__PURE__ */ new Map(),
	mcpTools: /* @__PURE__ */ new Map(),
	systemTools: /* @__PURE__ */ new Map(),
	userToggled: /* @__PURE__ */ new Set()
};
async function readAvailable(services, sessionId, degraded, presetDirs = []) {
	const skills = services.get("skills");
	if (skills === void 0) {
		degraded.push("skills service unavailable");
		return [];
	}
	try {
		const agents = services.get("agents");
		if (agents === void 0) {
			degraded.push("agents service unavailable: session skill view cannot be determined");
			return [];
		}
		const agent = agents.get(sessionId);
		if (agent === void 0) {
			degraded.push(`session agent "${sessionId}" unavailable: session skill view cannot be determined`);
			return [];
		}
		const cwd = agent.session?.header?.cwd;
		const list = await skills.list({
			...cwd === void 0 ? {} : { cwd },
			scope: agent
		});
		const forFile = await loadFileAddressFor();
		const out = [];
		const seen = /* @__PURE__ */ new Map();
		const groupFor = (source, rawRoot) => {
			if (source !== "custom" || rawRoot === "") return void 0;
			const owner = presetDirs.find((p) => rawRoot === p.path || rawRoot.startsWith(`${p.path}/`));
			return owner === void 0 ? void 0 : `preset:${owner.key}`;
		};
		for (const item of list) {
			if (typeof item.name !== "string" || item.name === "") continue;
			const masked = item.invocation?.modelInvocable === false;
			const source = coerceString(item.source, "unknown");
			const provider = coerceString(item.provider, "unknown");
			const base = item.resourceBase;
			const rawPath = base !== null && typeof base === "object" && base.kind === "directory" ? coerceString(base.path, "") : "";
			const rawRoot = rawPath === "" ? "" : parentDir(rawPath);
			const path = rawRoot === "" ? "" : displayPath(rawRoot, cwd);
			const group = groupFor(source, rawRoot);
			const file = coerceString(item.path, "");
			const fileAddress = file === "" ? void 0 : previewAddressFor(forFile, sessionId, cwd, file);
			const existing = seen.get(item.name);
			if (existing !== void 0) {
				if (masked) existing.masked = true;
				if (existing.provider === "capability-panel" && provider !== "capability-panel") {
					existing.source = source;
					existing.provider = provider;
					if (path !== "") existing.path = path;
					if (fileAddress !== void 0) existing.fileAddress = fileAddress;
					if (group !== void 0) existing.group = group;
				}
				continue;
			}
			const description = typeof item.description === "string" ? item.description : void 0;
			const row = {
				name: item.name,
				...description === void 0 ? {} : { description },
				...masked ? { masked: true } : {},
				source,
				provider,
				...path === "" ? {} : { path },
				...fileAddress === void 0 ? {} : { fileAddress },
				...group === void 0 ? {} : { group }
			};
			seen.set(item.name, row);
			out.push(row);
		}
		return out;
	} catch (error) {
		degraded.push(`skills read failed: ${error instanceof Error ? error.message : String(error)}`);
		return [];
	}
}
/**
* Read load facts off the LIVE session's in-memory log — the same object the
* agent loop itself reads to assemble the next request.
*
* This used to go through `sessionQuery.readSession` + `listEvents`, which are
* built for cross-session/cold reads: each call structuredClones the ENTIRE
* event log, `readSession` additionally replay-validates it via Session.create,
* and a write landing between the two parallel reads forced a whole second
* round. On a long session (60k events / tens of MB) that meant four full-log
* clones plus two full replays of synchronous CPU work on every panel open —
* blocking the Node event loop and freezing the GUI served by the same process.
*
* The live session needs none of that: `snapshotEvents()` hands back borrowed
* references (zero-copy), and `surface.nodes` is maintained incrementally as
* events land, so "what the model sees right now" is an O(1) membership test.
* Scanning references for the few `skill` tool calls costs microseconds even
* on the longest log. Both reads happen in one synchronous tick, so the view
* is always self-consistent — no cross-read race, no retry loop.
*
* A session without a live in-memory view (e.g. restored but not yet attached)
* degrades honestly instead of paying for a cold-log read the panel never
* asked for.
*/
function readLogFacts(services, sessionId, degraded) {
	const empty = {
		loads: [],
		shadowed: /* @__PURE__ */ new Set(),
		pruned: /* @__PURE__ */ new Set()
	};
	try {
		const session = services.get("agents")?.get(sessionId)?.session;
		const nodes = session?.surface?.nodes;
		if (session === void 0 || typeof session.snapshotEvents !== "function" || !Array.isArray(nodes)) {
			degraded.push("live session view unavailable: load states cannot be determined");
			return empty;
		}
		const events = session.snapshotEvents();
		if (!Array.isArray(events)) {
			degraded.push("snapshotEvents() returned an unexpected shape; cannot read skill loads");
			return empty;
		}
		const surfaceSeqs = /* @__PURE__ */ new Set();
		for (const seq$6 of nodes) if (typeof seq$6 === "number") surfaceSeqs.add(seq$6);
		const loads = collectLoadRecords(events);
		const resultSeqs = indexToolResultSeqs(events);
		return {
			loads,
			shadowed: shadowedLoadSeqs(loads, resultSeqs, surfaceSeqs),
			pruned: prunedLoadSeqs(loads, resultSeqs, surfaceSeqs, events)
		};
	} catch (error) {
		degraded.push(`event read failed: ${error instanceof Error ? error.message : String(error)}`);
		return empty;
	}
}
function readMcp(services, degraded, disabledServers, disabledTools, agent, presetName, presetPath, maskedServerNames, presetDisabled) {
	const tools = services.get("tools");
	if (tools === void 0) {
		degraded.push("tools service unavailable");
		return [];
	}
	try {
		const names = [];
		const descriptions = /* @__PURE__ */ new Map();
		const collect = (scope) => {
			for (const schema$6 of tools.schemas(scope)) {
				if (typeof schema$6.name !== "string" || !schema$6.name.startsWith("mcp__")) continue;
				if (!names.includes(schema$6.name)) {
					names.push(schema$6.name);
					if (typeof schema$6.description === "string" && schema$6.description !== "") descriptions.set(schema$6.name, schema$6.description);
				}
			}
		};
		collect(void 0);
		if (agent !== void 0) collect(agent);
		const globalNames = /* @__PURE__ */ new Set();
		for (const schema$6 of tools.schemas()) if (typeof schema$6.name === "string" && schema$6.name.startsWith("mcp__")) globalNames.add(schema$6.name);
		const sessionNames = /* @__PURE__ */ new Set();
		if (agent !== void 0) {
			for (const schema$6 of tools.schemas(agent)) if (typeof schema$6.name === "string" && schema$6.name.startsWith("mcp__")) sessionNames.add(schema$6.name);
		}
		const reachable = (name) => agent === void 0 || sessionNames.has(name);
		const configuredServers = readConfiguredMcpServers(services);
		const groups = groupMcpTools(names).map((group) => {
			const enabled = !disabledServers.has(group.server);
			const entries = group.tools.map((tool) => {
				const name = `mcp__${group.server}__${tool}`;
				const description = descriptions.get(name);
				return {
					name,
					label: tool,
					...description === void 0 ? {} : { description },
					enabled: enabled && !disabledTools.has(name) && reachable(name)
				};
			});
			const allGlobal = group.tools.every((tool) => globalNames.has(`mcp__${group.server}__${tool}`));
			const source = allGlobal ? "host" : presetName ?? "preset";
			const rawPath = allGlobal ? dshHome() : presetPath;
			const defaultDisabled = presetDisabled !== void 0 && group.tools.length > 0 && group.tools.every((tool) => presetDisabled.has(`mcp__${group.server}__${tool}`));
			return {
				server: group.server,
				tools: entries,
				enabled,
				...defaultDisabled ? { defaultDisabled: true } : {},
				...configuredServers.has(group.server) ? { reconnectable: true } : {},
				source,
				...rawPath === void 0 ? {} : { path: displayPath(rawPath) }
			};
		});
		const hostPath = dshHome();
		for (const server of configuredServers) {
			if (groups.some((group) => group.server === server)) continue;
			const prefix = `mcp__${server}__`;
			const roster = maskedServerNames?.get(server) ?? [...disabledTools].filter((name) => name.startsWith(prefix)).sort();
			groups.push({
				server,
				tools: roster.map((name) => ({
					name,
					label: name.slice(prefix.length),
					enabled: false
				})),
				enabled: false,
				unavailable: true,
				reconnectable: true,
				source: "host",
				...hostPath === void 0 ? {} : { path: displayPath(hostPath) }
			});
		}
		groups.sort((a, b) => a.server.localeCompare(b.server));
		return groups;
	} catch (error) {
		degraded.push(`tool read failed: ${error instanceof Error ? error.message : String(error)}`);
		return [];
	}
}
function readSystemTools(services, degraded, disabledTools, agent) {
	const tools = services.get("tools");
	if (tools === void 0) {
		if (!degraded.includes("tools service unavailable")) degraded.push("tools service unavailable");
		return [];
	}
	try {
		let reachable;
		if (agent !== void 0) {
			reachable = /* @__PURE__ */ new Set();
			for (const schema$6 of tools.schemas(agent)) if (typeof schema$6.name === "string") reachable.add(schema$6.name);
		}
		const byName = /* @__PURE__ */ new Map();
		const collect = (scope) => {
			for (const schema$6 of tools.schemas(scope)) {
				if (typeof schema$6.name !== "string" || schema$6.name.startsWith("mcp__") || byName.has(schema$6.name)) continue;
				const description = typeof schema$6.description === "string" && schema$6.description !== "" ? schema$6.description : void 0;
				byName.set(schema$6.name, {
					name: schema$6.name,
					label: schema$6.name,
					...description === void 0 ? {} : { description },
					enabled: !disabledTools.has(schema$6.name) && (reachable === void 0 || reachable.has(schema$6.name)),
					...schema$6.name === RESERVED_TOOL ? { reserved: true } : {}
				});
			}
		};
		collect(void 0);
		if (agent !== void 0) collect(agent);
		return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
	} catch (error) {
		degraded.push(`tool read failed: ${error instanceof Error ? error.message : String(error)}`);
		return [];
	}
}
async function buildPayload(services, sessionId, capabilityState = EMPTY_STATE, blocked = {}, presetDefaults) {
	const degraded = [];
	const disabledSkills = new Set(capabilityState.skills.keys());
	const disabledServers = new Set(capabilityState.mcpServers.keys());
	const disabledTools = new Set(capabilityState.mcpTools.keys());
	const disabledSystem = new Set(capabilityState.systemTools.keys());
	if (sessionId === null) return {
		sessionId: null,
		skills: [],
		mcp: readMcp(services, degraded, disabledServers, disabledTools),
		systemTools: readSystemTools(services, degraded, disabledSystem),
		blocked,
		...degraded.length > 0 ? { degraded } : {}
	};
	const agent = services.get("agents")?.get(sessionId);
	let presetName;
	let presetPath;
	let presetDirs = [];
	let presetDisabled = /* @__PURE__ */ new Set();
	if (agent !== void 0) {
		const presetId = services.get("agentPresets")?.composedPreset(agent.ctx);
		presetDisabled = new Set(presetDefaults?.(presetId ?? "")?.tools ?? []);
		try {
			const presets = await services.get("agentPresets")?.list();
			presetDirs = (presets ?? []).filter((p) => typeof p.path === "string" && p.path !== "").map((p) => ({
				key: p.name ?? p.id,
				path: p.path
			}));
			if (presetId !== void 0) {
				const preset = presets?.find((p) => p.id === presetId);
				presetName = preset?.name ?? presetId;
				presetPath = preset?.path;
			}
		} catch {
			presetName = presetId;
		}
	}
	const available = await readAvailable(services, sessionId, degraded, presetDirs);
	const logFacts = readLogFacts(services, sessionId, degraded);
	return {
		sessionId,
		skills: decideStates(available, logFacts.loads, logFacts.shadowed, disabledSkills, logFacts.pruned),
		mcp: readMcp(services, degraded, disabledServers, disabledTools, agent, presetName, presetPath, new Map([...capabilityState.mcpServers].map(([server, mask]) => [server, mask.names])), presetDisabled),
		systemTools: readSystemTools(services, degraded, disabledSystem, agent),
		blocked,
		...degraded.length > 0 ? { degraded } : {}
	};
}

//#endregion
//#region src/host/preset-tools.ts
function requireService(service, message) {
	if (service === void 0) throw new HttpError(503, message);
	return service;
}
function toolSummaries(tools, scope) {
	const entries = /* @__PURE__ */ new Map();
	for (const schema$6 of tools.schemas(scope)) {
		if (typeof schema$6.name !== "string" || schema$6.name === "" || entries.has(schema$6.name)) continue;
		entries.set(schema$6.name, {
			name: schema$6.name,
			...typeof schema$6.description === "string" ? { description: schema$6.description } : {}
		});
	}
	return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name));
}
/**
* Read the skills one preset can see, marking those that came from the reading
* process's project root.
*
* The panel has no agent and therefore no session cwd, so it reports what THIS
* workspace would contribute. A project skill is marked rather than dropped:
* hiding it would silently shorten the list, while marking it says plainly
* that a session opened elsewhere will not see the row.
*
* Each row also carries the same provenance the session payload reports:
* the raw runtime source, the discovery root (parent of the skill's own
* directory, abbreviated for display), and a `preset:<name>` group when the
* root sits inside a preset's directory.
*/
async function presetSkillRows(skills, scope, disabled, cwd, presetDirs = []) {
	const seen = /* @__PURE__ */ new Map();
	const add = (summaries, project) => {
		for (const summary of summaries) {
			if (typeof summary.name !== "string" || summary.name === "" || seen.has(summary.name)) continue;
			const description = typeof summary.description === "string" ? summary.description : void 0;
			const source = typeof summary.source === "string" ? summary.source : void 0;
			const base = summary.resourceBase;
			const rawPath = base !== null && typeof base === "object" && base.kind === "directory" ? base.path : void 0;
			const rawRoot = typeof rawPath === "string" && rawPath !== "" ? parentDir(rawPath) : "";
			const path = rawRoot === "" ? void 0 : displayPath(rawRoot, cwd);
			const owner = source === "custom" && rawRoot !== "" ? presetDirs.find((p) => rawRoot === p.path || rawRoot.startsWith(`${p.path}/`)) : void 0;
			seen.set(summary.name, {
				name: summary.name,
				...description === void 0 ? {} : { description },
				enabled: !disabled.has(summary.name),
				...project ? { project: true } : {},
				...source === void 0 ? {} : { source },
				...path === void 0 ? {} : { path },
				...owner === void 0 ? {} : { group: `preset:${owner.key}` }
			});
		}
	};
	add(await skills.list({ scope }), false);
	add(await skills.list({
		scope,
		cwd
	}), true);
	return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}
/**
* Read one preset's tool/skill roster through its standing scope, on whichever
* API the live host offers.
*
* dsh ≤ 0.1.6 exposed `standingKeyFor(id)` — a bare key, no lease. The 0.1.7
* registry split replaced it with `acquireScope(id)`, which retains the
* generation and hands back `{ key }` plus async disposal; the lease MUST be
* released or the mount is pinned against collection forever. Probing at call
* time (not composition time) keeps one build working across both shapes, and
* a service offering neither surfaces as the caller's existing 503/degraded
* channel rather than a TypeError.
*/
async function withPresetScope(agentPresets, presetId, read) {
	if (agentPresets.acquireScope !== void 0) {
		const lease = await agentPresets.acquireScope(presetId);
		try {
			return await read(lease.key);
		} finally {
			await lease[Symbol.asyncDispose]();
		}
	}
	if (agentPresets.standingKeyFor !== void 0) return await read(await agentPresets.standingKeyFor(presetId));
	throw new Error("host exposes neither acquireScope nor standingKeyFor");
}
async function presetAndTools(agentPresets, tools, presetId) {
	const preset = (await agentPresets.list()).find((entry) => entry.id === presetId);
	if (preset === void 0) throw new HttpError(404, `preset "${presetId}" is not available`);
	if (preset.broken !== void 0) throw new HttpError(409, `preset "${presetId}" is broken: ${preset.broken}`);
	try {
		return {
			preset,
			tools: await withPresetScope(agentPresets, presetId, (scope) => toolSummaries(tools, scope))
		};
	} catch (error) {
		throw new HttpError(503, `preset "${presetId}" tools are unavailable: ${errorMessage(error)}`);
	}
}
function createPresetToolController(ctx, access) {
	const settingsScope = () => access.scope();
	const services = () => ({
		agentPresets: requireService(ctx.get("agentPresets", false), "agentPresets service unavailable"),
		tools: requireService(ctx.get("tools", false), "tools service unavailable"),
		settings: requireService(settingsScope(), "settings service unavailable")
	});
	const list = async () => {
		const { agentPresets, tools, settings: settingsScope$1 } = services();
		const stored = settingsScope$1.get();
		const configured = stored.presets;
		const skills = ctx.get("skills", false);
		const cwd = process.cwd();
		const presets = await agentPresets.list();
		const presetDirs = presets.filter((p) => typeof p.path === "string" && p.path !== "").map((p) => ({
			key: p.name ?? p.id,
			path: p.path
		}));
		const configuredServers = readConfiguredMcpServers(ctx);
		const globalNames = /* @__PURE__ */ new Set();
		for (const schema$6 of tools.schemas()) if (typeof schema$6.name === "string" && schema$6.name.startsWith("mcp__")) globalNames.add(schema$6.name);
		return {
			presets: await Promise.all(presets.map(async (preset) => {
				let entries = [];
				let skillRows = [];
				let mountError;
				if (preset.broken === void 0) try {
					await withPresetScope(agentPresets, preset.id, async (scope) => {
						entries = toolSummaries(tools, scope);
						if (skills !== void 0) skillRows = await presetSkillRows(skills, scope, new Set(stored.presetSkills[preset.id] ?? []), cwd, presetDirs);
					});
				} catch (error) {
					mountError = errorMessage(error);
				}
				const disabled = new Set(configured[preset.id] ?? []);
				const byName = new Map(entries.map((entry) => [entry.name, entry]));
				const row = (name, label) => {
					const description = byName.get(name)?.description;
					return {
						name,
						label,
						...description === void 0 ? {} : { description },
						enabled: name === RESERVED_TOOL || !disabled.has(name),
						...name === RESERVED_TOOL ? { reserved: true } : {}
					};
				};
				const presetName = preset.name ?? preset.id;
				const mcp = groupMcpTools(entries.map((entry) => entry.name)).map((group) => {
					const tools$1 = group.tools.map((tool) => row(`mcp__${group.server}__${tool}`, tool));
					const allGlobal = group.tools.every((tool) => globalNames.has(`mcp__${group.server}__${tool}`));
					const rawPath = allGlobal ? dshHome() : preset.path;
					return {
						server: group.server,
						tools: tools$1,
						enabled: tools$1.some((tool) => tool.enabled),
						...configuredServers.has(group.server) ? { reconnectable: true } : {},
						source: allGlobal ? "host" : presetName,
						...rawPath === void 0 ? {} : { path: displayPath(rawPath) }
					};
				});
				const hostPath = dshHome();
				for (const server of configuredServers) {
					if (mcp.some((group) => group.server === server)) continue;
					const prefix = `mcp__${server}__`;
					mcp.push({
						server,
						tools: [...disabled].filter((name) => name.startsWith(prefix)).sort().map((name) => row(name, name.slice(prefix.length))),
						enabled: false,
						unavailable: true,
						reconnectable: true,
						source: "host",
						...hostPath === void 0 ? {} : { path: displayPath(hostPath) }
					});
				}
				mcp.sort((a, b) => a.server.localeCompare(b.server));
				const systemTools = entries.filter((entry) => !entry.name.startsWith("mcp__")).map((entry) => row(entry.name, entry.name));
				return {
					id: preset.id,
					name: preset.name ?? preset.id,
					...preset.trust === void 0 ? {} : { trust: preset.trust },
					...preset.description === void 0 ? {} : { description: preset.description },
					...preset.broken !== void 0 ? { broken: preset.broken } : mountError === void 0 ? {} : { broken: `failed to mount: ${mountError}` },
					skills: skillRows,
					mcp,
					systemTools
				};
			})),
			writable: ctx.get("settings", false)?.writable === true
		};
	};
	/** Persist one preset's disabled set for one registry, then re-read. */
	const persist = (presetId, settingsScope$1, disabled, registry = "presets") => access.serialize(async () => {
		const stored = settingsScope$1.get();
		const prune = (map$6) => Object.fromEntries(Object.entries(map$6).filter(([, value]) => value.length > 0));
		const next = prune({
			...stored[registry],
			[presetId]: [...disabled].sort()
		});
		const presets = registry === "presets" ? next : prune(stored.presets);
		const presetSkills = registry === "presetSkills" ? next : prune(stored.presetSkills);
		await settingsScope$1.replace({
			presets,
			presetSkills,
			sessions: stored.sessions
		});
		return list();
	});
	return {
		defaultsFor(presetId) {
			let stored;
			try {
				const settings = settingsScope();
				if (settings === void 0) return void 0;
				stored = settings.get();
			} catch {
				return;
			}
			return {
				tools: (stored.presets[presetId] ?? []).filter((name) => name !== RESERVED_TOOL),
				skills: stored.presetSkills[presetId] ?? []
			};
		},
		list,
		async set(presetId, name, enabled) {
			if (name === RESERVED_TOOL && !enabled) throw new HttpError(409, "run_code is the reserved Code Mode transport and cannot be restricted");
			const { agentPresets, tools, settings: settingsScope$1 } = services();
			const { tools: available } = await presetAndTools(agentPresets, tools, presetId);
			if (!available.some((tool) => tool.name === name)) throw new HttpError(404, `tool "${name}" is not available in preset "${presetId}"`);
			const disabled = new Set(settingsScope$1.get().presets[presetId] ?? []);
			if (enabled) disabled.delete(name);
			else disabled.add(name);
			return persist(presetId, settingsScope$1, disabled);
		},
		async setServer(presetId, server, enabled) {
			const { agentPresets, tools, settings: settingsScope$1 } = services();
			const { tools: available } = await presetAndTools(agentPresets, tools, presetId);
			const prefix = `mcp__${server}__`;
			const names = available.map((tool) => tool.name).filter((name) => name.startsWith(prefix));
			if (names.length === 0) throw new HttpError(404, `MCP server "${server}" is not available in preset "${presetId}"`);
			const disabled = new Set(settingsScope$1.get().presets[presetId] ?? []);
			for (const name of names) if (enabled) disabled.delete(name);
			else disabled.add(name);
			return persist(presetId, settingsScope$1, disabled);
		},
		async setSkill(presetId, name, enabled) {
			const { agentPresets, settings: settingsScope$1 } = services();
			const skills = requireService(ctx.get("skills", false), "skills service unavailable");
			const preset = (await agentPresets.list()).find((entry) => entry.id === presetId);
			if (preset === void 0) throw new HttpError(404, `preset "${presetId}" is not available`);
			if (preset.broken !== void 0) throw new HttpError(409, `preset "${presetId}" is broken: ${preset.broken}`);
			let visible;
			try {
				visible = await withPresetScope(agentPresets, presetId, (scope) => presetSkillRows(skills, scope, /* @__PURE__ */ new Set(), process.cwd()));
			} catch (error) {
				throw new HttpError(503, `preset "${presetId}" skills are unavailable: ${errorMessage(error)}`);
			}
			if (!visible.some((skill) => skill.name === name)) throw new HttpError(404, `skill "${name}" is not available in preset "${presetId}"`);
			const disabled = new Set(settingsScope$1.get().presetSkills[presetId] ?? []);
			if (enabled) disabled.delete(name);
			else disabled.add(name);
			return persist(presetId, settingsScope$1, disabled, "presetSkills");
		}
	};
}

//#endregion
//#region src/loopback.ts
const LOOPBACK_ADDRS = new Set([
	"127.0.0.1",
	"::1",
	"::ffff:127.0.0.1"
]);
/**
* Loopback-only guard.
*
* The connection's peer address is the only trustworthy evidence, and it is the
* only one that still holds when the host binds to a LAN interface
* (`--host` / `--trusted-host`). The Host and Origin headers are set by the
* caller, so they are a fallback used only when the socket is unavailable —
* with neither present, this fails closed.
*/
function isLoopback(req) {
	const addr = req.socket?.remoteAddress;
	if (typeof addr === "string") return LOOPBACK_ADDRS.has(addr);
	const originHeader = req.headers["origin"];
	const origin = typeof originHeader === "string" ? originHeader : "";
	if (origin === "") {
		const hostHeader = req.headers["host"];
		const host = typeof hostHeader === "string" ? hostHeader : "";
		return /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host);
	}
	return /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(origin);
}

//#endregion
//#region src/host/open-folder.ts
/**
* Open a folder in the system file manager.
*
* Covers macOS (`open`), Windows (`start`), and every freedesktop Linux
* desktop (GNOME, KDE, XFCE, …) via `xdg-open`. Server-only Linux distros
* that lack a desktop cannot open folders, but the error is graceful.
*/
function openFolder(path) {
	return new Promise((resolve, reject) => {
		exec(`${process.platform === "darwin" ? "open" : process.platform === "win32" ? "start \"\"" : "xdg-open"} "${path}"`, (error) => {
			if (error) reject(/* @__PURE__ */ new Error(`failed to open folder: ${error.message}`));
			else resolve();
		});
	});
}

//#endregion
//#region src/host/open-source-folder.ts
/**
* Whether the resolved service really carries both members this route calls.
* Probed rather than assumed, exactly like the other optional services: the
* service name is stable across generations, but a composition is free to
* mount a partial implementation.
*/
function isUsableOpener(opener) {
	return opener !== void 0 && typeof opener.canOpenWorkspacePath === "function" && typeof opener.openWorkspacePath === "function";
}
/**
* Open `path` through the Host when it can, else through `fallback`.
* @param opener - the Session controller, when the composition mounts one.
* @param path - absolute folder path already resolved from the source key.
* @param fallback - this plugin's own opener, used where the Host cannot.
* @returns which opener ran.
*/
async function openSourceFolder(opener, path, fallback) {
	if (isUsableOpener(opener)) {
		if (!opener.canOpenWorkspacePath()) return "unsupported";
		try {
			await opener.openWorkspacePath({ path }, new AbortController().signal);
			return "host";
		} catch {}
	}
	await fallback(path);
	return "local";
}

//#endregion
//#region src/host/route.ts
const ROUTE = "/api/capability-panel";
const KINDS = [
	"skill",
	"mcp-server",
	"mcp-tool",
	"system-tool"
];
var ClientRequestError = class extends HttpError {
	constructor(message, status = 400) {
		super(status, message);
	}
};
function readRequestBody(req) {
	return new Promise((resolve, reject) => {
		if (req.on === void 0) {
			reject(new ClientRequestError("request body stream unavailable"));
			return;
		}
		let body = "";
		let settled = false;
		const fail = (error) => {
			if (settled) return;
			settled = true;
			reject(error instanceof ClientRequestError ? error : new Error(String(error)));
		};
		req.on("data", (chunk) => {
			if (settled) return;
			body += String(chunk);
			if (body.length > 16384) fail(new ClientRequestError("request body too large", 413));
		});
		req.on("end", () => {
			if (settled) return;
			settled = true;
			try {
				resolve(body === "" ? {} : JSON.parse(body));
			} catch {
				reject(new ClientRequestError("invalid JSON body"));
			}
		});
		req.on("error", fail);
	});
}
/**
* Every response here reflects live process state, so `no-store` is the
* default and opting out is explicit. The flag reads as what it does: the
* previous spelling was `cache = true` on the ERROR branch, which left a
* transient 503 as the only cacheable response the route produced.
*/
function json(res, status, body, allowCaching = false) {
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		...allowCaching ? {} : { "cache-control": "no-store" }
	});
	res.end(JSON.stringify(body));
}
/**
* `kind` mirrors the session route's toggle shape: one tool, or a whole MCP
* server in a single write.
*/
function validatePresetToggle(body) {
	if (body === null || typeof body !== "object") throw new ClientRequestError("invalid request body");
	const record = body;
	if (typeof record.presetId !== "string" || record.presetId === "") throw new ClientRequestError("presetId is required");
	const kind = record.kind ?? "tool";
	if (kind !== "tool" && kind !== "mcp-server" && kind !== "skill") throw new ClientRequestError("kind must be \"tool\", \"mcp-server\" or \"skill\"");
	if (typeof record.name !== "string" || record.name === "") throw new ClientRequestError("name is required");
	if (typeof record.enabled !== "boolean") throw new ClientRequestError("enabled must be boolean");
	return {
		presetId: record.presetId,
		kind,
		name: record.name,
		enabled: record.enabled
	};
}
function validatePresetContentType(req, res) {
	const contentType = req.headers["content-type"];
	if (typeof contentType === "string" && contentType.startsWith("application/json")) return true;
	res.writeHead(415, { "content-type": "text/plain; charset=utf-8" });
	res.end("expected application/json");
	return false;
}
function validateToggle(sessionId, body) {
	if (sessionId === null) throw new ClientRequestError("session is required");
	if (body === null || typeof body !== "object") throw new ClientRequestError("invalid request body");
	const record = body;
	if (typeof record.kind !== "string" || !KINDS.includes(record.kind) || typeof record.enabled !== "boolean") throw new ClientRequestError("kind must be skill, mcp-server, mcp-tool or system-tool and enabled must be boolean");
	if (typeof record.name !== "string" || record.name === "") throw new ClientRequestError("name is required");
	return {
		sessionId,
		kind: record.kind,
		name: record.name,
		enabled: record.enabled
	};
}
function createRouteHandler(services, capabilities, stats, blockedCounts, presetTools, sessionOverrides) {
	return async (req, res) => {
		if (!isLoopback(req)) {
			res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
			res.end("forbidden");
			return;
		}
		try {
			const url = new URL(req.url ?? "/", "http://dsh.local");
			if (url.pathname === `${ROUTE}/presets`) {
				if (req.method !== "GET" && req.method !== "POST") {
					res.writeHead(405, {
						allow: "GET, POST",
						"content-type": "text/plain; charset=utf-8"
					});
					res.end("method not allowed");
					return;
				}
				if (req.method === "POST") {
					if (!validatePresetContentType(req, res)) return;
					const toggle = validatePresetToggle(await readRequestBody(req));
					json(res, 200, toggle.kind === "skill" ? await presetTools.setSkill(toggle.presetId, toggle.name, toggle.enabled) : toggle.kind === "mcp-server" ? await presetTools.setServer(toggle.presetId, toggle.name, toggle.enabled) : await presetTools.set(toggle.presetId, toggle.name, toggle.enabled));
					return;
				}
				json(res, 200, await presetTools.list());
				return;
			}
			if (url.pathname === `${ROUTE}/stats`) {
				if (req.method !== "GET") {
					res.writeHead(405, {
						allow: "GET",
						"content-type": "text/plain; charset=utf-8"
					});
					res.end("method not allowed");
					return;
				}
				const snapshot = stats.read();
				json(res, 200, {
					logFile: stats.file,
					blocked: blockedCounts,
					records: snapshot.records,
					...snapshot.warnings.length > 0 ? { warnings: snapshot.warnings } : {}
				}, true);
				return;
			}
			if (url.pathname === `${ROUTE}/reconnect`) {
				if (req.method !== "POST") {
					res.writeHead(405, {
						allow: "POST",
						"content-type": "text/plain; charset=utf-8"
					});
					res.end("method not allowed");
					return;
				}
				if (!validatePresetContentType(req, res)) return;
				const body = await readRequestBody(req);
				if (body === null || typeof body !== "object") {
					json(res, 400, { error: "invalid request body" });
					return;
				}
				const record = body;
				if (typeof record.server !== "string" || record.server === "") {
					json(res, 400, { error: "server is required" });
					return;
				}
				await restartMcpServer(services, record.server);
				json(res, 200, {
					ok: true,
					server: record.server
				});
				return;
			}
			if (url.pathname === `${ROUTE}/open-folder`) {
				if (req.method !== "POST") {
					res.writeHead(405, {
						allow: "POST",
						"content-type": "text/plain; charset=utf-8"
					});
					res.end("method not allowed");
					return;
				}
				if (!validatePresetContentType(req, res)) return;
				const body = await readRequestBody(req);
				if (body === null || typeof body !== "object") {
					json(res, 400, { error: "invalid request body" });
					return;
				}
				const record = body;
				if (typeof record.source !== "string" || record.source === "") {
					json(res, 400, { error: "source is required" });
					return;
				}
				const source = record.source;
				const sessionId$1 = typeof record.sessionId === "string" ? record.sessionId : null;
				let folderPath;
				if (sessionId$1 !== null) try {
					const skills = services.get("skills", false);
					const agent = services.get("agents", false)?.get(sessionId$1);
					if (skills !== void 0 && agent !== void 0) {
						const cwd = agent.session?.header?.cwd;
						const list = await skills.list({
							...cwd === void 0 ? {} : { cwd },
							scope: agent
						});
						for (const item of list) {
							if (item.source !== source) continue;
							const base = item.resourceBase;
							if (base !== null && typeof base === "object" && base.kind === "directory") {
								const path = base.path;
								if (typeof path === "string" && path !== "") {
									folderPath = parentDir(path);
									break;
								}
							}
						}
					}
				} catch {}
				if (folderPath === void 0 && (source === "user-dsh" || source === "user-agents")) {
					const dshHome$1 = process.env["DSH_HOME"] ?? (process.env["HOME"] !== void 0 ? `${process.env["HOME"]}/.dsh` : void 0);
					if (dshHome$1 !== void 0) folderPath = source === "user-dsh" ? `${dshHome$1}/skills` : `${process.env["DSH_AGENTS_HOME"] ?? `${process.env["HOME"]}/.agents`}/skills`;
				} else if (folderPath === void 0 && (source === "project-dsh" || source === "project-agents")) {
					const cwd = (sessionId$1 === null ? void 0 : services.get("agents", false)?.get(sessionId$1))?.session?.header?.cwd ?? (sessionId$1 === null ? process.cwd() : void 0);
					if (cwd !== void 0) folderPath = source === "project-dsh" ? `${cwd}/.dsh/skills` : `${cwd}/.agents/skills`;
				} else if (folderPath === void 0 && source === "host") folderPath = process.env["DSH_HOME"] ?? (process.env["HOME"] !== void 0 ? `${process.env["HOME"]}/.dsh` : void 0);
				else if (folderPath === void 0 && source !== "bundled" && source !== "runtime") try {
					const preset = (await services.get("agentPresets", false)?.list())?.find((p) => p.id === source || p.name === source);
					if (preset !== void 0) folderPath = preset.path;
				} catch {}
				if (folderPath === void 0) {
					json(res, 404, { error: `cannot open folder for source "${source}"` });
					return;
				}
				try {
					if (await openSourceFolder(services.get("sessionController", false), folderPath, openFolder) === "unsupported") {
						json(res, 500, { error: "this deployment cannot open folders on a desktop" });
						return;
					}
					json(res, 200, { ok: true });
				} catch (error) {
					json(res, 500, { error: `failed to open folder: ${errorMessage(error)}` });
				}
				return;
			}
			if (url.pathname !== ROUTE && url.pathname !== "/") {
				res.writeHead(404, {
					"content-type": "text/plain; charset=utf-8",
					"cache-control": "no-store"
				});
				res.end("not found");
				return;
			}
			if (req.method !== "GET" && req.method !== "POST") {
				res.writeHead(405, {
					allow: "GET, POST",
					"content-type": "text/plain; charset=utf-8"
				});
				res.end("method not allowed");
				return;
			}
			const sessionId = url.searchParams.get("session");
			let persistNote;
			if (req.method === "POST") {
				const contentType = req.headers["content-type"];
				if (typeof contentType !== "string" || !contentType.startsWith("application/json")) {
					res.writeHead(415, { "content-type": "text/plain; charset=utf-8" });
					res.end("expected application/json");
					return;
				}
				const toggle = validateToggle(sessionId, await readRequestBody(req));
				await capabilities.set(toggle.sessionId, toggle.kind, toggle.name, toggle.enabled);
				try {
					await sessionOverrides.record(toggle.sessionId, toggle.kind, toggle.name, toggle.enabled);
				} catch (error) {
					persistNote = `switch applied for this session but could not be persisted across a restart: ${errorMessage(error)}`;
				}
			}
			const payload = await buildPayload(services, sessionId, sessionId === null ? EMPTY_STATE : capabilities.state(sessionId) ?? EMPTY_STATE, blockedCounts, (presetId) => presetTools.defaultsFor(presetId));
			json(res, 200, persistNote === void 0 ? payload : {
				...payload,
				degraded: [...payload.degraded ?? [], persistNote]
			});
		} catch (error) {
			json(res, error instanceof HttpError ? error.status : 500, { error: errorMessage(error) });
		}
	};
}

//#endregion
//#region src/host/session-overrides.ts
/**
* Session-bound switch positions, persisted in the capability-panel settings namespace
* so a restored session gets its own toggles back after a restart.
*
* The binding is the session id: a record is read only by the session that
* made it, so one session's switch can never leak into another. What changes
* at a restart is only WHEN it is read — the masks themselves are re-applied
* by the same capability controller the panel uses, over the fresh agent.
*
* The store is a record of user intent, not a snapshot of derived state: an
* explicit `true` matters only when a preset default masks the name, and
* recording every toggle's final value keeps the write path dumb (no preset
* lookup needed) while restore order (defaults first, overrides second) makes
* the user's last word win.
*/
/** Kind keys map 1:1 onto SessionOverrideState's fields. */
const KIND_KEYS = {
	skill: "skills",
	"mcp-server": "mcpServers",
	"mcp-tool": "mcpTools",
	"system-tool": "systemTools"
};
/**
* Retained session records cap. A record costs a handful of names, and a
* session the user never revisits is pruned oldest-first — the alternative
* (unbounded growth in a settings file) trades a real read cost for a
* scenario nobody has.
*/
const MAX_SESSION_RECORDS = 200;
function createSessionOverrideStore(access) {
	return {
		overridesFor(sessionId) {
			try {
				return access.scope()?.get().sessions[sessionId];
			} catch {
				return;
			}
		},
		async record(sessionId, kind, name, enabled) {
			const scope = access.scope();
			if (scope === void 0) throw new HttpError(503, "settings service unavailable");
			await access.serialize(async () => {
				const stored = scope.get();
				const kindKey = KIND_KEYS[kind];
				const current = stored.sessions[sessionId];
				const next = {
					skills: { ...current?.skills },
					mcpServers: { ...current?.mcpServers },
					mcpTools: { ...current?.mcpTools },
					systemTools: { ...current?.systemTools },
					[kindKey]: {
						...current?.[kindKey],
						[name]: enabled
					}
				};
				const entries = Object.entries(stored.sessions).filter(([id]) => id !== sessionId);
				entries.push([sessionId, next]);
				const sessions = Object.fromEntries(entries.slice(-MAX_SESSION_RECORDS));
				await scope.replace({
					presets: stored.presets,
					presetSkills: stored.presetSkills,
					sessions
				});
			});
		}
	};
}

//#endregion
//#region src/host/stats-store.ts
function statsFilePath(environment = process.env, home = homedir()) {
	return join(environment["DSH_HOME"] ?? join(home, ".dsh"), "capability-panel", "stats.jsonl");
}
function isEnoent(error) {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
}
function createStatsStore(file = statsFilePath()) {
	const appendWarnings = [];
	return {
		file,
		read() {
			let text;
			try {
				text = readFileSync(file, "utf8");
			} catch (error) {
				if (isEnoent(error)) return {
					records: [],
					blocked: {},
					warnings: [...appendWarnings]
				};
				return {
					records: [],
					blocked: {},
					warnings: [`stats read failed: ${String(error)}`, ...appendWarnings]
				};
			}
			const records = [];
			const warnings = [...appendWarnings];
			const validLines = [];
			for (const [index, line] of text.split("\n").entries()) {
				if (line.trim() === "") continue;
				try {
					const parsed = JSON.parse(line);
					records.push(parsed);
					validLines.push(line);
				} catch (error) {
					warnings.push(`stats line ${index + 1} skipped: ${String(error)}`);
				}
			}
			return {
				records,
				blocked: aggregateBlocked(validLines),
				warnings
			};
		},
		append(record) {
			try {
				mkdirSync(dirname(file), { recursive: true });
				appendFileSync(file, `${JSON.stringify(record)}\n`);
				return null;
			} catch (error) {
				const warning = `stats append failed: ${String(error)}`;
				appendWarnings.push(warning);
				return warning;
			}
		}
	};
}

//#endregion
//#region src/index.ts
/**
* This plugin's persisted state, declared where dsh 0.1.7 looks for it.
*
* The settings rewrite re-keyed every configurable namespace to a profile entry
* id and moved the values onto the entry's OWN Config, so a plugin that declares
* no Config is simply absent from the settings surface — `describe()` emits no
* descriptor and any write fails with `No configurable plugin entry`. Exporting
* this is what makes the entry configurable at all; the volatile markers inside
* (see `settings-schema.ts`) are what make writes apply live.
*
* It MUST be a named export of the module, not a property of `apply`: the loader
* resolves a module-shaped plugin down to its `apply` function and then reads
* `Config` off the enclosing module namespace. Attaching it to the function would
* be silently ignored.
*/
const Config = ToolkitSettingsSchema;
/** Host composition root: construct stores/controllers and register the route. */
function apply(ctx) {
	const webServer = ctx.webServer;
	if (webServer === void 0) return;
	const stats = createStatsStore();
	const blockedCounts = stats.read().blocked;
	const appendStats = (record) => {
		stats.append(record);
	};
	const capabilities = createCapabilityController(ctx, appendStats, blockedCounts);
	const settingsAccess = createToolkitSettingsAccess(ctx);
	scheduleLegacyRecovery(ctx, settingsAccess);
	const presetTools = createPresetToolController(ctx, settingsAccess);
	const sessionOverrides = createSessionOverrideStore(settingsAccess);
	registerPresetEnforcement(ctx, capabilities, presetTools, sessionOverrides);
	const handler = createRouteHandler(ctx, capabilities, stats, blockedCounts, presetTools, sessionOverrides);
	ctx.effect(() => webServer.register({
		kind: "prefix",
		path: ROUTE,
		handler
	}), "capability-panel: data route");
}
const inject = ["webServer"];

//#endregion
export { Config, apply, inject };
//# sourceMappingURL=index.js.map