import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type BuildProvenance = {
  schemaVersion: 1;
  platform: NodeJS.Platform;
  arch: string;
  signed: boolean;
  signatureKind: 'authenticode' | 'none';
};

/**
 * Build provenance is copied from resources/build-provenance.json into the
 * packaged resources. Missing or malformed data is treated as unsigned.
 */
export function readBuildProvenance(resourcesPath: string): BuildProvenance | null {
  try {
    const value = JSON.parse(readFileSync(join(resourcesPath, 'build-provenance.json'), 'utf8')) as unknown;
    if (!value || typeof value !== 'object') return null;
    const provenance = value as Partial<BuildProvenance>;
    if (
      provenance.schemaVersion !== 1 ||
      typeof provenance.platform !== 'string' ||
      typeof provenance.arch !== 'string' ||
      typeof provenance.signed !== 'boolean' ||
      (provenance.signatureKind !== 'authenticode' && provenance.signatureKind !== 'none')
    ) {
      return null;
    }
    return provenance as BuildProvenance;
  } catch {
    return null;
  }
}

export function isSignedBuild({
  isPackaged,
  resourcesPath,
  platform = process.platform,
  arch = process.arch,
}: {
  isPackaged: boolean;
  resourcesPath: string;
  platform?: NodeJS.Platform;
  arch?: string;
}): boolean {
  if (!isPackaged) return false;
  const provenance = readBuildProvenance(resourcesPath);
  return Boolean(
    provenance?.signed &&
    provenance.signatureKind === 'authenticode' &&
    provenance.platform === platform &&
    provenance.arch === arch
  );
}
