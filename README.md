# Dev-labs News

Telegram Mini App + web-приложение новостного формата на базе Supabase и Vercel.  
Фокус продукта: персонализированная "Умная лента", редакторский draft-first контур и AI import-to-draft с обязательной ручной модерацией.

## 1) Краткое описание проекта

- Telegram Mini App flow и web-fallback
- Публичный контур чтения новостей (`/`, `/for-you`, `/post/:id`)
- Редакторский контур: создание, редактирование, preview, ручная публикация
- AI импорт по URL: extraction -> AI transform -> сохранение в draft

> Важно: AI **не публикует** материалы автоматически.  
> Публикация всегда выполняется вручную человеком.

## 2) Что уже реализовано

| Этап | Статус | Коротко |
|---|---|---|
| N8 | Done | legacy topic-уведомления отключены |
| N9 | Done | усилено ранжирование Умной ленты |
| N10 | Done | `/start` у Telegram-бота работает, webhook активен |
| N11 | Done | UX-полировка Умной ленты и связанных сценариев |
| N12 | Done | единый контур открытия/чтения новости в Mini App |
| N13 | Done | draft-first редакторский контур |
| N14 | Done | import-by-URL -> extraction -> AI -> draft -> manual review |
| N14.1 | Done | fallback AI, удержание языка, UX импорта |
| N14.2 | Done | безопасные AI-настройки в админке |
| N14.3 | Done | до 5 custom tags + мягкий теговый сигнал в Smart Feed |

## 3) Основные возможности

- Telegram Mini App deep links: `https://t.me/<bot>?startapp=<payload>`
- Канонический экран статьи в приложении и предсказуемый back-flow
- Draft-first редакторка: `Сохранить черновик` / `Опубликовать` / `Preview`
- Импорт по ссылке в draft (без автопубликации)
- AI fallback (primary -> fallback), валидации и обработка ошибок
- Admin AI settings (без доступа к секретам)
- Custom tags (до 5) в редакторке и на статье
- Умная лента учитывает теги как дополнительный мягкий сигнал персонализации

## 4) Текущий стек

| Слой | Технологии |
|---|---|
| Frontend | React 18, TypeScript, Vite 6, React Router 7 |
| UI | Tailwind CSS, Radix UI primitives, Lucide, Framer Motion |
| Forms/validation | react-hook-form, zod |
| Content | Lexical-based markdown editor, react-markdown, remark-gfm |
| Backend | Supabase Postgres + Auth + Storage + RLS |
| Server logic | Supabase Edge Functions (Deno) |
| Telegram | Bot API, webhook, Mini App startapp links |
| AI | Cerebras API (server-side, через `import-post-draft`) |
| Deploy | Vercel (frontend/web), Supabase (DB/functions) |

## 5) Как локально запускать проект

```bash
npm install
npm run dev
```

### Базовые проверки

```bash
npm run typecheck
npm run lint
npm run build
```

### Supabase (миграции/функции)

```bash
npx supabase db push
npx supabase functions deploy import-post-draft
npx supabase functions deploy telegram-auth --no-verify-jwt
npx supabase functions deploy telegram-bot-webhook
```

## 6) Env / secrets overview

Секреты не должны попадать в git.  
Локально используются `.env.local` (frontend) и `supabase/functions/.env.local` (functions).

### Client (.env.local)

| Переменная | Обязательна | Назначение |
|---|---|---|
| `VITE_SUPABASE_URL` | Да | URL Supabase проекта |
| `VITE_SUPABASE_ANON_KEY` | Да | public anon key для клиента |
| `VITE_TELEGRAM_BOT_USERNAME` | Нет | генерация Telegram Mini App ссылок |
| `VITE_APP_VERSION` | Нет | версия в UI (`about`) |

<details>
<summary>Server-side (Supabase Functions / secrets)</summary>

| Переменная | Обязательна | Где используется |
|---|---|---|
| `PROJECT_URL` или `SUPABASE_URL` | Да | Supabase clients в functions |
| `SERVICE_ROLE_KEY` или `SUPABASE_SERVICE_ROLE_KEY` | Да | сервисные операции в functions |
| `ANON_KEY` или `SUPABASE_ANON_KEY` | Частично | часть functions (auth context) |
| `TELEGRAM_BOT_TOKEN` | Да | bot/webhook/notifications/auth |
| `TELEGRAM_BOT_USERNAME` | Рекомендуется | Mini App deep links из бота/уведомлений |
| `TELEGRAM_WEBHOOK_SECRET_TOKEN` | Нет | валидация webhook заголовка |
| `JWT_SECRET` | Да (telegram-auth) | подписание jwt в `telegram-auth` |
| `TELEGRAM_AUTH_MAX_AGE_SECONDS` | Нет | TTL для Telegram initData |
| `CRON_SECRET` | Да (digest jobs) | авторизация cron-вызовов |
| `APP_BASE_URL` | Нет | fallback URL в legacy topic notifier |
| `ENABLE_LEGACY_TOPIC_NOTIFICATIONS` | Нет | legacy flag (по умолчанию выключен) |
| `CEREBRAS_API_KEY` | Да | AI import-to-draft |
| `CEREBRAS_BASE_URL` | Нет | override base URL Cerebras |

</details>

## 7) Краткая архитектура

```text
Telegram Client / Browser
        |
        v
React + Vite Mini App (src/*, routes)
        |
        +--> Supabase Auth / Postgres / Storage
        |
        +--> Supabase Edge Functions
              - telegram-auth
              - telegram-bot-webhook
              - telegram-notify-for-you-digest
              - import-post-draft (URL -> extraction -> AI -> draft)
```

## 8) Editorial / AI workflow

### Manual editorial flow
1. Создать материал вручную (`/admin/new`)
2. Сохранить как `draft`
3. Preview и редактура
4. Ручная публикация

### AI import flow (manual trigger)
1. Вставить URL (`/admin/import`)
2. Server extraction
3. AI transform (Cerebras, primary/fallback)
4. Сохранение только в `draft`
5. Ручная проверка и правки
6. Ручная публикация

> Auto-publish отсутствует по продуктовым правилам.

## 9) Статус проекта / roadmap snapshot

- **Done:** N8 -> N14.3 (см. таблицу выше)
- **Next:** отдельный этап пока не зафиксирован в этом README; текущий фокус — стабилизация и качество текущего контура

## 10) Полезные команды

```bash
# Frontend
npm run dev
npm run lint
npm run build

# Optional checks
npm run typecheck
npm run deno:check:functions

# Supabase
npx supabase db push
npx supabase functions deploy import-post-draft
npx supabase functions deploy telegram-auth --no-verify-jwt
npx supabase functions deploy telegram-bot-webhook
```

