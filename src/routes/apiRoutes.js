const express = require('express');
const { parse } = require('csv-parse/sync');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { makePurchaseEntry, deductStock, transferStock } = require('../services/stockService');

const router = express.Router();
router.use(requireAuth);

router.post('/products', requireRole('ADMIN'), (req, res) => {
  const { sku, name, unit, cost_price, selling_price, low_stock_threshold } = req.body;
  const result = db.prepare(
    `INSERT INTO Products (sku, name, unit, cost_price, selling_price, low_stock_threshold)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(sku, name, unit, cost_price, selling_price, low_stock_threshold || 0);
  res.json({ id: result.lastInsertRowid });
});

router.post('/products/import', requireRole('ADMIN'), (req, res) => {
  const { csv } = req.body;
  const records = parse(csv, { columns: true, skip_empty_lines: true, trim: true });
  const stmt = db.prepare(
    `INSERT INTO Products (sku, name, unit, cost_price, selling_price, low_stock_threshold)
     VALUES (@sku, @name, @unit, @cost_price, @selling_price, @low_stock_threshold)`
  );
  const tx = db.transaction((rows) => {
    for (const row of rows) {
      stmt.run({ ...row, low_stock_threshold: row.low_stock_threshold || 0 });
    }
  });
  tx(records);
  res.json({ inserted: records.length });
});

router.get('/products', (req, res) => {
  const isAdmin = req.session.user.role === 'ADMIN';
  const rows = db.prepare(
    `SELECT p.id, p.sku, p.name, p.unit, p.selling_price, p.low_stock_threshold,
            ${isAdmin ? 'p.cost_price' : 'NULL AS cost_price'},
            COALESCE(SUM(i.current_quantity),0) AS total_quantity
     FROM Products p
     LEFT JOIN InventoryStock i ON i.product_id = p.id
     GROUP BY p.id
     ORDER BY p.id DESC`
  ).all();
  res.json(rows);
});

router.get('/products/:id', (req, res) => {
  const isAdmin = req.session.user.role === 'ADMIN';
  const product = db.prepare(
    `SELECT id, sku, name, unit, selling_price, low_stock_threshold,
            ${isAdmin ? 'cost_price' : 'NULL AS cost_price'}
     FROM Products WHERE id = ?`
  ).get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const stock = db.prepare(
    `SELECT i.current_quantity, w.name AS warehouse_name, wl.label AS location_label
     FROM InventoryStock i
     JOIN Warehouses w ON w.id = i.warehouse_id
     JOIN WarehouseLocations wl ON wl.id = i.location_id
     WHERE i.product_id = ?`
  ).all(req.params.id);

  const barcodes = db.prepare('SELECT id, barcode_value, selling_price_snapshot, created_at FROM Barcodes WHERE product_id = ? ORDER BY id DESC').all(req.params.id);
  res.json({ product, stock, barcodes });
});

router.post('/warehouses', requireRole('ADMIN'), (req, res) => {
  const { name, code } = req.body;
  const result = db.prepare('INSERT INTO Warehouses (name, code) VALUES (?, ?)').run(name, code);
  res.json({ id: result.lastInsertRowid });
});

router.get('/warehouses', (req, res) => {
  const rows = db.prepare('SELECT * FROM Warehouses ORDER BY id DESC').all();
  res.json(rows);
});

router.post('/locations', requireRole('ADMIN'), (req, res) => {
  const { warehouse_id, rack, row_name, section, label } = req.body;
  const result = db.prepare(
    `INSERT INTO WarehouseLocations (warehouse_id, rack, row_name, section, label)
     VALUES (?, ?, ?, ?, ?)`
  ).run(warehouse_id, rack, row_name, section, label);
  res.json({ id: result.lastInsertRowid });
});

router.get('/locations', (req, res) => {
  const rows = db.prepare(
    `SELECT wl.*, w.name AS warehouse_name
     FROM WarehouseLocations wl
     JOIN Warehouses w ON w.id = wl.warehouse_id
     ORDER BY wl.id DESC`
  ).all();
  res.json(rows);
});

router.post('/purchase', requireRole('ADMIN', 'STAFF'), (req, res) => {
  try {
    const out = makePurchaseEntry({
      productId: Number(req.body.product_id),
      warehouseId: Number(req.body.warehouse_id),
      locationId: Number(req.body.location_id),
      quantity: Number(req.body.quantity),
      unitCost: Number(req.body.unit_cost),
      userId: req.session.user.id
    });
    res.json(out);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/stock/deduct', requireRole('ADMIN', 'STAFF'), (req, res) => {
  try {
    const out = deductStock({
      productId: Number(req.body.product_id),
      warehouseId: Number(req.body.warehouse_id),
      locationId: Number(req.body.location_id),
      quantity: Number(req.body.quantity),
      userId: req.session.user.id,
      notes: req.body.notes
    });
    res.json(out);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/stock/transfer', requireRole('ADMIN', 'STAFF'), (req, res) => {
  try {
    const out = transferStock({
      productId: Number(req.body.product_id),
      fromWarehouseId: Number(req.body.from_warehouse_id),
      fromLocationId: Number(req.body.from_location_id),
      toWarehouseId: Number(req.body.to_warehouse_id),
      toLocationId: Number(req.body.to_location_id),
      quantity: Number(req.body.quantity),
      userId: req.session.user.id,
      notes: req.body.notes
    });
    res.json(out);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/barcodes/:id/print', (req, res) => {
  const row = db.prepare(
    `SELECT b.*, p.name AS product_name, p.sku, w.name AS warehouse_name, wl.label AS location_label
     FROM Barcodes b
     JOIN Products p ON p.id = b.product_id
     JOIN Warehouses w ON w.id = b.warehouse_id
     JOIN WarehouseLocations wl ON wl.id = b.location_id
     WHERE b.id = ?`
  ).get(req.params.id);
  if (!row) return res.status(404).send('Barcode not found');

  res.send(`<!doctype html><html><body style="font-family:Arial;padding:24px">
    <h2>${row.product_name} (${row.sku})</h2>
    <p>${row.warehouse_name} / ${row.location_label}</p>
    <p>Price Snapshot: ₹${row.selling_price_snapshot}</p>
    <div>${row.svg}</div>
    <script>window.print()</script>
  </body></html>`);
});

router.post('/scan', requireRole('ADMIN', 'STAFF'), (req, res) => {
  const row = db.prepare(
    `SELECT b.id AS barcode_id, b.barcode_value, b.created_at,
            p.id AS product_id, p.name AS product_name, p.sku,
            w.id AS warehouse_id, w.name AS warehouse_name,
            wl.id AS location_id, wl.label AS location_label,
            COALESCE(i.current_quantity,0) AS current_quantity
     FROM Barcodes b
     JOIN Products p ON p.id = b.product_id
     JOIN Warehouses w ON w.id = b.warehouse_id
     JOIN WarehouseLocations wl ON wl.id = b.location_id
     LEFT JOIN InventoryStock i ON i.product_id = p.id AND i.warehouse_id = w.id AND i.location_id = wl.id
     WHERE b.barcode_value = ?`
  ).get(req.body.barcode_value);
  if (!row) return res.status(404).json({ error: 'Barcode not found' });
  res.json(row);
});

router.get('/movements', (req, res) => {
  const rows = db.prepare(
    `SELECT s.*, p.name AS product_name
     FROM StockMovementLog s
     JOIN Products p ON p.id = s.product_id
     ORDER BY s.id DESC LIMIT 200`
  ).all();
  res.json(rows);
});

router.get('/dashboard', (req, res) => {
  const totalSkus = db.prepare('SELECT COUNT(*) AS c FROM Products').get().c;
  const inventoryValue = db.prepare(
    `SELECT COALESCE(SUM(i.current_quantity * p.cost_price),0) AS v
     FROM InventoryStock i
     JOIN Products p ON p.id = i.product_id`
  ).get().v;
  const lowStockCount = db.prepare(
    `SELECT COUNT(*) AS c FROM (
      SELECT p.id, COALESCE(SUM(i.current_quantity),0) AS qty, p.low_stock_threshold
      FROM Products p
      LEFT JOIN InventoryStock i ON i.product_id = p.id
      GROUP BY p.id
      HAVING qty <= p.low_stock_threshold
    )`
  ).get().c;
  const activeWarehouses = db.prepare('SELECT COUNT(*) AS c FROM Warehouses WHERE is_active = 1').get().c;
  const warehouseDistribution = db.prepare(
    `SELECT w.id, w.name, COALESCE(SUM(i.current_quantity),0) AS qty,
      ROUND((COALESCE(SUM(i.current_quantity),0) * 100.0) / NULLIF((SELECT SUM(current_quantity) FROM InventoryStock), 0), 2) AS pct
     FROM Warehouses w
     LEFT JOIN InventoryStock i ON i.warehouse_id = w.id
     GROUP BY w.id`
  ).all();
  const lastPurchases = db.prepare(
    `SELECT pe.id, pe.quantity, pe.unit_cost, pe.created_at, p.name AS product_name
     FROM PurchaseEntryLog pe
     JOIN Products p ON p.id = pe.product_id
     ORDER BY pe.id DESC LIMIT 10`
  ).all();
  const lastMovements = db.prepare(
    `SELECT sm.id, sm.movement_type, sm.quantity, sm.created_at, p.name AS product_name
     FROM StockMovementLog sm
     JOIN Products p ON p.id = sm.product_id
     ORDER BY sm.id DESC LIMIT 10`
  ).all();

  res.json({ totalSkus, inventoryValue, lowStockCount, activeWarehouses, warehouseDistribution, lastPurchases, lastMovements });
});

router.get('/reports/low-stock', (req, res) => {
  const rows = db.prepare(
    `SELECT p.id, p.name, p.sku, p.low_stock_threshold, COALESCE(SUM(i.current_quantity),0) AS qty
     FROM Products p
     LEFT JOIN InventoryStock i ON i.product_id = p.id
     GROUP BY p.id
     HAVING qty <= p.low_stock_threshold
     ORDER BY qty ASC`
  ).all();
  res.json(rows);
});

module.exports = router;
