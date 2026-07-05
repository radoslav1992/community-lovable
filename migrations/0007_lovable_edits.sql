-- Yearly edit count parsed from the public Lovable profile's activity panel;
-- verified members are ranked by it (community leaderboard).

ALTER TABLE users ADD COLUMN lovable_edits INTEGER;
