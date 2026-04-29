# OpenRouter Server — VS Code Extension

Route Claude Code CLI through alternative LLM providers (OpenRouter, NVIDIA NIM, or LM Studio) from your VS Code terminal.

## What It Does

This VS Code extension bundles a local FastAPI proxy server that intercepts Anthropic API calls from the Claude Code CLI and forwards them to your choice of provider:

- **OpenRouter** — access 200+ models from Anthropic, Meta, Mistral, etc. at usage-based pricing
- **NVIDIA NIM** — run models locally or via NVIDIA's microservices platform
- **LM Studio** — route to a local LM Studio instance on `localhost:1234`

The extension provides a status bar toggle (default: **off**) that starts/stops the proxy and automatically injects the required environment variables into every VS Code terminal so Claude Code CLI works without manual configuration.

## How It Works

1. **Toggle ON** (status bar item):
   - Spawns a local uvicorn/FastAPI server in `server/`
   - Injects env vars (`ANTHROPIC_BASE_URL`, `OPENROUTER_API_KEY`, model mappings) into all new terminals
   - Claude Code CLI automatically routes through the proxy

2. **Make requests** via Claude Code CLI — the proxy maps Claude model names (claude-opus-4, claude-sonnet-4-5, etc.) to your configured provider/model strings

3. **Toggle OFF**:
   - Stops the server
   - Clears injected env vars

The status bar shows the proxy state and, after your first request, the active model and tier being used.

## Prerequisites

Before you begin, ensure you have:

- **VS Code** 1.90 or later
- **Node.js** 16+ and **npm** (to build the extension)
- **Python** 3.14+ (for the proxy server)
- **`uv` package manager** — install from https://github.com/astral-sh/uv
- **At least one API key** for your chosen provider:
  - [OpenRouter API key](https://openrouter.ai/) (free to sign up)
  - [NVIDIA NIM API key](https://build.nvidia.com/) (free tier available)
  - A running **LM Studio** instance on `localhost:1234` (free, open-source)

## Installation

### 1. Build & Install the VS Code Extension

```bash
# Clone the repository
git clone <your-repo-url>
cd openrouter-vscode-extension

# Install Node dependencies
npm install

# Build the extension
npm run compile

# Package as .vsix
npm run package
```

This creates `openrouter-vscode-*.vsix` in the root directory.

In VS Code:
1. Press `Ctrl+Shift+P` → "Extensions: Install from VSIX..."
2. Select the `.vsix` file

(Alternatively, drag the `.vsix` into VS Code's Extensions panel.)

### 2. Configure the Proxy Server

```bash
# Install Python dependencies
cd server
cp .env.example .env
```

Edit `server/.env` with your API keys and model choices:

```env
# Choose your primary provider and add its API key
OPENROUTER_API_KEY=sk-...

# Map Claude model tiers to provider/model strings
MODEL_OPUS=open_router/anthropic/claude-opus-4
MODEL_SONNET=open_router/anthropic/claude-sonnet-4-5
MODEL_HAIKU=open_router/anthropic/claude-haiku-4-5

# (Or use a local LM Studio instance)
# LM_STUDIO_BASE_URL=http://localhost:1234/v1
# MODEL_OPUS=lmstudio/mistral-7b
```

Then install Python dependencies:

```bash
uv sync
```

### 3. Configure VS Code Settings (Optional)

Open VS Code **Settings** → search for "openrouter":

- **`openrouter.apiKey`**: Your OpenRouter API key (or leave blank to read from `server/.env`)
- **`openrouter.port`**: Port for the proxy server (default: `8082`)
- **`openrouter.serverPath`**: Path to the `server/` directory (default: bundled in the extension)
- **`openrouter.autoStartServer`**: Auto-start the server when you toggle ON (default: `true`)

## Usage

1. Click the **"$(circle-slash) OpenRouter"** status bar item at the bottom of VS Code to toggle the proxy ON
   - First time: the proxy will start (takes a few seconds)
   - Status bar shows **"$(check) OpenRouter"** when running

2. Open a terminal in VS Code — the required env vars are automatically injected

3. Use Claude Code CLI normally:
   ```bash
   claude
   ```

4. After your first request, the status bar updates to show the active model and tier:
   - **"$(check) OpenRouter | Opus"**
   - **"$(check) OpenRouter | Sonnet"**
   - etc.

5. Click the status bar item again to toggle OFF (stops the server)

## Configuration Reference

### VS Code Settings

| Setting | Type | Default | Purpose |
|---------|------|---------|---------|
| `openrouter.apiKey` | string | `""` | OpenRouter API key; injected as `OPENROUTER_API_KEY`. Falls back to `server/.env` if empty. |
| `openrouter.modelOpus` | string | `""` | Provider/model for Claude Opus requests. Format: `provider/model`. Fallback: `openrouter.model`. |
| `openrouter.modelSonnet` | string | `""` | Provider/model for Claude Sonnet requests. Format: `provider/model`. Fallback: `openrouter.model`. |
| `openrouter.modelHaiku` | string | `""` | Provider/model for Claude Haiku requests. Format: `provider/model`. Fallback: `openrouter.model`. |
| `openrouter.model` | string | `""` | Fallback model for all requests. Server default: `nvidia_nim/meta/llama3-70b-instruct`. |
| `openrouter.port` | number | `8082` | TCP port for the uvicorn proxy server. |
| `openrouter.serverPath` | string | `""` | Absolute path to a custom `server/` directory. Empty = use bundled. |
| `openrouter.autoStartServer` | boolean | `true` | Auto-start uvicorn when toggle is enabled. |

### Server Environment Variables (`server/.env`)

| Variable | Example | Purpose |
|----------|---------|---------|
| `OPENROUTER_API_KEY` | `sk-...` | Your OpenRouter API key. |
| `NVIDIA_NIM_API_KEY` | (your key) | Your NVIDIA NIM API key (for `nvidia_nim/` models). |
| `LM_STUDIO_BASE_URL` | `http://localhost:1234/v1` | Base URL for a local LM Studio instance. |
| `MODEL_OPUS` | `open_router/anthropic/claude-opus-4` | Provider/model for Claude Opus-tier requests. |
| `MODEL_SONNET` | `open_router/anthropic/claude-sonnet-4-5` | Provider/model for Claude Sonnet-tier requests. |
| `MODEL_HAIKU` | `open_router/anthropic/claude-haiku-4-5` | Provider/model for Claude Haiku-tier requests. |
| `MODEL` | `nvidia_nim/meta/llama3-70b-instruct` | Fallback model for all Claude requests. |
| `PROVIDER_RATE_LIMIT` | `40` | Max requests per rate window. |
| `PROVIDER_RATE_WINDOW` | `60` | Rate window in seconds. |
| `PROVIDER_MAX_CONCURRENCY` | `5` | Max concurrent provider requests. |

See `server/.env.example` for all available configuration options, including bot integration and voice transcription settings.

## Model Format

Model strings use the format:

```
provider/model-name
```

**Valid provider prefixes:**
- `open_router` — OpenRouter API
- `nvidia_nim` — NVIDIA NIM
- `lmstudio` — Local LM Studio instance

**Examples:**
```
open_router/anthropic/claude-opus-4
open_router/meta-llama/llama-3.1-8b-instruct
open_router/mistral-ai/mistral-7b:free
nvidia_nim/meta/llama3-70b-instruct
nvidia_nim/z-ai/glm4.7
lmstudio/mistral-7b
```

## Optional Features

### Voice Transcription

The proxy can transcribe voice notes to text using OpenAI's Whisper model. Choose your transcription backend:

**Option 1: NVIDIA NIM Riva** (requires NVIDIA account):
```bash
cd server
uv sync --extra voice
```

Then in `server/.env`:
```env
VOICE_NOTE_ENABLED=true
WHISPER_DEVICE=nvidia_nim
WHISPER_MODEL=openai/whisper-large-v3
```

**Option 2: Local Whisper** (CPU or CUDA):
```bash
cd server
uv sync --extra voice_local
```

Then in `server/.env`:
```env
VOICE_NOTE_ENABLED=true
WHISPER_DEVICE=cuda  # or "cpu"
WHISPER_MODEL=openai/whisper-large-v3
```

### Telegram / Discord Bot Integration

Configure the proxy to receive Claude Code jobs via Telegram or Discord:

In `server/.env`:
```env
MESSAGING_PLATFORM=discord  # or "telegram"
DISCORD_BOT_TOKEN=...
ALLOWED_DISCORD_CHANNELS=123456,789012
```

(See `server/.env.example` for Telegram setup.)

## Development

### Build Commands

```bash
npm run compile      # One-shot TypeScript build
npm run watch        # Watch mode (use during development)
npm run lint         # Run ESLint
npm run test         # Run VS Code extension tests (launches Extension Development Host)
npm run package      # Package as .vsix
npm run deploy       # Publish to VS Code Marketplace
```

### Testing the Extension

Press **F5** in VS Code to launch the **Extension Development Host** — a new VS Code window running your modified extension for manual testing.

## Architecture

- **[src/extension.ts](src/extension.ts)** — activate/deactivate, status bar toggle, model watcher
- **[src/serverManager.ts](src/serverManager.ts)** — spawns and kills the uvicorn process
- **[src/statusBar.ts](src/statusBar.ts)** — status bar item UI and state
- **[src/envInjector.ts](src/envInjector.ts)** — injects env vars into terminal
- **[src/settingsProvider.ts](src/settingsProvider.ts)** — reads VS Code settings and `server/.env`
- **[server/server.py](server/server.py)** — FastAPI app entry point
- **[server/api/routes.py](server/api/routes.py)** — Anthropic API route handlers
- **[server/providers/](server/providers/)** — OpenRouter, NVIDIA NIM, LM Studio backend implementations

See [CLAUDE.md](CLAUDE.md) for full developer documentation and data flow diagrams.

## Troubleshooting

### Port Already in Use

If port 8082 is in use, change it in VS Code settings:

1. Settings → search "openrouter.port"
2. Set to an available port (e.g., `8083`)

### Server Fails to Start

Check the **OpenRouter Server** output channel in VS Code:

1. View → Output
2. Select **"OpenRouter Server"** from the dropdown
3. Look for error messages

Common issues:
- Missing `uv` or Python 3.14+: install `uv` from https://github.com/astral-sh/uv
- Missing API keys: edit `server/.env`
- Network timeouts: check your internet connection and provider status

### Claude Code CLI Not Using the Proxy

Ensure the extension is **ON** (status bar shows **"$(check) OpenRouter"**) and you opened the terminal *after* toggling on — the env vars are only injected to new terminals.

If you opened the terminal before toggling on, close it and open a new one.

## License

[Specify your license, e.g., MIT, Apache 2.0, etc.]

## Contributing

Contributions welcome! Please open an issue or pull request.

---

Built with ❤️ for Claude Code users.
