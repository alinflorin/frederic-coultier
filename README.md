# frederic-coultier
## Agent access (MCP)

While the app runs it serves an MCP endpoint on loopback, so an agent (or the MCP inspector) can
read and edit the open project, take pictures of the preview, run checks and manage supports and sprue.

- URL: `http://127.0.0.1:45555/mcp`. Host and port are set in **Preferences → Agent connection**, which also shows whether
  the server runs, copies the URL and prints the `claude mcp add` command. The port is never chosen at random: if it is taken,
  Preferences says so and the server stays off until you pick another.
- No token: by default the server only listens on loopback, checks the `Host` header, and refuses any request that carries an
  `Origin` header, so web pages can't reach it. Other programs on the same machine can. Setting a host other than loopback
  (for example `0.0.0.0`) exposes the app to the network without a password; Preferences warns about it.
- Inspector: `npx @modelcontextprotocol/inspector`, transport Streamable HTTP, the URL above.

It exposes just two tools, to keep the agent's context small:

- `read_instructions` returns the user's own notes followed by the reference of `fc`, a command line that exists only inside the app.
  Agents are told, in the server instructions and in both tool descriptions, to read it before anything else, and `exec_fc`
  refuses to run until it has been read (once per app start: stateless clients can't be told apart per session).
- `exec_fc` runs `fc` commands (`args` is the command line without the leading `fc`), e.g. `src cat 1:40`, `shot --view top`, `check --deep`.

**Your notes are [`src-tauri/docs/fc-cli.md`](src-tauri/docs/fc-cli.md)**: write whatever the agent should know or follow. They come
first in `read_instructions`; `<!-- comments -->` are not sent. In debug builds the file is read from disk on every call, so changes
show up without a rebuild; release builds embed it. The command reference below them is generated from the code
(`src-tauri/src/agent/cli/catalog.rs`), so it cannot go out of date.

Code: `src-tauri/src/agent/` (`cli/` parser and commands, `server.rs`, `tools.rs`, `text.rs` source editing) and
`src/agent/` (what each operation does in the app: it works on the live project, so the user sees changes as they happen).
