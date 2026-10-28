const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALGORITHM = 'sha256';

function normalizedRelative(root, filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function normalizedIgnorePath(entry) {
  return entry.replace(/\\/g, '/').replace(/^\.\//, '');
}

function digestTree(root, { ignore = [] } = {}) {
  const ignored = new Set(ignore.map(normalizedIgnorePath));
  const lines = [];
  let files = 0;
  let bytes = 0;

  const visit = (dir) => {
    for (const entry of fs
      .readdirSync(dir, { withFileTypes: true })
      .toSorted((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = normalizedRelative(root, fullPath);
      if (ignored.has(relativePath)) continue;

      const stat = fs.lstatSync(fullPath);
      if (stat.isSymbolicLink()) {
        const target = fs.readlinkSync(fullPath).replace(/\\/g, '/');
        lines.push(`symlink\t${relativePath}\t${target}`);
        files += 1;
        bytes += Buffer.byteLength(target);
      } else if (stat.isDirectory()) {
        visit(fullPath);
      } else if (stat.isFile()) {
        const content = fs.readFileSync(fullPath);
        const digest = crypto.createHash(ALGORITHM).update(content).digest('hex');
        lines.push(`file\t${relativePath}\t${content.length}\t${digest}`);
        files += 1;
        bytes += content.length;
      } else {
        throw new Error(`Cannot hash unsupported filesystem entry: ${fullPath}`);
      }
    }
  };

  visit(root);
  return {
    algorithm: ALGORITHM,
    digest: crypto.createHash(ALGORITHM).update(lines.join('\n')).digest('hex'),
    files,
    bytes,
  };
}

function writeIntegrityRecord(recordPath, record, { ignore = [] } = {}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error(`Cannot write an integrity record to ${recordPath}: the record is not an object`);
  }
  const payload = {
    ...record,
    integrity: digestTree(path.dirname(recordPath), {
      ignore: [...ignore, path.basename(recordPath)],
    }),
  };
  fs.writeFileSync(recordPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

function refreshIntegrityRecord(recordPath, options = {}) {
  let record;
  try {
    record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot refresh integrity record ${recordPath}: ${error.message}`);
  }
  return writeIntegrityRecord(recordPath, record, options);
}

function verifyTreeDigest(root, expected, options = {}) {
  if (
    !expected ||
    expected.algorithm !== ALGORITHM ||
    typeof expected.digest !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(expected.digest) ||
    !Number.isInteger(expected.files) ||
    expected.files < 0 ||
    !Number.isInteger(expected.bytes) ||
    expected.bytes < 0
  ) {
    return { ok: false, reason: 'invalid_integrity_record' };
  }

  const actual = digestTree(root, options);
  if (actual.digest !== expected.digest.toLowerCase())
    return { ok: false, reason: 'digest_mismatch', actual, expected };
  if (actual.files !== expected.files) return { ok: false, reason: 'file_count_mismatch', actual, expected };
  if (actual.bytes !== expected.bytes) return { ok: false, reason: 'byte_count_mismatch', actual, expected };
  return { ok: true, actual };
}

module.exports = {
  digestTree,
  refreshIntegrityRecord,
  verifyTreeDigest,
  writeIntegrityRecord,
};
