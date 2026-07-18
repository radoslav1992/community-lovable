-- Allow threaded replies to comments.
ALTER TABLE comments ADD COLUMN parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE;
CREATE INDEX idx_comments_parent ON comments(parent_id);
