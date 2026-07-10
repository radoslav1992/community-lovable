-- Remove the mocked demo content: seeded posts (with comments, votes,
-- reports) and seeded events (with RSVPs), plus the fictional member
-- accounts that existed only as their authors. Real users (anyone with a
-- password or OAuth identity) and the admin account are untouched.

DELETE FROM comments WHERE post_id IN (
  SELECT id FROM posts WHERE slug IN (
    'kak-svarzah-supabase-auth-kam-lovable-za-10-minuti',
    'spodelete-nay-dobrite-si-promptove-za-ui',
    'problem-s-deploy-kam-sobstven-bg-domeyn',
    'napravih-byudzheten-treker-za-semeystvoto-fiydbek',
    'lovable-stripe-priemane-na-plashtaniya-v-evro',
    'lovable-stripe-priemane-na-plashtaniya-v-leva',
    'koy-shte-idva-na-sreshtata-v-sofia-na-15-ti'
  )
);

DELETE FROM votes WHERE post_id IN (
  SELECT id FROM posts WHERE slug IN (
    'kak-svarzah-supabase-auth-kam-lovable-za-10-minuti',
    'spodelete-nay-dobrite-si-promptove-za-ui',
    'problem-s-deploy-kam-sobstven-bg-domeyn',
    'napravih-byudzheten-treker-za-semeystvoto-fiydbek',
    'lovable-stripe-priemane-na-plashtaniya-v-evro',
    'lovable-stripe-priemane-na-plashtaniya-v-leva',
    'koy-shte-idva-na-sreshtata-v-sofia-na-15-ti'
  )
);

DELETE FROM reports WHERE post_id IN (
  SELECT id FROM posts WHERE slug IN (
    'kak-svarzah-supabase-auth-kam-lovable-za-10-minuti',
    'spodelete-nay-dobrite-si-promptove-za-ui',
    'problem-s-deploy-kam-sobstven-bg-domeyn',
    'napravih-byudzheten-treker-za-semeystvoto-fiydbek',
    'lovable-stripe-priemane-na-plashtaniya-v-evro',
    'lovable-stripe-priemane-na-plashtaniya-v-leva',
    'koy-shte-idva-na-sreshtata-v-sofia-na-15-ti'
  )
) OR title IN (
  'Продавам курс за Lovable — 50% отстъпка само днес!!!',
  'Re: Проблем с deploy — обиден коментар'
);

DELETE FROM posts WHERE slug IN (
  'kak-svarzah-supabase-auth-kam-lovable-za-10-minuti',
  'spodelete-nay-dobrite-si-promptove-za-ui',
  'problem-s-deploy-kam-sobstven-bg-domeyn',
  'napravih-byudzheten-treker-za-semeystvoto-fiydbek',
  'lovable-stripe-priemane-na-plashtaniya-v-evro',
  'lovable-stripe-priemane-na-plashtaniya-v-leva',
  'koy-shte-idva-na-sreshtata-v-sofia-na-15-ti'
);

DELETE FROM rsvps WHERE event_id IN (
  SELECT id FROM events WHERE slug IN (
    'lovable-meetup-sofia-yuli-2026',
    'workshop-ot-ideya-do-mvp-za-edin-uikend',
    'lovable-hakaton-plovdiv-2026'
  )
);

DELETE FROM events WHERE slug IN (
  'lovable-meetup-sofia-yuli-2026',
  'workshop-ot-ideya-do-mvp-za-edin-uikend',
  'lovable-hakaton-plovdiv-2026'
);

-- Fictional members: only the exact seeded emails, and only while they
-- remain login-incapable (no password, no OAuth) with no content left.
DELETE FROM sessions WHERE user_id IN (
  SELECT id FROM users WHERE email IN (
    'georgi.petrov@gmail.com', 'iva.st@abv.bg', 'skolev@mail.bg',
    'd.ganev@outlook.com', 'elena.todorova@example.bg'
  ) AND password_hash IS NULL AND oauth_provider IS NULL
);

DELETE FROM users WHERE email IN (
  'georgi.petrov@gmail.com', 'iva.st@abv.bg', 'skolev@mail.bg',
  'd.ganev@outlook.com', 'elena.todorova@example.bg'
)
AND password_hash IS NULL AND oauth_provider IS NULL
AND id NOT IN (SELECT user_id FROM posts)
AND id NOT IN (SELECT user_id FROM comments);
