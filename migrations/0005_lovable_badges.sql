-- Lovable Vibe Coding badges: level synced from a public certificate URL
-- (LinkedIn / lovable.dev), with an email-confirmed fallback.

ALTER TABLE users ADD COLUMN lovable_level INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN lovable_badge_url TEXT;
ALTER TABLE users ADD COLUMN lovable_verified_via TEXT CHECK (lovable_verified_via IN ('url', 'email'));
ALTER TABLE users ADD COLUMN lovable_synced_at TEXT;

-- Each certificate URL can back only one account.
CREATE UNIQUE INDEX idx_users_lovable_badge_url ON users(lovable_badge_url) WHERE lovable_badge_url IS NOT NULL;

-- Pending confirmation codes for the email fallback flow.
CREATE TABLE lovable_email_claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_lovable_claims_user ON lovable_email_claims(user_id);
