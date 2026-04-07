// State
let cart = [];
let currentTab = 'pos';
let isAuthenticated = false;

// Auth Logic
function checkAuth() {
    if (localStorage.getItem('pos_auth') === 'true') {
        isAuthenticated = true;
        document.getElementById('view-login').classList.add('hidden');
        document.getElementById('view-login').classList.remove('flex');
    } else {
        document.getElementById('view-login').classList.remove('hidden');
        document.getElementById('view-login').classList.add('flex');

        // Ensure input is focused when shown
        setTimeout(() => document.getElementById('login-pin').focus(), 100);
    }
}

function handleLogin(e) {
    if (e) e.preventDefault();
    const pin = document.getElementById('login-pin').value;
    if (pin === 'sarasi1234') {
        localStorage.setItem('pos_auth', 'true');
        checkAuth();
        showToast('Login successful', 'success');
        document.getElementById('login-pin').value = '';
    } else {
        showToast('Invalid PIN (Hint: 1234)', 'error');
    }
}

function handleLogout() {
    localStorage.removeItem('pos_auth');
    isAuthenticated = false;
    checkAuth();
    showToast('Logged out successfully', 'success');
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    switchTab('pos');
    renderPOS();
    renderInventory();
    renderDashboard();
});

// Navigation
function switchTab(tabId) {
    currentTab = tabId;
    ['pos', 'inventory', 'dashboard', 'returns'].forEach(id => {
        const el = document.getElementById(`view-${id}`);
        const nav = document.getElementById(`nav-${id}`);
        if (id === tabId) {
            el.classList.remove('hidden');
            el.classList.add('flex');
            nav.classList.add('bg-blue-600', 'text-white', 'shadow-md');
            nav.classList.remove('text-slate-600', 'hover:bg-slate-100');
        } else {
            el.classList.add('hidden');
            el.classList.remove('flex');
            nav.classList.remove('bg-blue-600', 'text-white', 'shadow-md');
            nav.classList.add('text-slate-600', 'hover:bg-slate-100');
        }
    });

    if (tabId === 'dashboard') renderDashboard();
    if (tabId === 'inventory') renderInventory();
    if (tabId === 'pos') renderPOS();
}

// ======================
// POS LOGIC
// ======================
async function renderPOS() {
    const search = document.getElementById('search-pos').value.toLowerCase();
    const category = document.getElementById('filter-cat').value;

    let products = await db.products.toArray();

    if (category !== 'All') {
        products = products.filter(p => p.category === category);
    }

    if (search.trim() !== '') {
        products = products.filter(p => p.name.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search));
    }

    const grid = document.getElementById('pos-grid');
    grid.innerHTML = products.map(p => {
        const isLow = p.stock < 5;
        const disabled = p.stock <= 0;
        return `
            <div onclick="${disabled ? '' : `addToCart(${p.id})`}" class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md cursor-pointer group'}">
                ${isLow && !disabled ? '<span class="absolute top-0 right-0 bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-bl-lg">Low Stock</span>' : ''}
                ${disabled ? '<span class="absolute top-0 right-0 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-bl-lg">Out of Stock</span>' : ''}
                <div class="text-xs text-slate-500 mb-1">${p.brand ? '<span class="font-bold text-blue-600">' + p.brand + '</span> | ' : ''}${p.sku}</div>
                <h3 class="font-bold text-slate-800 mb-1">${p.name}</h3>
                <div class="flex justify-between items-end mt-2">
                    <span class="text-blue-600 font-bold">Rs ${(p.sellingPrice).toFixed(2)}</span>
                    <span class="text-xs ${isLow ? 'text-amber-600 font-bold' : 'text-slate-400'}">${p.stock} ${p.unit} left</span>
                </div>
            </div>
        `;
    }).join('');

    if (products.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center py-10 text-slate-400">No items found</div>';
    }
}

async function addToCart(id) {
    const p = await db.products.get(id);
    if (!p) return;

    const existing = cart.find(i => i.id === id);
    if (existing) {
        if (existing.qty < p.stock) existing.qty++;
        else showToast('Cannot exceed available stock', 'error');
    } else {
        if (p.stock > 0) {
            cart.push({ ...p, qty: 1 });
        } else {
            showToast('Out of stock', 'error');
        }
    }
    updateCart();
}

function updateCartQty(id, delta) {
    const item = cart.find(i => i.id === id);
    if (item) {
        const newQty = item.qty + delta;
        if (newQty > 0 && newQty <= item.stock) {
            item.qty = newQty;
        } else if (newQty === 0) {
            cart = cart.filter(i => i.id !== id);
        }
    }
    updateCart();
}

function removeCartItem(id) {
    cart = cart.filter(i => i.id !== id);
    updateCart();
}

function clearCart() {
    if (cart.length > 0 && confirm('Clear cart?')) {
        cart = [];
        updateCart();
    }
}

function updateCart() {
    const list = document.getElementById('cart-list');
    let subtotal = 0;

    if (cart.length === 0) {
        list.innerHTML = '<div class="text-center py-10 text-slate-400">Cart is empty</div>';
    } else {
        list.innerHTML = cart.map(i => {
            const itemTotal = i.sellingPrice * i.qty;
            subtotal += itemTotal;
            return `
            <div class="border-b border-slate-100 py-3 flex gap-2">
                <div class="flex-1">
                    <div class="font-bold text-sm text-slate-700">${i.name}</div>
                    <div class="text-xs text-slate-500">Rs ${i.sellingPrice.toFixed(2)} / ${i.unit}</div>
                </div>
                <div class="flex flex-col items-end justify-between">
                    <div class="font-bold text-slate-800 text-sm">Rs ${itemTotal.toFixed(2)}</div>
                    <div class="flex items-center gap-2 mt-1">
                        <button onclick="updateCartQty(${i.id}, -1)" class="w-6 h-6 bg-slate-100 rounded text-slate-600 hover:bg-slate-200">-</button>
                        <span class="text-xs font-bold w-4 text-center">${i.qty}</span>
                        <button onclick="updateCartQty(${i.id}, 1)" class="w-6 h-6 bg-slate-100 rounded text-slate-600 hover:bg-slate-200">+</button>
                        <button onclick="removeCartItem(${i.id})" class="text-red-400 hover:text-red-600 ml-1"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4"></path></svg></button>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    // Discounts
    let discountVal = parseFloat(document.getElementById('discount-val').value) || 0;
    const discountType = document.getElementById('discount-type').value;

    let discountAmt = 0;
    if (discountType === 'percent') {
        discountAmt = subtotal * (discountVal / 100);
    } else {
        discountAmt = discountVal;
    }

    const finalTotal = subtotal - discountAmt;

    document.getElementById('c-subtotal').innerText = `Rs ${subtotal.toFixed(2)}`;
    document.getElementById('c-discount').innerText = `- Rs ${discountAmt.toFixed(2)}`;
    document.getElementById('c-total').innerText = `Rs ${finalTotal.toFixed(2)}`;

    document.getElementById('btn-checkout').disabled = cart.length === 0 || finalTotal < 0;
}

function openCheckout() {
    if (cart.length === 0) return;
    document.getElementById('modal-checkout').classList.remove('hidden');
    document.getElementById('modal-checkout').classList.add('flex');

    const subtotal = cart.reduce((acc, i) => acc + (i.sellingPrice * i.qty), 0);
    let discountVal = parseFloat(document.getElementById('discount-val').value) || 0;
    const discountType = document.getElementById('discount-type').value;
    let discountAmt = discountType === 'percent' ? subtotal * (discountVal / 100) : discountVal;
    const total = subtotal - discountAmt;

    document.getElementById('co-total').innerText = `Rs ${total.toFixed(2)}`;
    document.getElementById('co-cash').value = '';
    document.getElementById('co-balance').innerText = 'Rs 0.00';
    document.getElementById('btn-confirm-sale').disabled = true;

    // Default to Cash
    document.getElementById('pay-method').value = 'Cash';
    checkBalance();
}

function hideCheckout() {
    document.getElementById('modal-checkout').classList.add('hidden');
    document.getElementById('modal-checkout').classList.remove('flex');
}

function checkBalance() {
    const subtotal = cart.reduce((acc, i) => acc + (i.sellingPrice * i.qty), 0);
    let discountVal = parseFloat(document.getElementById('discount-val').value) || 0;
    const discountType = document.getElementById('discount-type').value;
    let discountAmt = discountType === 'percent' ? subtotal * (discountVal / 100) : discountVal;
    const total = subtotal - discountAmt;

    const method = document.getElementById('pay-method').value;
    const cashInput = document.getElementById('co-cash-wrapper');
    const cash = parseFloat(document.getElementById('co-cash').value) || 0;

    let balEl = document.getElementById('co-balance');
    let btn = document.getElementById('btn-confirm-sale');

    if (method === 'Cash') {
        cashInput.classList.remove('hidden');
        const balance = cash - total;
        balEl.innerText = `Rs ${balance.toFixed(2)}`;
        if (balance >= 0) {
            balEl.className = 'text-2xl font-bold text-emerald-600';
            btn.disabled = false;
        } else {
            balEl.className = 'text-2xl font-bold text-red-500';
            btn.disabled = true;
        }
    } else {
        cashInput.classList.add('hidden');
        balEl.innerText = 'N/A';
        balEl.className = 'text-xl font-bold text-slate-400';
        btn.disabled = false;
    }
}

async function finalizeSale() {
    document.getElementById('btn-confirm-sale').disabled = true;
    try {
        const subtotal = cart.reduce((acc, i) => acc + (i.sellingPrice * i.qty), 0);
        const totalProfit = cart.reduce((acc, i) => acc + ((i.sellingPrice - i.costPrice) * i.qty), 0);

        let discountVal = parseFloat(document.getElementById('discount-val').value) || 0;
        const discountType = document.getElementById('discount-type').value;
        const discountAmt = discountType === 'percent' ? subtotal * (discountVal / 100) : discountVal;

        const finalTotal = subtotal - discountAmt;
        const method = document.getElementById('pay-method').value;

        // Final profit adjusting for discount
        const netProfit = totalProfit - discountAmt;

        const ts = new Date().getTime();
        const saleId = await db.sales.add({
            timestamp: ts,
            items: cart.map(i => ({ id: i.id, name: i.name, qty: i.qty, price: i.sellingPrice })),
            subtotal,
            discount: discountAmt,
            totalAmount: finalTotal,
            profit: netProfit,
            paymentMethod: method
        });

        for (const item of cart) {
            const p = await db.products.get(item.id);
            await db.products.update(item.id, { stock: p.stock - item.qty });
        }

        const cash = document.getElementById('co-cash').value;
        const balance = document.getElementById('co-balance').innerText;

        printReceipt(saleId, ts, finalTotal, discountAmt, method, cash, balance);

        cart = [];
        document.getElementById('discount-val').value = '';
        hideCheckout();
        updateCart();
        renderPOS();
        showToast('Sale Complete!', 'success');
    } catch (err) {
        console.error(err);
        showToast('Error saving sale', 'error');
        document.getElementById('btn-confirm-sale').disabled = false;
    }
}

// Receipt
function printReceipt(id, time, total, discount, method, cash, balance) {
    document.getElementById('r-id').innerText = id.toString().padStart(6, '0');
    document.getElementById('r-date').innerText = new Date(time).toLocaleString();

    document.getElementById('r-items').innerHTML = cart.map(i =>
        `<tr><td class="pr-2">${i.qty}</td><td>${i.name}</td><td class="text-right">${(i.qty * i.sellingPrice).toFixed(2)}</td></tr>`
    ).join('');

    document.getElementById('r-sub').innerText = parseFloat(total + discount).toFixed(2);
    document.getElementById('r-dis').innerText = parseFloat(discount).toFixed(2);
    document.getElementById('r-tot').innerText = parseFloat(total).toFixed(2);
    document.getElementById('r-method').innerText = method;

    if (method === 'Cash') {
        document.getElementById('r-cash').innerText = parseFloat(cash).toFixed(2);
        document.getElementById('r-bal').innerText = balance.replace('Rs ', '');
        document.getElementById('r-cash-wrapper').style.display = 'flex';
        document.getElementById('r-bal-wrapper').style.display = 'flex';
    } else {
        document.getElementById('r-cash-wrapper').style.display = 'none';
        document.getElementById('r-bal-wrapper').style.display = 'none';
    }

    const modal = document.getElementById('modal-receipt');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}
function hideReceipt() {
    document.getElementById('modal-receipt').classList.add('hidden');
    document.getElementById('modal-receipt').classList.remove('flex');
}

// ======================
// INVENTORY LOGIC
// ======================
async function renderInventory() {
    const search = document.getElementById('search-inv').value.toLowerCase();
    let products = await db.products.toArray();

    if (search) {
        products = products.filter(p => p.name.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search) || p.category.toLowerCase().includes(search));
    }

    document.getElementById('inv-table').innerHTML = products.map(p => {
        const isLow = p.stock < 5;
        return `
        <tr class="border-b border-slate-100 hover:bg-slate-50">
            <td class="py-3 px-4">${p.sku}</td>
            <td class="py-3 px-4 font-semibold">${p.name}${p.brand ? '<span class="block text-xs text-slate-400 font-normal">' + p.brand + '</span>' : ''}</td>
            <td class="py-3 px-4"><span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">${p.category}</span></td>
            <td class="py-3 px-4">${p.costPrice.toFixed(2)}</td>
            <td class="py-3 px-4">${p.sellingPrice.toFixed(2)}</td>
            <td class="py-3 px-4 ${isLow ? 'text-red-500 font-bold' : ''}">${p.stock} ${p.unit}</td>
            <td class="py-3 px-4 font-mono text-xs ${getExpiryClass(p.expiryDate)}">${p.expiryDate ? new Date(p.expiryDate).toLocaleDateString() : 'N/A'}</td>
            <td class="py-3 px-4 text-right">
                <button onclick="editProduct(${p.id})" class="text-blue-500 hover:text-blue-700 mr-2 border border-blue-200 px-2 rounded">Edit</button>
                <button onclick="deleteProduct(${p.id})" class="text-red-500 hover:text-red-700 border border-red-200 px-2 rounded">Del</button>
            </td>
        </tr>
        `;
    }).join('');
}

function openAddProduct() {
    document.getElementById('p-id').value = '';
    document.getElementById('form-product').reset();
    document.getElementById('modal-product').classList.remove('hidden');
    document.getElementById('modal-product').classList.add('flex');
}

function hideProductModal() {
    document.getElementById('modal-product').classList.add('hidden');
    document.getElementById('modal-product').classList.remove('flex');
}

async function editProduct(id) {
    const p = await db.products.get(id);
    if (!p) return;
    document.getElementById('p-id').value = p.id;
    document.getElementById('p-sku').value = p.sku;
    document.getElementById('p-brand').value = p.brand || '';
    document.getElementById('p-name').value = p.name;
    document.getElementById('p-category').value = p.category;
    document.getElementById('p-unit').value = p.unit;
    document.getElementById('p-cost').value = p.costPrice;
    document.getElementById('p-sell').value = p.sellingPrice;
    document.getElementById('p-stock').value = p.stock;
    document.getElementById('p-expiry').value = p.expiryDate || '';

    document.getElementById('modal-product').classList.remove('hidden');
    document.getElementById('modal-product').classList.add('flex');
}

async function saveProduct(e) {
    e.preventDefault();
    const id = document.getElementById('p-id').value;
    const p = {
        sku: document.getElementById('p-sku').value.toUpperCase(),
        brand: document.getElementById('p-brand').value,
        name: document.getElementById('p-name').value,
        category: document.getElementById('p-category').value,
        unit: document.getElementById('p-unit').value,
        costPrice: parseFloat(document.getElementById('p-cost').value),
        sellingPrice: parseFloat(document.getElementById('p-sell').value),
        stock: parseInt(document.getElementById('p-stock').value, 10),
        expiryDate: document.getElementById('p-expiry').value
    };

    if (id) {
        await db.products.update(parseInt(id), p);
        showToast('Updated successfully');
    } else {
        await db.products.add(p);
        showToast('Added successfully');
    }
    hideProductModal();
    renderInventory();
    renderPOS();
}

async function deleteProduct(id) {
    if (confirm('Delete product forever?')) {
        await db.products.delete(id);
        renderInventory();
        renderPOS();
        showToast('Deleted', 'success');
    }
}

// ======================
// DASHBOARD LOGIC
// ======================
async function renderDashboard() {
    const sales = await db.sales.toArray();
    const today = new Date().setHours(0, 0, 0, 0);
    const todaySales = sales.filter(s => s.timestamp >= today);

    const rev = todaySales.reduce((acc, s) => acc + s.totalAmount, 0);
    const prof = todaySales.reduce((acc, s) => acc + s.profit, 0);

    // Calculate Today's Refunds to deduct from Revenue/Profit
    const todayMillis = new Date().setHours(0, 0, 0, 0);
    const allReturns = await db.returns.toArray();
    const todayReturns = allReturns.filter(r => r.timestamp >= todayMillis);

    const refundedRev = todayReturns.reduce((acc, r) => acc + r.refundAmount, 0);
    const refundedProf = todayReturns.reduce((acc, r) => acc + r.refundProfit, 0);

    const netRev = rev - refundedRev;
    const netProf = prof - refundedProf;

    let validSalesCountOfDay = 0;
    for (let s of todaySales) {
        let totalPurchased = s.items.reduce((sum, it) => sum + it.qty, 0);
        let totalReturned = 0;
        allReturns.forEach(r => {
            if (r.saleId === s.id) {
                totalReturned += r.items.reduce((sum, it) => sum + it.qty, 0);
            }
        });
        if (totalReturned < totalPurchased) {
            validSalesCountOfDay++;
        }
    }

    document.getElementById('dash-rev').innerText = `Rs ${netRev.toFixed(2)}`;
    document.getElementById('dash-prof').innerText = `Rs ${netProf.toFixed(2)}`;
    document.getElementById('dash-count').innerText = validSalesCountOfDay;

    // Low stock
    const products = await db.products.toArray();
    const low = products.filter(p => p.stock < 5);
    const list = document.getElementById('dash-low-stock');
    if (low.length === 0) {
        list.innerHTML = '<p class="text-sm text-emerald-600 bg-emerald-50 p-2 rounded">All stock levels are healthy.</p>';
    } else {
        list.innerHTML = low.map(p => `
            <div class="flex justify-between items-center p-2 border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <div><p class="font-bold text-sm">${p.name}</p><p class="text-xs text-slate-500">${p.sku}</p></div>
                <div class="font-bold text-red-500">${p.stock} ${p.unit}</div>
            </div>
        `).join('');
    }

    // Latest Transactions (Sales & Returns)
    const latestSalesList = document.getElementById('dash-latest-sales');
    const combinedTransactions = [
        ...sales.map(s => ({ ...s, type: 'Sale' })),
        ...allReturns.map(r => ({ ...r, type: 'Return' }))
    ];
    combinedTransactions.sort((a, b) => a.timestamp - b.timestamp);

    const recent = combinedTransactions.slice(-5).reverse();
    if (recent.length === 0) {
        latestSalesList.innerHTML = '<p class="text-sm text-slate-500 text-center py-4">No recent transactions</p>';
    } else {
        latestSalesList.innerHTML = recent.map(t => {
            if (t.type === 'Sale') {
                return `
                <div class="flex justify-between items-center p-3 border-b border-slate-100 bg-white">
                    <div>
                        <p class="font-bold text-sm">Sale #${t.id.toString().padStart(6, '0')}</p>
                        <p class="text-xs text-slate-500">${new Date(t.timestamp).toLocaleTimeString()}</p>
                    </div>
                    <div class="text-right">
                        <p class="font-bold text-emerald-600">Rs ${t.totalAmount.toFixed(2)}</p>
                        <p class="text-xs text-slate-400 capitalize">${t.paymentMethod}</p>
                    </div>
                </div>`;
            } else {
                return `
                <div class="flex justify-between items-center p-3 border-b border-slate-200 bg-red-50">
                    <div>
                        <p class="font-bold text-sm text-red-600">Return (Bill #${t.saleId.toString().padStart(6, '0')})</p>
                        <p class="text-xs text-red-400">${new Date(t.timestamp).toLocaleTimeString()}</p>
                    </div>
                    <div class="text-right">
                        <p class="font-bold text-red-600">- Rs ${t.refundAmount.toFixed(2)}</p>
                        <p class="text-xs text-red-400 capitalize">Refund</p>
                    </div>
                </div>`;
            }
        }).join('');
    }

    // Expiry Alerts
    const expireAlerts = products.filter(p => {
        if (!p.expiryDate) return false;
        const d = new Date(p.expiryDate).getTime();
        const days = Math.ceil((d - todayMillis) / (1000 * 3600 * 24));
        return days <= 30; // 30 days or less, including expired
    });

    expireAlerts.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

    const expireList = document.getElementById('dash-expire-stock');
    if (expireAlerts.length === 0) {
        expireList.innerHTML = '<div class="col-span-full"><p class="text-sm text-emerald-600 bg-emerald-50 p-3 rounded-lg font-semibold w-full">All generic products have healthy expiration timelines.</p></div>';
    } else {
        expireList.innerHTML = expireAlerts.map(p => {
            const d = new Date(p.expiryDate).getTime();
            const days = Math.ceil((d - todayMillis) / (1000 * 3600 * 24));
            let status = '';
            if (days <= 0) status = `<span class="bg-red-100/80 text-red-700 text-xs px-2.5 py-1 rounded-md font-bold shadow-sm whitespace-nowrap">Expired (${Math.abs(days)}d ago)</span>`;
            else status = `<span class="bg-amber-100/80 text-amber-700 text-xs px-2.5 py-1 rounded-md font-bold shadow-sm whitespace-nowrap">Expiring in ${days} days</span>`;

            return `
            <div class="flex flex-col p-4 border border-slate-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow relative">
                ${days <= 0 ? '<div class="absolute inset-0 bg-red-50/50 rounded-xl pointer-events-none border border-red-200"></div>' : ''}
                <div class="z-10 flex justify-between items-start mb-3">
                    <div>
                        <p class="font-extrabold text-slate-800 text-md truncate">${p.name}</p>
                        <p class="text-xs text-slate-500 font-mono mt-0.5">${p.sku} | ${p.stock} ${p.unit}</p>
                    </div>
                </div>
                <div class="z-10 flex items-center justify-between mt-auto">
                    <p class="font-bold text-slate-700 text-sm flex items-center gap-1.5 border-t border-slate-100 w-full pt-3">
                        📅 ${new Date(p.expiryDate).toLocaleDateString()}
                    </p>
                </div>
                <div class="z-10 mt-3 flex">
                    ${status}
                </div>
            </div>
            `;
        }).join('');
    }
}

// ======================
// RETURNS LOGIC
// ======================
let currentReturnSession = null;

async function searchSaleForReturn() {
    const idVal = document.getElementById('return-sale-id').value;
    const id = parseInt(idVal);
    if (!idVal || isNaN(id)) return showToast('Please enter a Bill ID', 'error');

    const sale = await db.sales.get(id);
    if (!sale) return showToast(`No sale found with Bill #${id}`, 'error');

    const pastReturns = await db.returns.where('saleId').equals(id).toArray();

    const returnedItemsMap = {};
    pastReturns.forEach(ret => {
        ret.items.forEach(rtItem => {
            returnedItemsMap[rtItem.id] = (returnedItemsMap[rtItem.id] || 0) + rtItem.qty;
        });
    });

    currentReturnSession = {
        sale: sale,
        items: sale.items.map(i => ({
            ...i,
            returnedQty: returnedItemsMap[i.id] || 0,
            pendingReturnQty: 0
        }))
    };

    renderReturnSession();
}

function renderReturnSession() {
    if (!currentReturnSession) return;
    document.getElementById('return-details-container').classList.remove('hidden');
    document.getElementById('return-details-container').classList.add('flex');

    const s = currentReturnSession.sale;
    document.getElementById('rt-bill-no').innerText = s.id.toString().padStart(6, '0');
    document.getElementById('rt-date').innerText = new Date(s.timestamp).toLocaleString();

    document.getElementById('rt-items').innerHTML = currentReturnSession.items.map((i, index) => {
        const availableToReturn = i.qty - i.returnedQty;
        const disabledAttr = availableToReturn <= 0 ? 'disabled' : '';
        const opacClass = availableToReturn <= 0 ? 'opacity-50' : '';
        return `
        <tr class="border-b border-slate-100 ${opacClass}">
            <td class="py-3 px-4 font-semibold text-slate-800">${i.name}</td>
            <td class="py-3 px-4 text-right border-l">Rs ${i.price.toFixed(2)}</td>
            <td class="py-3 px-4 text-center border-l bg-slate-50 font-bold">${i.qty}</td>
            <td class="py-3 px-4 text-center border-r bg-slate-50 text-red-500 font-bold">${i.returnedQty}</td>
            <td class="py-3 px-4 w-40">
                <input type="number" min="0" max="${availableToReturn}" value="${i.pendingReturnQty}" 
                    oninput="updateReturnQty(${index}, this.value)" 
                    class="w-full border border-slate-300 px-3 py-1.5 rounded outline-none text-center font-bold focus:border-red-500" ${disabledAttr}>
            </td>
        </tr>`;
    }).join('');

    calculateReturnTotal();
}

function updateReturnQty(index, val) {
    let num = parseInt(val) || 0;
    const item = currentReturnSession.items[index];
    const available = item.qty - item.returnedQty;

    if (num < 0) num = 0;
    if (num > available) num = available;

    item.pendingReturnQty = num;
    calculateReturnTotal();
}

function calculateReturnTotal() {
    if (!currentReturnSession) return;
    let total = 0;
    let hasItems = false;
    currentReturnSession.items.forEach(i => {
        if (i.pendingReturnQty > 0) {
            total += (i.price * i.pendingReturnQty);
            hasItems = true;
        }
    });

    document.getElementById('rt-refund-total').innerText = `Rs ${total.toFixed(2)}`;
    document.getElementById('btn-process-return').disabled = !hasItems;
}

function cancelReturn() {
    currentReturnSession = null;
    document.getElementById('return-sale-id').value = '';
    document.getElementById('return-details-container').classList.add('hidden');
    document.getElementById('return-details-container').classList.remove('flex');
}

async function processReturn() {
    if (!currentReturnSession) return;

    const itemsToReturn = currentReturnSession.items.filter(i => i.pendingReturnQty > 0);
    if (itemsToReturn.length === 0) return;

    document.getElementById('btn-process-return').disabled = true;

    let refundAmount = 0;
    const returnItemsData = [];
    let refundProfit = 0;

    for (let i of itemsToReturn) {
        let costPrice = 0;
        try {
            const prod = await db.products.get(i.id);
            if (prod) {
                costPrice = prod.costPrice;
                await db.products.update(i.id, { stock: prod.stock + i.pendingReturnQty });
            }
        } catch (e) { console.warn(e); }

        refundAmount += (i.price * i.pendingReturnQty);
        refundProfit += ((i.price - costPrice) * i.pendingReturnQty);

        returnItemsData.push({
            id: i.id,
            name: i.name,
            qty: i.pendingReturnQty,
            price: i.price,
            costPrice: costPrice
        });
    }

    try {
        await db.returns.add({
            saleId: currentReturnSession.sale.id,
            timestamp: new Date().getTime(),
            items: returnItemsData,
            refundAmount: refundAmount,
            refundProfit: refundProfit
        });

        showToast(`Refund processed: Rs ${refundAmount.toFixed(2)}`, 'success');
        cancelReturn();
        renderInventory();
        if (currentTab === 'dashboard') renderDashboard();
    } catch (err) {
        console.error(err);
        showToast('Failed to save return', 'error');
        document.getElementById('btn-process-return').disabled = false;
    }
}

// UTILS
function getExpiryClass(dateStr) {
    if (!dateStr) return 'text-slate-500';
    const d = new Date(dateStr).getTime();
    const now = new Date().setHours(0, 0, 0, 0);
    const days = Math.ceil((d - now) / (1000 * 3600 * 24));
    if (days <= 0) return 'text-red-600 font-bold'; // Expired
    if (days <= 30) return 'text-amber-600 font-bold'; // Nearing
    return 'text-emerald-600';
}

function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.className = `fixed bottom-5 right-5 px-4 py-2 rounded shadow-lg text-white font-bold transition-all z-50 ${type === 'success' ? 'bg-emerald-500' : 'bg-red-500'} transform translate-y-0 opacity-100`;
    setTimeout(() => {
        t.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}
