# Bharat Steel — Local Perpetual Inventory System

## 1) Project Folder Structure

```
.
├── package.json
├── README.md
├── src
│   ├── server.js
│   ├── tests.js
│   ├── db
│   │   ├── index.js
│   │   └── schema.sql
│   ├── middleware
│   │   └── auth.js
│   ├── routes
│   │   ├── authRoutes.js
│   │   └── apiRoutes.js
│   └── services
│       ├── barcodeService.js
│       └── stockService.js
└── public
    ├── index.html
    ├── css/styles.css
    └── js/app.js
```

## 2) Tech
- Backend: Node.js + Express
- DB: SQLite (`better-sqlite3`)
- Frontend: Vanilla HTML/CSS/JS SPA
- Barcode: `bwip-js` SVG generation (local only)
- Auth: Session-based + bcrypt password hashing

## 3) Database Schema (DDL SQL)
Defined in `src/db/schema.sql` with required tables:
- Products
- Warehouses
- WarehouseLocations
- InventoryStock
- PurchaseEntryLog
- Barcodes
- StockMovementLog
- Users

All FK constraints are enabled (`PRAGMA foreign_keys = ON`) and stock actions are transaction-based.

## 4) API Routes
- Auth: `/auth/login`, `/auth/logout`, `/auth/session`
- Products: add, bulk import, list, detail
- Warehouses: add, list
- Locations: add, list
- Purchase entry, deduct stock, transfer stock
- Barcode print and barcode scan
- Dashboard, low-stock report, movement log

## 5) Role Logic
- Admin: all routes, can see `cost_price`
- Staff: purchase, scan, deduct, transfer, reports; cannot see `cost_price`

## 6) Installation Instructions
```bash
npm install
```

## 7) Run Instructions
```bash
npm run start
```
Open: `http://localhost:3000`

Default local users:
- admin / admin123
- staff / staff123

## 8) Internal Test Scenarios
```bash
npm test
```
The script validates:
- Add product
- Add warehouse
- Add location
- Purchase + automatic stock update
- Automatic barcode creation
- Barcode scan lookup
- Deduct stock
- Transfer stock
- Low-stock alert trigger
- Dashboard totals consistency
