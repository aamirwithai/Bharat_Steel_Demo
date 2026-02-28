const fs = require('fs');
const path = require('path');

const dbFile = path.join(__dirname, '../data.sqlite');
if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);

const { initSchema, db } = require('./db');
const { makePurchaseEntry, deductStock, transferStock } = require('./services/stockService');

initSchema();

const admin = db.prepare("SELECT id FROM Users WHERE username='admin'").get();

db.prepare('INSERT INTO Products (sku,name,unit,cost_price,selling_price,low_stock_threshold) VALUES (?,?,?,?,?,?)')
  .run('SKU-1','TMT Bar 8mm','KG',50,65,20);
const product = db.prepare("SELECT * FROM Products WHERE sku='SKU-1'").get();

// Add Warehouse
const wh1 = db.prepare('INSERT INTO Warehouses (name,code) VALUES (?,?)').run('Warehouse A','WA').lastInsertRowid;
const wh2 = db.prepare('INSERT INTO Warehouses (name,code) VALUES (?,?)').run('Warehouse B','WB').lastInsertRowid;

// Create Location
const loc1 = db.prepare('INSERT INTO WarehouseLocations (warehouse_id,rack,row_name,section,label) VALUES (?,?,?,?,?)').run(wh1,'R1','ROW1','S1','A-R1-ROW1-S1').lastInsertRowid;
const loc2 = db.prepare('INSERT INTO WarehouseLocations (warehouse_id,rack,row_name,section,label) VALUES (?,?,?,?,?)').run(wh2,'R2','ROW2','S2','B-R2-ROW2-S2').lastInsertRowid;

// Make Purchase + Barcode
const purchase = makePurchaseEntry({ productId: product.id, warehouseId: wh1, locationId: loc1, quantity: 100, unitCost: 50, userId: admin.id });
if (!purchase.barcodeValue) throw new Error('Barcode not created');

// Scan Barcode
const scan = db.prepare('SELECT * FROM Barcodes WHERE barcode_value = ?').get(purchase.barcodeValue);
if (!scan) throw new Error('Scan failed');

// Deduct Stock
 deductStock({ productId: product.id, warehouseId: wh1, locationId: loc1, quantity: 30, userId: admin.id });

// Transfer Stock
transferStock({ productId: product.id, fromWarehouseId: wh1, fromLocationId: loc1, toWarehouseId: wh2, toLocationId: loc2, quantity: 60, userId: admin.id });

// Low Stock Trigger
const qtyLeft = db.prepare('SELECT current_quantity FROM InventoryStock WHERE product_id=? AND warehouse_id=? AND location_id=?').get(product.id, wh1, loc1).current_quantity;
if (qtyLeft > product.low_stock_threshold) throw new Error('Low stock not triggered');

// Dashboard total check
const value = db.prepare(`SELECT SUM(i.current_quantity * p.cost_price) AS v FROM InventoryStock i JOIN Products p ON p.id=i.product_id`).get().v;
const expectedQty = db.prepare('SELECT SUM(current_quantity) AS q FROM InventoryStock').get().q;
if (value !== expectedQty * product.cost_price) throw new Error('Dashboard value mismatch');

console.log('All validations passed');
