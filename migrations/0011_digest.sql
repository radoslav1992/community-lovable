-- Per-user token for one-click newsletter unsubscribe links.
ALTER TABLE users ADD COLUMN digest_token TEXT;
UPDATE users SET digest_token = lower(hex(randomblob(16))) WHERE digest_token IS NULL;
