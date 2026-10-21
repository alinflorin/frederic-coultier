# frederic-coultier

A jewelry design studio driven by an AI agent. The geometry is made in [Rhino](https://www.rhino3d.com/): the design
script (RhinoScript, Python) runs there, the app shows the result in its own 3D preview, checks it for casting and
printing, adds supports and a sprue, and exports files ready to produce.

## Rhino

The app talks to a plugin inside Rhino 8, [tectopus](https://github.com/Creative-Data-Critical-Design/tectopus)
(`rhinomcp-mod` in Rhino's Package Manager), which listens on `127.0.0.1:1999` (command `mcpmodstart`). The address is set in
**Preferences → Rhino**; the indicator in the top bar shows whether Rhino is reachable and what document it has open.
Keep the document in **millimetres**. Only the plugin is needed: the Python MCP server of that project is not used.

- **The design script** (the Source pane) is RhinoScript, Python 2.7 (IronPython), saved in the project as `model.py`.
  Each run replaces the objects the previous run made (on the layer `FC`) and the preview reads the geometry back through
  Rhino's own STL export. Top-level `name = number  # [min:step:max]` lines become sliders.
- **The preview, checks, supports, sprue, hollowing and export** work on that geometry, as before.
- The Rhino export goes through a folder that both the app and Rhino can reach (the app's cache folder, under the user's home;
  on Linux, Rhino runs under Wine and sees it as drive `Z:`).

## Agent chat

The chat panel is always on. It uses Claude Code or Codex, with the account already signed in on the computer, and drives the app through
`fc`, a command line that exists only inside the app (internal MCP server on loopback, on a port the system picks; nothing outside connects to it).

It exposes two tools:

- `read_instructions` returns the user's own notes followed by the reference of `fc`, and `exec_fc` refuses to run until it has been read.
- `exec_fc` runs `fc` commands (`args` is the command line without the leading `fc`), e.g. `src cat 1:40`, `shot --view top`, `check --deep`,
  `get-document-info`, `create-objects`, `capture-view`.

**The notes are [`src-tauri/docs/fc-cli.md`](src-tauri/docs/fc-cli.md)**: write whatever the agent should know or follow. They come
first in `read_instructions`; `<!-- comments -->` are not sent. In debug builds the file is read from disk on every call, so changes
show up without a rebuild; release builds embed it. The command reference below them is generated from the code
(`src-tauri/src/agent/cli/catalog.rs`) and from the Rhino plugin's tool descriptions
([`src-tauri/docs/rhino-tools.json`](src-tauri/docs/rhino-tools.json), made from the tool definitions of the tectopus MCP layer,
word for word), so it cannot go out of date.

The knowledge base (`src-tauri/kb/`) holds jewelry and casting notes and the `rhinoscriptsyntax` reference
(`kb functions CATEGORY`, `kb function NAME`, `kb search`).

Code: `src-tauri/src/rhino.rs` (the plugin client and the design loop), `src-tauri/src/agent/` (`cli/` parser and commands,
`cli/rhino_tools.rs` the plugin's tools as commands, `server.rs`, `tools.rs`) and `src/agent/` (what each operation does in the app).
