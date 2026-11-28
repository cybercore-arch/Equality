import { db } from '../db/db';
import { useChat } from '../store/chat';
import type { Chat, Message } from '../types';

const SAMPLES = [
  'Коротко: да.',
  'Хорошо, давай разберём это по шагам.\n\n1. Сначала определим цель.\n2. Потом выберем подход.\n3. И проверим результат.',
  'Ночной город шумел за окном. Дождь стекал по стеклу, и фонари расплывались жёлтыми пятнами. Она долго молчала, глядя на огни, а потом тихо сказала, что всё могло сложиться иначе, если бы тогда он остался. Он не ответил: слова застряли где-то между «прости» и «поздно».',
  'Вот пример кода:\n\n```python\ndef fib(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a\n```\n\nОн считает числа Фибоначчи за линейное время.',
  '| Вариант | Плюсы | Минусы |\n|---|---|---|\n| А | быстро | дорого |\n| Б | дёшево | долго |',
  'Ладно.',
  'Это длинное сообщение нужно, чтобы проверить прокрутку и перенос строк. '.repeat(18),
];

/** Создаёт тестовый чат с большим числом сообщений, чтобы проверить скорость на этом устройстве. */
export async function createStressChat(count = 5000): Promise<void> {
  const t0 = Date.now() - count * 1000;
  const chatId = crypto.randomUUID();
  const msgs: Message[] = [];
  let parent: string | null = null;
  for (let i = 0; i < count; i++) {
    const id = crypto.randomUUID();
    const role = i % 2 === 0 ? 'user' : 'assistant';
    msgs.push({
      id,
      chatId,
      parentId: parent,
      role,
      content: `${role === 'user' ? 'Сообщение' : 'Ответ'} №${i + 1}. ${SAMPLES[(i * 7 + (i >> 3)) % SAMPLES.length]}`,
      createdAt: t0 + i * 1000,
    });
    parent = id;
  }
  const chat: Chat = {
    id: chatId,
    title: `Тест: ${count} сообщений`,
    leafId: parent,
    createdAt: t0,
    updatedAt: Date.now(),
    modeId: 'general',
    folderId: null,
  };
  await db.chats.put(chat);
  for (let i = 0; i < msgs.length; i += 500) await db.messages.bulkPut(msgs.slice(i, i + 500));
  await useChat.getState().init();
}
