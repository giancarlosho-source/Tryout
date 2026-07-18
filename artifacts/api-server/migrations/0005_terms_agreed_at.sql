-- Record when a club owner agreed to Terms of Service and Privacy Policy at signup
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS terms_agreed_at TIMESTAMPTZ;
