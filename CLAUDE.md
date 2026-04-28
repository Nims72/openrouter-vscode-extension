# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Extension Does

A VS Code extension that manages a bundled Anthropic API proxy server (in the `server/` subdirectory). It provides a status-bar toggle (default: **off**) that:

1. Starts/stops the Python proxy server (`uv run uvicorn server:app --host 0.0.0.0 --port 8082`)
2. Injects required environment variables into every VS Code terminal (PowerShell and bash) so Claude Code CLI automatically routes through the proxy

## Commands

```bash
npm run compile        # tsc one-shot build
npm run watch          # tsc watch mode (use during development)
npm run lint           # ESLint over src/
npm run test           # runs VS Code extension tests (launches Extension Development Host)
npm run package        # vsce package → produces .vsix
npm run deploy         # vsce publish
```

Press **F5** in VS Code to launch the Extension Development Host for manual testing.

## Architecture

```
src/
  extension.ts          # activate() / deactivate() — wires everything together
  serverManager.ts      # spawns & kills the uvicorn process via child_process.spawn
  statusBar.ts          # status bar item: "$(circle-slash) OpenRouter" / "$(check) OpenRouter"
  envInjector.ts        # wraps context.environmentVariableCollection for terminal env injection
  settingsProvider.ts   # typed getters over vscode.workspace.getConfiguration('openrouter')
server/                 # bundled Python proxy server (uvicorn/FastAPI)
  server.py             # FastAPI app entry point
  pyproject.toml        # uv project file
  uv.lock               # locked dependencies
  api/                  # route handlers and request processing
  providers/            # OpenRouter, NVIDIA NIM, LM Studio backends
  config/               # settings and logging configuration
  cli/                  # CLI session management
  messaging/            # Discord/Telegram bot integration
```

### Data Flow

1. User clicks status bar item → `openrouter.toggle` command fires
2. Toggle **ON**:
   - `ServerManager.start()` spawns `uv run uvicorn ...` in `E:\Repos\free-claude-code` with the configured env vars
   - `EnvInjector.apply()` populates `context.environmentVariableCollection` so all new terminals (PowerShell/bash) inherit the vars
   - Status bar updates to active state
3. Toggle **OFF**:
   - `ServerManager.stop()` kills the child process
   - `EnvInjector.clear()` clears `context.environmentVariableCollection`
   - Status bar resets

### Terminal Environment Injection

Use `vscode.ExtensionContext.environmentVariableCollection` (the correct VS Code API — not `terminal.integrated.env.*` in settings, which persists globally). This collection is automatically applied to every terminal the user opens while the extension is active and the toggle is on. On toggle-off, call `.clear()`.

Vars injected when toggle is ON:

| Variable | Value | VS Code Setting |
|---|---|---|
| `ANTHROPIC_BASE_URL` | `http://localhost:{port}` | `openrouter.port` |
| `ANTHROPIC_AUTH_TOKEN` | `freecc` | hardcoded |
| `OPENROUTER_API_KEY` | user's API key | `openrouter.apiKey` |
| `MODEL` | fallback model for all requests | `openrouter.model` (optional) |
| `MODEL_OPUS` | model for Claude Opus requests | `openrouter.modelOpus` (optional) |
| `MODEL_SONNET` | model for Claude Sonnet requests | `openrouter.modelSonnet` (optional) |
| `MODEL_HAIKU` | model for Claude Haiku requests | `openrouter.modelHaiku` (optional) |

### Server Manager

- Spawn with `child_process.spawn('uv', ['run', 'uvicorn', 'server:app', '--host', '0.0.0.0', '--port', port], { cwd: serverPath, env: { ...process.env, ...injectedVars } })`
- Capture stdout/stderr to the **OpenRouter Server** Output Channel (`vscode.window.createOutputChannel`)
- On VS Code shutdown (`deactivate()`), kill the child process if still running
- Expose server status (stopped / starting / running / error) for status bar display

## Extension Settings (`package.json` contributes.configuration)

| Setting | Type | Default | Description |
|---|---|---|---|
| `openrouter.apiKey` | string | `""` | OpenRouter API key (`OPENROUTER_API_KEY`) |
| `openrouter.serverPath` | string | `""` | Path to proxy server dir; empty = use bundled `server/` |
| `openrouter.port` | number | `8082` | Port for the uvicorn server |
| `openrouter.model` | string | `""` | Default `MODEL` override (optional) |
| `openrouter.modelOpus` | string | `""` | `MODEL_OPUS` override (optional) |
| `openrouter.modelSonnet` | string | `""` | `MODEL_SONNET` override (optional) |
| `openrouter.modelHaiku` | string | `""` | `MODEL_HAIKU` override (optional) |
| `openrouter.autoStartServer` | boolean | `true` | Start server automatically when toggle is enabled |

## Key Design Decisions

- **Toggle default is OFF** — `context.globalState.get('openrouter.enabled', false)`; never auto-enable on install
- **`environmentVariableCollection` over settings mutation** — injecting via the collection is scoped to the extension's lifetime and doesn't permanently dirty the user's `settings.json`
- **Output channel for server logs** — never show raw process output as notifications; use `vscode.window.createOutputChannel('OpenRouter Server')`
- **Graceful shutdown** — `deactivate()` must `await ServerManager.stop()` so the port is freed before VS Code exits
- **No bundler required initially** — use `tsc` directly; add esbuild only if startup time becomes a problem

## File Locations

- Proxy server source: `server/server.py` (bundled in this repo)
- Server start command: `uv run uvicorn server:app --host 0.0.0.0 --port 8082` (run in `server/`)
- Claude Code uses the proxy via: `ANTHROPIC_BASE_URL=http://localhost:8082 ANTHROPIC_AUTH_TOKEN=freecc claude`
- `settingsProvider.getSettings(extensionPath)` resolves server path as `extensionPath + '/server'` when `openrouter.serverPath` is empty
