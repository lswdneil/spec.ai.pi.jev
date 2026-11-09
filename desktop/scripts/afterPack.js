const { Arch } = require('builder-util');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  normalizeArch,
  rebuildSingleModule,
  verifyModuleBinary,
  getModulesToRebuild,
} = require('./rebuildNativeModules');
const { verifyBundledAioncoreResources } = require('../packages/shared-scripts/src/verify-bundled-aioncore-resources');
const { verifyBundledHarness } = require('../packages/shared-scripts/src/verify-bundled-harness');
const { refreshIntegrityRecord } = require('../packages/shared-scripts/src/bundle-integrity');

/**
 * afterPack hook for electron-builder
 * Rebuilds native modules for cross-architecture builds
 */

function resolveResourcesDir(electronPlatformName, appOutDir, packager) {
  if (electronPlatformName !== 'darwin') return path.join(appOutDir, 'resources');

  const appName = packager?.appInfo?.productFilename || 'mu';
  return path.join(appOutDir, `${appName}.app`, 'Contents', 'Resources');
}

function verifyBundledResources(resourcesDir, electronPlatformName, targetArch) {
  const provenancePath = path.join(resourcesDir, 'build-provenance.json');
  let provenance;
  try {
    provenance = JSON.parse(fs.readFileSync(provenancePath, 'utf8'));
  } catch {
    throw new Error(`Packaged app has no readable build provenance: ${provenancePath}`);
  }
  if (provenance.platform !== electronPlatformName || provenance.arch !== targetArch) {
    throw new Error(
      `Packaged app build provenance is for ${provenance.platform}-${provenance.arch}, not ${electronPlatformName}-${targetArch}`
    );
  }
  if (process.env.MU_REQUIRE_SIGNED_BUILD === '1' && provenance.signed !== true) {
    throw new Error('This release build is unsigned but signed builds are required');
  }

  // electron-builder can normalize the copied tree (for example, dropping empty directories). Stamp
  // the manifests from the packaged files themselves so startup verifies exactly what was installed.
  const aioncoreManifest = path.join(
    resourcesDir,
    'bundled-aioncore',
    `${electronPlatformName}-${targetArch}`,
    'manifest.json'
  );
  const harnessManifest = path.join(resourcesDir, 'harness', 'bundle.json');
  for (const manifestPath of [aioncoreManifest, harnessManifest]) {
    if (fs.existsSync(manifestPath)) refreshIntegrityRecord(manifestPath);
  }

  const result = verifyBundledAioncoreResources({
    resourcesDir,
    electronPlatformName,
    targetArch,
  });

  if (result.missing.length > 0) {
    console.error(`   Missing bundled resources: ${result.missing.join(', ')}`);
    throw new Error(`Packaged app is missing required bundled resource(s): ${result.missing.join(', ')}`);
  }

  console.log(`   ✓ Bundled resources verified for ${result.runtimeKey} (${result.checked.length} checks)`);

  // mu itself (scripts/kyrn/bundle-harness.mjs), installed for this build's system and processor.
  const harness = verifyBundledHarness({ resourcesDir, electronPlatformName, targetArch });
  if (harness.missing.length > 0) {
    throw new Error(`Packaged app is missing spec.jev: ${harness.missing.join(', ')}`);
  }
  console.log(`   spec.jev ${harness.version} verified (${harness.checked.length} checks)`);

  // AionCore starts every conversation through resources/spec.jev/acp.cmd, which runs this adapter.
  // `electron-vite build` does not create it — only the development config runs that plugin — and
  // scripts/build-mcp-servers.js does. A package built without that step starts the agent, gets
  // MODULE_NOT_FOUND, and shows "spec.jev 启动失败", so fail the build here instead.
  const adapter = path.join(resourcesDir, 'app.asar.unpacked', 'out', 'main', 'mu-acp.js');
  if (!fs.existsSync(adapter)) {
    throw new Error(
      `Packaged app has no agent adapter: ${adapter}. ` +
        'Run "node scripts/build-mcp-servers.js" after the vite build and before electron-builder.'
    );
  }
  console.log(`   agent adapter verified (${adapter})`);

  if (electronPlatformName === 'win32' || electronPlatformName === 'linux') {
    const moli = path.join(
      resourcesDir,
      'bundled-moli',
      `${electronPlatformName}-${targetArch}`,
      electronPlatformName === 'win32' ? 'moli.exe' : 'moli'
    );
    if (!fs.existsSync(moli)) throw new Error(`Packaged app is missing bundled moli: ${moli}`);
    console.log(`   bundled moli verified (${moli})`);
  }

  if (electronPlatformName === 'win32') {
    const windowsMcp = path.join(resourcesDir, 'bundled-mcp', 'windows-mcp.exe');
    if (fs.existsSync(windowsMcp)) console.log(`   bundled Windows MCP verified (${windowsMcp})`);
    else if (process.env.MU_REQUIRE_WINDOWS_MCP === '1')
      throw new Error(`Packaged app is missing bundled Windows MCP: ${windowsMcp}`);
    else console.warn(`   bundled Windows MCP is not included (${windowsMcp})`);
  }

  // The agent-desktop skill drives this executable, which the app puts on PATH before any agent shell starts.
  // A packaged app without it would list the skill and then fail on its first command, so a staged binary must land.
  const agentDesktopRuntimeKey = `${electronPlatformName}-${targetArch}`;
  const agentDesktop = path.join(
    resourcesDir,
    'bundled-agent-desktop',
    agentDesktopRuntimeKey,
    electronPlatformName === 'win32' ? 'agent-desktop.exe' : 'agent-desktop'
  );
  const agentDesktopStaged = path.resolve(
    __dirname,
    '..',
    'resources',
    'bundled-agent-desktop',
    agentDesktopRuntimeKey,
    electronPlatformName === 'win32' ? 'agent-desktop.exe' : 'agent-desktop'
  );
  if (fs.existsSync(agentDesktop)) console.log(`   bundled agent-desktop verified (${agentDesktop})`);
  else if (process.env.MU_REQUIRE_AGENT_DESKTOP === '1' || fs.existsSync(agentDesktopStaged))
    throw new Error(`Packaged app is missing bundled agent-desktop: ${agentDesktop}`);
  else console.warn(`   bundled agent-desktop is not included (${agentDesktop})`);

  // The docx skill and stack-diagram run Python; the app carries one so a fresh Windows machine
  // needs no install. A staged runtime that did not land in the package would only show up as a
  // skill failing in the person's first conversation, so fail the build instead.
  if (electronPlatformName === 'win32') {
    const runtimeKey = `${electronPlatformName}-${targetArch}`;
    const staged = path.resolve(__dirname, '..', 'resources', 'bundled-python', runtimeKey);
    const python = path.join(resourcesDir, 'bundled-python', runtimeKey, 'python.exe');
    const required =
      process.env.MU_REQUIRE_BUNDLED_PYTHON === '1' ||
      (fs.existsSync(staged) && process.env.MU_SKIP_BUNDLED_PYTHON !== '1');
    if (fs.existsSync(python)) {
      execFileSync(python, ['-c', 'import docx'], { stdio: 'inherit' });
      console.log(`   bundled python verified (${python})`);
    } else if (required) {
      throw new Error(`Packaged app is missing bundled Python: ${python}`);
    } else {
      console.warn(`   bundled python is not included (${python})`);
    }
  }
}

module.exports = async function afterPack(context) {
  const { arch, electronPlatformName, appOutDir, packager } = context;
  const targetArch = normalizeArch(typeof arch === 'string' ? arch : Arch[arch] || process.arch);
  const buildArch = normalizeArch(os.arch());

  console.log(`\n🔧 afterPack hook started`);
  console.log(`   Platform: ${electronPlatformName}, Build arch: ${buildArch}, Target arch: ${targetArch}`);

  const isCrossCompile = buildArch !== targetArch;
  const forceRebuild = process.env.FORCE_NATIVE_REBUILD === 'true';
  const needsSameArchRebuild = electronPlatformName === 'win32'; // 只有 Windows 需要同架构重建以匹配 Electron ABI | Only Windows needs same-arch rebuild to match Electron ABI
  // Linux 使用预编译二进制，避免 GLIBC 版本依赖 | Linux uses prebuilt binaries which are GLIBC-independent

  const resourcesDir = resolveResourcesDir(electronPlatformName, appOutDir, packager);
  console.log(`   Checking resources directory: ${resourcesDir}`);
  if (fs.existsSync(resourcesDir)) {
    const resourcesContents = fs.readdirSync(resourcesDir);
    console.log(`   Contents: ${resourcesContents.join(', ')}`);

    const unpackedDir = path.join(resourcesDir, 'app.asar.unpacked');
    if (fs.existsSync(unpackedDir)) {
      const unpackedContents = fs.readdirSync(unpackedDir);
      console.log(`   app.asar.unpacked contents: ${unpackedContents.join(', ')}`);

      const nodeModulesDir = path.join(unpackedDir, 'node_modules');
      if (fs.existsSync(nodeModulesDir)) {
        const modulesContents = fs.readdirSync(nodeModulesDir);
        console.log(`   node_modules contents: ${modulesContents.slice(0, 10).join(', ')}...`);
      } else {
        console.warn(`   ⚠️  node_modules not found in app.asar.unpacked`);
      }
    } else {
      console.warn(`   ⚠️  app.asar.unpacked not found`);
    }

    verifyBundledResources(resourcesDir, electronPlatformName, targetArch);
  } else {
    throw new Error(`resources directory not found: ${resourcesDir}`);
  }

  if (!isCrossCompile && !needsSameArchRebuild && !forceRebuild) {
    console.log(`   ✓ Same architecture, rebuild skipped (set FORCE_NATIVE_REBUILD=true to override)\n`);
    return;
  }

  // Note: Previously there was an optimization to skip macOS cross-compilation,
  // but this caused incorrect architecture binaries (arm64) to be included in x64 builds.
  // Now we always rebuild native modules for cross-compilation to ensure correctness.
  // The rebuild process uses prebuild-install first (fast), falling back to source compilation only when needed.

  if (isCrossCompile) {
    console.log(`   ⚠️  Cross-compilation detected (${buildArch} → ${targetArch}), will rebuild native modules`);
    if (electronPlatformName === 'darwin') {
      console.log(`   💡 Using prebuild-install for faster cross-architecture build`);
    }
  } else if (needsSameArchRebuild || forceRebuild) {
    console.log(`   ℹ️  Rebuilding native modules for platform requirements (force=${forceRebuild})`);
  }

  console.log(`\n🔧 Checking native modules (${electronPlatformName}-${targetArch})...`);
  console.log(`   appOutDir: ${appOutDir}`);

  const electronVersion =
    packager?.info?.electronVersion ??
    packager?.config?.electronVersion ??
    require('../package.json').devDependencies?.electron?.replace(/^\D*/, '');

  const nodeModulesDir = path.join(resourcesDir, 'app.asar.unpacked', 'node_modules');

  // Modules that need to be rebuilt for cross-compilation
  // Use platform-specific module list (Windows skips node-pty due to cross-compilation issues)
  const modulesToRebuild = getModulesToRebuild(electronPlatformName);
  console.log(`   Modules to rebuild: ${modulesToRebuild.join(', ')}`);

  // For cross-compilation, clean up build artifacts from the wrong architecture
  // This prevents node-gyp-build from loading incorrect binaries
  if (isCrossCompile) {
    console.log(`\n🧹 Cleaning up wrong-architecture build artifacts...`);
    for (const moduleName of modulesToRebuild) {
      const moduleRoot = path.join(nodeModulesDir, moduleName);
      if (!fs.existsSync(moduleRoot)) continue;

      // Remove build/ directory (contains wrong-arch compiled binaries)
      const buildDir = path.join(moduleRoot, 'build');
      if (fs.existsSync(buildDir)) {
        fs.rmSync(buildDir, { recursive: true, force: true });
        console.log(`   ✓ Removed ${moduleName}/build/`);
      }

      // Remove bin/ directory (might contain wrong-arch binaries)
      const binDir = path.join(moduleRoot, 'bin');
      if (fs.existsSync(binDir)) {
        fs.rmSync(binDir, { recursive: true, force: true });
        console.log(`   ✓ Removed ${moduleName}/bin/`);
      }
    }

    // Also clean up architecture-specific packages that shouldn't be included
    // Remove packages for the opposite architecture of the target
    const wrongArchSuffix = targetArch === 'arm64' ? 'x64' : 'arm64';
    console.log(`\n🧹 Removing ${wrongArchSuffix}-specific optional dependencies (target: ${targetArch})...`);

    if (fs.existsSync(nodeModulesDir)) {
      const allModules = fs.readdirSync(nodeModulesDir);
      for (const module of allModules) {
        const modulePath = path.join(nodeModulesDir, module);

        // Handle scoped packages (e.g., @lydell, @napi-rs)
        if (module.startsWith('@') && fs.existsSync(modulePath) && fs.statSync(modulePath).isDirectory()) {
          const scopedPackages = fs.readdirSync(modulePath);
          for (const pkg of scopedPackages) {
            if (pkg.includes(`-${wrongArchSuffix}`) || pkg.includes(`-${electronPlatformName}-${wrongArchSuffix}`)) {
              const pkgPath = path.join(modulePath, pkg);
              if (fs.existsSync(pkgPath) && fs.statSync(pkgPath).isDirectory()) {
                fs.rmSync(pkgPath, { recursive: true, force: true });
                console.log(`   ✓ Removed ${module}/${pkg}`);
              }
            }
          }
        }
        // Handle regular packages
        else if (
          module.includes(`-${wrongArchSuffix}`) ||
          module.includes(`-${electronPlatformName}-${wrongArchSuffix}`)
        ) {
          if (fs.existsSync(modulePath) && fs.statSync(modulePath).isDirectory()) {
            fs.rmSync(modulePath, { recursive: true, force: true });
            console.log(`   ✓ Removed ${module}`);
          }
        }
      }
    }
  }

  const failedModules = [];

  for (const moduleName of modulesToRebuild) {
    const moduleRoot = path.join(nodeModulesDir, moduleName);

    if (!fs.existsSync(moduleRoot)) {
      console.warn(`   ⚠️  ${moduleName} not found, skipping`);
      continue;
    }

    console.log(`   ✓ Found ${moduleName}, rebuilding for ${targetArch}...`);

    // For Windows, prefer prebuild-install first (faster and more reliable in CI)
    // electron-rebuild can hang on "Searching dependency tree" in some CI environments
    // prebuild-install will fall back to electron-rebuild internally if no prebuilt binary exists
    const forceRebuildFromSource = false; // Always try prebuild-install first

    const success = rebuildSingleModule({
      moduleName,
      moduleRoot,
      platform: electronPlatformName,
      arch: targetArch,
      electronVersion,
      projectRoot: path.resolve(__dirname, '..'),
      buildArch: buildArch, // Pass build architecture for cross-compile detection
      forceRebuild: forceRebuildFromSource, // Always try prebuild-install first, fallback to rebuild
    });

    if (success) {
      console.log(`     ✓ Rebuild completed`);
    } else {
      console.error(`     ✗ Rebuild failed`);
      failedModules.push(moduleName);
      continue;
    }

    const verified = verifyModuleBinary(moduleRoot, moduleName);
    if (verified) {
      console.log(`     ✓ Binary verification passed`);
    } else {
      console.error(`     ✗ Binary verification failed`);
      failedModules.push(moduleName);
    }

    console.log(''); // Empty line between modules
  }

  if (failedModules.length > 0) {
    throw new Error(`Failed to rebuild modules for ${electronPlatformName}-${targetArch}: ${failedModules.join(', ')}`);
  }

  console.log(`✅ All native modules rebuilt successfully for ${targetArch}\n`);
};
