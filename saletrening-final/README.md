# SaleTrening Live
Эта версия подключена к Supabase проекту K2-trener.

Уже реализовано:
- Supabase Auth: регистрация/вход
- создание организации при регистрации
- роли: менеджер/руководитель/администратор
- реальные сценарии
- реальные training sessions
- сохранение transcript/messages
- голосовой ввод через браузер
- Edge Function evaluate-session
- session_scores
- командная аналитика и личный прогресс

AI:
Edge Function `evaluate-session` ожидает секрет `OPENAI_API_KEY` в Supabase. После добавления ключа кнопка завершения тренировки начнёт выполнять настоящий AI-анализ и сохранять оценку.

Важно: Supabase publishable key находится в index.html намеренно — publishable/anon ключ предназначен для клиентского приложения. Секреты AI в браузер не помещать.
