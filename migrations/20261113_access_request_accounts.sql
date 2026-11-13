ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash text;

ALTER TABLE access_requests
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS created_user_id integer REFERENCES users(id);

