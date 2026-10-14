-- 'monthly' (30 days' notice) or 'retainer' (12 months, 10% off).
ALTER TABLE contracts ADD COLUMN billing TEXT NOT NULL DEFAULT 'monthly';
