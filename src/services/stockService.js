const { db } = require('../db');
const { buildBarcodeValue, generateBarcodeSvg } = require('./barcodeService');

const upsertInventory = (productId, warehouseId, locationId, quantityDelta) => {
  const existing = db
    .prepare('SELECT id, current_quantity FROM InventoryStock WHERE product_id = ? AND warehouse_id = ? AND location_id = ?')
    .get(productId, warehouseId, locationId);

  if (!existing) {
    if (quantityDelta < 0) throw new Error('Insufficient stock');
    db.prepare(
      'INSERT INTO InventoryStock (product_id, warehouse_id, location_id, current_quantity, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)'
    ).run(productId, warehouseId, locationId, quantityDelta);
    return;
  }

  const newQty = existing.current_quantity + quantityDelta;
  if (newQty < 0) throw new Error('Insufficient stock');
  db.prepare('UPDATE InventoryStock SET current_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQty, existing.id);
};

const makePurchaseEntry = db.transaction(({ productId, warehouseId, locationId, quantity, unitCost, userId }) => {
  const purchase = db.prepare(
    `INSERT INTO PurchaseEntryLog (product_id, warehouse_id, location_id, quantity, unit_cost, entered_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(productId, warehouseId, locationId, quantity, unitCost, userId);

  upsertInventory(productId, warehouseId, locationId, quantity);

  db.prepare(
    `INSERT INTO StockMovementLog (
      product_id, destination_warehouse_id, destination_location_id, quantity, movement_type, reference_id, moved_by, notes
    ) VALUES (?, ?, ?, ?, 'IN', ?, ?, ?)`
  ).run(productId, warehouseId, locationId, quantity, purchase.lastInsertRowid, userId, 'Purchase entry');

  const product = db.prepare('SELECT selling_price FROM Products WHERE id = ?').get(productId);
  const barcodeValue = buildBarcodeValue({ productId, warehouseId });
  const svg = generateBarcodeSvg(barcodeValue);

  const barcode = db.prepare(
    `INSERT INTO Barcodes (product_id, warehouse_id, location_id, barcode_value, svg, selling_price_snapshot)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(productId, warehouseId, locationId, barcodeValue, svg, product.selling_price);

  return { purchaseId: purchase.lastInsertRowid, barcodeId: barcode.lastInsertRowid, barcodeValue };
});

const deductStock = db.transaction(({ productId, warehouseId, locationId, quantity, userId, notes }) => {
  upsertInventory(productId, warehouseId, locationId, -quantity);

  const movement = db.prepare(
    `INSERT INTO StockMovementLog (
      product_id, source_warehouse_id, source_location_id, quantity, movement_type, moved_by, notes
    ) VALUES (?, ?, ?, ?, 'OUT', ?, ?)`
  ).run(productId, warehouseId, locationId, quantity, userId, notes || 'Stock deduction');

  return { movementId: movement.lastInsertRowid };
});

const transferStock = db.transaction(({ productId, fromWarehouseId, fromLocationId, toWarehouseId, toLocationId, quantity, userId, notes }) => {
  upsertInventory(productId, fromWarehouseId, fromLocationId, -quantity);
  upsertInventory(productId, toWarehouseId, toLocationId, quantity);

  const movement = db.prepare(
    `INSERT INTO StockMovementLog (
      product_id, source_warehouse_id, source_location_id, destination_warehouse_id, destination_location_id,
      quantity, movement_type, moved_by, notes
    ) VALUES (?, ?, ?, ?, ?, ?, 'TRANSFER', ?, ?)`
  ).run(productId, fromWarehouseId, fromLocationId, toWarehouseId, toLocationId, quantity, userId, notes || 'Stock transfer');

  return { movementId: movement.lastInsertRowid };
});

module.exports = { makePurchaseEntry, deductStock, transferStock };
