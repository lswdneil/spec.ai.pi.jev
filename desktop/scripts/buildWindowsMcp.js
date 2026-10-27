/**
 * Builds the standalone Windows-MCP server from its source checkout with PyInstaller.
 *
 * The desktop release job uses this so the installer carries the exact pinned source, not a package that
 * needs Python or uv on the person's machine. A local build can pass WINDOWS_MCP_SOURCE to reuse a checkout;
 * without it the script clones the pinned commit into the temporary folder.
 */
const { execFileSync } = require('node:child_process');
const { existsSync, promises: fs } = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const COMMIT = 'cef52ec';
const REPOSITORY = 'https://github.com/CursorTouch/Windows-MCP.git';

function run(command, args, cwd) {
  console.log(`> ${command} ${args.join(' ')}`);
  execFileSync(command, args, { cwd, stdio: 'inherit' });
}

async function main() {
  const source = process.env.WINDOWS_MCP_SOURCE
    ? path.resolve(process.env.WINDOWS_MCP_SOURCE)
    : path.join(os.tmpdir(), `specjev-windows-mcp-${COMMIT}`);
  if (!existsSync(source)) {
    run('git', ['clone', '--filter=blob:none', REPOSITORY, source]);
    run('git', ['-C', source, 'checkout', COMMIT]);
  } else if (!process.env.WINDOWS_MCP_SOURCE) {
    console.log(`Reusing Windows-MCP checkout at ${source}`);
  }

  run('uv', ['sync', '--frozen'], source);
  run('uv', ['pip', 'install', 'pyinstaller'], source);
  run(
    'uv',
    [
      'run',
      'pyinstaller',
      '--clean',
      '--noconfirm',
      '--onefile',
      '--name',
      'windows-mcp',
      '--paths',
      'src',
      'src/windows_mcp/__main__.py',
    ],
    source
  );

  const built = path.join(source, 'dist', 'windows-mcp.exe');
  if (!existsSync(built)) throw new Error(`PyInstaller did not write ${built}`);
  const destination = path.resolve(__dirname, '..', 'resources', 'bundled-mcp', 'windows-mcp.exe');
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(built, destination);
  console.log(`Built Windows-MCP at ${destination}`);
}

main().catch((error) => {
  console.error(`buildWindowsMcp failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
