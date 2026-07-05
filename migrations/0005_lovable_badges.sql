-- Lovable profile badges: members link their public lovable.dev/@username
-- profile, prove ownership with a one-time code placed in the profile bio,
-- and their public Lovable badges (e.g. "Top 10% of Lovable users") sync
-- automatically.

ALTER TABLE users ADD COLUMN lovable_profile_url TEXT;
ALTER TABLE users ADD COLUMN lovable_username TEXT;
ALTER TABLE users ADD COLUMN lovable_top_percent INTEGER;
ALTER TABLE users ADD COLUMN lovable_badges TEXT NOT NULL DEFAULT '[]';
ALTER TABLE users ADD COLUMN lovable_synced_at TEXT;

-- Each Lovable profile can back only one account.
CREATE UNIQUE INDEX idx_users_lovable_profile ON users(lovable_profile_url) WHERE lovable_profile_url IS NOT NULL;

-- Pending ownership claims: the member puts the code in their Lovable bio,
-- then we fetch the profile and look for it.
CREATE TABLE lovable_profile_claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  profile_url TEXT NOT NULL,
  username TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
