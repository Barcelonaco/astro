import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIELD_TYPE_PATTERN = /([A-Za-z0-9_]+)::make\s*\(\s*(['"])((?:[^'"\\]|\\.)*)\2\s*(?:,\s*(['"])((?:[^'"\\]|\\.)*)\4)?/gs;
const CLASS_PATTERN = /class\s+([A-Za-z0-9_]+)/;
const LAYOUT_PATTERN = /Layout::make\([^,]+,\s*['"]([^'"]+)['"]\)/;
const BLOCK_PARAMS_REF_PATTERN = /BlockParams::(get[A-Za-z0-9_]+)/g;

/**
 * Find the index of the semicolon that ends the PHP statement at depth 0,
 * skipping semicolons inside string literals (' or ") and inside brackets ([ or ().
 */
function findStatementEnd(text) {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inSingle) {
      if (ch === '\\') { i++; continue; }
      if (ch === "'") inSingle = false;
    } else if (inDouble) {
      if (ch === '\\') { i++; continue; }
      if (ch === '"') inDouble = false;
    } else if (ch === "'") {
      inSingle = true;
    } else if (ch === '"') {
      inDouble = true;
    } else if (ch === '(' || ch === '[') {
      depth++;
    } else if (ch === ')' || ch === ']') {
      depth--;
    } else if (ch === ';' && depth === 0) {
      return i;
    }
  }
  return -1;
}

const INPUT_FIELD_TYPES = new Set([
  'Text',
  'Textarea',
  'WYSIWYGEditor',
  'Image',
  'File',
  'URL',
  'Url',
  'Link',
  'TrueFalse',
  'Number',
  'Range',
  'ColorPicker',
  'ButtonGroup',
  'Select',
  'RadioButton',
  'GoogleMap',
  'Repeater',
  'Group',
  'FlexibleContent',
  'Email',
  'Password'
]);

function parseChoices(chain) {
  const choicesMatch = chain.match(/->choices\(\s*\[([\s\S]*?)\]\s*\)/);
  if (!choicesMatch) return null;
  const raw = choicesMatch[1];
  const choices = [];
  // Handle escaped quotes (e.g. l\'image) inside PHP strings
  const pairRegexes = [
    /'([^']+)'\s*=>\s*'((?:[^'\\]|\\.)*)'/g,
    /"([^"]+)"\s*=>\s*"((?:[^"\\]|\\.)*)"/g,
    /'([^']+)'\s*=>\s*"((?:[^"\\]|\\.)*)"/g,
    /"([^"]+)"\s*=>\s*'((?:[^'\\]|\\.)*)'/g
  ];
  pairRegexes.forEach((regex) => {
    let match;
    while ((match = regex.exec(raw)) !== null) {
      // Unescape PHP escaped quotes in the label
      choices.push({ value: match[1], label: match[2].replace(/\\'/g, "'").replace(/\\"/g, '"') });
    }
  });
  return choices.length > 0 ? choices : null;
}

function parseStylized(chain) {
  // Handle PHP named arguments with optional space before colon (on : vs on:)
  const match = chain.match(/->stylized\(\s*on\s*:\s*(['"])(.*?)\1\s*,\s*off\s*:\s*(['"])(.*?)\3\s*\)/);
  if (!match) return null;
  return { onLabel: match[2], offLabel: match[4] };
}

function parseDefault(chain) {
  // Match the last ->default() call (some fields call it twice, last one wins)
  const matches = [...chain.matchAll(/->default\(\s*(?:['"]([^'"]*)['"]\s*|(true|false|null|\d+(?:\.\d+)?))\s*\)/g)];
  if (matches.length === 0) return undefined;
  const m = matches[matches.length - 1];
  if (m[1] !== undefined) return m[1];
  const raw = m[2];
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  return Number(raw);
}

function parseConditionalLogic(chain) {
  // Accept quoted strings OR unquoted integers/booleans/null as the 3rd value
  const m3 = chain.match(/->conditionalLogic\(\[.*?ConditionalLogic::where\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*(?:['"]([^'"]*)['"]\s*|(\d+|true|false|null)\s*)\)/s);
  if (m3) return { field: m3[1], operator: m3[2], value: m3[3] !== undefined ? m3[3] : m3[4] };
  const m2 = chain.match(/->conditionalLogic\(\[.*?ConditionalLogic::where\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/s);
  if (m2) return { field: m2[1], operator: m2[2], value: null };
  return null;
}

/**
 * Find the byte range of the ->fields([...]) content for a Repeater or Group field.
 * Handles PHP string escaping so brackets inside strings don't confuse the depth counter.
 * Returns { start, end } (indices of content inside the brackets) or null.
 */
function findFieldsRange(content, fromIndex) {
  const needle = '->fields(';
  const needleIdx = content.indexOf(needle, fromIndex);
  if (needleIdx === -1) return null;
  const bracketOpen = content.indexOf('[', needleIdx + needle.length);
  if (bracketOpen === -1) return null;
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  for (let i = bracketOpen; i < content.length; i++) {
    const ch = content[i];
    if (inSingle) {
      if (ch === '\\') { i++; }
      else if (ch === "'") { inSingle = false; }
      continue;
    }
    if (inDouble) {
      if (ch === '\\') { i++; }
      else if (ch === '"') { inDouble = false; }
      continue;
    }
    if (ch === "'") { inSingle = true; continue; }
    if (ch === '"') { inDouble = true; continue; }
    if (ch === '[' || ch === '(') depth++;
    else if (ch === ']' || ch === ')') {
      depth--;
      if (depth === 0) return { start: bracketOpen + 1, end: i };
    }
  }
  return null;
}

/**
 * Parse a PHP snippet and return a properly-nested field list.
 * Repeater and Group fields get a `subFields` array extracted from their ->fields([...]) blocks.
 * Sub-fields are NOT included in the top-level list.
 */
function parseFieldList(content) {
  const allMatches = Array.from(content.matchAll(FIELD_TYPE_PATTERN)).map((match) => ({
    type: match[1],
    label: match[3] || '',
    name: match[5] || '',
    index: match.index || 0,
  })).filter((m) => m.name && INPUT_FIELD_TYPES.has(m.type));

  // Find ->fields([...]) or ->layouts([...]) ranges for container types (Repeater, Group, FlexibleContent)
  const containerRanges = [];
  for (const m of allMatches) {
    if (m.type !== 'Repeater' && m.type !== 'Group' && m.type !== 'FlexibleContent') continue;
    if (m.type === 'FlexibleContent') {
      // FlexibleContent uses ->layouts($var) which references a PHP variable — no static fields to parse
      // But we still need to find its range so sub-fields of the Repeater aren't confused
      const layoutsNeedle = '->layouts(';
      const afterType = content.indexOf(layoutsNeedle, m.index);
      if (afterType !== -1) {
        // Find the closing paren of ->layouts(...)
        let depth = 0;
        for (let i = afterType + layoutsNeedle.length; i < content.length; i++) {
          const ch = content[i];
          if (ch === '(' || ch === '[') depth++;
          else if (ch === ')' || ch === ']') {
            if (depth === 0) {
              containerRanges.push({ parentIndex: m.index, start: afterType, end: i, isFlexible: true });
              break;
            }
            depth--;
          }
        }
      }
      continue;
    }
    const range = findFieldsRange(content, m.index + m.type.length);
    if (range) containerRanges.push({ parentIndex: m.index, start: range.start, end: range.end });
  }

  const isSubField = (index) => containerRanges.some((r) => index > r.start && index < r.end);

  const fields = [];
  const seen = new Set();

  for (const m of allMatches) {
    if (isSubField(m.index)) continue;
    const key = `${m.name}:${m.type}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const containerRange = containerRanges.find((r) => r.parentIndex === m.index);
    let chainEnd;
    if (containerRange) {
      chainEnd = containerRange.end + 1;
    } else {
      const nextNonSub = allMatches.find((m2) => m2.index > m.index && !isSubField(m2.index));
      chainEnd = nextNonSub ? nextNonSub.index : content.length;
    }

    const rawChain = content.slice(m.index, chainEnd);
    const semiIdx = findStatementEnd(rawChain);
    const chain = semiIdx !== -1 ? rawChain.slice(0, semiIdx + 1) : rawChain;

    // For container fields (Repeater/Group), only parse the chain BEFORE ->fields([...])
    // to avoid picking up conditionalLogic from sub-fields.
    let ownChain = chain;
    if (containerRange) {
      const fieldsNeedle = '->fields(';
      const fieldsPos = chain.indexOf(fieldsNeedle);
      if (fieldsPos !== -1) ownChain = chain.slice(0, fieldsPos);
    }

    const choices = parseChoices(ownChain);
    const stylized = parseStylized(ownChain);
    const conditional = parseConditionalLogic(ownChain);
    const defaultValue = parseDefault(ownChain);

    let subFields = null;
    if (containerRange && !containerRange.isFlexible) {
      const subContent = content.slice(containerRange.start, containerRange.end);
      subFields = parseFieldList(subContent);
    }

    const field = {
      name: m.name,
      label: m.label,
      type: m.type,
      choices,
      onLabel: stylized?.onLabel,
      offLabel: stylized?.offLabel,
      conditional,
      subFields,
    };
    if (defaultValue !== undefined) field.defaultValue = defaultValue;
    fields.push(field);
  }

  return fields;
}

function extractFieldsFromPhp(content) {
  const fields = [];
  const seen = new Set();
  const matches = Array.from(content.matchAll(FIELD_TYPE_PATTERN)).map((match) => ({
    type: match[1],
    label: match[3] || '',
    name: match[5] || '',
    index: match.index || 0
  }));
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const nextIndex = i + 1 < matches.length ? matches[i + 1].index : content.length;
    const rawChain = content.slice(current.index, nextIndex);
    // Truncate at the first semicolon so that subsequent PHP statements (if blocks,
    // variable re-assignments like `$buttonGroup->conditionalLogic(...)`) are not
    // mistakenly parsed as part of this field's method chain.
    const semiIdx = findStatementEnd(rawChain);
    const chain = semiIdx !== -1 ? rawChain.slice(0, semiIdx + 1) : rawChain;
    if (!current.name || !INPUT_FIELD_TYPES.has(current.type)) continue;
    const key = `${current.name}:${current.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const choices = parseChoices(chain);
    const stylized = parseStylized(chain);
    const conditional = parseConditionalLogic(chain);
    const defaultValue = parseDefault(chain);
    const field = {
      name: current.name,
      label: current.label,
      type: current.type,
      choices,
      onLabel: stylized?.onLabel,
      offLabel: stylized?.offLabel,
      conditional
    };
    if (defaultValue !== undefined) field.defaultValue = defaultValue;
    fields.push(field);
  }
  return fields;
}

function extractBlockParamsRefs(content) {
  const refs = new Set();
  for (const match of content.matchAll(BLOCK_PARAMS_REF_PATTERN)) {
    if (match[1]) refs.add(match[1]);
  }
  return Array.from(refs);
}

function parseBlockParamsMethods(content) {
  const methods = {};
  const matches = [];
  const methodRegex = /public\s+static\s+function\s+([A-Za-z0-9_]+)\s*\(/g;
  let m;
  while ((m = methodRegex.exec(content)) !== null) {
    matches.push({ name: m[1], index: m.index });
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : content.length;
    const slice = content.slice(start, end);
    methods[matches[i].name] = extractFieldsFromPhp(slice);
  }
  return methods;
}

function parsePhpFile(filePath, blockParamsMap) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const classMatch = content.match(CLASS_PATTERN);
  if (!classMatch) return null;
  const className = classMatch[1];
  const layoutMatch = content.match(LAYOUT_PATTERN);
  const layout = layoutMatch ? layoutMatch[1] : null;

  // Use parseFieldList to get properly-nested field declarations (Repeater/Group with subFields)
  const directFields = parseFieldList(content);

  // BlockParams shared fields (padding, color, etc.) come BEFORE module-specific fields
  const dedup = new Map();
  const seenRefs = new Set();
  for (const match of content.matchAll(BLOCK_PARAMS_REF_PATTERN)) {
    if (!match[1] || seenRefs.has(match[1])) continue;
    seenRefs.add(match[1]);
    const extra = blockParamsMap[match[1]] || [];
    for (const field of extra) {
      if (!dedup.has(field.name)) dedup.set(field.name, field);
    }
  }

  for (const field of directFields) {
    if (!dedup.has(field.name)) dedup.set(field.name, field);
  }

  return { className, layout, fields: Array.from(dedup.values()) };
}

export function getModuleFields(req, res) {
  try {
    const modulesDir = path.resolve(__dirname, '../modules');
    const fieldGroupDir = path.resolve(__dirname, '../modules/FieldGroup');
    const blockParamsPath = path.join(modulesDir, 'BlockParams.php');

    const blockParamsMap = fs.existsSync(blockParamsPath)
      ? parseBlockParamsMethods(fs.readFileSync(blockParamsPath, 'utf-8'))
      : {};

    const modules = {};
    const scanDir = (dir) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      entries.forEach((entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
          return;
        }
        if (!entry.name.endsWith('.php')) return;
        const parsed = parsePhpFile(fullPath, blockParamsMap);
        if (!parsed) return;
        if (!modules[parsed.className]) {
          modules[parsed.className] = { fields: parsed.fields, layout: parsed.layout };
        } else {
          const existing = new Map(modules[parsed.className].fields.map((f) => [f.name, f]));
          parsed.fields.forEach((f) => {
            if (!existing.has(f.name)) existing.set(f.name, f);
          });
          modules[parsed.className].fields = Array.from(existing.values());
          if (!modules[parsed.className].layout && parsed.layout) {
            modules[parsed.className].layout = parsed.layout;
          }
        }
      });
    };

    scanDir(modulesDir);
    scanDir(fieldGroupDir);

    // Scan plugin module directories
    const pluginsDir = path.resolve(__dirname, '../../../plugins');
    if (fs.existsSync(pluginsDir)) {
      for (const entry of fs.readdirSync(pluginsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const pluginModulesDir = path.join(pluginsDir, entry.name, 'modules');
        scanDir(pluginModulesDir);
      }
    }

    res.json({ modules });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load module fields' });
  }
}
