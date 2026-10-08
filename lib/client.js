window.__ModuleLoader__.load({ id: "dsh-capability-panel", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
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

//#endregion
let __deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
__deepseek_ai_dsh_client_store = __toESM(__deepseek_ai_dsh_client_store);
let react = require("react");
react = __toESM(react);
let react_jsx_runtime = require("react/jsx-runtime");
react_jsx_runtime = __toESM(react_jsx_runtime);
let react_dom = require("react-dom");
react_dom = __toESM(react_dom);
let __deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
__deepseek_ai_dsh_client_ui_primitives = __toESM(__deepseek_ai_dsh_client_ui_primitives);

//#region src/wire.ts
const isRecord$1 = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const optString = (value) => typeof value === "string" ? value : void 0;
function parseSkillEntry(value) {
	if (!isRecord$1(value) || typeof value["name"] !== "string") return null;
	const state = value["state"];
	if (state !== "loaded" && state !== "pruned" && state !== "evicted" && state !== "unloaded") return null;
	if (typeof value["enabled"] !== "boolean" || typeof value["loadCount"] !== "number") return null;
	if (typeof value["source"] !== "string" || typeof value["provider"] !== "string") return null;
	const description = optString(value["description"]);
	const path = optString(value["path"]);
	const group = optString(value["group"]);
	const fileAddress = optString(value["fileAddress"]);
	return {
		name: value["name"],
		state,
		enabled: value["enabled"],
		loadCount: value["loadCount"],
		source: value["source"],
		provider: value["provider"],
		...description === void 0 ? {} : { description },
		...path === void 0 ? {} : { path },
		...fileAddress === void 0 ? {} : { fileAddress },
		...group === void 0 ? {} : { group }
	};
}
function parseToolEntry(value) {
	if (!isRecord$1(value) || typeof value["name"] !== "string" || typeof value["label"] !== "string") return null;
	if (typeof value["enabled"] !== "boolean") return null;
	const description = optString(value["description"]);
	return {
		name: value["name"],
		label: value["label"],
		enabled: value["enabled"],
		...description === void 0 ? {} : { description },
		...value["reserved"] === true ? { reserved: true } : {}
	};
}
function parseMcpToolEntry(value) {
	return parseToolEntry(value);
}
function parseMcpServerEntry(value) {
	if (!isRecord$1(value) || typeof value["server"] !== "string" || typeof value["enabled"] !== "boolean") return null;
	if (!Array.isArray(value["tools"])) return null;
	const tools = [];
	for (const tool of value["tools"]) {
		const parsed = parseMcpToolEntry(tool);
		if (parsed === null) return null;
		tools.push(parsed);
	}
	const source = optString(value["source"]);
	const path = optString(value["path"]);
	const defaultDisabled = value["defaultDisabled"];
	if (defaultDisabled !== void 0 && typeof defaultDisabled !== "boolean") return null;
	return {
		server: value["server"],
		enabled: value["enabled"],
		tools,
		...source === void 0 ? {} : { source },
		...path === void 0 ? {} : { path },
		...defaultDisabled === void 0 ? {} : { defaultDisabled },
		...value["unavailable"] === true ? { unavailable: true } : {},
		...value["reconnectable"] === true ? { reconnectable: true } : {}
	};
}
function parseBlocked(value) {
	if (!isRecord$1(value)) return null;
	const out = {};
	for (const [key, count] of Object.entries(value)) {
		if (typeof count !== "number") return null;
		out[key] = count;
	}
	return out;
}
/** Parse one wire payload; null means the shape is not ours (version skew). */
function parseInspectorPayload(value) {
	if (!isRecord$1(value)) return null;
	const sessionId = value["sessionId"];
	if (sessionId !== null && typeof sessionId !== "string") return null;
	if (!Array.isArray(value["skills"]) || !Array.isArray(value["mcp"]) || !Array.isArray(value["systemTools"])) return null;
	const skills = [];
	for (const skill of value["skills"]) {
		const parsed = parseSkillEntry(skill);
		if (parsed === null) return null;
		skills.push(parsed);
	}
	const mcp = [];
	for (const server of value["mcp"]) {
		const parsed = parseMcpServerEntry(server);
		if (parsed === null) return null;
		mcp.push(parsed);
	}
	const systemTools = [];
	for (const tool of value["systemTools"]) {
		const parsed = parseToolEntry(tool);
		if (parsed === null) return null;
		systemTools.push(parsed);
	}
	const blocked = parseBlocked(value["blocked"]);
	if (blocked === null) return null;
	const degradedRaw = value["degraded"];
	let degraded;
	if (degradedRaw !== void 0) {
		if (!Array.isArray(degradedRaw) || degradedRaw.some((note) => typeof note !== "string")) return null;
		degraded = degradedRaw;
	}
	return {
		sessionId,
		skills,
		mcp,
		systemTools,
		blocked,
		...degraded === void 0 ? {} : { degraded }
	};
}

//#endregion
//#region src/client/store.ts
const INITIAL_STATE = {
	open: false,
	loading: false,
	payload: null,
	error: null
};
const store$1 = (0, __deepseek_ai_dsh_client_store.createSnapshotStore)(INITIAL_STATE);
const subscribe = (listener) => store$1.subscribe(listener);
/** Reference-stable while nothing changed, as useSyncExternalStore requires. */
const getSnapshot = () => store$1.getSnapshot();
function toggle() {
	const snapshot = store$1.getSnapshot();
	store$1.set({
		...snapshot,
		open: !snapshot.open
	});
}
function close() {
	const snapshot = store$1.getSnapshot();
	if (snapshot.open) store$1.set({
		...snapshot,
		open: false
	});
}
/**
* Surface an action failure (e.g. a rejected reload) in the panel's existing
* error slot, without clobbering the payload or loading state.
*/
function reportActionError(message) {
	store$1.set({
		...store$1.getSnapshot(),
		error: message
	});
}
const ROUTE$1 = "/api/capability-panel";
/**
* Reads and writes have different ordering domains. A newer refresh supersedes
* an older refresh, but it cannot invalidate a user's mutation response.
* `mutationVersion` changes at both ends of a write, so a GET overlapping a
* mutation cannot commit a possibly pre-write snapshot. `epoch` invalidates
* every answer from a dead connection.
*/
let epoch$1 = 0;
let refreshSeq = 0;
let mutationVersion = 0;
let activeRequests = 0;
let mutationQueue = Promise.resolve();
function beginRequest() {
	activeRequests += 1;
	const snapshot = store$1.getSnapshot();
	store$1.set({
		...snapshot,
		loading: true,
		error: null
	});
	return epoch$1;
}
function finishRequest(requestEpoch, patch) {
	if (requestEpoch !== epoch$1) return;
	activeRequests -= 1;
	if (patch === void 0 && activeRequests > 0) return;
	store$1.set({
		...store$1.getSnapshot(),
		...patch,
		loading: activeRequests > 0
	});
}
async function requestPayload$1(sessionId, init) {
	const query = sessionId === null ? "" : `?session=${encodeURIComponent(sessionId)}`;
	const response = await fetch(`${ROUTE$1}${query}`, {
		credentials: "same-origin",
		...init
	});
	if (!response.ok) {
		let detail = "";
		try {
			const body = await response.json();
			if (body !== null && typeof body === "object" && typeof body.error === "string") detail = `: ${body.error}`;
		} catch {}
		throw new Error(`HTTP ${response.status}${detail}`);
	}
	const payload = parseInspectorPayload(await response.json());
	if (payload === null) throw new Error("unexpected payload shape (host/client version skew?)");
	return payload;
}
async function refresh(sessionId) {
	const requestEpoch = beginRequest();
	const mine = ++refreshSeq;
	const mutationAtStart = mutationVersion;
	let patch;
	try {
		const payload = await requestPayload$1(sessionId);
		if (requestEpoch === epoch$1 && mine === refreshSeq && mutationAtStart === mutationVersion) patch = {
			payload,
			error: null
		};
	} catch (error) {
		if (requestEpoch === epoch$1 && mine === refreshSeq && mutationAtStart === mutationVersion) patch = { error: error instanceof Error ? error.message : String(error) };
	} finally {
		finishRequest(requestEpoch, patch);
	}
}
function setCapability(sessionId, kind, name, enabled) {
	const requestEpoch = beginRequest();
	mutationVersion += 1;
	const run = async () => {
		let patch;
		try {
			const payload = await requestPayload$1(sessionId, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					kind,
					name,
					enabled
				})
			});
			if (requestEpoch === epoch$1) patch = {
				payload,
				error: null
			};
		} catch (error) {
			if (requestEpoch === epoch$1) patch = { error: error instanceof Error ? error.message : String(error) };
		} finally {
			if (requestEpoch === epoch$1) mutationVersion += 1;
			finishRequest(requestEpoch, patch);
		}
	};
	const result = mutationQueue.then(run);
	mutationQueue = result;
	return result;
}
function reset() {
	epoch$1 += 1;
	refreshSeq += 1;
	mutationVersion += 1;
	activeRequests = 0;
	mutationQueue = Promise.resolve();
	store$1.set(INITIAL_STATE);
}

//#endregion
//#region src/client/filter-core.ts
const hit = (query, fields) => fields.some((field) => field !== void 0 && field.toLowerCase().includes(query));
function filterCapabilities(source, rawQuery) {
	const query = rawQuery.trim().toLowerCase();
	if (query === "") return {
		skills: source.skills,
		mcp: source.mcp,
		systemTools: source.systemTools,
		total: source.skills.length + source.mcp.length + source.systemTools.length
	};
	const skills = source.skills.filter((skill) => hit(query, [
		skill.name,
		skill.description,
		skill.stateLabel,
		skill.sourceLabel
	]));
	const mcp = source.mcp.flatMap((server) => {
		if (hit(query, [server.server, server.source])) return [server];
		const tools = server.tools.filter((tool) => hit(query, [
			tool.label,
			tool.name,
			tool.description
		]));
		return tools.length > 0 ? [{
			...server,
			tools
		}] : [];
	});
	const systemTools = source.systemTools.filter((tool) => hit(query, [
		tool.label,
		tool.name,
		tool.description
	]));
	return {
		skills,
		mcp,
		systemTools,
		total: skills.length + mcp.length + systemTools.length
	};
}

//#endregion
//#region src/client/filter.ts
function filterPayload(payload, rawQuery, stateLabel = (skill) => skill.state, sourceLabel = (skill) => skill.source) {
	if (rawQuery.trim() === "") return filterCapabilities(payload, rawQuery);
	const skills = payload.skills.map((skill) => ({
		...skill,
		stateLabel: stateLabel(skill),
		sourceLabel: sourceLabel(skill)
	}));
	return filterCapabilities({
		...payload,
		skills
	}, rawQuery);
}

//#endregion
//#region src/client/disclosure.ts
/**
* Resolve one controlled disclosure's visible and interactive state.
* Filtering deliberately preserves the user's stored preference while forcing
* matching detail open; the disabled trigger prevents a no-feedback toggle.
* Labels are the caller's job — they go through the locale translate function.
*/
function resolveDisclosure(expanded, filtering) {
	if (filtering) return {
		open: true,
		disabled: true
	};
	return {
		open: expanded,
		disabled: false
	};
}
/** Shared geometry and hover classes used by every capability header. */
const ROW_ROOT_CLASS = "";
const MCP_TOOL_ROOT_CLASS = "ci-toolrow";
const ROW_HEADER_CLASS = "ci-row-head";

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/safeReact.mjs
/**
* A clone of the React namespace for reading APIs that may be missing in older
* supported React versions. Bundlers can rewrite direct `React.someNewApi`
* reads into named imports, which breaks React 17. Reading from this cloned
* object keeps those lookups optional.
*
* @see https://github.com/mui/material-ui/issues/41190#issuecomment-2040873379
*/
const SafeReact = { ...react };

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/useRefWithInit.mjs
const UNINITIALIZED = {};
/**
* A React.useRef() that is initialized with a function. Note that it accepts an optional
* initialization argument, so the initialization function doesn't need to be an inline closure.
*
* @usage
*   const ref = useRefWithInit(sortColumns, columns)
*/
function useRefWithInit(init, initArg) {
	const ref = react.useRef(UNINITIALIZED);
	if (ref.current === UNINITIALIZED) ref.current = init(initArg);
	return ref;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/useStableCallback.mjs
const useInsertionEffect = SafeReact.useInsertionEffect;
const useSafeInsertionEffect = useInsertionEffect && useInsertionEffect !== SafeReact.useLayoutEffect ? useInsertionEffect : (fn) => fn();
/**
* Stabilizes the function passed so it's always the same between renders.
*
* The function becomes non-reactive to any values it captures.
* It can safely be passed as a dependency of `React.useMemo` and `React.useEffect` without re-triggering them if its captured values change.
*
* The function must only be called inside effects and event handlers, never during render (which throws an error).
*
* This hook is a more permissive version of React 19.2's `React.useEffectEvent` in that it can be passed through contexts and called in event handler props, not just effects.
*/
function useStableCallback(callback) {
	const stable = useRefWithInit(createStableCallback).current;
	stable.next = callback;
	useSafeInsertionEffect(stable.effect);
	return stable.trampoline;
}
function createStableCallback() {
	const stable = {
		next: void 0,
		callback: assertNotCalled,
		trampoline: (...args) => stable.callback?.(...args),
		effect: () => {
			stable.callback = stable.next;
		}
	};
	return stable;
}
function assertNotCalled() {}

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/formatErrorMessage.mjs
/**
* Creates a formatErrorMessage function with a custom URL and prefix.
* @param baseUrl - The base URL for the error page (e.g., 'https://base-ui.com/production-error')
* @param prefix - The prefix for the error message (e.g., 'Base UI')
* @returns A function that formats error messages with the given URL and prefix
*/
function createFormatErrorMessage(baseUrl, prefix) {
	return function formatErrorMessage$1(code, ...args) {
		const url = new URL(baseUrl);
		url.searchParams.set("code", code.toString());
		args.forEach((arg) => url.searchParams.append("args[]", arg));
		return `${prefix} error #${code}; visit ${url} for the full message.`;
	};
}
/**
* WARNING: Don't import this directly. It's imported by the code generated by
* `@mui/internal-babel-plugin-minify-errors`. Make sure to always use string literals in `Error`
* constructors to ensure the plugin works as expected. Supported patterns include:
*   throw new Error('My message');
*   throw new Error(`My message: ${foo}`);
*   throw new Error(`My message: ${foo}` + 'another string');
*   ...
*/
const formatErrorMessage = createFormatErrorMessage("https://base-ui.com/production-error", "Base UI");
var formatErrorMessage_default = formatErrorMessage;

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/useMergedRefs.mjs
/**
* Merges refs into a single memoized callback ref or `null`.
* This makes sure multiple refs are updated together and have the same value.
*
* This function accepts up to four refs. If you need to merge more, or have an unspecified number of refs to merge,
* use `useMergedRefsN` instead.
*/
function useMergedRefs(a, b, c, d) {
	const forkRef = useRefWithInit(createForkRef).current;
	if (didChange(forkRef, a, b, c, d)) update(forkRef, [
		a,
		b,
		c,
		d
	]);
	return forkRef.callback;
}
/**
* Merges an array of refs into a single memoized callback ref or `null`.
*
* If you need to merge a fixed number (up to four) of refs, use `useMergedRefs` instead for better performance.
*/
function useMergedRefsN(refs) {
	const forkRef = useRefWithInit(createForkRef).current;
	if (didChangeN(forkRef, refs)) update(forkRef, refs);
	return forkRef.callback;
}
function createForkRef() {
	return {
		callback: null,
		cleanup: null,
		refs: []
	};
}
function didChange(forkRef, a, b, c, d) {
	return forkRef.refs[0] !== a || forkRef.refs[1] !== b || forkRef.refs[2] !== c || forkRef.refs[3] !== d;
}
function didChangeN(forkRef, newRefs) {
	return forkRef.refs.length !== newRefs.length || forkRef.refs.some((ref, index$1) => ref !== newRefs[index$1]);
}
function update(forkRef, refs) {
	forkRef.refs = refs;
	if (refs.every((ref) => ref == null)) {
		forkRef.callback = null;
		return;
	}
	forkRef.callback = (instance) => {
		if (forkRef.cleanup) {
			forkRef.cleanup();
			forkRef.cleanup = null;
		}
		if (instance != null) {
			const cleanupCallbacks = Array(refs.length).fill(null);
			for (let i = 0; i < refs.length; i += 1) {
				const ref = refs[i];
				if (ref == null) continue;
				switch (typeof ref) {
					case "function": {
						const refCleanup = ref(instance);
						if (typeof refCleanup === "function") cleanupCallbacks[i] = refCleanup;
						break;
					}
					case "object":
						ref.current = instance;
						break;
					default:
				}
			}
			forkRef.cleanup = () => {
				for (let i = 0; i < refs.length; i += 1) {
					const ref = refs[i];
					if (ref == null) continue;
					switch (typeof ref) {
						case "function": {
							const cleanupCallback = cleanupCallbacks[i];
							if (typeof cleanupCallback === "function") cleanupCallback();
							else ref(null);
							break;
						}
						case "object":
							ref.current = null;
							break;
						default:
					}
				}
			};
		}
	};
}

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/reactVersion.mjs
const majorVersion = parseInt(react.version, 10);
function isReactVersionAtLeast(reactVersionToCheck) {
	return majorVersion >= reactVersionToCheck;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/getReactElementRef.mjs
/**
* Extracts the `ref` from a React element, handling different React versions.
*/
function getReactElementRef(element) {
	if (!/* @__PURE__ */ react.isValidElement(element)) return null;
	const reactElement = element;
	const propsWithRef = reactElement.props;
	return (isReactVersionAtLeast(19) ? propsWithRef?.ref : reactElement.ref) ?? null;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/mergeObjects.mjs
function mergeObjects(a, b) {
	if (a && !b) return a;
	if (!a && b) return b;
	if (a || b) return {
		...a,
		...b
	};
}

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/empty.mjs
function NOOP() {}
const EMPTY_ARRAY = Object.freeze([]);
const EMPTY_OBJECT = Object.freeze({});

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/getStateAttributesProps.mjs
function getStateAttributesProps(state, customMapping) {
	const props = {};
	for (const key in state) {
		const value = state[key];
		if (customMapping?.hasOwnProperty(key)) {
			const customProps = customMapping[key](value);
			if (customProps != null) Object.assign(props, customProps);
			continue;
		}
		if (value === true) props[`data-${key.toLowerCase()}`] = "";
		else if (value) props[`data-${key.toLowerCase()}`] = value.toString();
	}
	return props;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/utils/resolveClassName.mjs
/**
* If the provided className is a string, it will be returned as is.
* Otherwise, the function will call the className function with the state as the first argument.
*
* @param className
* @param state
*/
function resolveClassName(className, state) {
	return typeof className === "function" ? className(state) : className;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/utils/resolveStyle.mjs
/**
* If the provided style is an object, it will be returned as is.
* Otherwise, the function will call the style function with the state as the first argument.
*
* @param style
* @param state
*/
function resolveStyle(style, state) {
	return typeof style === "function" ? style(state) : style;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/merge-props/mergeProps.mjs
const EMPTY_PROPS = {};
/**
* Merges multiple sets of React props. It follows the Object.assign pattern where the rightmost object's fields overwrite
* the conflicting ones from others. This doesn't apply to event handlers, `className` and `style` props.
*
* Event handlers are merged and called in right-to-left order (rightmost handler executes first, leftmost last).
* For React synthetic events, the rightmost handler can prevent prior (left-positioned) handlers from executing
* by calling `event.preventBaseUIHandler()`. For non-synthetic events (custom events with primitive/object values),
* all handlers always execute without prevention capability.
*
* The `className` prop is merged by concatenating classes in right-to-left order (rightmost class appears first in the string).
* The `style` prop is merged with rightmost styles overwriting the prior ones.
*
* Props can either be provided as objects or as functions that take the previous props as an argument.
* The function will receive the merged props up to that point (going from left to right):
* so in the case of `(obj1, obj2, fn, obj3)`, `fn` will receive the merged props of `obj1` and `obj2`.
* The function is responsible for chaining event handlers if needed (that is, we don't run the merge logic).
*
* Event handlers returned by the functions are not automatically prevented when `preventBaseUIHandler` is called.
* They must check `event.baseUIHandlerPrevented` themselves and bail out if it's true.
*
* @important **`ref` is not merged.**
* @param a Props object to merge.
* @param b Props object to merge. The function will overwrite conflicting props from `a`.
* @param c Props object to merge. The function will overwrite conflicting props from previous parameters.
* @param d Props object to merge. The function will overwrite conflicting props from previous parameters.
* @param e Props object to merge. The function will overwrite conflicting props from previous parameters.
* @returns The merged props.
* @public
*/
function mergeProps(a, b, c, d, e) {
	if (!c && !d && !e && !a) return createInitialMergedProps(b);
	let merged = createInitialMergedProps(a);
	if (b) merged = mergeInto(merged, b);
	if (c) merged = mergeInto(merged, c);
	if (d) merged = mergeInto(merged, d);
	if (e) merged = mergeInto(merged, e);
	return merged;
}
/**
* Merges an arbitrary number of React props using the same logic as {@link mergeProps}.
* This function accepts an array of props instead of individual arguments.
*
* This has slightly lower performance than {@link mergeProps} due to accepting an array
* instead of a fixed number of arguments. Prefer {@link mergeProps} when merging 5 or
* fewer prop sets for better performance.
*
* @param props Array of props to merge.
* @returns The merged props.
* @see mergeProps
* @public
*/
function mergePropsN(props) {
	if (props.length === 0) return EMPTY_PROPS;
	if (props.length === 1) return createInitialMergedProps(props[0]);
	let merged = createInitialMergedProps(props[0]);
	for (let i = 1; i < props.length; i += 1) merged = mergeInto(merged, props[i]);
	return merged;
}
function createInitialMergedProps(inputProps) {
	if (isPropsGetter(inputProps)) return { ...resolvePropsGetter(inputProps, EMPTY_PROPS) };
	return copyInitialProps(inputProps);
}
function mergeInto(merged, inputProps) {
	if (isPropsGetter(inputProps)) return resolvePropsGetter(inputProps, merged);
	return mutablyMergeInto(merged, inputProps);
}
function copyInitialProps(inputProps) {
	const copiedProps = { ...inputProps };
	for (const propName in copiedProps) {
		const propValue = copiedProps[propName];
		if (isEventHandler(propName, propValue)) copiedProps[propName] = wrapEventHandler(propValue);
	}
	return copiedProps;
}
/**
* Merges two sets of props. In case of conflicts, the external props take precedence.
*/
function mutablyMergeInto(mergedProps, externalProps) {
	if (!externalProps) return mergedProps;
	for (const propName in externalProps) {
		const externalPropValue = externalProps[propName];
		switch (propName) {
			case "style":
				mergedProps[propName] = mergeObjects(mergedProps.style, externalPropValue);
				break;
			case "className":
				mergedProps[propName] = mergeClassNames(mergedProps.className, externalPropValue);
				break;
			default: if (isEventHandler(propName, externalPropValue)) mergedProps[propName] = mergeEventHandlers(mergedProps[propName], externalPropValue);
			else mergedProps[propName] = externalPropValue;
		}
	}
	return mergedProps;
}
function isEventHandler(key, value) {
	const code0 = key.charCodeAt(0);
	const code1 = key.charCodeAt(1);
	const code2 = key.charCodeAt(2);
	return code0 === 111 && code1 === 110 && code2 >= 65 && code2 <= 90 && (typeof value === "function" || typeof value === "undefined");
}
function isPropsGetter(inputProps) {
	return typeof inputProps === "function";
}
function resolvePropsGetter(inputProps, previousProps) {
	if (isPropsGetter(inputProps)) return inputProps(previousProps);
	return inputProps ?? EMPTY_PROPS;
}
function mergeEventHandlers(ourHandler, theirHandler) {
	if (!theirHandler) return ourHandler;
	if (!ourHandler) return wrapEventHandler(theirHandler);
	return (...args) => {
		const event = args[0];
		if (isSyntheticEvent(event)) {
			const baseUIEvent = event;
			makeEventPreventable(baseUIEvent);
			const result$1 = theirHandler(...args);
			if (!baseUIEvent.baseUIHandlerPrevented) ourHandler?.(...args);
			return result$1;
		}
		const result = theirHandler(...args);
		ourHandler?.(...args);
		return result;
	};
}
function wrapEventHandler(handler) {
	if (!handler) return handler;
	return (...args) => {
		const event = args[0];
		if (isSyntheticEvent(event)) makeEventPreventable(event);
		return handler(...args);
	};
}
function makeEventPreventable(event) {
	event.preventBaseUIHandler = () => {
		event.baseUIHandlerPrevented = true;
	};
	return event;
}
function mergeClassNames(ourClassName, theirClassName) {
	if (theirClassName) {
		if (ourClassName) return theirClassName + " " + ourClassName;
		return theirClassName;
	}
	return ourClassName;
}
function isSyntheticEvent(event) {
	return event != null && typeof event === "object" && "nativeEvent" in event;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/useRenderElement.mjs
/**
* Renders a Base UI element.
*
* @param element The default HTML element to render. Can be overridden by the `render` prop.
* @param componentProps An object containing the `render` and `className` props to be used for element customization. Other props are ignored.
* @param params Additional parameters for rendering the element.
*/
function useRenderElement(element, componentProps, params = {}) {
	const renderProp = componentProps.render;
	const outProps = useRenderElementProps(componentProps, params);
	if (params.enabled === false) return null;
	return evaluateRenderProp(element, renderProp, outProps, params.state ?? EMPTY_OBJECT);
}
/**
* Computes render element final props.
*/
function useRenderElementProps(componentProps, params = {}) {
	const { className: classNameProp, style: styleProp, render: renderProp } = componentProps;
	const { state = EMPTY_OBJECT, ref, props, stateAttributesMapping: stateAttributesMapping$3, enabled = true } = params;
	const className = enabled ? resolveClassName(classNameProp, state) : void 0;
	const style = enabled ? resolveStyle(styleProp, state) : void 0;
	const stateProps = enabled ? getStateAttributesProps(state, stateAttributesMapping$3) : EMPTY_OBJECT;
	const resolvedProps = enabled && props ? resolveRenderFunctionProps(props) : void 0;
	const outProps = enabled ? mergeObjects(stateProps, resolvedProps) ?? {} : EMPTY_OBJECT;
	if (typeof document !== "undefined") if (!enabled) useMergedRefs(null, null);
	else if (Array.isArray(ref)) outProps.ref = useMergedRefsN([
		outProps.ref,
		getReactElementRef(renderProp),
		...ref
	]);
	else outProps.ref = useMergedRefs(outProps.ref, getReactElementRef(renderProp), ref);
	if (!enabled) return EMPTY_OBJECT;
	if (className !== void 0) outProps.className = mergeClassNames(outProps.className, className);
	if (style !== void 0) outProps.style = mergeObjects(outProps.style, style);
	return outProps;
}
function resolveRenderFunctionProps(props) {
	if (Array.isArray(props)) return mergePropsN(props);
	return mergeProps(void 0, props);
}
const REACT_LAZY_TYPE = Symbol.for("react.lazy");
function evaluateRenderProp(element, render, props, state) {
	if (render) {
		if (typeof render === "function") return render(props, state);
		const mergedProps = mergeProps(props, render.props);
		mergedProps.ref = props.ref;
		let newElement = render;
		if (newElement?.$$typeof === REACT_LAZY_TYPE) newElement = react.Children.toArray(render)[0];
		return /* @__PURE__ */ react.cloneElement(newElement, mergedProps);
	}
	if (element) {
		if (typeof element === "string") return renderTag(element, props);
	}
	throw new Error(formatErrorMessage_default(8));
}
function renderTag(Tag, props) {
	if (Tag === "button") return /* @__PURE__ */ (0, react.createElement)("button", {
		type: "button",
		...props,
		key: props.key
	});
	if (Tag === "img") return /* @__PURE__ */ (0, react.createElement)("img", {
		alt: "",
		...props,
		key: props.key
	});
	return /* @__PURE__ */ react.createElement(Tag, props);
}

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/useControlled.mjs
function useControlled({ controlled, default: defaultProp, name, state = "value" }) {
	const { current: isControlled } = react.useRef(controlled !== void 0);
	const [valueState, setValue] = react.useState(defaultProp);
	return [isControlled ? controlled : valueState, react.useCallback((newValue) => {
		if (!isControlled) setValue(newValue);
	}, [])];
}

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/useId.mjs
let globalId = 0;
function useGlobalId(idOverride, prefix = "mui") {
	const [defaultId, setDefaultId] = react.useState(idOverride);
	const id = idOverride || defaultId;
	react.useEffect(() => {
		if (defaultId == null) {
			globalId += 1;
			setDefaultId(`${prefix}-${globalId}`);
		}
	}, [defaultId, prefix]);
	return id;
}
const maybeReactUseId = SafeReact.useId;
/**
*
* @example <div id={useId()} />
* @param idOverride
* @returns {string}
*/
function useId(idOverride, prefix) {
	if (maybeReactUseId !== void 0) {
		const reactId = maybeReactUseId();
		return idOverride ?? (prefix ? `${prefix}-${reactId}` : reactId);
	}
	return useGlobalId(idOverride, prefix);
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/useBaseUiId.mjs
/**
* Wraps `useId` and prefixes generated `id`s with `base-ui-`
* @param {string | undefined} idOverride overrides the generated id when provided
* @returns {string | undefined}
*/
function useBaseUiId(idOverride) {
	return useId(idOverride, "base-ui");
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/reason-parts.mjs
const none = "none";
const triggerPress = "trigger-press";
const triggerHover = "trigger-hover";
const outsidePress = "outside-press";
const closePress = "close-press";
const focusOut = "focus-out";
const escapeKey = "escape-key";
const disabled = "disabled";
const missing = "missing";
const initial = "initial";
const imperativeAction = "imperative-action";

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/createBaseUIEventDetails.mjs
/**
* Maps a change `reason` string to the corresponding native event type.
*/
/**
* Details of custom change events emitted by Base UI components.
*/
/**
* Details of custom generic events emitted by Base UI components.
*/
/**
* Creates a Base UI event details object with the given reason and utilities
* for preventing Base UI's internal event handling.
*/
function createChangeEventDetails(reason, event, trigger, customProperties) {
	let canceled = false;
	let allowPropagation = false;
	const custom = customProperties ?? EMPTY_OBJECT;
	return {
		reason,
		event: event ?? new Event("base-ui"),
		cancel() {
			canceled = true;
		},
		allowPropagation() {
			allowPropagation = true;
		},
		get isCanceled() {
			return canceled;
		},
		get isPropagationAllowed() {
			return allowPropagation;
		},
		trigger,
		...custom
	};
}

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/useIsoLayoutEffect.mjs
const noop = () => {};
const useIsoLayoutEffect = typeof document !== "undefined" ? react.useLayoutEffect : noop;

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/useOnMount.mjs
/**
* A React.useEffect equivalent that runs once, when the component is mounted.
*/
function useOnMount(fn) {
	react.useEffect(fn, EMPTY_ARRAY);
}

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/useAnimationFrame.mjs
/** Unlike `setTimeout`, rAF doesn't guarantee a positive integer return value, so we can't have
* a monomorphic `uint` type with `0` meaning empty.
* See warning note at:
* https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame#return_value */
const EMPTY$1 = null;
globalThis.requestAnimationFrame;
var Scheduler = class {
	callbacks = [];
	callbacksCount = 0;
	nextId = 1;
	startId = 1;
	isScheduled = false;
	tick = (timestamp) => {
		this.isScheduled = false;
		const currentCallbacks = this.callbacks;
		const currentCallbacksCount = this.callbacksCount;
		this.callbacks = [];
		this.callbacksCount = 0;
		this.startId = this.nextId;
		if (currentCallbacksCount > 0) for (let i = 0; i < currentCallbacks.length; i += 1) currentCallbacks[i]?.(timestamp);
	};
	request(fn) {
		const id = this.nextId;
		this.nextId += 1;
		this.callbacks.push(fn);
		this.callbacksCount += 1;
		if (!this.isScheduled || false) {
			requestAnimationFrame(this.tick);
			this.isScheduled = true;
		}
		return id;
	}
	cancel(id) {
		const index$1 = id - this.startId;
		if (index$1 < 0 || index$1 >= this.callbacks.length) return;
		this.callbacks[index$1] = null;
		this.callbacksCount -= 1;
	}
};
let scheduler = new Scheduler();
var AnimationFrame = class AnimationFrame {
	static create() {
		return new AnimationFrame();
	}
	static request(fn) {
		return scheduler.request(fn);
	}
	static cancel(id) {
		return scheduler.cancel(id);
	}
	currentId = EMPTY$1;
	/**
	* Executes `fn` after `delay`, clearing any previously scheduled call.
	*/
	request(fn) {
		this.cancel();
		this.currentId = scheduler.request(() => {
			this.currentId = EMPTY$1;
			fn();
		});
	}
	cancel = () => {
		if (this.currentId !== EMPTY$1) {
			scheduler.cancel(this.currentId);
			this.currentId = EMPTY$1;
		}
	};
	disposeEffect = () => {
		return this.cancel;
	};
};
/**
* A `requestAnimationFrame` with automatic cleanup and guard.
*/
function useAnimationFrame() {
	const timeout = useRefWithInit(AnimationFrame.create).current;
	useOnMount(timeout.disposeEffect);
	return timeout;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/useTransitionStatus.mjs
/**
* Provides a status string for CSS animations.
* @param open - a boolean that determines if the element is open.
* @param enableIdleState - a boolean that enables the `'idle'` state between `'starting'` and `'ending'`
*/
function useTransitionStatus(open, enableIdleState = false, deferEndingState = false) {
	const [transitionStatus, setTransitionStatus] = react.useState(open && enableIdleState ? "idle" : void 0);
	const [mounted, setMounted] = react.useState(open);
	if (open && !mounted) {
		setMounted(true);
		setTransitionStatus("starting");
	}
	if (!open && mounted && transitionStatus !== "ending" && !deferEndingState) setTransitionStatus("ending");
	if (!open && !mounted && transitionStatus === "ending") setTransitionStatus(void 0);
	useIsoLayoutEffect(() => {
		if (!open && mounted && transitionStatus !== "ending" && deferEndingState) {
			const frame = AnimationFrame.request(() => {
				setTransitionStatus("ending");
			});
			return () => {
				AnimationFrame.cancel(frame);
			};
		}
	}, [
		open,
		mounted,
		transitionStatus,
		deferEndingState
	]);
	useIsoLayoutEffect(() => {
		if (!open || enableIdleState) return;
		const frame = AnimationFrame.request(() => {
			setTransitionStatus(void 0);
		});
		return () => {
			AnimationFrame.cancel(frame);
		};
	}, [enableIdleState, open]);
	useIsoLayoutEffect(() => {
		if (!open || !enableIdleState) return;
		if (open && mounted && transitionStatus !== "idle") setTransitionStatus("starting");
		const frame = AnimationFrame.request(() => {
			setTransitionStatus("idle");
		});
		return () => {
			AnimationFrame.cancel(frame);
		};
	}, [
		enableIdleState,
		open,
		mounted,
		transitionStatus
	]);
	return {
		mounted,
		setMounted,
		transitionStatus
	};
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/collapsible/root/useCollapsibleRoot.mjs
function useCollapsibleRoot(parameters) {
	const { open: openParam, defaultOpen, onOpenChange, disabled: disabled$1 } = parameters;
	const [open, setOpen] = useControlled({
		controlled: openParam,
		default: defaultOpen,
		name: "Collapsible",
		state: "open"
	});
	const { mounted, setMounted, transitionStatus } = useTransitionStatus(open, true, true);
	const defaultPanelId = useBaseUiId();
	const [registeredPanelId, setPanelIdState] = react.useState();
	const panelId = registeredPanelId === null ? void 0 : registeredPanelId ?? defaultPanelId;
	const handleTrigger = useStableCallback((event) => {
		const nextOpen = !open;
		const eventDetails = createChangeEventDetails(triggerPress, event.nativeEvent);
		onOpenChange(nextOpen, eventDetails);
		if (eventDetails.isCanceled) return;
		setOpen(nextOpen);
	});
	return react.useMemo(() => ({
		defaultPanelId,
		disabled: disabled$1,
		handleTrigger,
		mounted,
		open,
		panelId,
		setMounted,
		setOpen,
		setPanelIdState,
		transitionStatus
	}), [
		defaultPanelId,
		disabled$1,
		handleTrigger,
		mounted,
		open,
		panelId,
		setMounted,
		setOpen,
		setPanelIdState,
		transitionStatus
	]);
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/collapsible/root/CollapsibleRootContext.mjs
const CollapsibleRootContext = /* @__PURE__ */ react.createContext(void 0);
function useCollapsibleRootContext() {
	const context = react.useContext(CollapsibleRootContext);
	if (context === void 0) throw new Error(formatErrorMessage_default(15));
	return context;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/stateAttributesMapping.mjs
let TransitionStatusDataAttributes = /* @__PURE__ */ function(TransitionStatusDataAttributes$1) {
	/**
	* Present when the component begins animating in.
	*/
	TransitionStatusDataAttributes$1["startingStyle"] = "data-starting-style";
	/**
	* Present when the component is animating out.
	*/
	TransitionStatusDataAttributes$1["endingStyle"] = "data-ending-style";
	return TransitionStatusDataAttributes$1;
}({});
const STARTING_HOOK = { "data-starting-style": "" };
const ENDING_HOOK = { "data-ending-style": "" };
const transitionStatusMapping = { transitionStatus(value) {
	if (value === "starting") return STARTING_HOOK;
	if (value === "ending") return ENDING_HOOK;
	return null;
} };

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/collapsible/panel/CollapsiblePanelDataAttributes.mjs
let CollapsiblePanelDataAttributes = function(CollapsiblePanelDataAttributes$1) {
	/**
	* Present when the collapsible panel is open.
	*/
	CollapsiblePanelDataAttributes$1["open"] = "data-open";
	/**
	* Present when the collapsible panel is closed.
	*/
	CollapsiblePanelDataAttributes$1["closed"] = "data-closed";
	/**
	* Present when the panel begins animating in.
	*/
	CollapsiblePanelDataAttributes$1[CollapsiblePanelDataAttributes$1["startingStyle"] = TransitionStatusDataAttributes.startingStyle] = "startingStyle";
	/**
	* Present when the panel is animating out.
	*/
	CollapsiblePanelDataAttributes$1[CollapsiblePanelDataAttributes$1["endingStyle"] = TransitionStatusDataAttributes.endingStyle] = "endingStyle";
	return CollapsiblePanelDataAttributes$1;
}({});

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/collapsible/trigger/CollapsibleTriggerDataAttributes.mjs
let CollapsibleTriggerDataAttributes = /* @__PURE__ */ function(CollapsibleTriggerDataAttributes$1) {
	/**
	* Present when the collapsible panel is open.
	*/
	CollapsibleTriggerDataAttributes$1["panelOpen"] = "data-panel-open";
	return CollapsibleTriggerDataAttributes$1;
}({});

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/utils/collapsibleOpenStateMapping.mjs
const PANEL_OPEN_HOOK = { [CollapsiblePanelDataAttributes.open]: "" };
const PANEL_CLOSED_HOOK = { [CollapsiblePanelDataAttributes.closed]: "" };
const triggerOpenStateMapping$1 = { open(value) {
	if (value) return { [CollapsibleTriggerDataAttributes.panelOpen]: "" };
	return null;
} };
const collapsibleOpenStateMapping = { open(value) {
	if (value) return PANEL_OPEN_HOOK;
	return PANEL_CLOSED_HOOK;
} };

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/collapsible/root/stateAttributesMapping.mjs
const collapsibleStateAttributesMapping = {
	...collapsibleOpenStateMapping,
	...transitionStatusMapping
};

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/collapsible/root/CollapsibleRoot.mjs
/**
* Groups all parts of the collapsible.
* Renders a `<div>` element.
*
* Documentation: [Base UI Collapsible](https://base-ui.com/react/components/collapsible)
*/
const CollapsibleRoot = /* @__PURE__ */ react.forwardRef(function CollapsibleRoot$1(componentProps, forwardedRef) {
	const { render, className, defaultOpen = false, disabled: disabled$1 = false, onOpenChange: onOpenChangeProp, open, style,...elementProps } = componentProps;
	const onOpenChange = useStableCallback(onOpenChangeProp);
	const collapsible = useCollapsibleRoot({
		open,
		defaultOpen,
		onOpenChange,
		disabled: disabled$1
	});
	const state = react.useMemo(() => ({
		open: collapsible.open,
		disabled: collapsible.disabled,
		transitionStatus: collapsible.transitionStatus
	}), [
		collapsible.open,
		collapsible.disabled,
		collapsible.transitionStatus
	]);
	const contextValue = react.useMemo(() => ({
		...collapsible,
		onOpenChange,
		state
	}), [
		collapsible,
		onOpenChange,
		state
	]);
	const element = useRenderElement("div", componentProps, {
		state,
		ref: forwardedRef,
		props: elementProps,
		stateAttributesMapping: collapsibleStateAttributesMapping
	});
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CollapsibleRootContext.Provider, {
		value: contextValue,
		children: element
	});
});

//#endregion
//#region node_modules/.pnpm/@floating-ui+utils@0.2.12/node_modules/@floating-ui/utils/dist/floating-ui.utils.dom.mjs
function hasWindow() {
	return typeof window !== "undefined";
}
function getNodeName(node) {
	if (isNode(node)) return (node.nodeName || "").toLowerCase();
	return "#document";
}
function getWindow(node) {
	var _node$ownerDocument;
	return (node == null || (_node$ownerDocument = node.ownerDocument) == null ? void 0 : _node$ownerDocument.defaultView) || window;
}
function getDocumentElement(node) {
	var _ref;
	return (_ref = (isNode(node) ? node.ownerDocument : node.document) || window.document) == null ? void 0 : _ref.documentElement;
}
function isNode(value) {
	if (!hasWindow()) return false;
	return value instanceof Node || value instanceof getWindow(value).Node;
}
function isElement(value) {
	if (!hasWindow()) return false;
	return value instanceof Element || value instanceof getWindow(value).Element;
}
function isHTMLElement(value) {
	if (!hasWindow()) return false;
	return value instanceof HTMLElement || value instanceof getWindow(value).HTMLElement;
}
function isShadowRoot(value) {
	if (!hasWindow() || typeof ShadowRoot === "undefined") return false;
	return value instanceof ShadowRoot || value instanceof getWindow(value).ShadowRoot;
}
function isOverflowElement(element) {
	const { overflow, overflowX, overflowY, display } = getComputedStyle$1(element);
	return /auto|scroll|overlay|hidden|clip/.test(overflow + overflowY + overflowX) && display !== "inline" && display !== "contents";
}
function isTableElement(element) {
	return /^(table|td|th)$/.test(getNodeName(element));
}
function isTopLayer(element) {
	try {
		if (element.matches(":popover-open")) return true;
	} catch (_e) {}
	try {
		return element.matches(":modal");
	} catch (_e) {
		return false;
	}
}
const willChangeRe = /transform|translate|scale|rotate|perspective|filter/;
const containRe = /paint|layout|strict|content/;
const isNotNone = (value) => !!value && value !== "none";
let isWebKitValue;
function isContainingBlock(elementOrCss) {
	const css = isElement(elementOrCss) ? getComputedStyle$1(elementOrCss) : elementOrCss;
	return isNotNone(css.transform) || isNotNone(css.translate) || isNotNone(css.scale) || isNotNone(css.rotate) || isNotNone(css.perspective) || !isWebKit() && (isNotNone(css.backdropFilter) || isNotNone(css.filter)) || willChangeRe.test(css.willChange || "") || containRe.test(css.contain || "");
}
function getContainingBlock(element) {
	let currentNode = getParentNode(element);
	while (isHTMLElement(currentNode) && !isLastTraversableNode(currentNode)) {
		if (isContainingBlock(currentNode)) return currentNode;
		else if (isTopLayer(currentNode)) return null;
		currentNode = getParentNode(currentNode);
	}
	return null;
}
function isWebKit() {
	if (isWebKitValue == null) isWebKitValue = typeof CSS !== "undefined" && CSS.supports && CSS.supports("-webkit-backdrop-filter", "none");
	return isWebKitValue;
}
function isLastTraversableNode(node) {
	return /^(html|body|#document)$/.test(getNodeName(node));
}
function getComputedStyle$1(element) {
	return getWindow(element).getComputedStyle(element);
}
function getNodeScroll(element) {
	if (isElement(element)) return {
		scrollLeft: element.scrollLeft,
		scrollTop: element.scrollTop
	};
	return {
		scrollLeft: element.scrollX,
		scrollTop: element.scrollY
	};
}
function getParentNode(node) {
	if (getNodeName(node) === "html") return node;
	const result = node.assignedSlot || node.parentNode || isShadowRoot(node) && node.host || getDocumentElement(node);
	return isShadowRoot(result) ? result.host : result;
}
function getNearestOverflowAncestor(node) {
	const parentNode = getParentNode(node);
	if (isLastTraversableNode(parentNode)) return (node.ownerDocument || node).body;
	if (isHTMLElement(parentNode) && isOverflowElement(parentNode)) return parentNode;
	return getNearestOverflowAncestor(parentNode);
}
function getOverflowAncestors(node, list, traverseIframes) {
	var _node$ownerDocument2;
	if (list === void 0) list = [];
	if (traverseIframes === void 0) traverseIframes = true;
	const scrollableAncestor = getNearestOverflowAncestor(node);
	const isBody = scrollableAncestor === ((_node$ownerDocument2 = node.ownerDocument) == null ? void 0 : _node$ownerDocument2.body);
	const win = getWindow(scrollableAncestor);
	if (isBody) {
		const frameElement = getFrameElement(win);
		return list.concat(win, win.visualViewport || [], isOverflowElement(scrollableAncestor) ? scrollableAncestor : [], frameElement && traverseIframes ? getOverflowAncestors(frameElement) : []);
	} else return list.concat(scrollableAncestor, getOverflowAncestors(scrollableAncestor, [], traverseIframes));
}
function getFrameElement(win) {
	return win.parent && Object.getPrototypeOf(win.parent) ? win.frameElement : null;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/composite/root/CompositeRootContext.mjs
const CompositeRootContext = /* @__PURE__ */ react.createContext(void 0);
function useCompositeRootContext(optional = false) {
	const context = react.useContext(CompositeRootContext);
	if (context === void 0 && !optional) throw new Error(formatErrorMessage_default(16));
	return context;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/utils/useFocusableWhenDisabled.mjs
function useFocusableWhenDisabled(parameters) {
	const { focusableWhenDisabled, disabled: disabled$1, composite = false, tabIndex: tabIndexProp = 0, isNativeButton } = parameters;
	const isFocusableComposite = composite && focusableWhenDisabled !== false;
	const isNonFocusableComposite = composite && focusableWhenDisabled === false;
	return { props: react.useMemo(() => {
		const additionalProps = { onKeyDown(event) {
			if (disabled$1 && focusableWhenDisabled && event.key !== "Tab") event.preventDefault();
		} };
		if (!composite) {
			additionalProps.tabIndex = tabIndexProp;
			if (!isNativeButton && disabled$1) additionalProps.tabIndex = focusableWhenDisabled ? tabIndexProp : -1;
		}
		if (isNativeButton && (focusableWhenDisabled || isFocusableComposite) || !isNativeButton && disabled$1) additionalProps["aria-disabled"] = disabled$1;
		if (isNativeButton && (!focusableWhenDisabled || isNonFocusableComposite)) additionalProps.disabled = disabled$1;
		return additionalProps;
	}, [
		composite,
		disabled$1,
		focusableWhenDisabled,
		isFocusableComposite,
		isNonFocusableComposite,
		isNativeButton,
		tabIndexProp
	]) };
}

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/owner.mjs
function ownerDocument(node) {
	return node?.ownerDocument || document;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/utils/dispatchClickWithModifiers.mjs
/**
* Dispatches a constructed click on the target so it carries the source event's
* modifier state, which `click()` always reports as unpressed. Like `click()`,
* the untrusted click still runs native activation behavior (form submission,
* link navigation).
* `detail` defaults to 0 (the native convention for keyboard-generated clicks);
* pass `detail: 1` when the click represents a mouse gesture so consumers keying
* off `detail === 0` don't classify it as a keyboard activation.
*/
function dispatchClickWithModifiers(target, sourceEvent, { detail = 0 } = {}) {
	target.dispatchEvent(new (getWindow(target)).PointerEvent("click", {
		bubbles: true,
		cancelable: true,
		composed: true,
		detail,
		shiftKey: sourceEvent.shiftKey,
		ctrlKey: sourceEvent.ctrlKey,
		altKey: sourceEvent.altKey,
		metaKey: sourceEvent.metaKey
	}));
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/use-button/useButton.mjs
function useButton(parameters = {}) {
	const { disabled: disabled$1 = false, focusableWhenDisabled, tabIndex = 0, native: isNativeButton = true, composite: compositeProp } = parameters;
	const elementRef = react.useRef(null);
	const compositeRootContext = useCompositeRootContext(true);
	const isCompositeItem = compositeProp ?? compositeRootContext !== void 0;
	const { props: focusableWhenDisabledProps } = useFocusableWhenDisabled({
		focusableWhenDisabled,
		disabled: disabled$1,
		composite: isCompositeItem,
		tabIndex,
		isNativeButton
	});
	const updateDisabled = react.useCallback(() => {
		const element = elementRef.current;
		if (!isButtonElement(element)) return;
		if (isCompositeItem && disabled$1 && focusableWhenDisabledProps.disabled === void 0 && element.disabled) element.disabled = false;
	}, [
		disabled$1,
		focusableWhenDisabledProps.disabled,
		isCompositeItem
	]);
	useIsoLayoutEffect(updateDisabled, [updateDisabled]);
	return {
		getButtonProps: react.useCallback((externalProps = {}) => {
			const { onClick: externalOnClick, onMouseDown: externalOnMouseDown, onKeyUp: externalOnKeyUp, onKeyDown: externalOnKeyDown, onPointerDown: externalOnPointerDown,...otherExternalProps } = externalProps;
			return mergeProps({
				onClick(event) {
					if (disabled$1) {
						event.preventDefault();
						return;
					}
					externalOnClick?.(event);
				},
				onMouseDown(event) {
					if (!disabled$1) externalOnMouseDown?.(event);
				},
				onKeyDown(event) {
					if (disabled$1) return;
					makeEventPreventable(event);
					externalOnKeyDown?.(event);
					if (event.baseUIHandlerPrevented) return;
					const isCurrentTarget = event.target === event.currentTarget;
					const currentTarget = event.currentTarget;
					const isButton = isButtonElement(currentTarget);
					const isLink = !isNativeButton && isValidLinkElement(currentTarget);
					const shouldClick = isCurrentTarget && (isNativeButton ? isButton : !isLink);
					const isEnterKey = event.key === "Enter";
					const isSpaceKey = event.key === " ";
					const role = currentTarget.getAttribute("role");
					const isTextNavigationRole = role?.startsWith("menuitem") || role === "option" || role === "gridcell";
					if (isCurrentTarget && isCompositeItem && isSpaceKey) {
						if (event.defaultPrevented && isTextNavigationRole) return;
						event.preventDefault();
						if (!isNativeButton || isButton) {
							event.preventBaseUIHandler();
							dispatchClickWithModifiers(currentTarget, event);
						}
						return;
					}
					if (!shouldClick || isNativeButton || !isSpaceKey && !isEnterKey) {
						if (isCurrentTarget && isLink && isSpaceKey) event.preventDefault();
						return;
					}
					if (event.defaultPrevented) return;
					event.preventDefault();
					if (isEnterKey) {
						event.preventBaseUIHandler();
						dispatchClickWithModifiers(currentTarget, event);
					}
				},
				onKeyUp(event) {
					if (disabled$1) return;
					makeEventPreventable(event);
					externalOnKeyUp?.(event);
					if (event.target === event.currentTarget && isNativeButton && isCompositeItem && isButtonElement(event.currentTarget) && event.key === " ") {
						event.preventDefault();
						return;
					}
					if (event.baseUIHandlerPrevented) return;
					if (event.target === event.currentTarget && !isNativeButton && !isCompositeItem && !event.defaultPrevented && event.key === " ") {
						event.preventBaseUIHandler();
						dispatchClickWithModifiers(event.currentTarget, event);
					}
				},
				onPointerDown(event) {
					if (disabled$1) {
						event.preventDefault();
						return;
					}
					externalOnPointerDown?.(event);
				}
			}, isNativeButton ? { type: "button" } : { role: "button" }, focusableWhenDisabledProps, otherExternalProps);
		}, [
			disabled$1,
			focusableWhenDisabledProps,
			isCompositeItem,
			isNativeButton
		]),
		buttonRef: useStableCallback((element) => {
			elementRef.current = element;
			updateDisabled();
		})
	};
}
function isButtonElement(elem) {
	return isHTMLElement(elem) && elem.tagName === "BUTTON";
}
function isValidLinkElement(elem) {
	return isHTMLElement(elem) && elem.tagName === "A" && Boolean(elem.href);
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/collapsible/trigger/CollapsibleTrigger.mjs
const stateAttributesMapping$2 = {
	...triggerOpenStateMapping$1,
	...transitionStatusMapping
};
/**
* A button that opens and closes the collapsible panel.
* Renders a `<button>` element.
*
* Documentation: [Base UI Collapsible](https://base-ui.com/react/components/collapsible)
*/
const CollapsibleTrigger = /* @__PURE__ */ react.forwardRef(function CollapsibleTrigger$1(componentProps, forwardedRef) {
	const { panelId, open, handleTrigger, state, disabled: contextDisabled } = useCollapsibleRootContext();
	const { className, disabled: disabled$1 = contextDisabled, render, nativeButton = true, style,...elementProps } = componentProps;
	const { getButtonProps, buttonRef } = useButton({
		disabled: disabled$1,
		focusableWhenDisabled: true,
		native: nativeButton
	});
	return useRenderElement("button", componentProps, {
		state,
		ref: [forwardedRef, buttonRef],
		props: [
			{
				"aria-controls": open ? panelId : void 0,
				"aria-expanded": open,
				onClick: handleTrigger
			},
			elementProps,
			getButtonProps
		],
		stateAttributesMapping: stateAttributesMapping$2
	});
});

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/addEventListener.mjs
/**
* Adds an event listener and returns a cleanup function to remove it.
*/
function addEventListener(target, type, listener, options) {
	target.addEventListener(type, listener, options);
	return () => {
		target.removeEventListener(type, listener, options);
	};
}

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/useValueAsRef.mjs
/**
* Untracks the provided value by turning it into a ref to remove its reactivity.
*
* Used to access the passed value inside `React.useEffect` without causing the effect to re-run when the value changes.
*/
function useValueAsRef(value) {
	const latest = useRefWithInit(createLatestRef, value).current;
	latest.next = value;
	useIsoLayoutEffect(latest.effect);
	return latest;
}
function createLatestRef(value) {
	const latest = {
		current: value,
		next: value,
		effect: () => {
			latest.current = latest.next;
		}
	};
	return latest;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/utils/resolveRef.mjs
/**
* If the provided argument is a ref object, returns its `current` value.
* Otherwise, returns the argument itself.
*/
function resolveRef(maybeRef) {
	if (maybeRef == null) return maybeRef;
	return "current" in maybeRef ? maybeRef.current : maybeRef;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/useAnimationsFinished.mjs
/**
* Executes a function once all animations have finished on the provided element.
* If an animation is canceled, waits for any replacement animations before executing.
* @param elementOrRef - The element to watch for animations.
* @param waitForStartingStyleRemoved - Whether to wait for [data-starting-style] to be removed before checking for animations.
* @returns A function that takes a callback to execute once all animations have finished, and an optional AbortSignal to abort the callback
*/
function useAnimationsFinished(elementOrRef, waitForStartingStyleRemoved = false) {
	const frame = useAnimationFrame();
	return useStableCallback((fnToExecute, signal = null) => {
		frame.cancel();
		const element = resolveRef(elementOrRef);
		if (element == null) return;
		const resolvedElement = element;
		const done = () => {
			react_dom.flushSync(fnToExecute);
		};
		if (typeof resolvedElement.getAnimations !== "function" || globalThis.BASE_UI_ANIMATIONS_DISABLED) {
			fnToExecute();
			return;
		}
		function exec() {
			Promise.all(resolvedElement.getAnimations().map((animation) => animation.finished)).then(() => {
				if (!signal?.aborted) done();
			}, () => {
				if (signal?.aborted) return;
				if (resolvedElement.getAnimations().some((animation) => animation.pending || animation.playState !== "finished")) {
					exec();
					return;
				}
				done();
			});
		}
		if (waitForStartingStyleRemoved) {
			const startingStyleAttribute = "data-starting-style";
			if (!resolvedElement.hasAttribute(startingStyleAttribute)) {
				frame.request(exec);
				return;
			}
			const attributeObserver = new MutationObserver(() => {
				if (!resolvedElement.hasAttribute(startingStyleAttribute)) {
					attributeObserver.disconnect();
					exec();
				}
			});
			attributeObserver.observe(resolvedElement, {
				attributes: true,
				attributeFilter: [startingStyleAttribute]
			});
			signal?.addEventListener("abort", () => attributeObserver.disconnect(), { once: true });
			return;
		}
		frame.request(exec);
	});
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/useOpenChangeComplete.mjs
/**
* Calls the provided function when the CSS open/close animation or transition completes.
*/
function useOpenChangeComplete(parameters) {
	const { enabled = true, open, ref, onComplete: onCompleteParam } = parameters;
	const onComplete = useStableCallback(onCompleteParam);
	const runOnceAnimationsFinish = useAnimationsFinished(ref, open);
	react.useEffect(() => {
		if (!enabled) return;
		const abortController = new AbortController();
		runOnceAnimationsFinish(onComplete, abortController.signal);
		return () => {
			abortController.abort();
		};
	}, [
		enabled,
		open,
		onComplete,
		runOnceAnimationsFinish
	]);
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/collapsible/panel/useCollapsiblePanel.mjs
const EMPTY_DIMENSIONS = {
	height: void 0,
	width: void 0
};
function useCollapsiblePanel(parameters) {
	const { externalRef, hiddenUntilFound, id: idParam, keepMounted, mounted, onOpenChange, open, setMounted, setOpen, transitionStatus } = parameters;
	const panelRef = react.useRef(null);
	const animationTypeRef = react.useRef(null);
	const [dimensions, setDimensionsUnwrapped] = react.useState(EMPTY_DIMENSIONS);
	const lastMeasuredDimensionsRef = react.useRef(EMPTY_DIMENSIONS);
	const shouldSkipNextOpenRef = react.useRef(false);
	const shouldPreventMountAnimationRef = react.useRef(open);
	const shouldPreventActivityResumeAnimationRef = react.useRef(false);
	const [forcePanelIdle, setForcePanelIdle] = react.useState(false);
	const pendingTemporaryStyleRestoreRef = react.useRef(null);
	const mergedPanelRef = useMergedRefs(externalRef, panelRef);
	const latestOpenRef = useValueAsRef(open);
	const runOnceCloseAnimationsFinish = useAnimationsFinished(panelRef);
	const hidden = !open && !mounted;
	const panelTransitionStatus = forcePanelIdle ? "idle" : transitionStatus;
	const shouldPreventOpenAnimation = open && (shouldPreventMountAnimationRef.current || shouldPreventActivityResumeAnimationRef.current);
	const renderedDimensions = !open && mounted && animationTypeRef.current === "css-animation" && dimensions.height === void 0 && dimensions.width === void 0 ? lastMeasuredDimensionsRef.current : dimensions;
	const shouldPersistHiddenTransitionStyles = hiddenUntilFound && hidden && animationTypeRef.current !== "css-animation";
	const setDimensions = useStableCallback((nextDimensions, shouldCacheMeasurement = true) => {
		if (shouldCacheMeasurement) lastMeasuredDimensionsRef.current = nextDimensions;
		setDimensionsUnwrapped(nextDimensions);
	});
	const restorePendingTemporaryStyle = useStableCallback(() => {
		pendingTemporaryStyleRestoreRef.current?.();
		pendingTemporaryStyleRestoreRef.current = null;
	});
	const setPendingTemporaryStyleRestore = useStableCallback((restore) => {
		restorePendingTemporaryStyle();
		pendingTemporaryStyleRestoreRef.current = () => {
			pendingTemporaryStyleRestoreRef.current = null;
			restore();
		};
	});
	const markActivityResumeAnimationSuppressed = useStableCallback(() => {
		if (open && mounted && animationTypeRef.current === "css-animation") shouldPreventActivityResumeAnimationRef.current = true;
	});
	useIsoLayoutEffect(() => {
		if (!forcePanelIdle || transitionStatus === "starting") return;
		setForcePanelIdle(false);
	}, [forcePanelIdle, transitionStatus]);
	react.useEffect(() => {
		return () => {
			markActivityResumeAnimationSuppressed();
			restorePendingTemporaryStyle();
		};
	}, [markActivityResumeAnimationSuppressed, restorePendingTemporaryStyle]);
	useIsoLayoutEffect(() => {
		const panel = panelRef.current;
		if (!panel) return;
		if (!open && pendingTemporaryStyleRestoreRef.current) restorePendingTemporaryStyle();
		const animationType = getAnimationType(panel, shouldPreventOpenAnimation);
		animationTypeRef.current = animationType;
		if (open && transitionStatus === "idle" && shouldPreventMountAnimationRef.current && animationType === "css-animation") {
			lastMeasuredDimensionsRef.current = getDimensions$1(panel);
			return;
		}
		if (open && transitionStatus === "starting") {
			const skipNextOpen = shouldSkipNextOpenRef.current;
			shouldSkipNextOpenRef.current = false;
			if (animationType === "none") {
				setDimensions(getDimensions$1(panel));
				setForcePanelIdle(true);
				return;
			}
			if (animationType === "css-transition") {
				const restoreLayoutStyles = resetLayoutStyles(panel);
				setDimensions(getDimensions$1(panel));
				if (!skipNextOpen) return restoreLayoutStyles;
				setPendingTemporaryStyleRestore(setTemporaryStyle(panel, "transition-duration", "0s"));
				setForcePanelIdle(true);
				return restoreLayoutStyles;
			}
			setDimensions(getDimensions$1(panel));
			const restoreAnimationName = setTemporaryStyle(panel, "animation-name", "none");
			if (!skipNextOpen) {
				restoreAnimationName();
				return;
			}
			const restoreAnimationDuration = setTemporaryStyle(panel, "animation-duration", "0s");
			restoreAnimationName();
			setPendingTemporaryStyleRestore(restoreAnimationDuration);
			setForcePanelIdle(true);
			return;
		}
		if (!open && mounted && (transitionStatus === "idle" || transitionStatus === "starting")) {
			shouldPreventMountAnimationRef.current = false;
			shouldPreventActivityResumeAnimationRef.current = false;
			if (animationType === "none") {
				setDimensions(EMPTY_DIMENSIONS, false);
				setMounted(false);
				return;
			}
			setDimensions(getDimensions$1(panel));
			return;
		}
		if (transitionStatus !== "ending") return;
		if (animationType === "none") {
			setMounted(false);
			return;
		}
		const nextDimensions = getDimensions$1(panel);
		if (!(nextDimensions.height > 0 || nextDimensions.width > 0)) {
			setMounted(false);
			return;
		}
		setDimensions(nextDimensions);
		if (animationType === "css-animation") setTemporaryStyle(panel, "animation-name", "none")();
	}, [
		mounted,
		open,
		restorePendingTemporaryStyle,
		setDimensions,
		setMounted,
		setPendingTemporaryStyleRestore,
		shouldPreventOpenAnimation,
		transitionStatus
	]);
	useOpenChangeComplete({
		enabled: open && mounted && panelTransitionStatus === "idle",
		open: true,
		ref: panelRef,
		onComplete() {
			if (!open) return;
			setDimensions(EMPTY_DIMENSIONS, false);
		}
	});
	react.useEffect(() => {
		if (open || !mounted || panelTransitionStatus !== "ending") return;
		if (!panelRef.current) return;
		const abortController = new AbortController();
		let endingStyleFrame = -1;
		function handleComplete() {
			if (latestOpenRef.current) return;
			setMounted(false);
			setDimensions(EMPTY_DIMENSIONS, false);
		}
		endingStyleFrame = AnimationFrame.request(() => {
			runOnceCloseAnimationsFinish(handleComplete, abortController.signal);
		});
		return () => {
			AnimationFrame.cancel(endingStyleFrame);
			abortController.abort();
		};
	}, [
		latestOpenRef,
		mounted,
		open,
		panelTransitionStatus,
		runOnceCloseAnimationsFinish,
		setDimensions,
		setMounted
	]);
	useIsoLayoutEffect(() => {
		const panel = panelRef.current;
		if (!panel || !hiddenUntilFound || !hidden) return;
		panel.setAttribute("hidden", "until-found");
	}, [hidden, hiddenUntilFound]);
	react.useEffect(function registerBeforeMatchListener() {
		const panel = panelRef.current;
		if (!panel) return;
		function handleBeforeMatch(event) {
			const eventDetails = createChangeEventDetails(none, event);
			onOpenChange(true, eventDetails);
			if (eventDetails.isCanceled) return;
			shouldSkipNextOpenRef.current = true;
			setOpen(true);
		}
		return addEventListener(panel, "beforematch", handleBeforeMatch);
	}, [onOpenChange, setOpen]);
	const shouldRender = keepMounted || hiddenUntilFound || mounted || open;
	return {
		height: renderedDimensions.height,
		props: {
			...shouldPersistHiddenTransitionStyles ? { [CollapsiblePanelDataAttributes.startingStyle]: "" } : void 0,
			hidden,
			id: idParam
		},
		ref: mergedPanelRef,
		shouldPreventOpenAnimation,
		shouldRender,
		transitionStatus: panelTransitionStatus,
		width: renderedDimensions.width
	};
}
function getDimensions$1(element) {
	return {
		height: element.scrollHeight,
		width: element.scrollWidth
	};
}
function getAnimationType(element, hasSuppressedMountAnimation) {
	const panelStyles = getWindow(element).getComputedStyle(element);
	const hasAnimation = (panelStyles.animationName.split(",").map((name) => name.trim()).some((name) => name !== "" && name !== "none") || hasSuppressedMountAnimation) && hasNonZeroDuration(panelStyles.animationDuration);
	const hasTransition = hasNonZeroDuration(panelStyles.transitionDuration);
	if (hasAnimation && hasTransition) return "css-transition";
	if (hasTransition) return "css-transition";
	if (hasAnimation) return "css-animation";
	return "none";
}
function hasNonZeroDuration(value) {
	return value.split(",").map((part) => part.trim()).some((part) => part !== "" && Number.parseFloat(part) > 0);
}
/**
* Temporarily overrides an inline style property and returns a cleanup that
* restores the previous inline value and priority.
* @param element - The element whose inline style should be updated.
* @param property - The CSS property name to override.
* @param value - The temporary value to assign.
* @returns A cleanup function that restores the original inline style state.
*/
function setTemporaryStyle(element, property, value) {
	const previousValue = element.style.getPropertyValue(property);
	const previousPriority = element.style.getPropertyPriority(property);
	element.style.setProperty(property, value);
	return () => {
		if (previousValue === "") {
			element.style.removeProperty(property);
			return;
		}
		element.style.setProperty(property, previousValue, previousPriority);
	};
}
/**
* Temporarily resets inline alignment styles that can distort scroll-based
* size measurements, then restores them on the next animation frame.
* @param element - The panel element being measured.
* @returns A cleanup function that cancels the scheduled restore and reapplies
* the original inline layout styles immediately.
*/
function resetLayoutStyles(element) {
	const originalLayoutStyles = {
		"justify-content": element.style.justifyContent,
		"align-items": element.style.alignItems,
		"align-content": element.style.alignContent,
		"justify-items": element.style.justifyItems
	};
	Object.keys(originalLayoutStyles).forEach((key) => {
		element.style.setProperty(key, "initial", "important");
	});
	function restoreLayoutStyles() {
		Object.entries(originalLayoutStyles).forEach(([key, value]) => {
			if (value === "") {
				element.style.removeProperty(key);
				return;
			}
			element.style.setProperty(key, value);
		});
	}
	const frame = AnimationFrame.request(restoreLayoutStyles);
	return () => {
		AnimationFrame.cancel(frame);
		restoreLayoutStyles();
	};
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/collapsible/panel/CollapsiblePanelCssVars.mjs
let CollapsiblePanelCssVars = /* @__PURE__ */ function(CollapsiblePanelCssVars$1) {
	/**
	* The collapsible panel's height.
	* @type {number}
	*/
	CollapsiblePanelCssVars$1["collapsiblePanelHeight"] = "--collapsible-panel-height";
	/**
	* The collapsible panel's width.
	* @type {number}
	*/
	CollapsiblePanelCssVars$1["collapsiblePanelWidth"] = "--collapsible-panel-width";
	return CollapsiblePanelCssVars$1;
}({});

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/collapsible/panel/CollapsiblePanel.mjs
/**
* A panel with the collapsible contents.
* Renders a `<div>` element.
*
* Documentation: [Base UI Collapsible](https://base-ui.com/react/components/collapsible)
*/
const CollapsiblePanel = /* @__PURE__ */ react.forwardRef(function CollapsiblePanel$1(componentProps, forwardedRef) {
	const { className, hiddenUntilFound: hiddenUntilFoundProp, keepMounted: keepMountedProp, render, id: idProp, style,...elementProps } = componentProps;
	const { defaultPanelId, mounted, onOpenChange, open, setMounted, setPanelIdState, setOpen, state, transitionStatus } = useCollapsibleRootContext();
	const hiddenUntilFound = hiddenUntilFoundProp ?? false;
	const keepMounted = keepMountedProp ?? false;
	const registeredId = idProp || void 0;
	const id = registeredId ?? defaultPanelId;
	useIsoLayoutEffect(() => {
		setPanelIdState((currentId) => registeredId ?? (currentId === null ? void 0 : currentId));
		return () => {
			setPanelIdState((currentId) => currentId === registeredId ? null : currentId);
		};
	}, [registeredId, setPanelIdState]);
	const { height, props, ref, shouldPreventOpenAnimation, shouldRender, transitionStatus: panelTransitionStatus, width } = useCollapsiblePanel({
		externalRef: forwardedRef,
		hiddenUntilFound,
		id,
		keepMounted,
		mounted,
		onOpenChange,
		open,
		setMounted,
		setOpen,
		transitionStatus
	});
	const panelState = {
		...state,
		transitionStatus: panelTransitionStatus
	};
	const resolvedStyle = resolveStyle(style, panelState);
	const element = useRenderElement("div", {
		...componentProps,
		style: void 0
	}, {
		state: panelState,
		ref,
		props: [
			props,
			{ style: {
				[CollapsiblePanelCssVars.collapsiblePanelHeight]: height === void 0 ? "auto" : `${height}px`,
				[CollapsiblePanelCssVars.collapsiblePanelWidth]: width === void 0 ? "auto" : `${width}px`
			} },
			elementProps,
			resolvedStyle ? { style: resolvedStyle } : void 0,
			shouldPreventOpenAnimation ? { style: { animationName: "none" } } : void 0
		],
		stateAttributesMapping: collapsibleStateAttributesMapping
	});
	if (!shouldRender) return null;
	return element;
});

//#endregion
//#region src/client/icons.ts
/** Rendered when a host generation has neither name: the panel stays usable. */
const MissingIcon = () => null;
/**
* Pick the first export name the host's primitives package actually provides.
* Exported separately from the module-level constants so tests can drive every
* branch with a fake table.
*/
function pickIcon(table$1, modern, legacy) {
	const found = table$1[modern] ?? table$1[legacy];
	return typeof found === "function" ? found : MissingIcon;
}
const table = __deepseek_ai_dsh_client_ui_primitives;
/**
* Every icon the panel renders, with both generations' export names side by
* side: `modern` is the 0.1.7+ stroke-weight name, `legacy` the pixel-suffixed
* name it replaced. Kept as data (instead of being inlined into the constants
* below) so tests can pin each half against the export list that really ships
* it — the modern names against the installed package, the legacy names
* against the last release that still had them.
*/
const ICON_NAME_PAIRS = {
	IconSkill: {
		modern: "IconSkillOutlineRegular",
		legacy: "IconSkillOutline16"
	},
	IconSparkle: {
		modern: "IconSparkleRegular",
		legacy: "IconSparkle16"
	},
	IconCordisPlugin: {
		modern: "IconCordisPluginOutlineRegular",
		legacy: "IconCordisPluginOutline14"
	},
	IconSliders: {
		modern: "IconPersonalizationOutlineRegular",
		legacy: "IconPersonalizationOutline16"
	},
	IconPanelLeft: {
		modern: "IconPanelLeftOutlineRegular",
		legacy: "IconPanelLeftOutline16"
	},
	IconPlus: {
		modern: "IconPlusOutlineRegular",
		legacy: "IconPlusOutline16"
	},
	IconFolderClose: {
		modern: "IconFolderCloseRegular",
		legacy: "IconFolderClose16"
	},
	IconSearch: {
		modern: "IconSearchOutlineRegular",
		legacy: "IconSearchOutline16"
	},
	IconRefresh: {
		modern: "IconRefreshOutlineRegular",
		legacy: "IconRefreshOutline14"
	},
	IconChevronDown: {
		modern: "IconChevronDownOutlineRegular",
		legacy: "IconChevronDownOutline14"
	},
	IconChevronUp: {
		modern: "IconChevronUpOutlineRegular",
		legacy: "IconChevronUpOutline14"
	},
	IconSettings: {
		modern: "IconSettingsOutlineMedium",
		legacy: "IconSettingsOutline16"
	},
	IconTriangleRight: {
		modern: "IconTriangleRightFillRegular",
		legacy: "IconTriangleRightFill14"
	}
};
/** Resolve one pair against the host's own export table. */
function resolveIcon(pair) {
	return pickIcon(table, pair.modern, pair.legacy);
}
const IconSkill = resolveIcon(ICON_NAME_PAIRS.IconSkill);
const IconSparkle = resolveIcon(ICON_NAME_PAIRS.IconSparkle);
const IconCordisPlugin = resolveIcon(ICON_NAME_PAIRS.IconCordisPlugin);
const IconSliders = resolveIcon(ICON_NAME_PAIRS.IconSliders);
const IconPanelLeft = resolveIcon(ICON_NAME_PAIRS.IconPanelLeft);
const IconPlus = resolveIcon(ICON_NAME_PAIRS.IconPlus);
const IconFolderClose = resolveIcon(ICON_NAME_PAIRS.IconFolderClose);
const IconSearch = resolveIcon(ICON_NAME_PAIRS.IconSearch);
const IconRefresh = resolveIcon(ICON_NAME_PAIRS.IconRefresh);
const IconChevronDown = resolveIcon(ICON_NAME_PAIRS.IconChevronDown);
const IconChevronUp = resolveIcon(ICON_NAME_PAIRS.IconChevronUp);
const IconSettings = resolveIcon(ICON_NAME_PAIRS.IconSettings);
const IconTriangleRight = resolveIcon(ICON_NAME_PAIRS.IconTriangleRight);
/**
* Whether the host ships the 0.1.7 stroke-weight icon set. Exported as a
* function so tests can drive both branches; the module constant resolves it
* against the real package.
*
* One consumer: the footer settings entry. The `settings.open` keybinding that
* entry drives shipped in the SAME host generation as the renamed icon set
* (verified: 0.1.6's settings bundle has no such binding), so this is the
* closest client-visible signal that the shortcut exists. If a future host
* renames icons again this reads false and the entry hides — the safe
* direction.
*/
function hasModernShell(table$1) {
	return typeof table$1["IconSettingsOutlineRegular"] === "function";
}
const HOST_HAS_MODERN_SHELL = hasModernShell(table);

//#endregion
//#region src/client/disclosure-row.ts
/**
* The disclosure chevron, taken from the host's icon set instead of drawn here.
*
* The host's own DisclosureRow primitive — the same affordance, used by the
* conversation, cordis, tool and workflow surfaces — points a DOWN chevron while
* the row is closed and an UP chevron while it is open, at the host icons'
* default 14px. Drawn here, it was a 12px path with a 1.4px stroke: a geometry
* no host surface uses, which reads as a foreign glyph next to the host's own.
*
* Kept in one place because the two panels had already drifted apart in
* geometry once — exactly the failure a shared control prevents.
*/
function chevronIcon(open) {
	return open ? react.createElement(IconChevronUp, { size: 14 }) : react.createElement(IconChevronDown, { size: 14 });
}
/**
* The row's leading box, laid out exactly like the host's `DisclosureRow`: one
* fixed 18px square holds BOTH the domain glyph and the disclosure chevron, and
* hovering the row swaps the glyph out for the chevron in place. Two reasons to
* copy that instead of adding a second box:
*
*  - no layout shift — the box never changes size, so nothing reflows on hover;
*  - a list of rows reads as named capabilities rather than as a column of
*    arrows, which is what an always-visible chevron per row produces.
*
* While the row is OPEN the host shows the chevron alone (its `leading` is the
* up-chevron, not the glyph), so the same swap is mirrored here.
*/
function leadingBox(children) {
	return react.createElement("span", {
		className: "ci-leading",
		"aria-hidden": true
	}, children);
}
function glyph(className, child, key) {
	return react.createElement("span", {
		className,
		"aria-hidden": true,
		...key === void 0 ? {} : { key }
	}, child);
}
/** The leading slot for a row that has a domain glyph. */
function glyphLeading(icon, open) {
	if (open) return leadingBox(glyph("ci-chevron", chevronIcon(true)));
	return leadingBox([glyph("ci-row-icon", icon, "icon"), glyph("ci-chevron ci-chevron-hover", chevronIcon(false), "chevron")]);
}
/** The leading slot for a row with no glyph: the chevron, as before. */
function chevronLeading(open) {
	return react.createElement("span", {
		className: "ci-chevron",
		"aria-hidden": true
	}, chevronIcon(open));
}
/**
* The leading slot of one expandable row.
*
* Exported so the panel's own row builder — which needs the same slot in a
* different component tree — renders it from here instead of re-implementing
* it. That is the drift this module exists to prevent: the two panels once
* carried two different chevrons.
*/
function leadingFor(icon, open) {
	return icon === void 0 ? chevronLeading(open) : glyphLeading(icon, open);
}
/** The leading slot of a row with nothing to reveal: the glyph alone. */
function leadingStatic(icon) {
	return leadingBox(glyph("ci-row-icon", icon));
}
/**
* One capability row that may reveal detail.
*
* Both panels show the same kind of thing — a name, a switch, and detail worth
* hiding until asked for — so both get the same affordance from one place. A
* row with no detail renders no trigger at all rather than an empty one, and
* takes a spacer so its name still lines up with the rows that do.
*/
function disclosureRow(options) {
	const hasIcon = options.icon !== void 0;
	if (!(options.detail !== void 0 && options.detail !== null && options.detail !== "")) return react.createElement("div", {
		className: options.className,
		...options.style === void 0 ? {} : { style: options.style }
	}, react.createElement("div", { className: options.headerClassName }, hasIcon ? leadingStatic(options.icon) : react.createElement("span", {
		"aria-hidden": true,
		...options.spacerClassName === void 0 ? { style: {
			width: "18px",
			flex: "none"
		} } : { className: options.spacerClassName }
	}), options.heading, ...options.actions));
	const disclosure = resolveDisclosure(options.expanded, options.filtering);
	return react.createElement(CollapsibleRoot, {
		open: disclosure.open,
		onOpenChange: options.onOpenChange,
		className: options.className,
		...options.style === void 0 ? {} : { style: options.style }
	}, react.createElement("div", { className: options.headerClassName }, react.createElement(CollapsibleTrigger, {
		className: "ci-disclosure-trigger",
		disabled: disclosure.disabled,
		"aria-label": options.triggerLabel
	}, hasIcon ? leadingFor(options.icon, disclosure.open) : chevronLeading(disclosure.open), options.heading), ...options.actions), react.createElement(CollapsiblePanel, { className: "ci-collapse" }, options.detail));
}

//#endregion
//#region src/client/locale.ts
/**
* Panel copy, bilingual. Chinese is the authoring language; English is the
* fallback the host's locale runtime consults after the active locale misses
* a key (and the locale a browser naming neither shipped language lands on).
*
* The dictionaries register into the host's locale service (`ctx.locale`)
* under this plugin's own namespace, so the panel follows the same language
* switch as the rest of the UI. Templates interpolate `{name}` placeholders.
*
* tests/client/locale.spec.ts pins the two dictionaries to identical key sets
* and checks every key the component looks up exists in both.
*/
const LOCALE_NS = "capability-panel";
const zh = {
	"state.loaded": "已加载",
	"state.pruned": "已截断",
	"state.evicted": "已挤出",
	"state.unloaded": "未加载",
	"blocked.count": "拦截 ×{count}",
	"action.enable": "开启 {name}",
	"action.disable": "关闭 {name}",
	"action.insert": "把 /{name} 填入输入框",
	"action.preview": "在侧边栏打开 {name} 的指令文件",
	"server.tools": "{count} 工具",
	"server.tool.one": "1 个工具",
	"server.unavailable": "无已注册工具",
	"server.unavailableHint": "宿主配置里声明了这个服务器，但它当前没有注册任何工具。原因无法从面板判定（服务未启动、正在重连、或本就没有工具都可能）。若它是个本地按需服务，先把程序开起来。",
	"action.reload": "重载 {name}",
	"action.reload.label": "重载",
	"action.reload.ing": "正在重载 {name}…",
	"action.reloadHint": "重新加载该服务器的插件实例（等同一次热重载）：会断开并重连。对 stdio 类型的服务，这会重启其子进程。",
	"action.reload.failed": "重载 {name} 失败：{error}",
	"mcp.presetOff": "{count} 个 MCP 服务器由当前 preset 关闭",
	"mcp.presetOffShow": "显示",
	"mcp.presetOffHide": "隐藏",
	"mcp.presetOffAria": "显示或隐藏当前 preset 关闭的 MCP 服务器",
	"status.loading": "读取中…",
	"status.error": "读取失败：{error}（可尝试刷新页面；宿主改动需重启 dsh 后生效）",
	"empty.match": "无匹配项",
	"empty.skills": "无可用技能",
	"empty.mcp": "无 MCP 服务器",
	"empty.system": "无系统工具",
	"group.skills": "技能 ({shown}/{total})",
	"group.mcp": "MCP ({shown}/{total})",
	"group.system": "系统工具 ({shown}/{total})",
	"group.systemTools": "系统工具",
	"group.count": "{shown}/{total}",
	"tab.all": "全部",
	"tab.skills": "技能",
	"tab.mcp": "MCP",
	"tab.system": "工具",
	"tab.system.aria": "系统工具 {count}",
	"tabs.aria": "能力分区",
	"trigger.tooltip": "会话上下文：技能、MCP 与工具",
	"panel.aria": "会话上下文",
	"filter.placeholder": "筛选名称或描述…",
	"filter.aria": "筛选技能与工具",
	"filter.clear": "清空筛选",
	"filter.count": "匹配 {shown} / {total} 项",
	"footer.feedback": "反馈问题",
	"footer.feedbackHint": "在 GitHub 上打开能力面板的 issue 页",
	"footer.openSettings": "全局配置",
	"footer.openSettingsHint": "打开设置并进入「能力面板」页",
	"disclosure.expand": "展开 {subject} 的{detail}",
	"disclosure.collapse": "收起 {subject} 的{detail}",
	"disclosure.pinned": "{subject} 的{detail}（筛选时保持展开）",
	"detail.description": "描述",
	"detail.tools": "工具",
	"preset.nav": "能力面板",
	"preset.title": "能力面板",
	"preset.intro": "设置每个 Agent preset 的默认能力集合，之后新建或恢复的会话会继承它。输入框里的「会话上下文」只改当前会话，并随该会话在重启后恢复。",
	"preset.projectSkill": "当前项目",
	"preset.kindAria": "按类别筛选",
	"preset.readonly": "当前设置存储不可写；你可以查看工具，但无法保存微调。",
	"preset.choose": "Agent preset",
	"preset.empty": "没有可用的 Agent preset。",
	"preset.noTools": "这个 preset 没有可用能力。",
	"preset.reserved": "{name} 是保留的传输通道，不能关闭。",
	"preset.broken": "这个 preset 无法组装会话：{reason}。修好它之后才能列出工具。",
	"degraded.item": "⚠ 部分读取失败：{note}",
	"source.project-dsh": "项目 .dsh",
	"source.project-agents": "项目 agent",
	"source.runtime": "运行时",
	"source.user-dsh": "用户 .dsh",
	"source.user-agents": "用户 agent",
	"source.custom": "自定义",
	"source.bundled": "内置",
	"source.host": "全局",
	"source.preset": "预设",
	"source.openFolder": "在文件管理器中打开 {source}"
};
const en = {
	"state.loaded": "loaded",
	"state.pruned": "truncated",
	"state.evicted": "evicted",
	"state.unloaded": "not loaded",
	"blocked.count": "blocked ×{count}",
	"action.enable": "Enable {name}",
	"action.disable": "Disable {name}",
	"action.insert": "Insert /{name} into the composer",
	"action.preview": "Open the instruction file for {name} in the side panel",
	"server.tools": "{count} tools",
	"server.tool.one": "1 tool",
	"server.unavailable": "no tools registered",
	"server.unavailableHint": "This host declares the server, but it currently registers no tools. The panel cannot tell why (service not started, mid-reconnect, or genuinely tool-less are all possible). If it is a local on-demand service, start its program first.",
	"action.reload": "Reload {name}",
	"action.reload.label": "Reload",
	"action.reload.ing": "Reloading {name}…",
	"action.reloadHint": "Reload this server’s plugin instance (equivalent to one hot reload): it disconnects and reconnects. For a stdio service this restarts its child process.",
	"action.reload.failed": "Failed to reload {name}: {error}",
	"mcp.presetOff": "{count} MCP server(s) off by this preset",
	"mcp.presetOffShow": "Show",
	"mcp.presetOffHide": "Hide",
	"mcp.presetOffAria": "Show or hide the MCP servers this preset switches off",
	"status.loading": "Loading…",
	"status.error": "Failed to load: {error} (try refreshing the page; host changes take effect after a dsh restart)",
	"empty.match": "No matches",
	"empty.skills": "No skills available",
	"empty.mcp": "No MCP servers",
	"empty.system": "No system tools",
	"group.skills": "Skills ({shown}/{total})",
	"group.mcp": "MCP ({shown}/{total})",
	"group.system": "System tools ({shown}/{total})",
	"group.systemTools": "System tools",
	"group.count": "{shown}/{total}",
	"tab.all": "All",
	"tab.skills": "Skills",
	"tab.mcp": "MCP",
	"tab.system": "Tools",
	"tab.system.aria": "System tools, {count}",
	"tabs.aria": "Capability sections",
	"trigger.tooltip": "Session context: skills, MCP & tools",
	"panel.aria": "Session context",
	"filter.placeholder": "Filter by name or description…",
	"filter.aria": "Filter skills and tools",
	"filter.clear": "Clear filter",
	"filter.count": "{shown} / {total} matched",
	"footer.feedback": "Report an issue",
	"footer.feedbackHint": "Open the capability panel’s issues on GitHub",
	"footer.openSettings": "Global settings",
	"footer.openSettingsHint": "Open Settings on the Capability Panel page",
	"disclosure.expand": "Expand {detail} for {subject}",
	"disclosure.collapse": "Collapse {detail} for {subject}",
	"disclosure.pinned": "{detail} for {subject} (kept open while filtering)",
	"detail.description": "description",
	"detail.tools": "tools",
	"preset.nav": "Capability Panel",
	"preset.title": "Capability Panel",
	"preset.intro": "Choose the default capabilities each agent preset starts from; sessions created or resumed afterward inherit it. The composer's Session context changes only the current session, and stays with it across restarts.",
	"preset.projectSkill": "this project",
	"preset.kindAria": "Filter by category",
	"preset.readonly": "Settings storage is read-only. You can inspect tools, but changes cannot be saved.",
	"preset.choose": "Agent preset",
	"preset.empty": "No agent presets are available.",
	"preset.noTools": "This preset exposes no capabilities.",
	"preset.reserved": "{name} is a reserved transport and cannot be disabled.",
	"preset.broken": "This preset cannot compose a session: {reason}. Fix it before its tools can be listed.",
	"degraded.item": "⚠ Partial read failed: {note}",
	"source.project-dsh": "project .dsh",
	"source.project-agents": "project agent",
	"source.runtime": "runtime",
	"source.user-dsh": "user .dsh",
	"source.user-agents": "user agent",
	"source.custom": "custom",
	"source.bundled": "bundled",
	"source.host": "global",
	"source.preset": "preset",
	"source.openFolder": "Open {source} in file manager"
};
/**
* Register both dictionaries as one effect: the single-locale form is the
* documented entry for namespaces outside the host's compile-time merge
* table, and the returned disposers release both on unload.
*/
function registerLocale(locale) {
	const disposeZh = locale.register(LOCALE_NS, "zh", zh);
	const disposeEn = locale.register(LOCALE_NS, "en", en);
	return () => {
		disposeZh();
		disposeEn();
	};
}

//#endregion
//#region src/client/styles.ts
const TOK = {
	textPrimary: "var(--dsw-alias-label-primary, #0f1115)",
	textSecondary: "var(--dsw-alias-label-secondary, #61666b)",
	textTertiary: "var(--dsw-alias-label-tertiary, #81858c)",
	border: "var(--dsw-alias-border-l1, rgba(0,0,0,.04))",
	borderStrong: "var(--dsw-alias-border-l2, rgba(0,0,0,.1))",
	switchOn: "var(--dsw-alias-state-business-primary, #4176e6)",
	switchOff: "var(--dsw-alias-border-l2, rgba(0,0,0,.1))",
	switchThumb: "var(--dsw-alias-bg-layer-1, #ffffff)",
	switchEase: "var(--ds-ease-in-out, cubic-bezier(.4, 0, .2, 1))",
	menuBg: "var(--dsw-specific-menu, #ffffff)",
	menuBorder: "var(--dsw-alias-border-inverted, rgba(0,0,0,.1))",
	menuShadow: "var(--dsw-shadow-lv3, 0 12px 32px rgba(0,0,0,.22))",
	menuBlur: "var(--dsw-menu-backdrop-filter, none)",
	bgBase: "var(--dsw-alias-bg-base, #ffffff)",
	fontFamily: "var(--dsw-font-family, -apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", \"Helvetica Neue\", Helvetica, Arial, sans-serif)",
	success: "var(--dsw-alias-state-success-primary, #22c55e)",
	warn: "var(--dsw-alias-state-warn-primary, #f59e0b)",
	error: "var(--dsw-alias-state-error-primary, #ec1313)",
	info: "var(--dsw-alias-state-business-primary, #4176e6)"
};
const PANEL_CSS = [
	".ci-trigger:focus-visible,.ci-switch:focus-visible,.ci-iconbtn:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4176e6);outline-offset:1px;border-radius:999px}",
	".ci-disclosure-trigger:focus-visible,.ci-server-trigger:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4176e6);outline-offset:1px;border-radius:4px}",
	".ci-tab:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4176e6);outline-offset:1px;border-radius:6px}",
	".ci-trigger:hover,.ci-iconbtn:hover,.ci-server-trigger:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,.06))}",
	".ci-switch:hover:not(:disabled){filter:brightness(1.12)}",
	".ci-row-head{display:flex;align-items:center;gap:8px;padding:6px 8px;margin:0 -8px;border-radius:8px}",
	".ci-row-head:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,.06))}",
	".ci-row-head .ci-send{opacity:0;transition:opacity .12s}",
	".ci-row-head:hover .ci-send,.ci-row-head:focus-within .ci-send{opacity:1}",
	".ci-filter:focus{border-color:var(--dsw-alias-state-business-primary,#4176e6)}",
	".ci-filter:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4176e6);outline-offset:0}",
	".ci-filter::placeholder{color:var(--dsw-alias-label-tertiary,#81858c)}",
	".ci-panel{transform-origin:var(--transform-origin);transition:opacity .14s var(--ds-ease-in-out,ease),transform .14s var(--ds-ease-in-out,ease)}",
	".ci-panel[data-starting-style],.ci-panel[data-ending-style]{opacity:0;transform:scale(.96) translateY(4px)}",
	".ci-collapse{height:var(--collapsible-panel-height);transition:height .14s var(--ds-ease-in-out,ease);overflow:hidden}",
	".ci-collapse[data-starting-style],.ci-collapse[data-ending-style]{height:0}",
	".ci-toolrow{content-visibility:auto;contain-intrinsic-size:auto 30px}",
	".ci-disclosure-trigger{min-width:0;display:flex;align-items:center;gap:6px;flex:1 1 auto;padding:0;border:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}",
	".ci-disclosure-trigger:disabled,.ci-server-trigger:disabled{cursor:default}",
	".ci-disclosure-trigger:hover .ci-name{color:var(--dsw-alias-label-primary,#0f1115)}",
	".ci-description{padding:3px 0 0 24px;line-height:18px;color:var(--dsw-alias-label-tertiary,#81858c);word-break:break-word}",
	".ci-chevron{display:grid;place-items:center;width:18px;height:18px;flex:none;color:var(--dsw-alias-label-tertiary,#81858c);border-radius:4px}",
	".ci-chevron svg{transition:transform .12s var(--ds-ease-in-out,ease)}",
	".ci-leading{position:relative;display:grid;place-items:center;width:18px;height:18px;flex:none;color:var(--dsw-alias-label-tertiary,#81858c)}",
	".ci-leading>.ci-row-icon{display:grid;place-items:center;opacity:1;transition:opacity .12s var(--ds-ease-in-out,ease)}",
	".ci-leading>.ci-chevron-hover{position:absolute;inset:0;margin:auto;display:grid;place-items:center;opacity:0;transition:opacity .12s var(--ds-ease-in-out,ease)}",
	".ci-row-head:hover .ci-leading>.ci-row-icon,.ci-row-head:focus-within .ci-leading>.ci-row-icon{opacity:0}",
	".ci-row-head:hover .ci-leading>.ci-chevron-hover,.ci-row-head:focus-within .ci-leading>.ci-chevron-hover{opacity:1}",
	".ci-preset-part-trigger[aria-expanded=\"true\"] .ci-chevron svg{transform:rotate(90deg)}",
	".ci-tabs{display:flex;gap:2px;padding:2px;border-radius:8px;background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,.06))}",
	".ci-tab{flex:1;height:24px;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary,#61666b);font:inherit;font-size:12px;line-height:1;cursor:pointer;font-variant-numeric:tabular-nums;padding:0 4px}",
	".ci-tab:hover{color:var(--dsw-alias-label-primary,#0f1115)}",
	".ci-tab[data-active]{background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#0f1115);box-shadow:var(--dsw-elevation-soft,0 1px 2px rgba(0,0,0,.08))}",
	".ci-preset-section{width:100%;max-width:760px;color:var(--dsw-alias-label-primary,#0f1115);display:flex;flex-direction:column;gap:14px}",
	".ci-settings-title{margin:0;color:var(--dsw-alias-label-primary,#0f1115);font-size:18px;font-weight:600;line-height:26px}",
	".ci-settings-intro,.ci-settings-description,.ci-settings-note{margin:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary,#81858c)}",
	".ci-settings-note{padding:10px 12px;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.1));border-radius:8px}",
	".ci-preset-toolbar{display:flex;gap:10px;align-items:center;margin:0}",
	".ci-search{position:relative;flex:1 1 auto;min-width:180px;display:flex;align-items:center;color:var(--dsw-alias-label-tertiary,#81858c)}",
	".ci-search>svg{position:absolute;left:12px;pointer-events:none}",
	".ci-preset-filter{width:100%;height:36px;box-sizing:border-box;padding:0 34px 0 36px;border:.5px solid var(--dsw-alias-border-l4,rgba(0,0,0,.16));border-radius:var(--dsw-radius-md,12px);background-color:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#0f1115);font:inherit;font-size:13px;font-weight:400;outline:none}",
	".ci-preset-filter:focus-visible{border-color:var(--dsw-alias-state-business-primary,#4176e6);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-state-business-primary,#4176e6) 18%,transparent)}",
	".ci-preset-part{display:flex;flex-direction:column;gap:10px;margin:0;padding:14px 0 0;border-top:.5px solid var(--dsw-alias-border-l2,rgba(0,0,0,.1))}",
	".ci-preset-part:first-of-type{border-top:0;padding-top:0}",
	".ci-preset-part-trigger{display:flex;align-items:center;gap:8px;min-height:32px;padding:0;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}",
	".ci-preset-part-trigger:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4176e6);outline-offset:2px;border-radius:4px}",
	".ci-preset-part-title{margin:0;font-size:14px;font-weight:400;line-height:22px;color:var(--dsw-alias-label-primary,#0f1115)}",
	".ci-preset-part-sub{margin:-4px 0 0 26px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#81858c);font-variant-numeric:tabular-nums}",
	".ci-preset-badge{display:inline-block;margin-left:6px;padding:1px 6px;line-height:1.5;border-radius:999px;font-size:11px;font-weight:500;vertical-align:middle;background-color:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05));color:var(--dsw-alias-label-tertiary,#81858c)}",
	".ci-preset-group{padding:0}",
	".ci-preset-server-trigger{display:flex;align-items:center;gap:8px;flex:1;min-width:0;background:none;border:none;padding:0;text-align:left;font:inherit;color:inherit;cursor:pointer}",
	".ci-preset-server-trigger:disabled{cursor:default}",
	".ci-preset-group .ci-preset-tool-list{margin:0;padding-left:26px}",
	".ci-preset-picker-trigger{height:36px;display:inline-flex;align-items:center;gap:8px;padding:0 14px;border:none;border-radius:var(--dsw-radius-md,12px);background:var(--dsw-alias-bg-module-platform,rgba(38,49,72,.06));color:var(--dsw-alias-label-primary,#0f1115);font:inherit;font-size:14px;font-weight:400;line-height:22px;cursor:pointer;outline:none;max-width:280px;flex:none;white-space:nowrap}",
	".ci-preset-picker-trigger:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,.06))}",
	".ci-preset-picker-trigger:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4176e6);outline-offset:2px}",
	".ci-preset-picker-name{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}",
	".ci-preset-picker-chevron{color:var(--dsw-alias-label-tertiary,#81858c);flex:none;display:inline-grid;place-items:center;transition:transform .12s}",
	".ci-preset-picker-chevron-open{transform:rotate(180deg)}",
	".ci-settings-subtitle{margin:0 0 6px;color:var(--dsw-alias-label-primary,#0f1115);font-size:14px;line-height:22px}",
	".ci-preset-tool-list{list-style:none;margin:0;padding:0}",
	".ci-preset-tool-row{display:flex;align-items:center;gap:16px}",
	".ci-preset-tool-copy{display:grid;min-width:0;flex:1}",
	".ci-preset-tool-name{color:var(--dsw-alias-label-primary,#0f1115);font-weight:600;overflow-wrap:anywhere}",
	".ci-preset-tool-description{color:var(--dsw-alias-label-tertiary,#81858c);line-height:18px;overflow-wrap:anywhere}",
	".ci-preset-item{list-style:none}",
	".ci-preset-disclosure{display:block}",
	".ci-preset-spacer{width:18px;flex:none}",
	".ci-preset-detail{padding:0 0 10px 24px;color:var(--dsw-alias-label-tertiary,#81858c);line-height:18px;overflow-wrap:anywhere}",
	".ci-preset-kinds{margin:0}",
	".ci-preset-kinds .ci-tabs{display:inline-flex}",
	".ci-preset-kinds .ci-tab{flex:0 0 auto;padding:0 12px}",
	".ci-source-header:hover .ci-folder-icon{opacity:1 !important}",
	".ci-reconnect{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.14));background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-secondary,#61666b);border-radius:8px;padding:3px 9px;font-size:12px;line-height:1.4;cursor:pointer;font-family:inherit;flex:none}",
	".ci-reconnect:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,.06));color:var(--dsw-alias-label-primary,#0f1115)}",
	".ci-reconnect:disabled{opacity:.7;cursor:default}",
	".ci-reconnect:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4176e6);outline-offset:1px}",
	".ci-reconnect-glyph{display:inline-grid;place-items:center;width:12px;height:12px}",
	".ci-reconnect-busy .ci-reconnect-glyph{animation:ci-reconnect-spin .8s linear infinite}",
	"@keyframes ci-reconnect-spin{to{transform:rotate(360deg)}}",
	"@media (prefers-reduced-motion: reduce){.ci-reconnect-busy .ci-reconnect-glyph{animation:none}}",
	".ci-source-divider{list-style:none}",
	".ci-feedback-link{display:inline-flex;align-items:center;gap:4px;color:var(--dsw-alias-label-tertiary,#8a8f98);font-size:12px;line-height:18px;text-decoration:none;cursor:pointer}",
	".ci-feedback-link:hover{color:var(--dsw-alias-label-primary,#0f1115);text-decoration:underline}",
	".ci-feedback-link:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4176e6);outline-offset:2px;border-radius:3px}",
	".ci-feedback-icon{display:inline-grid;place-items:center;flex:none}",
	".ci-settings-link{border:0;background:none;padding:0;font-family:inherit}",
	".ci-preset-off{display:flex;align-items:center;gap:8px;padding:2px 0 6px;font-size:12px;color:var(--dsw-alias-label-tertiary,#81858c)}",
	".ci-preset-off-text{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
	".ci-preset-off-toggle{flex:0 0 auto;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.14));background:transparent;color:var(--dsw-alias-label-secondary,#61666b);border-radius:8px;padding:1px 8px;font-size:12px;line-height:1.6;cursor:pointer;font-family:inherit}",
	".ci-preset-off-toggle:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,.06));color:var(--dsw-alias-label-primary,#0f1115)}",
	".ci-preset-off-toggle:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4176e6);outline-offset:1px}",
	".ci-preset-off-on{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05));color:var(--dsw-alias-label-primary,#0f1115)}",
	"@media (prefers-reduced-motion: reduce){.ci-thumb,.ci-panel,.ci-collapse,.ci-chevron svg{transition:none !important}}"
].join("\n");

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/visuallyHidden.mjs
const visuallyHiddenBase = {
	clipPath: "inset(50%)",
	overflow: "hidden",
	whiteSpace: "nowrap",
	border: 0,
	padding: 0,
	width: 1,
	height: 1,
	margin: -1
};
const visuallyHidden = {
	...visuallyHiddenBase,
	position: "fixed",
	top: 0,
	left: 0
};
const visuallyHiddenInput = {
	...visuallyHiddenBase,
	position: "absolute"
};

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/switch/root/SwitchRootContext.mjs
const SwitchRootContext = /* @__PURE__ */ react.createContext(void 0);
function useSwitchRootContext() {
	const context = react.useContext(SwitchRootContext);
	if (context === void 0) throw new Error(formatErrorMessage_default(63));
	return context;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/field-constants/constants.mjs
const DEFAULT_VALIDITY_STATE = {
	badInput: false,
	customError: false,
	patternMismatch: false,
	rangeOverflow: false,
	rangeUnderflow: false,
	stepMismatch: false,
	tooLong: false,
	tooShort: false,
	typeMismatch: false,
	valid: null,
	valueMissing: false
};
const DEFAULT_FIELD_STATE_ATTRIBUTES = {
	valid: null,
	touched: false,
	dirty: false,
	filled: false,
	focused: false
};
const DEFAULT_FIELD_ROOT_STATE = {
	disabled: false,
	...DEFAULT_FIELD_STATE_ATTRIBUTES
};
const fieldValidityMapping = { valid(value) {
	if (value === null) return null;
	if (value) return { "data-valid": "" };
	return { "data-invalid": "" };
} };

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/switch/stateAttributesMapping.mjs
const stateAttributesMapping$1 = {
	...fieldValidityMapping,
	checked(value) {
		if (value) return { "data-checked": "" };
		return { "data-unchecked": "" };
	}
};

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/field-root-context/FieldRootContext.mjs
const DEFAULT_FIELD_ROOT_CONTEXT = {
	invalid: void 0,
	name: void 0,
	validityData: {
		state: DEFAULT_VALIDITY_STATE,
		errors: [],
		error: "",
		value: "",
		initialValue: null
	},
	setValidityData: NOOP,
	disabled: void 0,
	setTouched: NOOP,
	setDirty: NOOP,
	setFilled: NOOP,
	setFocused: NOOP,
	validationMode: "onSubmit",
	shouldValidateOnChange: () => false,
	state: DEFAULT_FIELD_ROOT_STATE,
	registerFieldControl: NOOP,
	validation: {
		getValidationProps: (_disabled, props = EMPTY_OBJECT) => props,
		inputRef: { current: null },
		registeredInputs: /* @__PURE__ */ new Map(),
		registerInput: NOOP,
		getInputControl: () => null,
		commit: async () => {},
		change: NOOP
	}
};
const FieldRootContext = /* @__PURE__ */ react.createContext(DEFAULT_FIELD_ROOT_CONTEXT);
function useFieldRootContext(optional = true) {
	const context = react.useContext(FieldRootContext);
	if (context.setValidityData === NOOP && !optional) throw new Error(formatErrorMessage_default(28));
	return context;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/field-register-control/useRegisterFieldControl.mjs
function useRegisterFieldControl(controlRef, id, value, getFormValueOverride, enabled = true, name) {
	const { registerFieldControl } = useFieldRootContext();
	const sourceRef = useRefWithInit(() => Symbol());
	useIsoLayoutEffect(() => {
		const source = sourceRef.current;
		if (!enabled) {
			registerFieldControl(source, void 0);
			return;
		}
		registerFieldControl(source, {
			controlRef,
			getValue: getFormValueOverride,
			id,
			name,
			value
		});
	}, [
		controlRef,
		enabled,
		getFormValueOverride,
		id,
		name,
		registerFieldControl,
		sourceRef,
		value
	]);
	useIsoLayoutEffect(() => {
		const source = sourceRef.current;
		return () => {
			registerFieldControl(source, void 0);
		};
	}, [registerFieldControl, sourceRef]);
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/form-context/FormContext.mjs
const FormContext = /* @__PURE__ */ react.createContext({
	elementRef: { current: null },
	formRef: { current: { fields: /* @__PURE__ */ new Map() } },
	errors: {},
	clearErrors: NOOP,
	validationMode: "onSubmit",
	submitAttemptedRef: { current: false }
});
function useFormContext() {
	return react.useContext(FormContext);
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/labelable-provider/LabelableContext.mjs
/**
* A context for providing [labelable elements](https://html.spec.whatwg.org/multipage/forms.html#category-label)\
* with an accessible name (label) and description.
*/
const LabelableContext = /* @__PURE__ */ react.createContext({
	controlId: void 0,
	registerControlId: NOOP,
	labelId: void 0,
	setLabelId: NOOP,
	messageIds: [],
	setMessageIds: NOOP,
	getDescriptionProps: (externalProps) => externalProps
});
function useLabelableContext() {
	return react.useContext(LabelableContext);
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/labelable-provider/useAriaLabelledBy.mjs
function useAriaLabelledBy(explicitAriaLabelledBy, labelId, labelSourceRef, enableFallback = true, labelSourceId) {
	const [fallbackAriaLabelledBy, setFallbackAriaLabelledBy] = react.useState();
	const generatedLabelId = useBaseUiId(labelSourceId ? `${labelSourceId}-label` : void 0);
	const ariaLabelledBy = explicitAriaLabelledBy ?? labelId ?? fallbackAriaLabelledBy;
	useIsoLayoutEffect(() => {
		const nextAriaLabelledBy = explicitAriaLabelledBy || labelId || !enableFallback ? void 0 : getAriaLabelledBy(labelSourceRef.current, generatedLabelId);
		if (fallbackAriaLabelledBy !== nextAriaLabelledBy) setFallbackAriaLabelledBy(nextAriaLabelledBy);
	});
	return ariaLabelledBy;
}
function getAriaLabelledBy(labelSource, generatedLabelId) {
	const label = findAssociatedLabel(labelSource);
	if (!label) return;
	if (!label.id && generatedLabelId) label.id = generatedLabelId;
	return label.id || void 0;
}
function findAssociatedLabel(labelSource) {
	if (!labelSource) return;
	const parent = labelSource.parentElement;
	if (parent && parent.tagName === "LABEL") return parent;
	const controlId = labelSource.id;
	if (controlId) {
		const nextSibling = labelSource.nextElementSibling;
		if (nextSibling && nextSibling.htmlFor === controlId) return nextSibling;
	}
	const labels = labelSource.labels;
	return labels && labels[0];
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/labelable-provider/useLabelableId.mjs
function useLabelableId(params = {}) {
	const { id, implicit = false, controlRef } = params;
	const { controlId, registerControlId } = useLabelableContext();
	const defaultId = useBaseUiId(id);
	const controlIdForEffect = implicit ? controlId : void 0;
	const controlSourceRef = useRefWithInit(() => Symbol());
	const hasRegisteredRef = react.useRef(false);
	const hadExplicitIdRef = react.useRef(id != null);
	const unregisterControlId = useStableCallback(() => {
		if (!hasRegisteredRef.current || registerControlId === NOOP) return;
		hasRegisteredRef.current = false;
		registerControlId(controlSourceRef.current, void 0);
	});
	useIsoLayoutEffect(() => {
		if (registerControlId === NOOP) return;
		let nextId;
		if (implicit) {
			const elem = controlRef?.current;
			if (isElement(elem) && elem.closest("label") != null) nextId = id ?? null;
			else nextId = controlIdForEffect ?? defaultId;
		} else if (id != null) {
			hadExplicitIdRef.current = true;
			nextId = id;
		} else if (hadExplicitIdRef.current) nextId = defaultId;
		else {
			unregisterControlId();
			return;
		}
		if (nextId === void 0) {
			unregisterControlId();
			return;
		}
		hasRegisteredRef.current = true;
		registerControlId(controlSourceRef.current, nextId);
	}, [
		id,
		controlRef,
		controlIdForEffect,
		registerControlId,
		implicit,
		defaultId,
		controlSourceRef,
		unregisterControlId
	]);
	react.useEffect(() => {
		return unregisterControlId;
	}, [unregisterControlId]);
	return controlId ?? defaultId;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/useValueChanged.mjs
function useValueChanged(value, onChange) {
	const valueRef = react.useRef(value);
	const onChangeCallback = useStableCallback(onChange);
	useIsoLayoutEffect(() => {
		if (valueRef.current !== value) onChangeCallback(valueRef.current);
		valueRef.current = value;
	}, [value, onChangeCallback]);
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/switch/root/SwitchRoot.mjs
const SwitchRoot = /* @__PURE__ */ react.forwardRef(function SwitchRoot$1(componentProps, forwardedRef) {
	const { checked: checkedProp, className, defaultChecked, "aria-labelledby": ariaLabelledByProp, form, id: idProp, inputRef: externalInputRef, name: nameProp, nativeButton = false, onCheckedChange, readOnly = false, required = false, disabled: disabledProp = false, render, uncheckedValue, value, style,...elementProps } = componentProps;
	const { clearErrors } = useFormContext();
	const { state: fieldState, setTouched, setDirty, validityData, setFilled, setFocused, validationMode, disabled: fieldDisabled, name: fieldName, validation } = useFieldRootContext();
	const { labelId } = useLabelableContext();
	const disabled$1 = fieldDisabled || disabledProp;
	const name = fieldName ?? nameProp;
	const inputRef = react.useRef(null);
	const handleInputRef = useMergedRefs(inputRef, externalInputRef, validation.inputRef);
	const switchRef = react.useRef(null);
	const id = useBaseUiId();
	const controlId = useLabelableId({
		id: idProp,
		implicit: false,
		controlRef: switchRef
	});
	const hiddenInputId = nativeButton ? void 0 : controlId;
	const [checked, setCheckedState] = useControlled({
		controlled: checkedProp,
		default: Boolean(defaultChecked),
		name: "Switch",
		state: "checked"
	});
	useRegisterFieldControl(switchRef, id, checked, void 0, !disabled$1, nameProp);
	useIsoLayoutEffect(() => {
		if (inputRef.current) setFilled(inputRef.current.checked);
	}, [setFilled]);
	useValueChanged(checked, () => {
		clearErrors(name);
		setDirty(checked !== validityData.initialValue);
		setFilled(checked);
		validation.change(checked);
	});
	const { getButtonProps, buttonRef } = useButton({
		disabled: disabled$1,
		native: nativeButton
	});
	const ariaLabelledBy = useAriaLabelledBy(ariaLabelledByProp, labelId, inputRef, !nativeButton, hiddenInputId);
	const rootProps = {
		id: nativeButton ? controlId : id,
		role: "switch",
		"aria-checked": checked,
		"aria-readonly": readOnly || void 0,
		"aria-required": required || void 0,
		"aria-labelledby": ariaLabelledBy,
		onFocus() {
			if (!disabled$1) setFocused(true);
		},
		onBlur() {
			const element$1 = inputRef.current;
			if (!element$1 || disabled$1) return;
			setTouched(true);
			setFocused(false);
			if (validationMode === "onBlur") validation.commit(element$1.checked);
		},
		onClick(event) {
			if (readOnly || disabled$1) return;
			event.preventDefault();
			const input = inputRef.current;
			if (!input) return;
			dispatchClickWithModifiers(input, event);
		}
	};
	const inputProps = {
		...validation.getValidationProps(disabled$1),
		checked,
		disabled: disabled$1,
		form,
		id: hiddenInputId,
		name,
		required,
		style: name ? visuallyHiddenInput : visuallyHidden,
		tabIndex: -1,
		type: "checkbox",
		"aria-hidden": true,
		ref: handleInputRef,
		onChange(event) {
			if (event.nativeEvent.defaultPrevented) return;
			if (readOnly) {
				event.preventDefault();
				return;
			}
			const nextChecked = event.currentTarget.checked;
			const eventDetails = createChangeEventDetails(none, event.nativeEvent);
			onCheckedChange?.(nextChecked, eventDetails);
			if (eventDetails.isCanceled) return;
			setCheckedState(nextChecked);
		},
		onClick(event) {
			event.stopPropagation();
		},
		onFocus() {
			switchRef.current?.focus();
		},
		...value !== void 0 ? { value } : EMPTY_OBJECT
	};
	const state = react.useMemo(() => ({
		...fieldState,
		checked,
		disabled: disabled$1,
		readOnly,
		required
	}), [
		fieldState,
		checked,
		disabled$1,
		readOnly,
		required
	]);
	const element = useRenderElement("span", componentProps, {
		state,
		ref: [
			forwardedRef,
			switchRef,
			buttonRef
		],
		props: [
			rootProps,
			elementProps,
			getButtonProps,
			(props) => validation.getValidationProps(disabled$1, props)
		],
		stateAttributesMapping: stateAttributesMapping$1
	});
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(SwitchRootContext.Provider, {
		value: state,
		children: [
			element,
			!checked && name && uncheckedValue !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
				type: "hidden",
				form,
				name,
				value: uncheckedValue,
				disabled: disabled$1
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
				...inputProps,
				suppressHydrationWarning: true
			})
		]
	});
});

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/switch/thumb/SwitchThumb.mjs
/**
* The movable part of the switch that indicates whether the switch is on or off.
* Renders a `<span>`.
*
* Documentation: [Base UI Switch](https://base-ui.com/react/components/switch)
*/
const SwitchThumb = /* @__PURE__ */ react.forwardRef(function SwitchThumb$1(componentProps, forwardedRef) {
	const { render, className, style,...elementProps } = componentProps;
	return useRenderElement("span", componentProps, {
		state: useSwitchRootContext(),
		ref: forwardedRef,
		stateAttributesMapping: stateAttributesMapping$1,
		props: elementProps
	});
});

//#endregion
//#region src/client/switch.ts
/**
* The capability switch, in one place for both panels.
*
* dsh 0.1.7 ships a design-system `Switch` (36×20 capsule, brand-primary on
* state, its own disabled dimming and focus ring) — using it keeps the panel's
* toggles pixel-identical to every settings page the host ships, which is the
* alignment this file exists for. Hosts older than that export fall back to
* the local Base UI rendition below, so one build still serves both
* generations; the probe runs per call, the same way the icon table resolves.
*/
function capabilitySwitch(options) {
	const inert = options.disabled || options.busy;
	const HostSwitch = __deepseek_ai_dsh_client_ui_primitives.Switch;
	if (HostSwitch !== void 0) return react.createElement(HostSwitch, {
		checked: options.checked,
		onChange: options.onCheckedChange,
		label: options.label,
		disabled: inert
	});
	return react.createElement(SwitchRoot, {
		className: "ci-switch",
		checked: options.checked,
		disabled: inert,
		"aria-label": options.label,
		onCheckedChange: options.onCheckedChange,
		style: {
			position: "relative",
			width: "32px",
			height: "18px",
			padding: 0,
			border: "none",
			borderRadius: "999px",
			background: options.checked ? TOK.switchOn : TOK.switchOff,
			cursor: inert ? "not-allowed" : "pointer",
			opacity: options.busy ? .65 : 1,
			flex: "0 0 auto"
		}
	}, react.createElement(SwitchThumb, {
		className: "ci-thumb",
		style: {
			display: "block",
			width: "14px",
			height: "14px",
			margin: "2px",
			borderRadius: "999px",
			background: TOK.switchThumb,
			boxShadow: "0 1px 2px rgba(0,0,0,.22)",
			transform: options.checked ? "translateX(14px)" : "translateX(0)",
			transition: `transform .12s ${TOK.switchEase}`
		}
	}));
}

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/platform/shared.mjs
/**
* Reads `navigator.userAgent` / `navigator.platform` (legacy but universally
* supported) into a normalized shape. In development, prefers the modern
* `navigator.userAgentData` API on Chromium to avoid DevTools warnings about
* the deprecated reads; that branch is dead-code-eliminated in production
* builds to keep the bundle small.
*
* Returns empty/zero values when `navigator` is undefined (SSR), so every
* derived flag safely evaluates to `false`.
*/
function readRawData() {
	if (typeof navigator === "undefined") return {
		userAgent: "",
		platform: "",
		maxTouchPoints: 0
	};
	return {
		userAgent: navigator.userAgent,
		platform: navigator.platform ?? "",
		maxTouchPoints: navigator.maxTouchPoints ?? 0
	};
}
const { userAgent, platform: platform$1, maxTouchPoints } = readRawData();
const lowerUserAgent = userAgent.toLowerCase();
const lowerPlatform = platform$1.toLowerCase();

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/platform/os.mjs
/** iPhone, iPad (including iPadOS 13+ reporting as macOS), iPod. */
const ios = /^i(os$|p)/.test(lowerPlatform) || lowerPlatform === "macintel" && maxTouchPoints > 1;
/** Android phones, tablets, and embedded Android browsers. */
const ANDROID_STRING = "android";
const android = lowerPlatform === ANDROID_STRING || lowerUserAgent.includes(ANDROID_STRING);
/** macOS desktop. Excludes iPadOS, which reports as `MacIntel`. */
const mac = !ios && lowerPlatform.startsWith("mac");
/** Windows desktop. */
const windows = lowerPlatform.startsWith("win");
/** Linux desktop (including Chrome OS). */
const linux = !android && /^(linux|chrome os)/.test(lowerPlatform);
/** Any Apple OS (`mac || ios`). */
const apple = mac || ios;

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/platform/engine.mjs
/** WebKit: Safari, all iOS browsers, GNOME Web. Excludes Blink. */
const webkit = typeof CSS !== "undefined" && !!CSS.supports?.("-webkit-backdrop-filter:none");
/** Gecko: Firefox. */
const gecko = !webkit && lowerUserAgent.includes("firefox");
/** Blink: Chrome, Edge, Opera, Brave, and other Chromium-based browsers. */
const blink = !webkit && lowerUserAgent.includes("chrom");

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/platform/screen-reader.mjs
/**
* The user *may* be using VoiceOver — actual activation is not detectable.
* True on any Apple platform (macOS, iOS, iPadOS).
*/
const voiceOver = apple;

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/platform/env.mjs
/** Running in jsdom or HappyDOM (used by unit tests). */
const jsdom = /jsdom|happydom/.test(lowerUserAgent);

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/floating-ui-react/utils/constants.mjs
const FOCUSABLE_ATTRIBUTE = "data-base-ui-focusable";
const TYPEABLE_SELECTOR = "input:not([type='hidden']):not([disabled]),[contenteditable]:not([contenteditable='false']),textarea:not([disabled])";

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/shadowDom.mjs
function activeElement(doc) {
	let element = doc.activeElement;
	while (element?.shadowRoot?.activeElement != null) element = element.shadowRoot.activeElement;
	return element;
}
function contains(parent, child) {
	if (!parent || !child) return false;
	const rootNode = child.getRootNode?.();
	if (parent.contains(child)) return true;
	if (rootNode && isShadowRoot(rootNode)) {
		let next = child;
		while (next) {
			if (parent === next) return true;
			next = next.parentNode || next.host;
		}
	}
	return false;
}
function getTarget(event) {
	if ("composedPath" in event) return event.composedPath()[0];
	return event.target;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/floating-ui-react/utils/element.mjs
function isTargetInsideEnabledTrigger(target, triggerElements) {
	if (!isElement(target)) return false;
	const targetElement = target;
	if (triggerElements.hasElement(targetElement)) return !targetElement.hasAttribute("data-trigger-disabled");
	for (const [, trigger] of triggerElements.entries()) if (contains(trigger, targetElement)) return !trigger.hasAttribute("data-trigger-disabled");
	return false;
}
function isEventTargetWithin(event, node) {
	if (node == null) return false;
	if ("composedPath" in event) return event.composedPath().includes(node);
	const eventAgain = event;
	return eventAgain.target != null && node.contains(eventAgain.target);
}
function isRootElement(element) {
	return element.matches("html,body");
}
function isTypeableElement(element) {
	return isHTMLElement(element) && element.matches(TYPEABLE_SELECTOR);
}
function isInteractiveElement(element) {
	return element?.closest(`button,a[href],[role="button"],select,[tabindex]:not([tabindex="-1"]),${TYPEABLE_SELECTOR}`) != null;
}
function isTypeableCombobox(element) {
	if (!element) return false;
	return element.getAttribute("role") === "combobox" && isTypeableElement(element);
}
function getFloatingFocusElement(floatingElement) {
	if (!floatingElement) return null;
	return floatingElement.hasAttribute(FOCUSABLE_ATTRIBUTE) ? floatingElement : floatingElement.querySelector(`[${FOCUSABLE_ATTRIBUTE}]`) || floatingElement;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/floating-ui-react/utils/nodes.mjs
function getNodeChildren(nodes, id, onlyOpenChildren = true) {
	return nodes.filter((node) => node.parentId === id).flatMap((child) => [...!onlyOpenChildren || child.context?.open ? [child] : [], ...getNodeChildren(nodes, child.id, onlyOpenChildren)]);
}
function getNodeAncestors(nodes, id) {
	let allAncestors = [];
	let currentParentId = nodes.find((node) => node.id === id)?.parentId;
	while (currentParentId) {
		const currentNode = nodes.find((node) => node.id === currentParentId);
		currentParentId = currentNode?.parentId;
		if (currentNode) allAncestors = allAncestors.concat(currentNode);
	}
	return allAncestors;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/floating-ui-react/utils/event.mjs
function stopEvent(event) {
	event.preventDefault();
	event.stopPropagation();
}
function isReactEvent(event) {
	return "nativeEvent" in event;
}
function isVirtualClick(event) {
	if (event.pointerType === "" && event.isTrusted) return true;
	if (android && event.pointerType) return event.type === "click" && event.buttons === 1;
	return event.detail === 0 && !event.pointerType;
}
function isVirtualPointerEvent(event) {
	if (jsdom) return false;
	return !android && event.width === 0 && event.height === 0 || android && event.width === 1 && event.height === 1 && event.pressure === 0 && event.detail === 0 && event.pointerType === "mouse" || event.width < 1 && event.height < 1 && event.pressure === 0 && event.detail === 0 && event.pointerType === "touch";
}
function isMouseLikePointerType(pointerType, strict) {
	const values = ["mouse", "pen"];
	if (!strict) values.push("", void 0);
	return values.includes(pointerType);
}
function isClickLikeEvent(event) {
	const type = event.type;
	return type === "click" || type === "mousedown" || type === "keydown" || type === "keyup";
}

//#endregion
//#region node_modules/.pnpm/@floating-ui+utils@0.2.12/node_modules/@floating-ui/utils/dist/floating-ui.utils.mjs
const min = Math.min;
const max = Math.max;
const round = Math.round;
const floor = Math.floor;
const createCoords = (v) => ({
	x: v,
	y: v
});
const oppositeSideMap = {
	left: "right",
	right: "left",
	bottom: "top",
	top: "bottom"
};
function clamp(start, value, end) {
	return max(start, min(value, end));
}
function evaluate(value, param) {
	return typeof value === "function" ? value(param) : value;
}
function getSide(placement) {
	return placement.split("-")[0];
}
function getAlignment(placement) {
	return placement.split("-")[1];
}
function getOppositeAxis(axis) {
	return axis === "x" ? "y" : "x";
}
function getAxisLength(axis) {
	return axis === "y" ? "height" : "width";
}
function getSideAxis(placement) {
	const firstChar = placement[0];
	return firstChar === "t" || firstChar === "b" ? "y" : "x";
}
function getAlignmentAxis(placement) {
	return getOppositeAxis(getSideAxis(placement));
}
function getAlignmentSides(placement, rects, rtl) {
	if (rtl === void 0) rtl = false;
	const alignment = getAlignment(placement);
	const alignmentAxis = getAlignmentAxis(placement);
	const length = getAxisLength(alignmentAxis);
	let mainAlignmentSide = alignmentAxis === "x" ? alignment === (rtl ? "end" : "start") ? "right" : "left" : alignment === "start" ? "bottom" : "top";
	if (rects.reference[length] > rects.floating[length]) mainAlignmentSide = getOppositePlacement(mainAlignmentSide);
	return [mainAlignmentSide, getOppositePlacement(mainAlignmentSide)];
}
function getExpandedPlacements(placement) {
	const oppositePlacement = getOppositePlacement(placement);
	return [
		getOppositeAlignmentPlacement(placement),
		oppositePlacement,
		getOppositeAlignmentPlacement(oppositePlacement)
	];
}
function getOppositeAlignmentPlacement(placement) {
	return placement.includes("start") ? placement.replace("start", "end") : placement.replace("end", "start");
}
const lrPlacement = ["left", "right"];
const rlPlacement = ["right", "left"];
const tbPlacement = ["top", "bottom"];
const btPlacement = ["bottom", "top"];
function getSideList(side, isStart, rtl) {
	switch (side) {
		case "top":
		case "bottom":
			if (rtl) return isStart ? rlPlacement : lrPlacement;
			return isStart ? lrPlacement : rlPlacement;
		case "left":
		case "right": return isStart ? tbPlacement : btPlacement;
		default: return [];
	}
}
function getOppositeAxisPlacements(placement, flipAlignment, direction, rtl) {
	const alignment = getAlignment(placement);
	let list = getSideList(getSide(placement), direction === "start", rtl);
	if (alignment) {
		list = list.map((side) => side + "-" + alignment);
		if (flipAlignment) list = list.concat(list.map(getOppositeAlignmentPlacement));
	}
	return list;
}
function getOppositePlacement(placement) {
	const side = getSide(placement);
	return oppositeSideMap[side] + placement.slice(side.length);
}
function expandPaddingObject(padding) {
	var _padding$top, _padding$right, _padding$bottom, _padding$left;
	return {
		top: (_padding$top = padding.top) != null ? _padding$top : 0,
		right: (_padding$right = padding.right) != null ? _padding$right : 0,
		bottom: (_padding$bottom = padding.bottom) != null ? _padding$bottom : 0,
		left: (_padding$left = padding.left) != null ? _padding$left : 0
	};
}
function getPaddingObject(padding) {
	return typeof padding !== "number" ? expandPaddingObject(padding) : {
		top: padding,
		right: padding,
		bottom: padding,
		left: padding
	};
}
function rectToClientRect(rect) {
	const { x, y, width, height } = rect;
	return {
		width,
		height,
		top: y,
		left: x,
		right: x + width,
		bottom: y + height,
		x,
		y
	};
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/floating-ui-react/utils/composite.mjs
function isIndexOutOfListBounds(list, index$1) {
	return index$1 < 0 || index$1 >= list.length;
}
function getMinListIndex(listRef, disabledIndices) {
	return findNonDisabledListIndex(listRef.current, { disabledIndices });
}
function getMaxListIndex(listRef, disabledIndices) {
	return findNonDisabledListIndex(listRef.current, {
		decrement: true,
		startingIndex: listRef.current.length,
		disabledIndices
	});
}
function findNonDisabledListIndex(list, { startingIndex = -1, decrement = false, disabledIndices, amount = 1 } = {}) {
	let index$1 = startingIndex;
	do
		index$1 += decrement ? -amount : amount;
	while (index$1 >= 0 && index$1 <= list.length - 1 && isListIndexDisabled(list, index$1, disabledIndices));
	return index$1;
}
function isListIndexDisabled(list, index$1, disabledIndices) {
	if (typeof disabledIndices === "function" ? disabledIndices(index$1) : disabledIndices?.includes(index$1) ?? false) return true;
	const element = list[index$1];
	if (!element) return false;
	if (!isElementVisible(element)) return true;
	if (element.matches(":disabled")) return true;
	return !disabledIndices && (element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true");
}
function isHiddenByStyles(styles) {
	return styles.visibility === "hidden" || styles.visibility === "collapse";
}
function isElementVisible(element, styles = element ? getComputedStyle$1(element) : null) {
	if (!element || !element.isConnected || !styles || isHiddenByStyles(styles)) return false;
	if (typeof element.checkVisibility === "function") return element.checkVisibility();
	return styles.display !== "none" && styles.display !== "contents";
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/floating-ui-react/utils/tabbable.mjs
const CANDIDATE_SELECTOR = "a[href],button,input,select,textarea,summary,details,iframe,object,embed,[tabindex],[contenteditable]:not([contenteditable=\"false\"]),audio[controls],video[controls]";
function getParentElement(element) {
	const assignedSlot = element.assignedSlot;
	if (assignedSlot) return assignedSlot;
	if (element.parentElement) return element.parentElement;
	const rootNode = element.getRootNode();
	return isShadowRoot(rootNode) ? rootNode.host : null;
}
function getDetailsSummary(details) {
	for (const child of Array.from(details.children)) if (getNodeName(child) === "summary") return child;
	return null;
}
function isWithinOpenDetailsSummary(element, details) {
	const summary = getDetailsSummary(details);
	return !!summary && (element === summary || contains(summary, element));
}
function isFocusableCandidate(element) {
	const nodeName = element ? getNodeName(element) : "";
	return element != null && element.matches(CANDIDATE_SELECTOR) && (nodeName !== "summary" || element.parentElement != null && getNodeName(element.parentElement) === "details" && getDetailsSummary(element.parentElement) === element) && (nodeName !== "details" || getDetailsSummary(element) == null) && (nodeName !== "input" || element.type !== "hidden");
}
function isFocusableElement(element) {
	if (!isFocusableCandidate(element) || !element.isConnected || element.matches(":disabled")) return false;
	for (let current = element; current; current = getParentElement(current)) {
		const isAncestor = current !== element;
		const isSlot = getNodeName(current) === "slot";
		if (current.hasAttribute("inert")) return false;
		if (isAncestor && getNodeName(current) === "details" && !current.open && !isWithinOpenDetailsSummary(element, current) || current.hasAttribute("hidden") || !isSlot && !isVisibleInTabbableTree(current, isAncestor)) return false;
	}
	return true;
}
function isVisibleInTabbableTree(element, isAncestor) {
	const styles = getComputedStyle$1(element);
	if (!isAncestor) return isElementVisible(element, styles);
	return styles.display !== "none";
}
function getTabIndex(element) {
	const tabIndex = element.tabIndex;
	if (tabIndex < 0) {
		const nodeName = getNodeName(element);
		if (nodeName === "details" || nodeName === "audio" || nodeName === "video" || isHTMLElement(element) && element.isContentEditable) return 0;
	}
	return tabIndex;
}
function getNamedRadioInput(element) {
	if (getNodeName(element) !== "input") return null;
	const input = element;
	return input.type === "radio" && input.name !== "" ? input : null;
}
function isTabbableRadio(element, candidates) {
	const input = getNamedRadioInput(element);
	if (!input) return true;
	const checkedRadio = candidates.find((candidate) => {
		const radio = getNamedRadioInput(candidate);
		return radio?.name === input.name && radio.form === input.form && radio.checked;
	});
	if (checkedRadio) return checkedRadio === input;
	return candidates.find((candidate) => {
		const radio = getNamedRadioInput(candidate);
		return radio?.name === input.name && radio.form === input.form;
	}) === input;
}
function getComposedChildren(container) {
	if (isHTMLElement(container) && getNodeName(container) === "slot") {
		const assignedElements = container.assignedElements({ flatten: true });
		if (assignedElements.length > 0) return assignedElements;
	}
	if (isHTMLElement(container) && container.shadowRoot) return Array.from(container.shadowRoot.children);
	return Array.from(container.children);
}
function appendCandidates(container, list) {
	getComposedChildren(container).forEach((child) => {
		if (isFocusableCandidate(child)) list.push(child);
		appendCandidates(child, list);
	});
}
function appendMatchingElements(container, selector, list) {
	getComposedChildren(container).forEach((child) => {
		if (isHTMLElement(child) && child.matches(selector)) list.push(child);
		appendMatchingElements(child, selector, list);
	});
}
function isTabbable(element) {
	return isFocusableElement(element) && getTabIndex(element) >= 0;
}
function focusable(container) {
	const candidates = [];
	appendCandidates(container, candidates);
	return candidates.filter(isFocusableElement);
}
function tabbable(container) {
	const candidates = focusable(container);
	return candidates.filter((element) => getTabIndex(element) >= 0 && isTabbableRadio(element, candidates));
}
function getTabbableIn(container, dir) {
	const list = tabbable(container);
	const len = list.length;
	if (len === 0) return;
	const active = activeElement(ownerDocument(container));
	const index$1 = list.indexOf(active);
	return list[index$1 === -1 ? dir === 1 ? 0 : len - 1 : index$1 + dir];
}
function getNextTabbable(referenceElement) {
	return getTabbableIn(ownerDocument(referenceElement).body, 1) || referenceElement;
}
function getPreviousTabbable(referenceElement) {
	return getTabbableIn(ownerDocument(referenceElement).body, -1) || referenceElement;
}
function getTabbableNearElement(referenceElement, dir) {
	if (!referenceElement) return null;
	const list = tabbable(ownerDocument(referenceElement).body);
	const elementCount = list.length;
	if (elementCount === 0) return null;
	const index$1 = list.indexOf(referenceElement);
	if (index$1 === -1) return null;
	return list[(index$1 + dir + elementCount) % elementCount];
}
function getTabbableAfterElement(referenceElement) {
	return getTabbableNearElement(referenceElement, 1);
}
function getTabbableBeforeElement(referenceElement) {
	return getTabbableNearElement(referenceElement, -1);
}
function isOutsideEvent(event, container) {
	const containerElement = container || event.currentTarget;
	const relatedTarget = event.relatedTarget;
	return !relatedTarget || !contains(containerElement, relatedTarget);
}
function disableFocusInside(container) {
	tabbable(container).forEach((element) => {
		element.dataset.tabindex = element.getAttribute("tabindex") || "";
		element.setAttribute("tabindex", "-1");
	});
}
function enableFocusInside(container) {
	const elements = [];
	appendMatchingElements(container, "[data-tabindex]", elements);
	elements.forEach((element) => {
		const tabindex = element.dataset.tabindex;
		delete element.dataset.tabindex;
		if (tabindex) element.setAttribute("tabindex", tabindex);
		else element.removeAttribute("tabindex");
	});
}

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/useTimeout.mjs
const EMPTY = 0;
var Timeout = class Timeout {
	static create() {
		return new Timeout();
	}
	currentId = EMPTY;
	/**
	* Executes `fn` after `delay`, clearing any previously scheduled call.
	*/
	start(delay, fn) {
		this.clear();
		this.currentId = setTimeout(() => {
			this.currentId = EMPTY;
			fn();
		}, delay);
	}
	isStarted() {
		return this.currentId !== EMPTY;
	}
	clear = () => {
		if (this.currentId !== EMPTY) {
			clearTimeout(this.currentId);
			this.currentId = EMPTY;
		}
	};
	disposeEffect = () => {
		return this.clear;
	};
};
/**
* A `setTimeout` with automatic cleanup and guard.
*/
function useTimeout() {
	const timeout = useRefWithInit(Timeout.create).current;
	useOnMount(timeout.disposeEffect);
	return timeout;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/field/control/FieldControl.mjs
/**
* The form control to label and validate.
* Renders an `<input>` element.
*
* You can omit this part and use any Base UI input component instead. For example,
* [Input](https://base-ui.com/react/components/input), [Checkbox](https://base-ui.com/react/components/checkbox),
* or [Select](https://base-ui.com/react/components/select), among others, will work with Field out of the box.
*
* Documentation: [Base UI Field](https://base-ui.com/react/components/field)
*/
const FieldControl = /* @__PURE__ */ react.forwardRef(function FieldControl$1(componentProps, forwardedRef) {
	const { render, className, id: idProp, name: nameProp, value: valueProp, disabled: disabledProp = false, onValueChange, defaultValue, autoFocus = false, style,...elementProps } = componentProps;
	const { state: fieldState, name: fieldName, disabled: fieldDisabled, setTouched, setDirty, validityData, setFocused, setFilled, validationMode, validation } = useFieldRootContext();
	const { clearErrors } = useFormContext();
	const disabled$1 = fieldDisabled || disabledProp;
	const name = fieldName ?? nameProp;
	const state = {
		...fieldState,
		disabled: disabled$1
	};
	const { labelId } = useLabelableContext();
	const id = useLabelableId({ id: idProp });
	useIsoLayoutEffect(() => {
		const hasExternalValue = valueProp != null;
		if (validation.inputRef.current?.value || hasExternalValue && valueProp !== "") setFilled(true);
		else if (hasExternalValue && valueProp === "") setFilled(false);
	}, [
		validation.inputRef,
		setFilled,
		valueProp
	]);
	const inputRef = react.useRef(null);
	useIsoLayoutEffect(() => {
		if (autoFocus && inputRef.current === activeElement(ownerDocument(inputRef.current))) setFocused(true);
	}, [autoFocus, setFocused]);
	const [valueUnwrapped] = useControlled({
		controlled: valueProp,
		default: defaultValue,
		name: "FieldControl",
		state: "value"
	});
	const isControlled = valueProp !== void 0;
	const value = isControlled ? valueUnwrapped : void 0;
	const getValueFromInput = useStableCallback(() => validation.inputRef.current?.value);
	useRegisterFieldControl(validation.inputRef, id, value, getValueFromInput, !disabled$1, nameProp);
	return useRenderElement("input", componentProps, {
		ref: [forwardedRef, inputRef],
		state,
		props: [
			{
				id,
				disabled: disabled$1,
				name,
				ref: validation.inputRef,
				"aria-labelledby": labelId,
				autoFocus,
				...isControlled ? { value } : { defaultValue },
				onChange(event) {
					const inputValue = event.currentTarget.value;
					onValueChange?.(inputValue, createChangeEventDetails(none, event.nativeEvent));
					setDirty(inputValue !== (validityData.initialValue ?? ""));
					setFilled(inputValue !== "");
					if (!event.nativeEvent.defaultPrevented) {
						clearErrors(name);
						validation.change(inputValue);
					}
				},
				onFocus() {
					setFocused(true);
				},
				onBlur(event) {
					setTouched(true);
					setFocused(false);
					if (validationMode === "onBlur") validation.commit(event.currentTarget.value);
				},
				onKeyDown(event) {
					if (event.currentTarget.tagName === "INPUT" && event.key === "Enter") {
						setTouched(true);
						validation.commit(event.currentTarget.value);
					}
				}
			},
			elementProps,
			(props) => validation.getValidationProps(disabled$1, props)
		],
		stateAttributesMapping: fieldValidityMapping
	});
});

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/input/Input.mjs
const Input = /* @__PURE__ */ react.forwardRef(function Input$1(props, forwardedRef) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FieldControl, {
		ref: forwardedRef,
		...props
	});
});

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/composite/list/CompositeListContext.mjs
const CompositeListContext = /* @__PURE__ */ react.createContext({
	register: () => {},
	unregister: () => {},
	subscribeMapChange: () => () => {},
	nextIndexRef: { current: 0 }
});
function useCompositeListContext() {
	return react.useContext(CompositeListContext);
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/composite/list/CompositeList.mjs
/**
* Provides context for a list of items in a composite component.
*/
function CompositeList(props) {
	const { children, elementsRef, labelsRef, onMapChange: onMapChangeProp } = props;
	const onMapChange = useStableCallback(onMapChangeProp);
	const [, setMapTick] = react.useState(false);
	const listeners = useRefWithInit(createListeners).current;
	const map = useRefWithInit(createMap).current;
	const nextIndexRef = react.useRef(0);
	const isDirtyRef = react.useRef(true);
	const itemsRef = react.useRef([]);
	const mutationObserverRef = react.useRef(null);
	const scheduleMapUpdate = useStableCallback(() => {
		if (isDirtyRef.current) return;
		isDirtyRef.current = true;
		setMapTick((tick) => !tick);
	});
	const register$1 = useStableCallback((node, registration) => {
		map.set(node, registration);
		scheduleMapUpdate();
	});
	const unregister = useStableCallback((node) => {
		map.delete(node);
		scheduleMapUpdate();
	});
	const syncRefs = useStableCallback((items) => {
		const nextMap = /* @__PURE__ */ new Map();
		elementsRef.current.length = 0;
		if (labelsRef) labelsRef.current.length = 0;
		items.forEach((item) => {
			nextMap.set(item.element, {
				...item.registration.metadata ?? {},
				index: item.index
			});
			elementsRef.current[item.index] = item.element;
			if (labelsRef) labelsRef.current[item.index] = item.registration.label !== void 0 ? item.registration.label : item.registration.textRef?.current?.textContent ?? item.element.textContent;
		});
		nextIndexRef.current = elementsRef.current.length;
		return nextMap;
	});
	function observe(sortedNodes) {
		mutationObserverRef.current?.disconnect();
		mutationObserverRef.current = null;
		if (typeof MutationObserver !== "function" || sortedNodes.length < 2) return;
		const mutationObserver = new MutationObserver((entries) => {
			if (!hasMovedNode(entries)) return;
			let previousConnectedNode = null;
			for (const node of sortedNodes) {
				if (!node.isConnected) continue;
				if (previousConnectedNode && sortByDocumentPosition(previousConnectedNode, node) > 0) {
					mutationObserver.disconnect();
					scheduleMapUpdate();
					return;
				}
				previousConnectedNode = node;
			}
		});
		mutationObserverRef.current = mutationObserver;
		const roots = /* @__PURE__ */ new Set();
		for (let i = 1; i < sortedNodes.length; i += 1) {
			const root = getCommonAncestor(sortedNodes[i - 1], sortedNodes[i]);
			if (root) roots.add(root);
		}
		roots.forEach((root) => mutationObserver.observe(root, { childList: true }));
	}
	const flush = useStableCallback(() => {
		const [items, automaticNodes] = getCompositeListSnapshot(map);
		const nextMap = syncRefs(items);
		observe(automaticNodes);
		itemsRef.current = items;
		isDirtyRef.current = false;
		listeners.forEach((listener) => listener(nextMap));
		onMapChange(nextMap);
	});
	useIsoLayoutEffect(() => {
		if (!isDirtyRef.current) syncRefs(itemsRef.current);
		return () => {
			elementsRef.current = [];
			if (labelsRef) labelsRef.current = [];
		};
	}, [
		elementsRef,
		labelsRef,
		syncRefs
	]);
	useIsoLayoutEffect(() => {
		if (isDirtyRef.current) flush();
	});
	useIsoLayoutEffect(() => {
		return () => {
			mutationObserverRef.current?.disconnect();
			isDirtyRef.current = true;
		};
	}, []);
	const subscribeMapChange = useStableCallback((fn) => {
		listeners.add(fn);
		return () => {
			listeners.delete(fn);
		};
	});
	const contextValue = react.useMemo(() => ({
		register: register$1,
		unregister,
		subscribeMapChange,
		nextIndexRef
	}), [
		register$1,
		unregister,
		subscribeMapChange,
		nextIndexRef
	]);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CompositeListContext.Provider, {
		value: contextValue,
		children
	});
}
function createMap() {
	return /* @__PURE__ */ new Map();
}
function createListeners() {
	return /* @__PURE__ */ new Set();
}
function getCompositeListSnapshot(map) {
	const reservedIndices = /* @__PURE__ */ new Set();
	const items = [];
	const automaticItems = [];
	map.forEach((registration, node) => {
		if (!node.isConnected) return;
		const index$1 = registration.index;
		const item = {
			index: index$1 ?? -1,
			element: node,
			registration
		};
		if (index$1 === null) automaticItems.push(item);
		else if (index$1 >= 0) {
			reservedIndices.add(index$1);
			items.push(item);
		}
	});
	let nextAutomaticIndex = 0;
	automaticItems.sort((a, b) => sortByDocumentPosition(a.element, b.element));
	automaticItems.forEach((item) => {
		while (reservedIndices.has(nextAutomaticIndex)) nextAutomaticIndex += 1;
		item.index = nextAutomaticIndex;
		items.push(item);
		nextAutomaticIndex += 1;
	});
	if (reservedIndices.size > 0) items.sort((a, b) => a.index - b.index);
	return [items, automaticItems.map((item) => item.element)];
}
function getCommonAncestor(firstNode, lastNode) {
	let ancestor = firstNode.parentElement;
	while (ancestor && !ancestor.contains(lastNode)) ancestor = ancestor.parentElement;
	return ancestor;
}
function hasMovedNode(entries) {
	for (const entry of entries) for (let i = 0; i < entry.removedNodes.length; i += 1) if (entry.removedNodes[i].isConnected) return true;
	return false;
}
function sortByDocumentPosition(a, b) {
	return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/tabs/root/TabsRootContext.mjs
/**
* @internal
*/
const TabsRootContext = /* @__PURE__ */ react.createContext(void 0);
function useTabsRootContext() {
	const context = react.useContext(TabsRootContext);
	if (context === void 0) throw new Error(formatErrorMessage_default(64));
	return context;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/tabs/root/stateAttributesMapping.mjs
const tabsStateAttributesMapping = { tabActivationDirection: (dir) => ({ "data-activation-direction": dir }) };

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/tabs/root/TabsRoot.mjs
const TabsRoot = /* @__PURE__ */ react.forwardRef(function TabsRoot$1(componentProps, forwardedRef) {
	const { className, defaultValue: defaultValueProp = 0, onValueChange: onValueChangeProp, orientation = "horizontal", render, value: valueProp, style,...elementProps } = componentProps;
	const hasExplicitDefaultValueProp = componentProps.defaultValue !== void 0;
	const tabPanelRefs = react.useRef([]);
	const [mountedTabPanels, setMountedTabPanels] = react.useState(() => /* @__PURE__ */ new Map());
	const [value, setValue] = useControlled({
		controlled: valueProp,
		default: defaultValueProp,
		name: "Tabs",
		state: "value"
	});
	const isControlled = valueProp !== void 0;
	const [tabMap, setTabMap] = react.useState(() => /* @__PURE__ */ new Map());
	const lastKnownTabElementRef = react.useRef(void 0);
	const getTabElementBySelectedValue = react.useCallback((selectedValue) => findTabElement(tabMap, selectedValue), [tabMap]);
	const [activationDirectionState, setActivationDirectionState] = react.useState(() => ({
		previousValue: value,
		tabActivationDirection: "none"
	}));
	const { previousValue, tabActivationDirection: committedTabActivationDirection } = activationDirectionState;
	let tabActivationDirection = committedTabActivationDirection;
	let directionComputationIncomplete = false;
	if (previousValue !== value) {
		tabActivationDirection = computeActivationDirection(previousValue, value, orientation, tabMap);
		directionComputationIncomplete = previousValue != null && value != null && getTabElementBySelectedValue(value) == null;
	}
	const nextPreviousValue = directionComputationIncomplete ? previousValue : value;
	const shouldSyncActivationDirectionState = previousValue !== nextPreviousValue || committedTabActivationDirection !== tabActivationDirection;
	useIsoLayoutEffect(() => {
		if (!shouldSyncActivationDirectionState) return;
		setActivationDirectionState({
			previousValue: nextPreviousValue,
			tabActivationDirection
		});
	}, [
		nextPreviousValue,
		shouldSyncActivationDirectionState,
		tabActivationDirection
	]);
	const onValueChange = useStableCallback((newValue, eventDetails) => {
		eventDetails.activationDirection = computeActivationDirection(value, newValue, orientation, tabMap);
		onValueChangeProp?.(newValue, eventDetails);
		if (eventDetails.isCanceled) return;
		setValue(newValue);
	});
	const notifyAutomaticValueChange = useStableCallback((nextValue, reason) => {
		onValueChangeProp?.(nextValue, createChangeEventDetails(reason, void 0, void 0, { activationDirection: "none" }));
	});
	const registerMountedTabPanel = useStableCallback((panelValue, panelId) => {
		setMountedTabPanels((prev) => {
			const next = new Map(prev);
			next.set(panelValue, panelId);
			return next;
		});
		return () => {
			setMountedTabPanels((prev) => {
				if (prev.get(panelValue) !== panelId) return prev;
				const next = new Map(prev);
				next.delete(panelValue);
				return next;
			});
		};
	});
	const getTabPanelIdByValue = react.useCallback((tabValue) => {
		return mountedTabPanels.get(tabValue);
	}, [mountedTabPanels]);
	const getTabIdByPanelValue = react.useCallback((tabPanelValue) => {
		for (const tabMetadata of tabMap.values()) if (tabPanelValue === tabMetadata.value) return tabMetadata.id;
	}, [tabMap]);
	const tabsContextValue = react.useMemo(() => ({
		getTabElementBySelectedValue,
		getTabIdByPanelValue,
		getTabPanelIdByValue,
		onValueChange,
		orientation,
		registerMountedTabPanel,
		setTabMap,
		tabActivationDirection,
		value
	}), [
		getTabElementBySelectedValue,
		getTabIdByPanelValue,
		getTabPanelIdByValue,
		onValueChange,
		orientation,
		registerMountedTabPanel,
		setTabMap,
		tabActivationDirection,
		value
	]);
	const selectedTabMetadata = react.useMemo(() => {
		for (const tabMetadata of tabMap.values()) if (tabMetadata.value === value) return tabMetadata;
	}, [tabMap, value]);
	const firstEnabledTabValue = react.useMemo(() => {
		for (const tabMetadata of tabMap.values()) if (!tabMetadata.disabled) return tabMetadata.value;
	}, [tabMap]);
	const shouldNotifyInitialValueChangeRef = react.useRef(!hasExplicitDefaultValueProp);
	const initialDefaultValueRef = react.useRef(defaultValueProp);
	const shouldHonorDisabledDefaultValueRef = react.useRef(hasExplicitDefaultValueProp);
	const didRegisterTabsRef = react.useRef(false);
	useIsoLayoutEffect(() => {
		if (isControlled) return;
		function commitAutomaticValueChange(fallbackValue, fallbackReason) {
			setValue(fallbackValue);
			setActivationDirectionState({
				previousValue: fallbackValue,
				tabActivationDirection: "none"
			});
			notifyAutomaticValueChange(fallbackValue, fallbackReason);
			shouldNotifyInitialValueChangeRef.current = false;
		}
		if (tabMap.size === 0) {
			if (didRegisterTabsRef.current && value !== null && !lastKnownTabElementRef.current?.isConnected) commitAutomaticValueChange(null, missing);
			return;
		}
		didRegisterTabsRef.current = true;
		lastKnownTabElementRef.current = tabMap.keys().next().value;
		const selectionIsDisabled = selectedTabMetadata?.disabled;
		const selectionIsMissing = selectedTabMetadata == null && value !== null;
		if (!selectionIsDisabled && value === initialDefaultValueRef.current) shouldHonorDisabledDefaultValueRef.current = false;
		if (shouldHonorDisabledDefaultValueRef.current && selectionIsDisabled && value === initialDefaultValueRef.current) return;
		const shouldNotifyInitialValueChange = shouldNotifyInitialValueChangeRef.current;
		if (selectionIsDisabled || selectionIsMissing) {
			const fallbackValue = firstEnabledTabValue ?? null;
			if (value === fallbackValue) {
				shouldNotifyInitialValueChangeRef.current = false;
				return;
			}
			let fallbackReason = missing;
			if (shouldNotifyInitialValueChange) fallbackReason = initial;
			else if (selectionIsDisabled) fallbackReason = disabled;
			commitAutomaticValueChange(fallbackValue, fallbackReason);
			return;
		}
		if (shouldNotifyInitialValueChange && selectedTabMetadata != null) {
			notifyAutomaticValueChange(value, initial);
			shouldNotifyInitialValueChangeRef.current = false;
		}
	}, [
		firstEnabledTabValue,
		isControlled,
		notifyAutomaticValueChange,
		selectedTabMetadata,
		setValue,
		tabMap,
		value
	]);
	const element = useRenderElement("div", componentProps, {
		state: {
			orientation,
			tabActivationDirection
		},
		ref: forwardedRef,
		props: elementProps,
		stateAttributesMapping: tabsStateAttributesMapping
	});
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TabsRootContext.Provider, {
		value: tabsContextValue,
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CompositeList, {
			elementsRef: tabPanelRefs,
			children: element
		})
	});
});
function findTabElement(tabMap, value) {
	for (const [tabElement, tabMetadata] of tabMap.entries()) if (value === tabMetadata.value) return tabElement;
	return null;
}
function computeActivationDirection(oldValue, newValue, orientation, tabMap) {
	if (oldValue == null || newValue == null) return "none";
	const [positionProp, backward, forward] = orientation === "horizontal" ? [
		"left",
		"left",
		"right"
	] : [
		"top",
		"up",
		"down"
	];
	const oldTab = findTabElement(tabMap, oldValue);
	const newTab = findTabElement(tabMap, newValue);
	if (oldTab == null || newTab == null) {
		if (oldTab !== newTab && (typeof oldValue === "number" || typeof oldValue === "string") && typeof oldValue === typeof newValue) return newValue > oldValue ? forward : backward;
		return "none";
	}
	const oldPosition = oldTab.getBoundingClientRect()[positionProp];
	const newPosition = newTab.getBoundingClientRect()[positionProp];
	if (newPosition < oldPosition) return backward;
	if (newPosition > oldPosition) return forward;
	return "none";
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/composite/constants.mjs
const ACTIVE_COMPOSITE_ITEM = "data-composite-item-active";

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/composite/list/useCompositeListItem.mjs
/**
* Used to register a list item and its index (DOM position) in the `CompositeList`.
*/
function useCompositeListItem(params = {}) {
	const { guess, label, metadata, textRef, index: externalIndex } = params;
	const { register: register$1, unregister, subscribeMapChange, nextIndexRef } = useCompositeListContext();
	const indexRef = react.useRef(-1);
	const [internalIndex, setInternalIndex] = react.useState(externalIndex == null && guess ? () => {
		if (indexRef.current === -1) {
			const newIndex = nextIndexRef.current;
			nextIndexRef.current += 1;
			indexRef.current = newIndex;
		}
		return indexRef.current;
	} : -1);
	const index$1 = externalIndex ?? internalIndex;
	const componentRef = react.useRef(null);
	const ref = react.useCallback((node) => {
		const previousNode = componentRef.current;
		if (previousNode) unregister(previousNode);
		componentRef.current = node;
		if (node) register$1(node, {
			metadata: metadata ?? null,
			index: externalIndex ?? null,
			label,
			textRef
		});
	}, [
		externalIndex,
		register$1,
		unregister,
		metadata,
		label,
		textRef
	]);
	useIsoLayoutEffect(() => {
		if (externalIndex != null) return;
		return subscribeMapChange((map) => {
			const i = componentRef.current ? map.get(componentRef.current)?.index : null;
			if (i != null) setInternalIndex(i);
		});
	}, [externalIndex, subscribeMapChange]);
	return {
		ref,
		index: index$1
	};
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/composite/item/useCompositeItem.mjs
function useCompositeItem(params = {}) {
	const { highlightItemOnHover, highlightedIndex, onHighlightedIndexChange } = useCompositeRootContext();
	const { ref, index: index$1 } = useCompositeListItem(params);
	const isHighlighted = highlightedIndex === index$1;
	const itemRef = react.useRef(null);
	const mergedRef = useMergedRefs(ref, itemRef);
	return {
		compositeProps: {
			tabIndex: isHighlighted ? 0 : -1,
			onFocus() {
				onHighlightedIndexChange(index$1);
			},
			onMouseMove() {
				const item = itemRef.current;
				if (!highlightItemOnHover || !item) return;
				const disabled$1 = item.hasAttribute("disabled") || item.ariaDisabled === "true";
				if (!isHighlighted && !disabled$1) item.focus();
			}
		},
		compositeRef: mergedRef,
		index: index$1
	};
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/tabs/list/TabsListContext.mjs
const TabsListContext = /* @__PURE__ */ react.createContext(void 0);
function useTabsListContext() {
	const context = react.useContext(TabsListContext);
	if (context === void 0) throw new Error(formatErrorMessage_default(65));
	return context;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/tabs/tab/TabsTab.mjs
/**
* An individual interactive tab button that toggles the corresponding panel.
* Renders a `<button>` element.
*
* Documentation: [Base UI Tabs](https://base-ui.com/react/components/tabs)
*/
const TabsTab = /* @__PURE__ */ react.forwardRef(function TabsTab$1(componentProps, forwardedRef) {
	const { className, disabled: disabled$1 = false, render, value, id: idProp, nativeButton = true, style,...elementProps } = componentProps;
	const { value: activeTabValue, getTabPanelIdByValue, onValueChange, orientation, tabActivationDirection } = useTabsRootContext();
	const { activateOnFocus, registerTabResizeObserverElement, tabsListElement } = useTabsListContext();
	const { highlightedIndex, onHighlightedIndexChange } = useCompositeRootContext();
	const id = useBaseUiId(idProp);
	const { compositeProps, compositeRef, index: index$1 } = useCompositeItem({ metadata: react.useMemo(() => ({
		disabled: disabled$1,
		id,
		value
	}), [
		disabled$1,
		id,
		value
	]) });
	const active = value === activeTabValue;
	const isNavigatingRef = react.useRef(false);
	const unobserveTabElementRef = react.useRef(null);
	const observeTabElement = useStableCallback((element) => {
		unobserveTabElementRef.current?.();
		unobserveTabElementRef.current = element ? registerTabResizeObserverElement(element) : null;
	});
	useIsoLayoutEffect(() => {
		if (isNavigatingRef.current) {
			isNavigatingRef.current = false;
			return;
		}
		if (!(active && index$1 > -1 && highlightedIndex !== index$1)) return;
		const listElement = tabsListElement;
		if (listElement != null) {
			const activeEl = activeElement(ownerDocument(listElement));
			if (activeEl && contains(listElement, activeEl)) return;
		}
		if (!disabled$1) onHighlightedIndexChange(index$1);
	}, [
		active,
		index$1,
		highlightedIndex,
		onHighlightedIndexChange,
		disabled$1,
		tabsListElement
	]);
	const { getButtonProps, buttonRef } = useButton({
		disabled: disabled$1,
		native: nativeButton,
		focusableWhenDisabled: true
	});
	const tabPanelId = getTabPanelIdByValue(value);
	const isPressingRef = react.useRef(false);
	const isMainButtonRef = react.useRef(false);
	function activate(event) {
		onValueChange(value, createChangeEventDetails(none, event.nativeEvent, void 0, { activationDirection: "none" }));
	}
	function onClick(event) {
		if (active || disabled$1) return;
		activate(event);
	}
	function onFocus(event) {
		if (active || disabled$1) return;
		if (activateOnFocus && (!isPressingRef.current || isMainButtonRef.current)) activate(event);
	}
	function onPointerDown(event) {
		if (active || disabled$1) return;
		isPressingRef.current = true;
		isMainButtonRef.current = event.button === 0;
		const doc = ownerDocument(event.currentTarget);
		function handlePointerEnd() {
			isPressingRef.current = false;
			isMainButtonRef.current = false;
			doc.removeEventListener("pointerup", handlePointerEnd);
			doc.removeEventListener("pointercancel", handlePointerEnd);
		}
		doc.addEventListener("pointerup", handlePointerEnd);
		doc.addEventListener("pointercancel", handlePointerEnd);
	}
	return useRenderElement("button", componentProps, {
		state: {
			disabled: disabled$1,
			active,
			orientation,
			tabActivationDirection
		},
		ref: [
			forwardedRef,
			buttonRef,
			compositeRef,
			observeTabElement
		],
		props: [
			compositeProps,
			{
				role: "tab",
				"aria-controls": tabPanelId,
				"aria-selected": active,
				id,
				onClick,
				onFocus,
				onPointerDown,
				[ACTIVE_COMPOSITE_ITEM]: active ? "" : void 0,
				onKeyDownCapture() {
					isNavigatingRef.current = true;
				}
			},
			elementProps,
			getButtonProps
		],
		stateAttributesMapping: tabsStateAttributesMapping
	});
});

//#endregion
//#region node_modules/.pnpm/use-sync-external-store@1.6.0_react@18.3.1/node_modules/use-sync-external-store/cjs/use-sync-external-store-shim.production.js
var require_use_sync_external_store_shim_production = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/use-sync-external-store@1.6.0_react@18.3.1/node_modules/use-sync-external-store/cjs/use-sync-external-store-shim.production.js": ((exports) => {
	var React$1 = require("react");
	function is$1(x, y) {
		return x === y && (0 !== x || 1 / x === 1 / y) || x !== x && y !== y;
	}
	var objectIs$1 = "function" === typeof Object.is ? Object.is : is$1, useState = React$1.useState, useEffect$1 = React$1.useEffect, useLayoutEffect$1 = React$1.useLayoutEffect, useDebugValue$1 = React$1.useDebugValue;
	function useSyncExternalStore$2$1(subscribe$1, getSnapshot$1) {
		var value = getSnapshot$1(), _useState = useState({ inst: {
			value,
			getSnapshot: getSnapshot$1
		} }), inst = _useState[0].inst, forceUpdate = _useState[1];
		useLayoutEffect$1(function() {
			inst.value = value;
			inst.getSnapshot = getSnapshot$1;
			checkIfSnapshotChanged(inst) && forceUpdate({ inst });
		}, [
			subscribe$1,
			value,
			getSnapshot$1
		]);
		useEffect$1(function() {
			checkIfSnapshotChanged(inst) && forceUpdate({ inst });
			return subscribe$1(function() {
				checkIfSnapshotChanged(inst) && forceUpdate({ inst });
			});
		}, [subscribe$1]);
		useDebugValue$1(value);
		return value;
	}
	function checkIfSnapshotChanged(inst) {
		var latestGetSnapshot = inst.getSnapshot;
		inst = inst.value;
		try {
			var nextValue = latestGetSnapshot();
			return !objectIs$1(inst, nextValue);
		} catch (error) {
			return !0;
		}
	}
	function useSyncExternalStore$1$1(subscribe$1, getSnapshot$1) {
		return getSnapshot$1();
	}
	var shim$1 = "undefined" === typeof window || "undefined" === typeof window.document || "undefined" === typeof window.document.createElement ? useSyncExternalStore$1$1 : useSyncExternalStore$2$1;
	exports.useSyncExternalStore = void 0 !== React$1.useSyncExternalStore ? React$1.useSyncExternalStore : shim$1;
}) });

//#endregion
//#region node_modules/.pnpm/use-sync-external-store@1.6.0_react@18.3.1/node_modules/use-sync-external-store/shim/index.js
var require_shim = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/use-sync-external-store@1.6.0_react@18.3.1/node_modules/use-sync-external-store/shim/index.js": ((exports, module) => {
	module.exports = require_use_sync_external_store_shim_production();
}) });

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/inertValue.mjs
function inertValue(value) {
	if (isReactVersionAtLeast(19)) return value;
	return value ? "true" : void 0;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/tabs/panel/TabsPanel.mjs
const stateAttributesMapping = {
	...tabsStateAttributesMapping,
	...transitionStatusMapping
};
/**
* A panel displayed when the corresponding tab is active.
* Renders a `<div>` element.
*
* Documentation: [Base UI Tabs](https://base-ui.com/react/components/tabs)
*/
const TabsPanel = /* @__PURE__ */ react.forwardRef(function TabsPanel$1(componentProps, forwardedRef) {
	const { className, value, render, keepMounted = false, style,...elementProps } = componentProps;
	const { value: selectedValue, getTabIdByPanelValue, orientation, tabActivationDirection, registerMountedTabPanel } = useTabsRootContext();
	const id = useBaseUiId();
	const { ref: listItemRef, index: index$1 } = useCompositeListItem();
	const open = value === selectedValue;
	const { mounted, transitionStatus, setMounted } = useTransitionStatus(open);
	const hidden = !mounted;
	const correspondingTabId = getTabIdByPanelValue(value);
	const state = {
		hidden,
		orientation,
		tabActivationDirection,
		transitionStatus
	};
	const panelRef = react.useRef(null);
	const element = useRenderElement("div", componentProps, {
		state,
		ref: [
			forwardedRef,
			listItemRef,
			panelRef
		],
		props: [{
			"aria-labelledby": correspondingTabId,
			hidden,
			id,
			role: "tabpanel",
			tabIndex: open ? 0 : -1,
			inert: inertValue(!open),
			["data-index"]: index$1
		}, elementProps],
		stateAttributesMapping
	});
	useOpenChangeComplete({
		open,
		ref: panelRef,
		onComplete() {
			if (!open) setMounted(false);
		}
	});
	useIsoLayoutEffect(() => {
		if (id == null || hidden && !keepMounted) return;
		return registerMountedTabPanel(value, id);
	}, [
		hidden,
		keepMounted,
		value,
		id,
		registerMountedTabPanel
	]);
	if (!(keepMounted || mounted)) return null;
	return element;
});

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/isElementDisabled.mjs
function isElementDisabled(element) {
	return element == null || element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true";
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/composite/composite.mjs
const ARROW_UP = "ArrowUp";
const ARROW_DOWN = "ArrowDown";
const ARROW_LEFT = "ArrowLeft";
const ARROW_RIGHT = "ArrowRight";
const HOME = "Home";
const END = "End";
const COMPOSITE_KEYS = new Set([
	ARROW_UP,
	ARROW_DOWN,
	ARROW_LEFT,
	ARROW_RIGHT,
	HOME,
	END
]);
const SHIFT = "Shift";
const MODIFIER_KEYS = [
	SHIFT,
	"Control",
	"Alt",
	"Meta"
];
function isInputElement(element) {
	return isHTMLElement(element) && element.tagName === "INPUT";
}
function isNativeInput(element) {
	if (isInputElement(element) && element.selectionStart != null) return true;
	if (isHTMLElement(element) && element.tagName === "TEXTAREA") return true;
	return false;
}
function scrollIntoViewIfNeeded(scrollContainer, element, direction, orientation) {
	if (!scrollContainer || !element || !element.scrollTo) return;
	let targetX = scrollContainer.scrollLeft;
	let targetY = scrollContainer.scrollTop;
	const isOverflowingX = scrollContainer.clientWidth < scrollContainer.scrollWidth;
	const isOverflowingY = scrollContainer.clientHeight < scrollContainer.scrollHeight;
	if (isOverflowingX && orientation !== "vertical") {
		const elementOffsetLeft = getOffset(scrollContainer, element, "left");
		const containerStyles = getStyles(scrollContainer);
		const elementStyles = getStyles(element);
		if (direction === "ltr") {
			if (elementOffsetLeft + element.offsetWidth + elementStyles.scrollMarginRight > scrollContainer.scrollLeft + scrollContainer.clientWidth - containerStyles.scrollPaddingRight) targetX = elementOffsetLeft + element.offsetWidth + elementStyles.scrollMarginRight - scrollContainer.clientWidth + containerStyles.scrollPaddingRight;
			else if (elementOffsetLeft - elementStyles.scrollMarginLeft < scrollContainer.scrollLeft + containerStyles.scrollPaddingLeft) targetX = elementOffsetLeft - elementStyles.scrollMarginLeft - containerStyles.scrollPaddingLeft;
		}
		if (direction === "rtl") {
			if (elementOffsetLeft - elementStyles.scrollMarginLeft < scrollContainer.scrollLeft + containerStyles.scrollPaddingLeft) targetX = elementOffsetLeft - elementStyles.scrollMarginLeft - containerStyles.scrollPaddingLeft;
			else if (elementOffsetLeft + element.offsetWidth + elementStyles.scrollMarginRight > scrollContainer.scrollLeft + scrollContainer.clientWidth - containerStyles.scrollPaddingRight) targetX = elementOffsetLeft + element.offsetWidth + elementStyles.scrollMarginRight - scrollContainer.clientWidth + containerStyles.scrollPaddingRight;
		}
	}
	if (isOverflowingY && orientation !== "horizontal") {
		const elementOffsetTop = getOffset(scrollContainer, element, "top");
		const containerStyles = getStyles(scrollContainer);
		const elementStyles = getStyles(element);
		if (elementOffsetTop - elementStyles.scrollMarginTop < scrollContainer.scrollTop + containerStyles.scrollPaddingTop) targetY = elementOffsetTop - elementStyles.scrollMarginTop - containerStyles.scrollPaddingTop;
		else if (elementOffsetTop + element.offsetHeight + elementStyles.scrollMarginBottom > scrollContainer.scrollTop + scrollContainer.clientHeight - containerStyles.scrollPaddingBottom) targetY = elementOffsetTop + element.offsetHeight + elementStyles.scrollMarginBottom - scrollContainer.clientHeight + containerStyles.scrollPaddingBottom;
	}
	scrollContainer.scrollTo({
		left: targetX,
		top: targetY,
		behavior: "auto"
	});
}
function getOffset(ancestor, element, side) {
	const propName = side === "left" ? "offsetLeft" : "offsetTop";
	let result = 0;
	while (element.offsetParent) {
		result += element[propName];
		if (element.offsetParent === ancestor) break;
		element = element.offsetParent;
	}
	return result;
}
function getStyles(element) {
	const styles = getComputedStyle(element);
	return {
		scrollMarginTop: parseFloat(styles.scrollMarginTop) || 0,
		scrollMarginRight: parseFloat(styles.scrollMarginRight) || 0,
		scrollMarginBottom: parseFloat(styles.scrollMarginBottom) || 0,
		scrollMarginLeft: parseFloat(styles.scrollMarginLeft) || 0,
		scrollPaddingTop: parseFloat(styles.scrollPaddingTop) || 0,
		scrollPaddingRight: parseFloat(styles.scrollPaddingRight) || 0,
		scrollPaddingBottom: parseFloat(styles.scrollPaddingBottom) || 0,
		scrollPaddingLeft: parseFloat(styles.scrollPaddingLeft) || 0
	};
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/composite/root/useCompositeRoot.mjs
const EMPTY_ARRAY$1 = [];
function useCompositeRoot(params) {
	const { loopFocus = true, orientation = "both", grid, onLoop, direction, highlightedIndex: externalHighlightedIndex, onHighlightedIndexChange: externalSetHighlightedIndex, rootRef: externalRef, enableHomeAndEndKeys = false, stopEventPropagation, disabledIndices, modifierKeys = EMPTY_ARRAY$1 } = params;
	const [internalHighlightedIndex, internalSetHighlightedIndex] = react.useState(0);
	const isGrid = grid != null;
	const rootRef = react.useRef(null);
	const mergedRef = useMergedRefs(rootRef, externalRef);
	const elementsRef = react.useRef([]);
	const hasSetDefaultIndexRef = react.useRef(false);
	const highlightedIndex = externalHighlightedIndex ?? internalHighlightedIndex;
	const onHighlightedIndexChange = useStableCallback((index$1, shouldScrollIntoView = false) => {
		(externalSetHighlightedIndex ?? internalSetHighlightedIndex)(index$1);
		if (shouldScrollIntoView) {
			const newActiveItem = elementsRef.current[index$1];
			scrollIntoViewIfNeeded(rootRef.current, newActiveItem, direction, orientation);
		}
	});
	const onMapChange = useStableCallback((map) => {
		if (map.size === 0 || hasSetDefaultIndexRef.current) return;
		hasSetDefaultIndexRef.current = true;
		const sortedElements = Array.from(map.keys());
		const activeItem = sortedElements.find((compositeElement) => compositeElement?.hasAttribute(ACTIVE_COMPOSITE_ITEM)) ?? null;
		const activeIndex = activeItem ? map.get(activeItem)?.index ?? -1 : -1;
		if (activeIndex !== -1) onHighlightedIndexChange(activeIndex);
		else if (isListIndexDisabled(sortedElements, highlightedIndex, disabledIndices)) {
			const firstEnabledIndex = findNonDisabledListIndex(sortedElements, { disabledIndices });
			if (!isIndexOutOfListBounds(sortedElements, firstEnabledIndex)) onHighlightedIndexChange(firstEnabledIndex);
		}
		scrollIntoViewIfNeeded(rootRef.current, activeItem, direction, orientation);
	});
	useIsoLayoutEffect(() => {
		if (disabledIndices == null || externalHighlightedIndex != null || !hasSetDefaultIndexRef.current) return;
		const elements = elementsRef.current;
		if (isListIndexDisabled(elements, highlightedIndex, disabledIndices)) {
			const firstEnabledIndex = findNonDisabledListIndex(elements, { disabledIndices });
			if (!isIndexOutOfListBounds(elements, firstEnabledIndex)) onHighlightedIndexChange(firstEnabledIndex);
		}
	}, [
		disabledIndices,
		externalHighlightedIndex,
		highlightedIndex,
		elementsRef,
		onHighlightedIndexChange
	]);
	const wrappedOnLoop = useStableCallback((event, prevIndex, nextIndex) => {
		if (!onLoop) return nextIndex;
		return onLoop(event, prevIndex, nextIndex, elementsRef);
	});
	const onKeyDown = useStableCallback((event) => {
		const isHomeOrEnd = event.key === HOME || event.key === END;
		if (!COMPOSITE_KEYS.has(event.key) || !enableHomeAndEndKeys && isHomeOrEnd) return;
		if (isModifierKeySet(event, modifierKeys)) return;
		if (!rootRef.current) return;
		const isRtl = direction === "rtl";
		const horizontalForwardKey = isRtl ? ARROW_LEFT : ARROW_RIGHT;
		const horizontalBackwardKey = isRtl ? ARROW_RIGHT : ARROW_LEFT;
		const forwardKey = orientation === "vertical" ? ARROW_DOWN : horizontalForwardKey;
		const backwardKey = orientation === "vertical" ? ARROW_UP : horizontalBackwardKey;
		const target = getTarget(event.nativeEvent);
		if (target != null && isNativeInput(target) && !isElementDisabled(target)) {
			const selectionStart = target.selectionStart;
			const selectionEnd = target.selectionEnd;
			const textContent = target.value;
			if (selectionStart == null || event.shiftKey || selectionStart !== selectionEnd) return;
			if (event.key !== backwardKey && selectionStart < textContent.length) return;
			if (event.key !== forwardKey && selectionStart > 0) return;
		}
		let nextIndex = highlightedIndex;
		const minIndex = getMinListIndex(elementsRef, disabledIndices);
		const maxIndex = getMaxListIndex(elementsRef, disabledIndices);
		if (grid != null) nextIndex = grid({
			disabledIndices,
			elementsRef,
			event,
			highlightedIndex,
			loopFocus,
			maxIndex,
			minIndex,
			onLoop: wrappedOnLoop,
			orientation,
			rtl: isRtl
		});
		const isForwardKey = orientation !== "vertical" && event.key === horizontalForwardKey || orientation !== "horizontal" && event.key === ARROW_DOWN;
		const isBackwardKey = orientation !== "vertical" && event.key === horizontalBackwardKey || orientation !== "horizontal" && event.key === ARROW_UP;
		if (enableHomeAndEndKeys) {
			if (event.key === HOME) nextIndex = minIndex;
			else if (event.key === END) nextIndex = maxIndex;
		}
		if (nextIndex === highlightedIndex && (isForwardKey || isBackwardKey)) if (loopFocus && nextIndex === maxIndex && isForwardKey) {
			nextIndex = minIndex;
			if (onLoop) nextIndex = onLoop(event, highlightedIndex, nextIndex, elementsRef);
		} else if (loopFocus && nextIndex === minIndex && isBackwardKey) {
			nextIndex = maxIndex;
			if (onLoop) nextIndex = onLoop(event, highlightedIndex, nextIndex, elementsRef);
		} else nextIndex = findNonDisabledListIndex(elementsRef.current, {
			startingIndex: nextIndex,
			decrement: isBackwardKey,
			disabledIndices
		});
		if (nextIndex !== highlightedIndex && !isIndexOutOfListBounds(elementsRef.current, nextIndex)) {
			if (stopEventPropagation) event.stopPropagation();
			if (isGrid || isHomeOrEnd || isForwardKey || isBackwardKey) event.preventDefault();
			onHighlightedIndexChange(nextIndex, true);
			queueMicrotask(() => {
				elementsRef.current[nextIndex]?.focus();
			});
		}
	});
	return {
		props: {
			ref: mergedRef,
			onFocus(event) {
				const element = rootRef.current;
				const target = getTarget(event.nativeEvent);
				if (!element || target == null || !isNativeInput(target)) return;
				target.setSelectionRange(0, target.value.length);
			},
			onKeyDown
		},
		highlightedIndex,
		onHighlightedIndexChange,
		elementsRef,
		onMapChange,
		relayKeyboardEvent: onKeyDown
	};
}
function isModifierKeySet(event, ignoredModifierKeys) {
	for (const key of MODIFIER_KEYS) {
		if (ignoredModifierKeys.includes(key)) continue;
		if (event.getModifierState(key)) return true;
	}
	return false;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/direction-context/DirectionContext.mjs
const DirectionContext = /* @__PURE__ */ react.createContext(void 0);
function useDirection() {
	return react.useContext(DirectionContext)?.direction ?? "ltr";
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/composite/root/CompositeRoot.mjs
function CompositeRoot(componentProps) {
	const { render, className, style, refs = EMPTY_ARRAY, props = EMPTY_ARRAY, state = EMPTY_OBJECT, stateAttributesMapping: stateAttributesMapping$3, highlightedIndex: highlightedIndexProp, onHighlightedIndexChange: onHighlightedIndexChangeProp, orientation, grid, loopFocus, onLoop, enableHomeAndEndKeys, onMapChange: onMapChangeProp, stopEventPropagation = true, rootRef, disabledIndices, modifierKeys, highlightItemOnHover = false, tag = "div",...elementProps } = componentProps;
	const { props: defaultProps, highlightedIndex, onHighlightedIndexChange, elementsRef, onMapChange: onMapChangeUnwrapped, relayKeyboardEvent } = useCompositeRoot({
		grid,
		loopFocus,
		onLoop,
		orientation,
		highlightedIndex: highlightedIndexProp,
		onHighlightedIndexChange: onHighlightedIndexChangeProp,
		rootRef,
		stopEventPropagation,
		enableHomeAndEndKeys,
		direction: useDirection(),
		disabledIndices,
		modifierKeys
	});
	const element = useRenderElement(tag, componentProps, {
		state,
		ref: refs,
		props: [
			defaultProps,
			...props,
			elementProps
		],
		stateAttributesMapping: stateAttributesMapping$3
	});
	const contextValue = react.useMemo(() => ({
		highlightedIndex,
		onHighlightedIndexChange,
		highlightItemOnHover,
		relayKeyboardEvent
	}), [
		highlightedIndex,
		onHighlightedIndexChange,
		highlightItemOnHover,
		relayKeyboardEvent
	]);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CompositeRootContext.Provider, {
		value: contextValue,
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CompositeList, {
			elementsRef,
			onMapChange: (newMap) => {
				onMapChangeProp?.(newMap);
				onMapChangeUnwrapped(newMap);
			},
			children: element
		})
	});
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/tabs/list/TabsList.mjs
const TabsList = /* @__PURE__ */ react.forwardRef(function TabsList$1(componentProps, forwardedRef) {
	const { activateOnFocus = false, className, loopFocus = true, render, style,...elementProps } = componentProps;
	const { orientation, setTabMap, tabActivationDirection } = useTabsRootContext();
	const [highlightedTabIndex, setHighlightedTabIndex] = react.useState(0);
	const [tabsListElement, setTabsListElement] = react.useState(null);
	const indicatorUpdateListenersRef = react.useRef(/* @__PURE__ */ new Set());
	const tabResizeObserverElementsRef = react.useRef(/* @__PURE__ */ new Set());
	const resizeObserverRef = react.useRef(null);
	useIsoLayoutEffect(() => {
		if (typeof ResizeObserver === "undefined") return;
		const resizeObserver = new ResizeObserver(() => {
			indicatorUpdateListenersRef.current.forEach((listener) => {
				listener();
			});
		});
		resizeObserverRef.current = resizeObserver;
		if (tabsListElement) resizeObserver.observe(tabsListElement);
		tabResizeObserverElementsRef.current.forEach((element) => {
			resizeObserver.observe(element);
		});
		return () => {
			resizeObserver.disconnect();
			resizeObserverRef.current = null;
		};
	}, [tabsListElement]);
	const registerIndicatorUpdateListener = useStableCallback((listener) => {
		indicatorUpdateListenersRef.current.add(listener);
		return () => {
			indicatorUpdateListenersRef.current.delete(listener);
		};
	});
	const registerTabResizeObserverElement = useStableCallback((element) => {
		tabResizeObserverElementsRef.current.add(element);
		resizeObserverRef.current?.observe(element);
		return () => {
			tabResizeObserverElementsRef.current.delete(element);
			resizeObserverRef.current?.unobserve(element);
		};
	});
	const state = {
		orientation,
		tabActivationDirection
	};
	const defaultProps = {
		"aria-orientation": orientation === "vertical" ? "vertical" : void 0,
		role: "tablist"
	};
	const tabsListContextValue = react.useMemo(() => ({
		activateOnFocus,
		registerIndicatorUpdateListener,
		registerTabResizeObserverElement,
		tabsListElement
	}), [
		activateOnFocus,
		registerIndicatorUpdateListener,
		registerTabResizeObserverElement,
		tabsListElement
	]);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TabsListContext.Provider, {
		value: tabsListContextValue,
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CompositeRoot, {
			render,
			className,
			style,
			state,
			refs: [forwardedRef, setTabsListElement],
			props: [defaultProps, elementProps],
			stateAttributesMapping: tabsStateAttributesMapping,
			highlightedIndex: highlightedTabIndex,
			enableHomeAndEndKeys: true,
			loopFocus,
			orientation,
			onHighlightedIndexChange: setHighlightedTabIndex,
			onMapChange: setTabMap,
			disabledIndices: EMPTY_ARRAY
		})
	});
});

//#endregion
//#region src/client/row-icon.ts
/** A skill row leads with the host's own skill glyph. */
function skillRowIcon() {
	return react.createElement(IconSkill, { size: 14 });
}
/** An MCP server row leads with the host's own extension glyph. */
function serverRowIcon() {
	return react.createElement(IconCordisPlugin, { size: 14 });
}
/** Every tool row leads with the host's unclassified-tool glyph. */
function toolRowIcon() {
	return react.createElement(IconSparkle, { size: 14 });
}

//#endregion
//#region src/client/preset-filter.ts
function filterPreset(preset, rawQuery) {
	return filterCapabilities(preset, rawQuery);
}

//#endregion
//#region src/preset-wire.ts
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
function parseTools(raw) {
	const tools = [];
	for (const rawTool of raw) {
		if (!isRecord(rawTool)) return null;
		const { name, label, description, enabled, reserved } = rawTool;
		if (typeof name !== "string" || typeof label !== "string" || typeof enabled !== "boolean") return null;
		if (description !== void 0 && typeof description !== "string") return null;
		if (reserved !== void 0 && typeof reserved !== "boolean") return null;
		tools.push({
			name,
			label,
			...description === void 0 ? {} : { description },
			enabled,
			...reserved === void 0 ? {} : { reserved }
		});
	}
	return tools;
}
function parseSkills(raw) {
	const skills = [];
	for (const rawSkill of raw) {
		if (!isRecord(rawSkill)) return null;
		const { name, description, enabled, project, source, path, group } = rawSkill;
		if (typeof name !== "string" || typeof enabled !== "boolean") return null;
		if (description !== void 0 && typeof description !== "string") return null;
		if (project !== void 0 && typeof project !== "boolean") return null;
		if (source !== void 0 && typeof source !== "string") return null;
		if (path !== void 0 && typeof path !== "string") return null;
		if (group !== void 0 && typeof group !== "string") return null;
		skills.push({
			name,
			...description === void 0 ? {} : { description },
			enabled,
			...project === void 0 ? {} : { project },
			...source === void 0 ? {} : { source },
			...path === void 0 ? {} : { path },
			...group === void 0 ? {} : { group }
		});
	}
	return skills;
}
/** Parse one payload, returning null for anything that is not the contract. */
function parsePresetToolPayload(value) {
	if (!isRecord(value)) return null;
	const { presets: rawPresets, writable } = value;
	if (!Array.isArray(rawPresets) || typeof writable !== "boolean") return null;
	const presets = [];
	for (const raw of rawPresets) {
		if (!isRecord(raw)) return null;
		const { id, name, description, broken, trust, skills: rawSkills, mcp: rawMcp, systemTools: rawSystem } = raw;
		if (typeof id !== "string" || typeof name !== "string") return null;
		if (trust !== void 0 && trust !== "system" && trust !== "user") return null;
		if (!Array.isArray(rawMcp) || !Array.isArray(rawSystem) || !Array.isArray(rawSkills)) return null;
		if (description !== void 0 && typeof description !== "string") return null;
		if (broken !== void 0 && typeof broken !== "string") return null;
		const systemTools = parseTools(rawSystem);
		if (systemTools === null) return null;
		const skills = parseSkills(rawSkills);
		if (skills === null) return null;
		const mcp = [];
		for (const rawServer of rawMcp) {
			if (!isRecord(rawServer)) return null;
			const { server, tools: rawTools, enabled, source, path, unavailable, reconnectable } = rawServer;
			if (typeof server !== "string" || typeof enabled !== "boolean" || !Array.isArray(rawTools)) return null;
			if (source !== void 0 && typeof source !== "string") return null;
			if (path !== void 0 && typeof path !== "string") return null;
			if (unavailable !== void 0 && typeof unavailable !== "boolean") return null;
			if (reconnectable !== void 0 && typeof reconnectable !== "boolean") return null;
			const tools = parseTools(rawTools);
			if (tools === null) return null;
			mcp.push({
				server,
				tools,
				enabled,
				...source === void 0 ? {} : { source },
				...path === void 0 ? {} : { path },
				...unavailable === void 0 ? {} : { unavailable },
				...reconnectable === void 0 ? {} : { reconnectable }
			});
		}
		presets.push({
			id,
			name,
			...description === void 0 ? {} : { description },
			...broken === void 0 ? {} : { broken },
			...trust === void 0 ? {} : { trust },
			skills,
			mcp,
			systemTools
		});
	}
	return {
		presets,
		writable
	};
}

//#endregion
//#region src/client/preset-store.ts
const INITIAL = {
	loading: false,
	payload: null,
	selectedId: null,
	error: null
};
const store = (0, __deepseek_ai_dsh_client_store.createSnapshotStore)(INITIAL);
let epoch = 0;
let queue = Promise.resolve();
let requests = 0;
const subscribePresetTools = (listener) => store.subscribe(listener);
const getPresetToolsSnapshot = () => store.getSnapshot();
async function requestPayload(init) {
	const response = await fetch("/api/capability-panel/presets", {
		credentials: "same-origin",
		...init
	});
	if (!response.ok) {
		let detail = "";
		try {
			const body = await response.json();
			if (typeof body.error === "string") detail = `: ${body.error}`;
		} catch {}
		throw new Error(`HTTP ${response.status}${detail}`);
	}
	const payload = parsePresetToolPayload(await response.json());
	if (payload === null) throw new Error("unexpected preset payload shape (host/client version skew?)");
	return payload;
}
function begin() {
	requests += 1;
	store.set({
		...store.getSnapshot(),
		loading: true,
		error: null
	});
	return epoch;
}
function finish(requestEpoch, patch) {
	if (requestEpoch !== epoch) return;
	requests -= 1;
	const current = store.getSnapshot();
	const nextPayload = patch.payload ?? current.payload;
	const selectedExists = nextPayload?.presets.some((preset) => preset.id === current.selectedId) === true;
	store.set({
		...current,
		...patch,
		selectedId: selectedExists ? current.selectedId : nextPayload?.presets[0]?.id ?? null,
		loading: requests > 0
	});
}
async function loadPresetTools() {
	const requestEpoch = begin();
	try {
		finish(requestEpoch, {
			payload: await requestPayload(),
			error: null
		});
	} catch (error) {
		finish(requestEpoch, { error: error instanceof Error ? error.message : String(error) });
	}
}
function selectPreset(id) {
	const current = store.getSnapshot();
	if (current.payload?.presets.some((preset) => preset.id === id) !== true) return;
	store.set({
		...current,
		selectedId: id
	});
}
/** Serialized write: every toggle is one POST whose response is the new truth. */
function mutate(body) {
	const requestEpoch = begin();
	const run = async () => {
		try {
			finish(requestEpoch, {
				payload: await requestPayload({
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(body)
				}),
				error: null
			});
		} catch (error) {
			finish(requestEpoch, { error: error instanceof Error ? error.message : String(error) });
		}
	};
	const result = queue.then(run);
	queue = result;
	return result;
}
function setPresetTool(presetId, name, enabled) {
	return mutate({
		presetId,
		kind: "tool",
		name,
		enabled
	});
}
/** Toggle one skill's default for a preset. */
function setPresetSkill(presetId, name, enabled) {
	return mutate({
		presetId,
		kind: "skill",
		name,
		enabled
	});
}
/** Toggle a whole MCP server in one write instead of one request per tool. */
function setPresetServer(presetId, server, enabled) {
	return mutate({
		presetId,
		kind: "mcp-server",
		name: server,
		enabled
	});
}
/**
* Pull a declared-but-offline server's connection up, then reload the preset
* list: registration lands asynchronously, so the payload refresh reflects
* whatever the registry knows when it answers.
*/
function reconnectPresetServer(server) {
	const requestEpoch = begin();
	const run = async () => {
		try {
			const response = await fetch("/api/capability-panel/reconnect", {
				method: "POST",
				credentials: "same-origin",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ server })
			});
			if (!response.ok) {
				let detail = "";
				try {
					const body = await response.json();
					if (typeof body.error === "string") detail = `: ${body.error}`;
				} catch {}
				throw new Error(`HTTP ${response.status}${detail}`);
			}
			finish(requestEpoch, {
				payload: await requestPayload(),
				error: null
			});
		} catch (error) {
			finish(requestEpoch, { error: error instanceof Error ? error.message : String(error) });
		}
	};
	const result = queue.then(run);
	queue = result;
	return result;
}
function resetPresetTools() {
	epoch += 1;
	requests = 0;
	queue = Promise.resolve();
	store.set(INITIAL);
}

//#endregion
//#region src/client/preset-section.ts
/** Middle ellipsis for long path labels; the full path stays in the tooltip. */
const ellipsizeMiddle = (text, max$1 = 56) => {
	if (text.length <= max$1) return text;
	const head = Math.ceil((max$1 - 1) / 2);
	const tail = Math.floor((max$1 - 1) / 2);
	return `${text.slice(0, head)}…${text.slice(text.length - tail)}`;
};
/** Group items by a key, preserving first-seen order. */
function groupBy(items, keyOf) {
	const groups = /* @__PURE__ */ new Map();
	const order = [];
	for (const item of items) {
		const key = keyOf(item);
		const bucket = groups.get(key);
		if (bucket !== void 0) bucket.push(item);
		else {
			groups.set(key, [item]);
			order.push(key);
		}
	}
	return order.map((key) => [key, groups.get(key)]);
}
/**
* Settings-side twin of the composer panel. It reuses that panel's vocabulary
* and interaction — an always-visible filter, MCP tools collapsed under their
* server, one switch per row — because at ~200 tools a flat list is not
* usable, and because two scopes of one feature should not feel like two
* unrelated features.
*/
function PresetToolSection(props) {
	const { t } = props;
	const state = react.useSyncExternalStore(subscribePresetTools, getPresetToolsSnapshot);
	react.useSyncExternalStore(props.subscribeLocale, props.getLocaleSnapshot);
	react.useEffect(() => {
		loadPresetTools();
	}, []);
	const [query, setQuery] = react.useState("");
	const [expanded, setExpanded] = react.useState({});
	const [partOpen, setPartOpen] = react.useState({});
	const [kind, setKind] = react.useState("all");
	const [pickerOpen, setPickerOpen] = react.useState(false);
	const [reconnecting, setReconnecting] = react.useState(null);
	const selected = state.payload?.presets.find((preset) => preset.id === state.selectedId);
	const filtering = query.trim() !== "";
	const view = selected === void 0 ? null : filterPreset(selected, query);
	const writable = state.payload?.writable === true;
	const locked = state.loading || !writable;
	/** One switch, shared by tool rows, server rows and skill rows. */
	const switchFor = (on, frozen, label, onChange) => capabilitySwitch({
		checked: on,
		disabled: locked || frozen,
		busy: state.loading,
		label,
		onCheckedChange: onChange
	});
	/**
	* Open a source folder from the settings page. The route resolves
	* user/project/host/preset sources without a session (project sources
	* against the dsh process's own cwd, matching how this page lists them).
	*/
	const openSourceFolder = (source) => {
		fetch("/api/capability-panel/open-folder", {
			method: "POST",
			credentials: "same-origin",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ source })
		}).then((response) => {
			if (!response.ok) console.warn(`[capability-panel] cannot open source folder (${response.status})`);
		}).catch((error) => {
			console.warn("[capability-panel] open source folder request failed", error);
		});
	};
	/** Sources the open-folder route can resolve without a session. */
	const SESSIONLESS_OPENABLE = new Set([
		"user-dsh",
		"user-agents",
		"project-dsh",
		"project-agents",
		"host"
	]);
	/**
	* A ruled source divider inside a settings list — the same visual language
	* as the session panel's group headers (`── label (count) ────`). Preset
	* groups name their preset; other groups show the directory (ellipsized);
	* openable groups offer the hover folder icon and a click-through.
	*/
	const sourceDivider = (groupKey, items, first) => {
		const presetName = groupKey.startsWith("preset:") ? groupKey.slice(7) : void 0;
		const path = items.find((item) => item.path !== void 0)?.path;
		const translated = t(`source.${groupKey}`);
		const fallbackLabel = translated === `source.${groupKey}` ? groupKey : translated;
		const label = presetName ?? (path !== void 0 ? ellipsizeMiddle(path) : groupKey === "host" ? t("source.host") : fallbackLabel);
		const openSource = presetName ?? groupKey;
		const openable = presetName !== void 0 || SESSIONLESS_OPENABLE.has(groupKey);
		const rule = (grow) => react.createElement("span", { style: grow ? {
			flex: "1",
			height: "1px",
			background: TOK.borderStrong
		} : {
			flex: "none",
			width: "16px",
			height: "1px",
			background: TOK.borderStrong
		} });
		return react.createElement("li", {
			key: `source:${groupKey}`,
			className: "ci-source-divider"
		}, react.createElement("div", {
			className: "ci-source-header",
			style: {
				display: "flex",
				alignItems: "center",
				gap: "8px",
				margin: first ? "6px 0 2px" : "18px 0 2px"
			}
		}, rule(false), react.createElement("span", {
			style: {
				flex: "none",
				display: "inline-flex",
				alignItems: "center",
				gap: "4px",
				fontSize: "12px",
				fontWeight: 500,
				color: TOK.textTertiary,
				fontVariantNumeric: "tabular-nums",
				cursor: openable ? "pointer" : "default"
			},
			title: openable ? t("source.openFolder", { source: path ?? label }) : void 0,
			onClick: openable ? () => {
				openSourceFolder(openSource);
			} : void 0
		}, openable ? react.createElement("span", {
			className: "ci-folder-icon",
			style: {
				display: "inline-grid",
				placeItems: "center",
				opacity: 0,
				transition: "opacity 0.15s"
			}
		}, react.createElement(IconFolderClose, { size: 14 })) : null, `${label} (${items.length})`), rule(true)));
	};
	const toggle$1 = (tool, presetId) => switchFor(tool.enabled, tool.reserved === true, tool.reserved === true ? t("preset.reserved", { name: tool.label }) : t(tool.enabled ? "action.disable" : "action.enable", { name: tool.label }), (checked) => {
		setPresetTool(presetId, tool.name, checked);
	});
	/** Expand/collapse label, worded like the composer panel's. */
	const detailAria = (subject, rowKey) => {
		const state$1 = resolveDisclosure(expanded[rowKey] === true, filtering);
		const detail = t("detail.description");
		if (state$1.disabled) return t("disclosure.pinned", {
			subject,
			detail
		});
		return t(state$1.open ? "disclosure.collapse" : "disclosure.expand", {
			subject,
			detail
		});
	};
	const skillRow = (skill, presetId) => {
		const rowKey = `skill:${skill.name}`;
		return react.createElement("li", {
			key: rowKey,
			className: "ci-preset-item"
		}, disclosureRow({
			rowKey,
			expanded: expanded[rowKey] === true,
			filtering,
			onOpenChange: (open) => {
				setExpanded((prev) => ({
					...prev,
					[rowKey]: open
				}));
			},
			triggerLabel: detailAria(skill.name, rowKey),
			className: "ci-preset-disclosure",
			headerClassName: "ci-row-head ci-preset-tool-row",
			spacerClassName: "ci-preset-spacer",
			icon: skillRowIcon(),
			heading: react.createElement("span", { className: "ci-preset-tool-name" }, skill.name, skill.project === true ? react.createElement("span", { className: "ci-preset-badge" }, t("preset.projectSkill")) : null),
			actions: [switchFor(skill.enabled, false, t(skill.enabled ? "action.disable" : "action.enable", { name: skill.name }), (checked) => {
				setPresetSkill(presetId, skill.name, checked);
			})],
			...skill.description === void 0 ? {} : { detail: react.createElement("div", { className: "ci-preset-detail" }, skill.description) }
		}));
	};
	const toolRow = (tool, presetId, nested) => {
		const rowKey = `tool:${tool.name}`;
		return react.createElement("li", {
			key: tool.name,
			className: nested ? "ci-toolrow ci-preset-item" : "ci-preset-item"
		}, disclosureRow({
			rowKey,
			expanded: expanded[rowKey] === true,
			filtering,
			onOpenChange: (open) => {
				setExpanded((prev) => ({
					...prev,
					[rowKey]: open
				}));
			},
			triggerLabel: detailAria(tool.label, rowKey),
			className: "ci-preset-disclosure",
			headerClassName: "ci-row-head ci-preset-tool-row",
			spacerClassName: "ci-preset-spacer",
			icon: toolRowIcon(),
			heading: react.createElement("span", { className: "ci-preset-tool-name" }, tool.label),
			actions: [toggle$1(tool, presetId)],
			...tool.description === void 0 ? {} : { detail: react.createElement("div", { className: "ci-preset-detail" }, tool.description) }
		}));
	};
	const body = () => {
		if (selected === void 0 || view === null) return react.createElement("p", null, t("preset.empty"));
		if (selected.broken !== void 0) return react.createElement("p", {
			role: "alert",
			className: "ci-settings-note",
			style: { color: TOK.error }
		}, t("preset.broken", { reason: selected.broken }));
		if (view.total === 0) return react.createElement("p", null, filtering ? t("empty.match") : t("preset.noTools"));
		const totals = {
			skills: selected.skills.length,
			mcp: selected.mcp.length,
			systemTools: selected.systemTools.length
		};
		const groups = [];
		const group = (key, title, rows, total, shown) => {
			if (kind !== "all" && kind !== key) return;
			if (rows.length === 0) return;
			const open = filtering || (partOpen[key] ?? true);
			groups.push(react.createElement(CollapsibleRoot, {
				key,
				className: "ci-preset-part",
				open,
				onOpenChange: (next) => {
					setPartOpen((prev) => ({
						...prev,
						[key]: next
					}));
				}
			}, react.createElement(CollapsibleTrigger, { className: "ci-preset-part-trigger" }, react.createElement(IconTriangleRight, { size: 14 }), react.createElement("h3", { className: "ci-preset-part-title" }, title)), react.createElement("p", { className: "ci-preset-part-sub" }, t("group.count", {
				shown,
				total
			})), react.createElement(CollapsiblePanel, { className: "ci-collapse" }, react.createElement("ul", { className: "ci-preset-tool-list" }, ...rows))));
		};
		group("skills", t("tab.skills"), groupBy(view.skills, (skill) => skill.group ?? skill.source ?? "unknown").flatMap(([groupKey, items], i) => [sourceDivider(groupKey, items, i === 0), ...items.map((skill) => skillRow(skill, selected.id))]), totals.skills, view.skills.length);
		const serverRow = (server) => {
			const key = `mcp:${server.server}`;
			const disclosure = resolveDisclosure(expanded[key] === true, filtering);
			return react.createElement("li", {
				key,
				className: "ci-preset-group"
			}, react.createElement(CollapsibleRoot, {
				open: disclosure.open,
				onOpenChange: (open) => {
					setExpanded((prev) => ({
						...prev,
						[key]: open
					}));
				}
			}, react.createElement("div", { className: "ci-row-head ci-preset-tool-row" }, react.createElement(CollapsibleTrigger, {
				className: "ci-disclosure-trigger ci-preset-server-trigger",
				disabled: disclosure.disabled
			}, leadingFor(serverRowIcon(), disclosure.open), react.createElement("span", { className: "ci-preset-tool-copy" }, react.createElement("span", { className: "ci-preset-tool-name" }, server.server), server.unavailable === true ? null : react.createElement("span", { className: "ci-preset-tool-description" }, server.tools.length === 1 ? t("server.tool.one") : t("server.tools", { count: server.tools.length })))), server.unavailable === true ? react.createElement("span", {
				className: "ci-preset-badge",
				title: t("server.unavailableHint")
			}, t("server.unavailable")) : switchFor(server.enabled, false, t(server.enabled ? "action.disable" : "action.enable", { name: server.server }), (checked) => {
				setPresetServer(selected.id, server.server, checked);
			}), server.unavailable === true && server.reconnectable === true ? react.createElement("button", {
				type: "button",
				className: `ci-reconnect${reconnecting === server.server ? " ci-reconnect-busy" : ""}`,
				disabled: reconnecting !== null,
				title: reconnecting === server.server ? t("action.reload.ing", { name: server.server }) : `${t("action.reload", { name: server.server })}\n${t("action.reloadHint")}`,
				"aria-label": t("action.reload", { name: server.server }),
				onClick: () => {
					if (reconnecting !== null) return;
					setReconnecting(server.server);
					reconnectPresetServer(server.server).finally(() => {
						setTimeout(() => {
							setReconnecting(null);
						}, 2500);
					});
				}
			}, react.createElement("span", {
				className: "ci-reconnect-glyph",
				"aria-hidden": true
			}, react.createElement(IconRefresh, { size: 14 })), t("action.reload.label")) : null), react.createElement(CollapsiblePanel, { className: "ci-collapse" }, react.createElement("ul", { className: "ci-preset-tool-list" }, ...server.tools.map((tool) => toolRow(tool, selected.id, true))))));
		};
		group("mcp", t("tab.mcp"), groupBy(view.mcp, (server) => server.source === void 0 || server.source === "host" ? "host" : `preset:${server.source}`).flatMap(([groupKey, items], i) => [sourceDivider(groupKey, items, i === 0), ...items.map((server) => serverRow(server))]), totals.mcp, view.mcp.length);
		group("system", t("group.systemTools"), view.systemTools.map((tool) => toolRow(tool, selected.id, false)), totals.systemTools, view.systemTools.length);
		if (groups.length === 0) return react.createElement("p", null, filtering ? t("empty.match") : t("preset.noTools"));
		return react.createElement(react.Fragment, null, ...groups);
	};
	return react.createElement("div", { className: "ci-preset-section" }, react.createElement("h2", { className: "ci-settings-title" }, t("preset.title")), react.createElement("p", { className: "ci-settings-intro" }, t("preset.intro")), state.error === null ? null : react.createElement("p", {
		role: "alert",
		style: { color: TOK.error }
	}, t("status.error", { error: state.error })), state.loading && state.payload === null ? react.createElement("p", {
		"aria-live": "polite",
		style: { color: TOK.textTertiary }
	}, t("status.loading")) : null, state.payload === null ? null : react.createElement(react.Fragment, null, writable ? null : react.createElement("p", {
		role: "note",
		className: "ci-settings-note"
	}, t("preset.readonly")), react.createElement("div", { className: "ci-preset-toolbar" }, react.createElement("div", { className: "ci-search" }, react.createElement(IconSearch, { size: 14 }), react.createElement(Input, {
		className: "ci-filter ci-preset-filter",
		value: query,
		placeholder: t("filter.placeholder"),
		"aria-label": t("filter.aria"),
		autoComplete: "off",
		spellCheck: false,
		name: "ci-preset-filter",
		onChange: (event) => {
			setQuery(event.target.value);
		},
		onKeyDown: (event) => {
			if (event.key === "Escape" && filtering) setQuery("");
		}
	})), react.createElement(__deepseek_ai_dsh_client_ui_primitives.Menu, {
		open: pickerOpen,
		anchor: react.createElement("button", {
			type: "button",
			className: "ci-preset-picker-trigger",
			"aria-haspopup": "menu",
			"aria-expanded": pickerOpen,
			"aria-label": t("preset.choose"),
			onClick: () => {
				setPickerOpen((open) => !open);
			}
		}, react.createElement("span", { className: "ci-preset-picker-name" }, selected?.name ?? ""), react.createElement("span", {
			className: `ci-preset-picker-chevron${pickerOpen ? " ci-preset-picker-chevron-open" : ""}`,
			"aria-hidden": true
		}, react.createElement(IconChevronDown, { size: 14 }))),
		items: state.payload.presets.map((preset) => ({
			id: preset.id,
			label: preset.name
		})),
		...state.selectedId === null ? {} : { selectedId: state.selectedId },
		onSelect: (id) => {
			selectPreset(id);
			setPickerOpen(false);
		},
		onClose: () => {
			setPickerOpen(false);
		}
	})), selected === void 0 ? null : (() => {
		const Segmented = __deepseek_ai_dsh_client_ui_primitives.SegmentedControl;
		if (Segmented !== void 0) return react.createElement(Segmented, {
			id: "ci-preset-kinds",
			label: t("preset.kindAria"),
			value: kind,
			options: [
				{
					value: "all",
					label: t("tab.all")
				},
				{
					value: "skills",
					label: `${t("tab.skills")} ${selected.skills.length}`
				},
				{
					value: "mcp",
					label: `${t("tab.mcp")} ${selected.mcp.length}`
				},
				{
					value: "system",
					label: `${t("tab.system")} ${selected.systemTools.length}`
				}
			],
			onChange: (next) => {
				setKind(next);
			}
		});
		return react.createElement(TabsRoot, {
			value: kind,
			onValueChange: (value) => {
				setKind(value);
			},
			className: "ci-preset-kinds"
		}, react.createElement(TabsList, {
			"aria-label": t("preset.kindAria"),
			className: "ci-tabs"
		}, react.createElement(TabsTab, {
			value: "all",
			className: "ci-tab"
		}, t("tab.all")), react.createElement(TabsTab, {
			value: "skills",
			className: "ci-tab"
		}, `${t("tab.skills")} ${selected.skills.length}`), react.createElement(TabsTab, {
			value: "mcp",
			className: "ci-tab"
		}, `${t("tab.mcp")} ${selected.mcp.length}`), react.createElement(TabsTab, {
			value: "system",
			className: "ci-tab",
			"aria-label": t("tab.system.aria", { count: selected.systemTools.length })
		}, `${t("tab.system")} ${selected.systemTools.length}`)));
	})(), selected?.description === void 0 ? null : react.createElement("p", { className: "ci-settings-description" }, selected.description), view === null || !filtering ? null : react.createElement("p", {
		"aria-live": "polite",
		className: "ci-settings-description"
	}, t("filter.count", {
		shown: view.total,
		total: selected === void 0 ? 0 : selected.skills.length + selected.mcp.length + selected.systemTools.length
	})), body()));
}

//#endregion
//#region src/client/preview.ts
/**
* Read the Host's sidebar navigation, or `undefined` when this deployment has
* none. The returned closure keeps the service as its receiver: it is a live
* object whose methods arrive through a guarding proxy, so detaching one and
* calling it bare would drop `this`.
* @param ctx - the plugin context; only its optional-lookup channel is used.
* @returns an opener for a `dsh-resource://file/…` address, or `undefined`.
*/
function resolvePreviewOpener(ctx) {
	const service = ctx.get("sidebarRight");
	if (service === null || typeof service !== "object" && typeof service !== "function") return void 0;
	const open = service.openResource;
	if (typeof open !== "function") return void 0;
	return (address) => {
		open.call(service, address);
	};
}
/**
* Open a resource address in the Host's right sidebar, looking the service up
* at the moment of the click rather than once when the panel activates.
*
* Cordis starts the sidebar's own fiber when IT is ready, which is not
* necessarily before this panel's: resolving once at activation would read
* `undefined` whenever the panel won that race and then never retry, silently
* removing an action the row should have had — a failure with no error to see.
* The Host's own skill package avoids the race by declaring `sidebarRight` as a
* required inject, which cordis holds the fiber for; this panel cannot afford
* that, since an absent sidebar would take the skills/MCP/tools panel with it.
*/
function openPreviewResource(ctx, address) {
	resolvePreviewOpener(ctx)?.(address);
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/floating-ui-react/hooks/useHoverShared.mjs
function resolveValue(value, pointerType) {
	if (pointerType != null && !isMouseLikePointerType(pointerType)) return 0;
	if (typeof value === "function") return value();
	return value;
}
function getDelay(value, prop, pointerType) {
	const result = resolveValue(value, pointerType);
	if (typeof result === "number") return result;
	return result?.[prop];
}
function getRestMs(value) {
	if (typeof value === "function") return value();
	return value;
}
function isClickLikeOpenEvent(openEventType, interactedInside) {
	return interactedInside || openEventType === "click" || openEventType === "mousedown";
}
function isHoverOpenEvent(openEventType) {
	return openEventType?.includes("mouse") && openEventType !== "mousedown";
}

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/mergeCleanups.mjs
/**
* Combines multiple cleanup functions into a single cleanup function.
*/
function mergeCleanups(...cleanups) {
	return () => {
		for (let i = 0; i < cleanups.length; i += 1) {
			const cleanup = cleanups[i];
			if (cleanup) cleanup();
		}
	};
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/utils/FocusGuard.mjs
const FocusGuard = /* @__PURE__ */ react.forwardRef(function FocusGuard$1(props, ref) {
	const [role, setRole] = react.useState();
	useIsoLayoutEffect(() => {
		if (voiceOver && webkit) setRole("button");
	}, []);
	const restProps = {
		tabIndex: 0,
		role
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
		...props,
		ref,
		style: visuallyHidden,
		"aria-hidden": role ? void 0 : true,
		...restProps,
		"data-base-ui-focus-guard": ""
	});
});

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/floating-ui-react/utils/createAttribute.mjs
function createAttribute(name) {
	return `data-base-ui-${name}`;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/floating-ui-react/utils/enqueueFocus.mjs
let rafId = 0;
function enqueueFocus(el, options = {}) {
	const { preventScroll = false, sync = false, shouldFocus } = options;
	cancelAnimationFrame(rafId);
	function exec() {
		if (shouldFocus && !shouldFocus()) return;
		el?.focus({ preventScroll });
	}
	if (sync) {
		exec();
		return NOOP;
	}
	const currentRafId = requestAnimationFrame(exec);
	rafId = currentRafId;
	return () => {
		if (rafId === currentRafId) {
			cancelAnimationFrame(currentRafId);
			rafId = 0;
		}
	};
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/floating-ui-react/utils/markOthers.mjs
const counters = {
	inert: /* @__PURE__ */ new WeakMap(),
	"aria-hidden": /* @__PURE__ */ new WeakMap()
};
const markerName = "data-base-ui-inert";
const uncontrolledElementsSets = {
	inert: /* @__PURE__ */ new WeakSet(),
	"aria-hidden": /* @__PURE__ */ new WeakSet()
};
let markerCounterMap = /* @__PURE__ */ new WeakMap();
let lockCount = 0;
function getUncontrolledElementsSet(controlAttribute) {
	return uncontrolledElementsSets[controlAttribute];
}
function unwrapHost(node) {
	if (!node) return null;
	return isShadowRoot(node) ? node.host : unwrapHost(node.parentNode);
}
const correctElements = (parent, targets) => targets.map((target) => {
	if (parent.contains(target)) return target;
	const correctedTarget = unwrapHost(target);
	if (parent.contains(correctedTarget)) return correctedTarget;
	return null;
}).filter((x) => x != null);
const buildKeepSet = (targets) => {
	const keep = /* @__PURE__ */ new Set();
	targets.forEach((target) => {
		let node = target;
		while (node && !keep.has(node)) {
			keep.add(node);
			node = node.parentNode;
		}
	});
	return keep;
};
const collectOutsideElements = (root, keepElements, stopElements) => {
	const outside = [];
	const walk = (parent) => {
		if (!parent || stopElements.has(parent)) return;
		Array.from(parent.children).forEach((node) => {
			if (getNodeName(node) === "script") return;
			if (keepElements.has(node)) walk(node);
			else outside.push(node);
		});
	};
	walk(root);
	return outside;
};
function applyAttributeToOthers(uncorrectedAvoidElements, body, ariaHidden, inert, { mark = true }) {
	let controlAttribute = null;
	if (inert) controlAttribute = "inert";
	else if (ariaHidden) controlAttribute = "aria-hidden";
	let counterMap = null;
	let uncontrolledElementsSet = null;
	const avoidElements = correctElements(body, uncorrectedAvoidElements);
	const markerTargets = mark ? collectOutsideElements(body, buildKeepSet(avoidElements), new Set(avoidElements)) : [];
	const hiddenElements = [];
	const markedElements = [];
	if (controlAttribute) {
		const map = counters[controlAttribute];
		const currentUncontrolledElementsSet = getUncontrolledElementsSet(controlAttribute);
		uncontrolledElementsSet = currentUncontrolledElementsSet;
		counterMap = map;
		const ariaLiveElements = correctElements(body, Array.from(body.querySelectorAll("[aria-live]")));
		const controlElements = avoidElements.concat(ariaLiveElements);
		collectOutsideElements(body, buildKeepSet(controlElements), new Set(controlElements)).forEach((node) => {
			const attr$1 = node.getAttribute(controlAttribute);
			const alreadyHidden = attr$1 !== null && attr$1 !== "false";
			const counterValue = (map.get(node) || 0) + 1;
			map.set(node, counterValue);
			hiddenElements.push(node);
			if (counterValue === 1 && alreadyHidden) currentUncontrolledElementsSet.add(node);
			if (!alreadyHidden) node.setAttribute(controlAttribute, controlAttribute === "inert" ? "" : "true");
		});
	}
	if (mark) markerTargets.forEach((node) => {
		const markerValue = (markerCounterMap.get(node) || 0) + 1;
		markerCounterMap.set(node, markerValue);
		markedElements.push(node);
		if (markerValue === 1) node.setAttribute(markerName, "");
	});
	lockCount += 1;
	return () => {
		if (counterMap) hiddenElements.forEach((element) => {
			const counterValue = (counterMap.get(element) || 0) - 1;
			counterMap.set(element, counterValue);
			if (!counterValue) {
				if (!uncontrolledElementsSet?.has(element) && controlAttribute) element.removeAttribute(controlAttribute);
				uncontrolledElementsSet?.delete(element);
			}
		});
		if (mark) markedElements.forEach((element) => {
			const markerValue = (markerCounterMap.get(element) || 0) - 1;
			markerCounterMap.set(element, markerValue);
			if (!markerValue) element.removeAttribute(markerName);
		});
		lockCount -= 1;
		if (!lockCount) {
			counters.inert = /* @__PURE__ */ new WeakMap();
			counters["aria-hidden"] = /* @__PURE__ */ new WeakMap();
			uncontrolledElementsSets.inert = /* @__PURE__ */ new WeakSet();
			uncontrolledElementsSets["aria-hidden"] = /* @__PURE__ */ new WeakSet();
			markerCounterMap = /* @__PURE__ */ new WeakMap();
		}
	};
}
function markOthers(avoidElements, options = {}) {
	const { ariaHidden = false, inert = false, mark = true } = options;
	const body = ownerDocument(avoidElements[0]).body;
	return applyAttributeToOthers(avoidElements, body, ariaHidden, inert, { mark });
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/constants.mjs
const PATIENT_CLICK_THRESHOLD = 500;
const DISABLED_TRANSITIONS_STYLE = { style: { transition: "none" } };
const CLICK_TRIGGER_IDENTIFIER = "data-base-ui-click-trigger";
const BASE_UI_SWIPE_IGNORE_ATTRIBUTE = "data-base-ui-swipe-ignore";
const LEGACY_SWIPE_IGNORE_ATTRIBUTE = "data-swipe-ignore";
const BASE_UI_SWIPE_IGNORE_SELECTOR = `[${BASE_UI_SWIPE_IGNORE_ATTRIBUTE}]`;
const LEGACY_SWIPE_IGNORE_SELECTOR = `[${LEGACY_SWIPE_IGNORE_ATTRIBUTE}]`;
/**
* Used by regular popups that usually aren't scrollable and are allowed to
* freely flip to any axis of placement.
*/
const POPUP_COLLISION_AVOIDANCE = { fallbackAxisSide: "end" };
/**
* Special visually hidden styles for the aria-owns owner element to ensure owned element
* accessibility in iOS/Safari/VoiceControl.
* The owner element is an empty span, so most of the common visually hidden styles are not needed.
* @see https://github.com/floating-ui/floating-ui/issues/3403
*/
const ownerVisuallyHidden = {
	clipPath: "inset(50%)",
	position: "fixed",
	top: 0,
	left: 0
};

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/floating-ui-react/components/FloatingPortal.mjs
const PortalContext = /* @__PURE__ */ react.createContext(null);
const usePortalContext = () => react.useContext(PortalContext);
const attr = createAttribute("portal");
function useFloatingPortalNode(props = {}) {
	const { ref, container: containerProp, componentProps = EMPTY_OBJECT, elementProps } = props;
	const uniqueId = useId();
	const parentPortalNode = usePortalContext()?.portalNode;
	const [containerElement, setContainerElement] = react.useState(null);
	const [portalNode, setPortalNode] = react.useState(null);
	const setPortalNodeRef = useStableCallback((node) => {
		if (node !== null) setPortalNode(node);
	});
	const containerRef = react.useRef(null);
	useIsoLayoutEffect(() => {
		if (containerProp === null) {
			if (containerRef.current) {
				containerRef.current = null;
				setPortalNode(null);
				setContainerElement(null);
			}
			return;
		}
		const resolvedContainer = (containerProp && (isNode(containerProp) ? containerProp : containerProp.current)) ?? parentPortalNode ?? document.body;
		if (resolvedContainer == null) {
			if (containerRef.current) {
				containerRef.current = null;
				setPortalNode(null);
				setContainerElement(null);
			}
			return;
		}
		if (containerRef.current !== resolvedContainer) {
			containerRef.current = resolvedContainer;
			setPortalNode(null);
			setContainerElement(resolvedContainer);
		}
	}, [containerProp, parentPortalNode]);
	const portalElement = useRenderElement("div", componentProps, {
		ref: [ref, setPortalNodeRef],
		props: [{
			id: uniqueId,
			[attr]: ""
		}, elementProps]
	});
	const portalSubtree = containerElement && portalElement ? /* @__PURE__ */ react_dom.createPortal(portalElement, containerElement) : null;
	return {
		node: portalNode,
		nodeId: /* @__PURE__ */ react.isValidElement(portalElement) ? portalElement.props.id : void 0,
		subtree: portalSubtree
	};
}
/**
* Portals the floating element into a given container element — by default,
* outside of the app root and into the body.
* This is necessary to ensure the floating element can appear outside any
* potential parent containers that cause clipping (such as `overflow: hidden`),
* while retaining its location in the React tree.
* @see https://floating-ui.com/docs/FloatingPortal
* @internal
*/
const FloatingPortal = /* @__PURE__ */ react.forwardRef(function FloatingPortal$1(componentProps, forwardedRef) {
	const { render, className, style, children, container,...elementProps } = componentProps;
	const { node: portalNode, nodeId: portalNodeId, subtree: portalSubtree } = useFloatingPortalNode({
		container,
		ref: forwardedRef,
		componentProps,
		elementProps
	});
	const beforeOutsideRef = react.useRef(null);
	const afterOutsideRef = react.useRef(null);
	const beforeInsideRef = react.useRef(null);
	const afterInsideRef = react.useRef(null);
	const [focusManagerState, setFocusManagerState] = react.useState(null);
	const focusInsideDisabledRef = react.useRef(false);
	const modal = focusManagerState?.modal;
	const open = focusManagerState?.open;
	const shouldRenderGuards = !!focusManagerState && !focusManagerState.modal && focusManagerState.open && !!portalNode;
	react.useEffect(() => {
		if (!portalNode || modal) return;
		function onFocus(event) {
			if (portalNode && event.relatedTarget && isOutsideEvent(event)) if (event.type === "focusin") {
				if (focusInsideDisabledRef.current) {
					enableFocusInside(portalNode);
					focusInsideDisabledRef.current = false;
				}
			} else {
				disableFocusInside(portalNode);
				focusInsideDisabledRef.current = true;
			}
		}
		return mergeCleanups(addEventListener(portalNode, "focusin", onFocus, true), addEventListener(portalNode, "focusout", onFocus, true));
	}, [portalNode, modal]);
	useIsoLayoutEffect(() => {
		if (!portalNode || open !== true || !focusInsideDisabledRef.current) return;
		enableFocusInside(portalNode);
		focusInsideDisabledRef.current = false;
	}, [open, portalNode]);
	const portalContextValue = react.useMemo(() => ({
		beforeOutsideRef,
		afterOutsideRef,
		beforeInsideRef,
		afterInsideRef,
		portalNode,
		setFocusManagerState
	}), [portalNode]);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react.Fragment, { children: [portalSubtree, /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(PortalContext.Provider, {
		value: portalContextValue,
		children: [
			shouldRenderGuards && portalNode && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FocusGuard, {
				"data-type": "outside",
				ref: beforeOutsideRef,
				onFocus: (event) => {
					if (isOutsideEvent(event, portalNode)) beforeInsideRef.current?.focus();
					else getPreviousTabbable(focusManagerState ? focusManagerState.domReference : null)?.focus();
				}
			}),
			shouldRenderGuards && portalNode && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				"aria-owns": portalNodeId,
				style: ownerVisuallyHidden
			}),
			portalNode && /* @__PURE__ */ react_dom.createPortal(children, portalNode),
			shouldRenderGuards && portalNode && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FocusGuard, {
				"data-type": "outside",
				ref: afterOutsideRef,
				onFocus: (event) => {
					if (isOutsideEvent(event, portalNode)) afterInsideRef.current?.focus();
					else {
						getNextTabbable(focusManagerState ? focusManagerState.domReference : null)?.focus();
						if (focusManagerState?.closeOnFocusOut) focusManagerState?.onOpenChange(false, createChangeEventDetails(focusOut, event.nativeEvent));
					}
				}
			})
		]
	})] });
});

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/floating-ui-react/utils/createEventEmitter.mjs
function createEventEmitter() {
	const map = /* @__PURE__ */ new Map();
	return {
		emit(event, data) {
			map.get(event)?.forEach((listener) => listener(data));
		},
		on(event, listener) {
			if (!map.has(event)) map.set(event, /* @__PURE__ */ new Set());
			map.get(event).add(listener);
		},
		off(event, listener) {
			map.get(event)?.delete(listener);
		}
	};
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/floating-ui-react/components/FloatingTreeStore.mjs
/**
* Stores and manages floating elements in a tree structure.
* This is a backing store for the `FloatingTree` component.
*/
var FloatingTreeStore = class {
	nodesRef = { current: [] };
	events = createEventEmitter();
	addNode(node) {
		this.nodesRef.current.push(node);
	}
	removeNode(node) {
		const index$1 = this.nodesRef.current.findIndex((n) => n === node);
		if (index$1 !== -1) this.nodesRef.current.splice(index$1, 1);
	}
};

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/floating-ui-react/components/FloatingTree.mjs
const FloatingNodeContext = /* @__PURE__ */ react.createContext(null);
const FloatingTreeContext = /* @__PURE__ */ react.createContext(null);
const useFloatingParentNodeId = () => react.useContext(FloatingNodeContext)?.id || null;
/**
* Returns the nearest floating tree context, if available.
*/
const useFloatingTree = (externalTree) => {
	const contextTree = react.useContext(FloatingTreeContext);
	return externalTree ?? contextTree;
};
/**
* Registers a node into the `FloatingTree`, returning its id.
* @see https://floating-ui.com/docs/FloatingTree
*/
function useFloatingNodeId(externalTree) {
	const id = useId();
	const tree = useFloatingTree(externalTree);
	const parentId = useFloatingParentNodeId();
	useIsoLayoutEffect(() => {
		if (!id) return;
		const node = {
			id,
			parentId
		};
		tree?.addNode(node);
		return () => {
			tree?.removeNode(node);
		};
	}, [
		tree,
		id,
		parentId
	]);
	return id;
}
/**
* Provides parent node context for nested floating elements.
* @see https://floating-ui.com/docs/FloatingTree
* @internal
*/
function FloatingNode(props) {
	const { children, id } = props;
	const parentId = useFloatingParentNodeId();
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FloatingNodeContext.Provider, {
		value: react.useMemo(() => ({
			id,
			parentId
		}), [id, parentId]),
		children
	});
}
/**
* Provides context for nested floating elements when they are not children of
* each other on the DOM.
* This is not necessary in all cases, except when there must be explicit communication between parent and child floating elements. It is necessary for:
* - The `bubbles` option in the `useDismiss()` Hook
* - Nested virtual list navigation
* - Nested floating elements that each open on hover
* - Custom communication between parent and child floating elements
* @see https://floating-ui.com/docs/FloatingTree
* @internal
*/
function FloatingTree(props) {
	const { children, externalTree } = props;
	const tree = useRefWithInit(() => externalTree ?? new FloatingTreeStore()).current;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FloatingTreeContext.Provider, {
		value: tree,
		children
	});
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/floating-ui-react/components/FloatingFocusManager.mjs
function getEventType(event, lastInteractionType) {
	const win = getWindow(getTarget(event));
	if (event instanceof win.KeyboardEvent) return "keyboard";
	if (event instanceof win.FocusEvent) return lastInteractionType || "keyboard";
	if ("pointerType" in event) return event.pointerType || "keyboard";
	if ("touches" in event) return "touch";
	if (event instanceof win.MouseEvent) return lastInteractionType || (event.detail === 0 ? "keyboard" : "mouse");
	return "";
}
const LIST_LIMIT = 20;
let previouslyFocusedElements = [];
function clearDisconnectedPreviouslyFocusedElements() {
	previouslyFocusedElements = previouslyFocusedElements.filter((entry) => {
		return entry.deref()?.isConnected;
	});
}
function addPreviouslyFocusedElement(element) {
	clearDisconnectedPreviouslyFocusedElements();
	if (element && getNodeName(element) !== "body") {
		previouslyFocusedElements.push(new WeakRef(element));
		if (previouslyFocusedElements.length > LIST_LIMIT) previouslyFocusedElements = previouslyFocusedElements.slice(-LIST_LIMIT);
	}
}
function getPreviouslyFocusedElement() {
	clearDisconnectedPreviouslyFocusedElements();
	return previouslyFocusedElements[previouslyFocusedElements.length - 1]?.deref();
}
function getFirstTabbableElement(container) {
	if (!container) return null;
	if (isTabbable(container)) return container;
	return tabbable(container)[0] || container;
}
function handleTabIndex(floatingFocusElement) {
	if (floatingFocusElement.hasAttribute("tabindex") && !floatingFocusElement.hasAttribute("data-tabindex")) return;
	if (!floatingFocusElement.getAttribute("role")?.includes("dialog")) return;
	const tabbableContent = focusable(floatingFocusElement).filter((element) => {
		const dataTabIndex = element.getAttribute("data-tabindex") || "";
		return isTabbable(element) || element.hasAttribute("data-tabindex") && !dataTabIndex.startsWith("-");
	});
	const tabIndex = floatingFocusElement.getAttribute("tabindex");
	if (tabbableContent.length === 0) {
		if (tabIndex !== "0") {
			floatingFocusElement.setAttribute("tabindex", "0");
			floatingFocusElement.setAttribute("data-tabindex", "0");
		}
	} else if (tabIndex !== "-1" || floatingFocusElement.hasAttribute("data-tabindex") && floatingFocusElement.getAttribute("data-tabindex") !== "-1") {
		floatingFocusElement.setAttribute("tabindex", "-1");
		floatingFocusElement.setAttribute("data-tabindex", "-1");
	}
}
/**
* Provides focus management for the floating element.
* @see https://floating-ui.com/docs/FloatingFocusManager
* @internal
*/
function FloatingFocusManager(props) {
	const { context, children, disabled: disabled$1 = false, initialFocus = true, returnFocus = true, restoreFocus = false, modal = true, closeOnFocusOut = true, openInteractionType = "", nextFocusableElement, previousFocusableElement, beforeContentFocusGuardRef, externalTree, getInsideElements } = props;
	const store$2 = "rootStore" in context ? context.rootStore : context;
	const open = store$2.useState("open");
	const domReference = store$2.useState("domReferenceElement");
	const floating = store$2.useState("floatingElement");
	const { events, dataRef } = store$2.context;
	const getNodeId = useStableCallback(() => dataRef.current.floatingContext?.nodeId);
	const ignoreInitialFocus = initialFocus === false;
	const isUntrappedTypeableCombobox = isTypeableCombobox(domReference) && ignoreInitialFocus;
	const initialFocusRef = useValueAsRef(initialFocus);
	const returnFocusRef = useValueAsRef(returnFocus);
	const openInteractionTypeRef = useValueAsRef(openInteractionType);
	const openRef = useValueAsRef(open);
	const tree = useFloatingTree(externalTree);
	const portalContext = usePortalContext();
	const preventReturnFocusRef = react.useRef(false);
	const isPointerDownRef = react.useRef(false);
	const pointerDownOutsideRef = react.useRef(false);
	const lastFocusedTabbableRef = react.useRef(null);
	const closeTypeRef = react.useRef("");
	const lastInteractionTypeRef = react.useRef("");
	const beforeGuardRef = react.useRef(null);
	const afterGuardRef = react.useRef(null);
	const mergedBeforeGuardRef = useMergedRefs(beforeGuardRef, beforeContentFocusGuardRef, portalContext?.beforeInsideRef);
	const mergedAfterGuardRef = useMergedRefs(afterGuardRef, portalContext?.afterInsideRef);
	const blurTimeout = useTimeout();
	const pointerDownTimeout = useTimeout();
	const restoreFocusFrame = useAnimationFrame();
	const isInsidePortal = portalContext != null;
	const floatingFocusElement = getFloatingFocusElement(floating);
	const getTabbableContent = useStableCallback((container = floatingFocusElement) => {
		return container ? tabbable(container) : [];
	});
	const getResolvedInsideElements = useStableCallback(() => getInsideElements?.().filter((element) => element != null) ?? []);
	react.useEffect(() => {
		if (disabled$1 || !modal) return;
		function onKeyDown(event) {
			if (event.key === "Tab") {
				if (contains(floatingFocusElement, activeElement(ownerDocument(floatingFocusElement))) && getTabbableContent().length === 0 && !isUntrappedTypeableCombobox) stopEvent(event);
			}
		}
		return addEventListener(ownerDocument(floatingFocusElement), "keydown", onKeyDown);
	}, [
		disabled$1,
		floatingFocusElement,
		modal,
		isUntrappedTypeableCombobox,
		getTabbableContent
	]);
	react.useEffect(() => {
		if (disabled$1 || !open) return;
		const doc = ownerDocument(floatingFocusElement);
		function clearPointerDownOutside() {
			pointerDownOutsideRef.current = false;
		}
		function onPointerDown(event) {
			const target = getTarget(event);
			const insideElements = getResolvedInsideElements();
			pointerDownOutsideRef.current = !(contains(floating, target) || contains(domReference, target) || contains(portalContext?.portalNode, target) || insideElements.some((element) => element === target || contains(element, target)));
			lastInteractionTypeRef.current = event.pointerType || "keyboard";
			if (target?.closest(`[${CLICK_TRIGGER_IDENTIFIER}]`)) {
				isPointerDownRef.current = true;
				pointerDownTimeout.start(0, () => {
					isPointerDownRef.current = false;
				});
			}
		}
		function onKeyDown() {
			lastInteractionTypeRef.current = "keyboard";
		}
		return mergeCleanups(addEventListener(doc, "pointerdown", onPointerDown, true), addEventListener(doc, "pointerup", clearPointerDownOutside, true), addEventListener(doc, "pointercancel", clearPointerDownOutside, true), addEventListener(doc, "keydown", onKeyDown, true), clearPointerDownOutside);
	}, [
		disabled$1,
		floating,
		domReference,
		floatingFocusElement,
		open,
		portalContext,
		pointerDownTimeout,
		getResolvedInsideElements
	]);
	react.useEffect(() => {
		if (disabled$1 || !closeOnFocusOut) return;
		const doc = ownerDocument(floatingFocusElement);
		function handlePointerDown() {
			isPointerDownRef.current = true;
			pointerDownTimeout.start(0, () => {
				isPointerDownRef.current = false;
			});
		}
		function handleFocusIn(event) {
			const target = getTarget(event);
			if (isTabbable(target)) lastFocusedTabbableRef.current = target;
		}
		function handleFocusOutside(event) {
			const relatedTarget = event.relatedTarget;
			const currentTarget = event.currentTarget;
			const target = getTarget(event);
			if (modal && relatedTarget == null && target != null && contains(floating, target)) addPreviouslyFocusedElement(target);
			queueMicrotask(() => {
				const nodeId = getNodeId();
				const triggers = store$2.context.triggerElements;
				const insideElements = getResolvedInsideElements();
				const isRelatedFocusGuard = relatedTarget?.hasAttribute(createAttribute("focus-guard")) && [
					beforeGuardRef.current,
					afterGuardRef.current,
					portalContext?.beforeInsideRef.current,
					portalContext?.afterInsideRef.current,
					portalContext?.beforeOutsideRef.current,
					portalContext?.afterOutsideRef.current,
					resolveRef(previousFocusableElement),
					resolveRef(nextFocusableElement)
				].includes(relatedTarget);
				const movedToUnrelatedNode = !(contains(domReference, relatedTarget) || contains(floating, relatedTarget) || contains(relatedTarget, floating) || contains(portalContext?.portalNode, relatedTarget) || insideElements.some((element) => element === relatedTarget || contains(element, relatedTarget)) || triggers.hasMatchingElement((trigger) => contains(trigger, relatedTarget)) || isRelatedFocusGuard || tree && (getNodeChildren(tree.nodesRef.current, nodeId).find((node) => contains(node.context?.elements.floating, relatedTarget) || contains(node.context?.elements.domReference, relatedTarget)) || getNodeAncestors(tree.nodesRef.current, nodeId).find((node) => [node.context?.elements.floating, getFloatingFocusElement(node.context?.elements.floating)].includes(relatedTarget) || node.context?.elements.domReference === relatedTarget)));
				if (currentTarget === domReference && floatingFocusElement) handleTabIndex(floatingFocusElement);
				if (restoreFocus && currentTarget !== domReference && !isElementVisible(target) && activeElement(doc) === doc.body) {
					if (isHTMLElement(floatingFocusElement)) {
						floatingFocusElement.focus();
						if (restoreFocus === "popup") {
							restoreFocusFrame.request(() => {
								floatingFocusElement.focus();
							});
							return;
						}
					}
					const tabbableContent = getTabbableContent();
					const prevTabbable = lastFocusedTabbableRef.current;
					const nodeToFocus = (prevTabbable && tabbableContent.includes(prevTabbable) ? prevTabbable : null) || tabbableContent[tabbableContent.length - 1] || floatingFocusElement;
					if (isHTMLElement(nodeToFocus)) nodeToFocus.focus();
				}
				if (dataRef.current.insideReactTree) {
					dataRef.current.insideReactTree = false;
					return;
				}
				if ((isUntrappedTypeableCombobox ? true : !modal) && relatedTarget && movedToUnrelatedNode && !isPointerDownRef.current && (isUntrappedTypeableCombobox || relatedTarget !== getPreviouslyFocusedElement())) {
					preventReturnFocusRef.current = true;
					store$2.setOpen(false, createChangeEventDetails(focusOut, event));
				}
			});
		}
		function markInsideReactTree() {
			if (pointerDownOutsideRef.current) return;
			dataRef.current.insideReactTree = true;
			blurTimeout.start(0, () => {
				dataRef.current.insideReactTree = false;
			});
		}
		const domReferenceElement = isHTMLElement(domReference) ? domReference : null;
		if (!floating && !domReferenceElement) return;
		return mergeCleanups(domReferenceElement && addEventListener(domReferenceElement, "focusout", handleFocusOutside), domReferenceElement && addEventListener(domReferenceElement, "pointerdown", handlePointerDown), floating && addEventListener(floating, "focusin", handleFocusIn), floating && addEventListener(floating, "focusout", handleFocusOutside), floating && portalContext && addEventListener(floating, "focusout", markInsideReactTree, true));
	}, [
		disabled$1,
		domReference,
		floating,
		floatingFocusElement,
		modal,
		tree,
		portalContext,
		store$2,
		closeOnFocusOut,
		restoreFocus,
		getTabbableContent,
		isUntrappedTypeableCombobox,
		getNodeId,
		dataRef,
		blurTimeout,
		pointerDownTimeout,
		restoreFocusFrame,
		nextFocusableElement,
		previousFocusableElement,
		getResolvedInsideElements
	]);
	react.useEffect(() => {
		if (disabled$1 || !floating || !open) return;
		const portalNodes = Array.from(portalContext?.portalNode?.querySelectorAll(`[${createAttribute("portal")}]`) || []);
		const rootAncestorComboboxDomReference = (tree ? getNodeAncestors(tree.nodesRef.current, getNodeId()) : []).find((node) => isTypeableCombobox(node.context?.elements.domReference || null))?.context?.elements.domReference;
		const ariaHiddenCleanup = markOthers([
			...[
				floating,
				...portalNodes,
				beforeGuardRef.current,
				afterGuardRef.current,
				portalContext?.beforeOutsideRef.current,
				portalContext?.afterOutsideRef.current,
				...getResolvedInsideElements()
			],
			rootAncestorComboboxDomReference,
			resolveRef(previousFocusableElement),
			resolveRef(nextFocusableElement),
			isUntrappedTypeableCombobox ? domReference : null
		].filter((x) => x != null), {
			ariaHidden: modal || isUntrappedTypeableCombobox,
			mark: false
		});
		const markerCleanup = markOthers([floating, ...portalNodes].filter((x) => x != null));
		return () => {
			markerCleanup();
			ariaHiddenCleanup();
		};
	}, [
		open,
		disabled$1,
		domReference,
		floating,
		modal,
		portalContext,
		isUntrappedTypeableCombobox,
		tree,
		getNodeId,
		nextFocusableElement,
		previousFocusableElement,
		getResolvedInsideElements
	]);
	useIsoLayoutEffect(() => {
		if (!open || disabled$1 || !isHTMLElement(floatingFocusElement)) return;
		closeTypeRef.current = "";
		lastInteractionTypeRef.current = "";
		const doc = ownerDocument(floatingFocusElement);
		const previouslyFocusedElement = activeElement(doc);
		queueMicrotask(() => {
			const initialFocusValueOrFn = initialFocusRef.current;
			const resolvedInitialFocus = typeof initialFocusValueOrFn === "function" ? initialFocusValueOrFn(openInteractionTypeRef.current || "") : initialFocusValueOrFn;
			if (resolvedInitialFocus === void 0 || resolvedInitialFocus === false) return;
			if (contains(floatingFocusElement, previouslyFocusedElement)) return;
			let focusableElements = null;
			const getDefaultFocusElement = () => {
				if (focusableElements == null) focusableElements = getTabbableContent(floatingFocusElement);
				return focusableElements[0] || floatingFocusElement;
			};
			let elToFocus;
			if (resolvedInitialFocus === true || resolvedInitialFocus === null) elToFocus = getDefaultFocusElement();
			else elToFocus = resolveRef(resolvedInitialFocus);
			elToFocus = elToFocus || getDefaultFocusElement();
			const hadFocusInside = contains(floatingFocusElement, activeElement(doc));
			enqueueFocus(elToFocus, {
				preventScroll: elToFocus === floatingFocusElement,
				shouldFocus() {
					if (!openRef.current) return false;
					if (hadFocusInside) return true;
					const currentActiveElement = activeElement(doc);
					return !(currentActiveElement !== elToFocus && contains(floatingFocusElement, currentActiveElement));
				}
			});
		});
	}, [
		disabled$1,
		open,
		floatingFocusElement,
		getTabbableContent,
		initialFocusRef,
		openInteractionTypeRef,
		openRef
	]);
	useIsoLayoutEffect(() => {
		if (disabled$1 || !floatingFocusElement) return;
		const doc = ownerDocument(floatingFocusElement);
		const elementFocusedBeforeOpen = activeElement(doc);
		const preferPreviousFocus = openInteractionTypeRef.current == null;
		addPreviouslyFocusedElement(elementFocusedBeforeOpen);
		function onOpenChangeLocal(details) {
			if (!details.open) closeTypeRef.current = getEventType(details.nativeEvent, lastInteractionTypeRef.current);
			if (details.reason === triggerHover && details.nativeEvent.type === "mouseleave") preventReturnFocusRef.current = true;
			if (details.reason !== outsidePress) return;
			if (details.nested) preventReturnFocusRef.current = false;
			else if (isVirtualClick(details.nativeEvent) || isVirtualPointerEvent(details.nativeEvent)) preventReturnFocusRef.current = false;
			else {
				let isPreventScrollSupported = false;
				ownerDocument(floatingFocusElement).createElement("div").focus({ get preventScroll() {
					isPreventScrollSupported = true;
					return false;
				} });
				if (isPreventScrollSupported) preventReturnFocusRef.current = false;
				else preventReturnFocusRef.current = true;
			}
		}
		events.on("openchange", onOpenChangeLocal);
		function getReturnElement(closeType) {
			const returnFocusValueOrFn = returnFocusRef.current;
			let resolvedReturnFocusValue = typeof returnFocusValueOrFn === "function" ? returnFocusValueOrFn(closeType) : returnFocusValueOrFn;
			if (resolvedReturnFocusValue === void 0 || resolvedReturnFocusValue === false) return null;
			if (resolvedReturnFocusValue === null) resolvedReturnFocusValue = true;
			const referenceReturnElement = domReference?.isConnected ? domReference : null;
			const previousReturnElement = elementFocusedBeforeOpen?.isConnected && getNodeName(elementFocusedBeforeOpen) !== "body" ? elementFocusedBeforeOpen : null;
			let defaultReturnElement = preferPreviousFocus ? previousReturnElement || referenceReturnElement : referenceReturnElement || previousReturnElement;
			if (!defaultReturnElement) defaultReturnElement = getPreviouslyFocusedElement() || null;
			if (typeof resolvedReturnFocusValue === "boolean") return defaultReturnElement;
			return resolveRef(resolvedReturnFocusValue) || defaultReturnElement || null;
		}
		return () => {
			events.off("openchange", onOpenChangeLocal);
			const activeEl = activeElement(doc);
			const insideElements = getResolvedInsideElements();
			const isFocusInsideFloatingTree = contains(floating, activeEl) || insideElements.some((element) => element === activeEl || contains(element, activeEl)) || tree && getNodeChildren(tree.nodesRef.current, getNodeId(), false).some((node) => contains(node.context?.elements.floating, activeEl));
			const returnFocusValueOrFn = returnFocusRef.current;
			const closeType = closeTypeRef.current;
			const returnElement = getReturnElement(closeType);
			queueMicrotask(() => {
				const tabbableReturnElement = getFirstTabbableElement(returnElement);
				const hasExplicitReturnFocus = typeof returnFocusValueOrFn !== "boolean";
				if (returnFocusValueOrFn && !preventReturnFocusRef.current && isHTMLElement(tabbableReturnElement) && (!hasExplicitReturnFocus && tabbableReturnElement !== activeEl && activeEl !== doc.body ? isFocusInsideFloatingTree : true)) {
					const focusOptions = { preventScroll: true };
					if (closeType === "keyboard") focusOptions.focusVisible = true;
					tabbableReturnElement.focus(focusOptions);
				}
				preventReturnFocusRef.current = false;
			});
		};
	}, [
		disabled$1,
		floating,
		floatingFocusElement,
		returnFocusRef,
		openInteractionTypeRef,
		events,
		tree,
		domReference,
		getNodeId,
		getResolvedInsideElements
	]);
	useIsoLayoutEffect(() => {
		if (!webkit || open || !floating) return;
		const activeEl = activeElement(ownerDocument(floating));
		if (!isHTMLElement(activeEl) || !isTypeableElement(activeEl)) return;
		if (contains(floating, activeEl)) activeEl.blur();
	}, [open, floating]);
	useIsoLayoutEffect(() => {
		if (disabled$1 || !portalContext) return;
		portalContext.setFocusManagerState({
			modal,
			closeOnFocusOut,
			open,
			onOpenChange: store$2.setOpen,
			domReference
		});
		return () => {
			portalContext.setFocusManagerState(null);
		};
	}, [
		disabled$1,
		portalContext,
		modal,
		open,
		store$2,
		closeOnFocusOut,
		domReference
	]);
	useIsoLayoutEffect(() => {
		if (disabled$1 || !floatingFocusElement) return;
		handleTabIndex(floatingFocusElement);
		return () => {
			queueMicrotask(clearDisconnectedPreviouslyFocusedElements);
		};
	}, [disabled$1, floatingFocusElement]);
	const shouldRenderGuards = !disabled$1 && (modal ? !isUntrappedTypeableCombobox : true) && (isInsidePortal || modal);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react.Fragment, { children: [
		shouldRenderGuards && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FocusGuard, {
			"data-type": "inside",
			ref: mergedBeforeGuardRef,
			onFocus: (event) => {
				if (modal) {
					const els = getTabbableContent();
					enqueueFocus(els[els.length - 1]);
				} else if (portalContext?.portalNode) {
					preventReturnFocusRef.current = false;
					if (isOutsideEvent(event, portalContext.portalNode)) getNextTabbable(domReference)?.focus();
					else resolveRef(previousFocusableElement ?? portalContext.beforeOutsideRef)?.focus();
				}
			}
		}),
		children,
		shouldRenderGuards && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FocusGuard, {
			"data-type": "inside",
			ref: mergedAfterGuardRef,
			onFocus: (event) => {
				if (modal) enqueueFocus(getTabbableContent()[0]);
				else if (portalContext?.portalNode) {
					if (closeOnFocusOut) preventReturnFocusRef.current = true;
					if (isOutsideEvent(event, portalContext.portalNode)) getPreviousTabbable(domReference)?.focus();
					else resolveRef(nextFocusableElement ?? portalContext.afterOutsideRef)?.focus();
				}
			}
		})
	] });
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/floating-ui-react/hooks/useClick.mjs
/**
* Opens or closes the floating element when clicking the reference element.
* @see https://floating-ui.com/docs/useClick
*/
function useClick(context, props = {}) {
	const { enabled = true, event: eventOption = "click", toggle: toggle$1 = true, ignoreMouse = false, stickIfOpen = true, touchOpenDelay = 0, reason = triggerPress } = props;
	const store$2 = "rootStore" in context ? context.rootStore : context;
	const dataRef = store$2.context.dataRef;
	const pointerTypeRef = react.useRef(void 0);
	const frame = useAnimationFrame();
	const touchOpenTimeout = useTimeout();
	const reference = react.useMemo(() => {
		function setOpenWithTouchDelay(nextOpen, nativeEvent, target, pointerType) {
			const details = createChangeEventDetails(reason, nativeEvent, target);
			if (nextOpen && pointerType === "touch" && touchOpenDelay > 0) touchOpenTimeout.start(touchOpenDelay, () => {
				store$2.setOpen(true, details);
			});
			else store$2.setOpen(nextOpen, details);
		}
		function getNextOpen(open, currentTarget, isClickLikeOpenEvent$1) {
			const openEvent = dataRef.current.openEvent;
			const hasClickedOnInactiveTrigger = store$2.select("domReferenceElement") !== currentTarget;
			if (open && hasClickedOnInactiveTrigger) return true;
			if (!open) return true;
			if (!toggle$1) return true;
			if (openEvent && stickIfOpen) return !isClickLikeOpenEvent$1(openEvent.type);
			return false;
		}
		return {
			onPointerDown(event) {
				pointerTypeRef.current = isMouseLikePointerType(event.pointerType, true) && isVirtualPointerEvent(event.nativeEvent) ? "virtual" : event.pointerType;
			},
			onMouseDown(event) {
				const pointerType = pointerTypeRef.current;
				const nativeEvent = event.nativeEvent;
				const open = store$2.select("open");
				if (event.button !== 0 || eventOption === "click" || isMouseLikePointerType(pointerType, true) && ignoreMouse) return;
				const nextOpen = getNextOpen(open, event.currentTarget, (openEventType) => openEventType === "click" || openEventType === "mousedown");
				const target = getTarget(nativeEvent);
				if (isTypeableElement(target)) {
					setOpenWithTouchDelay(nextOpen, nativeEvent, target, pointerType);
					return;
				}
				const eventCurrentTarget = event.currentTarget;
				frame.request(() => {
					setOpenWithTouchDelay(nextOpen, nativeEvent, eventCurrentTarget, pointerType);
				});
			},
			onClick(event) {
				if (eventOption === "mousedown-only") return;
				const pointerType = pointerTypeRef.current;
				if (eventOption === "mousedown" && pointerType) {
					pointerTypeRef.current = void 0;
					return;
				}
				if (isMouseLikePointerType(pointerType, true) && ignoreMouse) return;
				setOpenWithTouchDelay(getNextOpen(store$2.select("open"), event.currentTarget, (openEventType) => openEventType === "click" || openEventType === "mousedown" || openEventType === "keydown" || openEventType === "keyup"), event.nativeEvent, event.currentTarget, pointerType);
			},
			onKeyDown() {
				pointerTypeRef.current = void 0;
			}
		};
	}, [
		dataRef,
		eventOption,
		ignoreMouse,
		reason,
		store$2,
		stickIfOpen,
		toggle$1,
		frame,
		touchOpenTimeout,
		touchOpenDelay
	]);
	return react.useMemo(() => enabled ? { reference } : EMPTY_OBJECT, [enabled, reference]);
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/floating-ui-react/hooks/useDismiss.mjs
function alwaysFalse() {
	return false;
}
function normalizeProp(normalizable) {
	return {
		escapeKey: typeof normalizable === "boolean" ? normalizable : normalizable?.escapeKey ?? false,
		outsidePress: typeof normalizable === "boolean" ? normalizable : normalizable?.outsidePress ?? true
	};
}
/**
* Closes the floating element when a dismissal is requested — by default, when
* the user presses the `escape` key or outside of the floating element.
* @see https://floating-ui.com/docs/useDismiss
*/
function useDismiss(context, props = {}) {
	const { enabled = true, escapeKey: escapeKey$1 = true, outsidePress: outsidePressProp = true, outsidePressEvent = "sloppy", referencePress = alwaysFalse, bubbles, externalTree } = props;
	const store$2 = "rootStore" in context ? context.rootStore : context;
	const open = store$2.useState("open");
	const floatingElement = store$2.useState("floatingElement");
	const { dataRef } = store$2.context;
	const tree = useFloatingTree(externalTree);
	const outsidePressFn = useStableCallback(typeof outsidePressProp === "function" ? outsidePressProp : () => false);
	const outsidePress$1 = typeof outsidePressProp === "function" ? outsidePressFn : outsidePressProp;
	const outsidePressEnabled = outsidePress$1 !== false;
	const getOutsidePressEventProp = useStableCallback(() => outsidePressEvent);
	const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } = normalizeProp(bubbles);
	const pressStartedInsideRef = react.useRef(false);
	const pressStartPreventedRef = react.useRef(false);
	const suppressNextOutsideClickRef = react.useRef(false);
	const isComposingRef = react.useRef(false);
	const currentPointerTypeRef = react.useRef("");
	const touchStateRef = react.useRef(null);
	const cancelDismissOnEndTimeout = useTimeout();
	const clearInsideReactTreeTimeout = useTimeout();
	const clearInsideReactTree = useStableCallback(() => {
		clearInsideReactTreeTimeout.clear();
		dataRef.current.insideReactTree = false;
	});
	const hasBlockingChild = useStableCallback((bubbleKey) => {
		const nodeId = dataRef.current.floatingContext?.nodeId;
		return (tree ? getNodeChildren(tree.nodesRef.current, nodeId) : []).some((child) => child.context?.open && !child.context.dataRef.current[bubbleKey]);
	});
	const isEventWithinOwnElements = useStableCallback((event) => {
		return isEventTargetWithin(event, store$2.select("floatingElement")) || isEventTargetWithin(event, store$2.select("domReferenceElement"));
	});
	const closeOnReferencePress = useStableCallback((event) => {
		if (!referencePress()) return;
		store$2.setOpen(false, createChangeEventDetails(triggerPress, event.nativeEvent));
	});
	const closeOnEscapeKeyDown = useStableCallback((event) => {
		if (!open || !enabled || !escapeKey$1 || event.key !== "Escape") return;
		if (isComposingRef.current) return;
		if (!escapeKeyBubbles && hasBlockingChild("__escapeKeyBubbles")) return;
		const native = isReactEvent(event) ? event.nativeEvent : event;
		const eventDetails = createChangeEventDetails(escapeKey, native);
		store$2.setOpen(false, eventDetails);
		if (!eventDetails.isCanceled) event.preventDefault();
		if (!escapeKeyBubbles && !eventDetails.isPropagationAllowed) event.stopPropagation();
	});
	const markInsideReactTree = useStableCallback(() => {
		dataRef.current.insideReactTree = true;
		clearInsideReactTreeTimeout.start(0, clearInsideReactTree);
	});
	const markPressStartedInsideReactTree = useStableCallback((event) => {
		if (!open || !enabled || event.button !== 0) return;
		const target = getTarget(event.nativeEvent);
		if (!contains(store$2.select("floatingElement"), target)) return;
		if (!pressStartedInsideRef.current) {
			pressStartedInsideRef.current = true;
			pressStartPreventedRef.current = false;
		}
	});
	const markInsidePressStartPrevented = useStableCallback((event) => {
		if (!open || !enabled) return;
		if (!(event.defaultPrevented || event.nativeEvent.defaultPrevented)) return;
		if (pressStartedInsideRef.current) pressStartPreventedRef.current = true;
	});
	react.useEffect(() => {
		if (!open || !enabled) return clearInsideReactTree;
		dataRef.current.__escapeKeyBubbles = escapeKeyBubbles;
		dataRef.current.__outsidePressBubbles = outsidePressBubbles;
		const compositionTimeout = new Timeout();
		const preventedPressSuppressionTimeout = new Timeout();
		function handleCompositionStart() {
			compositionTimeout.clear();
			isComposingRef.current = true;
		}
		function handleCompositionEnd() {
			compositionTimeout.start(webkit ? 5 : 0, () => {
				isComposingRef.current = false;
			});
		}
		function suppressImmediateOutsideClickAfterPreventedStart() {
			suppressNextOutsideClickRef.current = true;
			preventedPressSuppressionTimeout.start(0, () => {
				suppressNextOutsideClickRef.current = false;
			});
		}
		function resetPressStartState() {
			pressStartedInsideRef.current = false;
			pressStartPreventedRef.current = false;
		}
		function getOutsidePressEvent() {
			const type = currentPointerTypeRef.current;
			const computedType = type === "pen" || !type ? "mouse" : type;
			const outsidePressEventValue = getOutsidePressEventProp();
			const resolved = typeof outsidePressEventValue === "function" ? outsidePressEventValue() : outsidePressEventValue;
			if (typeof resolved === "string") return resolved;
			return resolved[computedType];
		}
		function shouldIgnoreEvent(event) {
			const computedOutsidePressEvent = getOutsidePressEvent();
			return computedOutsidePressEvent === "intentional" && event.type !== "click" || computedOutsidePressEvent === "sloppy" && event.type === "click";
		}
		function isEventWithinFloatingTree(event) {
			const nodeId = dataRef.current.floatingContext?.nodeId;
			const targetIsInsideChildren = tree && getNodeChildren(tree.nodesRef.current, nodeId).some((node) => isEventTargetWithin(event, node.context?.elements.floating));
			return isEventWithinOwnElements(event) || targetIsInsideChildren;
		}
		function closeOnPressOutside(event) {
			if (shouldIgnoreEvent(event)) {
				if (event.type !== "click" && !isEventWithinOwnElements(event)) {
					preventedPressSuppressionTimeout.clear();
					suppressNextOutsideClickRef.current = false;
				}
				clearInsideReactTree();
				return;
			}
			if (dataRef.current.insideReactTree) {
				clearInsideReactTree();
				return;
			}
			const target = getTarget(event);
			const inertSelector = `[${createAttribute("inert")}]`;
			const targetRoot = isElement(target) ? target.getRootNode() : null;
			const markers = Array.from((isShadowRoot(targetRoot) ? targetRoot : ownerDocument(store$2.select("floatingElement"))).querySelectorAll(inertSelector));
			const triggers = store$2.context.triggerElements;
			if (target && (triggers.hasElement(target) || triggers.hasMatchingElement((trigger) => contains(trigger, target)))) return;
			let targetRootAncestor = isElement(target) ? target : null;
			while (targetRootAncestor && !isLastTraversableNode(targetRootAncestor)) {
				const nextParent = getParentNode(targetRootAncestor);
				if (isLastTraversableNode(nextParent) || !isElement(nextParent)) break;
				targetRootAncestor = nextParent;
			}
			if (markers.length && isElement(target) && !isRootElement(target) && !contains(target, store$2.select("floatingElement")) && markers.every((marker) => !contains(targetRootAncestor, marker))) return;
			if (isHTMLElement(target) && !("touches" in event)) {
				const lastTraversableNode = isLastTraversableNode(target);
				const style = getComputedStyle$1(target);
				const scrollRe = /auto|scroll/;
				const isScrollableX = lastTraversableNode || scrollRe.test(style.overflowX);
				const isScrollableY = lastTraversableNode || scrollRe.test(style.overflowY);
				const canScrollX = isScrollableX && target.clientWidth > 0 && target.scrollWidth > target.clientWidth;
				const canScrollY = isScrollableY && target.clientHeight > 0 && target.scrollHeight > target.clientHeight;
				const isRTL$1 = style.direction === "rtl";
				const pressedVerticalScrollbar = canScrollY && (isRTL$1 ? event.offsetX <= target.offsetWidth - target.clientWidth : event.offsetX > target.clientWidth);
				const pressedHorizontalScrollbar = canScrollX && event.offsetY > target.clientHeight;
				if (pressedVerticalScrollbar || pressedHorizontalScrollbar) return;
			}
			if (isEventWithinFloatingTree(event)) return;
			if (getOutsidePressEvent() === "intentional" && suppressNextOutsideClickRef.current) {
				preventedPressSuppressionTimeout.clear();
				suppressNextOutsideClickRef.current = false;
				return;
			}
			if (typeof outsidePress$1 === "function" && !outsidePress$1(event)) return;
			if (hasBlockingChild("__outsidePressBubbles")) return;
			store$2.setOpen(false, createChangeEventDetails(outsidePress, event));
			clearInsideReactTree();
		}
		function handlePointerDown(event) {
			if (getOutsidePressEvent() !== "sloppy" || event.pointerType === "touch" || !store$2.select("open") || !enabled || isEventWithinOwnElements(event)) return;
			closeOnPressOutside(event);
		}
		function handleTouchStart(event) {
			if (getOutsidePressEvent() !== "sloppy" || !store$2.select("open") || !enabled || isEventWithinOwnElements(event)) return;
			const touch = event.touches[0];
			if (touch) {
				touchStateRef.current = {
					startTime: Date.now(),
					startX: touch.clientX,
					startY: touch.clientY,
					dismissOnTouchEnd: false,
					dismissOnMouseDown: true
				};
				cancelDismissOnEndTimeout.start(1e3, () => {
					if (touchStateRef.current) {
						touchStateRef.current.dismissOnTouchEnd = false;
						touchStateRef.current.dismissOnMouseDown = false;
					}
				});
			}
		}
		function addTargetEventListenerOnce(event, listener) {
			const target = getTarget(event);
			if (!target) return;
			const unsubscribe$1 = addEventListener(target, event.type, () => {
				listener(event);
				unsubscribe$1();
			});
		}
		function handleTouchStartCapture(event) {
			currentPointerTypeRef.current = "touch";
			addTargetEventListenerOnce(event, handleTouchStart);
		}
		function closeOnPressOutsideCapture(event) {
			cancelDismissOnEndTimeout.clear();
			if (event.type === "pointerdown") currentPointerTypeRef.current = event.pointerType;
			if (event.type === "mousedown" && touchStateRef.current && !touchStateRef.current.dismissOnMouseDown) return;
			addTargetEventListenerOnce(event, (targetEvent) => {
				if (targetEvent.type === "pointerdown") handlePointerDown(targetEvent);
				else closeOnPressOutside(targetEvent);
			});
		}
		function handlePressEndCapture(event) {
			if (!pressStartedInsideRef.current) return;
			const pressStartedInsideDefaultPrevented = pressStartPreventedRef.current;
			resetPressStartState();
			if (getOutsidePressEvent() !== "intentional") return;
			if (event.type === "pointercancel") {
				if (pressStartedInsideDefaultPrevented) suppressImmediateOutsideClickAfterPreventedStart();
				return;
			}
			if (isEventWithinFloatingTree(event)) return;
			if (pressStartedInsideDefaultPrevented) {
				suppressImmediateOutsideClickAfterPreventedStart();
				return;
			}
			if (typeof outsidePress$1 === "function" && !outsidePress$1(event)) return;
			preventedPressSuppressionTimeout.clear();
			suppressNextOutsideClickRef.current = true;
			clearInsideReactTree();
		}
		function handleTouchMove(event) {
			if (getOutsidePressEvent() !== "sloppy" || !touchStateRef.current || isEventWithinOwnElements(event)) return;
			const touch = event.touches[0];
			if (!touch) return;
			const deltaX = Math.abs(touch.clientX - touchStateRef.current.startX);
			const deltaY = Math.abs(touch.clientY - touchStateRef.current.startY);
			const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
			if (distance > 5) touchStateRef.current.dismissOnTouchEnd = true;
			if (distance > 10) {
				closeOnPressOutside(event);
				cancelDismissOnEndTimeout.clear();
				touchStateRef.current = null;
			}
		}
		function handleTouchMoveCapture(event) {
			addTargetEventListenerOnce(event, handleTouchMove);
		}
		function handleTouchEnd(event) {
			if (getOutsidePressEvent() !== "sloppy" || !touchStateRef.current || isEventWithinOwnElements(event)) return;
			if (touchStateRef.current.dismissOnTouchEnd) closeOnPressOutside(event);
			cancelDismissOnEndTimeout.clear();
			touchStateRef.current = null;
		}
		function handleTouchEndCapture(event) {
			addTargetEventListenerOnce(event, handleTouchEnd);
		}
		const doc = ownerDocument(floatingElement);
		const unsubscribe = mergeCleanups(escapeKey$1 && mergeCleanups(addEventListener(doc, "keydown", closeOnEscapeKeyDown), addEventListener(doc, "compositionstart", handleCompositionStart), addEventListener(doc, "compositionend", handleCompositionEnd)), outsidePressEnabled && mergeCleanups(addEventListener(doc, "click", closeOnPressOutsideCapture, true), addEventListener(doc, "pointerdown", closeOnPressOutsideCapture, true), addEventListener(doc, "pointerup", handlePressEndCapture, true), addEventListener(doc, "pointercancel", handlePressEndCapture, true), addEventListener(doc, "mousedown", closeOnPressOutsideCapture, true), addEventListener(doc, "mouseup", handlePressEndCapture, true), addEventListener(doc, "touchstart", handleTouchStartCapture, true), addEventListener(doc, "touchmove", handleTouchMoveCapture, true), addEventListener(doc, "touchend", handleTouchEndCapture, true)));
		return () => {
			unsubscribe();
			compositionTimeout.clear();
			preventedPressSuppressionTimeout.clear();
			resetPressStartState();
			suppressNextOutsideClickRef.current = false;
			clearInsideReactTree();
		};
	}, [
		dataRef,
		floatingElement,
		escapeKey$1,
		outsidePressEnabled,
		outsidePress$1,
		open,
		enabled,
		escapeKeyBubbles,
		outsidePressBubbles,
		closeOnEscapeKeyDown,
		clearInsideReactTree,
		getOutsidePressEventProp,
		hasBlockingChild,
		isEventWithinOwnElements,
		tree,
		store$2,
		cancelDismissOnEndTimeout
	]);
	const reference = react.useMemo(() => ({
		onKeyDown: closeOnEscapeKeyDown,
		onPointerDown: closeOnReferencePress,
		onClick: closeOnReferencePress
	}), [closeOnEscapeKeyDown, closeOnReferencePress]);
	const floating = react.useMemo(() => ({
		onKeyDown: closeOnEscapeKeyDown,
		onPointerDown: markInsidePressStartPrevented,
		onMouseDown: markInsidePressStartPrevented,
		onClickCapture: markInsideReactTree,
		onMouseDownCapture(event) {
			markInsideReactTree();
			markPressStartedInsideReactTree(event);
		},
		onPointerDownCapture(event) {
			markInsideReactTree();
			markPressStartedInsideReactTree(event);
		},
		onMouseUpCapture: markInsideReactTree,
		onTouchEndCapture: markInsideReactTree,
		onTouchMoveCapture: markInsideReactTree
	}), [
		closeOnEscapeKeyDown,
		markInsideReactTree,
		markPressStartedInsideReactTree,
		markInsidePressStartPrevented
	]);
	return react.useMemo(() => enabled ? {
		reference,
		floating,
		trigger: reference
	} : {}, [
		enabled,
		reference,
		floating
	]);
}

//#endregion
//#region node_modules/.pnpm/@floating-ui+core@1.8.0/node_modules/@floating-ui/core/dist/floating-ui.core.mjs
function computeCoordsFromPlacement(_ref, placement, rtl) {
	let { reference, floating } = _ref;
	const sideAxis = getSideAxis(placement);
	const alignmentAxis = getAlignmentAxis(placement);
	const alignLength = getAxisLength(alignmentAxis);
	const side = getSide(placement);
	const isVertical = sideAxis === "y";
	const commonX = reference.x + reference.width / 2 - floating.width / 2;
	const commonY = reference.y + reference.height / 2 - floating.height / 2;
	const commonAlign = reference[alignLength] / 2 - floating[alignLength] / 2;
	let coords;
	switch (side) {
		case "top":
			coords = {
				x: commonX,
				y: reference.y - floating.height
			};
			break;
		case "bottom":
			coords = {
				x: commonX,
				y: reference.y + reference.height
			};
			break;
		case "right":
			coords = {
				x: reference.x + reference.width,
				y: commonY
			};
			break;
		case "left":
			coords = {
				x: reference.x - floating.width,
				y: commonY
			};
			break;
		default: coords = {
			x: reference.x,
			y: reference.y
		};
	}
	const alignment = getAlignment(placement);
	if (alignment) coords[alignmentAxis] += commonAlign * (alignment === "end" ? 1 : -1) * (rtl && isVertical ? -1 : 1);
	return coords;
}
/**
* Resolves with an object of overflow side offsets that determine how much the
* element is overflowing a given clipping boundary on each side.
* - positive = overflowing the boundary by that number of pixels
* - negative = how many pixels left before it will overflow
* - 0 = lies flush with the boundary
* @see https://floating-ui.com/docs/detectOverflow
*/
async function detectOverflow$1(state, options) {
	var _await$platform$isEle;
	if (options === void 0) options = {};
	const { x, y, platform: platform$2, rects, elements, strategy } = state;
	const { boundary = "clippingAncestors", rootBoundary = "viewport", elementContext = "floating", altBoundary = false, padding = 0 } = evaluate(options, state);
	const paddingObject = getPaddingObject(padding);
	const element = elements[altBoundary ? elementContext === "floating" ? "reference" : "floating" : elementContext];
	const clippingClientRect = rectToClientRect(await platform$2.getClippingRect({
		element: ((_await$platform$isEle = await (platform$2.isElement == null ? void 0 : platform$2.isElement(element))) != null ? _await$platform$isEle : true) ? element : element.contextElement || await (platform$2.getDocumentElement == null ? void 0 : platform$2.getDocumentElement(elements.floating)),
		boundary,
		rootBoundary,
		strategy
	}));
	const rect = elementContext === "floating" ? {
		x,
		y,
		width: rects.floating.width,
		height: rects.floating.height
	} : rects.reference;
	const offsetParent = await (platform$2.getOffsetParent == null ? void 0 : platform$2.getOffsetParent(elements.floating));
	const offsetScale = await (platform$2.isElement == null ? void 0 : platform$2.isElement(offsetParent)) && await (platform$2.getScale == null ? void 0 : platform$2.getScale(offsetParent)) || {
		x: 1,
		y: 1
	};
	const elementClientRect = rectToClientRect(platform$2.convertOffsetParentRelativeRectToViewportRelativeRect ? await platform$2.convertOffsetParentRelativeRectToViewportRelativeRect({
		elements,
		rect,
		offsetParent,
		strategy
	}) : rect);
	return {
		top: (clippingClientRect.top - elementClientRect.top + paddingObject.top) / offsetScale.y,
		bottom: (elementClientRect.bottom - clippingClientRect.bottom + paddingObject.bottom) / offsetScale.y,
		left: (clippingClientRect.left - elementClientRect.left + paddingObject.left) / offsetScale.x,
		right: (elementClientRect.right - clippingClientRect.right + paddingObject.right) / offsetScale.x
	};
}
const MAX_RESET_COUNT = 50;
/**
* Computes the `x` and `y` coordinates that will place the floating element
* next to a given reference element.
*
* This export does not have any `platform` interface logic. You will need to
* write one for the platform you are using Floating UI with.
*/
const computePosition$1 = async (reference, floating, config) => {
	const { placement = "bottom", strategy = "absolute", middleware = [], platform: platform$2 } = config;
	const platformWithDetectOverflow = platform$2.detectOverflow ? platform$2 : {
		...platform$2,
		detectOverflow: detectOverflow$1
	};
	const rtl = await (platform$2.isRTL == null ? void 0 : platform$2.isRTL(floating));
	let rects = await platform$2.getElementRects({
		reference,
		floating,
		strategy
	});
	let { x, y } = computeCoordsFromPlacement(rects, placement, rtl);
	let statefulPlacement = placement;
	let resetCount = 0;
	const middlewareData = {};
	for (let i = 0; i < middleware.length; i++) {
		const currentMiddleware = middleware[i];
		if (!currentMiddleware) continue;
		const { name, fn } = currentMiddleware;
		const { x: nextX, y: nextY, data, reset: reset$1 } = await fn({
			x,
			y,
			initialPlacement: placement,
			placement: statefulPlacement,
			strategy,
			middlewareData,
			rects,
			platform: platformWithDetectOverflow,
			elements: {
				reference,
				floating
			}
		});
		x = nextX != null ? nextX : x;
		y = nextY != null ? nextY : y;
		middlewareData[name] = {
			...middlewareData[name],
			...data
		};
		if (reset$1 && resetCount < MAX_RESET_COUNT) {
			resetCount++;
			if (typeof reset$1 === "object") {
				if (reset$1.placement) statefulPlacement = reset$1.placement;
				if (reset$1.rects) rects = reset$1.rects === true ? await platform$2.getElementRects({
					reference,
					floating,
					strategy
				}) : reset$1.rects;
				({x, y} = computeCoordsFromPlacement(rects, statefulPlacement, rtl));
			}
			i = -1;
		}
	}
	return {
		x,
		y,
		placement: statefulPlacement,
		strategy,
		middlewareData
	};
};
/**
* Optimizes the visibility of the floating element by flipping the `placement`
* in order to keep it in view when the preferred placement(s) will overflow the
* clipping boundary. Alternative to `autoPlacement`.
* @see https://floating-ui.com/docs/flip
*/
const flip$2 = function(options) {
	if (options === void 0) options = {};
	return {
		name: "flip",
		options,
		async fn(state) {
			var _middlewareData$arrow, _middlewareData$flip;
			const { placement, middlewareData, rects, initialPlacement, platform: platform$2, elements } = state;
			const { mainAxis: checkMainAxis = true, crossAxis: checkCrossAxis = true, fallbackPlacements: specifiedFallbackPlacements, fallbackStrategy = "bestFit", fallbackAxisSideDirection = "none", flipAlignment = true,...detectOverflowOptions } = evaluate(options, state);
			if ((_middlewareData$arrow = middlewareData.arrow) != null && _middlewareData$arrow.alignmentOffset) return {};
			const side = getSide(placement);
			const initialSideAxis = getSideAxis(initialPlacement);
			const isBasePlacement = getSide(initialPlacement) === initialPlacement;
			const rtl = await (platform$2.isRTL == null ? void 0 : platform$2.isRTL(elements.floating));
			const fallbackPlacements = specifiedFallbackPlacements || (isBasePlacement || !flipAlignment ? [getOppositePlacement(initialPlacement)] : getExpandedPlacements(initialPlacement));
			const hasFallbackAxisSideDirection = fallbackAxisSideDirection !== "none";
			if (!specifiedFallbackPlacements && hasFallbackAxisSideDirection) fallbackPlacements.push(...getOppositeAxisPlacements(initialPlacement, flipAlignment, fallbackAxisSideDirection, rtl));
			const placements$1 = [initialPlacement, ...fallbackPlacements];
			const overflow = await platform$2.detectOverflow(state, detectOverflowOptions);
			const overflows = [];
			let overflowsData = ((_middlewareData$flip = middlewareData.flip) == null ? void 0 : _middlewareData$flip.overflows) || [];
			if (checkMainAxis) overflows.push(overflow[side]);
			if (checkCrossAxis) {
				const sides$1 = getAlignmentSides(placement, rects, rtl);
				overflows.push(overflow[sides$1[0]], overflow[sides$1[1]]);
			}
			overflowsData = [...overflowsData, {
				placement,
				overflows
			}];
			if (!overflows.every((side$1) => side$1 <= 0)) {
				var _middlewareData$flip2, _overflowsData$filter;
				const nextIndex = (((_middlewareData$flip2 = middlewareData.flip) == null ? void 0 : _middlewareData$flip2.index) || 0) + 1;
				const nextPlacement = placements$1[nextIndex];
				if (nextPlacement) {
					if (!(checkCrossAxis === "alignment" ? initialSideAxis !== getSideAxis(nextPlacement) : false) || overflowsData.every((d) => getSideAxis(d.placement) === initialSideAxis ? d.overflows[0] > 0 : true)) return {
						data: {
							index: nextIndex,
							overflows: overflowsData
						},
						reset: { placement: nextPlacement }
					};
				}
				let resetPlacement = (_overflowsData$filter = overflowsData.filter((d) => d.overflows[0] <= 0).sort((a, b) => a.overflows[1] - b.overflows[1])[0]) == null ? void 0 : _overflowsData$filter.placement;
				if (!resetPlacement) switch (fallbackStrategy) {
					case "bestFit": {
						var _overflowsData$filter2;
						const placement$1 = (_overflowsData$filter2 = overflowsData.filter((d) => {
							if (hasFallbackAxisSideDirection) {
								const currentSideAxis = getSideAxis(d.placement);
								return currentSideAxis === initialSideAxis || currentSideAxis === "y";
							}
							return true;
						}).map((d) => [d.placement, d.overflows.filter((overflow$1) => overflow$1 > 0).reduce((acc, overflow$1) => acc + overflow$1, 0)]).sort((a, b) => a[1] - b[1])[0]) == null ? void 0 : _overflowsData$filter2[0];
						if (placement$1) resetPlacement = placement$1;
						break;
					}
					case "initialPlacement":
						resetPlacement = initialPlacement;
						break;
				}
				if (placement !== resetPlacement) return { reset: { placement: resetPlacement } };
			}
			return {};
		}
	};
};
const originSides = /* @__PURE__ */ new Set(["left", "top"]);
async function convertValueToCoords(state, options) {
	const { placement, platform: platform$2, elements } = state;
	const rtl = await (platform$2.isRTL == null ? void 0 : platform$2.isRTL(elements.floating));
	const side = getSide(placement);
	const alignment = getAlignment(placement);
	const isVertical = getSideAxis(placement) === "y";
	const mainAxisMulti = originSides.has(side) ? -1 : 1;
	const crossAxisMulti = rtl && isVertical ? -1 : 1;
	const rawValue = evaluate(options, state);
	let { mainAxis, crossAxis, alignmentAxis } = typeof rawValue === "number" ? {
		mainAxis: rawValue,
		crossAxis: 0,
		alignmentAxis: null
	} : {
		mainAxis: rawValue.mainAxis || 0,
		crossAxis: rawValue.crossAxis || 0,
		alignmentAxis: rawValue.alignmentAxis
	};
	if (alignment && typeof alignmentAxis === "number") crossAxis = alignment === "end" ? alignmentAxis * -1 : alignmentAxis;
	return isVertical ? {
		x: crossAxis * crossAxisMulti,
		y: mainAxis * mainAxisMulti
	} : {
		x: mainAxis * mainAxisMulti,
		y: crossAxis * crossAxisMulti
	};
}
/**
* Modifies the placement by translating the floating element along the
* specified axes.
* A number (shorthand for `mainAxis` or distance), or an axes configuration
* object may be passed.
* @see https://floating-ui.com/docs/offset
*/
const offset$2 = function(options) {
	if (options === void 0) options = 0;
	return {
		name: "offset",
		options,
		async fn(state) {
			var _middlewareData$offse, _middlewareData$arrow;
			const { x, y, placement, middlewareData } = state;
			const diffCoords = await convertValueToCoords(state, options);
			if (placement === ((_middlewareData$offse = middlewareData.offset) == null ? void 0 : _middlewareData$offse.placement) && (_middlewareData$arrow = middlewareData.arrow) != null && _middlewareData$arrow.alignmentOffset) return {};
			return {
				x: x + diffCoords.x,
				y: y + diffCoords.y,
				data: {
					...diffCoords,
					placement
				}
			};
		}
	};
};
/**
* Optimizes the visibility of the floating element by shifting it in order to
* keep it in view when it will overflow the clipping boundary.
* @see https://floating-ui.com/docs/shift
*/
const shift$2 = function(options) {
	if (options === void 0) options = {};
	return {
		name: "shift",
		options,
		async fn(state) {
			const { x, y, placement, platform: platform$2 } = state;
			const { mainAxis: checkMainAxis = true, crossAxis: checkCrossAxis = false, limiter = { fn: (_ref) => {
				let { x: x$1, y: y$1 } = _ref;
				return {
					x: x$1,
					y: y$1
				};
			} },...detectOverflowOptions } = evaluate(options, state);
			const coords = {
				x,
				y
			};
			const overflow = await platform$2.detectOverflow(state, detectOverflowOptions);
			const crossAxis = getSideAxis(placement);
			const mainAxis = getOppositeAxis(crossAxis);
			let mainAxisCoord = coords[mainAxis];
			let crossAxisCoord = coords[crossAxis];
			const clampCoord = (axis, coord) => clamp(coord + overflow[axis === "y" ? "top" : "left"], coord, coord - overflow[axis === "y" ? "bottom" : "right"]);
			if (checkMainAxis) mainAxisCoord = clampCoord(mainAxis, mainAxisCoord);
			if (checkCrossAxis) crossAxisCoord = clampCoord(crossAxis, crossAxisCoord);
			const limitedCoords = limiter.fn({
				...state,
				[mainAxis]: mainAxisCoord,
				[crossAxis]: crossAxisCoord
			});
			return {
				...limitedCoords,
				data: {
					x: limitedCoords.x - x,
					y: limitedCoords.y - y,
					enabled: {
						[mainAxis]: checkMainAxis,
						[crossAxis]: checkCrossAxis
					}
				}
			};
		}
	};
};
/**
* Built-in `limiter` that will stop `shift()` at a certain point.
*/
const limitShift$2 = function(options) {
	if (options === void 0) options = {};
	return {
		options,
		fn(state) {
			var _rawOffset$mainAxis, _rawOffset$crossAxis;
			const { x, y, placement, rects, middlewareData } = state;
			const { offset: offset$3 = 0, mainAxis: checkMainAxis = true, crossAxis: checkCrossAxis = true } = evaluate(options, state);
			const coords = {
				x,
				y
			};
			const crossAxis = getSideAxis(placement);
			const mainAxis = getOppositeAxis(crossAxis);
			let mainAxisCoord = coords[mainAxis];
			let crossAxisCoord = coords[crossAxis];
			const rawOffset = evaluate(offset$3, state);
			const computedOffset = typeof rawOffset === "number" ? {
				mainAxis: rawOffset,
				crossAxis: 0
			} : {
				mainAxis: (_rawOffset$mainAxis = rawOffset.mainAxis) != null ? _rawOffset$mainAxis : 0,
				crossAxis: (_rawOffset$crossAxis = rawOffset.crossAxis) != null ? _rawOffset$crossAxis : 0
			};
			if (checkMainAxis) {
				const len = mainAxis === "y" ? "height" : "width";
				const limitMin = rects.reference[mainAxis] - rects.floating[len] + computedOffset.mainAxis;
				const limitMax = rects.reference[mainAxis] + rects.reference[len] - computedOffset.mainAxis;
				if (mainAxisCoord < limitMin) mainAxisCoord = limitMin;
				else if (mainAxisCoord > limitMax) mainAxisCoord = limitMax;
			}
			if (checkCrossAxis) {
				var _middlewareData$offse, _middlewareData$offse2;
				const len = mainAxis === "y" ? "width" : "height";
				const isOriginSide = originSides.has(getSide(placement));
				const limitMin = rects.reference[crossAxis] - rects.floating[len] + (isOriginSide ? ((_middlewareData$offse = middlewareData.offset) == null ? void 0 : _middlewareData$offse[crossAxis]) || 0 : 0) + (isOriginSide ? 0 : computedOffset.crossAxis);
				const limitMax = rects.reference[crossAxis] + rects.reference[len] + (isOriginSide ? 0 : ((_middlewareData$offse2 = middlewareData.offset) == null ? void 0 : _middlewareData$offse2[crossAxis]) || 0) - (isOriginSide ? computedOffset.crossAxis : 0);
				if (crossAxisCoord < limitMin) crossAxisCoord = limitMin;
				else if (crossAxisCoord > limitMax) crossAxisCoord = limitMax;
			}
			return {
				[mainAxis]: mainAxisCoord,
				[crossAxis]: crossAxisCoord
			};
		}
	};
};
/**
* Provides data that allows you to change the size of the floating element —
* for instance, prevent it from overflowing the clipping boundary or match the
* width of the reference element.
* @see https://floating-ui.com/docs/size
*/
const size$2 = function(options) {
	if (options === void 0) options = {};
	return {
		name: "size",
		options,
		async fn(state) {
			const { placement, rects, platform: platform$2, elements } = state;
			const { apply: apply$1 = () => {},...detectOverflowOptions } = evaluate(options, state);
			const overflow = await platform$2.detectOverflow(state, detectOverflowOptions);
			const side = getSide(placement);
			const alignment = getAlignment(placement);
			const isYAxis = getSideAxis(placement) === "y";
			const { width, height } = rects.floating;
			let heightSide;
			let widthSide;
			if (side === "top" || side === "bottom") {
				heightSide = side;
				widthSide = alignment === (await (platform$2.isRTL == null ? void 0 : platform$2.isRTL(elements.floating)) ? "start" : "end") ? "left" : "right";
			} else {
				widthSide = side;
				heightSide = alignment === "end" ? "top" : "bottom";
			}
			const maximumClippingHeight = height - overflow.top - overflow.bottom;
			const maximumClippingWidth = width - overflow.left - overflow.right;
			const overflowAvailableHeight = min(height - overflow[heightSide], maximumClippingHeight);
			const overflowAvailableWidth = min(width - overflow[widthSide], maximumClippingWidth);
			const shiftData = state.middlewareData.shift;
			const noShift = !shiftData;
			let availableHeight = overflowAvailableHeight;
			let availableWidth = overflowAvailableWidth;
			if (shiftData != null && shiftData.enabled.x) availableWidth = maximumClippingWidth;
			if (shiftData != null && shiftData.enabled.y) availableHeight = maximumClippingHeight;
			if (noShift && !alignment) if (isYAxis) availableWidth = width - 2 * max(overflow.left, overflow.right);
			else availableHeight = height - 2 * max(overflow.top, overflow.bottom);
			await apply$1({
				...state,
				availableWidth,
				availableHeight
			});
			const nextDimensions = await platform$2.getDimensions(elements.floating);
			if (width !== nextDimensions.width || height !== nextDimensions.height) return { reset: { rects: true } };
			return {};
		}
	};
};

//#endregion
//#region node_modules/.pnpm/@floating-ui+dom@1.8.0/node_modules/@floating-ui/dom/dist/floating-ui.dom.mjs
function getCssDimensions(element) {
	const css = getComputedStyle$1(element);
	let width = parseFloat(css.width) || 0;
	let height = parseFloat(css.height) || 0;
	const hasOffset = isHTMLElement(element);
	const offsetWidth = hasOffset ? element.offsetWidth : width;
	const offsetHeight = hasOffset ? element.offsetHeight : height;
	const shouldFallback = round(width) !== offsetWidth || round(height) !== offsetHeight;
	if (shouldFallback) {
		width = offsetWidth;
		height = offsetHeight;
	}
	return {
		width,
		height,
		$: shouldFallback
	};
}
function unwrapElement(element) {
	return !isElement(element) ? element.contextElement : element;
}
function getScale(element) {
	const domElement = unwrapElement(element);
	if (!isHTMLElement(domElement)) return createCoords(1);
	const rect = domElement.getBoundingClientRect();
	const { width, height, $ } = getCssDimensions(domElement);
	let x = ($ ? round(rect.width) : rect.width) / width;
	let y = ($ ? round(rect.height) : rect.height) / height;
	if (!x || !Number.isFinite(x)) x = 1;
	if (!y || !Number.isFinite(y)) y = 1;
	return {
		x,
		y
	};
}
const noOffsets = /* @__PURE__ */ createCoords(0);
function getVisualOffsets(element) {
	const win = getWindow(element);
	if (!isWebKit() || !win.visualViewport) return noOffsets;
	return {
		x: win.visualViewport.offsetLeft,
		y: win.visualViewport.offsetTop
	};
}
function shouldAddVisualOffsets(element, isFixed, floatingOffsetParent) {
	if (isFixed === void 0) isFixed = false;
	return !!floatingOffsetParent && isFixed && floatingOffsetParent === getWindow(element);
}
function getBoundingClientRect(element, includeScale, isFixedStrategy, offsetParent) {
	if (includeScale === void 0) includeScale = false;
	if (isFixedStrategy === void 0) isFixedStrategy = false;
	const clientRect = element.getBoundingClientRect();
	const domElement = unwrapElement(element);
	let scale = createCoords(1);
	if (includeScale) if (offsetParent) {
		if (isElement(offsetParent)) scale = getScale(offsetParent);
	} else scale = getScale(element);
	const visualOffsets = shouldAddVisualOffsets(domElement, isFixedStrategy, offsetParent) ? getVisualOffsets(domElement) : createCoords(0);
	let x = (clientRect.left + visualOffsets.x) / scale.x;
	let y = (clientRect.top + visualOffsets.y) / scale.y;
	let width = clientRect.width / scale.x;
	let height = clientRect.height / scale.y;
	if (domElement && offsetParent) {
		const win = getWindow(domElement);
		const offsetWin = isElement(offsetParent) ? getWindow(offsetParent) : offsetParent;
		let currentWin = win;
		let currentIFrame = getFrameElement(currentWin);
		while (currentIFrame && offsetWin !== currentWin) {
			const iframeScale = getScale(currentIFrame);
			const iframeRect = currentIFrame.getBoundingClientRect();
			const css = getComputedStyle$1(currentIFrame);
			const left = iframeRect.left + (currentIFrame.clientLeft + parseFloat(css.paddingLeft)) * iframeScale.x;
			const top = iframeRect.top + (currentIFrame.clientTop + parseFloat(css.paddingTop)) * iframeScale.y;
			x *= iframeScale.x;
			y *= iframeScale.y;
			width *= iframeScale.x;
			height *= iframeScale.y;
			x += left;
			y += top;
			currentWin = getWindow(currentIFrame);
			currentIFrame = getFrameElement(currentWin);
		}
	}
	return rectToClientRect({
		width,
		height,
		x,
		y
	});
}
function getWindowScrollBarX(element, rect) {
	const leftScroll = getNodeScroll(element).scrollLeft;
	if (!rect) return getBoundingClientRect(getDocumentElement(element)).left + leftScroll;
	return rect.left + leftScroll;
}
function getHTMLOffset(documentElement, scroll) {
	const htmlRect = documentElement.getBoundingClientRect();
	return {
		x: htmlRect.left + scroll.scrollLeft - getWindowScrollBarX(documentElement, htmlRect),
		y: htmlRect.top + scroll.scrollTop
	};
}
function convertOffsetParentRelativeRectToViewportRelativeRect(_ref) {
	let { elements, rect, offsetParent, strategy } = _ref;
	const isFixed = strategy === "fixed";
	const documentElement = getDocumentElement(offsetParent);
	const topLayer = elements ? isTopLayer(elements.floating) : false;
	if (offsetParent === documentElement || topLayer && isFixed) return rect;
	let scroll = {
		scrollLeft: 0,
		scrollTop: 0
	};
	let scale = createCoords(1);
	const offsets = createCoords(0);
	const isOffsetParentAnElement = isHTMLElement(offsetParent);
	if (isOffsetParentAnElement || !isFixed) {
		if (getNodeName(offsetParent) !== "body" || isOverflowElement(documentElement)) scroll = getNodeScroll(offsetParent);
		if (isOffsetParentAnElement) {
			const offsetRect = getBoundingClientRect(offsetParent);
			scale = getScale(offsetParent);
			offsets.x = offsetRect.x + offsetParent.clientLeft;
			offsets.y = offsetRect.y + offsetParent.clientTop;
		}
	}
	const htmlOffset = documentElement && !isOffsetParentAnElement && !isFixed ? getHTMLOffset(documentElement, scroll) : createCoords(0);
	return {
		width: rect.width * scale.x,
		height: rect.height * scale.y,
		x: rect.x * scale.x - scroll.scrollLeft * scale.x + offsets.x + htmlOffset.x,
		y: rect.y * scale.y - scroll.scrollTop * scale.y + offsets.y + htmlOffset.y
	};
}
function getClientRects(element) {
	return element.getClientRects ? Array.from(element.getClientRects()) : [];
}
function getDocumentRect(html) {
	const scroll = getNodeScroll(html);
	const body = html.ownerDocument.body;
	const width = max(html.scrollWidth, html.clientWidth, body.scrollWidth, body.clientWidth);
	const height = max(html.scrollHeight, html.clientHeight, body.scrollHeight, body.clientHeight);
	let x = -scroll.scrollLeft + getWindowScrollBarX(html);
	const y = -scroll.scrollTop;
	if (getComputedStyle$1(body).direction === "rtl") x += max(html.clientWidth, body.clientWidth) - width;
	return {
		width,
		height,
		x,
		y
	};
}
const SCROLLBAR_MAX = 25;
function getViewportRect(element, strategy, rootBoundary) {
	if (rootBoundary === void 0) rootBoundary = "viewport";
	const isLayoutViewport = rootBoundary === "layoutViewport";
	const win = getWindow(element);
	const html = getDocumentElement(element);
	const visualViewport = win.visualViewport;
	let width = html.clientWidth;
	let height = html.clientHeight;
	let x = 0;
	let y = 0;
	if (visualViewport) {
		const layoutRelativeClientCoords = !isWebKit() || strategy === "fixed";
		if (isLayoutViewport) {
			if (!layoutRelativeClientCoords) {
				x = -visualViewport.offsetLeft;
				y = -visualViewport.offsetTop;
			}
		} else {
			width = visualViewport.width;
			height = visualViewport.height;
			if (layoutRelativeClientCoords) {
				x = visualViewport.offsetLeft;
				y = visualViewport.offsetTop;
			}
		}
	}
	if (getWindowScrollBarX(html) <= 0) {
		const doc = html.ownerDocument;
		const body = doc.body;
		const bodyStyles = getComputedStyle(body);
		const bodyMarginInline = doc.compatMode === "CSS1Compat" ? parseFloat(bodyStyles.marginLeft) + parseFloat(bodyStyles.marginRight) || 0 : 0;
		const reservedWidth = Math.abs(html.clientWidth - body.clientWidth - bodyMarginInline);
		const gutter = getComputedStyle(html).scrollbarGutter === "stable both-edges" ? reservedWidth / 2 : reservedWidth;
		if (gutter <= SCROLLBAR_MAX) width -= gutter;
	}
	return {
		width,
		height,
		x,
		y
	};
}
function getInnerBoundingClientRect(element, strategy) {
	const clientRect = getBoundingClientRect(element, true, strategy === "fixed");
	const top = clientRect.top + element.clientTop;
	const left = clientRect.left + element.clientLeft;
	const scale = getScale(element);
	return {
		width: element.clientWidth * scale.x,
		height: element.clientHeight * scale.y,
		x: left * scale.x,
		y: top * scale.y
	};
}
function getClientRectFromClippingAncestor(element, clippingAncestor, strategy) {
	let rect;
	if (clippingAncestor === "viewport" || clippingAncestor === "layoutViewport") rect = getViewportRect(element, strategy, clippingAncestor);
	else if (clippingAncestor === "document") rect = getDocumentRect(getDocumentElement(element));
	else if (isElement(clippingAncestor)) rect = getInnerBoundingClientRect(clippingAncestor, strategy);
	else {
		const visualOffsets = getVisualOffsets(element);
		rect = {
			x: clippingAncestor.x - visualOffsets.x,
			y: clippingAncestor.y - visualOffsets.y,
			width: clippingAncestor.width,
			height: clippingAncestor.height
		};
	}
	return rectToClientRect(rect);
}
function getClippingElementAncestors(element, cache) {
	const cachedResult = cache.get(element);
	if (cachedResult) return cachedResult;
	let result = getOverflowAncestors(element, [], false).filter((el) => isElement(el) && getNodeName(el) !== "body");
	let lastKeptComputedStyle = null;
	const elementIsFixed = getComputedStyle$1(element).position === "fixed";
	let currentNode = elementIsFixed ? getParentNode(element) : element;
	while (isElement(currentNode) && !isLastTraversableNode(currentNode)) {
		const computedStyle = getComputedStyle$1(currentNode);
		const currentNodeIsContaining = isContainingBlock(currentNode);
		const lastPosition = lastKeptComputedStyle ? lastKeptComputedStyle.position : elementIsFixed ? "fixed" : "";
		if (!currentNodeIsContaining && (lastPosition === "fixed" || lastPosition === "absolute" && computedStyle.position === "static")) result = result.filter((ancestor) => ancestor !== currentNode);
		else lastKeptComputedStyle = computedStyle;
		currentNode = getParentNode(currentNode);
	}
	cache.set(element, result);
	return result;
}
function getClippingRect(_ref) {
	let { element, boundary, rootBoundary, strategy } = _ref;
	const clippingAncestors = [...boundary === "clippingAncestors" ? isTopLayer(element) ? [] : getClippingElementAncestors(element, this._c) : [].concat(boundary), rootBoundary];
	const firstRect = getClientRectFromClippingAncestor(element, clippingAncestors[0], strategy);
	let top = firstRect.top;
	let right = firstRect.right;
	let bottom = firstRect.bottom;
	let left = firstRect.left;
	for (let i = 1; i < clippingAncestors.length; i++) {
		const rect = getClientRectFromClippingAncestor(element, clippingAncestors[i], strategy);
		top = max(rect.top, top);
		right = min(rect.right, right);
		bottom = min(rect.bottom, bottom);
		left = max(rect.left, left);
	}
	return {
		width: right - left,
		height: bottom - top,
		x: left,
		y: top
	};
}
function getDimensions(element) {
	const { width, height } = getCssDimensions(element);
	return {
		width,
		height
	};
}
function getRectRelativeToOffsetParent(element, offsetParent, strategy) {
	const isOffsetParentAnElement = isHTMLElement(offsetParent);
	const documentElement = getDocumentElement(offsetParent);
	const isFixed = strategy === "fixed";
	const rect = getBoundingClientRect(element, true, isFixed, offsetParent);
	let scroll = {
		scrollLeft: 0,
		scrollTop: 0
	};
	const offsets = createCoords(0);
	if (isOffsetParentAnElement || !isFixed) {
		if (getNodeName(offsetParent) !== "body" || isOverflowElement(documentElement)) scroll = getNodeScroll(offsetParent);
		if (isOffsetParentAnElement) {
			const offsetRect = getBoundingClientRect(offsetParent, true, isFixed, offsetParent);
			offsets.x = offsetRect.x + offsetParent.clientLeft;
			offsets.y = offsetRect.y + offsetParent.clientTop;
		}
	}
	if (!isOffsetParentAnElement && documentElement) offsets.x = getWindowScrollBarX(documentElement);
	const htmlOffset = documentElement && !isOffsetParentAnElement && !isFixed ? getHTMLOffset(documentElement, scroll) : createCoords(0);
	return {
		x: rect.left + scroll.scrollLeft - offsets.x - htmlOffset.x,
		y: rect.top + scroll.scrollTop - offsets.y - htmlOffset.y,
		width: rect.width,
		height: rect.height
	};
}
function isStaticPositioned(element) {
	return getComputedStyle$1(element).position === "static";
}
function getTrueOffsetParent(element, polyfill) {
	if (!isHTMLElement(element) || getComputedStyle$1(element).position === "fixed") return null;
	if (polyfill) return polyfill(element);
	let rawOffsetParent = element.offsetParent;
	if (getDocumentElement(element) === rawOffsetParent) rawOffsetParent = rawOffsetParent.ownerDocument.body;
	return rawOffsetParent;
}
function getOffsetParent(element, polyfill) {
	const win = getWindow(element);
	if (isTopLayer(element)) return win;
	if (!isHTMLElement(element)) {
		let svgOffsetParent = getParentNode(element);
		while (svgOffsetParent && !isLastTraversableNode(svgOffsetParent)) {
			if (isElement(svgOffsetParent) && !isStaticPositioned(svgOffsetParent)) return svgOffsetParent;
			svgOffsetParent = getParentNode(svgOffsetParent);
		}
		return win;
	}
	let offsetParent = getTrueOffsetParent(element, polyfill);
	while (offsetParent && isTableElement(offsetParent) && isStaticPositioned(offsetParent)) offsetParent = getTrueOffsetParent(offsetParent, polyfill);
	if (offsetParent && isLastTraversableNode(offsetParent) && isStaticPositioned(offsetParent) && !isContainingBlock(offsetParent)) return win;
	return offsetParent || getContainingBlock(element) || win;
}
const getElementRects = async function(data) {
	const getOffsetParentFn = this.getOffsetParent || getOffsetParent;
	const getDimensionsFn = this.getDimensions;
	const floatingDimensions = await getDimensionsFn(data.floating);
	return {
		reference: getRectRelativeToOffsetParent(data.reference, await getOffsetParentFn(data.floating), data.strategy),
		floating: {
			x: 0,
			y: 0,
			width: floatingDimensions.width,
			height: floatingDimensions.height
		}
	};
};
function isRTL(element) {
	return getComputedStyle$1(element).direction === "rtl";
}
const platform = {
	convertOffsetParentRelativeRectToViewportRelativeRect,
	getDocumentElement,
	getClippingRect,
	getOffsetParent,
	getElementRects,
	getClientRects,
	getDimensions,
	getScale,
	isElement,
	isRTL
};
function rectsAreEqual(a, b) {
	return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}
function observeMove(element, onMove, ancestorResize) {
	let io = null;
	let timeoutId;
	const root = getDocumentElement(element);
	function cleanup() {
		var _io;
		clearTimeout(timeoutId);
		(_io = io) == null || _io.disconnect();
		io = null;
	}
	function refresh$1(skip, threshold) {
		if (skip === void 0) skip = false;
		if (threshold === void 0) threshold = 1;
		cleanup();
		const elementRectForRootMargin = element.getBoundingClientRect();
		const { left, top, width, height } = elementRectForRootMargin;
		if (!skip) onMove();
		if (!width || !height) return;
		const insetTop = floor(top);
		const insetRight = floor(root.clientWidth - (left + width));
		const insetBottom = floor(root.clientHeight - (top + height));
		const insetLeft = floor(left);
		const options = {
			rootMargin: -insetTop + "px " + -insetRight + "px " + -insetBottom + "px " + -insetLeft + "px",
			threshold: max(0, min(1, threshold)) || 1
		};
		let isFirstUpdate = true;
		function handleObserve(entries) {
			const ratio = entries[0].intersectionRatio;
			if (!rectsAreEqual(elementRectForRootMargin, element.getBoundingClientRect())) return refresh$1();
			if (ratio !== threshold) {
				if (!isFirstUpdate) return refresh$1();
				if (!ratio) timeoutId = setTimeout(() => {
					refresh$1(false, 1e-7);
				}, 1e3);
				else refresh$1(false, ratio);
			}
			isFirstUpdate = false;
		}
		try {
			io = new IntersectionObserver(handleObserve, {
				...options,
				root: root.ownerDocument
			});
		} catch (_e) {
			io = new IntersectionObserver(handleObserve, options);
		}
		io.observe(element);
	}
	const win = getWindow(element);
	const handleResize = () => refresh$1(ancestorResize);
	win.addEventListener("resize", handleResize);
	refresh$1(true);
	return () => {
		win.removeEventListener("resize", handleResize);
		cleanup();
	};
}
/**
* Automatically updates the position of the floating element when necessary.
* Should only be called when the floating element is mounted on the DOM or
* visible on the screen.
* @returns cleanup function that should be invoked when the floating element is
* removed from the DOM or hidden from the screen.
* @see https://floating-ui.com/docs/autoUpdate
*/
function autoUpdate(reference, floating, update$1, options) {
	if (options === void 0) options = {};
	const { ancestorScroll = true, ancestorResize = true, elementResize = typeof ResizeObserver === "function", layoutShift = typeof IntersectionObserver === "function", animationFrame = false } = options;
	const referenceEl = unwrapElement(reference);
	const ancestors = ancestorScroll || ancestorResize ? [...referenceEl ? getOverflowAncestors(referenceEl) : [], ...floating ? getOverflowAncestors(floating) : []] : [];
	ancestors.forEach((ancestor) => {
		ancestorScroll && ancestor.addEventListener("scroll", update$1);
		ancestorResize && ancestor.addEventListener("resize", update$1);
	});
	const cleanupIo = referenceEl && layoutShift ? observeMove(referenceEl, update$1, ancestorResize) : null;
	let reobserveFrame = -1;
	let resizeObserver = null;
	if (elementResize) {
		resizeObserver = new ResizeObserver((_ref) => {
			let [firstEntry] = _ref;
			if (firstEntry && firstEntry.target === referenceEl && resizeObserver && floating) {
				resizeObserver.unobserve(floating);
				cancelAnimationFrame(reobserveFrame);
				reobserveFrame = requestAnimationFrame(() => {
					var _resizeObserver;
					(_resizeObserver = resizeObserver) == null || _resizeObserver.observe(floating);
				});
			}
			update$1();
		});
		if (referenceEl && !animationFrame) resizeObserver.observe(referenceEl);
		if (floating) resizeObserver.observe(floating);
	}
	let frameId;
	let prevRefRect = animationFrame ? getBoundingClientRect(reference) : null;
	if (animationFrame) frameLoop();
	function frameLoop() {
		const nextRefRect = getBoundingClientRect(reference);
		if (prevRefRect && !rectsAreEqual(prevRefRect, nextRefRect)) update$1();
		prevRefRect = nextRefRect;
		frameId = requestAnimationFrame(frameLoop);
	}
	update$1();
	return () => {
		var _resizeObserver2;
		ancestors.forEach((ancestor) => {
			ancestorScroll && ancestor.removeEventListener("scroll", update$1);
			ancestorResize && ancestor.removeEventListener("resize", update$1);
		});
		cleanupIo?.();
		(_resizeObserver2 = resizeObserver) == null || _resizeObserver2.disconnect();
		resizeObserver = null;
		if (animationFrame) cancelAnimationFrame(frameId);
	};
}
/**
* Modifies the placement by translating the floating element along the
* specified axes.
* A number (shorthand for `mainAxis` or distance), or an axes configuration
* object may be passed.
* @see https://floating-ui.com/docs/offset
*/
const offset$1 = offset$2;
/**
* Optimizes the visibility of the floating element by shifting it in order to
* keep it in view when it will overflow the clipping boundary.
* @see https://floating-ui.com/docs/shift
*/
const shift$1 = shift$2;
/**
* Optimizes the visibility of the floating element by flipping the `placement`
* in order to keep it in view when the preferred placement(s) will overflow the
* clipping boundary. Alternative to `autoPlacement`.
* @see https://floating-ui.com/docs/flip
*/
const flip$1 = flip$2;
/**
* Provides data that allows you to change the size of the floating element —
* for instance, prevent it from overflowing the clipping boundary or match the
* width of the reference element.
* @see https://floating-ui.com/docs/size
*/
const size$1 = size$2;
/**
* Built-in `limiter` that will stop `shift()` at a certain point.
*/
const limitShift$1 = limitShift$2;
/**
* Computes the `x` and `y` coordinates that will place the floating element
* next to a given reference element.
*/
const computePosition = (reference, floating, options) => {
	const cache = /* @__PURE__ */ new Map();
	const mergedOptions = options != null ? options : {};
	const platformWithCache = {
		...platform,
		...mergedOptions.platform,
		_c: cache
	};
	return computePosition$1(reference, floating, {
		...mergedOptions,
		platform: platformWithCache
	});
};

//#endregion
//#region node_modules/.pnpm/@floating-ui+react-dom@2.1._fada47ca3a4ccde8c4809a626646ce48/node_modules/@floating-ui/react-dom/dist/floating-ui.react-dom.mjs
var index = typeof document !== "undefined" ? react.useLayoutEffect : function noop$1() {};
function deepEqual(a, b) {
	if (a === b) return true;
	if (typeof a !== typeof b) return false;
	if (typeof a === "function" && a.toString() === b.toString()) return true;
	let length;
	let i;
	let keys;
	if (a && b && typeof a === "object") {
		if (Array.isArray(a)) {
			length = a.length;
			if (length !== b.length) return false;
			for (i = length; i-- !== 0;) if (!deepEqual(a[i], b[i])) return false;
			return true;
		}
		keys = Object.keys(a);
		length = keys.length;
		if (length !== Object.keys(b).length) return false;
		for (i = length; i-- !== 0;) if (!{}.hasOwnProperty.call(b, keys[i])) return false;
		for (i = length; i-- !== 0;) {
			const key = keys[i];
			if (key === "_owner" && a.$$typeof) continue;
			if (!deepEqual(a[key], b[key])) return false;
		}
		return true;
	}
	return a !== a && b !== b;
}
function getDPR(element) {
	if (typeof window === "undefined") return 1;
	return (element.ownerDocument.defaultView || window).devicePixelRatio || 1;
}
function roundByDPR(element, value) {
	const dpr = getDPR(element);
	return Math.round(value * dpr) / dpr;
}
function useLatestRef(value) {
	const ref = react.useRef(value);
	index(() => {
		ref.current = value;
	});
	return ref;
}
/**
* Provides data to position a floating element.
* @see https://floating-ui.com/docs/useFloating
*/
function useFloating(options) {
	if (options === void 0) options = {};
	const { placement = "bottom", strategy = "absolute", middleware = [], platform: platform$2, elements: { reference: externalReference, floating: externalFloating } = {}, transform = true, whileElementsMounted, open } = options;
	const [data, setData] = react.useState({
		x: 0,
		y: 0,
		strategy,
		placement,
		middlewareData: {},
		isPositioned: false
	});
	const [latestMiddleware, setLatestMiddleware] = react.useState(middleware);
	if (!deepEqual(latestMiddleware, middleware)) setLatestMiddleware(middleware);
	const [_reference, _setReference] = react.useState(null);
	const [_floating, _setFloating] = react.useState(null);
	const setReference = react.useCallback((node) => {
		if (node !== referenceRef.current) {
			referenceRef.current = node;
			_setReference(node);
		}
	}, []);
	const setFloating = react.useCallback((node) => {
		if (node !== floatingRef.current) {
			floatingRef.current = node;
			_setFloating(node);
		}
	}, []);
	const referenceEl = externalReference || _reference;
	const floatingEl = externalFloating || _floating;
	const referenceRef = react.useRef(null);
	const floatingRef = react.useRef(null);
	const dataRef = react.useRef(data);
	const hasWhileElementsMounted = whileElementsMounted != null;
	const whileElementsMountedRef = useLatestRef(whileElementsMounted);
	const platformRef = useLatestRef(platform$2);
	const openRef = useLatestRef(open);
	const update$1 = react.useCallback(() => {
		if (!referenceRef.current || !floatingRef.current) return;
		const config = {
			placement,
			strategy,
			middleware: latestMiddleware
		};
		if (platformRef.current) config.platform = platformRef.current;
		computePosition(referenceRef.current, floatingRef.current, config).then((data$1) => {
			const fullData = {
				...data$1,
				isPositioned: openRef.current !== false
			};
			if (isMountedRef.current && !deepEqual(dataRef.current, fullData)) {
				dataRef.current = fullData;
				react_dom.flushSync(() => {
					setData(fullData);
				});
			}
		});
	}, [
		latestMiddleware,
		placement,
		strategy,
		platformRef,
		openRef
	]);
	index(() => {
		if (open === false && dataRef.current.isPositioned) {
			dataRef.current.isPositioned = false;
			setData((data$1) => ({
				...data$1,
				isPositioned: false
			}));
		}
	}, [open]);
	const isMountedRef = react.useRef(false);
	index(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
		};
	}, []);
	index(() => {
		if (referenceEl) referenceRef.current = referenceEl;
		if (floatingEl) floatingRef.current = floatingEl;
		if (referenceEl && floatingEl) {
			if (whileElementsMountedRef.current) return whileElementsMountedRef.current(referenceEl, floatingEl, update$1);
			update$1();
		}
	}, [
		referenceEl,
		floatingEl,
		update$1,
		whileElementsMountedRef,
		hasWhileElementsMounted
	]);
	const refs = react.useMemo(() => ({
		reference: referenceRef,
		floating: floatingRef,
		setReference,
		setFloating
	}), [setReference, setFloating]);
	const elements = react.useMemo(() => ({
		reference: referenceEl,
		floating: floatingEl
	}), [referenceEl, floatingEl]);
	const floatingStyles = react.useMemo(() => {
		const initialStyles = {
			position: strategy,
			left: 0,
			top: 0
		};
		if (!elements.floating) return initialStyles;
		const x = roundByDPR(elements.floating, data.x);
		const y = roundByDPR(elements.floating, data.y);
		if (transform) return {
			...initialStyles,
			transform: "translate(" + x + "px, " + y + "px)",
			...getDPR(elements.floating) >= 1.5 && { willChange: "transform" }
		};
		return {
			position: strategy,
			left: x,
			top: y
		};
	}, [
		strategy,
		transform,
		elements.floating,
		data.x,
		data.y
	]);
	return react.useMemo(() => ({
		...data,
		update: update$1,
		refs,
		elements,
		floatingStyles
	}), [
		data,
		update$1,
		refs,
		elements,
		floatingStyles
	]);
}
/**
* Modifies the placement by translating the floating element along the
* specified axes.
* A number (shorthand for `mainAxis` or distance), or an axes configuration
* object may be passed.
* @see https://floating-ui.com/docs/offset
*/
const offset = (options, deps) => {
	const result = offset$1(options);
	return {
		name: result.name,
		fn: result.fn,
		options: [options, deps]
	};
};
/**
* Optimizes the visibility of the floating element by shifting it in order to
* keep it in view when it will overflow the clipping boundary.
* @see https://floating-ui.com/docs/shift
*/
const shift = (options, deps) => {
	const result = shift$1(options);
	return {
		name: result.name,
		fn: result.fn,
		options: [options, deps]
	};
};
/**
* Built-in `limiter` that will stop `shift()` at a certain point.
*/
const limitShift = (options, deps) => {
	return {
		fn: limitShift$1(options).fn,
		options: [options, deps]
	};
};
/**
* Optimizes the visibility of the floating element by flipping the `placement`
* in order to keep it in view when the preferred placement(s) will overflow the
* clipping boundary. Alternative to `autoPlacement`.
* @see https://floating-ui.com/docs/flip
*/
const flip = (options, deps) => {
	const result = flip$1(options);
	return {
		name: result.name,
		fn: result.fn,
		options: [options, deps]
	};
};
/**
* Provides data that allows you to change the size of the floating element —
* for instance, prevent it from overflowing the clipping boundary or match the
* width of the reference element.
* @see https://floating-ui.com/docs/size
*/
const size = (options, deps) => {
	const result = size$1(options);
	return {
		name: result.name,
		fn: result.fn,
		options: [options, deps]
	};
};

//#endregion
//#region node_modules/.pnpm/use-sync-external-store@1.6.0_react@18.3.1/node_modules/use-sync-external-store/cjs/use-sync-external-store-shim/with-selector.production.js
var require_with_selector_production = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/use-sync-external-store@1.6.0_react@18.3.1/node_modules/use-sync-external-store/cjs/use-sync-external-store-shim/with-selector.production.js": ((exports) => {
	var React = require("react"), shim = require_shim();
	function is(x, y) {
		return x === y && (0 !== x || 1 / x === 1 / y) || x !== x && y !== y;
	}
	var objectIs = "function" === typeof Object.is ? Object.is : is, useSyncExternalStore$2 = shim.useSyncExternalStore, useRef = React.useRef, useEffect = React.useEffect, useMemo = React.useMemo, useDebugValue = React.useDebugValue;
	exports.useSyncExternalStoreWithSelector = function(subscribe$1, getSnapshot$1, getServerSnapshot, selector, isEqual) {
		var instRef = useRef(null);
		if (null === instRef.current) {
			var inst = {
				hasValue: !1,
				value: null
			};
			instRef.current = inst;
		} else inst = instRef.current;
		instRef = useMemo(function() {
			function memoizedSelector(nextSnapshot) {
				if (!hasMemo) {
					hasMemo = !0;
					memoizedSnapshot = nextSnapshot;
					nextSnapshot = selector(nextSnapshot);
					if (void 0 !== isEqual && inst.hasValue) {
						var currentSelection = inst.value;
						if (isEqual(currentSelection, nextSnapshot)) return memoizedSelection = currentSelection;
					}
					return memoizedSelection = nextSnapshot;
				}
				currentSelection = memoizedSelection;
				if (objectIs(memoizedSnapshot, nextSnapshot)) return currentSelection;
				var nextSelection = selector(nextSnapshot);
				if (void 0 !== isEqual && isEqual(currentSelection, nextSelection)) return memoizedSnapshot = nextSnapshot, currentSelection;
				memoizedSnapshot = nextSnapshot;
				return memoizedSelection = nextSelection;
			}
			var hasMemo = !1, memoizedSnapshot, memoizedSelection, maybeGetServerSnapshot = void 0 === getServerSnapshot ? null : getServerSnapshot;
			return [function() {
				return memoizedSelector(getSnapshot$1());
			}, null === maybeGetServerSnapshot ? void 0 : function() {
				return memoizedSelector(maybeGetServerSnapshot());
			}];
		}, [
			getSnapshot$1,
			getServerSnapshot,
			selector,
			isEqual
		]);
		var value = useSyncExternalStore$2(subscribe$1, instRef[0], instRef[1]);
		useEffect(function() {
			inst.hasValue = !0;
			inst.value = value;
		}, [value]);
		useDebugValue(value);
		return value;
	};
}) });

//#endregion
//#region node_modules/.pnpm/use-sync-external-store@1.6.0_react@18.3.1/node_modules/use-sync-external-store/shim/with-selector.js
var require_with_selector = /* @__PURE__ */ __commonJS({ "node_modules/.pnpm/use-sync-external-store@1.6.0_react@18.3.1/node_modules/use-sync-external-store/shim/with-selector.js": ((exports, module) => {
	module.exports = require_with_selector_production();
}) });

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/fastHooks.mjs
const hooks = [];
let currentInstance = void 0;
function getInstance() {
	return currentInstance;
}
function register(hook) {
	hooks.push(hook);
}

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/store/useStore.mjs
var import_shim$1 = /* @__PURE__ */ __toESM(require_shim(), 1);
var import_with_selector = /* @__PURE__ */ __toESM(require_with_selector(), 1);
const useStoreImplementation = isReactVersionAtLeast(19) ? useStoreFast : useStoreLegacy;
function useStore(store$2, selector, a1, a2, a3) {
	return useStoreImplementation(store$2, selector, a1, a2, a3);
}
function useStoreR19(store$2, selector, a1, a2, a3) {
	const getSelection = react.useCallback(() => selector(store$2.getSnapshot(), a1, a2, a3), [
		store$2,
		selector,
		a1,
		a2,
		a3
	]);
	return (0, import_shim$1.useSyncExternalStore)(store$2.subscribe, getSelection, getSelection);
}
register({
	before(instance) {
		instance.syncIndex = 0;
		if (!instance.didInitialize) {
			instance.syncTick = 1;
			instance.syncHooks = [];
			instance.didChangeStore = true;
			instance.getSnapshot = () => {
				let didChange$1 = false;
				for (let i = 0; i < instance.syncHooks.length; i += 1) {
					const hook = instance.syncHooks[i];
					const value = hook.selector(hook.store.state, hook.a1, hook.a2, hook.a3);
					if (!Object.is(hook.value, value)) {
						didChange$1 = true;
						hook.value = value;
					}
				}
				if (didChange$1) instance.syncTick += 1;
				return instance.syncTick;
			};
		}
	},
	after(instance) {
		if (instance.syncHooks.length > 0) {
			if (instance.didChangeStore) {
				instance.didChangeStore = false;
				instance.subscribe = (onStoreChange) => {
					const stores = /* @__PURE__ */ new Set();
					for (const hook of instance.syncHooks) stores.add(hook.store);
					const unsubscribes = [];
					for (const store$2 of stores) unsubscribes.push(store$2.subscribe(onStoreChange));
					return () => {
						for (const unsubscribe of unsubscribes) unsubscribe();
					};
				};
			}
			(0, import_shim$1.useSyncExternalStore)(instance.subscribe, instance.getSnapshot, instance.getSnapshot);
		}
	}
});
function useStoreFast(store$2, selector, a1, a2, a3) {
	const instance = getInstance();
	if (!instance) return useStoreR19(store$2, selector, a1, a2, a3);
	const index$1 = instance.syncIndex;
	instance.syncIndex += 1;
	let hook;
	if (!instance.didInitialize) {
		hook = {
			store: store$2,
			selector,
			a1,
			a2,
			a3,
			value: selector(store$2.getSnapshot(), a1, a2, a3)
		};
		instance.syncHooks.push(hook);
	} else {
		hook = instance.syncHooks[index$1];
		if (hook.store !== store$2 || hook.selector !== selector || !Object.is(hook.a1, a1) || !Object.is(hook.a2, a2) || !Object.is(hook.a3, a3)) {
			if (hook.store !== store$2) instance.didChangeStore = true;
			hook.store = store$2;
			hook.selector = selector;
			hook.a1 = a1;
			hook.a2 = a2;
			hook.a3 = a3;
			hook.value = selector(store$2.getSnapshot(), a1, a2, a3);
		}
	}
	return hook.value;
}
function useStoreLegacy(store$2, selector, a1, a2, a3) {
	return (0, import_with_selector.useSyncExternalStoreWithSelector)(store$2.subscribe, store$2.getSnapshot, store$2.getSnapshot, (state) => selector(state, a1, a2, a3));
}

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/store/Store.mjs
/**
* A data store implementation that allows subscribing to state changes and updating the state.
* It uses an observer pattern to notify subscribers when the state changes.
*/
var Store = class {
	/**
	* The current state of the store.
	* This property is updated immediately when the state changes as a result of calling {@link setState}, {@link update}, or {@link set}.
	* To subscribe to state changes, use the {@link useState} method. The value returned by {@link useState} is updated after the component renders (similarly to React's useState).
	* The values can be used directly (to avoid subscribing to the store) in effects or event handlers.
	*
	* Do not modify properties in state directly. Instead, use the provided methods to ensure proper state management and listener notification.
	*/
	constructor(state) {
		this.state = state;
		this.listeners = /* @__PURE__ */ new Set();
		this.updateTick = 0;
	}
	/**
	* Registers a listener that will be called whenever the store's state changes.
	*
	* @param fn The listener function to be called on state changes.
	* @returns A function to unsubscribe the listener.
	*/
	subscribe = (fn) => {
		this.listeners.add(fn);
		return () => {
			this.listeners.delete(fn);
		};
	};
	/**
	* Returns the current state of the store.
	*/
	getSnapshot = () => {
		return this.state;
	};
	/**
	* Updates the entire store's state and notifies all registered listeners.
	*
	* @param newState The new state to set for the store.
	*/
	setState(newState) {
		if (this.state === newState) return;
		this.state = newState;
		this.updateTick += 1;
		const currentTick = this.updateTick;
		for (const listener of this.listeners) {
			if (currentTick !== this.updateTick) return;
			listener(newState);
		}
	}
	/**
	* Merges the provided changes into the current state and notifies listeners if there are changes.
	*
	* @param changes An object containing the changes to apply to the current state.
	*/
	update(changes) {
		for (const key in changes) if (!Object.is(this.state[key], changes[key])) {
			this.setState({
				...this.state,
				...changes
			});
			return;
		}
	}
	/**
	* Sets a specific key in the store's state to a new value and notifies listeners if the value has changed.
	*
	* @param key The key in the store's state to update.
	* @param value The new value to set for the specified key.
	*/
	set(key, value) {
		if (!Object.is(this.state[key], value)) this.setState({
			...this.state,
			[key]: value
		});
	}
	/**
	* Gives the state a new reference and updates all registered listeners.
	*/
	notifyAll() {
		const newState = { ...this.state };
		this.setState(newState);
	}
	use(selector, a1, a2, a3) {
		return useStore(this, selector, a1, a2, a3);
	}
};

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/store/ReactStore.mjs
/**
* A Store that supports controlled state keys, non-reactive values and provides utility methods for React.
*/
var ReactStore = class extends Store {
	/**
	* Creates a new ReactStore instance.
	*
	* @param state Initial state of the store.
	* @param context Non-reactive context values.
	* @param selectors Optional selectors for use with `useState`.
	*/
	constructor(state, context = {}, selectors$2) {
		super(state);
		this.context = context;
		this.selectors = selectors$2;
	}
	/**
	* Non-reactive values such as refs, callbacks, etc.
	*/
	/**
	* Synchronizes a single external value into the store.
	*
	* Note that the while the value in `state` is updated immediately, the value returned
	* by `useState` is updated before the next render (similarly to React's `useState`).
	*/
	useSyncedValue(key, value) {
		react.useDebugValue(key);
		const store$2 = this;
		useIsoLayoutEffect(() => {
			if (store$2.state[key] !== value) store$2.set(key, value);
		}, [
			store$2,
			key,
			value
		]);
	}
	/**
	* Synchronizes a single external value into the store and
	* cleans it up (sets to `undefined`) on unmount.
	*
	* Note that the while the value in `state` is updated immediately, the value returned
	* by `useState` is updated before the next render (similarly to React's `useState`).
	*/
	useSyncedValueWithCleanup(key, value) {
		const store$2 = this;
		useIsoLayoutEffect(() => {
			if (store$2.state[key] !== value) store$2.set(key, value);
			return () => {
				store$2.set(key, void 0);
			};
		}, [
			store$2,
			key,
			value
		]);
	}
	/**
	* Synchronizes multiple external values into the store.
	*
	* Note that the while the values in `state` are updated immediately, the values returned
	* by `useState` are updated before the next render (similarly to React's `useState`).
	*/
	useSyncedValues(statePart) {
		const store$2 = this;
		useIsoLayoutEffect(() => {
			store$2.update(statePart);
		}, [store$2, ...Object.values(statePart)]);
	}
	/**
	* Registers a controllable prop pair (`controlled`, `defaultValue`) for a specific key. If `controlled`
	* is non-undefined, the store's state at `key` is updated to match `controlled`.
	*/
	useControlledProp(key, controlled) {
		react.useDebugValue(key);
		const store$2 = this;
		const isControlled = controlled !== void 0;
		useIsoLayoutEffect(() => {
			if (isControlled && !Object.is(store$2.state[key], controlled)) store$2.setState({
				...store$2.state,
				[key]: controlled
			});
		}, [
			store$2,
			key,
			controlled,
			isControlled
		]);
	}
	/** Gets the current value from the store using a selector with the provided key.
	*
	* @param key Key of the selector to use.
	*/
	select(key, a1, a2, a3) {
		const selector = this.selectors[key];
		return selector(this.state, a1, a2, a3);
	}
	/**
	* Returns a value from the store's state using a selector function.
	* Used to subscribe to specific parts of the state.
	* This methods causes a rerender whenever the selected state changes.
	*
	* @param key Key of the selector to use.
	*/
	useState(key, a1, a2, a3) {
		react.useDebugValue(key);
		return useStore(this, this.selectors[key], a1, a2, a3);
	}
	/**
	* Wraps a function with `useStableCallback` to ensure it has a stable reference
	* and assigns it to the context.
	*
	* @param key Key of the event callback. Must be a function in the context.
	* @param fn Function to assign.
	*/
	useContextCallback(key, fn) {
		react.useDebugValue(key);
		const stableFunction = useStableCallback(fn ?? NOOP);
		this.context[key] = stableFunction;
	}
	/**
	* Returns a stable setter function for a specific key in the store's state.
	* It's commonly used to pass as a ref callback to React elements.
	*
	* @param key Key of the state to set.
	*/
	useStateSetter(key) {
		const ref = react.useRef(void 0);
		if (ref.current === void 0) ref.current = (value) => {
			this.set(key, value);
		};
		return ref.current;
	}
	/**
	* Observes changes derived from the store's selectors and calls the listener when the selected value changes.
	*
	* @param key Key of the selector to observe.
	* @param listener Listener function called when the selector result changes.
	*/
	observe(selector, listener) {
		let selectFn;
		if (typeof selector === "function") selectFn = selector;
		else selectFn = this.selectors[selector];
		let prevValue = selectFn(this.state);
		listener(prevValue, prevValue, this);
		return this.subscribe((nextState) => {
			const nextValue = selectFn(nextState);
			if (!Object.is(prevValue, nextValue)) {
				const oldValue = prevValue;
				prevValue = nextValue;
				listener(nextValue, oldValue, this);
			}
		});
	}
};

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/floating-ui-react/components/FloatingRootStore.mjs
const selectors$1 = {
	open: (state) => state.open,
	transitionStatus: (state) => state.transitionStatus,
	domReferenceElement: (state) => state.domReferenceElement,
	referenceElement: (state) => state.positionReference ?? state.referenceElement,
	floatingElement: (state) => state.floatingElement,
	floatingId: (state) => state.floatingId
};
var FloatingRootStore = class extends ReactStore {
	constructor(options) {
		const { syncOnly, nested, onOpenChange, triggerElements,...initialState } = options;
		super({
			...initialState,
			positionReference: initialState.referenceElement,
			domReferenceElement: initialState.referenceElement
		}, {
			onOpenChange,
			dataRef: { current: {} },
			events: createEventEmitter(),
			nested,
			triggerElements
		}, selectors$1);
		this.syncOnly = syncOnly;
	}
	/**
	* Syncs the event used by hover logic to distinguish hover-open from click-like interaction.
	*/
	syncOpenEvent = (newOpen, event) => {
		if (!newOpen || !this.state.open || event != null && isClickLikeEvent(event)) this.context.dataRef.current.openEvent = newOpen ? event : void 0;
	};
	/**
	* Runs the root-owned side effects for an open state change.
	*/
	dispatchOpenChange = (newOpen, eventDetails) => {
		this.syncOpenEvent(newOpen, eventDetails.event);
		const details = {
			open: newOpen,
			reason: eventDetails.reason,
			nativeEvent: eventDetails.event,
			nested: this.context.nested,
			triggerElement: eventDetails.trigger
		};
		this.context.events.emit("openchange", details);
	};
	/**
	* Emits the `openchange` event through the internal event emitter and calls the `onOpenChange` handler with the provided arguments.
	*
	* @param newOpen The new open state.
	* @param eventDetails Details about the event that triggered the open state change.
	*/
	setOpen = (newOpen, eventDetails) => {
		if (this.syncOnly) {
			this.context.onOpenChange?.(newOpen, eventDetails);
			return;
		}
		this.dispatchOpenChange(newOpen, eventDetails);
		this.context.onOpenChange?.(newOpen, eventDetails);
	};
};

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/floating-ui-react/hooks/useSyncedFloatingRootContext.mjs
/**
* Keeps a FloatingRootStore in sync with the provided PopupStore.
* Uses the provided FloatingRootStore when one exists, otherwise creates one once and updates it on every render.
*/
function useSyncedFloatingRootContext(options) {
	const { popupStore, treatPopupAsFloatingElement = false, floatingRootContext: floatingRootContextProp, floatingId, nested, onOpenChange } = options;
	const open = popupStore.useState("open");
	const referenceElement = popupStore.useState("activeTriggerElement");
	const floatingElement = popupStore.useState(treatPopupAsFloatingElement ? "popupElement" : "positionerElement");
	const triggerElements = popupStore.context.triggerElements;
	const handleOpenChange = onOpenChange;
	const internalStoreRef = react.useRef(null);
	if (floatingRootContextProp === void 0 && internalStoreRef.current === null) internalStoreRef.current = new FloatingRootStore({
		open,
		transitionStatus: void 0,
		referenceElement,
		floatingElement,
		triggerElements,
		onOpenChange: handleOpenChange,
		floatingId,
		syncOnly: true,
		nested
	});
	const store$2 = floatingRootContextProp ?? internalStoreRef.current;
	popupStore.useSyncedValue("floatingId", floatingId);
	useIsoLayoutEffect(() => {
		const valuesToSync = {
			open,
			floatingId,
			referenceElement,
			floatingElement
		};
		if (isElement(referenceElement)) valuesToSync.domReferenceElement = referenceElement;
		if (store$2.state.positionReference === store$2.state.referenceElement) valuesToSync.positionReference = referenceElement;
		store$2.update(valuesToSync);
	}, [
		open,
		floatingId,
		referenceElement,
		floatingElement,
		store$2
	]);
	store$2.context.onOpenChange = handleOpenChange;
	store$2.context.nested = nested;
	return store$2;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/utils/popups/popupStoreUtils.mjs
const FOCUSABLE_POPUP_PROPS = {
	tabIndex: -1,
	[FOCUSABLE_ATTRIBUTE]: ""
};
/**
* Returns the default `initialFocus` resolver for a popup. When opened by touch it focuses the
* popup element itself to prevent the virtual keyboard from opening (required for Android
* specifically; iOS handles this automatically). Otherwise it falls back to the default behavior.
*/
function createDefaultInitialFocus(popupRef) {
	return (interactionType) => interactionType === "touch" ? popupRef.current : true;
}
/**
* The subset of a popup handle that a Root needs to bind its store to. Both the real handle classes
* and any test double satisfy it.
*/
/**
* Creates and owns a popup store on behalf of a Root part. The store is created exactly once, with
* controlled props and root state synced separately after creation. Sets up the synced floating
* root context and returns the store.
*
* @param createStore Factory that builds the store. Called exactly once, receiving the floating id
* and whether the popup is nested inside another floating element, both resolved on the first render.
* @param treatPopupAsFloatingElement Whether the popup element is passed to Floating UI as the
* floating element instead of the default positioner.
*/
function usePopupRootStore(createStore, treatPopupAsFloatingElement = false) {
	const floatingId = useId();
	const nested = useFloatingParentNodeId() != null;
	const store$2 = useRefWithInit(() => createStore(floatingId, nested)).current;
	useSyncedFloatingRootContext({
		popupStore: store$2,
		treatPopupAsFloatingElement,
		floatingRootContext: store$2.state.floatingRootContext,
		floatingId,
		nested,
		onOpenChange: store$2.setOpen
	});
	return store$2;
}
/**
* Attaches a Root's store to a handle for this component's committed lifetime. Popup Roots render
* it before their interactions and user children so its layout effect runs before descendant layout
* effects. This lets descendants call the handle during the Root's initial commit without attaching
* during render, which would leak suspended or abandoned stores. Store subscribers are notified by
* `attachStore` in this ordinary layout phase, where React permits synchronous updates.
*
* Popup Roots must render this component only when a handle is present so handle-less Roots avoid
* mounting an extra fiber and layout effect.
*/
function PopupHandleAttachment({ handle, store: store$2 }) {
	useIsoLayoutEffect(() => {
		return handle.attachStore(store$2);
	}, [handle, store$2]);
	return null;
}
/**
* Returns a callback ref that registers/unregisters the trigger element in the store.
*
* @param store The Store instance where the trigger should be registered.
*/
function useTriggerRegistration(id, store$2) {
	const registeredElementIdRef = react.useRef(null);
	const registeredElementRef = react.useRef(null);
	return react.useCallback((element) => {
		if (id === void 0) return;
		let shouldSyncTriggerCount = false;
		if (registeredElementIdRef.current !== null) {
			const registeredId = registeredElementIdRef.current;
			const registeredElement = registeredElementRef.current;
			const currentElement = store$2.context.triggerElements.getById(registeredId);
			if (registeredElement && currentElement === registeredElement) {
				store$2.context.triggerElements.delete(registeredId);
				shouldSyncTriggerCount = true;
			}
			registeredElementIdRef.current = null;
			registeredElementRef.current = null;
		}
		if (element !== null) {
			registeredElementIdRef.current = id;
			registeredElementRef.current = element;
			store$2.context.triggerElements.add(id, element);
			shouldSyncTriggerCount = true;
		}
		if (shouldSyncTriggerCount) {
			const triggerCount = store$2.context.triggerElements.size;
			if (store$2.select("open") && store$2.state.triggerCount !== triggerCount) store$2.set("triggerCount", triggerCount);
		}
	}, [store$2, id]);
}
function setPopupOpenState(state, open, trigger, preventUnmountOnClose = false) {
	if (open) state.preventUnmountingOnClose = false;
	else if (preventUnmountOnClose) state.preventUnmountingOnClose = true;
	const triggerId = trigger?.id ?? null;
	if (triggerId || open) {
		state.activeTriggerId = triggerId;
		state.activeTriggerElement = trigger ?? null;
	}
}
function attachPreventUnmountOnClose(eventDetails) {
	let preventUnmountOnClose = false;
	eventDetails.preventUnmountOnClose = () => {
		preventUnmountOnClose = true;
	};
	return () => preventUnmountOnClose;
}
/**
* Sets up trigger data forwarding to the store.
*
* @param triggerId Id of the trigger.
* @param triggerElementRef Ref for the trigger DOM element.
* @param store The Store instance managing the popup state.
* @param stateUpdates An object with state updates to apply when the trigger is active.
*/
function useTriggerDataForwarding(triggerId, triggerElementRef, store$2, stateUpdates) {
	const isMountedByThisTrigger = store$2.useState("isMountedByTrigger", triggerId);
	const baseRegisterTrigger = useTriggerRegistration(triggerId, store$2);
	const applyTriggerData = useStableCallback((element) => {
		const open = store$2.select("open");
		const activeTriggerId = store$2.select("activeTriggerId");
		if (activeTriggerId === triggerId) {
			store$2.update({
				activeTriggerElement: element,
				...open ? stateUpdates : null
			});
			return;
		}
		if (activeTriggerId == null && open) store$2.update({
			activeTriggerId: triggerId,
			activeTriggerElement: element,
			...stateUpdates
		});
	});
	const registerTrigger = react.useCallback((element) => {
		baseRegisterTrigger(element);
		if (element) applyTriggerData(element);
	}, [baseRegisterTrigger, applyTriggerData]);
	useIsoLayoutEffect(() => {
		if (isMountedByThisTrigger) store$2.update({
			activeTriggerElement: triggerElementRef.current,
			...stateUpdates
		});
	}, [
		isMountedByThisTrigger,
		store$2,
		triggerElementRef,
		...Object.values(stateUpdates)
	]);
	return {
		registerTrigger,
		isMountedByThisTrigger
	};
}
/**
* Keeps trigger registration state synchronized while the popup is open.
*
* When a popup opens without an explicit trigger id and exactly one trigger is registered, that
* trigger is claimed as the active trigger. When the active trigger id is still registered but its
* element changed, the active element is refreshed. When the active trigger id is missing from the
* registry but the same element is still registered under a different id (e.g. the rendered trigger
* carries its own DOM `id` that differs from Base UI's internal trigger id), the active id is
* reassociated to the registered id instead of being treated as lost. When the active trigger
* unregisters, the default path preserves existing ownership so non-closing popup families do not
* silently claim a different trigger while staying open.
*
* If `closeOnActiveTriggerUnmount` is enabled, unregistering a previously resolved active trigger
* requests a close after a microtask so a same-tick replacement trigger with the same id can
* register first. An active trigger id that has not matched a registered trigger yet is treated as
* pending and does not request a close.
*
* This should be called on the Root part.
*
* @param store The Store instance managing the popup state.
* @param options Options for active trigger unmount behavior.
*/
function useImplicitActiveTrigger(store$2, options = {}) {
	const { closeOnActiveTriggerUnmount = false } = options;
	const resolvedActiveTriggerIdRef = react.useRef(null);
	const open = store$2.useState("open");
	useIsoLayoutEffect(() => {
		if (!open) {
			resolvedActiveTriggerIdRef.current = null;
			if (store$2.state.triggerCount !== 0) store$2.set("triggerCount", 0);
			return;
		}
		const triggerCount = store$2.context.triggerElements.size;
		const stateUpdates = {};
		if (store$2.state.triggerCount !== triggerCount) stateUpdates.triggerCount = triggerCount;
		const currentActiveTriggerId = store$2.select("activeTriggerId");
		let lostActiveTriggerId = null;
		if (currentActiveTriggerId) {
			const activeTriggerElement = store$2.context.triggerElements.getById(currentActiveTriggerId);
			if (!activeTriggerElement) {
				for (const [triggerId, triggerElement] of store$2.context.triggerElements.entries()) if (triggerElement === store$2.state.activeTriggerElement) {
					stateUpdates.activeTriggerId = triggerId;
					stateUpdates.activeTriggerElement = triggerElement;
					resolvedActiveTriggerIdRef.current = triggerId;
					break;
				}
				if (stateUpdates.activeTriggerId === void 0) if (resolvedActiveTriggerIdRef.current === currentActiveTriggerId) lostActiveTriggerId = currentActiveTriggerId;
				else resolvedActiveTriggerIdRef.current = null;
			} else {
				resolvedActiveTriggerIdRef.current = currentActiveTriggerId;
				if (activeTriggerElement !== store$2.state.activeTriggerElement) stateUpdates.activeTriggerElement = activeTriggerElement;
			}
		} else resolvedActiveTriggerIdRef.current = null;
		if (!lostActiveTriggerId && !currentActiveTriggerId && triggerCount === 1) {
			const iteratorResult = store$2.context.triggerElements.entries().next();
			if (!iteratorResult.done) {
				const [implicitTriggerId, implicitTriggerElement] = iteratorResult.value;
				stateUpdates.activeTriggerId = implicitTriggerId;
				stateUpdates.activeTriggerElement = implicitTriggerElement;
				resolvedActiveTriggerIdRef.current = implicitTriggerId;
			}
		}
		if (stateUpdates.triggerCount !== void 0 || stateUpdates.activeTriggerId !== void 0 || stateUpdates.activeTriggerElement !== void 0) store$2.update(stateUpdates);
		if (lostActiveTriggerId) {
			if (closeOnActiveTriggerUnmount) queueMicrotask(() => {
				if (store$2.select("open") && store$2.select("activeTriggerId") === lostActiveTriggerId && !store$2.context.triggerElements.getById(lostActiveTriggerId)) {
					const eventDetails = createChangeEventDetails(none);
					store$2.setOpen(false, eventDetails);
					if (!eventDetails.isCanceled) store$2.update({
						activeTriggerId: null,
						activeTriggerElement: null
					});
				}
			});
		}
	}, [
		open,
		store$2,
		store$2.useState("triggerCount"),
		store$2.useState("activeTriggerId"),
		store$2.useState("activeTriggerElement"),
		closeOnActiveTriggerUnmount
	]);
}
/**
* Manages the mounted state of the popup.
* Sets up the transition status listeners and handles unmounting when needed.
* Updates the `mounted`, `transitionStatus`, and `preventUnmountingOnClose` states in the store.
*
* @param open Whether the popup is open.
* @param store The Store instance managing the popup state.
* @param onUnmount Optional callback to be called when the popup is unmounted.
*
* @returns A function to forcibly unmount the popup.
*/
function useOpenStateTransitions(open, store$2, onUnmount) {
	const { mounted, setMounted, transitionStatus } = useTransitionStatus(open);
	const preventUnmountingOnClose = store$2.useState("preventUnmountingOnClose");
	const syncedPreventUnmountingOnClose = open ? false : preventUnmountingOnClose;
	store$2.useSyncedValues({
		mounted,
		transitionStatus,
		preventUnmountingOnClose: syncedPreventUnmountingOnClose
	});
	const forceUnmount = useStableCallback(() => {
		setMounted(false);
		store$2.update({
			activeTriggerId: null,
			activeTriggerElement: null,
			mounted: false,
			preventUnmountingOnClose: false
		});
		onUnmount?.();
		store$2.context.onOpenChangeComplete?.(false);
	});
	useOpenChangeComplete({
		enabled: mounted && !open && !syncedPreventUnmountingOnClose,
		open,
		ref: store$2.context.popupRef,
		onComplete() {
			if (!open) forceUnmount();
		}
	});
	return {
		forceUnmount,
		transitionStatus
	};
}
function usePopupInteractionProps(store$2, statePart) {
	store$2.useSyncedValues(statePart);
	useIsoLayoutEffect(() => () => {
		store$2.update({
			activeTriggerProps: EMPTY_OBJECT,
			inactiveTriggerProps: EMPTY_OBJECT,
			popupProps: EMPTY_OBJECT
		});
	}, [store$2]);
}
function usePopupRootSync(store$2, open) {
	useIsoLayoutEffect(() => {
		if (!open && store$2.state.openMethod !== null) store$2.set("openMethod", null);
	}, [open, store$2]);
	useIsoLayoutEffect(() => () => {
		if (store$2.state.openMethod !== null) store$2.set("openMethod", null);
	}, [store$2]);
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/utils/popups/popupTriggerMap.mjs
/**
* Data structure to keep track of popup trigger elements by their IDs.
*
* Element lookups iterate the id map rather than maintaining a parallel Set. Registration is O(1),
* while `hasElement` and `hasMatchingElement` are linear in the number of triggers.
*/
var PopupTriggerMap = class {
	constructor() {
		this.idMap = /* @__PURE__ */ new Map();
	}
	/**
	* Adds a trigger element with the given ID.
	*
	* Note: The provided element is assumed to not be registered under multiple IDs.
	*/
	add(id, element) {
		this.idMap.set(id, element);
	}
	/**
	* Removes the trigger element with the given ID.
	*/
	delete(id) {
		this.idMap.delete(id);
	}
	/**
	* Whether the given element is registered as a trigger.
	*/
	hasElement(element) {
		for (const registered of this.idMap.values()) if (registered === element) return true;
		return false;
	}
	/**
	* Whether there is a registered trigger element matching the given predicate.
	*/
	hasMatchingElement(predicate) {
		for (const element of this.idMap.values()) if (predicate(element)) return true;
		return false;
	}
	/**
	* Returns the trigger element associated with the given ID, or undefined if no such element exists.
	*/
	getById(id) {
		return this.idMap.get(id);
	}
	/**
	* Returns an iterable of all registered trigger entries, where each entry is a tuple of [id, element].
	*/
	entries() {
		return this.idMap.entries();
	}
	/**
	* Returns an iterable of all registered trigger elements.
	*/
	elements() {
		return this.idMap.values();
	}
	/**
	* Returns the number of registered trigger elements.
	*/
	get size() {
		return this.idMap.size;
	}
};

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/floating-ui-react/utils/getEmptyRootContext.mjs
function getEmptyRootContext() {
	return new FloatingRootStore({
		open: false,
		transitionStatus: void 0,
		floatingElement: null,
		referenceElement: null,
		triggerElements: new PopupTriggerMap(),
		floatingId: void 0,
		syncOnly: false,
		nested: false,
		onOpenChange: void 0
	});
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/utils/popups/store.mjs
/**
* State common to all popup stores.
*/
function createInitialPopupStoreState() {
	return {
		open: false,
		openProp: void 0,
		mounted: false,
		transitionStatus: void 0,
		floatingRootContext: getEmptyRootContext(),
		floatingId: void 0,
		triggerCount: 0,
		preventUnmountingOnClose: false,
		payload: void 0,
		activeTriggerId: null,
		activeTriggerElement: null,
		triggerIdProp: void 0,
		popupElement: null,
		positionerElement: null,
		activeTriggerProps: EMPTY_OBJECT,
		inactiveTriggerProps: EMPTY_OBJECT,
		popupProps: EMPTY_OBJECT
	};
}
function createPopupFloatingRootContext(triggerElements, floatingId, nested = false) {
	return new FloatingRootStore({
		open: false,
		transitionStatus: void 0,
		floatingElement: null,
		referenceElement: null,
		triggerElements,
		floatingId,
		syncOnly: true,
		nested,
		onOpenChange: void 0
	});
}
const activeTriggerIdSelector = (state) => state.triggerIdProp ?? state.activeTriggerId;
const openSelector = (state) => state.openProp ?? state.open;
const popupIdSelector = (state) => {
	return (state.popupElement?.id ?? state.floatingId) || void 0;
};
function triggerOwnsOpenPopup(state, triggerId) {
	return triggerId !== void 0 && openSelector(state) && activeTriggerIdSelector(state) === triggerId;
}
function triggerOwnsOpenPopupOrIsOnlyTrigger(state, triggerId) {
	if (triggerOwnsOpenPopup(state, triggerId)) return true;
	return triggerId !== void 0 && openSelector(state) && activeTriggerIdSelector(state) == null && state.triggerCount === 1;
}
const popupStoreSelectors = {
	open: openSelector,
	mounted: (state) => state.mounted,
	transitionStatus: (state) => state.transitionStatus,
	floatingRootContext: (state) => state.floatingRootContext,
	triggerCount: (state) => state.triggerCount,
	preventUnmountingOnClose: (state) => state.preventUnmountingOnClose,
	payload: (state) => state.payload,
	activeTriggerId: activeTriggerIdSelector,
	activeTriggerElement: (state) => state.mounted ? state.activeTriggerElement : null,
	popupId: popupIdSelector,
	isTriggerActive: (state, triggerId) => triggerId !== void 0 && activeTriggerIdSelector(state) === triggerId,
	isOpenedByTrigger: (state, triggerId) => triggerOwnsOpenPopup(state, triggerId),
	isMountedByTrigger: (state, triggerId) => triggerId !== void 0 && activeTriggerIdSelector(state) === triggerId && state.mounted,
	triggerProps: (state, isActive) => isActive ? state.activeTriggerProps : state.inactiveTriggerProps,
	triggerPopupId: (state, triggerId) => triggerOwnsOpenPopupOrIsOnlyTrigger(state, triggerId) ? popupIdSelector(state) : void 0,
	popupProps: (state) => state.popupProps,
	popupElement: (state) => state.popupElement,
	positionerElement: (state) => state.positionerElement
};
/**
* Store members a detached handle-backed trigger reads or invokes for trigger registration and data
* forwarding. `set`/`update` are included only for trigger-count and trigger-data bookkeeping; on a
* detached (inert) store they are intentionally no-ops, so a write through them is not guaranteed to
* be durable. Component handle-store views Pick these from their concrete store (preserving its
* context and selectors) and add any component-specific trigger-invoked members such as `setOpen`.
*/
/**
* The subset of a popup store that trigger registration and data forwarding rely on. Narrow enough
* that an inert store can be passed while detached.
*/
//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/utils/popups/usePopupHandleStore.mjs
var import_shim = /* @__PURE__ */ __toESM(require_shim(), 1);
/**
* Reads the store currently exposed by a popup handle and subscribes to store-pointer changes.
* Detached triggers use this to follow a handle as a root attaches or detaches: while no root is
* attached, the handle exposes its fallback store; once a root attaches, subscribers re-render and
* read from the live root store.
*
* Returns `undefined` when no handle is provided so callers can fall back to their root context.
*
* @param handle The popup handle to read from, or `undefined` when the trigger is not handle-bound.
*/
function usePopupHandleStore(handle) {
	return (0, import_shim.useSyncExternalStore)(react.useCallback((listener) => {
		if (handle === void 0) return NOOP;
		return handle.subscribeStore(listener);
	}, [handle]), react.useCallback(() => {
		return handle === void 0 ? void 0 : handle.store;
	}, [handle]), () => handle?.serverStore);
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/floating-ui-react/hooks/useFloating.mjs
/**
* Base UI's private `useFloating` path. The caller must supply the root store, so this skips the
* internal root-context hook used by the public Floating UI-compatible API.
*/
function useBaseUIFloating(options) {
	return useFloatingWithStore(options, options.rootContext);
}
function useFloatingWithStore(options, store$2) {
	const { nodeId, externalTree } = options;
	const referenceElement = store$2.useState("referenceElement");
	const floatingElement = store$2.useState("floatingElement");
	const domReferenceElement = store$2.useState("domReferenceElement");
	const open = store$2.useState("open");
	const floatingId = store$2.useState("floatingId");
	const [positionReference, setPositionReferenceRaw] = react.useState(null);
	const [localDomReference, setLocalDomReference] = react.useState(void 0);
	const [localFloatingElement, setLocalFloatingElement] = react.useState(void 0);
	const domReferenceRef = react.useRef(null);
	const tree = useFloatingTree(externalTree);
	const storeElements = react.useMemo(() => ({
		reference: referenceElement,
		floating: floatingElement,
		domReference: domReferenceElement
	}), [
		referenceElement,
		floatingElement,
		domReferenceElement
	]);
	const position = useFloating({
		...options,
		elements: {
			...storeElements,
			...positionReference && { reference: positionReference }
		}
	});
	const localDomReferenceElement = isElement(localDomReference) ? localDomReference : null;
	const syncedFloatingElement = localFloatingElement === void 0 ? store$2.state.floatingElement : localFloatingElement;
	store$2.useSyncedValue("referenceElement", localDomReference ?? null);
	store$2.useSyncedValue("domReferenceElement", localDomReference === void 0 ? domReferenceElement : localDomReferenceElement);
	store$2.useSyncedValue("floatingElement", syncedFloatingElement);
	const setPositionReference = react.useCallback((node) => {
		const computedPositionReference = isElement(node) ? {
			getBoundingClientRect: () => node.getBoundingClientRect(),
			getClientRects: () => node.getClientRects(),
			contextElement: node
		} : node;
		setPositionReferenceRaw(computedPositionReference);
		position.refs.setReference(computedPositionReference);
	}, [position.refs]);
	const setReference = react.useCallback((node) => {
		if (isElement(node) || node === null) {
			domReferenceRef.current = node;
			setLocalDomReference(node);
		}
		if (isElement(position.refs.reference.current) || position.refs.reference.current === null || node !== null && !isElement(node)) position.refs.setReference(node);
	}, [position.refs, setLocalDomReference]);
	const setFloating = react.useCallback((node) => {
		setLocalFloatingElement(node);
		position.refs.setFloating(node);
	}, [position.refs]);
	const refs = react.useMemo(() => ({
		...position.refs,
		setReference,
		setFloating,
		setPositionReference,
		domReference: domReferenceRef
	}), [
		position.refs,
		setReference,
		setFloating,
		setPositionReference
	]);
	const elements = react.useMemo(() => ({
		...position.elements,
		domReference: domReferenceElement
	}), [position.elements, domReferenceElement]);
	const context = react.useMemo(() => ({
		...position,
		dataRef: store$2.context.dataRef,
		open,
		onOpenChange: store$2.setOpen,
		events: store$2.context.events,
		floatingId,
		refs,
		elements,
		nodeId,
		rootStore: store$2
	}), [
		position,
		refs,
		elements,
		nodeId,
		store$2,
		open,
		floatingId
	]);
	useIsoLayoutEffect(() => {
		if (domReferenceElement) domReferenceRef.current = domReferenceElement;
	}, [domReferenceElement]);
	useIsoLayoutEffect(() => {
		store$2.context.dataRef.current.floatingContext = context;
		const node = tree?.nodesRef.current.find((n) => n.id === nodeId);
		if (node) node.context = context;
	});
	return react.useMemo(() => ({
		...position,
		context,
		refs,
		elements,
		rootStore: store$2
	}), [
		position,
		refs,
		elements,
		context,
		store$2
	]);
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/floating-ui-react/hooks/useHoverInteractionSharedState.mjs
var HoverInteraction = class HoverInteraction {
	constructor() {
		this.pointerType = void 0;
		this.interactedInside = false;
		this.handler = void 0;
		this.blockMouseMove = true;
		this.performedPointerEventsMutation = false;
		this.pointerEventsScopeElement = null;
		this.pointerEventsReferenceElement = null;
		this.pointerEventsFloatingElement = null;
		this.restTimeoutPending = false;
		this.openChangeTimeout = new Timeout();
		this.restTimeout = new Timeout();
		this.handleCloseOptions = void 0;
	}
	static create() {
		return new HoverInteraction();
	}
	dispose = () => {
		this.openChangeTimeout.clear();
		this.restTimeout.clear();
	};
	disposeEffect = () => {
		return this.dispose;
	};
};
const pointerEventsMutationOwnerByScopeElement = /* @__PURE__ */ new WeakMap();
function clearSafePolygonPointerEventsMutation(instance) {
	if (!instance.performedPointerEventsMutation) return;
	const scopeElement = instance.pointerEventsScopeElement;
	if (scopeElement && pointerEventsMutationOwnerByScopeElement.get(scopeElement) === instance) {
		instance.pointerEventsScopeElement?.style.removeProperty("pointer-events");
		instance.pointerEventsReferenceElement?.style.removeProperty("pointer-events");
		instance.pointerEventsFloatingElement?.style.removeProperty("pointer-events");
		pointerEventsMutationOwnerByScopeElement.delete(scopeElement);
	}
	instance.performedPointerEventsMutation = false;
	instance.pointerEventsScopeElement = null;
	instance.pointerEventsReferenceElement = null;
	instance.pointerEventsFloatingElement = null;
}
function applySafePolygonPointerEventsMutation(instance, options) {
	const { scopeElement, referenceElement, floatingElement } = options;
	const existingOwner = pointerEventsMutationOwnerByScopeElement.get(scopeElement);
	if (existingOwner && existingOwner !== instance) clearSafePolygonPointerEventsMutation(existingOwner);
	clearSafePolygonPointerEventsMutation(instance);
	instance.performedPointerEventsMutation = true;
	instance.pointerEventsScopeElement = scopeElement;
	instance.pointerEventsReferenceElement = referenceElement;
	instance.pointerEventsFloatingElement = floatingElement;
	pointerEventsMutationOwnerByScopeElement.set(scopeElement, instance);
	scopeElement.style.pointerEvents = "none";
	referenceElement.style.pointerEvents = "auto";
	floatingElement.style.pointerEvents = "auto";
}
function useHoverInteractionSharedState(store$2) {
	const data = store$2.context.dataRef.current;
	const instance = useRefWithInit(() => data.hoverInteractionState ?? HoverInteraction.create()).current;
	if (!data.hoverInteractionState) data.hoverInteractionState = instance;
	useOnMount(data.hoverInteractionState.disposeEffect);
	return data.hoverInteractionState;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/floating-ui-react/hooks/useHoverFloatingInteraction.mjs
/**
* Provides hover interactions that should be attached to the floating element.
*/
function useHoverFloatingInteraction(context, parameters = {}) {
	const { enabled = true, closeDelay: closeDelayProp = 0, nodeId: nodeIdProp } = parameters;
	const store$2 = "rootStore" in context ? context.rootStore : context;
	const open = store$2.useState("open");
	const floatingElement = store$2.useState("floatingElement");
	const domReferenceElement = store$2.useState("domReferenceElement");
	const { dataRef } = store$2.context;
	const tree = useFloatingTree();
	const parentId = useFloatingParentNodeId();
	const instance = useHoverInteractionSharedState(store$2);
	const childClosedTimeout = useTimeout();
	const isClickLikeOpenEvent$1 = useStableCallback(() => {
		return isClickLikeOpenEvent(dataRef.current.openEvent?.type, instance.interactedInside);
	});
	const isHoverOpen = useStableCallback(() => {
		return isHoverOpenEvent(dataRef.current.openEvent?.type);
	});
	const clearPointerEvents = useStableCallback(() => {
		clearSafePolygonPointerEventsMutation(instance);
	});
	useIsoLayoutEffect(() => {
		if (!open) {
			instance.pointerType = void 0;
			instance.restTimeoutPending = false;
			instance.interactedInside = false;
			clearPointerEvents();
		}
	}, [
		open,
		instance,
		clearPointerEvents
	]);
	react.useEffect(() => {
		return clearPointerEvents;
	}, [clearPointerEvents]);
	useIsoLayoutEffect(() => {
		if (!enabled) return;
		if (open && instance.handleCloseOptions?.blockPointerEvents && isHoverOpen() && isElement(domReferenceElement) && floatingElement) {
			const ref = domReferenceElement;
			const floatingEl = floatingElement;
			const doc = ownerDocument(floatingElement);
			const parentFloating = tree?.nodesRef.current.find((node) => node.id === parentId)?.context?.elements.floating;
			if (parentFloating) parentFloating.style.pointerEvents = "";
			const cachedScopeElement = instance.pointerEventsScopeElement !== floatingEl ? instance.pointerEventsScopeElement : null;
			const parentScopeElement = parentFloating !== floatingEl ? parentFloating : null;
			applySafePolygonPointerEventsMutation(instance, {
				scopeElement: instance.handleCloseOptions?.getScope?.() ?? cachedScopeElement ?? parentScopeElement ?? ref.closest("[data-rootownerid]") ?? doc.body,
				referenceElement: ref,
				floatingElement: floatingEl
			});
			return () => {
				clearPointerEvents();
			};
		}
	}, [
		enabled,
		open,
		domReferenceElement,
		floatingElement,
		instance,
		isHoverOpen,
		tree,
		parentId,
		clearPointerEvents
	]);
	react.useEffect(() => {
		if (!enabled) return;
		function hasParentChildren() {
			return !!(tree && parentId && getNodeChildren(tree.nodesRef.current, parentId).length > 0);
		}
		function closeWithDelay(event) {
			const closeDelay = getDelay(closeDelayProp, "close", instance.pointerType);
			const close$1 = () => {
				store$2.setOpen(false, createChangeEventDetails(triggerHover, event));
				tree?.events.emit("floating.closed", event);
			};
			if (closeDelay) instance.openChangeTimeout.start(closeDelay, close$1);
			else {
				instance.openChangeTimeout.clear();
				close$1();
			}
		}
		function handleInteractInside(event) {
			const target = getTarget(event);
			if (!isInteractiveElement(target)) {
				instance.interactedInside = false;
				return;
			}
			instance.interactedInside = target?.closest("[aria-haspopup]") != null;
		}
		function onFloatingMouseEnter() {
			instance.openChangeTimeout.clear();
			childClosedTimeout.clear();
			tree?.events.off("floating.closed", onNodeClosed);
			clearPointerEvents();
		}
		function onFloatingMouseLeave(event) {
			if (hasParentChildren() && tree) {
				tree.events.on("floating.closed", onNodeClosed);
				return;
			}
			if (isTargetInsideEnabledTrigger(event.relatedTarget, store$2.context.triggerElements)) return;
			const currentNodeId = dataRef.current.floatingContext?.nodeId ?? nodeIdProp;
			const relatedTarget = event.relatedTarget;
			if (tree && currentNodeId && isElement(relatedTarget) && getNodeChildren(tree.nodesRef.current, currentNodeId, false).some((node) => contains(node.context?.elements.floating, relatedTarget))) return;
			if (instance.handler) {
				instance.handler(event);
				return;
			}
			clearPointerEvents();
			if (isHoverOpen() && !isClickLikeOpenEvent$1()) closeWithDelay(event);
		}
		function onNodeClosed(event) {
			if (!tree || !parentId || hasParentChildren()) return;
			childClosedTimeout.start(0, () => {
				tree.events.off("floating.closed", onNodeClosed);
				store$2.setOpen(false, createChangeEventDetails(triggerHover, event));
				tree.events.emit("floating.closed", event);
			});
		}
		const floating = floatingElement;
		return mergeCleanups(floating && addEventListener(floating, "mouseenter", onFloatingMouseEnter), floating && addEventListener(floating, "mouseleave", onFloatingMouseLeave), floating && addEventListener(floating, "pointerdown", handleInteractInside, true), () => {
			tree?.events.off("floating.closed", onNodeClosed);
		});
	}, [
		enabled,
		floatingElement,
		store$2,
		dataRef,
		closeDelayProp,
		nodeIdProp,
		isHoverOpen,
		isClickLikeOpenEvent$1,
		clearPointerEvents,
		instance,
		tree,
		parentId,
		childClosedTimeout
	]);
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/floating-ui-react/hooks/useHoverReferenceInteraction.mjs
const EMPTY_REF = { current: null };
/**
* Provides hover interactions that should be attached to reference or trigger
* elements.
*/
function useHoverReferenceInteraction(context, props = {}) {
	const { enabled = true, delay = 0, handleClose = null, mouseOnly = false, restMs = 0, move = true, triggerElementRef = EMPTY_REF, externalTree, isActiveTrigger = true, getHandleCloseContext, isClosing, shouldOpen: shouldOpenProp, guardStaleOpen = false } = props;
	const store$2 = "rootStore" in context ? context.rootStore : context;
	const { dataRef, events } = store$2.context;
	const tree = useFloatingTree(externalTree);
	const instance = useHoverInteractionSharedState(store$2);
	const isHoverCloseActiveRef = react.useRef(false);
	const handleCloseRef = useValueAsRef(handleClose);
	const delayRef = useValueAsRef(delay);
	const restMsRef = useValueAsRef(restMs);
	const enabledRef = useValueAsRef(enabled);
	const shouldOpenRef = useValueAsRef(shouldOpenProp);
	const isClosingRef = useValueAsRef(isClosing);
	const isClickLikeOpenEvent$1 = useStableCallback(() => {
		return isClickLikeOpenEvent(dataRef.current.openEvent?.type, instance.interactedInside);
	});
	const checkShouldOpen = useStableCallback(() => {
		return shouldOpenRef.current?.() !== false;
	});
	const isOverInactiveTrigger = useStableCallback((currentDomReference, currentTarget, target) => {
		const allTriggers = store$2.context.triggerElements;
		if (allTriggers.hasElement(currentTarget)) return !currentDomReference || !contains(currentDomReference, currentTarget);
		if (!isElement(target)) return false;
		const targetElement = target;
		return allTriggers.hasMatchingElement((trigger) => contains(trigger, targetElement)) && (!currentDomReference || !contains(currentDomReference, targetElement));
	});
	const cleanupMouseMoveHandler = useStableCallback(() => {
		if (!instance.handler) return;
		ownerDocument(store$2.select("domReferenceElement")).removeEventListener("mousemove", instance.handler);
		instance.handler = void 0;
	});
	const clearPointerEvents = useStableCallback(() => {
		clearSafePolygonPointerEventsMutation(instance);
	});
	if (isActiveTrigger) instance.handleCloseOptions = handleCloseRef.current?.__options;
	react.useEffect(() => cleanupMouseMoveHandler, [cleanupMouseMoveHandler]);
	react.useEffect(() => {
		if (!enabled) return;
		function onOpenChangeLocal(details) {
			if (!details.open) {
				isHoverCloseActiveRef.current = details.reason === triggerHover;
				cleanupMouseMoveHandler();
				instance.openChangeTimeout.clear();
				instance.restTimeout.clear();
				instance.blockMouseMove = true;
				instance.restTimeoutPending = false;
			} else isHoverCloseActiveRef.current = false;
		}
		events.on("openchange", onOpenChangeLocal);
		return () => {
			events.off("openchange", onOpenChangeLocal);
		};
	}, [
		enabled,
		events,
		instance,
		cleanupMouseMoveHandler
	]);
	react.useEffect(() => {
		if (!enabled) return;
		function closeWithDelay(event, runElseBranch = true) {
			const closeDelay = getDelay(delayRef.current, "close", instance.pointerType);
			if (closeDelay) instance.openChangeTimeout.start(closeDelay, () => {
				store$2.setOpen(false, createChangeEventDetails(triggerHover, event));
				tree?.events.emit("floating.closed", event);
			});
			else if (runElseBranch) {
				instance.openChangeTimeout.clear();
				store$2.setOpen(false, createChangeEventDetails(triggerHover, event));
				tree?.events.emit("floating.closed", event);
			}
		}
		const trigger = triggerElementRef.current ?? (isActiveTrigger ? store$2.select("domReferenceElement") : null);
		if (!isElement(trigger)) return;
		function onMouseEnter(event) {
			instance.openChangeTimeout.clear();
			instance.blockMouseMove = false;
			if (mouseOnly && !isMouseLikePointerType(instance.pointerType)) return;
			const restMsValue = getRestMs(restMsRef.current);
			const openDelay = getDelay(delayRef.current, "open", instance.pointerType);
			const eventTarget = getTarget(event);
			const currentTarget = event.currentTarget ?? null;
			const currentDomReference = store$2.select("domReferenceElement");
			let triggerNode = currentTarget;
			if (isElement(eventTarget) && !store$2.context.triggerElements.hasElement(eventTarget)) {
				for (const triggerElement of store$2.context.triggerElements.elements()) if (contains(triggerElement, eventTarget)) {
					triggerNode = triggerElement;
					break;
				}
			}
			if (isElement(currentTarget) && isElement(currentDomReference) && !store$2.context.triggerElements.hasElement(currentTarget) && contains(currentTarget, currentDomReference)) triggerNode = currentDomReference;
			const isOverInactive = triggerNode == null ? false : isOverInactiveTrigger(currentDomReference, triggerNode, eventTarget);
			const isOpen = store$2.select("open");
			const isInClosingTransition = isClosingRef.current?.() ?? store$2.select("transitionStatus") === "ending";
			const isHoverCloseTransition = !isOpen && isInClosingTransition && isHoverCloseActiveRef.current;
			const isReenteringSameTriggerDuringCloseTransition = !isOverInactive && isElement(triggerNode) && isElement(currentDomReference) && contains(currentDomReference, triggerNode) && isHoverCloseTransition;
			const isRestOnlyDelay = restMsValue > 0 && !openDelay;
			const shouldOpenImmediately = isOverInactive && (isOpen || isHoverCloseTransition) || isReenteringSameTriggerDuringCloseTransition;
			const shouldOpen = !isOpen || isOverInactive;
			if (shouldOpenImmediately) {
				if (checkShouldOpen()) store$2.setOpen(true, createChangeEventDetails(triggerHover, event, triggerNode));
				return;
			}
			if (isRestOnlyDelay) return;
			if (openDelay) instance.openChangeTimeout.start(openDelay, () => {
				if (shouldOpen && checkShouldOpen()) store$2.setOpen(true, createChangeEventDetails(triggerHover, event, triggerNode));
			});
			else if (shouldOpen) {
				if (checkShouldOpen()) store$2.setOpen(true, createChangeEventDetails(triggerHover, event, triggerNode));
			}
		}
		function onMouseLeave(event) {
			if (isClickLikeOpenEvent$1()) {
				clearPointerEvents();
				return;
			}
			cleanupMouseMoveHandler();
			const doc = ownerDocument(store$2.select("domReferenceElement"));
			instance.restTimeout.clear();
			instance.restTimeoutPending = false;
			const handleCloseContextBase = dataRef.current.floatingContext ?? getHandleCloseContext?.();
			if (isTargetInsideEnabledTrigger(event.relatedTarget, store$2.context.triggerElements)) return;
			if (handleCloseRef.current && handleCloseContextBase) {
				if (!store$2.select("open")) instance.openChangeTimeout.clear();
				const currentTrigger = triggerElementRef.current;
				instance.handler = handleCloseRef.current({
					...handleCloseContextBase,
					tree,
					x: event.clientX,
					y: event.clientY,
					onClose() {
						clearPointerEvents();
						cleanupMouseMoveHandler();
						if (enabledRef.current && !isClickLikeOpenEvent$1() && currentTrigger === store$2.select("domReferenceElement")) closeWithDelay(event, true);
					}
				});
				doc.addEventListener("mousemove", instance.handler);
				instance.handler(event);
				return;
			}
			if (instance.pointerType === "touch" ? !contains(store$2.select("floatingElement"), event.relatedTarget) : true) closeWithDelay(event);
		}
		function onMouseOut(event) {
			if (contains(trigger, event.relatedTarget)) return;
			instance.openChangeTimeout.clear();
			instance.restTimeout.clear();
			instance.restTimeoutPending = false;
		}
		const staleOpenGuard = guardStaleOpen ? addEventListener(trigger, "mouseout", onMouseOut) : void 0;
		if (move) return mergeCleanups(addEventListener(trigger, "mousemove", onMouseEnter, { once: true }), addEventListener(trigger, "mouseenter", onMouseEnter), addEventListener(trigger, "mouseleave", onMouseLeave), staleOpenGuard);
		return mergeCleanups(addEventListener(trigger, "mouseenter", onMouseEnter), addEventListener(trigger, "mouseleave", onMouseLeave), staleOpenGuard);
	}, [
		cleanupMouseMoveHandler,
		clearPointerEvents,
		dataRef,
		delayRef,
		store$2,
		enabled,
		handleCloseRef,
		instance,
		isActiveTrigger,
		isOverInactiveTrigger,
		isClickLikeOpenEvent$1,
		mouseOnly,
		move,
		restMsRef,
		triggerElementRef,
		tree,
		enabledRef,
		getHandleCloseContext,
		isClosingRef,
		checkShouldOpen,
		guardStaleOpen
	]);
	return react.useMemo(() => {
		if (!enabled) return;
		function setPointerRef(event) {
			instance.pointerType = event.pointerType;
		}
		return {
			onPointerDown: setPointerRef,
			onPointerEnter: setPointerRef,
			onMouseMove(event) {
				const { nativeEvent } = event;
				const trigger = event.currentTarget;
				const currentDomReference = store$2.select("domReferenceElement");
				const currentOpen = store$2.select("open");
				const isOverInactive = isOverInactiveTrigger(currentDomReference, trigger, event.target);
				if (mouseOnly && !isMouseLikePointerType(instance.pointerType)) return;
				if (currentOpen && isOverInactive && instance.handleCloseOptions?.blockPointerEvents) {
					const floatingElement = store$2.select("floatingElement");
					if (floatingElement) applySafePolygonPointerEventsMutation(instance, {
						scopeElement: instance.handleCloseOptions?.getScope?.() ?? trigger.ownerDocument.body,
						referenceElement: trigger,
						floatingElement
					});
				}
				const restMsValue = getRestMs(restMsRef.current);
				if (currentOpen && !isOverInactive || restMsValue === 0) return;
				if (!isOverInactive && instance.restTimeoutPending && event.movementX ** 2 + event.movementY ** 2 < 2) return;
				instance.restTimeout.clear();
				function handleMouseMove() {
					instance.restTimeoutPending = false;
					if (isClickLikeOpenEvent$1()) return;
					const latestOpen = store$2.select("open");
					if (!instance.blockMouseMove && (!latestOpen || isOverInactive) && checkShouldOpen()) store$2.setOpen(true, createChangeEventDetails(triggerHover, nativeEvent, trigger));
				}
				if (instance.pointerType === "touch") react_dom.flushSync(() => {
					handleMouseMove();
				});
				else if (isOverInactive && currentOpen) handleMouseMove();
				else {
					instance.restTimeoutPending = true;
					instance.restTimeout.start(restMsValue, handleMouseMove);
				}
			}
		};
	}, [
		enabled,
		instance,
		isClickLikeOpenEvent$1,
		isOverInactiveTrigger,
		mouseOnly,
		store$2,
		restMsRef,
		checkShouldOpen
	]);
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/floating-ui-react/safePolygon.mjs
const CURSOR_SPEED_THRESHOLD = .1;
const CURSOR_SPEED_THRESHOLD_SQUARED = CURSOR_SPEED_THRESHOLD * CURSOR_SPEED_THRESHOLD;
const POLYGON_BUFFER = .5;
function hasIntersectingEdge(pointX, pointY, xi, yi, xj, yj) {
	return yi >= pointY !== yj >= pointY && pointX <= (xj - xi) * (pointY - yi) / (yj - yi) + xi;
}
function isPointInQuadrilateral(pointX, pointY, x1, y1, x2, y2, x3, y3, x4, y4) {
	let isInsideValue = false;
	if (hasIntersectingEdge(pointX, pointY, x1, y1, x2, y2)) isInsideValue = !isInsideValue;
	if (hasIntersectingEdge(pointX, pointY, x2, y2, x3, y3)) isInsideValue = !isInsideValue;
	if (hasIntersectingEdge(pointX, pointY, x3, y3, x4, y4)) isInsideValue = !isInsideValue;
	if (hasIntersectingEdge(pointX, pointY, x4, y4, x1, y1)) isInsideValue = !isInsideValue;
	return isInsideValue;
}
function isInsideRect(pointX, pointY, rect) {
	return pointX >= rect.x && pointX <= rect.x + rect.width && pointY >= rect.y && pointY <= rect.y + rect.height;
}
function isInsideAxisAlignedRect(pointX, pointY, x1, y1, x2, y2) {
	return pointX >= Math.min(x1, x2) && pointX <= Math.max(x1, x2) && pointY >= Math.min(y1, y2) && pointY <= Math.max(y1, y2);
}
/**
* Generates a safe polygon area that the user can traverse without closing the
* floating element once leaving the reference element.
* @see https://floating-ui.com/docs/useHover#safepolygon
*/
function safePolygon(options = {}) {
	const { blockPointerEvents = false } = options;
	const timeout = new Timeout();
	const fn = ({ x, y, placement, elements, onClose, nodeId, tree }) => {
		const side = placement?.split("-")[0];
		let hasLanded = false;
		let lastX = null;
		let lastY = null;
		let lastCursorTime = typeof performance !== "undefined" ? performance.now() : 0;
		function isCursorMovingSlowly(nextX, nextY) {
			const currentTime = performance.now();
			const elapsedTime = currentTime - lastCursorTime;
			if (lastX === null || lastY === null || elapsedTime === 0) {
				lastX = nextX;
				lastY = nextY;
				lastCursorTime = currentTime;
				return false;
			}
			const deltaX = nextX - lastX;
			const deltaY = nextY - lastY;
			const distanceSquared = deltaX * deltaX + deltaY * deltaY;
			const thresholdSquared = elapsedTime * elapsedTime * CURSOR_SPEED_THRESHOLD_SQUARED;
			lastX = nextX;
			lastY = nextY;
			lastCursorTime = currentTime;
			return distanceSquared < thresholdSquared;
		}
		function close$1() {
			timeout.clear();
			onClose();
		}
		return function onMouseMove(event) {
			timeout.clear();
			const domReference = elements.domReference;
			const floating = elements.floating;
			if (!domReference || !floating || side == null || x == null || y == null) return;
			const { clientX, clientY } = event;
			const target = getTarget(event);
			const isLeave = event.type === "mouseleave";
			const isOverFloatingEl = contains(floating, target);
			const isOverReferenceEl = contains(domReference, target);
			if (isOverFloatingEl) {
				hasLanded = true;
				if (!isLeave) return;
			}
			if (isOverReferenceEl) {
				hasLanded = false;
				if (!isLeave) {
					hasLanded = true;
					return;
				}
			}
			if (isLeave && isElement(event.relatedTarget) && contains(floating, event.relatedTarget)) return;
			function hasOpenChildNode() {
				return Boolean(tree && getNodeChildren(tree.nodesRef.current, nodeId).length > 0);
			}
			function closeIfNoOpenChild() {
				if (!hasOpenChildNode()) close$1();
			}
			if (hasOpenChildNode()) return;
			const refRect = domReference.getBoundingClientRect();
			const rect = floating.getBoundingClientRect();
			const cursorLeaveFromRight = x > rect.right - rect.width / 2;
			const cursorLeaveFromBottom = y > rect.bottom - rect.height / 2;
			const isFloatingWider = rect.width > refRect.width;
			const isFloatingTaller = rect.height > refRect.height;
			const left = (isFloatingWider ? refRect : rect).left;
			const right = (isFloatingWider ? refRect : rect).right;
			const top = (isFloatingTaller ? refRect : rect).top;
			const bottom = (isFloatingTaller ? refRect : rect).bottom;
			if (side === "top" && y >= refRect.bottom - 1 || side === "bottom" && y <= refRect.top + 1 || side === "left" && x >= refRect.right - 1 || side === "right" && x <= refRect.left + 1) {
				closeIfNoOpenChild();
				return;
			}
			let isInsideTroughRect = false;
			switch (side) {
				case "top":
					isInsideTroughRect = isInsideAxisAlignedRect(clientX, clientY, left, refRect.top + 1, right, rect.bottom - 1);
					break;
				case "bottom":
					isInsideTroughRect = isInsideAxisAlignedRect(clientX, clientY, left, rect.top + 1, right, refRect.bottom - 1);
					break;
				case "left":
					isInsideTroughRect = isInsideAxisAlignedRect(clientX, clientY, rect.right - 1, bottom, refRect.left + 1, top);
					break;
				case "right":
					isInsideTroughRect = isInsideAxisAlignedRect(clientX, clientY, refRect.right - 1, bottom, rect.left + 1, top);
					break;
				default:
			}
			if (isInsideTroughRect) return;
			if (hasLanded && !isInsideRect(clientX, clientY, refRect)) {
				closeIfNoOpenChild();
				return;
			}
			if (!isLeave && isCursorMovingSlowly(clientX, clientY)) {
				closeIfNoOpenChild();
				return;
			}
			let isInsidePolygon = false;
			switch (side) {
				case "top": {
					const cursorXOffset = isFloatingWider ? POLYGON_BUFFER / 2 : POLYGON_BUFFER * 4;
					const cursorPointOneX = isFloatingWider ? x + cursorXOffset : cursorLeaveFromRight ? x + cursorXOffset : x - cursorXOffset;
					const cursorPointTwoX = isFloatingWider ? x - cursorXOffset : cursorLeaveFromRight ? x + cursorXOffset : x - cursorXOffset;
					const cursorPointY = y + POLYGON_BUFFER + 1;
					const commonYLeft = cursorLeaveFromRight ? rect.bottom - POLYGON_BUFFER : isFloatingWider ? rect.bottom - POLYGON_BUFFER : rect.top;
					const commonYRight = cursorLeaveFromRight ? isFloatingWider ? rect.bottom - POLYGON_BUFFER : rect.top : rect.bottom - POLYGON_BUFFER;
					isInsidePolygon = isPointInQuadrilateral(clientX, clientY, cursorPointOneX, cursorPointY, cursorPointTwoX, cursorPointY, rect.left, commonYLeft, rect.right, commonYRight);
					break;
				}
				case "bottom": {
					const cursorXOffset = isFloatingWider ? POLYGON_BUFFER / 2 : POLYGON_BUFFER * 4;
					const cursorPointOneX = isFloatingWider ? x + cursorXOffset : cursorLeaveFromRight ? x + cursorXOffset : x - cursorXOffset;
					const cursorPointTwoX = isFloatingWider ? x - cursorXOffset : cursorLeaveFromRight ? x + cursorXOffset : x - cursorXOffset;
					const cursorPointY = y - POLYGON_BUFFER;
					const commonYLeft = cursorLeaveFromRight ? rect.top + POLYGON_BUFFER : isFloatingWider ? rect.top + POLYGON_BUFFER : rect.bottom;
					const commonYRight = cursorLeaveFromRight ? isFloatingWider ? rect.top + POLYGON_BUFFER : rect.bottom : rect.top + POLYGON_BUFFER;
					isInsidePolygon = isPointInQuadrilateral(clientX, clientY, cursorPointOneX, cursorPointY, cursorPointTwoX, cursorPointY, rect.left, commonYLeft, rect.right, commonYRight);
					break;
				}
				case "left": {
					const cursorYOffset = isFloatingTaller ? POLYGON_BUFFER / 2 : POLYGON_BUFFER * 4;
					const cursorPointOneY = isFloatingTaller ? y + cursorYOffset : cursorLeaveFromBottom ? y + cursorYOffset : y - cursorYOffset;
					const cursorPointTwoY = isFloatingTaller ? y - cursorYOffset : cursorLeaveFromBottom ? y + cursorYOffset : y - cursorYOffset;
					const cursorPointX = x + POLYGON_BUFFER + 1;
					const commonXTop = cursorLeaveFromBottom ? rect.right - POLYGON_BUFFER : isFloatingTaller ? rect.right - POLYGON_BUFFER : rect.left;
					const commonXBottom = cursorLeaveFromBottom ? isFloatingTaller ? rect.right - POLYGON_BUFFER : rect.left : rect.right - POLYGON_BUFFER;
					isInsidePolygon = isPointInQuadrilateral(clientX, clientY, commonXTop, rect.top, commonXBottom, rect.bottom, cursorPointX, cursorPointOneY, cursorPointX, cursorPointTwoY);
					break;
				}
				case "right": {
					const cursorYOffset = isFloatingTaller ? POLYGON_BUFFER / 2 : POLYGON_BUFFER * 4;
					const cursorPointOneY = isFloatingTaller ? y + cursorYOffset : cursorLeaveFromBottom ? y + cursorYOffset : y - cursorYOffset;
					const cursorPointTwoY = isFloatingTaller ? y - cursorYOffset : cursorLeaveFromBottom ? y + cursorYOffset : y - cursorYOffset;
					const cursorPointX = x - POLYGON_BUFFER;
					const commonXTop = cursorLeaveFromBottom ? rect.left + POLYGON_BUFFER : isFloatingTaller ? rect.left + POLYGON_BUFFER : rect.right;
					const commonXBottom = cursorLeaveFromBottom ? isFloatingTaller ? rect.left + POLYGON_BUFFER : rect.right : rect.left + POLYGON_BUFFER;
					isInsidePolygon = isPointInQuadrilateral(clientX, clientY, cursorPointX, cursorPointOneY, cursorPointX, cursorPointTwoY, commonXTop, rect.top, commonXBottom, rect.bottom);
					break;
				}
				default:
			}
			if (!isInsidePolygon) closeIfNoOpenChild();
			else if (!hasLanded) timeout.start(40, closeIfNoOpenChild);
		};
	};
	fn.__options = {
		...options,
		blockPointerEvents
	};
	return fn;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/popover/root/PopoverRootContext.mjs
const PopoverRootContext = /* @__PURE__ */ react.createContext(void 0);
function usePopoverRootContext(optional) {
	const context = react.useContext(PopoverRootContext);
	if (context === void 0 && !optional) throw new Error(formatErrorMessage_default(47));
	return context;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/popover/store/PopoverStore.mjs
const selectors = {
	...popupStoreSelectors,
	disabled: (state) => state.disabled,
	instantType: (state) => state.instantType,
	openMethod: (state) => state.openMethod,
	openChangeReason: (state) => state.openChangeReason,
	modal: (state) => state.modal,
	focusManagerModal: (state) => state.focusManagerModal,
	stickIfOpen: (state) => state.stickIfOpen,
	titleElementId: (state) => state.titleElementId,
	descriptionElementId: (state) => state.descriptionElementId,
	openOnHover: (state) => state.openOnHover,
	closeDelay: (state) => state.closeDelay,
	adaptiveOrigin: (state) => state.adaptiveOrigin
};
/**
* The store view that detached handle-backed triggers read from. Both the real `PopoverStore` and
* the inert fallback store satisfy it, so a trigger can read from whichever store the handle
* currently exposes. Narrowed to the members a trigger actually uses — the trigger-data members plus
* `setOpen` (called by the focus guards) — so the exposed surface can't bypass the open-change
* pipeline; on the detached fallback store every one of these mutations is a no-op.
*/
var PopoverStore = class extends ReactStore {
	constructor(initialState, floatingId, nested) {
		const triggerElements = new PopupTriggerMap();
		super(createInitialState(initialState, triggerElements, floatingId, nested), createInitialContext(triggerElements), selectors);
	}
	setOpen = (nextOpen, eventDetails) => {
		const isHover = eventDetails.reason === triggerHover;
		const isKeyboardClick = eventDetails.reason === triggerPress && eventDetails.event.detail === 0;
		const isDismissClose = !nextOpen && (eventDetails.reason === escapeKey || eventDetails.reason == null);
		const shouldPreventUnmountOnClose = attachPreventUnmountOnClose(eventDetails);
		const activeTriggerId = this.select("activeTriggerId");
		if (!nextOpen && eventDetails.reason === closePress && eventDetails.trigger == null && activeTriggerId != null) eventDetails.trigger = this.context.triggerElements.getById(activeTriggerId) ?? this.select("activeTriggerElement") ?? void 0;
		this.context.onOpenChange?.(nextOpen, eventDetails);
		if (eventDetails.isCanceled) return;
		this.state.floatingRootContext.dispatchOpenChange(nextOpen, eventDetails);
		const changeState = () => {
			const updatedState = {
				open: nextOpen,
				openChangeReason: eventDetails.reason
			};
			setPopupOpenState(updatedState, nextOpen, eventDetails.trigger, shouldPreventUnmountOnClose());
			this.update(updatedState);
		};
		if (isHover) {
			this.set("stickIfOpen", true);
			this.context.stickIfOpenTimeout.start(PATIENT_CLICK_THRESHOLD, () => {
				this.set("stickIfOpen", false);
			});
			react_dom.flushSync(changeState);
		} else changeState();
		let instantType;
		if (isKeyboardClick) instantType = "click";
		else if (isDismissClose) instantType = "dismiss";
		else if (eventDetails.reason === focusOut) instantType = "focus";
		this.set("instantType", instantType);
	};
};
function createInitialState(initialState, triggerElements, floatingId, nested = false) {
	const state = {
		...createInitialPopupStoreState(),
		disabled: false,
		modal: false,
		focusManagerModal: false,
		instantType: void 0,
		openMethod: null,
		openChangeReason: null,
		titleElementId: void 0,
		descriptionElementId: void 0,
		stickIfOpen: true,
		openOnHover: false,
		closeDelay: 0,
		adaptiveOrigin: void 0,
		...initialState
	};
	if (state.open && initialState?.mounted === void 0) state.mounted = true;
	state.floatingRootContext = createPopupFloatingRootContext(triggerElements, floatingId, nested);
	return state;
}
function createInitialContext(triggerElements) {
	return {
		popupRef: /* @__PURE__ */ react.createRef(),
		onOpenChange: void 0,
		onOpenChangeComplete: void 0,
		triggerFocusTargetRef: /* @__PURE__ */ react.createRef(),
		beforeContentFocusGuardRef: /* @__PURE__ */ react.createRef(),
		stickIfOpenTimeout: new Timeout(),
		triggerElements
	};
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/popover/root/PopoverRoot.mjs
function PopoverRootComponent({ props }) {
	const { children, open: openProp, defaultOpen = false, onOpenChange, onOpenChangeComplete, modal = false, handle, triggerId: triggerIdProp, defaultTriggerId: defaultTriggerIdProp = null } = props;
	const store$2 = usePopoverRootStore(handle, {
		modal,
		open: defaultOpen,
		openProp,
		activeTriggerId: defaultTriggerIdProp,
		triggerIdProp
	});
	store$2.useControlledProp("openProp", openProp);
	store$2.useControlledProp("triggerIdProp", triggerIdProp);
	const open = store$2.useState("open");
	const mounted = store$2.useState("mounted");
	const payload = store$2.useState("payload");
	store$2.useContextCallback("onOpenChange", onOpenChange);
	store$2.useContextCallback("onOpenChangeComplete", onOpenChangeComplete);
	usePopupRootSync(store$2, open);
	useImplicitActiveTrigger(store$2);
	const { forceUnmount } = useOpenStateTransitions(open, store$2, () => {
		store$2.update({
			stickIfOpen: true,
			openChangeReason: null
		});
	});
	store$2.useSyncedValues({ modal });
	react.useEffect(() => {
		if (!open) store$2.context.stickIfOpenTimeout.clear();
	}, [store$2, open]);
	react.useImperativeHandle(props.actionsRef, () => ({
		unmount: forceUnmount,
		close: () => store$2.setOpen(false, createChangeEventDetails(imperativeAction))
	}), [forceUnmount, store$2]);
	const shouldRenderInteractions = open || mounted;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(PopoverRootContext.Provider, {
		value: store$2,
		children: [
			handle && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PopupHandleAttachment, {
				handle,
				store: store$2
			}),
			shouldRenderInteractions && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PopoverInteractions, {
				store: store$2,
				modal
			}),
			typeof children === "function" ? children({ payload }) : children
		]
	});
}
/**
* Groups all parts of the popover.
* Doesn't render its own HTML element.
*
* Documentation: [Base UI Popover](https://base-ui.com/react/components/popover)
*/
function PopoverRoot(props) {
	if (usePopoverRootContext(true)) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PopoverRootComponent, { props });
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FloatingTree, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PopoverRootComponent, { props }) });
}
function usePopoverRootStore(handle, initialState) {
	const store$2 = usePopupRootStore((floatingId, nested) => new PopoverStore(initialState, floatingId, nested));
	react.useEffect(() => store$2.context.stickIfOpenTimeout.disposeEffect(), [store$2]);
	return store$2;
}
function PopoverInteractions({ store: store$2, modal }) {
	const dismiss = useDismiss(store$2.useState("floatingRootContext"), { outsidePressEvent: {
		mouse: modal === "trap-focus" ? "sloppy" : "intentional",
		touch: "sloppy"
	} });
	const triggerProps = dismiss.reference;
	const popupProps = dismiss.floating;
	usePopupInteractionProps(store$2, {
		activeTriggerProps: triggerProps,
		inactiveTriggerProps: triggerProps,
		popupProps
	});
	return null;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/utils/popupStateMapping.mjs
let CommonPopupDataAttributes = function(CommonPopupDataAttributes$1) {
	/**
	* Present when the popup is open.
	*/
	CommonPopupDataAttributes$1["open"] = "data-open";
	/**
	* Present when the popup is closed.
	*/
	CommonPopupDataAttributes$1["closed"] = "data-closed";
	/**
	* Present when the popup begins animating in.
	*/
	CommonPopupDataAttributes$1[CommonPopupDataAttributes$1["startingStyle"] = TransitionStatusDataAttributes.startingStyle] = "startingStyle";
	/**
	* Present when the popup is animating out.
	*/
	CommonPopupDataAttributes$1[CommonPopupDataAttributes$1["endingStyle"] = TransitionStatusDataAttributes.endingStyle] = "endingStyle";
	/**
	* Present when the anchor is hidden.
	*/
	CommonPopupDataAttributes$1["anchorHidden"] = "data-anchor-hidden";
	/**
	* Indicates which side the popup is positioned relative to the trigger.
	* @type { 'top' | 'bottom' | 'left' | 'right' | 'inline-end' | 'inline-start'}
	*/
	CommonPopupDataAttributes$1["side"] = "data-side";
	/**
	* Indicates how the popup is aligned relative to specified side.
	* @type {'start' | 'center' | 'end'}
	*/
	CommonPopupDataAttributes$1["align"] = "data-align";
	return CommonPopupDataAttributes$1;
}({});
const TRIGGER_HOOK = { "data-popup-open": "" };
const PRESSABLE_TRIGGER_HOOK = {
	"data-popup-open": "",
	"data-pressed": ""
};
const POPUP_OPEN_HOOK = { "data-open": "" };
const POPUP_CLOSED_HOOK = { "data-closed": "" };
const ANCHOR_HIDDEN_HOOK = { "data-anchor-hidden": "" };
const triggerOpenStateMapping = { open(value) {
	if (value) return TRIGGER_HOOK;
	return null;
} };
const pressableTriggerOpenStateMapping = { open(value) {
	if (value) return PRESSABLE_TRIGGER_HOOK;
	return null;
} };
const popupStateMapping = {
	open(value) {
		if (value) return POPUP_OPEN_HOOK;
		return POPUP_CLOSED_HOOK;
	},
	anchorHidden(value) {
		if (value) return ANCHOR_HIDDEN_HOOK;
		return null;
	}
};
const popupTransitionStateMapping = {
	...popupStateMapping,
	...transitionStatusMapping
};

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/popover/utils/constants.mjs
const OPEN_DELAY = 300;

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/utils/popups/useTriggerFocusGuards.mjs
/**
* Minimal store interface required by the focus guard hook.
* Both PopoverStore and MenuStore satisfy this interface.
*/
/**
* Provides focus guard handlers for popup triggers (Popover, Menu).
*
* When the popup is open, invisible focus guard elements are placed before and after
* the trigger. These handlers close the popup and move focus to the appropriate
* tabbable element when the guards receive focus (i.e. when the user tabs out).
*/
function useTriggerFocusGuards(store$2, triggerElementRef) {
	const preFocusGuardRef = react.useRef(null);
	function handlePreFocusGuardFocus(event) {
		react_dom.flushSync(() => {
			store$2.setOpen(false, createChangeEventDetails(focusOut, event.nativeEvent, event.currentTarget));
		});
		getTabbableBeforeElement(preFocusGuardRef.current)?.focus();
	}
	function handleFocusTargetFocus(event) {
		const positionerElement = store$2.select("positionerElement");
		if (positionerElement && isOutsideEvent(event, positionerElement)) store$2.context.beforeContentFocusGuardRef.current?.focus();
		else {
			react_dom.flushSync(() => {
				store$2.setOpen(false, createChangeEventDetails(focusOut, event.nativeEvent, event.currentTarget));
			});
			let nextTabbable = getTabbableAfterElement(store$2.context.triggerFocusTargetRef.current || triggerElementRef.current);
			while (nextTabbable !== null && contains(positionerElement, nextTabbable)) {
				const prevTabbable = nextTabbable;
				nextTabbable = getNextTabbable(nextTabbable);
				if (nextTabbable === prevTabbable) break;
			}
			nextTabbable?.focus();
		}
	}
	return {
		preFocusGuardRef,
		handlePreFocusGuardFocus,
		handleFocusTargetFocus
	};
}

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/useEnhancedClickHandler.mjs
/**
* Provides a cross-browser way to determine the type of the pointer used to click.
* Safari and Firefox do not provide the PointerEvent to the click handler (they use MouseEvent) yet.
* Additionally, this implementation detects if the click was triggered by the keyboard.
*
* @param handler The function to be called when the button is clicked. The first parameter is the original event and the second parameter is the pointer type.
*/
function useEnhancedClickHandler(handler) {
	const lastClickInteractionTypeRef = react.useRef("");
	const handlePointerDown = react.useCallback((event) => {
		if (event.defaultPrevented) return;
		lastClickInteractionTypeRef.current = event.pointerType;
		handler(event, event.pointerType);
	}, [handler]);
	return {
		onClick: react.useCallback((event) => {
			if (event.detail === 0) {
				handler(event, "keyboard");
				return;
			}
			if ("pointerType" in event) handler(event, event.pointerType);
			else handler(event, lastClickInteractionTypeRef.current);
			lastClickInteractionTypeRef.current = "";
		}, [handler]),
		onPointerDown: handlePointerDown
	};
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/utils/useOpenInteractionType.mjs
function useOpenMethodTriggerProps(open, setOpenMethod) {
	const { onClick, onPointerDown } = useEnhancedClickHandler(useStableCallback((_, interactionType) => {
		if (!(typeof open === "function" ? open() : open)) setOpenMethod(interactionType || (ios ? "touch" : ""));
	}));
	return react.useMemo(() => ({
		onClick,
		onPointerDown
	}), [onClick, onPointerDown]);
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/popover/trigger/PopoverTrigger.mjs
const PopoverTrigger = /* @__PURE__ */ react.forwardRef(function PopoverTrigger$1(componentProps, forwardedRef) {
	const { render, className, style, disabled: disabled$1 = false, nativeButton = true, handle, payload, openOnHover = false, delay = OPEN_DELAY, closeDelay = 0, id: idProp,...elementProps } = componentProps;
	const rootStore = usePopoverRootContext(true);
	const store$2 = usePopupHandleStore(handle) ?? rootStore;
	if (!store$2) throw new Error(formatErrorMessage_default(74));
	const thisTriggerId = useBaseUiId(idProp);
	const isTriggerActive = store$2.useState("isTriggerActive", thisTriggerId);
	const floatingContext = store$2.useState("floatingRootContext");
	const isOpenedByThisTrigger = store$2.useState("isOpenedByTrigger", thisTriggerId);
	const popupId = store$2.useState("triggerPopupId", thisTriggerId);
	const triggerElementRef = react.useRef(null);
	const { registerTrigger, isMountedByThisTrigger } = useTriggerDataForwarding(thisTriggerId, triggerElementRef, store$2, {
		payload,
		disabled: disabled$1,
		openOnHover,
		closeDelay
	});
	const openReason = store$2.useState("openChangeReason");
	const stickIfOpen = store$2.useState("stickIfOpen");
	const openMethod = store$2.useState("openMethod");
	const focusManagerModal = store$2.useState("focusManagerModal");
	const hoverProps = useHoverReferenceInteraction(floatingContext, {
		enabled: !disabled$1 && openOnHover && (openMethod !== "touch" || openReason !== triggerPress),
		mouseOnly: true,
		move: false,
		handleClose: safePolygon(),
		restMs: delay,
		delay: { close: closeDelay },
		triggerElementRef,
		isActiveTrigger: isTriggerActive,
		isClosing: () => store$2.select("transitionStatus") === "ending"
	});
	const click = useClick(floatingContext, { stickIfOpen });
	const interactionTypeProps = useOpenMethodTriggerProps(() => store$2.select("open"), (interactionType) => {
		store$2.set("openMethod", interactionType);
	});
	const rootTriggerProps = store$2.useState("triggerProps", isMountedByThisTrigger);
	const { getButtonProps, buttonRef } = useButton({
		disabled: disabled$1,
		native: nativeButton
	});
	const stateAttributesMapping$3 = { open(value) {
		if (value && openReason === triggerPress) return pressableTriggerOpenStateMapping.open(value);
		return triggerOpenStateMapping.open(value);
	} };
	const { preFocusGuardRef, handlePreFocusGuardFocus, handleFocusTargetFocus } = useTriggerFocusGuards(store$2, triggerElementRef);
	const element = useRenderElement("button", componentProps, {
		state: {
			disabled: disabled$1,
			open: isOpenedByThisTrigger
		},
		ref: [
			buttonRef,
			forwardedRef,
			registerTrigger,
			triggerElementRef
		],
		props: [
			click.reference,
			hoverProps,
			rootTriggerProps,
			interactionTypeProps,
			{
				[CLICK_TRIGGER_IDENTIFIER]: "",
				id: thisTriggerId,
				"aria-haspopup": "dialog",
				"aria-expanded": isOpenedByThisTrigger,
				"aria-controls": popupId
			},
			elementProps,
			getButtonProps
		],
		stateAttributesMapping: stateAttributesMapping$3
	});
	const keyedElement = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react.Fragment, { children: element }, thisTriggerId);
	if (isMountedByThisTrigger && !focusManagerModal) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react.Fragment, { children: [
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)(FocusGuard, {
			ref: preFocusGuardRef,
			onFocus: handlePreFocusGuardFocus
		}),
		keyedElement,
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)(FocusGuard, {
			ref: store$2.context.triggerFocusTargetRef,
			onFocus: handleFocusTargetFocus
		})
	] });
	return keyedElement;
});

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/popover/portal/PopoverPortalContext.mjs
const PopoverPortalContext = /* @__PURE__ */ react.createContext(void 0);
function usePopoverPortalContext() {
	const value = react.useContext(PopoverPortalContext);
	if (value === void 0) throw new Error(formatErrorMessage_default(45));
	return value;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/popover/portal/PopoverPortal.mjs
const PopoverPortal = /* @__PURE__ */ react.forwardRef(function PopoverPortal$1(props, forwardedRef) {
	const { keepMounted = false,...portalProps } = props;
	if (!(usePopoverRootContext().useState("mounted") || keepMounted)) return null;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PopoverPortalContext.Provider, {
		value: keepMounted,
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FloatingPortal, {
			ref: forwardedRef,
			...portalProps
		})
	});
});

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/popover/positioner/PopoverPositionerContext.mjs
const PopoverPositionerContext = /* @__PURE__ */ react.createContext(void 0);
function usePopoverPositionerContext() {
	const context = react.useContext(PopoverPositionerContext);
	if (!context) throw new Error(formatErrorMessage_default(46));
	return context;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/floating-ui-react/middleware/arrow.mjs
/**
* Fork of the original `arrow` middleware from Floating UI that allows
* configuring the offset parent.
*/
const baseArrow = (options) => ({
	name: "arrow",
	options,
	async fn(state) {
		const { x, y, placement, rects, platform: platform$2, elements, middlewareData } = state;
		const { element, padding = 0, offsetParent = "real" } = evaluate(options, state) || {};
		if (element == null) return {};
		const paddingObject = getPaddingObject(padding);
		const coords = {
			x,
			y
		};
		const axis = getAlignmentAxis(placement);
		const length = getAxisLength(axis);
		const arrowDimensions = await platform$2.getDimensions(element);
		const isYAxis = axis === "y";
		const minProp = isYAxis ? "top" : "left";
		const maxProp = isYAxis ? "bottom" : "right";
		const clientProp = isYAxis ? "clientHeight" : "clientWidth";
		const endDiff = rects.reference[length] + rects.reference[axis] - coords[axis] - rects.floating[length];
		const startDiff = coords[axis] - rects.reference[axis];
		const arrowOffsetParent = offsetParent === "real" ? await platform$2.getOffsetParent?.(element) : elements.floating;
		let clientSize = elements.floating[clientProp] || rects.floating[length];
		if (!clientSize || !await platform$2.isElement?.(arrowOffsetParent)) clientSize = elements.floating[clientProp] || rects.floating[length];
		const centerToReference = endDiff / 2 - startDiff / 2;
		const largestPossiblePadding = clientSize / 2 - arrowDimensions[length] / 2 - 1;
		const minPadding = Math.min(paddingObject[minProp], largestPossiblePadding);
		const maxPadding = Math.min(paddingObject[maxProp], largestPossiblePadding);
		const min$1 = minPadding;
		const max$1 = clientSize - arrowDimensions[length] - maxPadding;
		const center = clientSize / 2 - arrowDimensions[length] / 2 + centerToReference;
		const offset$3 = clamp(min$1, center, max$1);
		const shouldAddOffset = !middlewareData.arrow && getAlignment(placement) != null && center !== offset$3 && rects.reference[length] / 2 - (center < min$1 ? minPadding : maxPadding) - arrowDimensions[length] / 2 < 0;
		const alignmentOffset = shouldAddOffset ? center < min$1 ? center - min$1 : center - max$1 : 0;
		return {
			[axis]: coords[axis] + alignmentOffset,
			data: {
				[axis]: offset$3,
				centerOffset: center - offset$3 - alignmentOffset,
				...shouldAddOffset && { alignmentOffset }
			},
			reset: shouldAddOffset
		};
	}
});
/**
* Provides data to position an inner element of the floating element so that it
* appears centered to the reference element.
* This wraps the core `arrow` middleware to allow React refs as the element.
* @see https://floating-ui.com/docs/arrow
*/
const arrow = (options, deps) => ({
	...baseArrow(options),
	options: [options, deps]
});

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/utils/hideMiddleware.mjs
const hide = {
	name: "hide",
	async fn(state) {
		const { width, height, x, y } = state.rects.reference;
		const anchorHidden = width === 0 && height === 0 && x === 0 && y === 0;
		const overflow = await state.platform.detectOverflow(state, { elementContext: "reference" });
		return { data: { referenceHidden: overflow.top - height >= 0 || overflow.right - width >= 0 || overflow.bottom - height >= 0 || overflow.left - width >= 0 || anchorHidden } };
	}
};

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/utils/adaptiveOriginConstants.mjs
const DEFAULT_SIDES = {
	sideX: "left",
	sideY: "top"
};

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/useAnchorPositioning.mjs
const AVAILABLE_WIDTH_VAR = "--available-width";
const AVAILABLE_HEIGHT_VAR = "--available-height";
function getLogicalSide(sideParam, renderedSide, isRtl) {
	const isLogicalSideParam = sideParam === "inline-start" || sideParam === "inline-end";
	return {
		top: "top",
		right: isLogicalSideParam ? isRtl ? "inline-start" : "inline-end" : "right",
		bottom: "bottom",
		left: isLogicalSideParam ? isRtl ? "inline-end" : "inline-start" : "left"
	}[renderedSide];
}
function getOffsetData(state, sideParam, isRtl) {
	const { rects, placement } = state;
	return {
		side: getLogicalSide(sideParam, getSide(placement), isRtl),
		align: getAlignment(placement) || "center",
		anchor: {
			width: rects.reference.width,
			height: rects.reference.height
		},
		positioner: {
			width: rects.floating.width,
			height: rects.floating.height
		}
	};
}
/**
* Provides standardized anchor positioning behavior for floating elements. Wraps Floating UI's
* `useFloating` hook.
*/
function useAnchorPositioning(params) {
	return useAnchorPositioningWithHook(params, useBaseUIFloating);
}
function useAnchorPositioningWithHook(params, useFloatingHook) {
	const { anchor, positionMethod = "absolute", side: sideParam = "bottom", sideOffset = 0, align = "center", alignOffset = 0, collisionBoundary, collisionPadding: collisionPaddingParam = 5, sticky = false, arrowPadding = 5, disableAnchorTracking = false, inline: inlineMiddleware, keepMounted = false, floatingRootContext, mounted, collisionAvoidance, shift: shift$3, nodeId, adaptiveOrigin, lazyFlip = false, externalTree } = params;
	const [mountSide, setMountSide] = react.useState(null);
	if (!mounted && mountSide !== null) setMountSide(null);
	const collisionAvoidanceSide = collisionAvoidance.side || "flip";
	const collisionAvoidanceAlign = collisionAvoidance.align || "flip";
	const collisionAvoidanceFallbackAxisSide = collisionAvoidance.fallbackAxisSide || "end";
	const shiftCrossAxis = shift$3?.crossAxis ?? false;
	const shiftRootBoundary = shift$3?.rootBoundary;
	const anchorFn = typeof anchor === "function" ? anchor : void 0;
	const anchorFnCallback = useStableCallback(anchorFn);
	const anchorDep = anchorFn ? anchorFnCallback : anchor;
	const anchorValueRef = useValueAsRef(anchor);
	const mountedRef = useValueAsRef(mounted);
	const isRtl = useDirection() === "rtl";
	const side = mountSide || {
		top: "top",
		right: "right",
		bottom: "bottom",
		left: "left",
		"inline-end": isRtl ? "left" : "right",
		"inline-start": isRtl ? "right" : "left"
	}[sideParam];
	const placement = align === "center" ? side : `${side}-${align}`;
	let collisionPadding = collisionPaddingParam;
	if (typeof collisionPadding === "number") collisionPadding = {
		top: collisionPadding,
		right: collisionPadding,
		bottom: collisionPadding,
		left: collisionPadding
	};
	else if (collisionPadding) collisionPadding = {
		top: collisionPadding.top || 0,
		right: collisionPadding.right || 0,
		bottom: collisionPadding.bottom || 0,
		left: collisionPadding.left || 0
	};
	const bias = 1;
	const biasTop = sideParam === "bottom" ? bias : 0;
	const biasBottom = sideParam === "top" ? bias : 0;
	const biasLeft = sideParam === "right" ? bias : 0;
	const biasRight = sideParam === "left" ? bias : 0;
	const commonCollisionProps = {
		boundary: collisionBoundary === "clipping-ancestors" ? "clippingAncestors" : collisionBoundary,
		padding: collisionPadding
	};
	const arrowRef = react.useRef(null);
	const sideOffsetRef = useValueAsRef(sideOffset);
	const alignOffsetRef = useValueAsRef(alignOffset);
	const sideOffsetDep = typeof sideOffset !== "function" ? sideOffset : 0;
	const alignOffsetDep = typeof alignOffset !== "function" ? alignOffset : 0;
	const middleware = [];
	if (inlineMiddleware) middleware.push(inlineMiddleware);
	middleware.push(offset((state) => {
		const data = getOffsetData(state, sideParam, isRtl);
		const sideAxis = typeof sideOffsetRef.current === "function" ? sideOffsetRef.current(data) : sideOffsetRef.current;
		const alignAxis = typeof alignOffsetRef.current === "function" ? alignOffsetRef.current(data) : alignOffsetRef.current;
		return {
			mainAxis: sideAxis,
			crossAxis: alignAxis,
			alignmentAxis: alignAxis
		};
	}, [
		sideOffsetDep,
		alignOffsetDep,
		isRtl,
		sideParam
	]));
	const shiftDisabled = collisionAvoidanceAlign === "none" && collisionAvoidanceSide !== "shift";
	const crossAxisShiftEnabled = !shiftDisabled && (sticky || shiftCrossAxis || collisionAvoidanceSide === "shift");
	const flipMiddleware = collisionAvoidanceSide === "none" ? null : flip({
		...commonCollisionProps,
		padding: {
			top: collisionPadding.top + bias + biasTop,
			right: collisionPadding.right + bias + biasRight,
			bottom: collisionPadding.bottom + bias + biasBottom,
			left: collisionPadding.left + bias + biasLeft
		},
		mainAxis: !shiftCrossAxis && collisionAvoidanceSide === "flip",
		crossAxis: collisionAvoidanceAlign === "flip" ? "alignment" : false,
		fallbackAxisSideDirection: collisionAvoidanceFallbackAxisSide
	});
	const shiftMiddleware = shiftDisabled ? null : shift({
		...commonCollisionProps,
		rootBoundary: shiftRootBoundary,
		mainAxis: collisionAvoidanceAlign !== "none",
		crossAxis: crossAxisShiftEnabled,
		limiter: sticky || shiftCrossAxis ? void 0 : limitShift((limitData) => {
			if (!arrowRef.current) return {};
			const { width, height } = arrowRef.current.getBoundingClientRect();
			const sideAxis = getSideAxis(getSide(limitData.placement));
			const arrowSize = sideAxis === "y" ? width : height;
			const offsetAmount = sideAxis === "y" ? collisionPadding.left + collisionPadding.right : collisionPadding.top + collisionPadding.bottom;
			return { offset: arrowSize / 2 + offsetAmount / 2 };
		})
	}, [
		commonCollisionProps,
		sticky,
		shiftCrossAxis,
		shiftRootBoundary,
		collisionPadding,
		collisionAvoidanceAlign
	]);
	if (collisionAvoidanceSide === "shift" || collisionAvoidanceAlign === "shift" || align === "center") middleware.push(shiftMiddleware, flipMiddleware);
	else middleware.push(flipMiddleware, shiftMiddleware);
	middleware.push(size({
		...commonCollisionProps,
		apply({ elements: { floating }, availableWidth, availableHeight, rects }) {
			if (!mountedRef.current) return;
			const floatingStyle = floating.style;
			floatingStyle.setProperty(AVAILABLE_WIDTH_VAR, `${availableWidth}px`);
			floatingStyle.setProperty(AVAILABLE_HEIGHT_VAR, `${availableHeight}px`);
			const dpr = getWindow(floating).devicePixelRatio || 1;
			const { x: x$1, y: y$1, width, height } = rects.reference;
			const anchorWidth = (Math.round((x$1 + width) * dpr) - Math.round(x$1 * dpr)) / dpr;
			const anchorHeight = (Math.round((y$1 + height) * dpr) - Math.round(y$1 * dpr)) / dpr;
			floatingStyle.setProperty("--anchor-width", `${anchorWidth}px`);
			floatingStyle.setProperty("--anchor-height", `${anchorHeight}px`);
		}
	}), arrow((state) => ({
		element: arrowRef.current || ownerDocument(state.elements.floating).createElement("div"),
		padding: arrowPadding,
		offsetParent: "floating"
	}), [arrowPadding]), {
		name: "transformOrigin",
		fn(state) {
			const { elements: elements$1, middlewareData: middlewareData$1, placement: renderedPlacement$1, rects, y: y$1 } = state;
			const currentRenderedSide = getSide(renderedPlacement$1);
			const currentRenderedAxis = getSideAxis(currentRenderedSide);
			const arrowEl = arrowRef.current;
			const arrowX = middlewareData$1.arrow?.x || 0;
			const arrowY = middlewareData$1.arrow?.y || 0;
			const arrowWidth = arrowEl?.clientWidth || 0;
			const arrowHeight = arrowEl?.clientHeight || 0;
			const transformX = arrowX + arrowWidth / 2;
			const transformY = arrowY + arrowHeight / 2;
			const shiftY = Math.abs(middlewareData$1.shift?.y || 0);
			const halfAnchorHeight = rects.reference.height / 2;
			const sideOffsetValue = typeof sideOffset === "function" ? sideOffset(getOffsetData(state, sideParam, isRtl)) : sideOffset;
			const isOverlappingAnchor = shiftY > sideOffsetValue;
			const adjacentTransformOrigin = {
				top: `${transformX}px calc(100% + ${sideOffsetValue}px)`,
				bottom: `${transformX}px ${-sideOffsetValue}px`,
				left: `calc(100% + ${sideOffsetValue}px) ${transformY}px`,
				right: `${-sideOffsetValue}px ${transformY}px`
			}[currentRenderedSide];
			const overlapTransformOrigin = `${transformX}px ${rects.reference.y + halfAnchorHeight - y$1}px`;
			elements$1.floating.style.setProperty("--transform-origin", crossAxisShiftEnabled && currentRenderedAxis === "y" && isOverlappingAnchor ? overlapTransformOrigin : adjacentTransformOrigin);
			return {};
		}
	}, hide, adaptiveOrigin);
	useIsoLayoutEffect(() => {
		if (!mounted && floatingRootContext) floatingRootContext.update({
			referenceElement: null,
			floatingElement: null,
			domReferenceElement: null,
			positionReference: null
		});
	}, [mounted, floatingRootContext]);
	const autoUpdateOptions = react.useMemo(() => ({
		elementResize: !disableAnchorTracking && typeof ResizeObserver !== "undefined",
		layoutShift: !disableAnchorTracking && typeof IntersectionObserver !== "undefined"
	}), [disableAnchorTracking]);
	const { refs, elements, x, y, middlewareData, update: update$1, placement: renderedPlacement, context, isPositioned, floatingStyles: originalFloatingStyles } = useFloatingHook({
		rootContext: floatingRootContext,
		open: keepMounted ? mounted : void 0,
		placement,
		middleware,
		strategy: positionMethod,
		whileElementsMounted: keepMounted ? void 0 : (...args) => autoUpdate(...args, autoUpdateOptions),
		nodeId,
		externalTree
	});
	const { sideX, sideY } = middlewareData.adaptiveOrigin || DEFAULT_SIDES;
	const resolvedPosition = isPositioned ? positionMethod : "fixed";
	const floatingStyles = react.useMemo(() => {
		let base;
		if (!isPositioned) base = {
			position: resolvedPosition,
			top: 0,
			left: 0
		};
		else if (adaptiveOrigin) base = {
			position: resolvedPosition,
			[sideX]: x,
			[sideY]: y
		};
		else base = {
			...originalFloatingStyles,
			position: resolvedPosition
		};
		base[AVAILABLE_WIDTH_VAR] = "100vw";
		base[AVAILABLE_HEIGHT_VAR] = "100vh";
		if (!isPositioned) base.opacity = 0;
		return base;
	}, [
		adaptiveOrigin,
		resolvedPosition,
		sideX,
		x,
		sideY,
		y,
		originalFloatingStyles,
		isPositioned
	]);
	const registeredPositionReferenceRef = react.useRef(null);
	useIsoLayoutEffect(() => {
		if (!mounted) return;
		const anchorValue = anchorValueRef.current;
		const resolvedAnchor = typeof anchorValue === "function" ? anchorValue() : anchorValue;
		const finalAnchor = (isRef(resolvedAnchor) ? resolvedAnchor.current : resolvedAnchor) || null;
		if (finalAnchor !== registeredPositionReferenceRef.current) {
			refs.setPositionReference(finalAnchor);
			registeredPositionReferenceRef.current = finalAnchor;
		}
	}, [
		mounted,
		refs,
		anchorDep,
		anchorValueRef
	]);
	react.useEffect(() => {
		if (!mounted) return;
		const anchorValue = anchorValueRef.current;
		if (typeof anchorValue === "function") return;
		if (isRef(anchorValue) && anchorValue.current !== registeredPositionReferenceRef.current) {
			refs.setPositionReference(anchorValue.current);
			registeredPositionReferenceRef.current = anchorValue.current;
		}
	}, [
		mounted,
		refs,
		anchorDep,
		anchorValueRef
	]);
	react.useEffect(() => {
		if (keepMounted && mounted && elements.reference && elements.floating) return autoUpdate(elements.reference, elements.floating, update$1, autoUpdateOptions);
	}, [
		keepMounted,
		mounted,
		elements,
		update$1,
		autoUpdateOptions
	]);
	const renderedSide = getSide(renderedPlacement);
	const logicalRenderedSide = getLogicalSide(sideParam, renderedSide, isRtl);
	const renderedAlign = getAlignment(renderedPlacement) || "center";
	const anchorHidden = Boolean(middlewareData.hide?.referenceHidden);
	useIsoLayoutEffect(() => {
		if (lazyFlip && mounted && isPositioned && renderedSide !== side) setMountSide(renderedSide);
	}, [
		lazyFlip,
		mounted,
		isPositioned,
		renderedSide,
		side
	]);
	const arrowStyles = react.useMemo(() => ({
		position: "absolute",
		top: middlewareData.arrow?.y,
		left: middlewareData.arrow?.x
	}), [middlewareData.arrow]);
	const arrowUncentered = middlewareData.arrow?.centerOffset !== 0;
	return react.useMemo(() => ({
		positionerStyles: floatingStyles,
		arrowStyles,
		arrowRef,
		arrowUncentered,
		side: logicalRenderedSide,
		align: renderedAlign,
		physicalSide: renderedSide,
		anchorHidden,
		refs,
		context,
		isPositioned,
		update: update$1
	}), [
		floatingStyles,
		arrowStyles,
		arrowRef,
		arrowUncentered,
		logicalRenderedSide,
		renderedAlign,
		renderedSide,
		anchorHidden,
		refs,
		context,
		isPositioned,
		update$1
	]);
}
function isRef(param) {
	return param != null && "current" in param;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/utils/InternalBackdrop.mjs
const InternalBackdrop = /* @__PURE__ */ react.forwardRef(function InternalBackdrop$1(props, ref) {
	const { cutout,...otherProps } = props;
	let clipPath;
	if (cutout) {
		const rect = cutout.getBoundingClientRect();
		clipPath = `polygon(0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${rect.left}px ${rect.top}px,${rect.left}px ${rect.bottom}px,${rect.right}px ${rect.bottom}px,${rect.right}px ${rect.top}px,${rect.left}px ${rect.top}px)`;
	}
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		ref,
		role: "presentation",
		"data-base-ui-inert": "",
		...otherProps,
		style: {
			position: "fixed",
			inset: 0,
			userSelect: "none",
			WebkitUserSelect: "none",
			clipPath
		}
	});
});

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/internals/getDisabledMountTransitionStyles.mjs
function getDisabledMountTransitionStyles(transitionStatus) {
	return transitionStatus === "starting" ? DISABLED_TRANSITIONS_STYLE : EMPTY_OBJECT;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/utils/usePositioner.mjs
/**
* Renders the shared outer Positioner element used by popup components.
* Applies the common role, hidden state, transition styles, state attributes, and optional inert styling.
*/
function usePositioner(componentProps, state, { styles, transitionStatus, props, refs, hidden, inert = false }) {
	const style = { ...styles };
	if (inert) style.pointerEvents = "none";
	return useRenderElement("div", componentProps, {
		state,
		ref: refs,
		props: [
			{
				role: "presentation",
				hidden,
				style
			},
			getDisabledMountTransitionStyles(transitionStatus),
			props
		],
		stateAttributesMapping: popupStateMapping
	});
}

//#endregion
//#region node_modules/.pnpm/@base-ui+utils@0.3.2_@types_b1c3e6a320bd22dac60637dc8422574e/node_modules/@base-ui/utils/useScrollLock.mjs
let originalHtmlStyles = {};
let originalBodyStyles = {};
let originalHtmlScrollBehavior = "";
function getViewportScroller(html, body) {
	return isOverflowElement(html) ? html : body;
}
function isPageScrollLocked(win, html, body) {
	return /hidden|clip/.test(win.getComputedStyle(getViewportScroller(html, body)).overflowY);
}
function hasInsetScrollbars(referenceElement) {
	if (typeof document === "undefined") return false;
	const doc = ownerDocument(referenceElement);
	return getWindow(doc).innerWidth - doc.documentElement.clientWidth > 0;
}
function supportsStableScrollbarGutter(referenceElement) {
	if (!(typeof CSS !== "undefined" && CSS.supports && CSS.supports("scrollbar-gutter", "stable")) || typeof document === "undefined") return false;
	const doc = ownerDocument(referenceElement);
	const html = doc.documentElement;
	const body = doc.body;
	const scrollContainer = getViewportScroller(html, body);
	const originalScrollContainerOverflowY = scrollContainer.style.overflowY;
	const originalHtmlStyleGutter = html.style.scrollbarGutter;
	html.style.scrollbarGutter = "stable";
	scrollContainer.style.overflowY = "scroll";
	const before = scrollContainer.offsetWidth;
	scrollContainer.style.overflowY = "hidden";
	const after = scrollContainer.offsetWidth;
	scrollContainer.style.overflowY = originalScrollContainerOverflowY;
	html.style.scrollbarGutter = originalHtmlStyleGutter;
	return before === after;
}
function preventScrollOverlayScrollbars(referenceElement) {
	const doc = ownerDocument(referenceElement);
	const html = doc.documentElement;
	const body = doc.body;
	const elementToLock = getViewportScroller(html, body);
	const originalElementToLockStyles = {
		overflowY: elementToLock.style.overflowY,
		overflowX: elementToLock.style.overflowX
	};
	Object.assign(elementToLock.style, {
		overflowY: "hidden",
		overflowX: "hidden"
	});
	return () => {
		Object.assign(elementToLock.style, originalElementToLockStyles);
	};
}
function preventScrollInsetScrollbars(referenceElement) {
	const doc = ownerDocument(referenceElement);
	const html = doc.documentElement;
	const body = doc.body;
	const win = getWindow(html);
	let scrollTop = 0;
	let scrollLeft = 0;
	let updateGutterOnly = false;
	const resizeFrame = AnimationFrame.create();
	if (webkit && (win.visualViewport?.scale ?? 1) !== 1) return () => {};
	function lockScroll() {
		const htmlStyles = win.getComputedStyle(html);
		const bodyStyles = win.getComputedStyle(body);
		const scrollbarGutterValue = (htmlStyles.scrollbarGutter || "").includes("both-edges") ? "stable both-edges" : "stable";
		scrollTop = html.scrollTop;
		scrollLeft = html.scrollLeft;
		originalHtmlStyles = {
			scrollbarGutter: html.style.scrollbarGutter,
			overflowY: html.style.overflowY,
			overflowX: html.style.overflowX
		};
		originalHtmlScrollBehavior = html.style.scrollBehavior;
		originalBodyStyles = {
			position: body.style.position,
			height: body.style.height,
			width: body.style.width,
			boxSizing: body.style.boxSizing,
			overflowY: body.style.overflowY,
			overflowX: body.style.overflowX,
			scrollBehavior: body.style.scrollBehavior
		};
		const isScrollableY = html.scrollHeight > html.clientHeight;
		const isScrollableX = html.scrollWidth > html.clientWidth;
		const hasConstantOverflowY = htmlStyles.overflowY === "scroll" || bodyStyles.overflowY === "scroll";
		const hasConstantOverflowX = htmlStyles.overflowX === "scroll" || bodyStyles.overflowX === "scroll";
		const scrollbarWidth = Math.max(0, win.innerWidth - body.clientWidth);
		const scrollbarHeight = Math.max(0, win.innerHeight - body.clientHeight);
		const marginY = parseFloat(bodyStyles.marginTop) + parseFloat(bodyStyles.marginBottom);
		const marginX = parseFloat(bodyStyles.marginLeft) + parseFloat(bodyStyles.marginRight);
		const elementToLock = getViewportScroller(html, body);
		updateGutterOnly = supportsStableScrollbarGutter(referenceElement);
		if (updateGutterOnly) {
			html.style.scrollbarGutter = scrollbarGutterValue;
			elementToLock.style.overflowY = "hidden";
			elementToLock.style.overflowX = "hidden";
			return;
		}
		Object.assign(html.style, {
			scrollbarGutter: scrollbarGutterValue,
			overflowY: "hidden",
			overflowX: "hidden"
		});
		if (isScrollableY || hasConstantOverflowY) html.style.overflowY = "scroll";
		if (isScrollableX || hasConstantOverflowX) html.style.overflowX = "scroll";
		Object.assign(body.style, {
			position: "relative",
			height: marginY || scrollbarHeight ? `calc(100dvh - ${marginY + scrollbarHeight}px)` : "100dvh",
			width: marginX || scrollbarWidth ? `calc(100vw - ${marginX + scrollbarWidth}px)` : "100vw",
			boxSizing: "border-box",
			overflowY: "hidden",
			overflowX: "hidden",
			scrollBehavior: "unset"
		});
		body.scrollTop = scrollTop;
		body.scrollLeft = scrollLeft;
		html.setAttribute("data-base-ui-scroll-locked", "");
		html.style.scrollBehavior = "unset";
	}
	function cleanup() {
		Object.assign(html.style, originalHtmlStyles);
		Object.assign(body.style, originalBodyStyles);
		if (!updateGutterOnly) {
			html.scrollTop = scrollTop;
			html.scrollLeft = scrollLeft;
			html.removeAttribute("data-base-ui-scroll-locked");
			html.style.scrollBehavior = originalHtmlScrollBehavior;
		}
	}
	function handleResize() {
		cleanup();
		resizeFrame.request(lockScroll);
	}
	lockScroll();
	const unsubscribeResize = addEventListener(win, "resize", handleResize);
	return () => {
		resizeFrame.cancel();
		cleanup();
		if (typeof win.removeEventListener === "function") unsubscribeResize();
	};
}
var ScrollLocker = class {
	lockCount = 0;
	restore = null;
	timeoutLock = Timeout.create();
	timeoutUnlock = Timeout.create();
	acquire(referenceElement) {
		this.lockCount += 1;
		if (this.lockCount === 1 && this.restore === null) this.timeoutLock.start(0, () => this.lock(referenceElement));
		return this.release;
	}
	release = () => {
		this.lockCount -= 1;
		if (this.lockCount === 0 && this.restore) this.timeoutUnlock.start(0, this.unlock);
	};
	unlock = () => {
		if (this.lockCount === 0 && this.restore) {
			this.restore?.();
			this.restore = null;
		}
	};
	lock(referenceElement) {
		if (this.lockCount === 0 || this.restore !== null) return;
		const doc = ownerDocument(referenceElement);
		const html = doc.documentElement;
		const body = doc.body;
		const win = getWindow(html);
		if (isPageScrollLocked(win, html, body)) {
			const observer = new win.MutationObserver(() => {
				if (isPageScrollLocked(win, html, body)) return;
				observer.disconnect();
				this.restore = null;
				this.lock(referenceElement);
			});
			const options = { attributes: true };
			observer.observe(html, options);
			observer.observe(body, options);
			this.restore = () => observer.disconnect();
			return;
		}
		this.restore = ios || !hasInsetScrollbars(referenceElement) ? preventScrollOverlayScrollbars(referenceElement) : preventScrollInsetScrollbars(referenceElement);
	}
};
const SCROLL_LOCKER = new ScrollLocker();
/**
* Locks the scroll of the document when enabled.
*
* @param enabled - Whether to enable the scroll lock.
* @param referenceElement - Element to use as a reference for lock calculations.
*/
function useScrollLock(enabled = true, referenceElement = null) {
	useIsoLayoutEffect(() => {
		if (!enabled) return;
		return SCROLL_LOCKER.acquire(referenceElement);
	}, [enabled, referenceElement]);
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/utils/useAnchoredPopupScrollLock.mjs
const VIEWPORT_WIDTH_TOLERANCE_PX = 20;
/**
* Manages scroll lock for anchored popups. For non-touch opens, scroll lock is applied when
* enabled. For touch opens, scroll lock is applied only when the positioner width is effectively
* viewport-sized.
*/
function useAnchoredPopupScrollLock(enabled, touchOpen, positionerElement, referenceElement) {
	const [touchOpenShouldLockScroll, setTouchOpenShouldLockScroll] = react.useState(false);
	useIsoLayoutEffect(() => {
		if (!enabled || !touchOpen || positionerElement == null) {
			setTouchOpenShouldLockScroll(false);
			return;
		}
		const viewportWidth = ownerDocument(positionerElement).documentElement.clientWidth;
		const popupWidth = positionerElement.offsetWidth;
		setTouchOpenShouldLockScroll(viewportWidth > 0 && popupWidth > 0 && popupWidth >= viewportWidth - VIEWPORT_WIDTH_TOLERANCE_PX);
	}, [
		enabled,
		touchOpen,
		positionerElement
	]);
	useScrollLock(enabled && (!touchOpen || touchOpenShouldLockScroll), referenceElement);
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/popover/positioner/PopoverPositioner.mjs
const PopoverPositioner = /* @__PURE__ */ react.forwardRef(function PopoverPositioner$1(componentProps, forwardedRef) {
	const { render, className, style, anchor, positionMethod, side, align, sideOffset, alignOffset, collisionBoundary = "clipping-ancestors", collisionPadding, arrowPadding, sticky, disableAnchorTracking = false, collisionAvoidance = POPUP_COLLISION_AVOIDANCE,...elementProps } = componentProps;
	const store$2 = usePopoverRootContext();
	const keepMounted = usePopoverPortalContext();
	const nodeId = useFloatingNodeId();
	const floatingRootContext = store$2.useState("floatingRootContext");
	const mounted = store$2.useState("mounted");
	const open = store$2.useState("open");
	const openReason = store$2.useState("openChangeReason");
	const triggerElement = store$2.useState("activeTriggerElement");
	const modal = store$2.useState("modal");
	const openMethod = store$2.useState("openMethod");
	const positionerElement = store$2.useState("positionerElement");
	const instantType = store$2.useState("instantType");
	const transitionStatus = store$2.useState("transitionStatus");
	const adaptiveOrigin = store$2.useState("adaptiveOrigin");
	const prevTriggerElementRef = react.useRef(null);
	const runOnceAnimationsFinish = useAnimationsFinished(positionerElement);
	const positioning = useAnchorPositioning({
		anchor,
		floatingRootContext,
		positionMethod,
		mounted,
		side,
		sideOffset,
		align,
		alignOffset,
		arrowPadding,
		collisionBoundary,
		collisionPadding,
		sticky,
		disableAnchorTracking,
		keepMounted,
		nodeId,
		collisionAvoidance,
		adaptiveOrigin
	});
	const domReference = floatingRootContext.useState("domReferenceElement");
	useIsoLayoutEffect(() => {
		const currentTriggerElement = domReference;
		const prevTriggerElement = prevTriggerElementRef.current;
		if (currentTriggerElement) prevTriggerElementRef.current = currentTriggerElement;
		if (prevTriggerElement && currentTriggerElement && currentTriggerElement !== prevTriggerElement) {
			store$2.set("instantType", void 0);
			const ac = new AbortController();
			runOnceAnimationsFinish(() => {
				store$2.set("instantType", "trigger-change");
			}, ac.signal);
			return () => {
				ac.abort();
			};
		}
	}, [
		domReference,
		runOnceAnimationsFinish,
		store$2
	]);
	const trueModalNonHover = modal === true && openReason !== triggerHover;
	useAnchoredPopupScrollLock(open && trueModalNonHover, openMethod === "touch", positionerElement, triggerElement);
	const setPositionerElement = store$2.useStateSetter("positionerElement");
	const element = usePositioner(componentProps, {
		open,
		side: positioning.side,
		align: positioning.align,
		anchorHidden: positioning.anchorHidden,
		instant: instantType
	}, {
		styles: positioning.positionerStyles,
		transitionStatus,
		props: elementProps,
		refs: [forwardedRef, setPositionerElement],
		hidden: !mounted,
		inert: !open
	});
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(PopoverPositionerContext.Provider, {
		value: positioning,
		children: [mounted && trueModalNonHover && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(InternalBackdrop, {
			inert: inertValue(!open),
			cutout: triggerElement
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FloatingNode, {
			id: nodeId,
			children: element
		})]
	});
});

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/toolbar/root/ToolbarRootContext.mjs
const ToolbarRootContext = /* @__PURE__ */ react.createContext(void 0);
function useToolbarRootContext(optional) {
	const context = react.useContext(ToolbarRootContext);
	if (context === void 0 && !optional) throw new Error(formatErrorMessage_default(69));
	return context;
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/utils/closePart.mjs
const ClosePartContext = /* @__PURE__ */ react.createContext(void 0);
function useClosePartCount() {
	const [closePartCount, setClosePartCount] = react.useState(0);
	const register$1 = useStableCallback(() => {
		setClosePartCount((count) => count + 1);
		return () => {
			setClosePartCount((count) => Math.max(0, count - 1));
		};
	});
	return {
		context: react.useMemo(() => ({ register: register$1 }), [register$1]),
		hasClosePart: closePartCount > 0
	};
}

//#endregion
//#region node_modules/.pnpm/@base-ui+react@1.7.0_@types_ca01b95bd61c1fe64daec1e02ab35694/node_modules/@base-ui/react/popover/popup/PopoverPopup.mjs
const PopoverPopup = /* @__PURE__ */ react.forwardRef(function PopoverPopup$1(componentProps, forwardedRef) {
	const { render, className, style, initialFocus, finalFocus,...elementProps } = componentProps;
	const store$2 = usePopoverRootContext();
	const positioner = usePopoverPositionerContext();
	const insideToolbar = useToolbarRootContext(true) != null;
	const { context: closePartContext, hasClosePart } = useClosePartCount();
	const open = store$2.useState("open");
	const openMethod = store$2.useState("openMethod");
	const instantType = store$2.useState("instantType");
	const transitionStatus = store$2.useState("transitionStatus");
	const popupProps = store$2.useState("popupProps");
	const titleId = store$2.useState("titleElementId");
	const descriptionId = store$2.useState("descriptionElementId");
	const modal = store$2.useState("modal");
	const mounted = store$2.useState("mounted");
	const openReason = store$2.useState("openChangeReason");
	const activeTriggerElement = store$2.useState("activeTriggerElement");
	const floatingContext = store$2.useState("floatingRootContext");
	const floatingId = floatingContext.useState("floatingId");
	const disabled$1 = store$2.useState("disabled");
	const openOnHover = store$2.useState("openOnHover");
	const closeDelay = store$2.useState("closeDelay");
	useOpenChangeComplete({
		open,
		ref: store$2.context.popupRef,
		onComplete() {
			if (open) store$2.context.onOpenChangeComplete?.(true);
		}
	});
	useHoverFloatingInteraction(floatingContext, {
		enabled: openOnHover && !disabled$1,
		closeDelay
	});
	const resolvedInitialFocus = initialFocus === void 0 ? createDefaultInitialFocus(store$2.context.popupRef) : initialFocus;
	const focusManagerModal = modal !== false && hasClosePart;
	store$2.useSyncedValue("focusManagerModal", focusManagerModal);
	const setPopupElement = store$2.useStateSetter("popupElement");
	const element = useRenderElement("div", componentProps, {
		state: {
			open,
			side: positioner.side,
			align: positioner.align,
			instant: instantType,
			transitionStatus
		},
		ref: [
			forwardedRef,
			store$2.context.popupRef,
			setPopupElement
		],
		props: [
			popupProps,
			{
				id: floatingId,
				role: "dialog",
				...FOCUSABLE_POPUP_PROPS,
				"aria-labelledby": titleId,
				"aria-describedby": descriptionId,
				onKeyDown(event) {
					if (insideToolbar && COMPOSITE_KEYS.has(event.key)) event.stopPropagation();
				}
			},
			getDisabledMountTransitionStyles(transitionStatus),
			elementProps
		],
		stateAttributesMapping: popupTransitionStateMapping
	});
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FloatingFocusManager, {
		context: floatingContext,
		openInteractionType: openMethod,
		modal: focusManagerModal,
		disabled: !mounted || openReason === triggerHover,
		initialFocus: resolvedInitialFocus,
		returnFocus: finalFocus,
		restoreFocus: "popup",
		previousFocusableElement: isHTMLElement(activeTriggerElement) ? activeTriggerElement : void 0,
		nextFocusableElement: store$2.context.triggerFocusTargetRef,
		beforeContentFocusGuardRef: store$2.context.beforeContentFocusGuardRef,
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ClosePartContext.Provider, {
			value: closePartContext,
			children: element
		})
	});
});

//#endregion
//#region src/client/index.ts
const ROUTE = "/api/capability-panel";
/** The plugin's issue tracker, surfaced as the panel foot's feedback link. */
const FEEDBACK_URL = "https://github.com/pure-craft/dsh-capability-panel/issues";
/**
* Order by how much the reader needs to act on it: what fell out of context
* first, then what is in it, then the rest.
*/
const STATE_ORDER = {
	evicted: 0,
	pruned: 1,
	loaded: 2,
	unloaded: 3
};
function sortSkills(skills) {
	return [...skills].sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.name.localeCompare(b.name));
}
/**
* Platform for the settings shortcut's modifier: the host binds
* `settings.open` to Cmd+, on macOS and Ctrl+, elsewhere (the `primary`
* modifier in its binding table resolves the same way).
*/
function isMacPlatform() {
	const platform$2 = navigator.platform ?? "";
	return platform$2 !== "" ? /mac/i.test(platform$2) : /mac/i.test(navigator.userAgent ?? "");
}
/**
* Open the Settings modal by driving its official keybinding through the input
* pipeline. The host's shortcuts service listens for `keydown` on `window`
* with no `isTrusted` gate, so a synthesized event is processed exactly like a
* physical press — region "page" (no editable/terminal ancestor), no open
* shortcut-modal, both of which the `settings.open` command accepts.
*
* This deliberately uses the input seam, not a host internal: the shortcuts
* service is not visible to plugin contexts, and the settings shell exposes no
* section deep-link (`openSection` stays internal to the shell). Caveats,
* accepted over shipping no entry at all: a user who rebound the settings
* shortcut changed what this gesture triggers, and hosts older than 0.1.7 have
* no such binding at all — the caller gates the entry on `HOST_HAS_MODERN_SHELL`.
*/
function dispatchOpenSettings() {
	const mac$1 = isMacPlatform();
	window.dispatchEvent(new KeyboardEvent("keydown", {
		code: "Comma",
		key: ",",
		metaKey: mac$1,
		ctrlKey: !mac$1,
		bubbles: true,
		cancelable: true
	}));
}
/**
* Select our own section inside an open Settings dialog by clicking its nav
* row — the official user interaction, located through two anchors that cannot
* drift with host internals: the dialog's own `data-shortcut-modal="settings"`
* attribute (the shortcut system's public hook) and OUR OWN localized section
* label as the row's text. Returns false when the row is not (yet) there, so
* the caller can retry while the modal mounts.
*/
function selectCapabilitySection(label) {
	const buttons = document.querySelector("[data-shortcut-modal=\"settings\"]")?.querySelectorAll("nav button") ?? [];
	for (const button of buttons) if (button.textContent?.trim() === label) {
		button.click();
		return true;
	}
	return false;
}
/**
* Open Settings ON the capability-panel section. The shell offers no section
* deep-link, so this drives the two official gestures in sequence: the
* settings.open keybinding (which TOGGLES — skipped when the dialog is already
* open, or it would close it), then a nav-row click once the dialog has
* mounted. The retry is bounded; if the row never appears the user still lands
* on the settings landing page, which is the pre-existing behavior.
*/
function openGlobalSettings(sectionLabel) {
	close();
	if (document.querySelector("[data-shortcut-modal=\"settings\"]") === null) dispatchOpenSettings();
	let attempts = 0;
	const trySelect = () => {
		attempts += 1;
		if (selectCapabilitySection(sectionLabel)) return;
		if (attempts < 20) requestAnimationFrame(trySelect);
	};
	requestAnimationFrame(trySelect);
}
function apply(ctx) {
	const react$1 = react;
	const h = react$1.createElement;
	ctx.effect(() => registerLocale(ctx.locale), "capability-panel: dictionaries");
	const t = ctx.locale.bind(LOCALE_NS);
	const subscribeLocale = (fn) => ctx.locale.subscribe(fn);
	const getLocaleSnapshot = () => ctx.locale.getSnapshot();
	ctx.on("connection/reset", () => {
		reset();
		resetPresetTools();
	});
	ctx.effect(() => {
		if (typeof document === "undefined") return () => {};
		const style = document.createElement("style");
		style.dataset.plugin = "dsh-capability-panel";
		style.textContent = PANEL_CSS;
		document.head.appendChild(style);
		return () => {
			style.remove();
		};
	}, "capability-panel: stylesheet");
	/** The trigger's mark: the host's sliders artwork, the same family its own
	*  option popovers wear (ui-workspace draws the two-row sibling). The panel
	*  is a set of per-session switches, and the glyph it replaced — the host's
	*  context-injection box — read as one more box-with-an-arrow. */
	const slidersIcon = (size$3) => h(IconSliders, { size: size$3 });
	/** Magnifier sitting inside the filter input. */
	const searchIcon = (size$3) => h(IconSearch, { size: size$3 });
	/** Plus: the row action adds the skill's slash command to the composer draft.
	*  The host uses this glyph for "add" everywhere (model, workspace, task), and
	*  unlike the send arrow it makes no promise that anything is submitted. */
	const insertIcon = (size$3) => h(IconPlus, { size: size$3 });
	/** Circular arrows: pull a declared-but-offline server's connection up now. */
	const reconnectIcon = (size$3) => h(IconRefresh, { size: size$3 });
	/** Panel mark: the destination of the row action, so it wears the glyph both
	*  host sidebars draw for the side panel (ui-sidebar-right's expand/collapse).
	*  The arrow it replaced (↗) meant "open elsewhere" and sat beside a second
	*  arrow. */
	const previewIcon = (size$3) => h(IconPanelLeft, { size: size$3 });
	/** The GitHub mark. Not in the host icon set (brand logos are not shipped
	*  there), so this one path is inlined for the feedback link's recognizability. */
	const githubIcon = (size$3) => h("svg", {
		width: size$3,
		height: size$3,
		viewBox: "0 0 1024 1024",
		fill: "currentColor",
		"aria-hidden": true
	}, h("path", { d: "M511.6 76.3C264.3 76.2 64 276.4 64 523.5 64 718.9 189.3 885 363.8 946c23.5 5.9 19.9-10.8 19.9-22.2v-77.5c-135.7 15.9-141.2-73.9-150.3-88.9C215 726 171.5 718 184.5 703c30.9-15.9 62.4 4 98.9 57.9 26.4 39.1 77.9 32.5 104 26 5.7-23.5 17.9-44.5 34.7-60.8-140.6-25.2-199.2-111-199.2-213 0-49.5 16.3-95 48.3-131.7-20.4-60.5 1.9-112.3 4.9-120 58.1-5.2 118.5 41.6 123.2 45.3 33-8.9 70.7-13.6 112.9-13.6 42.4 0 80.2 4.9 113.5 13.9 11.3-8.6 67.3-48.8 121.3-43.9 2.9 7.7 24.7 58.3 5.5 118 32.4 36.8 48.9 82.7 48.9 132.3 0 102.2-59 188.1-200 212.9 23.5 23.2 38.1 55.4 38.1 91v112.5c0.8 9 0 17.9 15 17.9 177.1-59.7 304.6-227 304.6-424.1 0-247.2-200.4-447.3-447.5-447.3z" }));
	ctx.slots.inject("settings.section", () => ctx.slots.register({
		name: "settings.section",
		id: "capability-panel",
		order: 25,
		label: () => t("preset.nav")
	}, () => h(PresetToolSection, {
		t,
		subscribeLocale,
		getLocaleSnapshot
	})));
	ctx.slots.inject("conversation.input.right", () => ctx.slots.register({
		name: "conversation.input.right",
		id: "capability-panel",
		order: 1e3
	}, (props) => {
		const snap = react$1.useSyncExternalStore(subscribe, getSnapshot);
		react$1.useSyncExternalStore(subscribeLocale, getLocaleSnapshot);
		const [expanded, setExpanded] = react$1.useState({});
		const [query, setQuery] = react$1.useState("");
		const [tab, setTab] = react$1.useState("skills");
		const [reconnecting, setReconnecting] = react$1.useState(null);
		const [showPresetOff, setShowPresetOff] = react$1.useState(false);
		const sessionId = props.sessionId ?? null;
		react$1.useEffect(() => {
			if (snap.open) refresh(sessionId);
		}, [snap.open, sessionId]);
		const syncOpen = (open) => {
			const current = getSnapshot().open;
			if (open && !current) toggle();
			else if (!open && current) close();
		};
		const normalizedQuery = query.trim();
		const filtering = normalizedQuery !== "";
		const payload = snap.payload;
		const skillSourceLabel = (skill) => {
			const key = `source.${skill.source}`;
			const translated = t(key);
			return translated === key ? skill.source : translated;
		};
		const openSourceFolder = (source) => {
			if (sessionId === null) return;
			fetch(`${ROUTE}/open-folder`, {
				method: "POST",
				credentials: "same-origin",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					sessionId,
					source
				})
			}).then(async (response) => {
				if (!response.ok) {
					const detail = await response.text();
					console.warn(`[capability-panel] cannot open source folder (${response.status}): ${detail}`);
				}
			}).catch((error) => {
				console.warn("[capability-panel] open source folder request failed", error);
			});
		};
		/**
		* Pull a declared-but-offline server's connection up, then refresh:
		* registration lands asynchronously, and the registry's tools/change
		* broadcast is what re-applies this session's stored positions.
		*/
		const reconnectServer = (server) => {
			if (reconnecting !== null) return;
			setReconnecting(server);
			fetch(`${ROUTE}/reconnect`, {
				method: "POST",
				credentials: "same-origin",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ server })
			}).then(async (response) => {
				if (!response.ok) {
					const detail = await response.text();
					console.warn(`[capability-panel] reconnect failed (${response.status}): ${detail}`);
					reportActionError(t("action.reload.failed", {
						name: server,
						error: `HTTP ${response.status}`
					}));
				}
				await refresh(sessionId);
			}).catch((error) => {
				console.warn("[capability-panel] reconnect request failed", error);
				reportActionError(t("action.reload.failed", {
					name: server,
					error: error instanceof Error ? error.message : String(error)
				}));
			}).finally(() => {
				setTimeout(() => {
					setReconnecting(null);
				}, 2500);
			});
		};
		/**
		* Middle ellipsis for long path labels: both ends carry the meaning
		* (`~/…` context, the tail directory), the middle is the expendable
		* part. The full path stays in the hover tooltip.
		*/
		const ellipsizeMiddle$1 = (text, max$1 = 42) => {
			if (text.length <= max$1) return text;
			const head = Math.ceil((max$1 - 1) / 2);
			const tail = Math.floor((max$1 - 1) / 2);
			return `${text.slice(0, head)}…${text.slice(text.length - tail)}`;
		};
		/**
		* Section header for a source group, rendered as a labeled rule:
		* `── 📁 ~/.agents/skills (4) ────────────`. Label rule: preset-bundled
		* entries name their preset; every other group shows its real directory
		* (host-abbreviated `~`/cwd-relative, middle-ellipsized when long), and
		* only groups without a filesystem location fall back to the translated
		* source name. `groupKey` is the grouping identity; `rawSource` is what
		* the open-folder route resolves by.
		*/
		const sourceSectionHeader = (groupKey, rawSource, count, first, path, openable = false) => {
			const label = groupKey.startsWith("preset:") ? groupKey.slice(7) : path !== void 0 ? ellipsizeMiddle$1(path) : groupKey === "host" ? t("source.host") : skillSourceLabel({ source: groupKey });
			const rule = (grow) => h("span", { style: grow ? {
				flex: "1",
				height: "1px",
				background: TOK.borderStrong
			} : {
				flex: "none",
				width: "16px",
				height: "1px",
				background: TOK.borderStrong
			} });
			return h("div", {
				key: `source:${groupKey}`,
				className: "ci-source-header",
				style: {
					display: "flex",
					alignItems: "center",
					gap: "8px",
					margin: first ? "0 0 2px" : "10px 0 2px"
				}
			}, rule(false), h("span", {
				style: {
					flex: "none",
					display: "inline-flex",
					alignItems: "center",
					gap: "4px",
					fontWeight: 500,
					color: TOK.textTertiary,
					fontVariantNumeric: "tabular-nums",
					cursor: openable ? "pointer" : "default"
				},
				title: openable ? t("source.openFolder", { source: path ?? label }) : void 0,
				onClick: openable ? () => {
					openSourceFolder(rawSource);
				} : void 0
			}, openable ? h("span", {
				className: "ci-folder-icon",
				style: {
					display: "inline-grid",
					placeItems: "center",
					opacity: 0,
					transition: "opacity 0.15s"
				}
			}, h(IconFolderClose, { size: 14 })) : null, `${label} (${count})`), rule(true));
		};
		/** Group items by source, preserving order within each group. */
		const groupBySource = (items, getSource) => {
			const groups = /* @__PURE__ */ new Map();
			const order = [];
			for (const item of items) {
				const source = getSource(item);
				const bucket = groups.get(source);
				if (bucket) bucket.push(item);
				else {
					groups.set(source, [item]);
					order.push(source);
				}
			}
			return order.map((source) => [source, groups.get(source)]);
		};
		const view = payload === null ? null : filterPayload(payload, normalizedQuery, (skill) => t(`state.${skill.state}`), skillSourceLabel);
		const skills = view === null ? [] : sortSkills(view.skills);
		const mcpAll = view?.mcp ?? [];
		const presetOff = mcpAll.filter((server) => server.enabled === false && server.defaultDisabled === true);
		const mcp = filtering || showPresetOff ? mcpAll : mcpAll.filter((server) => !presetOff.includes(server));
		const systemTools = view?.systemTools ?? [];
		const blocked = payload?.blocked ?? {};
		const totals = {
			skills: payload?.skills.length ?? 0,
			mcp: payload?.mcp.length ?? 0,
			systemTools: payload?.systemTools.length ?? 0
		};
		const totalAll = totals.skills + totals.mcp + totals.systemTools;
		const setOpen = (key, open) => {
			setExpanded((prev) => ({
				...prev,
				[key]: open
			}));
		};
		/**
		* Stable pill geometry for every skill state: green means loaded, blue
		* means pruned (head/tail still visible), neutral means unloaded, amber
		* means evicted, and the independent red pill records blocked attempts
		* after a capability was disabled.
		*/
		const chip = (text, color) => h("span", { style: {
			flex: "0 0 auto",
			fontSize: "11px",
			lineHeight: "16px",
			padding: "1px 7px",
			borderRadius: "999px",
			color,
			background: `color-mix(in srgb, ${color} 14%, transparent)`,
			fontVariantNumeric: "tabular-nums",
			whiteSpace: "nowrap"
		} }, text);
		const blockedChip = (count) => count > 0 ? chip(t("blocked.count", { count }), TOK.error) : null;
		const metaText = (text) => h("span", { style: {
			flex: "0 0 auto",
			fontSize: "11px",
			color: TOK.textTertiary,
			fontVariantNumeric: "tabular-nums",
			whiteSpace: "nowrap"
		} }, text);
		const stateMeta = (skill) => {
			return chip(t(`state.${skill.state}`) + (skill.loadCount > 1 ? ` ×${skill.loadCount}` : ""), skill.state === "loaded" ? TOK.success : skill.state === "pruned" ? TOK.info : skill.state === "evicted" ? TOK.warn : TOK.textTertiary);
		};
		const switchControl = (kind, name, enabled) => capabilitySwitch({
			checked: enabled,
			disabled: sessionId === null,
			busy: snap.loading,
			label: t(enabled ? "action.disable" : "action.enable", { name }),
			onCheckedChange: (checked) => {
				if (sessionId !== null) setCapability(sessionId, kind, name, checked);
			}
		});
		const groupLabel = (text, first) => h("div", {
			key: `group:${text}`,
			style: {
				fontWeight: 500,
				color: TOK.textTertiary,
				fontVariantNumeric: "tabular-nums",
				margin: first ? "0 0 2px" : "12px 0 2px"
			}
		}, text);
		const nameText = (text, sourceLabel) => h("span", {
			className: "ci-name",
			style: {
				flex: "1 1 auto",
				wordBreak: "break-all",
				color: TOK.textPrimary,
				fontWeight: 500
			}
		}, text, sourceLabel !== void 0 ? h("span", { style: {
			color: TOK.textTertiary,
			fontWeight: 400,
			fontSize: "11px",
			marginLeft: "2px"
		} }, `· ${sourceLabel}`) : null);
		/** The trigger's accessible name, localized with its subject. */
		const disclosureAria = (subject, detailKey, disclosure) => {
			const detail = t(detailKey);
			if (disclosure.disabled) return t("disclosure.pinned", {
				subject,
				detail
			});
			return disclosure.open ? t("disclosure.collapse", {
				subject,
				detail
			}) : t("disclosure.expand", {
				subject,
				detail
			});
		};
		/**
		* Shared disclosure row for Skills, MCP tools, and System tools. The
		* trigger owns only chevron + label; trailing actions remain independent
		* buttons and never toggle the description.
		*/
		const disclosureRow$1 = (key, enabled, label, description, actions, className = ROW_ROOT_CLASS, sourceLabel, rowIcon) => {
			const hasDescription = description !== void 0 && description !== "";
			const disclosure = resolveDisclosure(expanded[key] === true, filtering);
			const ariaLabel = disclosureAria(label, "detail.description", disclosure);
			if (!hasDescription) return h("div", {
				key,
				className,
				style: { opacity: enabled ? 1 : .55 }
			}, h("div", { className: ROW_HEADER_CLASS }, rowIcon === void 0 ? h("span", { style: {
				width: "18px",
				flex: "none"
			} }) : leadingStatic(rowIcon), nameText(label, sourceLabel), ...actions));
			return h(CollapsibleRoot, {
				key,
				open: disclosure.open,
				onOpenChange: (open) => {
					setOpen(key, open);
				},
				className,
				style: { opacity: enabled ? 1 : .55 }
			}, h("div", { className: ROW_HEADER_CLASS }, h(CollapsibleTrigger, {
				className: "ci-disclosure-trigger",
				disabled: disclosure.disabled,
				"aria-label": ariaLabel
			}, leadingFor(rowIcon, disclosure.open), nameText(label, sourceLabel)), ...actions), h(CollapsiblePanel, { className: "ci-collapse" }, h("div", { className: "ci-description" }, description)));
		};
		/**
		* Put a skill's slash command into the composer — never auto-submit:
		* whether to send is the user's call (Enter). A non-empty draft is
		* appended to, never replaced. Works for disabled skills too: the
		* disable shadow keeps userInvocable: true by design.
		*
		* The draft comes from the live input-state selector: the old
		* `props.input` snapshot is gone in newer hosts, and reading a stale
		* snapshot would REPLACE the user's draft instead of appending.
		*/
		const composerDraft = props.useInput === void 0 ? props.input?.draft ?? "" : props.useInput((state) => state.draft);
		const insertCommand = (name) => {
			const actions = props.inputActions;
			if (actions === void 0) return;
			const draft = composerDraft;
			actions.setDraft(draft.trim() === "" ? `/${name} ` : `${draft} /${name} `);
			close();
		};
		/**
		* The row's hover-revealed action slot. `.ci-row-head .ci-send` keeps it
		* invisible until the row is hovered or focused, so a row of controls stays
		* quiet until the pointer is on it; both row actions share that slot and
		* its 20×20 ghost chrome.
		*
		* The button carries `aria-label` only, no `title`: the host's own controls
		* show a delayed `Tooltip` rather than the browser's instant native one,
		* and the sibling action in this same slot has never had a title.
		*/
		const iconAction = (label, icon, onClick, disabled$1 = false) => h("button", {
			type: "button",
			className: "ci-iconbtn ci-send",
			"aria-label": label,
			disabled: disabled$1,
			onClick,
			style: {
				display: "grid",
				placeItems: "center",
				width: "20px",
				height: "20px",
				padding: 0,
				border: "none",
				borderRadius: "999px",
				background: "transparent",
				color: TOK.textTertiary,
				cursor: disabled$1 ? "not-allowed" : "pointer",
				flex: "none",
				font: "inherit"
			}
		}, icon);
		const insertButton = (name) => iconAction(t("action.insert", { name }), insertIcon(12), () => {
			insertCommand(name);
		}, props.inputActions === void 0);
		/**
		* Show this skill's instruction file where the Host's own skill references
		* show it: the right-sidebar preview, which renders its Markdown. The
		* panel offers this whenever the row carries an address, which the Host
		* computes from the skill's instruction file — a skill the runtime
		* registered in memory has no file, and a Host predating the addressing
		* grammar cannot name one, and both ship no address at all. The sidebar
		* service itself is looked up on click, not here: see `preview.ts`.
		*/
		const previewButton = (skill) => {
			const address = skill.fileAddress;
			if (address === void 0) return null;
			return iconAction(t("action.preview", { name: skill.name }), previewIcon(12), () => {
				openPreviewResource(ctx, address);
			});
		};
		const skillRow = (skill) => disclosureRow$1(`skill:${skill.name}`, skill.enabled, skill.name, skill.description, [
			stateMeta(skill),
			previewButton(skill),
			insertButton(skill.name),
			blockedChip(blocked[skill.name] ?? 0),
			switchControl("skill", skill.name, skill.enabled)
		], ROW_ROOT_CLASS, void 0, skillRowIcon());
		const mcpToolRow = (tool, serverEnabled) => disclosureRow$1(`mcp-tool:${tool.name}`, tool.enabled, tool.label, tool.description, [blockedChip(blocked[tool.name] ?? 0), serverEnabled ? switchControl("mcp-tool", tool.name, tool.enabled) : null], MCP_TOOL_ROOT_CLASS, void 0, toolRowIcon());
		const serverRow = (server) => {
			const serverBlocked = server.tools.reduce((sum, tool) => sum + (blocked[tool.name] ?? 0), 0);
			const key = `mcp:${server.server}`;
			const disclosure = resolveDisclosure(expanded[key] === true, filtering);
			const ariaLabel = disclosureAria(server.server, "detail.tools", disclosure);
			return h(CollapsibleRoot, {
				key,
				open: disclosure.open,
				onOpenChange: (open) => {
					setOpen(key, open);
				},
				style: { opacity: server.enabled ? 1 : .55 }
			}, h("div", { className: ROW_HEADER_CLASS }, h(CollapsibleTrigger, {
				className: "ci-server-trigger",
				disabled: disclosure.disabled,
				"aria-label": ariaLabel,
				style: {
					display: "grid",
					placeItems: "center",
					width: "18px",
					height: "18px",
					padding: 0,
					border: "none",
					borderRadius: "4px",
					background: "transparent",
					color: TOK.textTertiary,
					cursor: disclosure.disabled ? "default" : "pointer",
					flex: "none",
					font: "inherit"
				}
			}, leadingFor(serverRowIcon(), disclosure.open)), nameText(server.server), server.unavailable === true ? h("span", {
				className: "ci-preset-badge",
				title: t("server.unavailableHint"),
				style: { flex: "none" }
			}, t("server.unavailable")) : metaText(server.tools.length === 1 ? t("server.tool.one") : t("server.tools", { count: server.tools.length })), blockedChip(serverBlocked), server.unavailable === true && server.reconnectable === true ? h("button", {
				type: "button",
				className: `ci-reconnect${reconnecting === server.server ? " ci-reconnect-busy" : ""}`,
				disabled: reconnecting !== null,
				"aria-label": t("action.reload", { name: server.server }),
				title: reconnecting === server.server ? t("action.reload.ing", { name: server.server }) : `${t("action.reload", { name: server.server })}\n${t("action.reloadHint")}`,
				onClick: () => {
					reconnectServer(server.server);
				}
			}, h("span", {
				className: "ci-reconnect-glyph",
				"aria-hidden": true
			}, reconnectIcon(14)), t("action.reload.label")) : null, server.unavailable === true ? null : switchControl("mcp-server", server.server, server.enabled)), h(CollapsiblePanel, { className: "ci-collapse" }, h("div", { style: {
				marginTop: "2px",
				marginLeft: "4px",
				paddingLeft: "8px",
				borderLeft: `2px solid ${TOK.border}`
			} }, ...server.tools.map((tool) => mcpToolRow(tool, server.enabled)))));
		};
		const systemRow = (tool) => disclosureRow$1(`sys:${tool.name}`, tool.enabled, tool.label, tool.description, [blockedChip(blocked[tool.name] ?? 0), tool.reserved === true ? null : switchControl("system-tool", tool.name, tool.enabled)], ROW_ROOT_CLASS, void 0, toolRowIcon());
		const emptyNote = (text) => h("div", {
			key: `empty:${text}`,
			style: {
				color: TOK.textTertiary,
				padding: "8px 2px"
			}
		}, text);
		/**
		* The hidden-count line and the switch that reveals those rows. It renders
		* even when every server is hidden, so the way back is always on screen,
		* and it stays out of the way while a query is filtering (everything is
		* listed then anyway).
		*/
		const presetOffRow = () => {
			if (presetOff.length === 0 || filtering) return null;
			return h("div", { className: "ci-preset-off" }, h("span", { className: "ci-preset-off-text" }, t("mcp.presetOff", { count: presetOff.length })), h("button", {
				type: "button",
				role: "switch",
				"aria-checked": showPresetOff,
				"aria-label": t("mcp.presetOffAria"),
				className: showPresetOff ? "ci-preset-off-toggle ci-preset-off-on" : "ci-preset-off-toggle",
				onClick: () => {
					setShowPresetOff(!showPresetOff);
				}
			}, showPresetOff ? t("mcp.presetOffHide") : t("mcp.presetOffShow")));
		};
		const notices = [
			snap.loading && payload === null ? h("div", {
				key: "loading",
				"aria-live": "polite",
				style: {
					color: TOK.textTertiary,
					padding: "4px 0"
				}
			}, t("status.loading")) : null,
			snap.error !== null ? h("div", {
				key: "error",
				"aria-live": "polite",
				style: {
					color: TOK.error,
					padding: "4px 0"
				}
			}, t("status.error", { error: snap.error })) : null,
			payload?.degraded !== void 0 ? h("div", {
				key: "degraded",
				style: {
					color: TOK.warn,
					padding: "2px 0"
				}
			}, ...payload.degraded.map((note) => h("div", { key: note }, t("degraded.item", { note })))) : null
		];
		const body = filtering ? [
			view !== null && view.total === 0 ? emptyNote(t("empty.match")) : null,
			skills.length > 0 ? groupLabel(t("group.skills", {
				shown: skills.length,
				total: totals.skills
			}), true) : null,
			...skills.map(skillRow),
			mcp.length > 0 ? groupLabel(t("group.mcp", {
				shown: mcp.length,
				total: totals.mcp
			}), skills.length === 0) : null,
			...mcp.map(serverRow),
			systemTools.length > 0 ? groupLabel(t("group.system", {
				shown: systemTools.length,
				total: totals.systemTools
			}), skills.length === 0 && mcp.length === 0) : null,
			...systemTools.map(systemRow)
		] : [h(TabsRoot, {
			key: "tabs",
			value: tab,
			onValueChange: (value) => {
				setTab(value);
			},
			style: { marginTop: "2px" }
		}, h(TabsList, {
			"aria-label": t("tabs.aria"),
			className: "ci-tabs",
			style: { marginBottom: "6px" }
		}, h(TabsTab, {
			value: "skills",
			className: "ci-tab"
		}, `${t("tab.skills")} ${totals.skills}`), h(TabsTab, {
			value: "mcp",
			className: "ci-tab"
		}, `${t("tab.mcp")} ${totals.mcp}`), h(TabsTab, {
			value: "system",
			className: "ci-tab",
			"aria-label": t("tab.system.aria", { count: totals.systemTools })
		}, `${t("tab.system")} ${totals.systemTools}`)), h(TabsPanel, { value: "skills" }, skills.length === 0 && payload !== null && !snap.loading ? emptyNote(t("empty.skills")) : h("div", {}, ...groupBySource(skills, (s) => s.group ?? s.source).flatMap(([groupKey, items], i) => [sourceSectionHeader(groupKey, items[0].source, items.length, i === 0, items.find((item) => item.path !== void 0)?.path, items.some((item) => item.path !== void 0)), ...items.map(skillRow)]))), h(TabsPanel, { value: "mcp" }, mcpAll.length === 0 && payload !== null && !snap.loading ? emptyNote(t("empty.mcp")) : h("div", {}, presetOffRow(), ...groupBySource(mcp, (s) => s.source === void 0 || s.source === "host" ? "host" : `preset:${s.source}`).flatMap(([groupKey, items], i) => [sourceSectionHeader(groupKey, items[0].source ?? "host", items.length, i === 0, items.find((item) => item.path !== void 0)?.path, true), ...items.map(serverRow)]))), h(TabsPanel, { value: "system" }, systemTools.length === 0 && payload !== null && !snap.loading ? emptyNote(t("empty.system")) : h("div", {}, ...systemTools.map(systemRow))))];
		return h(PopoverRoot, {
			open: snap.open,
			onOpenChange: syncOpen
		}, h(__deepseek_ai_dsh_client_ui_primitives.Tooltip, {
			label: t("trigger.tooltip"),
			side: "top",
			delayMs: 200,
			disabled: snap.open
		}, h(PopoverTrigger, {
			className: "ci-trigger",
			"aria-label": t("trigger.tooltip"),
			style: {
				display: "grid",
				placeItems: "center",
				width: "28px",
				height: "28px",
				padding: 0,
				border: "none",
				borderRadius: "999px",
				background: "transparent",
				color: TOK.textSecondary,
				cursor: "pointer",
				flex: "none",
				font: "inherit"
			}
		}, slidersIcon(14))), h(PopoverPortal, {}, h(PopoverPositioner, {
			side: "top",
			align: "end",
			sideOffset: 8,
			collisionPadding: 8,
			style: { zIndex: 100 }
		}, h(PopoverPopup, {
			className: "ci-panel",
			"aria-label": t("panel.aria"),
			style: {
				boxSizing: "border-box",
				width: "480px",
				maxHeight: "min(60vh, var(--available-height, 60vh))",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
				padding: "10px 12px",
				background: TOK.menuBg,
				backdropFilter: TOK.menuBlur,
				color: TOK.textSecondary,
				border: `1px solid ${TOK.menuBorder}`,
				borderRadius: "12px",
				boxShadow: TOK.menuShadow,
				fontFamily: TOK.fontFamily,
				fontSize: "12px",
				lineHeight: "20px",
				cursor: "default"
			}
		}, h("div", { style: {
			flex: "1 1 auto",
			minHeight: 0,
			overflowY: "auto",
			overflowX: "hidden",
			margin: "0 -12px",
			padding: "0 12px"
		} }, h("div", { style: { marginBottom: "6px" } }, h("div", { style: {
			display: "flex",
			alignItems: "center",
			gap: "6px"
		} }, h("div", { style: {
			position: "relative",
			flex: "1 1 auto",
			display: "flex",
			alignItems: "center"
		} }, h("span", { style: {
			position: "absolute",
			left: "8px",
			color: TOK.textTertiary,
			display: "grid",
			pointerEvents: "none"
		} }, searchIcon(14)), h(Input, {
			className: "ci-filter",
			value: query,
			placeholder: t("filter.placeholder"),
			"aria-label": t("filter.aria"),
			autoComplete: "off",
			spellCheck: false,
			name: "ci-filter",
			onChange: (event) => {
				setQuery(event.target.value);
			},
			onKeyDown: (event) => {
				if (event.key !== "Escape" || !filtering) return;
				event.stopPropagation();
				setQuery("");
			},
			style: {
				flex: "1 1 auto",
				minWidth: 0,
				height: "26px",
				boxSizing: "border-box",
				padding: "0 8px 0 26px",
				border: `1px solid ${TOK.border}`,
				borderRadius: "6px",
				background: TOK.bgBase,
				color: TOK.textPrimary,
				font: "inherit",
				outline: "none"
			}
		})), filtering ? h("button", {
			type: "button",
			onClick: () => {
				setQuery("");
			},
			className: "ci-iconbtn",
			"aria-label": t("filter.clear"),
			style: {
				display: "grid",
				placeItems: "center",
				width: "20px",
				height: "20px",
				padding: 0,
				border: "none",
				borderRadius: "999px",
				background: "transparent",
				color: TOK.textTertiary,
				cursor: "pointer",
				flex: "none",
				font: "inherit",
				fontSize: "14px",
				lineHeight: 1
			}
		}, "×") : null), filtering ? h("div", {
			"aria-live": "polite",
			style: {
				marginTop: "4px",
				color: TOK.textTertiary,
				fontVariantNumeric: "tabular-nums"
			}
		}, t("filter.count", {
			shown: view?.total ?? 0,
			total: totalAll
		})) : null), ...notices, ...body), h("div", { style: {
			flex: "none",
			display: "flex",
			justifyContent: "space-between",
			alignItems: "center",
			marginTop: "6px",
			paddingTop: "8px",
			borderTop: "0.5px solid var(--dsw-alias-border-l2, rgba(0,0,0,.1))"
		} }, (() => {
			return HOST_HAS_MODERN_SHELL ? h("button", {
				type: "button",
				className: "ci-feedback-link ci-settings-link",
				title: t("footer.openSettingsHint"),
				onClick: () => {
					openGlobalSettings(t("preset.nav"));
				}
			}, h("span", {
				className: "ci-feedback-icon",
				"aria-hidden": true
			}, h(IconSettings, { size: 16 })), t("footer.openSettings")) : h("span");
		})(), h("a", {
			href: FEEDBACK_URL,
			target: "_blank",
			rel: "noopener noreferrer",
			className: "ci-feedback-link",
			title: t("footer.feedbackHint")
		}, h("span", {
			className: "ci-feedback-icon",
			"aria-hidden": true
		}, githubIcon(12)), t("footer.feedback")))))));
	}));
}
const inject = ["slots", "locale"];

//#endregion
exports.apply = apply;
exports.inject = inject;
return module.exports; } });
//# sourceMappingURL=client.js.map