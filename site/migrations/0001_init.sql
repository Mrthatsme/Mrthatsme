-- Minutes Regained CRM — leads, contracts, clients, payments
-- Extends the "simple, auditable, DB-backed" approach of the prototype mock_crm.py,
-- implemented in D1/SQL because the live site runs on Cloudflare Workers.

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  business TEXT NOT NULL,
  contact TEXT NOT NULL,
  contact_window TEXT,
  pain TEXT,
  source TEXT NOT NULL DEFAULT 'minutesregained.com',
  status TEXT NOT NULL DEFAULT 'new',          -- new | contacted | assessed | converted | lost
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  lead_id TEXT REFERENCES leads(id),
  plan_id TEXT NOT NULL,                        -- essential | business_support | operations_plus
  plan_label TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  founding_offer INTEGER NOT NULL DEFAULT 0,     -- 1 if the founding-client price was applied
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  business_name TEXT NOT NULL,
  agreed_at TEXT NOT NULL,
  agreement_ip TEXT,
  agreement_user_agent TEXT,
  contract_version TEXT NOT NULL,                -- version id of the agreement text shown
  contract_text_hash TEXT NOT NULL,               -- sha256 of the exact text agreed to
  status TEXT NOT NULL DEFAULT 'pending_payment', -- pending_payment | active | canceled
  stripe_checkout_session_id TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  contract_id TEXT REFERENCES contracts(id),
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',          -- active | paused | canceled
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES clients(id),
  contract_id TEXT REFERENCES contracts(id),
  stripe_event_id TEXT UNIQUE,
  stripe_invoice_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL,                           -- paid | failed | refunded
  occurred_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contracts_lead ON contracts(lead_id);
CREATE INDEX IF NOT EXISTS idx_clients_contract ON clients(contract_id);
CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);
