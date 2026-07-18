-- Add slug column to clubs and populate from existing names
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS slug TEXT;

-- Generate slug from name: lowercase, replace spaces/special chars with hyphens
UPDATE clubs SET slug = regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')
WHERE slug IS NULL;

-- Make slug unique and not null going forward
CREATE UNIQUE INDEX IF NOT EXISTS clubs_slug_idx ON clubs (slug);
