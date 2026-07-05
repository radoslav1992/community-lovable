-- Public activity stats parsed from the Lovable profile page (JSON object:
-- followers, following, daysActive, streakDays, dailyAvg), shown on member
-- profiles alongside the edits-based rank.

ALTER TABLE users ADD COLUMN lovable_stats TEXT NOT NULL DEFAULT '{}';
