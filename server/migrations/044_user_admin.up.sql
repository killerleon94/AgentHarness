-- Add role and disabled fields to user table for admin user management
ALTER TABLE "user" ADD COLUMN role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user'));
ALTER TABLE "user" ADD COLUMN disabled BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_user_role ON "user"(role);
