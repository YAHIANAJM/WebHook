-- Trigger Function
CREATE OR REPLACE FUNCTION notify_table_changes()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'table_changes',
    json_build_object(
      'operation', TG_OP,
      'table', TG_TABLE_NAME,
      'data', row_to_json(NEW),
      'old_data', row_to_json(OLD)
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Webhooks Table
CREATE TABLE IF NOT EXISTS webhooks (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  events TEXT[],
  table_name TEXT,
  target_column TEXT,
  active BOOLEAN DEFAULT true
);

-- Internal Webhook Listeners (The "Bin")
CREATE TABLE IF NOT EXISTS webhook_listeners (
  id SERIAL PRIMARY KEY,
  uuid TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Logs for Internal Listeners
CREATE TABLE IF NOT EXISTS listener_logs (
  id SERIAL PRIMARY KEY,
  listener_id INTEGER REFERENCES webhook_listeners(id) ON DELETE CASCADE,
  method TEXT,
  headers JSONB,
  body JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Test Webhook Table
CREATE TABLE IF NOT EXISTS test_webhook (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger for test_webhook (Fires on INSERT, DELETE, or UPDATE of "name" column)
DROP TRIGGER IF EXISTS test_webhook_trigger ON test_webhook;
CREATE TRIGGER test_webhook_trigger
AFTER INSERT OR DELETE OR UPDATE OF name ON test_webhook
FOR EACH ROW
EXECUTE FUNCTION notify_table_changes();
