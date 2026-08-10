/**
 * A deliberately small syntax highlighter.
 *
 * It makes exactly one pass and never recurses, so a shell expansion inside a
 * double-quoted string stays part of the string token. That is a deliberate
 * trade: correctness of the *escaping* is absolute, richness of the colouring
 * is best-effort.
 *
 * Shipping Shiki or highlight.js to colour five languages costs more bytes
 * than the posts themselves. This tokenises with a single alternating regex
 * per language family and emits `<span class="tok-*">`, which `global.css`
 * maps onto Catppuccin. Everything not matched is HTML-escaped verbatim, so
 * the worst failure mode is "code that is less colourful than intended".
 */

export type TokenKind =
  | 'comment'
  | 'string'
  | 'number'
  | 'keyword'
  | 'builtin'
  | 'function'
  | 'property'
  | 'operator'
  | 'punctuation'
  | 'variable'
  | 'inserted'
  | 'deleted';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface Rule {
  kind: TokenKind;
  pattern: string;
}

const C_LIKE_KEYWORDS =
  'as|async|await|break|case|catch|class|const|constructor|continue|declare|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|is|keyof|let|new|of|private|protected|public|readonly|return|satisfies|set|static|super|switch|this|throw|try|type|typeof|var|void|while|yield';

const C_LIKE_BUILTINS =
  'Array|Boolean|Date|Error|JSON|Map|Math|Number|Object|Promise|RegExp|Set|String|Symbol|console|document|globalThis|process|window|true|false|null|undefined|NaN|Infinity|string|number|boolean|any|unknown|never|object';

const SHELL_KEYWORDS =
  'if|then|else|elif|fi|for|while|do|done|case|esac|in|function|return|export|local|source|alias|unset|shift';

const SHELL_BUILTINS =
  'cd|ls|cat|echo|printf|grep|sed|awk|cut|sort|uniq|head|tail|find|xargs|curl|wget|git|npm|npx|pnpm|yarn|node|docker|kubectl|nx|vercel|supabase|mkdir|rm|cp|mv|chmod|chown|sudo|apt|brew|make|tmux|nvim|vim|zsh|bash';

const RULES: Record<string, Rule[]> = {
  clike: [
    { kind: 'comment', pattern: String.raw`\/\*[\s\S]*?\*\/|\/\/[^\n]*` },
    { kind: 'string', pattern: String.raw`\`(?:\\[\s\S]|[^\\\`])*\`|"(?:\\[\s\S]|[^\\"\n])*"|'(?:\\[\s\S]|[^\\'\n])*'` },
    { kind: 'number', pattern: String.raw`\b0[xX][0-9a-fA-F_]+\b|\b\d[\d_]*(?:\.[\d_]+)?(?:[eE][+-]?\d+)?\b` },
    { kind: 'keyword', pattern: String.raw`\b(?:${C_LIKE_KEYWORDS})\b` },
    { kind: 'builtin', pattern: String.raw`\b(?:${C_LIKE_BUILTINS})\b` },
    { kind: 'function', pattern: String.raw`\b[A-Za-z_$][\w$]*(?=\s*\()` },
    { kind: 'property', pattern: String.raw`(?<=\.)[A-Za-z_$][\w$]*` },
    { kind: 'operator', pattern: String.raw`=>|===|!==|\?\?|\?\.|[+\-*/%<>=!&|^~?:]+` },
    { kind: 'punctuation', pattern: String.raw`[{}[\]();,.]` },
  ],
  shell: [
    { kind: 'comment', pattern: String.raw`(?<=^|\s)#[^\n]*` },
    { kind: 'string', pattern: String.raw`"(?:\\[\s\S]|[^\\"])*"|'[^']*'` },
    { kind: 'variable', pattern: String.raw`\$\{[^}]*\}|\$[A-Za-z_][\w]*|\$[@#?*0-9]` },
    { kind: 'keyword', pattern: String.raw`\b(?:${SHELL_KEYWORDS})\b` },
    { kind: 'builtin', pattern: String.raw`\b(?:${SHELL_BUILTINS})\b` },
    { kind: 'number', pattern: String.raw`\b\d+\b` },
    { kind: 'operator', pattern: String.raw`\|\||&&|[|&<>]{1,2}|--?[A-Za-z][\w-]*` },
    { kind: 'punctuation', pattern: String.raw`[{}[\]();,]` },
  ],
  json: [
    { kind: 'property', pattern: String.raw`"(?:\\.|[^\\"])*"(?=\s*:)` },
    { kind: 'string', pattern: String.raw`"(?:\\.|[^\\"])*"` },
    { kind: 'number', pattern: String.raw`-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b` },
    { kind: 'keyword', pattern: String.raw`\b(?:true|false|null)\b` },
    { kind: 'punctuation', pattern: String.raw`[{}[\]:,]` },
  ],
  diff: [
    { kind: 'inserted', pattern: String.raw`^\+[^\n]*` },
    { kind: 'deleted', pattern: String.raw`^-[^\n]*` },
    { kind: 'comment', pattern: String.raw`^@@[^\n]*` },
  ],
};

const LANGUAGE_ALIASES: Record<string, keyof typeof RULES | 'plain'> = {
  ts: 'clike', tsx: 'clike', typescript: 'clike',
  js: 'clike', jsx: 'clike', javascript: 'clike',
  java: 'clike', c: 'clike', cpp: 'clike', go: 'clike', rust: 'clike', rs: 'clike',
  css: 'clike', scss: 'clike',
  sh: 'shell', bash: 'shell', zsh: 'shell', shell: 'shell', console: 'shell',
  json: 'json', jsonc: 'json',
  diff: 'diff', patch: 'diff',
};

export function normaliseLanguage(language: string | undefined): string {
  return (language ?? '').trim().toLowerCase().split(/[\s:]/)[0] ?? '';
}

const compiled = new Map<string, RegExp>();

function ruleRegex(family: keyof typeof RULES): RegExp {
  const cached = compiled.get(family);
  if (cached) return cached;
  const source = RULES[family]
    .map((rule, index) => `(?<k${index}>${rule.pattern})`)
    .join('|');
  const regex = new RegExp(source, 'gm');
  compiled.set(family, regex);
  return regex;
}

/**
 * Highlight `code`, returning HTML-escaped markup. Unknown languages fall
 * through to plain escaped text.
 */
export function highlight(code: string, language?: string): string {
  const alias = LANGUAGE_ALIASES[normaliseLanguage(language)];
  if (!alias || alias === 'plain') return escapeHtml(code);

  const rules = RULES[alias];
  const regex = ruleRegex(alias);
  regex.lastIndex = 0;

  let out = '';
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(code)) !== null) {
    // Zero-length matches would spin forever.
    if (match[0].length === 0) {
      regex.lastIndex += 1;
      continue;
    }
    out += escapeHtml(code.slice(cursor, match.index));

    const groups = match.groups ?? {};
    const hitIndex = rules.findIndex((_, index) => groups[`k${index}`] !== undefined);
    const kind = hitIndex >= 0 ? rules[hitIndex].kind : 'punctuation';
    out += `<span class="tok-${kind}">${escapeHtml(match[0])}</span>`;

    cursor = match.index + match[0].length;
  }

  out += escapeHtml(code.slice(cursor));
  return out;
}
