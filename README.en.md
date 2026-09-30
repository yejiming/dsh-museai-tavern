# MuseAI Tavern · MuseAI tab for DeepSeek Harness

**中文** | [English](README.en.md)

Adds a **MuseAI** tab to the right of the Trajectory tab in DeepSeek Harness's conversation tab bar, bringing MuseAI's five desktop pages (Background / Chat / Adventure / Bond / Settings) into the DSH web GUI, with every model call reusing DSH's own model configuration — **no separate API / key configuration**.

## Features

- **MuseAI conversation-view tab**: registered on the `conversation.view` slot (order 15, right of Trajectory at order 10); the session pane renders the MuseAI view with its own five-page navigation (Background / Chat / Adventure / Bond / Settings).
- **Background page** (without the AI extraction of world books / character cards): manual world-book / character-card management (custom fields, character-card tree grouped by world book), JSON import/export, MuseAI / SillyTavern dual-format export with SillyTavern conversion preview, style presets, AI memory distillation, world-book deletion (with or without its cards).
- **Chat page**: partner roleplay. Bind a world book + character card, streaming conversation (Markdown + collapsible thinking + stop), session history / title editing, style presets, memory archiving, context usage ring.
- **Adventure page**: text adventure / GM storytelling. World book + multi character-card selection (checking a world book brings out its cards), dynamic role loading, three input modes, streaming story with `[[TOOL]]` bubbles and `<choices>` candidate buttons, multi-card memory archiving, session saving.
- **Bond page**: relationship overview, bond timeline, linked chat / adventure sessions.
- **Settings page**: all system prompts (copied verbatim from MuseAI's defaults; editable / resettable) and per-agent sampling parameters (temperature / maxOutputTokens / maxContextTokens / thinkingDepth, …); the **model area is a "DSH model picker"**: follow the DSH default model, or pick any provider/model from DSH's configured catalog — no baseUrl / API key / connectivity test anywhere.
- **Persistence**: data (world books, character cards, sessions, settings, style presets) is persisted server-side through the plugin's storage domain at `$DSH_HOME/storages/museai.json` (storage-domain json backend), with browser localStorage only as an offline mirror; survives restarts.

## Quick install

Requires **DeepSeek Harness `>=0.2.0-rc.1`** (including `0.2.0-rc.2`).
Check your installed version with `dsh --version`; `0.1.x` is no longer supported.

Two install methods, neither requires a local build (the prebuilt output in
`lib/` is committed, and no `prepare`/`prepack` scripts are declared).

### Method 1: npm (recommended)

```sh
# Install from npm (initializes the profile on first use)
dsh plugin --profile web add @yejiming/dsh-museai-tavern
```

### Method 2: GitHub source

```sh
# Install from the GitHub source (lib/ is committed, no build at install time)
dsh plugin --profile web add github:yejiming/dsh-museai-tavern
```

Verify after install:

```sh
dsh --profile web --dump-config   # should list the museai and museai-routes rows
```

Start the web GUI:

```sh
dsh --profile web
```

In the web GUI: open any session → the **MuseAI** tab appears right of Trajectory → check the Settings page for the model (defaults to following DSH's default model, or pick from the catalog) → create a world book / character card in Background → chat with a character, run an adventure, inspect relationships in Bond.

> Model prerequisite: DSH must have at least one configured model (provider/model); otherwise the settings page shows an empty-state hint and generation requests return an error.

## Architecture

```text
Browser (apps/web)                       Host process (dsh --profile web)
┌─────────────────────────────┐          ┌──────────────────────────────────────┐
│ MuseAI view (conversation.  │  fetch   │ @yejiming/dsh-museai-tavern (host row)│
│  .view, order 15)           │ ───────▶ │  · museaiStore service (domain/mem)  │
│  · Background/Chat/Adventure│          │ @yejiming/dsh-museai-tavern/routes    │
│  · Bond/Settings (DSH model │          │  · /plugins/museai/models|chat|       │
│    picker)                  │          │    complete|store/*|sessions/*        │
│  · zustand + syncStorage    │          └──────────────┬───────────────────────┘
└─────────────────────────────┘                         │ ctx.llm (DSH models)
                                                        ▼
                                     DeepSeek / other configured adapters
```

One npm package, two mount faces, two host rows:

| Face | Entry | Mounted by |
|---|---|---|
| Host row (store service / config) | `lib/index.js` (row `museai`) | host composition: opens the `museai` storage domain (memory fallback on failure), provides `museaiStore`; headless-safe |
| Routes row (model bridge / store / sessions) | `lib/routes.js` (row `museai-routes`) | host composition: registers `/plugins/museai/*` via nested inject where a webserver exists; skipped headless |
| Browser half (tab / pages) | `lib/client.js` (`dsh.client` declaration) | browser: registers the MuseAI tab and its five pages |

## Configuration

Every field has a loader default; no library defaults; **no credential fields**.

| Key | Meaning |
|---|---|
| `chatTimeoutMs` | end-to-end streaming timeout (default 120000 ms) |
| `completeTimeoutMs` | one-shot completion timeout (default 120000 ms) |
| `modelsTimeoutMs` | model-catalog interrogation timeout (default 10000 ms) |
| `maxCompleteChars` | captured non-streaming output cap (default 20000 chars) |

```yaml
# cordis.patch.yml or profile-layer override example
- id: museai
  config:
    chatTimeoutMs: 180000
```

## HTTP surface (used by the browser half)

- `GET  /plugins/museai/models` — DSH model catalog `{groups, failures, defaultSelection}`
- `POST /plugins/museai/chat` — streaming generation (NDJSON: start/delta/thinking_delta/done/error/aborted)
- `POST /plugins/museai/complete` — one-shot generation `{text, reasoning}`
- `GET/PUT /plugins/museai/store/<key>` — one store blob (settings/partners/partnerChat/story/stylePresets/agent)
- `GET /plugins/museai/sessions/<kind>` and `GET/PUT/DELETE .../sessions/<kind>/<id>` — session records (kind=partner|story)

## Development

```sh
pnpm install
pnpm build        # tsdown both halves + type declarations
pnpm typecheck    # server-side typecheck (client below)
npx tsc -p tsconfig.client.json --noEmit   # client typecheck
pnpm test         # vitest (server routes / storage domain + ported utils)
```

`lib/` is committed, so installing and debugging (including `dsh plugin add .`)
never requires a build. To rebuild the artifacts, just run `pnpm install`: all
`@deepseek-ai/*` dependencies are published on npm, so there is no need to copy
or symlink `node_modules` from a local DSH checkout anymore.
`pnpm-workspace.yaml` follows the dsh convention (`nodeLinker: hoisted`); pnpm
11's supply-chain policy blocks freshly published packages and dependency build
scripts, so the repository pre-declares `minimumReleaseAgeExclude` (`0.2.0-rc.1`
and its companion dependencies) and `allowBuilds: esbuild`.

Development dependencies pin the minimum supported version, `0.2.0-rc.1`, while
host peer dependencies accept `>=0.2.0-rc.1`. The client uses Cordis `Context`
and `dsh-client-ui-renderer`; the model bridge handles errors and cancellation
reported through `finish.reason`. After changing source files, run `pnpm build`
and include `lib/` with the changes so source installs receive the updated artifacts.

## License

MIT
