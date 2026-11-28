import hljs from 'highlight.js/lib/core';
import js from 'highlight.js/lib/languages/javascript';
import ts from 'highlight.js/lib/languages/typescript';
import py from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import java from 'highlight.js/lib/languages/java';
import kotlin from 'highlight.js/lib/languages/kotlin';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import yaml from 'highlight.js/lib/languages/yaml';
import markdown from 'highlight.js/lib/languages/markdown';
import lua from 'highlight.js/lib/languages/lua';

hljs.registerLanguage('javascript', js);
hljs.registerLanguage('typescript', ts);
hljs.registerLanguage('python', py);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('java', java);
hljs.registerLanguage('kotlin', kotlin);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('lua', lua);

/** Названия, которые модели пишут после ``` , приводим к языкам библиотеки. GDScript похож на Python, берём его. */
const ALIAS: Record<string, string> = {
  js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', py: 'python', sh: 'bash', shell: 'bash', zsh: 'bash',
  html: 'xml', svg: 'xml', yml: 'yaml', kt: 'kotlin', c: 'cpp', h: 'cpp', hpp: 'cpp', cs: 'csharp', rs: 'rust', md: 'markdown',
  gdscript: 'python', gd: 'python',
};

const EXT: Record<string, string> = {
  javascript: 'js', typescript: 'ts', python: 'py', json: 'json', bash: 'sh', xml: 'html', css: 'css', java: 'java', kotlin: 'kt',
  cpp: 'cpp', csharp: 'cs', go: 'go', rust: 'rs', sql: 'sql', yaml: 'yml', markdown: 'md', lua: 'lua',
};

export function normalizeLang(lang?: string): string | undefined {
  if (!lang) return undefined;
  const l = lang.toLowerCase();
  const n = ALIAS[l] ?? l;
  return hljs.getLanguage(n) ? n : undefined;
}

/** Расширение файла для сохранения блока: для gdscript — gd, для остального по языку. */
export function fileExt(lang?: string): string {
  const l = lang?.toLowerCase();
  if (l === 'gdscript' || l === 'gd') return 'gd';
  const n = normalizeLang(lang);
  return (n && EXT[n]) || 'txt';
}

/** Размеченный HTML (библиотека экранирует текст сама). Для очень длинных блоков подсветку пропускаем. */
export function highlight(code: string, lang?: string): string | null {
  const n = normalizeLang(lang);
  if (!n || code.length > 20000) return null;
  try {
    return hljs.highlight(code, { language: n, ignoreIllegals: true }).value;
  } catch {
    return null;
  }
}
