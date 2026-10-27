/**
 * Stages the Windows desktop MCP server under resources/bundled-mcp/windows-mcp.exe.
 *
 * MU_WINDOWS_MCP_BINARY may name a standalone executable built from the Windows-MCP source. Without it the
 * server is absent; local builds that promise the default service set MU_REQUIRE_WINDOWS_MCP=1 so afterPack
 * rejects an installer that is missing it.
 */
const { promises: fs } = require('node:fs');
const path = require('node:path');

async function main() {
  const destination = path.resolve(__dirname, '..', 'resources', 'bundled-mcp', 'windows-mcp.exe');
  await fs.mkdir(path.dirname(destination), { recursive: true });

  const supplied = process.env.MU_WINDOWS_MCP_BINARY;
  if (!supplied) {
    console.warn('No MU_WINDOWS_MCP_BINARY: the installer will not carry the Windows desktop MCP.');
    return;
  }

  const source = path.resolve(supplied);
  const stat = await fs.stat(source);
  if (!stat.isFile()) throw new Error(`MU_WINDOWS_MCP_BINARY is not a file: ${source}`);
  await fs.copyFile(source, destination);
  console.log(`Bundled Windows MCP from ${source} at ${destination}`);
}

main().catch((error) => {
  console.error(`prepareWindowsMcpResources failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
