-- Language polish for the guides, lessons and news.
--
-- A pass over the published prose turned up a handful of places that read as
-- translated rather than written in Bulgarian: two outright mistranslations
-- („полица“ for policy, „на място“ for per seat), a few English calques
-- („сладката точка“, „потапя доставимостта“), one wrong closing quote and a
-- couple of missing commas. Everything else was left as it is.
--
-- Targeted REPLACE keeps the rest of each text byte-identical, and a phrase
-- that is already fixed simply does not match.

-- ---- lessons ----

-- „полицата на таблицата“ = the shelf of the table. It should have been the
-- table's RLS policies; as written the sentence pointed nowhere.
UPDATE lessons SET content = REPLACE(
  REPLACE(content, 'Провери резултата грубо:', 'Провери резултата набързо:'),
  'После погледни в Supabase → Table Editor → полицата на таблицата, че RLS е Enabled.',
  'После отвори Supabase → Table Editor и провери, че при таблицата пише RLS enabled.'
) WHERE slug = 'rls-s-prosti-dumi';

-- An emotion is described, not enumerated.
UPDATE lessons SET content = REPLACE(
  content,
  'Изброй емоцията чрез сравнение:',
  'Опиши емоцията чрез сравнение:'
) WHERE slug = 'promptove-za-dizayn';

-- „прекомерна вярност“ is a literal rendering of "excessive fidelity".
UPDATE lessons SET content = REPLACE(
  content,
  'Внимавай с прекомерната вярност: искаш „в духа на“, не копие.',
  'Внимавай да не копираш буквално: искаш „в духа на“, не копие.'
) WHERE slug = 'kontekst-i-referentsii';

UPDATE lessons SET content = REPLACE(
  content,
  'вероятно 70% верен и 30% не както си го представяше',
  'вероятно 70% такъв, какъвто си го представяше, и 30% различен'
) WHERE slug = 'parvi-proekt';

-- ---- articles ----

UPDATE articles SET content = REPLACE(
  REPLACE(content, 'раздел „Покажи”', 'раздел „Покажи“'),
  'автоматизацията на куриер идва, когато поръчките я оправдаят',
  'автоматичното подаване на пратки към куриер идва, когато поръчките го оправдаят'
) WHERE slug = 'kak-da-napravya-onlayn-magazin-s-lovable';

UPDATE articles SET content = REPLACE(
  REPLACE(content, 'Не изобретявай checkout.', 'Не си пиши собствен checkout.'),
  'и е безопасен за използване във фронтенда, за разлика от Admin API ключовете, които никога не давай на никого.',
  'и спокойно може да стои във фронтенда, за разлика от Admin API ключовете, които не давай на никого.'
) WHERE slug = 'kak-da-si-napravya-shopify-magazin-s-lovable';

-- „потапя доставимостта“ — deliverability is not submerged, it collapses.
UPDATE articles SET content = REPLACE(
  REPLACE(
    content,
    'Изпрати тестове до Gmail и Abv адрес и виж къде пристигат',
    'Изпрати тестове до адрес в Gmail и до адрес в abv.bg и виж къде пристигат'
  ),
  'потапя доставимостта на всичките ти писма',
  'срива доставимостта на всичките ти писма'
) WHERE slug = 'kak-da-izprashtam-imeyli-ot-lovable';

UPDATE articles SET content = REPLACE(
  content,
  'Строиш седмици без да покажеш на никого.',
  'Строиш седмици, без да покажеш на никого.'
) WHERE slug = '10-greshki-na-nachinaeshtiya';

UPDATE articles SET content = REPLACE(
  content,
  'останалото е промптове.',
  'останалото са промптове.'
) WHERE slug = 'kak-da-svarzha-baza-danni-kam-lovable-proekt';

UPDATE articles SET content = REPLACE(
  content,
  'Изброй изрично кое е публично и кое само за влезли — това е най-важното изречение в целия промпт.',
  'Кажи изрично кое е публично и кое — само за влезли. Това е най-важното изречение в целия промпт.'
) WHERE slug = 'kak-da-dobavya-vhod-i-registratsiya-v-lovable';

UPDATE articles SET content = REPLACE(
  content,
  'преди да чакаш сертификата',
  'преди да седнеш да чакаш сертификата'
) WHERE slug = 'kak-da-svarzhesh-bg-domeyn-kam-lovable-proekt';

-- ---- news ----

-- „сладката точка“ is sweet spot word for word; „плащате на място“ says you pay
-- on the premises, where the English meant per seat.
UPDATE news SET body = REPLACE(
  REPLACE(body, 'е сладката точка за повечето хора в общността', 'е златната среда за повечето хора в общността'),
  'плащате на място, а кредитите са общи',
  'плащате за всеки човек в екипа, а кредитите са общи'
) WHERE slug = 'obnoveni-tseni-i-kakvo-oznachavat-za-vas';

UPDATE news SET body = REPLACE(
  body,
  'признание, което досега се беше случвало едва на шепа проекти от региона',
  'признание, с което досега можеха да се похвалят едва шепа проекти от региона'
) WHERE slug = 'tri-balgarski-proekta-v-svetovnata-lovable-vitrina';
