import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, readlink } from 'node:fs/promises';
import { join, relative } from 'node:path';

export type BundleIntegrityRecord = {
  algorithm: 'sha256';
  digest: string;
  files: number;
  bytes: number;
};

export type BundleIntegrityFailure = {
  component: 'harness' | 'aioncore';
  path: string;
  reason: string;
};

type TreeEntry =
  | { kind: 'symlink'; relativePath: string; target: string }
  | { kind: 'file'; relativePath: string; fullPath: string; bytes: number };

async function readTree(root: string, dir: string, ignored: ReadonlySet<string>): Promise<TreeEntry[]> {
  const children = (await readdir(dir, { withFileTypes: true })).toSorted((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0
  );
  const nested = await Promise.all(
    children.map(async (entry): Promise<TreeEntry[]> => {
      const fullPath = join(dir, entry.name);
      const relativePath = relative(root, fullPath).replace(/\\/g, '/');
      if (ignored.has(relativePath)) return [];

      const stat = await lstat(fullPath);
      if (stat.isSymbolicLink()) {
        const target = (await readlink(fullPath)).replace(/\\/g, '/');
        return [{ kind: 'symlink', relativePath, target }];
      }
      if (stat.isDirectory()) {
        return readTree(root, fullPath, ignored);
      }
      if (stat.isFile()) {
        return [{ kind: 'file', relativePath, fullPath, bytes: stat.size }];
      }
      throw new Error(`Cannot hash unsupported filesystem entry: ${fullPath}`);
    })
  );
  return nested.flat();
}

export async function digestTree(root: string, ignore: readonly string[] = []): Promise<BundleIntegrityRecord> {
  const ignored = new Set(ignore.map((entry) => entry.replace(/\\/g, '/').replace(/^\.\//, '')));
  const entries = await readTree(root, root, ignored);
  const fileEntries = entries.flatMap((entry, index) => (entry.kind === 'file' ? [{ entry, index }] : []));
  const fileHashes: string[] = [];
  const hashBatch = async (start: number): Promise<void> => {
    if (start >= fileEntries.length) return;
    const batch = fileEntries.slice(start, start + 8);
    await Promise.all(
      batch.map(async ({ entry, index }) => {
        const content = await readFile(entry.fullPath);
        fileHashes[index] = createHash('sha256').update(content).digest('hex');
      })
    );
    await hashBatch(start + 8);
  };
  await hashBatch(0);

  const lines = entries.map((entry, index) => {
    if (entry.kind === 'symlink') return `symlink\t${entry.relativePath}\t${entry.target}`;
    return `file\t${entry.relativePath}\t${entry.bytes}\t${fileHashes[index]}`;
  });
  const files = entries.length;
  const bytes = entries.reduce((total, entry) => {
    if (entry.kind === 'file') return total + entry.bytes;
    if (entry.kind === 'symlink') return total + Buffer.byteLength(entry.target);
    return total;
  }, 0);
  return {
    algorithm: 'sha256',
    digest: createHash('sha256').update(lines.join('\n')).digest('hex'),
    files,
    bytes,
  };
}

async function verifyTree(root: string, expected: unknown, ignore: readonly string[]): Promise<string | null> {
  if (
    !expected ||
    typeof expected !== 'object' ||
    (expected as BundleIntegrityRecord).algorithm !== 'sha256' ||
    typeof (expected as BundleIntegrityRecord).digest !== 'string' ||
    !/^[a-f0-9]{64}$/i.test((expected as BundleIntegrityRecord).digest) ||
    !Number.isInteger((expected as BundleIntegrityRecord).files) ||
    (expected as BundleIntegrityRecord).files < 0 ||
    !Number.isInteger((expected as BundleIntegrityRecord).bytes) ||
    (expected as BundleIntegrityRecord).bytes < 0
  ) {
    return 'invalid_integrity_record';
  }

  const actual = await digestTree(root, ignore);
  const record = expected as BundleIntegrityRecord;
  if (actual.digest !== record.digest.toLowerCase()) return 'digest_mismatch';
  if (actual.files !== record.files) return 'file_count_mismatch';
  if (actual.bytes !== record.bytes) return 'byte_count_mismatch';
  return null;
}

async function readIntegrity(manifestPath: string): Promise<unknown> {
  try {
    return (JSON.parse(await readFile(manifestPath, 'utf8')) as { integrity?: unknown }).integrity;
  } catch {
    return undefined;
  }
}

/**
 * Verifies the exact files the packaged app will execute. Builds write these
 * digests from the same files after installation and packaging; startup refuses
 * a tree that changed afterward.
 */
export async function verifyBundledResourceIntegrity({
  resourcesPath,
  platform = process.platform,
  arch = process.arch,
}: {
  resourcesPath: string;
  platform?: NodeJS.Platform;
  arch?: string;
}): Promise<BundleIntegrityFailure[]> {
  const checks = [
    {
      component: 'harness' as const,
      root: join(resourcesPath, 'harness'),
      manifest: join(resourcesPath, 'harness', 'bundle.json'),
      ignore: ['bundle.json'],
    },
    {
      component: 'aioncore' as const,
      root: join(resourcesPath, 'bundled-aioncore', `${platform}-${arch}`),
      manifest: join(resourcesPath, 'bundled-aioncore', `${platform}-${arch}`, 'manifest.json'),
      ignore: ['manifest.json'],
    },
  ];

  const results = await Promise.all(
    checks.map(async (check): Promise<BundleIntegrityFailure[]> => {
      const expected = await readIntegrity(check.manifest);
      if (expected === undefined) {
        return [{ component: check.component, path: check.manifest, reason: 'missing_integrity_record' }];
      }
      try {
        const reason = await verifyTree(check.root, expected, check.ignore);
        return reason ? [{ component: check.component, path: check.manifest, reason }] : [];
      } catch (error) {
        return [
          {
            component: check.component,
            path: check.root,
            reason: error instanceof Error ? error.message : String(error),
          },
        ];
      }
    })
  );
  return results.flat();
}
