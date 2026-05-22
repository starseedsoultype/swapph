# SwapPH — Полная техническая документация

SwapPH · Май 2026 · Внутренний документ

---

## 0. Главный приоритет

**Масштабируемость — приоритет №1.**  
Каждое техническое решение оценивается с точки зрения: выдержит ли это рост?  
Не усложнять ради усложнения, но не срезать углы там, где срезание создаст потолок.

---

## 1. Что это

Telegram Mini App для обмена, продажи и раздачи одежды на Ко Пангане.  
Пользователи публикуют объявления, нажимают "Want" на чужие, связываются через Telegram.

---

## 2. Стек

| Слой | Технология |
|---|---|
| Frontend | Vanilla HTML / CSS / JS, без фреймворков |
| Хостинг | GitHub Pages |
| Backend | Supabase (PostgreSQL, Edge Functions, Storage) |
| Auth | Telegram initData + HMAC-SHA256 + Supabase Auth |
| Бот | @alexakpg_BOT (display name: SWAPPH_BOT) |

**Ссылки:**
- Приложение: https://starseedsoultype.github.io/swapph
- GitHub: https://github.com/starseedsoultype/swapph
- Supabase project ID: `aoasoksilellqvkfwcal`
- Supabase URL: `https://aoasoksilellqvkfwcal.supabase.co`
- Mini App ссылка: `t.me/alexakpg_BOT/swapph`

---

## 3. Структура файлов

```
index.html          — лента объявлений (главная)
add.html            — форма добавления объявления
listing.html        — страница одного объявления
profile.html        — профиль пользователя

css/main.css        — переменные, layout, nav, desktop-заглушка
css/components.css  — карточки, бейджи, кнопки, формы, скелетоны
css/animations.css  — cardIn, shimmer, pulse, fadeIn

js/i18n.js          — переводы RU/EN, функции t() и setLang()
js/supabase.js      — Supabase client, все запросы к БД и Storage
js/app.js           — init, auth flow, сессия, общие функции
js/feed.js          — фильтры, рендер карточек, скелетон
js/listing.js       — карусель фото, кнопка Want, контакт
js/add.js           — выбор фото (FileReader), форма, submit
js/profile.js       — availability toggle, мои объявления по табам
```

**Важно:** `app.js` подключён на всех страницах и содержит все общие функции:
`setupNav`, `formatDate`, `formatMemberSince`, `showError`, `getFirstPhoto`, `getCategoryLabel`, `getListingTypeLabel`.

---

## 4. База данных

### Таблица `users`

```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
telegram_id   bigint UNIQUE NOT NULL
name          text NOT NULL
telegram_handle text
instagram     text
avatar_url    text
is_available  boolean DEFAULT true
created_at    timestamp DEFAULT now()
```

**КРИТИЧНО:** `users.id` должен равняться `auth.users.id` (UUID из Supabase Auth).  
Edge Function записывает `id = signInData.user.id`. Если этого не сделать — RLS на listings и wants перестаёт работать.

### Таблица `listings`

```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id       uuid REFERENCES users(id)
title         text NOT NULL
description   text
category      text   -- clothes, shoes, accessories, swimwear, kids, other
type          text   -- swap, sale, free
price         numeric
size          text   -- XS, S, M, L, XL, One size, Kids
condition     text   -- new, like_new, good, used
location      text
city          text DEFAULT 'phangan'
available_from  date
available_until date
language      text DEFAULT 'ru'
is_active     boolean DEFAULT true
created_at    timestamp DEFAULT now()
```

### Таблица `listing_photos`

```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
listing_id  uuid REFERENCES listings(id)
url         text
order_index int
```

### Поле `is_hidden` в `listings`

```sql
is_hidden  boolean DEFAULT false
```

Устанавливается через `swapph-admin` Edge Function. Скрытые объявления не показываются в ленте (`getListings` фильтрует `is_hidden = false`). Прямой URL листинга (`listing.html?id=...`) по-прежнему доступен.

### Таблица `wants`

```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
listing_id  uuid REFERENCES listings(id)
user_id     uuid REFERENCES users(id)
created_at  timestamp DEFAULT now()
```

---

## 5. RLS политики

Все таблицы имеют включённый RLS.

| Таблица | Операция | Условие |
|---|---|---|
| users | SELECT | authenticated, `true` |
| users | UPDATE | `id = auth.uid()` |
| listings | SELECT | authenticated, `true` |
| listings | INSERT | `user_id = auth.uid()` |
| listings | UPDATE | `user_id = auth.uid()` |
| listing_photos | SELECT | authenticated, `true` |
| listing_photos | INSERT | authenticated, `true` |
| wants | SELECT | authenticated, `true` |
| wants | INSERT | `user_id = auth.uid()` |

---

## 6. GRANT на таблицы

**Это самая частая причина падений.**

Если таблицы созданы через SQL (не через Supabase UI) — Supabase не добавляет GRANT автоматически. Нужно выполнить вручную:

```sql
GRANT SELECT, INSERT, UPDATE ON public.users TO service_role, authenticated;
GRANT SELECT ON public.users TO anon;

GRANT SELECT, INSERT, UPDATE ON public.listings TO authenticated;
GRANT SELECT ON public.listings TO anon;
GRANT SELECT ON public.listings TO service_role;

GRANT SELECT, INSERT ON public.listing_photos TO authenticated;
GRANT SELECT ON public.listing_photos TO anon;
GRANT SELECT ON public.listing_photos TO service_role;

GRANT SELECT, INSERT ON public.wants TO authenticated;
GRANT SELECT ON public.wants TO service_role;
```

Supabase UI при создании таблицы делает это автоматически. SQL migration — нет.

---

## 7. Storage

**Bucket:** `listing-photos` (public)

Политики на `storage.objects`:

```sql
-- Загрузка фото
CREATE POLICY "authenticated can upload photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'listing-photos');

-- Чтение фото
CREATE POLICY "anyone can read photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'listing-photos');

-- Удаление своих фото
CREATE POLICY "owner can delete photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'listing-photos');
```

---

## 8. Edge Function swapph-auth

**Путь:** `/functions/v1/swapph-auth`  
**verify_jwt:** `false` (обязательно — иначе Telegram не сможет войти)  
**Secret:** `SWAPPH_BOT_TOKEN` — токен бота @alexakpg_BOT

### Что делает (по шагам):

1. Валидирует Telegram `initData` через HMAC-SHA256 с `WebAppData` как ключ
2. Извлекает `telegramId`, `name`, `username` из `initData.user`
3. Строит детерминированный email: `tg_${telegramId}@swapph.app`
4. Строит детерминированный пароль: `HMAC(botToken, "swapph_user_${telegramId}")`
5. Пробует `signIn` через `/auth/v1/token?grant_type=password`
6. Если пользователь не существует — `createUser` через admin SDK, потом `signIn`
7. Берёт `authUserId = signInData.user.id`
8. Делает upsert в `public.users` с `id = authUserId` и `?on_conflict=telegram_id`
9. Возвращает `{ access_token, refresh_token, user_id }`

### Почему именно так:

- `auth.uid()` в RLS = UUID из `auth.users`
- `listings.user_id` = `currentUser.id` из `public.users`
- Чтобы `user_id = auth.uid()` работало — эти два UUID должны совпадать
- Поэтому Edge Function явно передаёт `id = signInData.user.id` при upsert

---

## 9. Auth flow на фронтенде (app.js)

```
1. Проверить localStorage ('swapph_session', TTL 24ч)
2. Если сессия есть и свежая:
   - setAccessToken(stored.access_token)
   - currentUser = await getUser(stored.user_id)
3. Если нет или истекла:
   - session = await authWithTelegram(tg.initData)
   - storeSession(session)
   - setAccessToken(session.access_token)
   - currentUser = await getUser(session.user_id)
4. При любой ошибке — clearSession() и повтор один раз
5. Авто-определение языка (если нет swapph_lang в localStorage):
   - Читаем tg.initDataUnsafe.user.language_code
   - Если не 'ru' → setLang('en')
   - Сохраняется в localStorage — применяется только при первом запуске
6. applyI18n() + onAppReady()
```

`onAppReady()` реализована отдельно в каждом page-JS файле.

---

## 10. Настройка Telegram Mini App

1. Создать бота через @BotFather — `/newbot`
2. Создать Mini App — `/newapp` → указать URL приложения
3. Настроить кнопку меню — `/setmenubutton` → URL → название (не `/empty`!)
4. Сохранить токен бота в Supabase Secrets как `SWAPPH_BOT_TOKEN`

**Прямая ссылка:** `t.me/alexakpg_BOT/swapph`  
**Кнопка меню видна только на мобильном Telegram** — на десктопе не отображается.

---

## 11. i18n система

**Файл:** `js/i18n.js`  
**Языки:** `ru` (по умолчанию), `en`  
**Хранение:** `localStorage('swapph_lang')`  
**Авто-определение:** при первом запуске из `tg.initDataUnsafe.user.language_code` (в `app.js`)  
**Переключатель:** кнопки RU/EN в header на `profile.html`

Все строки интерфейса вынесены в `translations.ru` и `translations.en`.  
Компоненты используют `t('ключ')` в JS и `data-i18n="ключ"` в HTML.  
`setLang(lang)` обновляет все `[data-i18n]` элементы без перезагрузки страницы.

**Тональность по языкам:**
- RU — практично, дружелюбно: «Вещи на Пангане», «Я на связи», «Добавить вещь»
- EN — community/reuse: «Pre-loved finds», «Giveaway», «I'm interested», «Browse»

---

## 12. Дизайн система

**Палитра:** песочный/кремовый фон, пыльно-розовые акценты, тёмный текст  
**Шрифты:** Cormorant Garamond (заголовки), Jost (основной текст)  
**Тема:** автоматически dark если Telegram в тёмной теме (`tg.colorScheme === 'dark'`)

---

## 13. Грабли которые мы прошли

### GRANT не добавляется автоматически при SQL-миграциях
Supabase UI при создании таблицы через интерфейс автоматически делает `GRANT ALL`. При создании через SQL — нет. Результат: `permission denied for table X`. Решение: всегда добавлять GRANT явно после создания таблицы через SQL.

### public.users.id ≠ auth.uid()
Если `users.id` генерируется как `gen_random_uuid()` и не передаётся явно в Edge Function — он не совпадает с auth UUID. RLS на listings и wants падает. Решение: Edge Function должна передавать `id = signInData.user.id` при upsert в users.

### setupNav в feed.js вместо app.js
`setupNav` была определена в `feed.js` — она была недоступна на страницах `add.html`, `profile.html`, `listing.html`. JS падал на старте, ничего не инициализировалось. Решение: все общие функции — только в `app.js`.

### URL.createObjectURL в Telegram WebView на iOS
`URL.createObjectURL(file)` иногда возвращает пустой src в Telegram WebView на iOS. Решение: использовать `FileReader` + `readAsDataURL`.

### tg.MainButton не всегда отображается
В некоторых версиях Telegram или на некоторых устройствах `tg.MainButton` не виден. Решение: добавить HTML-кнопку как fallback.

### verify_jwt = true на auth функции
Edge Function, которая принимает первый запрос от неавторизованного пользователя, должна иметь `verify_jwt = false`. Иначе запрос отклоняется до того как функция запустится.

---

## 14. Статус функций

### Реализовано
- `swapph-auth` v7 — авторизация через Telegram initData, стабильно
- `swapph-notify` v2 — уведомление владельцу при нажатии Want, `verify_jwt = true`
  - Получает: `{ ownerTelegramId, listingTitle, wanterName }`
  - Отправляет Telegram-сообщение: "👀 Имя хочет «Вещь»" + ссылка на приложение
  - Вызывается fire-and-forget через `Promise.allSettled` в listing.js
  - CORS OPTIONS handler добавлен
- `swapph-metrics` v5 — метрики для admin dashboard, `verify_jwt = false`, password-protected
  - Возвращает `is_hidden` в recent-листингах
  - Фильтрует `is_active=true` в recent (закрытые объявления не показываются)
- `swapph-admin` v1 — модерация, `verify_jwt = false`, password-protected
  - Принимает: `{ action: 'toggle_hide', listingId, password }`
  - Переключает `is_hidden` на листинге через service_role
- `swapph-bot` v2 — обработчик входящих сообщений, `verify_jwt = false`
  - Webhook зарегистрирован: `https://aoasoksilellqvkfwcal.supabase.co/functions/v1/swapph-bot`
  - Отвечает на любое сообщение (включая `/start`) одной короткой фразой
  - Текст и кнопка зависят от `language_code` пользователя:
    - RU: «Открой SwapPH, чтобы обменять, продать или отдать вещи на Пангане.» + кнопка «👗 Открыть SwapPH»
    - EN: «Open SwapPH to swap, sell, or give away pre-loved items on Koh Phangan.» + кнопка «👗 Open SwapPH»
  - **После деплоя нужно зарегистрировать webhook** (один раз):
    `https://api.telegram.org/botTOKEN/setWebhook?url=https://aoasoksilellqvkfwcal.supabase.co/functions/v1/swapph-bot`
- `admin.html` — браузерный дашборд с password gate, кнопка Hide/Show на каждом листинге
- `dashboard.html` — Telegram Mini App дашборд (только для AlexxaBreeze)
- Карусель фото, Want flow, контакт через Telegram
- i18n система: RU/EN переводы с авто-определением языка из Telegram, ручной переключатель на profile.html
- Индексы на всех ключевых полях (май 2026):
  ```sql
  listings(user_id), listings(created_at DESC), listings(city),
  listings(is_active), listing_photos(listing_id),
  wants(user_id), wants(listing_id)
  ```

### Ещё не реализовано
- Rollback listing при неудачной загрузке фото — orphan data риск
- Supabase migrations и Edge Functions в GitHub репозитории — организационный риск
- pg_cron для архивирования старых объявлений
- Пагинация в ленте — нужна при росте > 200 объявлений
- Thumbnail стратегия (WebP, 400px) — нужна при росте фотографий

---

## 15. Краткий чеклист для восстановления с нуля

- [ ] Создать Supabase проект
- [ ] Создать 4 таблицы (users, listings, listing_photos, wants)
- [ ] Добавить GRANT на все таблицы для service_role, authenticated, anon
- [ ] Включить RLS и добавить все политики
- [ ] Создать Storage bucket `listing-photos` с политиками
- [ ] Добавить Secret `SWAPPH_BOT_TOKEN` в Supabase
- [ ] Задеплоить Edge Function `swapph-auth` с `verify_jwt = false`
- [ ] Задеплоить Edge Function `swapph-notify` с `verify_jwt = true`
- [ ] Задеплоить Edge Function `swapph-admin` с `verify_jwt = false`
- [ ] Задеплоить Edge Function `swapph-bot` с `verify_jwt = false`
- [ ] Зарегистрировать webhook бота: открыть в браузере `https://api.telegram.org/botTOKEN/setWebhook?url=https://aoasoksilellqvkfwcal.supabase.co/functions/v1/swapph-bot`
- [ ] Создать GitHub репозиторий, включить GitHub Pages
- [ ] Зарегистрировать Mini App через BotFather `/newapp`
- [ ] Настроить menu button через BotFather `/setmenubutton`

---

SwapPH · Внутренняя документация · Не распространять публично
