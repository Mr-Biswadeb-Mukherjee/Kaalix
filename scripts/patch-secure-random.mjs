import fs from 'node:fs/promises';
import path from 'node:path';

const workspaceRoot = process.cwd();

const dotenvParsePatch = {
  marker: "const LINE = /(?:^|^)\\s*(?:export\\s+)?([\\w.-]+)(?:\\s*=\\s*?|:\\s+?)(\\s*'(?:\\\\'|[^'])*'|\\s*\"(?:\\\\\"|[^\"])*\"|\\s*`(?:\\\\`|[^`])*`|[^#\\r\\n]+)?\\s*(?:#.*)?(?:$|$)/mg",
  replacement: [
    'const KEY_NAME = /^[\\w.-]+$/',
    '',
    'function _parseLine (line) {',
    '  if (!line) return null',
    '',
    '  const trimmedLine = line.trim()',
    "  if (!trimmedLine || trimmedLine[0] === '#') return null",
    '',
    '  let content = trimmedLine',
    "  if (content.startsWith('export ')) {",
    '    content = content.slice(7).trimStart()',
    '  }',
    '',
    "  let separatorIndex = content.indexOf('=')",
    '  if (separatorIndex === -1) {',
    "    const colonIndex = content.indexOf(':')",
    '    if (colonIndex !== -1) {',
    "      const nextChar = content[colonIndex + 1] || ''",
    "      if (nextChar === ' ' || nextChar === '\\t') {",
    '        separatorIndex = colonIndex',
    '      }',
    '    }',
    '  }',
    '',
    '  if (separatorIndex === -1) return null',
    '',
    '  const key = content.slice(0, separatorIndex).trim()',
    '  if (!KEY_NAME.test(key)) return null',
    '',
    '  let value = content.slice(separatorIndex + 1).trim()',
    "  if (!value) return { key, value: '' }",
    '',
    '  const maybeQuote = value[0]',
    '',
    "  if (maybeQuote === '\"' || maybeQuote === \"'\" || maybeQuote === String.fromCharCode(96)) {",
    "    let extracted = ''",
    '    let escaped = false',
    '    let closed = false',
    '',
    '    for (let i = 1; i < value.length; i++) {',
    '      const char = value[i]',
    '',
    '      if (escaped) {',
    '        extracted += char',
    '        escaped = false',
    '        continue',
    '      }',
    '',
    "      if (char === '\\\\') {",
    '        extracted += char',
    '        escaped = true',
    '        continue',
    '      }',
    '',
    '      if (char === maybeQuote) {',
    '        closed = true',
    '        break',
    '      }',
    '',
    '      extracted += char',
    '    }',
    '',
    '    if (closed) {',
    '      value = extracted',
    '    }',
    '  } else {',
    "    const commentIndex = value.indexOf('#')",
    '    if (commentIndex !== -1) {',
    '      value = value.slice(0, commentIndex).trim()',
    '    }',
    '  }',
    '',
    "  if (maybeQuote === '\"') {",
    "    value = value.replace(/\\\\n/g, '\\n')",
    "    value = value.replace(/\\\\r/g, '\\r')",
    '  }',
    '',
    '  return { key, value }',
    '}',
    '',
    '// Parse src into an Object',
    'function parse (src) {',
    '  const obj = {}',
    '',
    '  // Convert buffer to string',
    '  let lines = src.toString()',
    '',
    '  // Convert line breaks to same format',
    "  lines = lines.replace(/\\r\\n?/mg, '\\n')",
    '',
    "  for (const line of lines.split('\\n')) {",
    '    const parsed = _parseLine(line)',
    '    if (!parsed) continue',
    '    obj[parsed.key] = parsed.value',
    '  }',
    '',
    '  return obj',
    '}'
  ].join('\n')
};

const secureRandomPatch = {
  marker: 'function secureRandom() {\n  return Math.random();\n}',
  replacement:
    'function secureRandom() {\n  return crypto.randomBytes(4).readUInt32BE(0) / 0x100000000;\n}'
};

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeTextFile(filePath, content) {
  const data = Buffer.from(content, 'utf8');
  const handle = await fs.open(filePath, 'w');

  try {
    let offset = 0;
    while (offset < data.length) {
      const { bytesWritten } = await handle.write(
        data,
        offset,
        data.length - offset,
        offset
      );
      offset += bytesWritten;
    }

    await handle.truncate(data.length);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function listPnpmPackageFiles(nodeModulesRoot, packagePrefix, relativeFile) {
  const results = [];
  const pnpmRoot = path.join(nodeModulesRoot, '.pnpm');
  if (!(await fileExists(pnpmRoot))) return results;

  const entries = await fs.readdir(pnpmRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!entry.name.startsWith(`${packagePrefix}@`)) continue;

    const candidate = path.join(pnpmRoot, entry.name, 'node_modules', packagePrefix, relativeFile);
    if (await fileExists(candidate)) results.push(candidate);
  }

  return results;
}

async function collectTargetFiles() {
  const roots = [
    path.join(workspaceRoot, 'node_modules'),
    path.join(workspaceRoot, 'backend', 'node_modules'),
    path.join(workspaceRoot, 'frontend', 'node_modules'),
    path.join(workspaceRoot, 'shared', 'node_modules')
  ];

  const dotenvFiles = new Set();
  const systemInfoFiles = new Set();

  for (const root of roots) {
    if (!(await fileExists(root))) continue;

    const dotenvDirect = path.join(root, 'dotenv', 'lib', 'main.js');
    if (await fileExists(dotenvDirect)) dotenvFiles.add(dotenvDirect);

    const sysInfoDirect = path.join(root, 'systeminformation', 'lib', 'util.js');
    if (await fileExists(sysInfoDirect)) systemInfoFiles.add(sysInfoDirect);

    for (const file of await listPnpmPackageFiles(root, 'dotenv', path.join('lib', 'main.js'))) {
      dotenvFiles.add(file);
    }

    for (const file of await listPnpmPackageFiles(root, 'systeminformation', path.join('lib', 'util.js'))) {
      systemInfoFiles.add(file);
    }
  }

  return {
    dotenvFiles: [...dotenvFiles],
    systemInfoFiles: [...systemInfoFiles]
  };
}

async function patchFile(filePath, patch) {
  const original = await fs.readFile(filePath, 'utf8');
  if (!original.includes(patch.marker)) {
    return { patched: false, reason: 'marker_not_found' };
  }

  const updated = original.replace(patch.marker, patch.replacement);
  if (updated === original) {
    return { patched: false, reason: 'no_change' };
  }

  await writeTextFile(filePath, updated);
  return { patched: true };
}

async function patchDotenv(filePath) {
  const source = await fs.readFile(filePath, 'utf8');

  const blockStart = source.indexOf(dotenvParsePatch.marker);
  if (blockStart === -1) {
    return { patched: false, reason: 'marker_not_found' };
  }

  const parseVaultMarker = '\n\nfunction _parseVault (options) {';
  const blockEnd = source.indexOf(parseVaultMarker, blockStart);
  if (blockEnd === -1) {
    return { patched: false, reason: 'parse_vault_not_found' };
  }

  const before = source.slice(0, blockStart);
  const after = source.slice(blockEnd);
  const patchedSource = `${before}${dotenvParsePatch.replacement}${after}`;

  if (patchedSource === source) {
    return { patched: false, reason: 'no_change' };
  }

  await writeTextFile(filePath, patchedSource);
  return { patched: true };
}

async function main() {
  const { dotenvFiles, systemInfoFiles } = await collectTargetFiles();

  let patchedCount = 0;
  let checkedCount = 0;

  for (const file of dotenvFiles) {
    checkedCount += 1;
    const result = await patchDotenv(file);
    if (result.patched) {
      patchedCount += 1;
      console.log(`[patched] dotenv parser: ${path.relative(workspaceRoot, file)}`);
    } else {
      console.log(`[skip] dotenv parser (${result.reason}): ${path.relative(workspaceRoot, file)}`);
    }
  }

  for (const file of systemInfoFiles) {
    checkedCount += 1;
    const result = await patchFile(file, secureRandomPatch);
    if (result.patched) {
      patchedCount += 1;
      console.log(`[patched] systeminformation secureRandom: ${path.relative(workspaceRoot, file)}`);
    } else {
      console.log(`[skip] systeminformation secureRandom (${result.reason}): ${path.relative(workspaceRoot, file)}`);
    }
  }

  console.log(`[done] checked=${checkedCount}, patched=${patchedCount}`);
}

main().catch((error) => {
  console.error('[error] patch script failed:', error);
  process.exitCode = 1;
});
