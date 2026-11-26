import type { Character, Lorebook, LoreEntry, Persona } from '../types';

export const WIZARD_SYSTEM =
  'Ты помощник, который помогает пользователю придумать ролевую игру для текстового ролплея. ' +
  'Веди дружелюбный короткий разговор на русском, без длинных вступлений. ' +
  'Задавай не больше двух коротких вопросов за раз. Нужно выяснить: сеттинг и жанр; кто персонаж, за которого будет играть ИИ ' +
  '(внешность, характер, манера речи); кем будет игрок; как начинается история; желаемый тон и допустимая откровенность; ' +
  'важные детали мира. Если пользователь не знает, что ответить, предложи два-три варианта на выбор. ' +
  'Сам игру не веди и в роль не входи. Когда информации достаточно, скажи, что можно нажать «Собрать игру».';

export const WIZARD_START = 'Привет! Расскажи в паре слов, чего хочется: жанр, настроение, мир. Или просто напиши «удиви меня», и я предложу варианты.';

export const WIZARD_BUILD =
  'Собери игру по нашему разговору. Ответь ТОЛЬКО JSON без пояснений и без markdown-ограждений, строго такой структуры:\n' +
  '{"title":"короткое название игры","character":{"name":"","description":"","personality":"","scenario":"","first_message":"","example_dialogue":""},' +
  '"persona":{"name":"","description":""},"lorebook":[{"name":"","keys":["",""],"content":""}]}\n' +
  'Правила: пиши по-русски. description: внешность, роль и предыстория персонажа. scenario: где и как начинается история. ' +
  'first_message: начало сцены от лица персонажа, 2–4 абзаца; не говори за игрока и не решай за него. ' +
  'Для имени игрока используй {{user}}, для имени персонажа {{char}}. ' +
  'lorebook: от 0 до 6 записей о важных местах, фракциях и правилах мира, у каждой 2–4 ключевых слова. ' +
  'Не придумывай того, что противоречит разговору.';

export interface WizardResult {
  title: string;
  character: Pick<Character, 'name' | 'description' | 'personality' | 'scenario' | 'firstMessage' | 'exampleDialogue'>;
  persona: Pick<Persona, 'name' | 'description'>;
  entries: LoreEntry[];
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** Достаёт JSON из ответа модели, даже если она обернула его в ```json или добавила слова вокруг. */
export function parseWizard(text: string): WizardResult {
  const a = text.indexOf('{');
  const b = text.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('Модель ответила не в нужном формате');
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(text.slice(a, b + 1));
  } catch {
    throw new Error('Не удалось разобрать ответ модели (возможно, он оборвался)');
  }
  const c = (j.character ?? {}) as Record<string, unknown>;
  if (!str(c.name).trim() || !str(c.first_message).trim()) throw new Error('В ответе нет имени персонажа или первого сообщения');
  const p = (j.persona ?? {}) as Record<string, unknown>;
  const lore = Array.isArray(j.lorebook) ? (j.lorebook as Record<string, unknown>[]) : [];
  return {
    title: str(j.title),
    character: {
      name: str(c.name).trim(),
      description: str(c.description),
      personality: str(c.personality),
      scenario: str(c.scenario),
      firstMessage: str(c.first_message),
      exampleDialogue: str(c.example_dialogue),
    },
    persona: { name: str(p.name).trim(), description: str(p.description) },
    entries: lore
      .filter((e) => str(e.content).trim())
      .map((e) => ({
        id: crypto.randomUUID(),
        name: str(e.name),
        keys: Array.isArray(e.keys) ? e.keys.filter((k): k is string => typeof k === 'string' && !!k.trim()) : [],
        content: str(e.content),
        enabled: true,
        constant: false,
        order: 100,
      })),
  };
}

export type { Lorebook };
