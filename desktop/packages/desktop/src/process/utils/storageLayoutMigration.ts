import fs from 'fs';
import path from 'path';

/**
 * Move the profile and its data folder off AionUi's names without breaking the
 * absolute paths AionCore already stored.
 *
 * A rename is followed by a directory alias at the old path. The alias is not
 * user-facing: it lets old skill rows and other stored paths keep resolving
 * while new code reads and writes the spec.jev names. If the old directory is
 * still open (an older instance is running), the caller keeps the old name for
 * this start and tries again next time.
 */
export type DirectoryMove = 'moved' | 'existing' | 'blocked';

const exists = (target: string): boolean => {
  try {
    return fs.existsSync(target);
  } catch {
    return false;
  }
};

const moveDirectory = (from: string, to: string): DirectoryMove => {
  if (!exists(from)) return exists(to) ? 'existing' : 'blocked';
  if (exists(to)) return 'existing';
  try {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(from, to);
    return 'moved';
  } catch {
    return 'blocked';
  }
};

const addLegacyAlias = (oldPath: string, newPath: string): boolean => {
  if (exists(oldPath) || !exists(newPath)) return false;
  try {
    fs.symlinkSync(newPath, oldPath, process.platform === 'win32' ? 'junction' : 'dir');
    return true;
  } catch {
    return false;
  }
};

export function migrateProfileDirectory(oldPath: string, newPath: string): DirectoryMove {
  const result = moveDirectory(oldPath, newPath);
  if (result === 'moved') addLegacyAlias(oldPath, newPath);
  return result;
}

export function migrateDataDirectory(userDataDir: string, oldName: string, newName: string): DirectoryMove {
  const oldPath = path.join(userDataDir, oldName);
  const newPath = path.join(userDataDir, newName);
  const result = moveDirectory(oldPath, newPath);
  if (result === 'moved') addLegacyAlias(oldPath, newPath);
  return result;
}
