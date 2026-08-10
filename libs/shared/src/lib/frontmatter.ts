/**
 * A small YAML-subset frontmatter parser.
 *
 * `gray-matter` pulls in a full YAML engine to read six keys, and it does not
 * run cleanly in the browser bundle the admin editor needs. The supported
 * subset is exactly what a post needs: scalars, quoted scalars, folded
 * multi-line scalars (indented continuations), inline arrays and booleans.
 */

export interface Frontmatter {
  data: Record<string, unknown>;
  body: string;
}

const DELIMITER = '---';
const KEY_LINE = /^([A-Za-z_][A-Za-z0-9_-]*):\s?(.*)$/;

function coerce(raw: string): unknown {
  const value = raw.trim();
  if (value === '') return '';
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null' || value === '~') return null;

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((item) => String(coerce(item)));
  }
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

export function parseFrontmatter(source: string): Frontmatter {
  const normalised = source.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  if (!normalised.startsWith(`${DELIMITER}\n`)) {
    return { data: {}, body: normalised };
  }

  const end = normalised.indexOf(`\n${DELIMITER}`, DELIMITER.length);
  if (end === -1) return { data: {}, body: normalised };

  const block = normalised.slice(DELIMITER.length + 1, end);
  const afterDelimiter = normalised.indexOf('\n', end + 1 + DELIMITER.length);
  const body = afterDelimiter === -1 ? '' : normalised.slice(afterDelimiter + 1);

  const data: Record<string, unknown> = {};
  let currentKey: string | null = null;
  let buffer = '';

  const flush = () => {
    if (currentKey !== null) data[currentKey] = coerce(buffer);
    currentKey = null;
    buffer = '';
  };

  for (const line of block.split('\n')) {
    if (line.trim() === '') continue;
    // Indented lines continue the previous scalar (YAML plain-scalar folding).
    if (/^\s+\S/.test(line) && currentKey !== null) {
      buffer = `${buffer} ${line.trim()}`;
      continue;
    }
    const match = KEY_LINE.exec(line);
    if (!match) continue;
    flush();
    currentKey = match[1];
    buffer = match[2];
  }
  flush();

  return { data, body: body.replace(/^\n+/, '') };
}

function serializeValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => String(item)).join(', ')}]`;
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  const text = String(value ?? '');
  // Quote anything that would otherwise change meaning on the way back in.
  if (text === '' || /^[[\]{}>|*&!%@`#-]/.test(text) || /:\s/.test(text) || text.includes('\n')) {
    return `"${text.replace(/\n/g, ' ').replace(/"/g, '\\"')}"`;
  }
  return text;
}

/** Round-trips with {@link parseFrontmatter}. Keys are written in the order given. */
export function serializeFrontmatter(data: Record<string, unknown>, body: string): string {
  const lines = Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}: ${serializeValue(value)}`);
  return `${DELIMITER}\n${lines.join('\n')}\n${DELIMITER}\n\n${body.replace(/^\n+/, '')}`;
}
