-- Separate optional phone number; `contact` now always holds an email for
-- leads from the website form, so every lead can get an instant reply.
ALTER TABLE leads ADD COLUMN phone TEXT;
