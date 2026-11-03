ALTER TABLE "stage_attempts" ADD COLUMN "provider" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "stage_attempts" ADD CONSTRAINT "stage_provider_check" CHECK ("stage_attempts"."provider" IN ('unknown','openai','fake'));
