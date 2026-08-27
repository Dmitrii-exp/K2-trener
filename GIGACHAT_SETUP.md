# Настройка GigaChat для SaleTrening

Этот файл объясняет, где вводить credentials GigaChat и как работает получение OAuth-токена.

## Важно

**Не вставляйте секретный ключ GigaChat в `index.html`, GitHub, README или другой публичный файл.**

Ключ хранится только в Secrets/Environment Variables Supabase Edge Functions.

## Какие переменные нужны

Основной вариант:

```text
GIGACHAT_AUTH_KEY=<ваш Base64 credentials из GigaChat>
GIGACHAT_SCOPE=GIGACHAT_API_PERS
GIGACHAT_MODEL=GigaChat-2-Pro
```

Допустимые альтернативы для credentials в текущем `evaluate-session`:

```text
GIGACHAT_API_KEY=<ваши credentials>
```

или

```text
GIGACHAT_CREDENTIALS=<ваши credentials>
```

Также поддерживается вариант с Client ID / Client Secret:

```text
GIGACHAT_CLIENT_ID=<client id>
GIGACHAT_CLIENT_SECRET=<client secret>
```

В этом случае функция сама формирует Basic credentials.

## Где вводить ключ

1. Откройте Supabase Dashboard.
2. Выберите проект **K2-trener**.
3. Откройте **Edge Functions**.
4. Откройте функцию **evaluate-session**.
5. Перейдите в раздел **Secrets / Environment Variables**.
6. Добавьте:

   `GIGACHAT_AUTH_KEY` = ваш ключ credentials.

7. Добавьте при необходимости:

   `GIGACHAT_SCOPE` = `GIGACHAT_API_PERS`

   `GIGACHAT_MODEL` = `GigaChat-2-Pro`

8. Сохраните Secrets.
9. Повторите настройку для функции **chat-client**, если она также должна обращаться к GigaChat.

## Что происходит после ввода ключа

Ключ **не является OAuth access token**.

При запросе к `evaluate-session` серверная функция:

1. получает `GIGACHAT_AUTH_KEY` из защищённых Supabase Secrets;
2. отправляет credentials на GigaChat OAuth endpoint;
3. получает временный `access_token`;
4. использует этот токен для запроса `chat/completions`;
5. после получения ответа сохраняет результат оценки в Supabase.

То есть вручную вводить или постоянно обновлять `access_token` **не нужно**.

## Для chat-client

Функция `chat-client` также получает credentials из Supabase Secrets и сама запрашивает OAuth-токен перед обращением к GigaChat.

Минимальный набор:

```text
GIGACHAT_AUTH_KEY=<ваш credentials>
GIGACHAT_SCOPE=GIGACHAT_API_PERS
GIGACHAT_MODEL=GigaChat-3-Ultra
```

Если модель не задана, функция использует значение по умолчанию, указанное в её коде.

## Безопасность

Никогда не добавляйте реальные значения секретов в этот файл.

Правильно:

```text
GIGACHAT_AUTH_KEY=<ваш секрет>
```

Неправильно:

```text
GIGACHAT_AUTH_KEY=реальный_секретный_ключ
```

Если секрет случайно попал в GitHub или публичный чат, его следует отозвать/перевыпустить в кабинете GigaChat и заменить в Supabase Secrets.

## Быстрая проверка

После сохранения Secrets:

1. Запустите тренировку в SaleTrening.
2. Отправьте несколько реплик менеджера.
3. Завершите тренировку.
4. Дождитесь AI-оценки.
5. Если ответ не приходит, смотрите **Supabase → Edge Functions → Logs** для `chat-client` и `evaluate-session`.

Ошибки `OAuth 401/403` обычно означают проблему с credentials, scope или доступом GigaChat.
Ошибки `GigaChat 4xx/5xx` означают проблему при обращении к API после успешной OAuth-авторизации.
