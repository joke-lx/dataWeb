const fs = require('fs');
const path = require('path');

// Read en.json keys
const enKeys = new Set(
  Object.keys(
    JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '..', 'apps', 'web', 'src', 'i18n', 'messages', 'en.json'),
        'utf-8',
      ),
    ),
  ),
);

// Walk ts/tsx files under apps/web/src, looking for formatMessage({id: '...'}) and t('...') calls
const srcDir = path.join(__dirname, '..', 'apps', 'web', 'src');
const usedKeys = new Set();

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      const content = fs.readFileSync(full, 'utf-8');
      // formatMessage({id: '...'})
      const regex1 = /formatMessage\(\{id:\s*'([^']+)'\}/g;
      let match;
      while ((match = regex1.exec(content)) !== null) {
        usedKeys.add(match[1]);
      }
      // t('...') with literal string key (not dynamic like t('nav.' + r.id))
      const regex2 = /[^a-zA-Z0-9_$]t\(\s*'([a-zA-Z0-9_.]+)'\s*[,)]/g;
      while ((match = regex2.exec(content)) !== null) {
        usedKeys.add(match[1]);
      }
    }
  }
}

walk(srcDir);

const missing = [...usedKeys].filter((k) => !enKeys.has(k));
if (missing.length > 0) {
  console.error(`i18n:check — keys used in source but missing from en.json:\n  ${missing.join('\n  ')}`);
  process.exit(1);
}
console.log(`i18n:check — OK (${enKeys.size} keys in en.json, ${usedKeys.size} referenced in source)`);
