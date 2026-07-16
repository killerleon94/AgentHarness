-- Add disabled field to workspace table for admin workspace management
ALTER TABLE workspace ADD COLUMN disabled BOOLEAN NOT NULL DEFAULT false;
