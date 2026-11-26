import type { Message, WidgetOp } from '../types';

/**
 * Виджеты — маленькие интерактивные панели над полем ввода (телефон, статус, кубики).
 *
 * Состояние виджета НЕ хранится отдельно: оно вычисляется из сообщений текущей ветки.
 * - Модель управляет виджетом тегами в своём ответе (<phone from="Анна">…</phone>); пользователь их не видит как текст.
 * - Действия пользователя в виджете превращаются в обычное сообщение + служебную пометку (widgetOps).
 * Поэтому свайпы, правка, удаление и ветки работают сами: сменилась ветка, сменилось и состояние виджета.
 */

export type WidgetId = 'phone' | 'status' | 'roll';

export interface PhoneState {
  threads: Record<string, { from: 'me' | 'them'; text: string }[]>;
  /** Контакты от самого давнего к самому свежему */
  order: string[];
}
export interface StatusState {
  fields: [string, string][];
}
export interface RollState {
  pending: { d: string; reason: string } | null;
}
export interface WidgetStates {
  phone: PhoneState;
  status: StatusState;
  roll: RollState;
}

/** Виджеты, которые рисуются в окне над полем ввода (статус показывается полоской под шапкой) */
export const FRAME_WIDGETS: WidgetId[] = ['phone', 'roll'];

export const WIDGETS: { id: WidgetId; name: string; description: string }[] = [
  { id: 'phone', name: 'Телефон', description: 'Мессенджер: персонажи пишут тебе, ты отвечаешь' },
  { id: 'status', name: 'Статус', description: 'Панель параметров: здоровье, место, настроение и т.д.' },
  { id: 'roll', name: 'Кубики', description: 'Броски d4–d100, модель может попросить проверку' },
];

const initial = (): WidgetStates => ({
  phone: { threads: {}, order: [] },
  status: { fields: [] },
  roll: { pending: null },
});

const TAG = /<(phone|status|roll)\b((?:[^>"']|"[^"]*"|'[^']*')*?)(?:\/>|>([\s\S]*?)<\/\1>)/g;
const ATTR = /([^\s=\/>"']+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

function attrs(src: string): [string, string][] {
  const out: [string, string][] = [];
  for (const m of src.matchAll(ATTR)) out.push([m[1], m[2] ?? m[3] ?? '']);
  return out;
}

/** Убирает служебные теги из текста ответа (в том числе недописанный тег в конце потока). */
export function stripWidgetTags(text: string): string {
  if (!text.includes('<')) return text;
  return text
    .replace(TAG, '')
    .replace(/<(phone|status|roll)\b[^>]*$/i, '')
    .replace(/<(phone|status|roll)\b[^>]*>[^<]*$/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function applyAssistant(st: WidgetStates, text: string) {
  if (!text.includes('<')) return;
  for (const m of text.matchAll(TAG)) {
    const [, name, rawAttrs, body = ''] = m;
    const a = attrs(rawAttrs);
    if (name === 'phone') {
      const from = (a.find(([k]) => k === 'from')?.[1] ?? '').trim();
      const msg = body.trim();
      if (!from || !msg) continue;
      (st.phone.threads[from] ??= []).push({ from: 'them', text: msg });
      st.phone.order = [...st.phone.order.filter((c) => c !== from), from];
    } else if (name === 'status') {
      for (const [k, v] of a) {
        const i = st.status.fields.findIndex(([key]) => key === k);
        if (v.trim() === '' || v.trim() === '-') {
          if (i >= 0) st.status.fields.splice(i, 1);
        } else if (i >= 0) st.status.fields[i] = [k, v];
        else st.status.fields.push([k, v]);
      }
    } else if (name === 'roll') {
      st.roll.pending = { d: a.find(([k]) => k === 'd')?.[1] || 'd20', reason: body.trim() };
    }
  }
}

function applyUser(st: WidgetStates, ops: WidgetOp[]) {
  for (const op of ops) {
    if (op.w === 'phone' && op.t === 'msg' && typeof op.to === 'string' && typeof op.text === 'string') {
      (st.phone.threads[op.to] ??= []).push({ from: 'me', text: op.text });
      st.phone.order = [...st.phone.order.filter((c) => c !== op.to), op.to];
    } else if (op.w === 'roll') {
      st.roll.pending = null;
    }
  }
}

/** Состояние всех виджетов по сообщениям текущей ветки. */
export function foldWidgets(messages: Message[]): WidgetStates {
  const st = initial();
  for (const m of messages) {
    if (m.role === 'assistant') applyAssistant(st, m.content);
    else if (m.role === 'user' && m.widgetOps?.length) applyUser(st, m.widgetOps);
  }
  return st;
}

/** Текст для системного промпта: как управлять виджетом и что в нём сейчас. */
export function widgetPrompt(enabled: string[], st: WidgetStates): string {
  const parts: string[] = [];
  if (enabled.includes('phone')) {
    const recent = st.phone.order
      .slice(-3)
      .map((c) => `${c}: ${st.phone.threads[c].slice(-4).map((x) => `${x.from === 'me' ? 'пользователь' : c}: ${x.text}`).join(' / ')}`)
      .join('\n');
    parts.push(
      'Виджет «Телефон» включён: у пользователя на экране телефон с мессенджером. Когда персонаж пишет ему в телефон, добавь в ответ ' +
        'тег <phone from="Имя">текст сообщения</phone>. Пользователь видит его в телефоне, а не в тексте. ' +
        'Сообщения пользователя с телефона приходят строками вида «📱 Сообщение для Имя: текст». Их может прийти сразу несколько, ' +
        'к разным людям и на разные темы, вместе с обычным сообщением в чате. Прочитай всё и реши, как отвечать: на каждое сообщение отдельно, ' +
        'если темы разные, или одним ответом на несколько. Отвечай в телефон так, как пишут в мессенджере: коротко и можно несколькими ' +
        'сообщениями подряд, для каждого отдельный тег <phone>. Ответы в телефон пиши только тегами, а в основном тексте оставь то, что происходит в сцене.' +
        (recent ? `\nПоследняя переписка в телефоне:\n${recent}` : ''),
    );
  }
  if (enabled.includes('status')) {
    const cur = st.status.fields.map(([k, v]) => `${k}=${v}`).join(', ');
    parts.push(
      'Виджет «Статус» включён: панель параметров. Чтобы обновить её, добавь в ответ тег-атрибуты, например ' +
        '<status здоровье="70/100" место="Таверна" настроение="злой"/>. Имя поля одним словом без пробелов. ' +
        'Значение «-» удаляет поле. Указывай только то, что изменилось.' +
        (cur ? `\nСейчас в панели: ${cur}` : '\nСейчас панель пуста: заполни её основными параметрами.'),
    );
  }
  if (enabled.includes('roll')) {
    parts.push(
      'Виджет «Кубики» включён: пользователь бросает кубики сам, результат приходит строкой «🎲 …». ' +
        'Если по сюжету нужна проверка, попроси бросок тегом <roll d="d20">за что бросок</roll>, закончи ответ и дождись результата. ' +
        'Не решай исход заранее.' +
        (st.roll.pending ? `\nСейчас ожидается бросок ${st.roll.pending.d}: ${st.roll.pending.reason}` : ''),
    );
  }
  if (!parts.length) return '';
  const tags = [enabled.includes('phone') && '<phone>', enabled.includes('status') && '<status>', enabled.includes('roll') && '<roll>'].filter(Boolean).join(', ');
  parts.push(
    `Существуют ТОЛЬКО теги: ${tags}. Других тегов нет: не придумывай новые (погоду, время, инвентарь и т.п. пиши обычным текстом` +
      `${enabled.includes('status') ? ' или в <status>' : ''}). Каждый тег делает только то, что описано выше.`,
  );
  return `[Интерактивные виджеты]\n${parts.join('\n\n')}`;
}
