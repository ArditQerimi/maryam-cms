-- Demo shitje për tenant-in ArditiCompany (pos_tenant_arditi), që faqja Sales
-- të ketë të dhëna që në fillim. Idempotent: çdo statement injektohet vetëm nëse
-- reference-rëkoresponduese s'ekziston ende. Ruhet vetëm te DB-ja e tenantit
-- "arditi" (tenant-ët e tjerë nuk preken).
INSERT INTO product_variants (product_id, name, sku, price, cost_price, status)
SELECT p.id, p.name || ' Default', 'PRD-' || p.id || '-DEFAULT', p.price, p.cost_price, 'Active'
FROM products p
WHERE current_database() = 'pos_tenant_arditi'
  AND p.name IN (
    'Titulli: Nektari i Vulosur i Xhennetit',
    'Titulli: 101 këshilla për thirrësin',
    'Lidhja e Hoxhallarëve të Shqipërisë - Libri Besimtarë të Lindur',
    'Titulli: Kurani dhe kozmosi',
    'Historitë e Pejgamberëve në Kuran',
    'Titulli: Kurani dhe planeti Tokë',
    'Dhjami i gusës + vaji i farës së zezë',
    'VAJ I FARAVE TË KUNGULLIT',
    'Titulli: Koment i sures Neml'
  )
  AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id);
--> statement-breakpoint
-- Zbritja e stokut (vetëm për shitjet që s'ekzistojnë ende → idempotent).
-- Grupimi sipas produktit siguron që zbritjet e disa shitjeve bashkohen në një
-- UPDATE të vetëm (UPDATE...FROM zbaton vetë një rresht për çdo produkt).
UPDATE products p
SET stock_quantity = GREATEST(0, p.stock_quantity - agg.qty)
FROM (
  SELECT x.pname, sum(x.qty)::int AS qty
  FROM (VALUES
    ('Titulli: Nektari i Vulosur i Xhennetit', 2, 'SL1789101600001'),
    ('Titulli: 101 këshilla për thirrësin', 1, 'SL1789101600001'),
    ('Lidhja e Hoxhallarëve të Shqipërisë - Libri Besimtarë të Lindur', 1, 'SL1789293600002'),
    ('Titulli: Kurani dhe kozmosi', 2, 'SL1789293600002'),
    ('Historitë e Pejgamberëve në Kuran', 1, 'SL1789438200003'),
    ('Titulli: Kurani dhe planeti Tokë', 1, 'SL1789438200003'),
    ('Dhjami i gusës + vaji i farës së zezë', 3, 'SL1789654300004'),
    ('Titulli: 101 këshilla për thirrësin', 2, 'SL1789654300004'),
    ('VAJ I FARAVE TË KUNGULLIT', 1, 'SL1789771800005'),
    ('Titulli: Nektari i Vulosur i Xhennetit', 1, 'SL1789771800005'),
    ('Titulli: Koment i sures Neml', 2, 'SL1789876200006'),
    ('Titulli: Kurani dhe kozmosi', 1, 'SL1789876200006'),
    ('Titulli: Nektari i Vulosur i Xhennetit', 1, 'SL1790247300007'),
    ('Titulli: 101 këshilla për thirrësin', 1, 'SL1790247300007')
  ) AS x(pname, qty, ref)
  WHERE current_database() = 'pos_tenant_arditi'
    AND NOT EXISTS (SELECT 1 FROM sales s WHERE s.reference = x.ref)
  GROUP BY x.pname
) agg
WHERE p.name = agg.pname
  AND current_database() = 'pos_tenant_arditi';
--> statement-breakpoint
-- Shitjet demo:6 Completed + 1 Pending,5 POS + 2 Online, me zbritje e klientë realë.
INSERT INTO sales (customer_id, user_id, warehouse_id, reference, total_amount, discount, tax, grand_total, status, payment_method, is_online, created_at)
SELECT
  CASE WHEN v.cust IS NULL THEN NULL
       ELSE (SELECT c.id FROM customers c WHERE c.name = v.cust ORDER BY c.id LIMIT 1) END,
  (SELECT u.id FROM users u WHERE lower(u.email) = 'admin@arditi.com' ORDER BY u.id LIMIT 1),
  (SELECT w.id FROM warehouses w ORDER BY w.id LIMIT 1),
  v.ref, v.total, v.disc, v.tax, v.grand, v.st::sale_status, v.pay, v.online, v.at
FROM (VALUES
  (NULL::text, 'SL1789101600001', 38.00, 0.00, 0.00, 38.00, 'Completed', 'Cash', false, '2026-09-18 11:24:00'::timestamp),
  ('Ardit Krasniqi', 'SL1789293600002', 814.00, 14.00, 0.00, 800.00, 'Completed', 'Card', false, '2026-09-19 15:42:00'::timestamp),
  ('John Doe', 'SL1789438200003', 28.00, 0.00, 0.00, 28.00, 'Completed', 'Card', true, '2026-09-20 09:17:00'::timestamp),
  (NULL::text, 'SL1789654300004', 44.00, 4.00, 0.00, 40.00, 'Completed', 'Cash', false, '2026-09-21 18:05:00'::timestamp),
  ('Emma Wilson', 'SL1789771800005', 29.00, 0.00, 0.00, 29.00, 'Completed', 'Card', true, '2026-09-22 12:30:00'::timestamp),
  (NULL::text, 'SL1789876200006', 17.00, 0.00, 0.00, 17.00, 'Pending', 'Cash', false, '2026-09-23 17:50:00'::timestamp),
  (NULL::text, 'SL1790247300007', 24.00, 0.00, 0.00, 24.00, 'Completed', 'Cash', false, '2026-09-24 10:15:00'::timestamp)
) AS v(cust, ref, total, disc, tax, grand, st, pay, online, at)
WHERE current_database() = 'pos_tenant_arditi'
  AND EXISTS (SELECT 1 FROM products WHERE name = 'Titulli: Nektari i Vulosur i Xhennetit')
  AND NOT EXISTS (SELECT 1 FROM sales s WHERE s.reference = v.ref);
--> statement-breakpoint
-- Artikujt e shitjeve (idempotent për çdo rresht: sale + variant).
INSERT INTO sale_items (sale_id, variant_id, quantity, unit_price, subtotal)
SELECT s.id, pv.id, x.qty, x.price, x.qty * x.price
FROM (VALUES
  ('SL1789101600001', 'Titulli: Nektari i Vulosur i Xhennetit', 2, 14.00),
  ('SL1789101600001', 'Titulli: 101 këshilla për thirrësin', 1, 10.00),
  ('SL1789293600002', 'Lidhja e Hoxhallarëve të Shqipërisë - Libri Besimtarë të Lindur', 1, 800.00),
  ('SL1789293600002', 'Titulli: Kurani dhe kozmosi', 2, 7.00),
  ('SL1789438200003', 'Historitë e Pejgamberëve në Kuran', 1, 20.00),
  ('SL1789438200003', 'Titulli: Kurani dhe planeti Tokë', 1, 8.00),
  ('SL1789654300004', 'Dhjami i gusës + vaji i farës së zezë', 3, 8.00),
  ('SL1789654300004', 'Titulli: 101 këshilla për thirrësin', 2, 10.00),
  ('SL1789771800005', 'VAJ I FARAVE TË KUNGULLIT', 1, 15.00),
  ('SL1789771800005', 'Titulli: Nektari i Vulosur i Xhennetit', 1, 14.00),
  ('SL1789876200006', 'Titulli: Koment i sures Neml', 2, 5.00),
  ('SL1789876200006', 'Titulli: Kurani dhe kozmosi', 1, 7.00),
  ('SL1790247300007', 'Titulli: Nektari i Vulosur i Xhennetit', 1, 14.00),
  ('SL1790247300007', 'Titulli: 101 këshilla për thirrësin', 1, 10.00)
) AS x(ref, pname, qty, price)
JOIN sales s ON s.reference = x.ref
JOIN products p ON p.name = x.pname
JOIN product_variants pv ON pv.product_id = p.id
  AND pv.id = (SELECT min(v2.id) FROM product_variants v2 WHERE v2.product_id = p.id)
WHERE current_database() = 'pos_tenant_arditi'
  AND NOT EXISTS (
    SELECT 1 FROM sale_items si WHERE si.sale_id = s.id AND si.variant_id = pv.id
  );
