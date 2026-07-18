# Българска Lovable Общност · communitylovable.bg

Общностен сайт на българските Lovable билдъри — емисия с дискусии, събития,
новини, обучение, профили и админ панел. Построен за максимална скорост и SEO:
всичко се рендерира на ръба (edge) в Cloudflare Worker, данните живеят в
Cloudflare D1.

## Стек

- **[Astro 5](https://astro.build)** — server-side rendering, нулев JavaScript
  по подразбиране (само ~1 KB progressive enhancement за гласуването)
- **[Cloudflare Workers](https://developers.cloudflare.com/workers/)** — целият
  сайт е един Worker (`@astrojs/cloudflare` адаптер)
- **[Cloudflare D1](https://developers.cloudflare.com/d1/)** — SQLite база на
  ръба: потребители, публикации, коментари, гласове, събития, новини, доклади
- **Сесии с HttpOnly бисквитки** + PBKDF2 (Web Crypto) за паролите — без външни
  зависимости

## SEO

- Пълен SSR — съдържанието е в HTML-а, не се дорендерира с JS
- Канонични URL-и с транслитерирани slug-ове (`/t/kak-svarzah-supabase-auth…`)
- JSON-LD структурирани данни: `DiscussionForumPosting` + `Comment` за темите,
  `Event` за събитията, `NewsArticle`, `Course`, `WebSite` + `SearchAction`
- `sitemap-index.xml` + разделени sitemap-и за всички теми, `rss.xml`,
  `robots.txt`, Open Graph и
  Twitter карти, `lang="bg"` / `og:locale=bg_BG`
- Edge кеширане за гости (`s-maxage=60, stale-while-revalidate`), шрифтът се
  preload-ва, всички изображения са оптимизирани

## Локална разработка

```bash
npm install
npm run db:migrate:local   # създава локална D1 (schema + seed съдържание)
npm run preview            # build + wrangler dev на http://localhost:8787
# или: npm run dev         # astro dev с локален D1 proxy
```

## Деплой в Cloudflare

1. Създай D1 базата и вземи нейното ID:

   ```bash
   npx wrangler d1 create community_lovable
   ```

2. Постави върнатото `database_id` в `wrangler.jsonc`.

3. Приложи миграциите към продукционната база:

   ```bash
   npm run db:migrate:remote
   ```

4. Деплой:

   ```bash
   npm run deploy
   ```

5. (По избор) Вържи домейна `communitylovable.bg` от Cloudflare dashboard →
   Workers → Custom Domains.

### След първия деплой — ВАЖНО

Seed данните създават демо администратор:

- **Имейл:** `maria@example.bg`
- **Парола:** `lovable2026`

Влез, смени имейла и паролата (или си направи нов профил и си дай `admin` роля
през D1 конзолата), защото демо данните са публични в това repo:

```bash
npx wrangler d1 execute community_lovable --remote \
  --command "UPDATE users SET role='admin' WHERE email='твоят@имейл.bg'"
```

## Структура

```
migrations/        D1 схема + seed съдържание от дизайна
public/            шрифт Camera Plain, лога, favicon, robots.txt
src/
  layouts/Base.astro     SEO meta, OG, JSON-LD, кеш заглавки
  components/            Header (навигация, търсене, меню), Footer, PostCard
  lib/                   auth (PBKDF2 + сесии), slug (транслитерация),
                         format (дати на български, тагове, аватари)
  middleware.ts          зарежда потребителя от сесийната бисквитка
  pages/                 / (емисия), /t/[slug] (тема), /sabitiya, /novini,
                         /obuchenie, /vhod, /profil, /nastroyki, /admin,
                         /tarsene, sitemap-index.xml, sitemap.xml, sitemap-posts, rss.xml, 404
  pages/api/             auth, posts, comments, vote, rsvp, settings,
                         account/delete, admin/block, admin/report
```

## Функционалност

- **Емисия** — филтри по категория, композер за нови публикации, гласуване
  (работи и без JavaScript), брояч на членове/теми/онлайн, следващо събитие
- **Теми** — коментари, отговори, гласуване, structured data
- **Събития** — „Ще дойда“ RSVP с брояч
- **Вход/регистрация** — имейл + парола; OAuth бутоните са placeholder („скоро“)
- **Профил** — статистика (публикации, коментари, точки) и последна активност
- **Настройки** — профил, известия (toggle-и), изтриване на акаунт с
  анонимизация на съдържанието
- **Lovable значки и класация** — членовете свързват публичния си Lovable
  профил (`lovable.dev/@потребител`); собствеността се доказва автоматично с
  еднократен код, поставен в биото на профила (без админ одобрение).
  Редакциите за последната година се разчитат от публичната страница при
  потвърждение и се ресинхронизират на всеки 7 дни; потвърдените членове се
  подреждат в класация (`/klasatsiya`) и носят значка „Lovable №X“ до името
  си. Всеки Lovable профил може да се свърже само с един акаунт
- **Админ панел** — блокиране на потребители, преглед на докладвано съдържание
  (одобри / скрий поста)
