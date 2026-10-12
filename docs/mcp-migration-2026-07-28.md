# MCP protocol migration: 2026-07-28

The mARC stdio server now uses the modern MCP serving API from `@modelcontextprotocol/server` 2.3.1 and supports only protocol revision `2026-07-28`. The package version is the server version reported during discovery. This build is `@notfounnd/marc-server` 0.3.0 and uses Zod 4.6.5 schemas through the SDK's Standard Schema interface. The official client SDK 2.3.1 is a development dependency used by wire tests.

## Client compatibility

Clients must support the modern MCP protocol envelope and send the protocol revision and client capabilities in `_meta`. `clientInfo` is recommended but optional; the server accepts clients that omit it. A client may use discovery to inspect server support, but can request `tools/list` or call a tool without discovering first. The discovery request envelope is:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "server/discover",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {}
    }
  }
}
```

Discovery returns the sole supported revision, the server identity derived from `package.json`, and cache metadata. `server/discover` and `tools/list` both advertise `resultType: "complete"`, `cacheScope: "private"`, and `ttlMs: 0`. A client may request `tools/list` without discovering first. The server registers all 25 tools regardless of workspace bootstrap state.

`serveStdio` is configured with `legacy: "reject"`, so clients using the older initialization flow cannot connect. An opening request with no protocol-version claim is rejected with JSON-RPC error `-32022`. After the modern connection opens, each request is checked independently: an explicit unsupported revision returns `-32022` with the supported and requested revisions, including `tools/call`; an incompatible notification is dropped without reaching a tool. Missing or malformed metadata is delegated to SDK validation and returns `-32602`. A client that does not support `2026-07-28` must update its MCP implementation before connecting.

Tool calls keep mARC's JSON text content format. Bootstrap-required, input-validation, domain, and rate-limit outcomes are tool results with `isError: true`. If a cancelled request reaches the server's pre-domain guard, it returns `request_cancelled` with `isError: true`. Wire cancellation is best effort: a domain operation that has already started may continue and commit, and cancellation does not roll back writes or dispose shared workers. Unknown methods and tool names remain JSON-RPC errors. Domain exceptions are converted to safe error codes and do not expose filesystem paths, request bodies, daemon responses, or stack traces.

## Request and process limits

The process accepts at most 60 tool calls in each fixed one-second window. The next call is rejected immediately with `rate_limited` and a `retryAfterMs` value; the server does not queue excess calls. The limit is shared by all registered tools in one server process.

The server checks the request cancellation signal before starting domain work. Cancellation of one request does not dispose a memory provider shared by other requests. On stdin EOF, SIGINT, SIGTERM, or actual stdio transport closure, shutdown stops new calls, waits for active handlers and pending lease renewals, deletes the daemon heartbeat lease, and disposes shared memory providers. Cleanup is idempotent. Transport diagnostics go to stderr so stdout stays a JSON-RPC stream.

## Upgrade and local configuration

The MCP command remains a stdio child process launched from the built CLI:

```text
node /path/to/marc/dist/cli.js mcp --workspace /path/to/project
```

Keep the existing per-client daemon URL and token arguments when the workspace uses the daemon. Do not move this command into a global configuration with one fixed workspace. Restart the MCP server or client after upgrading so an old process and its cached tool catalog are discarded. See the [README client setup](../README.md#add-your-project-to-marc) for local configuration examples.

### Configure the agent harness

mARC requires MCP protocol revision `2026-07-28`. Check the official documentation for your agent harness to confirm that the installed version supports this revision and to find any required configuration or upgrade steps.

Configuration can enable protocol support that the harness already provides, but it cannot add support for a revision the harness does not implement. After changing harness configuration, restart the client so it reloads the MCP server settings.

Some harnesses expose MCP connection or protocol negotiation failures only through warnings or logs, which may not be visible to the agent. If the mARC tools are unavailable, check those diagnostics and consult the harness documentation for protocol support, configuration, and upgrade requirements.

## Verification

The MCP protocol tests exercise source and built CLI subprocesses with the official client SDK. They cover discovery, direct listing, per-request version checks after a valid listing, unsupported tool calls and notifications, SDK handling of missing or malformed metadata, package identity, private zero-TTL cache hints, tool errors, the rate limit, EOF and transport-error cleanup, and daemon lease deletion against a local fake daemon. Tool behavior tests use isolated temporary workspaces. Memory cases verify the missing-model response without downloading or loading model assets.

Run the repository checks with:

```bash
pnpm validate
pnpm build
pnpm test
```
