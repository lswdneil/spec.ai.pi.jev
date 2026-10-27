# The Windows desktop MCP

The Windows desktop app ships a standalone
[Windows-MCP](https://github.com/CursorTouch/Windows-MCP) server. It is enabled
by default, so an installed app can operate the Windows desktop without a
separate Python, uv, or package install.

It runs as a stdio MCP server, with the executable under
`resources/bundled-mcp/windows-mcp.exe`. The app adds a built-in server named
`windows-mcp` to the same database as the in-app browser MCP. Its tools are
shown in Settings → Tools and can be turned off there.

The server provides the Windows-MCP tools: application and window control,
UI snapshots, screenshots, mouse and keyboard input, file operations,
PowerShell, the registry, processes and notifications. It is powerful by
design; turn the server off if you do not want the agent to control the
desktop.

The bundled build is made from the Windows-MCP checkout at commit `cef52ec`
(version 0.8.8) with PyInstaller. To build it yourself:

```sh
cd Windows-MCP
uv sync --frozen
uv pip install pyinstaller
uv run pyinstaller --clean --noconfirm --onefile --name windows-mcp \
  --paths src src/windows_mcp/__main__.py
```

Then stage it for the desktop build:

```sh
MU_WINDOWS_MCP_BINARY=/path/to/Windows-MCP/dist/windows-mcp.exe \
  node desktop/scripts/prepareWindowsMcpResources.js
```

The desktop build copies it into `resources/bundled-mcp/windows-mcp.exe` and
checks that the packaged app contains it.
