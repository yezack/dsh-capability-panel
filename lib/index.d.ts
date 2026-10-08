//#region src/loopback.d.ts
/** The minimal readable surface of a request object inside a route handler. */
interface IncomingLike {
  readonly url?: string;
  readonly method?: string;
  readonly headers: Record<string, string | string[] | undefined>;
  /**
   * Present on node's http.IncomingMessage. Prefer it for the loopback
   * decision: the Host and Origin headers are client-controlled and forgeable.
   */
  readonly socket?: {
    readonly remoteAddress?: string;
  };
}
//#endregion
//#region src/host/types.d.ts

/**
 * Structural view of one cordis loader entry: enough to read an MCP client's
 * declared configuration and to restart its plugin instance. `_dispose` +
 * `refresh` are the loader's own public hot-swap pair — the same two calls an
 * HMR reload makes — so a restart reproduces exactly a reload: teardown,
 * re-init, fresh connection.
 */
interface LoaderEntryLike {
  readonly disabled?: unknown;
  /** The loader keeps the plugin package name and its config on `options`. */
  readonly options?: {
    readonly id?: unknown;
    readonly name?: unknown;
    readonly config?: unknown;
  };
  _dispose(): Promise<void>;
  refresh(): Promise<void>;
}
interface LoaderLike {
  entries(): Iterable<LoaderEntryLike>;
  /**
   * Resolves once the initial load of every entry has settled. Optional: it is
   * how dsh-settings defers its own legacy import, and the temporary recovery
   * in `legacy-import.ts` probes it the same way; hosts whose loader predates
   * it simply run the recovery immediately.
   */
  await?(): Promise<unknown>;
}
interface AgentsService {
  get(sessionId: string): AgentLike | undefined;
  /** All live agents, in registration order. */
  list(): AgentLike[];
}
interface AgentPresetLike {
  readonly id: string;
  /**
   * Present on dsh ≤ 0.1.6 (`dsh-agent-preset`); the 0.1.7 registry split
   * dropped it from `list()` rows, so consumers must treat its absence as
   * "unknown" rather than a shape violation.
   */
  readonly trust?: 'system' | 'user';
  /** Same story as {@link trust}: the 0.1.7 roster no longer carries paths. */
  readonly path?: string;
  readonly name?: string;
  readonly description?: string;
  readonly broken?: string;
}
/**
 * The revision lease `acquireScope` hands back: the scope key to read with,
 * plus async disposal that releases the mount's user count. Disposal is part
 * of the contract — skipping it pins a generation against collection forever.
 */
interface ScopeLeaseLike {
  readonly key: unknown;
  [Symbol.asyncDispose](): Promise<void>;
}
interface AgentPresetsService {
  list(): Promise<AgentPresetLike[]>;
  /**
   * Read one preset's standing scope without starting an agent (dsh ≤ 0.1.6).
   * Removed in 0.1.7 in favour of {@link acquireScope}; declared optional so
   * the call site probes whichever the live service offers.
   */
  standingKeyFor?(id?: string): Promise<unknown>;
  /**
   * 0.1.7 replacement: retain the preset's current generation and hand back
   * its scope key behind a lease. The caller MUST dispose the lease when the
   * scoped read completes.
   */
  acquireScope?(id?: string): Promise<ScopeLeaseLike>;
  composedPreset(agentCtx: unknown): string | undefined;
}
interface SettingsScopeLike<T> {
  get(): T;
  /**
   * Wholesale replacement of this namespace's user section. The merge behind
   * `update` recurses, so it cannot remove a key; removal is why this is the
   * write path used here.
   */
  replace(section: object): Promise<void>;
}
/** One row of the 0.1.7 settings form inventory, as far as this plugin reads it. */
interface SettingsDescriptor {
  readonly ns?: unknown;
  readonly value?: unknown;
}
/**
 * The settings service across BOTH host generations.
 *
 * `register` is the ≤0.1.6 contract and is still optional here so the type spans
 * both: 0.1.7 deleted it, and a plugin that hard-required it would fail to
 * compile against the new host while shipping one bundle that must serve both.
 * The 0.1.7 trio is likewise optional, since a ≤0.1.6 host has none of it.
 * Every member is therefore probed at runtime in `bindSection` rather than
 * assumed, which is also why this stays a structural type with no static import
 * from `@deepseek-ai/dsh-settings`.
 */
interface SettingsService {
  /**
   * Whether the surface accepts writes. A getter on 0.1.7 (unconditionally
   * true); read only through the lazy non-strict path, never cached.
   */
  readonly writable?: boolean;
  register?<T>(namespace: string, schema: unknown, options?: {
    applies?: 'live' | 'restart';
  }): SettingsScopeLike<T>;
  /**
   * The live form inventory. Only entries whose Config declares a volatile
   * field appear here, which is precisely why this plugin declares one.
   */
  describe?(options?: {
    redactSecrets?: boolean;
  }): readonly SettingsDescriptor[];
  /** Reset every live field of the namespace, then apply `section`. */
  replace?(namespace: string, section: object, expectedRevision?: number): Promise<void>;
  /** Recursive merge into the current section; cannot remove a key. */
  update?(namespace: string, section: object, expectedRevision?: number): Promise<void>;
  /** Ordered write operations against one namespace. */
  mutate?(namespace: string, operations: readonly object[], expectedRevision?: number): Promise<void>;
}
interface SkillsService {
  list(lookup: {
    cwd?: string;
    scope?: unknown;
  }): Promise<readonly SkillSummary[]>;
  get(name: string, lookup: {
    cwd?: string;
    scope?: unknown;
  }): Promise<SkillDefinitionLike | undefined>;
}
interface ToolsService {
  schemas(scope?: unknown): Iterable<{
    name?: unknown;
    description?: unknown;
  }>;
  guard?(guard: (execution: {
    name?: unknown;
    agent?: {
      id?: unknown;
    };
  }) => string | undefined): () => void;
}
/** The `agent/created` payload, named so a listener wrapper can restate it. */
interface AgentCreatedPayload {
  readonly agent: AgentLike & {
    readonly id?: unknown;
    readonly ctx: {
      get(name: 'tools'): ScopedToolsRegistry | undefined;
    };
  };
}
/**
 * The Host's Session controller, as far as this plugin uses it: the two
 * members that open one path on the user's own desktop. Structural like every
 * other service here, so nothing static is imported from
 * `@deepseek-ai/dsh-api-session-controller` — and it spans this plugin's whole
 * supported range, because both members exist in every generation from
 * 0.1.2-rc.1 through 0.2.x. The richer members (`workspaceDesktop`,
 * `workspacePathApplications`) only appear from 0.1.7-rc.2, so they stay unused
 * rather than optional-by-extra-probing.
 */
interface SessionControllerLike {
  /**
   * Whether this deployment can hand one path to a native desktop. `false` is
   * an answer rather than a failure: either the deployment turned native
   * opening off, or the platform announces no desktop at all.
   */
  canOpenWorkspacePath(): boolean;
  /**
   * Verify the path through the composed filesystem, then open it natively.
   * Rejects with the Host's own error when no verified mapping exists, which is
   * how a sandboxed deployment refuses a path outside its roots.
   */
  openWorkspacePath(request: {
    readonly path: string;
  }, signal: AbortSignal): Promise<unknown>;
}
interface HostServices {
  /**
   * This plugin's own cordis fiber, read for the profile entry id that 0.1.7
   * keys settings by. Optional because a plugin mounted without the Loader (a
   * bare `ctx.plugin`) has no entry, and because the field is a Loader
   * decoration rather than part of cordis's own Context type — so it is probed,
   * never assumed.
   */
  readonly fiber?: {
    readonly entry?: {
      readonly options?: {
        readonly id?: unknown;
      };
    };
  };
  readonly webServer?: {
    register(spec: {
      kind: 'prefix';
      path: string;
      handler: (req: IncomingLike$1, res: ServerResponseLike) => Promise<void> | void;
    }): () => void;
  };
  /** The cordis loader service (entry inventory + hot-swap), read via get(). */
  /**
   * The cordis reflect channel. `strict` defaults to true, which only returns
   * an implementation whose providing fiber is CURRENTLY active: during
   * startup and HMR windows that reads as absent even though the service
   * exists. Every lazy root-level read in this plugin passes strict=false so
   * a provider mid-transition still resolves; a genuinely unmounted service
   * stays undefined either way.
   */
  get(name: 'loader', strict?: boolean): LoaderLike | undefined;
  get(name: 'agents', strict?: boolean): AgentsService | undefined;
  get(name: 'agentPresets', strict?: boolean): AgentPresetsService | undefined;
  get(name: 'settings', strict?: boolean): SettingsService | undefined;
  get(name: 'sessionController', strict?: boolean): SessionControllerLike | undefined;
  get(name: 'skills', strict?: boolean): SkillsService | undefined;
  get(name: 'tools', strict?: boolean): ToolsService | undefined;
  on(event: 'agent/created',
  /**
   * A returned promise is allowed on purpose. Cordis vetoes agent publication
   * on a SYNCHRONOUS listener failure but only reports a rejected promise, so
   * asynchronous work here cannot cost the user their session. The synchronous
   * part of a listener still has to contain its own failures.
   */
  listener: (payload: AgentCreatedPayload) => void | Promise<void>): void;
  /** Fired when a blank session's preset switch commits (never at creation). */
  on(event: 'agent-preset/selected', listener: (sessionId: unknown, presetId: unknown) => void | Promise<void>): void;
  /** Fired when the tool registry changes (registration, restriction, teardown). */
  on(event: 'tools/change', listener: () => void | Promise<void>): void;
  on(event: 'tools/result', listener: (exec: {
    name?: unknown;
    arguments?: unknown;
    agent?: {
      id?: unknown;
    };
  }, result: {
    isError: boolean;
    error?: {
      message?: unknown;
      info?: {
        code?: unknown;
      };
    };
  }) => void): void;
  on(event: 'system-prompt/assemble', listener: (assembly: {
    tools?: readonly {
      name?: unknown;
    }[];
  }, context: {
    agent?: {
      id?: unknown;
    };
  }, next: () => Promise<{
    tools?: readonly {
      name?: unknown;
    }[];
  }>) => Promise<{
    tools?: readonly {
      name?: unknown;
    }[];
  }>): void;
  effect(factory: () => (() => void) | void, label?: string): void;
}
interface ScopedToolsRegistry {
  restrict(filter: {
    deny: readonly string[];
  }): () => void;
}
interface AgentLike {
  /** The shared agent/session id. */
  readonly id?: string;
  readonly session?: {
    readonly header?: {
      readonly cwd?: string;
    };
    /**
     * Live in-memory log view, present on every real Session. Borrowed
     * references, zero-copy — the panel scans this instead of asking a query
     * service to clone and replay-validate the whole log.
     */
    readonly snapshotEvents?: () => readonly unknown[];
    /** Incrementally maintained current surface: seqs the model sees now. */
    readonly surface?: {
      readonly nodes?: readonly unknown[];
    };
  };
  readonly ctx?: {
    get(name: string): unknown;
  };
}
interface SkillSummary {
  readonly name?: unknown;
  readonly description?: unknown;
  readonly source?: unknown;
  readonly provider?: unknown;
  readonly invocation?: {
    readonly modelInvocable?: unknown;
  };
  readonly resourceBase?: unknown;
  /**
   * The absolute instruction file path, when the provider supplies one —
   * `SKILL.md` for a directory bundle, the file itself for a flat Markdown
   * skill, absent for a virtual skill registered in memory.
   */
  readonly path?: unknown;
}
interface SkillDefinitionLike {
  readonly name?: unknown;
  readonly description?: unknown;
  readonly content?: unknown;
  readonly source?: unknown;
  readonly provider?: unknown;
  readonly resourceBase?: unknown;
  /** The provider's instruction-file path, inherited by the panel's shadow. */
  readonly path?: unknown;
}
interface IncomingLike$1 extends IncomingLike {
  on?(event: 'data', listener: (chunk: unknown) => void): void;
  on?(event: 'end', listener: () => void): void;
  on?(event: 'error', listener: (error: unknown) => void): void;
}
interface ServerResponseLike {
  writeHead(status: number, headers: Record<string, string>): void;
  end(body?: string): void;
}
//#endregion
//#region src/index.d.ts
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
declare const Config: Schemastery<any, any, "plain">;
/** Host composition root: construct stores/controllers and register the route. */
declare function apply(ctx: HostServices): void;
declare const inject: string[];
//#endregion
export { Config, apply, inject };
//# sourceMappingURL=index.d.ts.map