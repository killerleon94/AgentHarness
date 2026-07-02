-- Remove role and disabled fields from user table
DROP INDEX IF EXISTS idx_user_role;
ALTER TABLE "user" DROP COLUMN role;
ALTER TABLE "user" DROP COLUMN disabled;
