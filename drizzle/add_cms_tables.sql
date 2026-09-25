-- Maryam CMS additive migration.
-- SAFE TO RUN REPEATEDLY. Creates only new tables/columns; never drops or
-- alters existing point-of-sale tenant tables. Apply once per tenant database.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('maryam-cms:001_cms_tables:v1'));

-- ---------------------------------------------------------------------------
-- Shipping zones (not present in point-of-sale)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shipping_zones (
  id serial PRIMARY KEY,
  company_id integer NOT NULL,
  name varchar(255) NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shipping_zone_locations (
  id serial PRIMARY KEY,
  zone_id integer NOT NULL REFERENCES shipping_zones(id) ON DELETE CASCADE,
  type varchar(20) NOT NULL CHECK (type IN ('country', 'state')),
  code varchar(10) NOT NULL
);

CREATE INDEX IF NOT EXISTS shipping_zone_locations_zone_idx
  ON shipping_zone_locations (zone_id);

CREATE TABLE IF NOT EXISTS shipping_methods (
  id serial PRIMARY KEY,
  zone_id integer NOT NULL REFERENCES shipping_zones(id) ON DELETE CASCADE,
  type varchar(30) NOT NULL CHECK (type IN ('flat_rate', 'free_shipping', 'local_pickup')),
  title varchar(255) NOT NULL,
  cost numeric(10,2) NOT NULL DEFAULT 0,
  min_order_amount numeric(10,2) NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  instructions text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shipping_methods_zone_idx
  ON shipping_methods (zone_id);

-- ---------------------------------------------------------------------------
-- Order fulfilment
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_tracking (
  id serial PRIMARY KEY,
  order_id integer NOT NULL,
  tracking_number varchar(255),
  carrier varchar(255),
  tracking_url text,
  sent_at timestamp,
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS order_tracking_order_idx
  ON order_tracking (order_id);

CREATE TABLE IF NOT EXISTS order_notes (
  id serial PRIMARY KEY,
  order_id integer NOT NULL,
  body text NOT NULL,
  is_customer_note boolean NOT NULL DEFAULT false,
  created_by_user_id integer,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_notes_order_idx
  ON order_notes (order_id);

-- ---------------------------------------------------------------------------
-- Customer admin notes (internal only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_notes (
  id serial PRIMARY KEY,
  customer_id integer NOT NULL,
  body text NOT NULL,
  created_by_user_id integer,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_notes_customer_idx
  ON customer_notes (customer_id);

-- ---------------------------------------------------------------------------
-- CMS page builder payload
-- ---------------------------------------------------------------------------
ALTER TABLE cms_pages ADD COLUMN IF NOT EXISTS blocks jsonb DEFAULT '[]'::jsonb;
ALTER TABLE cms_pages ADD COLUMN IF NOT EXISTS page_type varchar(30) DEFAULT 'page';
ALTER TABLE cms_pages ADD COLUMN IF NOT EXISTS excerpt text;
ALTER TABLE cms_pages ADD COLUMN IF NOT EXISTS featured_image text;
ALTER TABLE cms_pages ADD COLUMN IF NOT EXISTS meta_title varchar(255);
ALTER TABLE cms_pages ADD COLUMN IF NOT EXISTS meta_description text;
ALTER TABLE cms_pages ADD COLUMN IF NOT EXISTS author_user_id integer;
ALTER TABLE cms_pages ADD COLUMN IF NOT EXISTS updated_by integer;

-- ---------------------------------------------------------------------------
-- Theme settings (active theme + customizer payload + nav menus + footer)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS theme_settings (
  id serial PRIMARY KEY,
  company_id integer NOT NULL,
  active_theme varchar(100) NOT NULL DEFAULT 'minimal',
  customizations jsonb NOT NULL DEFAULT '{}'::jsonb,
  nav_menu jsonb NOT NULL DEFAULT '[]'::jsonb,
  nav_menu_location varchar(50) NOT NULL DEFAULT 'primary',
  footer_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  widgets jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS theme_settings_company_idx
  ON theme_settings (company_id);

-- ---------------------------------------------------------------------------
-- Media library
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cms_media (
  id serial PRIMARY KEY,
  company_id integer NOT NULL,
  filename varchar(500) NOT NULL,
  original_name varchar(500),
  url text NOT NULL,
  public_id text,
  mime_type varchar(100),
  size_bytes integer,
  width integer,
  height integer,
  alt_text varchar(500),
  folder varchar(255) NOT NULL DEFAULT '/',
  uploaded_by integer,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cms_media_company_idx
  ON cms_media (company_id);

-- ---------------------------------------------------------------------------
-- Blog post extras (point-of-sale blog_posts has no excerpt/cover column)
-- ---------------------------------------------------------------------------
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS excerpt text;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS cover_image text;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS meta_title varchar(255);
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS meta_description text;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();

-- ---------------------------------------------------------------------------
-- Tax rates (WooCommerce style)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_rates (
  id serial PRIMARY KEY,
  country varchar(10) NOT NULL DEFAULT '',
  state varchar(10) NOT NULL DEFAULT '',
  postcode varchar(20) NOT NULL DEFAULT '',
  rate numeric(8,4) NOT NULL DEFAULT 0,
  name varchar(100) NOT NULL DEFAULT 'VAT',
  shipping boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp DEFAULT now()
);

COMMIT;
