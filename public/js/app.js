const app = document.getElementById('app');
const nav = document.getElementById('nav');
const sessionBox = document.getElementById('sessionBox');
let sessionUser = null;

const routes = ['login','dashboard','products','warehouses','locations','purchase','transfer','scan','reports'];

const api = async (url, options = {}) => {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) throw new Error(data.error || data || 'Request failed');
  return data;
};

function renderNav() {
  const current = location.hash.replace('#/','') || 'login';
  nav.innerHTML = routes.map(r => `<a class="${current===r?'active':''}" href="#/${r}">${r.toUpperCase()}</a>`).join('');
  if (sessionUser) {
    sessionBox.innerHTML = `<small>${sessionUser.username} (${sessionUser.role})</small> <button style="width:auto" onclick="logout()">Logout</button>`;
  } else {
    sessionBox.innerHTML = '';
  }
}

async function loadSession() {
  try { sessionUser = await api('/auth/session'); } catch { sessionUser = null; }
}

async function logout() { await api('/auth/logout', { method:'POST' }); sessionUser = null; location.hash='#/login'; render(); }
window.logout = logout;

function form(fields, onSubmitText='Submit') {
  return `<form id="form">${fields}${`<button type="submit">${onSubmitText}</button>`}</form><p id="msg"></p>`;
}

function bindForm(handler) {
  document.getElementById('form').onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
      const out = await handler(data);
      document.getElementById('msg').innerText = `Success: ${JSON.stringify(out)}`;
      render();
    } catch (err) {
      document.getElementById('msg').innerText = err.message;
    }
  };
}

async function pageLogin() {
  app.innerHTML = `<div class="card"><h2>Login</h2>${form(`
      <label>Username</label><input name="username" required />
      <label>Password</label><input name="password" type="password" required />
    `,'Login')}</div>`;
  bindForm(async (d) => { sessionUser = await api('/auth/login', { method:'POST', body:JSON.stringify(d) }); location.hash='#/dashboard'; return sessionUser; });
}

async function pageDashboard() {
  const d = await api('/api/dashboard');
  app.innerHTML = `<div class="grid">
      <div class="card"><small>Total SKUs</small><div class="metric">${d.totalSkus}</div></div>
      <div class="card"><small>Total Inventory Value</small><div class="metric">₹${Number(d.inventoryValue).toFixed(2)}</div></div>
      <div class="card"><small>Low Stock Count</small><div class="metric">${d.lowStockCount}</div></div>
      <div class="card"><small>Active Warehouses</small><div class="metric">${d.activeWarehouses}</div></div>
    </div>
    <div class="card"><h3>Warehouse Stock Percentage</h3><table><tr><th>Warehouse</th><th>Qty</th><th>%</th></tr>${d.warehouseDistribution.map(w=>`<tr><td>${w.name}</td><td>${w.qty}</td><td>${w.pct||0}%</td></tr>`).join('')}</table></div>
    <div class="grid"><div class="card"><h3>Last 10 Purchases</h3><table>${d.lastPurchases.map(p=>`<tr><td>${p.product_name}</td><td>${p.quantity}</td><td>${p.created_at}</td></tr>`).join('')}</table></div>
    <div class="card"><h3>Last 10 Movements</h3><table>${d.lastMovements.map(m=>`<tr><td>${m.product_name}</td><td>${m.movement_type}</td><td>${m.quantity}</td></tr>`).join('')}</table></div></div>`;
}

async function pageProducts() {
  const rows = await api('/api/products');
  app.innerHTML = `<div class="card"><h2>Add Product (Admin)</h2>${form(`
    <label>SKU</label><input name="sku" required>
    <label>Name</label><input name="name" required>
    <label>Unit</label><input name="unit" required>
    <label>Cost Price</label><input name="cost_price" type="number" step="0.01" required>
    <label>Selling Price</label><input name="selling_price" type="number" step="0.01" required>
    <label>Low Stock Threshold</label><input name="low_stock_threshold" type="number" value="0" required>
  `)}</div>
  <div class="card"><h2>Bulk CSV Product Import (Admin)</h2>${form('<label>CSV (headers: sku,name,unit,cost_price,selling_price,low_stock_threshold)</label><textarea name="csv" rows="6" required></textarea>','Import CSV')}</div>
  <div class="card"><h2>Product Detail View</h2><label>Product ID</label><input id="productId"><button id="loadDetail">Load Detail</button><pre id="detail"></pre></div>
  <div class="card"><h2>Products</h2><table><tr><th>ID</th><th>SKU</th><th>Name</th><th>Qty</th><th>Selling</th><th>Cost</th></tr>${rows.map(r=>`<tr><td>${r.id}</td><td>${r.sku}</td><td>${r.name}</td><td>${r.total_quantity}</td><td>${r.selling_price}</td><td>${r.cost_price ?? '-'}</td></tr>`).join('')}</table></div>`;

  const forms = app.querySelectorAll('form');
  forms[0].onsubmit = async (e)=>{e.preventDefault(); await api('/api/products',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target).entries()))}); render();};
  forms[1].onsubmit = async (e)=>{e.preventDefault(); await api('/api/products/import',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target).entries()))}); render();};
  document.getElementById('loadDetail').onclick = async () => {
    const id = document.getElementById('productId').value;
    const d = await api(`/api/products/${id}`);
    document.getElementById('detail').innerText = JSON.stringify(d, null, 2);
  };
}

async function options() {
  const [products, warehouses, locations] = await Promise.all([api('/api/products'), api('/api/warehouses'), api('/api/locations')]);
  return { products, warehouses, locations };
}

async function pageWarehouses() {
  const rows = await api('/api/warehouses');
  app.innerHTML = `<div class="card"><h2>Add Warehouse (Admin)</h2>${form(`
    <label>Name</label><input name="name" required>
    <label>Code</label><input name="code" required>
  `)}</div>
  <div class="card"><table><tr><th>ID</th><th>Name</th><th>Code</th></tr>${rows.map(r=>`<tr><td>${r.id}</td><td>${r.name}</td><td>${r.code}</td></tr>`).join('')}</table></div>`;
  bindForm((d)=>api('/api/warehouses',{method:'POST',body:JSON.stringify(d)}));
}

async function pageLocations() {
  const wh = await api('/api/warehouses');
  const rows = await api('/api/locations');
  app.innerHTML = `<div class="card"><h2>Add Warehouse Location (Admin)</h2>${form(`
    <label>Warehouse</label><select name="warehouse_id">${wh.map(w=>`<option value="${w.id}">${w.name}</option>`).join('')}</select>
    <label>Rack</label><input name="rack" required>
    <label>Row</label><input name="row_name" required>
    <label>Section</label><input name="section" required>
    <label>Label</label><input name="label" required>
  `)}</div>
  <div class="card"><table><tr><th>WH</th><th>Rack</th><th>Row</th><th>Section</th><th>Label</th></tr>${rows.map(r=>`<tr><td>${r.warehouse_name}</td><td>${r.rack}</td><td>${r.row_name}</td><td>${r.section}</td><td>${r.label}</td></tr>`).join('')}</table></div>`;
  bindForm((d)=>api('/api/locations',{method:'POST',body:JSON.stringify(d)}));
}

async function pagePurchase() {
  const { products, warehouses, locations } = await options();
  app.innerHTML = `<div class="card"><h2>Purchase Entry</h2>${form(`
    <label>Product</label><select name="product_id">${products.map(p=>`<option value="${p.id}">${p.name}</option>`)}</select>
    <label>Warehouse</label><select name="warehouse_id">${warehouses.map(w=>`<option value="${w.id}">${w.name}</option>`)}</select>
    <label>Location</label><select name="location_id">${locations.map(l=>`<option value="${l.id}">${l.warehouse_name} / ${l.label}</option>`)}</select>
    <label>Quantity</label><input name="quantity" type="number" required>
    <label>Unit Cost</label><input name="unit_cost" type="number" step="0.01" required>
  `,'Create Purchase')}</div>`;
  bindForm(async (d)=>{
    const out = await api('/api/purchase',{method:'POST',body:JSON.stringify(d)});
    if (out.barcodeId) window.open(`/api/barcodes/${out.barcodeId}/print`, '_blank');
    return out;
  });
}

async function pageTransfer() {
  const { products, warehouses, locations } = await options();
  app.innerHTML = `<div class="grid"><div class="card"><h2>Deduct Stock</h2>${form(`
    <label>Product</label><select name="product_id">${products.map(p=>`<option value="${p.id}">${p.name}</option>`)}</select>
    <label>Warehouse</label><select name="warehouse_id">${warehouses.map(w=>`<option value="${w.id}">${w.name}</option>`)}</select>
    <label>Location</label><select name="location_id">${locations.map(l=>`<option value="${l.id}">${l.warehouse_name} / ${l.label}</option>`)}</select>
    <label>Quantity</label><input name="quantity" type="number" required>
    <label>Notes</label><input name="notes">
  `,'Deduct')}</div>
  <div class="card"><h2>Transfer Stock</h2><form id="transferForm">
    <label>Product</label><select name="product_id">${products.map(p=>`<option value="${p.id}">${p.name}</option>`)}</select>
    <label>From Warehouse</label><select name="from_warehouse_id">${warehouses.map(w=>`<option value="${w.id}">${w.name}</option>`)}</select>
    <label>From Location</label><select name="from_location_id">${locations.map(l=>`<option value="${l.id}">${l.warehouse_name} / ${l.label}</option>`)}</select>
    <label>To Warehouse</label><select name="to_warehouse_id">${warehouses.map(w=>`<option value="${w.id}">${w.name}</option>`)}</select>
    <label>To Location</label><select name="to_location_id">${locations.map(l=>`<option value="${l.id}">${l.warehouse_name} / ${l.label}</option>`)}</select>
    <label>Quantity</label><input name="quantity" type="number" required>
    <label>Notes</label><input name="notes">
    <button type="submit">Transfer</button>
  </form><p id="transferMsg"></p></div></div>`;
  const forms = app.querySelectorAll('form');
  forms[0].onsubmit = async (e)=>{e.preventDefault(); await api('/api/stock/deduct',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target).entries()))}); render();};
  document.getElementById('transferForm').onsubmit = async (e)=>{
    e.preventDefault();
    try { const out = await api('/api/stock/transfer',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target).entries()))}); document.getElementById('transferMsg').innerText = JSON.stringify(out); render(); }
    catch (err) { document.getElementById('transferMsg').innerText = err.message; }
  };
}

async function pageScan() {
  app.innerHTML = `<div class="card"><h2>Barcode Scan Input</h2>${form(`
    <label>Barcode Value</label><input name="barcode_value" required>
  `,'Scan')}</div><pre id="scanOut"></pre>`;
  bindForm(async (d)=>{
    const out = await api('/api/scan',{method:'POST',body:JSON.stringify(d)});
    document.getElementById('scanOut').innerText = JSON.stringify(out, null, 2);
    return out;
  });
}

async function pageReports() {
  const low = await api('/api/reports/low-stock');
  const mov = await api('/api/movements');
  app.innerHTML = `<div class="card"><h2>Low Stock Alerts</h2><table><tr><th>SKU</th><th>Name</th><th>Qty</th><th>Threshold</th></tr>${low.map(r=>`<tr><td>${r.sku}</td><td>${r.name}</td><td>${r.qty}</td><td>${r.low_stock_threshold}</td></tr>`).join('')}</table></div>
  <div class="card"><h2>Stock Movement Logging</h2><table><tr><th>ID</th><th>Product</th><th>Type</th><th>Qty</th><th>Time</th></tr>${mov.slice(0,50).map(m=>`<tr><td>${m.id}</td><td>${m.product_name}</td><td>${m.movement_type}</td><td>${m.quantity}</td><td>${m.created_at}</td></tr>`).join('')}</table></div>`;
}

async function render() {
  await loadSession();
  renderNav();
  const route = location.hash.replace('#/','') || 'login';
  if (!sessionUser && route !== 'login') {
    location.hash = '#/login';
    return pageLogin();
  }
  if (route === 'login') return pageLogin();
  if (route === 'dashboard') return pageDashboard();
  if (route === 'products') return pageProducts();
  if (route === 'warehouses') return pageWarehouses();
  if (route === 'locations') return pageLocations();
  if (route === 'purchase') return pagePurchase();
  if (route === 'transfer') return pageTransfer();
  if (route === 'scan') return pageScan();
  if (route === 'reports') return pageReports();
}
window.addEventListener('hashchange', render);
render();
