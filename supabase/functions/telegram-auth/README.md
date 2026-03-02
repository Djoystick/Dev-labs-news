# Telegram Auth Edge Function

`telegram-auth` validates Telegram WebApp `initData`, provisions a Supabase Auth user, upserts `public.profiles`, and returns deterministic credentials for MVP sign-in.

## Required secrets

```bash
npx supabase secrets set \
  TELEGRAM_BOT_TOKEN="your_bot_token_here" \
  SERVICE_ROLE_KEY="your_service_role_key_here" \
  PROJECT_URL="https://your-project-ref.supabase.co"
```

Optional:

```bash
npx supabase secrets set TELEGRAM_AUTH_MAX_AGE_SECONDS="604800"
```

Default `auth_date` max age is `86400` seconds (24 hours).

## Deploy

```bash
npx supabase link --project-ref your-project-ref
npx supabase functions deploy telegram-auth --no-verify-jwt
```

## Request

`POST /functions/v1/telegram-auth`

```json
{
  "initData": "query_id=AA...&user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22Dev%22%7D&auth_date=1730000000&hash=..."
}
```

## Primitive curl test

```bash
curl -i \
  -X POST "https://your-project-ref.supabase.co/functions/v1/telegram-auth" \
  -H "Content-Type: application/json" \
  -d "{\"initData\":\"query_id=AA...&user=%7B%22id%22%3A123456789%7D&auth_date=1730000000&hash=...\"}"
```

## Success response

```json
{
  "email": "tg_123456789@telegram.local",
  "password": "Tg!deterministic_password_here",
  "userId": "00000000-0000-0000-0000-000000000000",
  "profile": {
    "id": "00000000-0000-0000-0000-000000000000",
    "role": "user",
    "handle": null,
    "handle_norm": null,
    "bio": null,
    "telegram_id": "123456789",
    "username": "devlabs",
    "full_name": "Dev Labs",
    "avatar_url": "https://t.me/i/userpic/320/example.jpg",
    "created_at": "2026-03-02T00:00:00+00:00"
  }
}
```
