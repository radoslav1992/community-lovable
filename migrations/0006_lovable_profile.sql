-- Pivot from the sunset Vibe Coding levels (0005) to Lovable profile linking:
-- members claim lovable.dev/@username, prove ownership with a one-time code
-- in the profile bio, and public badges ("Top N% of Lovable users") sync
-- automatically. The 0005 columns lovable_level / lovable_badge_url /
-- lovable_verified_via are retired and left in place unused;
-- lovable_synced_at is reused.

ALTER TABLE users ADD COLUMN lovable_profile_url TEXT;
ALTER TABLE users ADD COLUMN lovable_username TEXT;
ALTER TABLE users ADD COLUMN lovable_top_percent INTEGER;
ALTER TABLE users ADD COLUMN lovable_badges TEXT NOT NULL DEFAULT '[]';

-- Each Lovable profile can back only one account.
CREATE UNIQUE INDEX idx_users_lovable_profile ON users(lovable_profile_url) WHERE lovable_profile_url IS NOT NULL;
DROP INDEX IF EXISTS idx_users_lovable_badge_url;

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

DROP TABLE IF EXISTS lovable_email_claims;
