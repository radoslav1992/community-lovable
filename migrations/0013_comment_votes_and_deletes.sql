-- Upvotes for comments + soft deletes so a deleted parent keeps its replies.
CREATE TABLE comment_votes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, comment_id)
);
CREATE INDEX idx_comment_votes_comment ON comment_votes(comment_id);

-- Set when the author (or a moderator) removes a comment that still has
-- replies: the row survives as a tombstone with an empty body.
ALTER TABLE comments ADD COLUMN deleted_at TEXT;
