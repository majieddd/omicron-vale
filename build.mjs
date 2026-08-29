// Omicron build.mjs: fuse vendored three.js + addons + src/*.mjs into ONE
// inline classic script inside play.html (runs from file://, no server).
// Uses the validated MOD-registry fusion + function replacer + assemble gate.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = normalize(dirname(fileURLToPath(import.meta.url)));
const VENDOR = join(ROOT, 'vendor');
const SRC = join(ROOT, 'src');

const MOD = {};
function stub(id, filePath) { if (!MOD[id]) MOD[id] = { code: '', names: new Set(), hasDefault: false, deps: new Set(), fromDir: normalize(join(filePath, '..')), filePath }; return MOD[id]; }

function resolveSpec(spec, fromDir) {
  if (spec === 'three') return join(VENDOR, 'three.module.js');
  if (spec.startsWith('three/addons/')) {
    const rel = spec.replace('three/addons/', '');
    if (rel.startsWith('postprocessing/')) return join(VENDOR, 'addons', rel.slice('postprocessing/'.length));
    if (rel.startsWith('shaders/')) return join(VENDOR, 'shaders', rel.slice('shaders/'.length));
    return join(VENDOR, 'addons', rel);
  }
  return normalize(join(fromDir, spec + (spec.endsWith('.js') || spec.endsWith('.mjs') ? '' : '.mjs')));
}

function collectExports(src) {
  const names = new Set(); let hasDefault = false;
  for (const m of src.matchAll(/export\s+(?:async\s+)?(const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[2]);
  for (const m of src.matchAll(/export\s*\{([^}]*)\}\s*;?/g)) {
    for (const part of m[1].split(',')) {
      const p = part.trim().split(/\s+as\s+/);
      names.add((p[1] || p[0]).trim());
    }
  }
  if (/export\s+default/.test(src)) hasDefault = true;
  return { names, hasDefault };
}

function rewriteImports(src, fromDir, id) {
  return src.replace(/import\s+([^;]+?)\s+from\s+['"]([^'"]+)['"];?/g, (_, clause, spec) => {
    const depId = resolveSpec(spec, fromDir);
    const key = depId;
    MOD[id].deps.add(key);
    const st = MOD[key] || stub(key, depId);
    st.filePath = depId;
    st.fromDir = normalize(join(depId, '..'));
    if (clause.startsWith('* as ')) return `const ${clause.slice(5).trim()} = MOD[${JSON.stringify(key)}];`;
    const m = clause.match(/^\{([\s\S]*)\}$/);
    if (m) {
      const names = m[1].split(',').map(s => s.trim()).filter(Boolean);
      // { a, b as c } -> const { a, b: c } = MOD[key];  (b is the source prop, c the binding)
      const bindings = names.map(n => {
        const parts = n.split(/\s+as\s+/);
        if (parts.length === 2) return `${parts[0].trim()}: ${parts[1].trim()}`;
        return parts[0].trim();
      });
      return `const { ${bindings.join(', ')} } = MOD[${JSON.stringify(key)}];`;
    }
    if (/^[A-Za-z_$][\w$]*$/.test(clause.trim())) return `const ${clause.trim()} = MOD[${JSON.stringify(key)}].default;`;
    return '';
  }).replace(/import\s+['"][^'"]+['"];?/g, '');
}

// rewrite `export * from 'x'` and `export { a, b } from 'x'` re-exports
function rewriteReexports(src, fromDir, id) {
  let spreadName = null;
  src = src.replace(/export\s+\*\s+from\s+['"]([^'"]+)['"];?/g, (_, spec) => {
    const key = resolveSpec(spec, fromDir);
    MOD[id].deps.add(key);
    const st = MOD[key] || stub(key, spec);
    st.filePath = key;
    st.fromDir = normalize(join(key, '..'));
    spreadName = '__omod_src' + (spreadName ? spreadName.length : '');
    return `const ${spreadName} = MOD[${JSON.stringify(key)}];`;
  });
  src = src.replace(/export\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?/g, (_, names, spec) => {
    const key = resolveSpec(spec, fromDir);
    MOD[id].deps.add(key);
    const st = MOD[key] || stub(key, spec);
    st.filePath = key;
    st.fromDir = normalize(join(key, '..'));
    const clean = names.split(',').map(s => s.trim()).filter(Boolean).map(n => {
      const parts = n.split(/\s+as\s+/);
      return parts.length === 2 ? `${parts[0].trim()}: ${parts[1].trim()}` : parts[0].trim();
    });
    return `const { ${clean.join(', ')} } = MOD[${JSON.stringify(key)}];`;
  });
  return { src, spreadName };
}

function stripExports(src) {
  return src
    .replace(/export\s+(?:async\s+)?function/g, 'function')
    .replace(/export\s+class/g, 'class')
    .replace(/export\s+(const|let|var)\s+/g, '$1 ')
    .replace(/export\s*\{[^}]*\}\s*;?/g, '')
    .replace(/export\s+default\s+/g, 'const __omod_default__ = ');
}

function addModule(id, filePath) {
  if (MOD[id] && MOD[id].done) return;
  const src = readFileSync(filePath, 'utf8');
  const { names, hasDefault } = collectExports(src);
  const st = stub(id, filePath);
  st.names = names; st.hasDefault = hasDefault;
  const rew = rewriteReexports(src, normalize(join(filePath, '..')), id);
  const inner = stripExports(rewriteImports(rew.src, normalize(join(filePath, '..')), id));
  const map = [...names].join(', ');
  let ret;
  const spread = rew.spreadName ? `...${rew.spreadName}, ` : '';
  if (hasDefault) {
    ret = map ? `({ default: __omod_default__, ${spread}${map} })` : `({ default: __omod_default__, ${spread}})`;
  } else {
    ret = map ? `({ ${spread}${map} })` : (rew.spreadName ? `({ ${spread}})`.replace(/, \.\.\./, '...') : `({ })`);
  }
  st.code = `(function(){ "use strict";\n${inner}\nMOD[${JSON.stringify(id)}] = ${ret};\n})();`;
  st.done = true;
}

function emit(id, stack = []) {
  const st = MOD[id];
  if (!st) throw new Error('missing module ' + id);
  if (st.emitted) return '';
  if (stack.includes(id)) return '';
  stack.push(id);
  let out = '';
  for (const d of st.deps) {
    if (!MOD[d].done) { resolveDep(d); }
    out += emit(d, stack);
  }
  stack.pop();
  st.emitted = true;
  out += st.code;
  return out;
}

function resolveDep(depId) {
  // depId is a file path; load it as a module (vendor or src)
  const fp = depId;
  if (!exists(fp)) {
    // maybe it's a bare relative we resolved oddly; attempt VENDOR fallback
    if (exists(join(VENDOR, depId))) { addModule(depId, join(VENDOR, depId)); return; }
    throw new Error('cannot resolve dep: ' + depId);
  }
  addModule(depId, fp);
}

import { existsSync as exists, readdirSync } from 'node:fs';

// entry
const ENTRY = join(SRC, '08_main.mjs');
addModule(ENTRY, ENTRY);
// vendor three
addModule(join(VENDOR, 'three.module.js'), join(VENDOR, 'three.module.js'));
// ensure all deps resolved by walking from entry
function walk(id) {
  const st = MOD[id];
  for (const d of st.deps) {
    if (!MOD[d]) resolveDep(d);
    walk(d);
  }
}
try {
  walk(ENTRY);
} catch (e) { console.error('WALK FAIL:', e.message); process.exit(1); }

let bundle = '';
try { bundle = emit(ENTRY); } catch (e) { console.error('EMIT FAIL:', e.message); process.exit(1); }
// registry preamble must come before any module code
bundle = `var MOD = {};\n\n` + bundle;

// collect blender GLB assets (base64) BEFORE assembly so they can be injected ahead of the bundle
const glbDir = join(ROOT, 'assets', 'blender');
const glbFiles = [];
try { for (const f of readdirSync(glbDir)) if (f.endsWith('.glb')) glbFiles.push(f); } catch (e) { /* no assets dir: fine */ }
const glbAssetDef = glbFiles.length
  ? `window.__ASSET_GLB = {\n  ${glbFiles.map(f => `"${f.replace(/\.glb$/, '')}": "${readFileSync(join(glbDir, f)).toString('base64')}"`).join(',\n  ')}\n};\n`
  : '';

// assemble play.html from index.html
let html = readFileSync(join(ROOT, 'index.html'), 'utf8');
// replace the module script tag with inline classic script (function replacer - $ safety)
let replaced = false;
html = html.replace(/<script type="module" src="\/src\/08_main\.mjs"><\/script>/, () => {
  replaced = true;
  return `<script>
window.addEventListener('error', function (e) { window.__ERRORS && window.__ERRORS.push(String(e.message || e)); });
try {
${glbAssetDef}
${bundle}
} catch (err) {
  var b = document.getElementById && document.getElementById('booterr');
  if (b) b.textContent = 'BOOT: ' + ((err && err.stack) ? err.stack : String(err));
  if (window.__ERRORS) window.__ERRORS.push('BOOT: ' + String(err));
}
</script>`;
});
if (!replaced) { console.error('NO SCRIPT TAG REPLACED'); process.exit(1); }
// inline the stylesheet: external absolute links break from file://
const cssPath = join(ROOT, 'src', '07_ui.css');
const css = readFileSync(cssPath, 'utf8');
let cssReplaced = false;
html = html.replace(/<link rel="stylesheet" href="\/src\/07_ui\.css">/, () => {
  cssReplaced = true;
  return `<style>\n${css}\n</style>`;
});
if (!cssReplaced) { console.error('NO CSS LINK REPLACED'); process.exit(1); }
// strip importmap (single classic script needs none)
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>\s*/g, '');

// assemble gate: parse the final bundle
const sIdx = html.lastIndexOf('<script>');
const eIdx = html.lastIndexOf('</script>');
if (sIdx < 0 || eIdx < 0 || eIdx <= sIdx) { console.error('NO SCRIPT BLOCK FOUND'); process.exit(1); }
const assembled = html.slice(sIdx + '<script>'.length, eIdx);
try {
  new Function(assembled);
  console.log('BUNDLE PARSE: OK');
} catch (e) {
  console.error('BUNDLE PARSE FAIL:', e.message);
  process.exit(1);
}

writeFileSync(join(ROOT, 'play.html'), html);
// final gate: no external references may remain (file:// proof)
const extLink = /\<link[^>]*rel="stylesheet"|src="\/src\/|<script type="module"|type="importmap"/.test(html);
if (extLink) { console.error('EXTERNAL REF REMAINS in play.html'); process.exit(1); }
console.log('WROTE play.html (' + html.length + ' bytes)  -  no external refs');
