ALTER TABLE stage_attempts ADD COLUMN provider text NOT NULL DEFAULT 'unknown' CHECK(provider IN ('unknown','openai','fake'));
