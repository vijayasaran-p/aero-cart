'use strict';
const express = require('express');
const crypto = require('crypto');
const catalyst = require('zcatalyst-sdk-node');

const app = express();
app.use(express.json());

// ─── UTILITY HELPERS ──────────────────────────────────────────────────────────

// Haversine formula – returns distance in km between two lat/lng points
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Cryptographic SHA-256 HMAC password hashing with application-level salt
function hashPassword(pwd) {
  const salt = 'aerocart_production_salt_sec_2026';
  return crypto.createHmac('sha256', salt).update(String(pwd)).digest('hex');
}

function sendError(res, status, message, tip = '') {
  return res.status(status).json({ status: 'error', message, tip });
}

// Safe ZCQL wrapper — returns [] instead of throwing on empty result
async function safeQuery(zcql, sql) {
  try {
    const result = await zcql.executeZCQLQuery(sql);
    return result || [];
  } catch(e) {
    console.error("ZCQL Query Failed:", sql, e.message);
    return [];
  }
}

// ─── HEALTH CHECK & SEEDING ───────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  try {
    catalyst.initialize(req);
    res.json({ status: 'success', message: 'AeroCart backend is online', timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

app.get('/api/test/seed', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const db = catalystApp.datastore();
    
    // Parse coordinates from query string
    const { lat, lng } = req.query;
    const baseLat = parseFloat(lat) || 11.104;
    const baseLng = parseFloat(lng) || 79.634;

    // Create Shop Owners
    const owner1 = await db.table('users').insertRow({
      Name: 'Karan Kumar', Email: 'karan@aerocart.com', Phone: '9876543201',
      Role: 'shop_owner', PasswordHash: hashPassword('admin123'), Lat: String(baseLat + 0.005), Lng: String(baseLng + 0.005), Address: 'Near Main Market (0.7km away)', CreatedAt: new Date().toISOString()
    });

    const owner2 = await db.table('users').insertRow({
      Name: 'Sanjay Sharma', Email: 'sanjay@aerocart.com', Phone: '9876543202',
      Role: 'shop_owner', PasswordHash: hashPassword('admin123'), Lat: String(baseLat - 0.008), Lng: String(baseLng - 0.008), Address: 'Dairy Circle (1.2km away)', CreatedAt: new Date().toISOString()
    });

    // Create Shops
    const shop1 = await db.table('shops').insertRow({
      OwnerUserId: String(owner1.ROWID), ShopName: 'Fresh Grocers', Category: 'grocery',
      Lat: String(baseLat + 0.005), Lng: String(baseLng + 0.005), Address: 'Main Road, Block A', IsOpen: 'true', Rating: '4.5', DeliveryTime: '15 mins', CreatedAt: new Date().toISOString()
    });

    const shop2 = await db.table('shops').insertRow({
      OwnerUserId: String(owner2.ROWID), ShopName: 'Dairy Fresh Hub', Category: 'dairy',
      Lat: String(baseLat - 0.008), Lng: String(baseLng - 0.008), Address: 'South Street corner', IsOpen: 'true', Rating: '4.7', DeliveryTime: '12 mins', CreatedAt: new Date().toISOString()
    });

    // Create Products for Shop 1
    await db.table('products').insertRow({ ShopId: String(shop1.ROWID), Name: 'Fresh Tomatoes', Description: 'Organic red tomatoes', Price: '40', Unit: 'kg', Category: 'grocery', Stock: '100', IsAvailable: 'true', CreatedAt: new Date().toISOString() });
    await db.table('products').insertRow({ ShopId: String(shop1.ROWID), Name: 'Basmati Rice', Description: 'Long grain aromatic rice', Price: '110', Unit: 'kg', Category: 'grocery', Stock: '50', IsAvailable: 'true', CreatedAt: new Date().toISOString() });
    await db.table('products').insertRow({ ShopId: String(shop1.ROWID), Name: 'Sunflower Oil', Description: 'Healthy cooking oil 1L', Price: '145', Unit: 'litre', Category: 'grocery', Stock: '80', IsAvailable: 'true', CreatedAt: new Date().toISOString() });

    // Create Products for Shop 2
    await db.table('products').insertRow({ ShopId: String(shop2.ROWID), Name: 'Full Cream Milk', Description: 'Fresh milk 500ml', Price: '28', Unit: 'packet', Category: 'dairy', Stock: '200', IsAvailable: 'true', CreatedAt: new Date().toISOString() });
    await db.table('products').insertRow({ ShopId: String(shop2.ROWID), Name: 'Salted Butter', Description: 'Delicious cooking butter 100g', Price: '52', Unit: 'piece', Category: 'dairy', Stock: '120', IsAvailable: 'true', CreatedAt: new Date().toISOString() });
    await db.table('products').insertRow({ ShopId: String(shop2.ROWID), Name: 'Fresh Paneer', Description: 'Soft cottage cheese 200g', Price: '90', Unit: 'piece', Category: 'dairy', Stock: '60', IsAvailable: 'true', CreatedAt: new Date().toISOString() });

    // Create Delivery Partners
    await db.table('users').insertRow({
      Name: 'Rahul Kumar (Rider)', Email: 'rahul@aerocart.com', Phone: '9998887701',
      Role: 'delivery_partner', PasswordHash: hashPassword('admin123'), Lat: String(baseLat + 0.002), Lng: String(baseLng + 0.002), Address: 'Rider Stand A (0.3km away)', CreatedAt: new Date().toISOString()
    });

    await db.table('users').insertRow({
      Name: 'Amit Singh (Rider)', Email: 'amit@aerocart.com', Phone: '9998887702',
      Role: 'delivery_partner', PasswordHash: hashPassword('admin123'), Lat: String(baseLat - 0.004), Lng: String(baseLng - 0.004), Address: 'Rider Stand B (0.6km away)', CreatedAt: new Date().toISOString()
    });

    res.json({ status: 'success', message: `Database successfully seeded with 2 shops, 6 products, and 2 delivery riders near coordinates: ${baseLat}, ${baseLng}! Password for all seeded accounts is: admin123` });
  } catch(e) {
    res.status(500).json({ status: 'error', message: 'Seeding failed: ' + e.message });
  }
});
app.get('/api/test/debug', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();

    const columnTests = {};
    const columns = ['ROWID', 'OwnerUserId', 'ShopName', 'Category', 'Lat', 'Lng', 'Address', 'IsOpen', 'Rating', 'DeliveryTime', 'ImageUrl'];
    
    for (const col of columns) {
      try {
        const r = await zcql.executeZCQLQuery(`SELECT ${col} FROM shops LIMIT 1`);
        columnTests[col] = 'SUCCESS';
      } catch(e) {
        columnTests[col] = 'FAILED: ' + e.message;
      }
    }

    let fullQueryRows = null;
    let fullQueryErr = null;
    try {
      fullQueryRows = await zcql.executeZCQLQuery("SELECT ROWID, OwnerUserId, ShopName, Category, Lat, Lng, Address, IsOpen, Rating, DeliveryTime, ImageUrl FROM shops");
    } catch(e) {
      fullQueryErr = e.message;
    }

    res.json({ status: 'success', columnTests, fullQueryRows, fullQueryErr });
  } catch(e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// ─── DIAGNOSTIC: DELIVERY PARTNER ORDER VISIBILITY ────────────────────────────
// Hit this with ?lat=YOUR_LAT&lng=YOUR_LNG to see exactly why orders pass/fail filter
app.get('/api/test/debug-delivery', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();
    const { lat, lng } = req.query;

    const riderLat = parseFloat(lat);
    const riderLng = parseFloat(lng);

    // Query all orders regardless of status to show the full picture
    let allOrderRows = [];
    let queryErr = null;
    try {
      allOrderRows = await zcql.executeZCQLQuery(
        `SELECT ROWID, Status, ShopLat, ShopLng, TotalAmount FROM orders LIMIT 50`
      );
    } catch(e) { queryErr = e.message; }

    const orderAnalysis = (allOrderRows || []).map(r => {
      const o = r.orders || r.Orders || r.ORDERS;
      const rawStatus = o.Status || o.status || 'UNKNOWN';
      const rawShopLat = o.ShopLat || o.shoplat || '';
      const rawShopLng = o.ShopLng || o.shoplng || '';
      const parsedShopLat = parseFloat(rawShopLat);
      const parsedShopLng = parseFloat(rawShopLng);

      let distKm = null;
      let distErr = null;
      if (!isNaN(riderLat) && !isNaN(riderLng) && !isNaN(parsedShopLat) && !isNaN(parsedShopLng)) {
        const R = 6371;
        const dLat = ((parsedShopLat - riderLat) * Math.PI) / 180;
        const dLng = ((parsedShopLng - riderLng) * Math.PI) / 180;
        const a = Math.sin(dLat/2)*Math.sin(dLat/2) +
          Math.cos((riderLat*Math.PI)/180)*Math.cos((parsedShopLat*Math.PI)/180)*
          Math.sin(dLng/2)*Math.sin(dLng/2);
        distKm = parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(2));
      } else {
        distErr = `riderLat=${riderLat} riderLng=${riderLng} shopLat="${rawShopLat}" shopLng="${rawShopLng}"`;
      }

      return {
        rowid: o.ROWID || o.rowid,
        status: rawStatus,
        isReadyForPickup: rawStatus === 'ready_for_pickup',
        shopLat_raw: rawShopLat,
        shopLng_raw: rawShopLng,
        shopLat_parsed: parsedShopLat,
        shopLng_parsed: parsedShopLng,
        distanceKm: distKm,
        distErr,
        passesFilter: rawStatus === 'ready_for_pickup' && distKm !== null && distKm <= 5000
      };
    });

    res.json({
      status: 'success',
      riderCoords: { lat: riderLat, lng: riderLng },
      queryErr,
      totalOrdersFound: orderAnalysis.length,
      readyForPickupCount: orderAnalysis.filter(o => o.isReadyForPickup).length,
      passingFilterCount: orderAnalysis.filter(o => o.passesFilter).length,
      orders: orderAnalysis
    });
  } catch(e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// ─── AUTH: REGISTER ───────────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const { name, email, phone, role, password, lat, lng, address } = req.body;

    if (!name || !email || !phone || !role || !password) {
      return sendError(res, 400, 'name, email, phone, role and password are required.');
    }
    if (!['customer', 'shop_owner', 'delivery_partner'].includes(role)) {
      return sendError(res, 400, 'role must be customer, shop_owner or delivery_partner.');
    }

    const zcql = catalystApp.zcql();
    // Check if email already exists
    const existing = await safeQuery(zcql, `SELECT ROWID FROM users WHERE Email = '${email}'`);
    if (existing.length > 0) {
      return sendError(res, 409, 'An account with this email already exists.');
    }
    // Check if phone already exists
    const existingPhone = await safeQuery(zcql, `SELECT ROWID FROM users WHERE Phone = '${phone}'`);
    if (existingPhone.length > 0) {
      return sendError(res, 409, 'An account with this phone number already exists.');
    }

    const table = catalystApp.datastore().table('users');
    const newUser = await table.insertRow({
      Name: name,
      Email: email.toLowerCase().trim(),
      Phone: phone.trim(),
      Role: role,
      PasswordHash: hashPassword(password),
      Lat: lat ? String(lat) : '',
      Lng: lng ? String(lng) : '',
      Address: address || '',
      CreatedAt: new Date().toISOString()
    });

    res.json({
      status: 'success',
      message: 'Account created successfully.',
      user: {
        id: newUser.ROWID,
        name: newUser.Name,
        email: newUser.Email,
        phone: newUser.Phone,
        role: newUser.Role,
        lat: newUser.Lat,
        lng: newUser.Lng,
        address: newUser.Address
      }
    });
  } catch (e) {
    sendError(res, 500, e.message);
  }
});

// ─── AUTH: LOGIN ──────────────────────────────────────────────────────────────
// Uses getAllRows() scan instead of ZCQL WHERE to avoid issues with special
// characters in email addresses (@ and .) breaking the WHERE clause.

app.post('/api/auth/login', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return sendError(res, 400, 'Email/phone and password are required.');
    }

    const id = identifier.trim().toLowerCase();
    const table = catalystApp.datastore().table('users');
    const allRows = await table.getAllRows();

    if (!allRows || allRows.length === 0) {
      return sendError(res, 401, 'No account found with this email or phone number.');
    }

    // Find matching user — column names may vary in case from Catalyst SDK
    const matched = allRows.find(r => {
      const email = (r.Email || r.email || '').toLowerCase();
      const phone = (r.Phone || r.phone || '').replace(/\s/g, '');
      return email === id || phone === id.replace(/\s/g, '');
    });

    if (!matched) {
      return sendError(res, 401, 'No account found with this email or phone number.');
    }

    // Support both capitalised and lowercase column names
    const storedHash = matched.PasswordHash || matched.passwordhash || matched.Passwordhash || '';
    if (storedHash !== hashPassword(password)) {
      return sendError(res, 401, 'Incorrect password. Please try again.');
    }

    res.json({
      status: 'success',
      message: 'Login successful.',
      user: {
        id:      matched.ROWID   || matched.rowid,
        name:    matched.Name    || matched.name    || '',
        email:   matched.Email   || matched.email   || '',
        phone:   matched.Phone   || matched.phone   || '',
        role:    matched.Role    || matched.role    || 'customer',
        lat:     matched.Lat     || matched.lat     || '',
        lng:     matched.Lng     || matched.lng     || '',
        address: matched.Address || matched.address || ''
      }
    });
  } catch (e) {
    sendError(res, 500, 'Login failed: ' + e.message);
  }
});

// ─── AUTH: UPDATE LOCATION ────────────────────────────────────────────────────

app.put('/api/auth/location', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const { userId, lat, lng, address } = req.body;
    if (!userId || !lat || !lng) return sendError(res, 400, 'userId, lat, lng required.');

    const table = catalystApp.datastore().table('users');
    await table.updateRow({ ROWID: userId, Lat: String(lat), Lng: String(lng), Address: address || '' });
    res.json({ status: 'success', message: 'Location updated.' });
  } catch (e) {
    sendError(res, 500, e.message);
  }
});

// ─── SHOPS: LIST (with distance) ──────────────────────────────────────────────

app.get('/api/shops', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const { lat, lng } = req.query;
    const zcql = catalystApp.zcql();

    const rows = await safeQuery(zcql, 
      `SELECT ROWID, OwnerUserId, ShopName, Category, Lat, Lng, Address, IsOpen, Rating, DeliveryTime, ImageUrl FROM shops`
    );

    if (!rows || rows.length === 0) return res.json({ status: 'success', data: [] });

    let shops = rows.map(r => {
      const s = r.shops || r.Shops || r.SHOPS;
      const obj = {
        id: s.ROWID,
        ownerUserId: s.OwnerUserId,
        shopName: s.ShopName,
        category: s.Category,
        lat: parseFloat(s.Lat) || 0,
        lng: parseFloat(s.Lng) || 0,
        address: s.Address,
        isOpen: s.IsOpen === 'true',
        rating: parseFloat(s.Rating) || 4.0,
        deliveryTime: s.DeliveryTime || '15-20 mins',
        imageUrl: s.ImageUrl || ''
      };
      if (lat && lng) {
        obj.distanceKm = parseFloat(haversineKm(parseFloat(lat), parseFloat(lng), obj.lat, obj.lng).toFixed(1));
      }
      return obj;
    });

    if (lat && lng) shops.sort((a, b) => a.distanceKm - b.distanceKm);

    res.json({ status: 'success', data: shops });
  } catch (e) {
    sendError(res, 500, e.message);
  }
});

// ─── SHOPS: CREATE ────────────────────────────────────────────────────────────

app.post('/api/shops', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const { ownerUserId, shopName, category, lat, lng, address, deliveryTime } = req.body;
    if (!ownerUserId || !shopName || !category || !lat || !lng) {
      return sendError(res, 400, 'ownerUserId, shopName, category, lat, lng required.');
    }

    const table = catalystApp.datastore().table('shops');
    const row = await table.insertRow({
      OwnerUserId: String(ownerUserId),
      ShopName: shopName,
      Category: category,
      Lat: String(lat),
      Lng: String(lng),
      Address: address || '',
      IsOpen: 'true',
      Rating: '4.0',
      DeliveryTime: deliveryTime || '15-20 mins',
      ImageUrl: '',
      CreatedAt: new Date().toISOString()
    });

    res.json({ status: 'success', message: 'Shop created.', data: { id: row.ROWID, shopName: row.ShopName } });
  } catch (e) {
    sendError(res, 500, e.message);
  }
});

// ─── SHOPS: UPDATE ────────────────────────────────────────────────────────────

app.put('/api/shops/:id', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const { shopName, category, address, isOpen, deliveryTime } = req.body;
    const table = catalystApp.datastore().table('shops');
    const update = { ROWID: req.params.id };
    if (shopName) update.ShopName = shopName;
    if (category) update.Category = category;
    if (address) update.Address = address;
    if (isOpen !== undefined) update.IsOpen = String(isOpen);
    if (deliveryTime) update.DeliveryTime = deliveryTime;
    await table.updateRow(update);
    res.json({ status: 'success', message: 'Shop updated.' });
  } catch (e) {
    sendError(res, 500, e.message);
  }
});

// ─── SHOPS: GET MY SHOP ───────────────────────────────────────────────────────

app.get('/api/shops/my/:ownerId', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const rows = await safeQuery(catalystApp.zcql(), 
      `SELECT ROWID, ShopName, Category, Lat, Lng, Address, IsOpen, Rating, DeliveryTime FROM shops WHERE OwnerUserId = '${req.params.ownerId}'`
    );
    if (!rows || rows.length === 0) return res.json({ status: 'success', data: null });
    const s = rows[0].shops || rows[0].Shops || rows[0].SHOPS;
    res.json({ status: 'success', data: { id: s.ROWID || s.rowid, shopName: s.ShopName || s.shopname, category: s.Category || s.category, lat: s.Lat || s.lat, lng: s.Lng || s.lng, address: s.Address || s.address, isOpen: (s.IsOpen || s.isopen) === 'true', rating: s.Rating || s.rating, deliveryTime: s.DeliveryTime || s.deliverytime } });
  } catch (e) {
    sendError(res, 500, e.message);
  }
});

// ─── PRODUCTS: GET BY SHOP ────────────────────────────────────────────────────

app.get('/api/products', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const { shopId } = req.query;
    if (!shopId) return sendError(res, 400, 'shopId query param required.');

    const rows = await safeQuery(catalystApp.zcql(), 
      `SELECT ROWID, ShopId, Name, Description, Price, Unit, Category, Stock, ImageUrl, IsAvailable FROM products WHERE ShopId = '${shopId}'`
    );
    if (!rows || rows.length === 0) return res.json({ status: 'success', data: [] });

    const products = rows.map(r => {
      const p = r.products || r.Products || r.PRODUCTS;
      return {
        id: p.ROWID,
        shopId: p.ShopId,
        name: p.Name,
        description: p.Description,
        price: parseFloat(p.Price) || 0,
        unit: p.Unit,
        category: p.Category,
        stock: parseInt(p.Stock) || 0,
        imageUrl: p.ImageUrl || '',
        isAvailable: p.IsAvailable === 'true'
      };
    });
    res.json({ status: 'success', data: products });
  } catch (e) {
    sendError(res, 500, e.message);
  }
});

// ─── PRODUCTS: CREATE ─────────────────────────────────────────────────────────

app.post('/api/products', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const { shopId, name, description, price, unit, category, stock, imageUrl } = req.body;
    if (!shopId || !name || !price || !unit) {
      return sendError(res, 400, 'shopId, name, price, unit required.');
    }

    const table = catalystApp.datastore().table('products');
    const row = await table.insertRow({
      ShopId: String(shopId),
      Name: name,
      Description: description || '',
      Price: String(price),
      Unit: unit,
      Category: category || 'general',
      Stock: String(stock || 100),
      ImageUrl: imageUrl || '',
      IsAvailable: 'true',
      CreatedAt: new Date().toISOString()
    });
    res.json({ status: 'success', message: 'Product added.', data: { id: row.ROWID } });
  } catch (e) {
    sendError(res, 500, e.message);
  }
});

// ─── PRODUCTS: UPDATE ─────────────────────────────────────────────────────────

app.put('/api/products/:id', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const { name, description, price, unit, stock, isAvailable, imageUrl, category } = req.body;
    const table = catalystApp.datastore().table('products');
    const update = { ROWID: req.params.id };
    if (name) update.Name = name;
    if (description !== undefined) update.Description = description;
    if (price) update.Price = String(price);
    if (unit) update.Unit = unit;
    if (stock !== undefined) update.Stock = String(stock);
    if (isAvailable !== undefined) update.IsAvailable = String(isAvailable);
    if (imageUrl !== undefined) update.ImageUrl = imageUrl;
    if (category) update.Category = category;
    await table.updateRow(update);
    res.json({ status: 'success', message: 'Product updated.' });
  } catch (e) {
    sendError(res, 500, e.message);
  }
});

// ─── PRODUCTS: DELETE ─────────────────────────────────────────────────────────

app.delete('/api/products/:id', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    await catalystApp.datastore().table('products').deleteRow(req.params.id);
    res.json({ status: 'success', message: 'Product deleted.' });
  } catch (e) {
    sendError(res, 500, e.message);
  }
});

// ─── ORDERS: PLACE ORDER ──────────────────────────────────────────────────────

app.post('/api/orders', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const { customerId, shopId, items, totalAmount, customerLat, customerLng, shopLat, shopLng, deliveryAddress, notes } = req.body;
    if (!customerId || !shopId || !items || !totalAmount) {
      return sendError(res, 400, 'customerId, shopId, items, totalAmount required.');
    }

    const table = catalystApp.datastore().table('orders');
    const row = await table.insertRow({
      CustomerId: String(customerId),
      ShopId: String(shopId),
      DeliveryPartnerId: '',
      Items: typeof items === 'string' ? items : JSON.stringify(items),
      TotalAmount: String(totalAmount),
      Status: 'pending',
      PaymentMethod: 'cash_on_delivery',
      PaymentStatus: 'pending',
      CustomerLat: String(customerLat || ''),
      CustomerLng: String(customerLng || ''),
      ShopLat: String(shopLat || ''),
      ShopLng: String(shopLng || ''),
      DeliveryAddress: deliveryAddress || '',
      Notes: notes || '',
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString()
    });
    res.json({ status: 'success', message: 'Order placed successfully!', data: { orderId: row.ROWID } });
  } catch (e) {
    sendError(res, 500, e.message);
  }
});

// ─── ORDERS: CUSTOMER HISTORY ─────────────────────────────────────────────────

app.get('/api/orders/customer/:userId', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const rows = await safeQuery(catalystApp.zcql(), 
      `SELECT ROWID, ShopId, Items, TotalAmount, Status, PaymentMethod, DeliveryAddress, Notes, CreatedAt FROM orders WHERE CustomerId = '${req.params.userId}' ORDER BY CreatedAt DESC LIMIT 50`
    );
    if (!rows || rows.length === 0) return res.json({ status: 'success', data: [] });
    const orders = rows.map(r => {
      const o = r.orders || r.Orders || r.ORDERS;
      return { id: o.ROWID || o.rowid, shopId: o.ShopId || o.shopid, items: JSON.parse(o.Items || o.items || '[]'), totalAmount: parseFloat(o.TotalAmount || o.totalamount), status: o.Status || o.status, paymentMethod: o.PaymentMethod || o.paymentmethod, deliveryAddress: o.DeliveryAddress || o.deliveryaddress, notes: o.Notes || o.notes, createdAt: o.CreatedAt || o.createdat };
    });
    res.json({ status: 'success', data: orders });
  } catch (e) {
    sendError(res, 500, e.message);
  }
});

// ─── ORDERS: SHOP INCOMING ────────────────────────────────────────────────────

app.get('/api/orders/shop/:shopId', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const rows = await safeQuery(catalystApp.zcql(), 
      `SELECT ROWID, CustomerId, Items, TotalAmount, Status, DeliveryAddress, CustomerLat, CustomerLng, Notes, CreatedAt, DeliveryPartnerId FROM orders WHERE ShopId = '${req.params.shopId}' ORDER BY CreatedAt DESC LIMIT 100`
    );
    if (!rows || rows.length === 0) return res.json({ status: 'success', data: [] });
    const orders = rows.map(r => {
      const o = r.orders || r.Orders || r.ORDERS;
      return { id: o.ROWID || o.rowid, customerId: o.CustomerId || o.customerid, items: JSON.parse(o.Items || o.items || '[]'), totalAmount: parseFloat(o.TotalAmount || o.totalamount), status: o.Status || o.status, deliveryAddress: o.DeliveryAddress || o.deliveryaddress, customerLat: o.CustomerLat || o.customerlat, customerLng: o.CustomerLng || o.customerlng, notes: o.Notes || o.notes, createdAt: o.CreatedAt || o.createdat, deliveryPartnerId: o.DeliveryPartnerId || o.deliverypartnerid };
    });
    res.json({ status: 'success', data: orders });
  } catch (e) {
    sendError(res, 500, e.message);
  }
});

// ─── ORDERS: NEARBY (for delivery partner, ≤5km) ─────────────────────────────

app.get('/api/orders/nearby', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const { lat, lng } = req.query;
    if (!lat || !lng) return sendError(res, 400, 'lat and lng required.');

    const rows = await safeQuery(catalystApp.zcql(), 
      `SELECT ROWID, CustomerId, ShopId, Items, TotalAmount, Status, ShopLat, ShopLng, CustomerLat, CustomerLng, DeliveryAddress, Notes, CreatedAt FROM orders WHERE Status = 'accepted'`
    );
    if (!rows || rows.length === 0) return res.json({ status: 'success', data: [] });

    const nearby = rows
      .map(r => {
        const o = r.orders || r.Orders || r.ORDERS;
        const distToShop = haversineKm(parseFloat(lat), parseFloat(lng), parseFloat(o.ShopLat || o.shoplat) || 0, parseFloat(o.ShopLng || o.shoplng) || 0);
        return {
          id: o.ROWID || o.rowid,
          customerId: o.CustomerId || o.customerid,
          shopId: o.ShopId || o.shopid,
          items: JSON.parse(o.Items || o.items || '[]'),
          totalAmount: parseFloat(o.TotalAmount || o.totalamount) || 0,
          status: o.Status || o.status,
          shopLat: parseFloat(o.ShopLat || o.shoplat) || 0,
          shopLng: parseFloat(o.ShopLng || o.shoplng) || 0,
          customerLat: parseFloat(o.CustomerLat || o.customerlat) || 0,
          customerLng: parseFloat(o.CustomerLng || o.customerlng) || 0,
          deliveryAddress: o.DeliveryAddress || o.deliveryaddress || '',
          notes: o.Notes || o.notes || '',
          createdAt: o.CreatedAt || o.createdat,
          distanceKm: parseFloat(distToShop.toFixed(1))
        };
      })
      .filter(o => o.distanceKm <= 5000)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    res.json({ status: 'success', data: nearby });
  } catch (e) {
    sendError(res, 500, e.message);
  }
});

// ─── ORDERS: GET PENDING (shop has ready, waiting for delivery) ───────────────

app.get('/api/orders/pending-delivery', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const { lat, lng } = req.query;
    if (!lat || !lng) return sendError(res, 400, 'lat and lng required.');

    const rows = await safeQuery(catalystApp.zcql(), 
      `SELECT ROWID, CustomerId, ShopId, Items, TotalAmount, Status, ShopLat, ShopLng, CustomerLat, CustomerLng, DeliveryAddress, Notes, CreatedAt FROM orders WHERE Status = 'ready_for_pickup'`
    );
    if (!rows || rows.length === 0) return res.json({ status: 'success', data: [] });

    const nearby = rows
      .map(r => {
        const o = r.orders || r.Orders || r.ORDERS;
        const distToShop = haversineKm(parseFloat(lat), parseFloat(lng), parseFloat(o.ShopLat || o.shoplat) || 0, parseFloat(o.ShopLng || o.shoplng) || 0);
        const total = parseFloat(o.TotalAmount || o.totalamount) || 0;
        const earnings = Math.max(20, Math.round(total * 0.08));
        return {
          id: o.ROWID || o.rowid,
          customerId: o.CustomerId || o.customerid,
          shopId: o.ShopId || o.shopid,
          items: JSON.parse(o.Items || o.items || '[]'),
          totalAmount: total,
          status: o.Status || o.status,
          shopLat: parseFloat(o.ShopLat || o.shoplat) || 0,
          shopLng: parseFloat(o.ShopLng || o.shoplng) || 0,
          customerLat: parseFloat(o.CustomerLat || o.customerlat) || 0,
          customerLng: parseFloat(o.CustomerLng || o.customerlng) || 0,
          deliveryAddress: o.DeliveryAddress || o.deliveryaddress || '',
          notes: o.Notes || o.notes || '',
          createdAt: o.CreatedAt || o.createdat,
          distanceKm: parseFloat(distToShop.toFixed(1)),
          estimatedEarnings: earnings
        };
      })
      .filter(o => o.distanceKm <= 5000)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    res.json({ status: 'success', data: nearby });
  } catch (e) {
    sendError(res, 500, e.message);
  }
});

// ─── ORDERS: UPDATE STATUS ────────────────────────────────────────────────────

app.put('/api/orders/:id/status', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const { status, deliveryPartnerId } = req.body;
    const validStatuses = ['pending', 'accepted', 'ready_for_pickup', 'picked_up', 'delivered', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return sendError(res, 400, `Status must be one of: ${validStatuses.join(', ')}`);
    }

    const table = catalystApp.datastore().table('orders');
    const update = { ROWID: req.params.id, Status: status, UpdatedAt: new Date().toISOString() };
    if (deliveryPartnerId) update.DeliveryPartnerId = String(deliveryPartnerId);
    await table.updateRow(update);

    // If delivered, log earnings
    if (status === 'delivered' && deliveryPartnerId) {
      const zcql = catalystApp.zcql();
      const orderRows = await safeQuery(zcql, 
        `SELECT TotalAmount FROM orders WHERE ROWID = '${req.params.id}'`
      );
      if (orderRows && orderRows.length > 0) {
        const orderObj = orderRows[0].orders || orderRows[0].Orders || orderRows[0].ORDERS;
        const total = parseFloat(orderObj.TotalAmount || orderObj.totalamount) || 0;
        const earning = Math.max(20, Math.round(total * 0.08));
        await catalystApp.datastore().table('deliveryearnings').insertRow({
          DeliveryPartnerId: String(deliveryPartnerId),
          OrderId: req.params.id,
          Amount: String(earning),
          Dates: new Date().toISOString().split('T')[0],
          Status: 'credited'
        });
      }
    }

    res.json({ status: 'success', message: `Order status updated to ${status}.` });
  } catch (e) {
    sendError(res, 500, e.message);
  }
});

// ─── EARNINGS: DELIVERY PARTNER ───────────────────────────────────────────────

app.get('/api/earnings/:userId', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const rows = await safeQuery(catalystApp.zcql(), 
      `SELECT ROWID, OrderId, Amount, Dates, Status FROM deliveryearnings WHERE DeliveryPartnerId = '${req.params.userId}' ORDER BY Dates DESC LIMIT 100`
    );
    if (!rows || rows.length === 0) return res.json({ status: 'success', data: [], totalToday: 0, totalWeek: 0, totalAll: 0 });

    const earnings = rows.map(r => {
      const e = r.deliveryearnings || r.DeliveryEarnings || r.DELIVERYEARNINGS;
      return { id: e.ROWID || e.rowid, orderId: e.OrderId || e.orderid, amount: parseFloat(e.Amount || e.amount), date: e.Dates || e.dates || '', status: e.Status || e.status };
    });

    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const totalToday = earnings.filter(e => e.date === today).reduce((s, e) => s + e.amount, 0);
    const totalWeek = earnings.filter(e => e.date >= weekAgo).reduce((s, e) => s + e.amount, 0);
    const totalAll = earnings.reduce((s, e) => s + e.amount, 0);

    res.json({ status: 'success', data: earnings, totalToday, totalWeek, totalAll });
  } catch (e) {
    sendError(res, 500, e.message);
  }
});

// ─── ORDERS: DELIVERY PARTNER ACTIVE ─────────────────────────────────────────

app.get('/api/orders/delivery/:partnerId', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const rows = await safeQuery(catalystApp.zcql(), 
      `SELECT ROWID, CustomerId, ShopId, Items, TotalAmount, Status, ShopLat, ShopLng, CustomerLat, CustomerLng, DeliveryAddress, Notes, CreatedAt FROM orders WHERE DeliveryPartnerId = '${req.params.partnerId}' ORDER BY CreatedAt DESC LIMIT 50`
    );
    if (!rows || rows.length === 0) return res.json({ status: 'success', data: [] });
    const orders = rows.map(r => {
      const o = r.orders || r.Orders || r.ORDERS;
      return { id: o.ROWID || o.rowid, customerId: o.CustomerId || o.customerid, shopId: o.ShopId || o.shopid, items: JSON.parse(o.Items || o.items || '[]'), totalAmount: parseFloat(o.TotalAmount || o.totalamount), status: o.Status || o.status, shopLat: parseFloat(o.ShopLat || o.shoplat), shopLng: parseFloat(o.ShopLng || o.shoplng), customerLat: parseFloat(o.CustomerLat || o.customerlat), customerLng: parseFloat(o.CustomerLng || o.customerlng), deliveryAddress: o.DeliveryAddress || o.deliveryaddress, notes: o.Notes || o.notes, createdAt: o.CreatedAt || o.createdat };
    });
    res.json({ status: 'success', data: orders });
  } catch (e) {
    sendError(res, 500, e.message);
  }
});

module.exports = app;
