const db = new Dexie('POS_Database');

db.version(2).stores({
    products: '++id, name, sku, category, brand, costPrice, sellingPrice, stock, unit',
    sales: '++id, timestamp' // Can only index fields we might query by, but others are properties
});

db.version(3).stores({
    products: '++id, name, sku, category, brand, costPrice, sellingPrice, stock, unit, expiryDate',
    sales: '++id, timestamp'
}).upgrade(tx => {
    return tx.table('products').toCollection().modify(product => {
        if(!product.expiryDate) {
            const nextYear = new Date();
            nextYear.setFullYear(nextYear.getFullYear() + 1);
            product.expiryDate = nextYear.toISOString().split('T')[0];
        }
    });
});

db.version(4).stores({
    products: '++id, name, sku, category, brand, costPrice, sellingPrice, stock, unit, expiryDate',
    sales: '++id, timestamp',
    returns: '++id, saleId, timestamp'
});

// Auto seed some dummy data if empty
async function seedDatabase() {
    const productsCount = await db.products.count();
    if (productsCount === 0) {
        const dCurrent = new Date();
        const nextMonth = new Date(dCurrent);
        nextMonth.setMonth(dCurrent.getMonth() + 1);
        const nextMonthStr = nextMonth.toISOString().split('T')[0];

        const nextWeek = new Date(dCurrent);
        nextWeek.setDate(dCurrent.getDate() + 7);
        const nextWeekStr = nextWeek.toISOString().split('T')[0];
        
        const expiredDate = new Date(dCurrent);
        expiredDate.setDate(dCurrent.getDate() - 5);
        const expiredStr = expiredDate.toISOString().split('T')[0];

        await db.products.bulkAdd([
            { name: 'Fresh Milk 1L', sku: 'DAI-001', category: 'Dairy', brand: 'Highland', costPrice: 350, sellingPrice: 400, stock: 40, unit: 'Pieces', expiryDate: nextWeekStr },
            { name: 'Yogurt', sku: 'DAI-002', category: 'Dairy', brand: 'Kotmale', costPrice: 50, sellingPrice: 70, stock: 100, unit: 'Cups', expiryDate: expiredStr },
            { name: 'White Eggs', sku: 'POU-001', category: 'Poultry', brand: '', costPrice: 45, sellingPrice: 60, stock: 200, unit: 'Pieces', expiryDate: nextMonthStr },
            { name: 'Ice Cream 1L Vanilla', sku: 'FRO-001', category: 'Frozen', brand: 'Elephant House', costPrice: 600, sellingPrice: 850, stock: 15, unit: 'Pieces', expiryDate: nextMonthStr },
            { name: 'CR Book 120 Pages', sku: 'STA-001', category: 'Stationery', brand: 'Atlas', costPrice: 180, sellingPrice: 250, stock: 80, unit: 'Pieces', expiryDate: '2026-12-31' }
        ]);
    }
}
seedDatabase();
