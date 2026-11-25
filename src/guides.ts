import type { ProviderKind } from './types';

export interface Guide {
  title: string;
  steps: string[];
  link?: string;
}

/** Подсказки «где взять ключ» — показываются на первом экране и в настройках. */
export const GUIDES: Record<ProviderKind, Guide> = {
  gemini: {
    title: 'Ключ Gemini (бесплатно, около минуты)',
    steps: [
      'Открой aistudio.google.com/apikey и войди в Google-аккаунт.',
      'Нажми «Create API key» (создать ключ).',
      'Скопируй ключ и вставь его сюда.',
      'У бесплатного тарифа есть лимиты запросов, для личного чата их обычно хватает.',
    ],
    link: 'https://aistudio.google.com/apikey',
  },
  openrouter: {
    title: 'Ключ OpenRouter (есть бесплатные модели :free)',
    steps: [
      'Открой openrouter.ai/keys и зарегистрируйся.',
      'Нажми «Create Key», дай любое имя и скопируй ключ.',
      'Вставь ключ сюда.',
      'В настройках в поле «Модель» используй названия с суффиксом :free (список на openrouter.ai/models).',
    ],
    link: 'https://openrouter.ai/keys',
  },
  groq: {
    title: 'Ключ Groq (очень быстрые ответы)',
    steps: [
      'Открой console.groq.com/keys и войди в аккаунт.',
      'Нажми «Create API Key», дай имя и скопируй ключ.',
      'Вставь ключ сюда.',
    ],
    link: 'https://console.groq.com/keys',
  },
  custom: {
    title: 'Свой сервер или другой сервис',
    steps: [
      'Подойдёт любой сервис с OpenAI-совместимым API.',
      'Base URL это адрес до «/v1», например https://api.example.com/v1.',
      'Ключ и название модели берутся в личном кабинете сервиса. Если ключ не нужен, оставь поле пустым.',
    ],
  },
};

export const PROVIDER_LABEL: Record<ProviderKind, string> = {
  gemini: 'Gemini',
  openrouter: 'OpenRouter',
  groq: 'Groq',
  custom: 'Свой',
};

export const PROVIDER_HINT: Record<ProviderKind, string> = {
  gemini: 'бесплатно, проще всего',
  openrouter: 'много бесплатных моделей',
  groq: 'очень быстро',
  custom: 'любой OpenAI-совместимый',
};
