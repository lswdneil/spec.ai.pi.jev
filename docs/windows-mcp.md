# The Windows desktop MCP

The Windows desktop app ships a standalone
[Windows-MCP](https://github.com/CursorTouch/Windows-MCP) server. It is enabled
by default, so an installed app can operate the Windows desktop without a
separate Python, uv, or package install.

It runs as a stdio MCP server, with the executable under
`resources/bundled-mcp/windows-mcp.exe`. Two surfaces hold the same default:

- spec.jev's native host gets it in `<agentDir>/mcp.json` (usually
  `~/.spec.jev/agent/mcp.json`). The dense settings page that reads that file
  is **Settings → MCP servers**, where it is shown as **Windows desktop** and
  can be switched off or removed.
- The app's classic MCP database gets a built-in record named `windows-mcp`,
  which is what the classic **Settings → Tools** page reads.

The dense UI has a separate decision-point page also called **Tools** under
**Details**; that page is not the MCP server list. Search settings for `MCP`
to open the server list directly.

The server provides the Windows-MCP tools: application and window control,
UI snapshots, screenshots, mouse and keyboard input, file operations,
PowerShell, the registry, processes and notifications. It is powerful by
design; turn the server off if you do not want the agent to control the
desktop.

The bundled build is made from the Windows-MCP checkout at commit `cef52ec`
(version 0.8.8) with PyInstaller. The release job runs:

```sh
node desktop/scripts/buildWindowsMcp.js
```

It clones the pinned commit when no `WINDOWS_MCP_SOURCE` is given, installs
Python through `uv`, and builds the one-file executable. To use an existing
checkout:

```sh
WINDOWS_MCP_SOURCE=/path/to/Windows-MCP node desktop/scripts/buildWindowsMcp.js
```

To stage an already built executable for a local desktop build:

```sh
MU_WINDOWS_MCP_BINARY=/path/to/Windows-MCP/dist/windows-mcp.exe \
  node desktop/scripts/prepareWindowsMcpResources.js
```

The desktop build copies it into `resources/bundled-mcp/windows-mcp.exe` and
checks that the packaged app contains it.
