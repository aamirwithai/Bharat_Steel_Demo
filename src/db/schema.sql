PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS Users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'STAFF')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  cost_price REAL NOT NULL CHECK (cost_price >= 0),
  selling_price REAL NOT NULL CHECK (selling_price >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 0 CHECK (low_stock_threshold >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Warehouses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS WarehouseLocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  warehouse_id INTEGER NOT NULL,
  rack TEXT NOT NULL,
  row_name TEXT NOT NULL,
  section TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (warehouse_id, rack, row_name, section),
  FOREIGN KEY (warehouse_id) REFERENCES Warehouses(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS InventoryStock (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  warehouse_id INTEGER NOT NULL,
  location_id INTEGER NOT NULL,
  current_quantity INTEGER NOT NULL DEFAULT 0 CHECK (current_quantity >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (product_id, warehouse_id, location_id),
  FOREIGN KEY (product_id) REFERENCES Products(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (warehouse_id) REFERENCES Warehouses(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (location_id) REFERENCES WarehouseLocations(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS PurchaseEntryLog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  warehouse_id INTEGER NOT NULL,
  location_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost REAL NOT NULL CHECK (unit_cost >= 0),
  entered_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES Products(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (warehouse_id) REFERENCES Warehouses(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (location_id) REFERENCES WarehouseLocations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (entered_by) REFERENCES Users(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS Barcodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  warehouse_id INTEGER NOT NULL,
  location_id INTEGER NOT NULL,
  barcode_value TEXT NOT NULL UNIQUE,
  svg TEXT NOT NULL,
  selling_price_snapshot REAL NOT NULL CHECK (selling_price_snapshot >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES Products(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (warehouse_id) REFERENCES Warehouses(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (location_id) REFERENCES WarehouseLocations(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS StockMovementLog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  source_warehouse_id INTEGER,
  source_location_id INTEGER,
  destination_warehouse_id INTEGER,
  destination_location_id INTEGER,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('IN','OUT','TRANSFER')),
  reference_id INTEGER,
  moved_by INTEGER NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES Products(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (source_warehouse_id) REFERENCES Warehouses(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (source_location_id) REFERENCES WarehouseLocations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (destination_warehouse_id) REFERENCES Warehouses(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (destination_location_id) REFERENCES WarehouseLocations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (moved_by) REFERENCES Users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CHECK (
    (movement_type = 'IN' AND destination_warehouse_id IS NOT NULL AND destination_location_id IS NOT NULL) OR
    (movement_type = 'OUT' AND source_warehouse_id IS NOT NULL AND source_location_id IS NOT NULL) OR
    (movement_type = 'TRANSFER' AND source_warehouse_id IS NOT NULL AND source_location_id IS NOT NULL AND destination_warehouse_id IS NOT NULL AND destination_location_id IS NOT NULL)
  )
);
