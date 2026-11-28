# Equality: заметки разработчика

Как устроен проект и как его собрать. Описание для пользователей: README.md.

## Сборка APK

Сборка Android-версии описана в `.github/workflows/android.yml` (отладочная сборка на каждый коммит)
и `release.yml` (подписанная, по кнопке). Шаги: `npm install`, `npm run build`, `npx cap add android`,
копирование `native/KeyVaultPlugin.java` и правка `MainActivity`/манифеста, иконки через `@capacitor/assets`, `npx cap sync android`, `./gradlew assemble…`.
Откройте workflow: там все команды подряд, их можно повторить локально (нужны Node 20 и JDK 17, Android SDK).

## Запуск на компьютере для разработки

```bash
npm install
npm run dev          # http://localhost:5173
npm run typecheck
```

## Стек

React + TypeScript + Vite + Tailwind · @tanstack/react-virtual (виртуальный список) · Zustand ·
Dexie/IndexedDB (локальная база) · Capacitor (Android).

## Почему не лагает

1. Виртуализация: в DOM только видимые сообщения.
2. Каждое сообщение подписано только на свои данные.
3. Текст стримящегося ответа хранится отдельно от истории.
4. Обновления интерфейса не чаще одного раза за кадр.
5. Markdown разбирается после завершения ответа.
6. История грузится одним запросом по индексу.

## Структура

```
src/
  App.tsx, main.tsx, index.css   — каркас и CSS-переменные темы
  types.ts, modes.ts             — типы и режимы
  db/db.ts                       — база: chats, messages, folders, kv (фон); db/rpdb.ts — персонажи, персоны, лорбуки
  providers/                     — Gemini, OpenRouter/Groq/свой endpoint, SSE
  store/                         — settings (ключи), chat (дерево сообщений), theme (оформление)
  components/                    — ChatView, MessageItem, Composer, Sidebar,
                                   SettingsPanel, AppearancePanel, Background
resources/                       — иконки для Android
.github/workflows/android.yml    — автосборка APK
```

## Схема БД

**chats**: id, title, leafId, createdAt, updatedAt
**messages**: id, chatId, parentId, role, content, createdAt, model
**kv**: key, value (картинка фона)

Сообщения образуют дерево (`parentId`): свайпы — несколько ответов с одним родителем,
ветки — разные продолжения, текущий чат — путь от корня до `leafId`.

## Ограничения

- Названия моделей по умолчанию могут устареть, правятся в настройках.
- Код сначала собирается и проверяется в CI, а работоспособность проверяется на реальном телефоне автором.
