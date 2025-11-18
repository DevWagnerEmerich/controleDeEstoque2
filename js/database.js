let items = [];
console.log('database.js: items initialized as:', items);
let suppliers = [];
let movements = [];
let operationsHistory = [];
let users = [];
let importedOperationsHistory = [];
let cumulativeImportedItems = [];
let pendingSimulations = [];
let pendingPurchaseOrders = [];

export { items, suppliers, movements, operationsHistory, users, importedOperationsHistory, cumulativeImportedItems, pendingSimulations, pendingPurchaseOrders };



export function saveData() {
    localStorage.setItem('stockItems_v2', JSON.stringify(items));
    localStorage.setItem('stockSuppliers_v2', JSON.stringify(suppliers));
    localStorage.setItem('stockMovements_v2', JSON.stringify(movements));
    localStorage.setItem('stockOperations_v2', JSON.stringify(operationsHistory));
    localStorage.setItem('stockImportedDocs_v2', JSON.stringify(importedOperationsHistory));
    localStorage.setItem('stockPendingPOs_v1', JSON.stringify(pendingPurchaseOrders));
}

export function saveUsers() {
    localStorage.setItem('stockUsers_v2', JSON.stringify(users));
}

export function loadPendingPurchaseOrders() {
    const loadedPendingPOs = JSON.parse(localStorage.getItem('stockPendingPOs_v1')) || [];
    pendingPurchaseOrders.length = 0;
    pendingPurchaseOrders.push(...loadedPendingPOs);
}

export function loadDataAndRenderApp() {
    // 1. Carrega os utilizadores sempre primeiro para garantir que o estado de login seja consistente.
    const loadedUsers = JSON.parse(localStorage.getItem('stockUsers_v2')) || [];
    users.length = 0;
    users.push(...loadedUsers);

    // 2. Verifica se a app acabou de ser limpa para evitar carregar dados fictícios.
    const wasCleared = localStorage.getItem('just_cleared');
    if (wasCleared) {
        localStorage.removeItem('just_cleared');
        // Assegura que os arrays estão vazios e retorna para renderizar o estado vazio.
        items.length = 0;
        suppliers.length = 0;
        movements.length = 0;
        operationsHistory.length = 0;
        pendingPurchaseOrders.length = 0;
        return;
    }

    // 3. Lógica de carregamento normal
    const storedItems = localStorage.getItem('stockItems_v2');
    console.log('loadDataAndRenderApp: storedItems from localStorage:', storedItems);
    if (storedItems && JSON.parse(storedItems).length > 0) {
        const loadedItems = JSON.parse(storedItems).map(item => ({
            packageType: 'unidade',
            unitsPerPackage: 1,
            unitMeasureValue: 1,
            unitMeasureType: 'un',
            ...item
        }));
        items.length = 0;
        items.push(...loadedItems);
        console.log('loadDataAndRenderApp: items after push:', items);

        const loadedSuppliers = JSON.parse(localStorage.getItem('stockSuppliers_v2')) || [];
        suppliers.length = 0;
        suppliers.push(...loadedSuppliers);

        const loadedMovements = JSON.parse(localStorage.getItem('stockMovements_v2')) || [];
        movements.length = 0;
        movements.push(...loadedMovements);

        const loadedOps = JSON.parse(localStorage.getItem('stockOperations_v2')) || [];
        operationsHistory.length = 0;
        operationsHistory.push(...loadedOps);

        const loadedImportedOps = JSON.parse(localStorage.getItem('stockImportedDocs_v2')) || [];
        importedOperationsHistory.length = 0;
        importedOperationsHistory.push(...loadedImportedOps);

        const loadedPendingSims = JSON.parse(localStorage.getItem('stockPendingSims_v1')) || [];
        pendingSimulations.length = 0;
        pendingSimulations.push(...loadedPendingSims);

        const loadedPendingPOs = JSON.parse(localStorage.getItem('stockPendingPOs_v1')) || [];
        pendingPurchaseOrders.length = 0;
        pendingPurchaseOrders.push(...loadedPendingPOs);

    } else {
        // Só carrega dados fictícios na primeira vez que a app é aberta.
        loadFictitiousData();
        console.log('loadDataAndRenderApp: items after loadFictitiousData:', items);
    }
}

export function loadFictitiousData() {
    const fictitiousSuppliers = [
        { id: 'sup_1', name: 'Fecularia Lopes', cnpj: '12345678000190', address: 'Estrada Divisoria, S/N, Nova Londrina, PR', fda: '11649468954', email: 'contato@lopes.com', salesperson: 'Carlos', phone: '44999998888' },
        { id: 'sup_2', name: 'Rivelli & Bezerra', cnpj: '87654321000190', address: 'Rua Altamiro, 1051, Viçosa, MG', fda: '17405485860', email: 'vendas@rivelli.com', salesperson: 'Ana', phone: '31988887777' },
        { id: 'sup_3', name: 'Supang Alimentos', cnpj: '11223344000155', address: 'Av. Jose Francisco, 55, Coronel Fabriciano, MG', fda: '11155427912', email: 'comercial@supang.com.br', salesperson: 'Mariana', phone: '31977776666' }
    ];
    suppliers.length = 0;
    suppliers.push(...fictitiousSuppliers);

    const fictitiousItems = [
        { id: 'item_1', name: 'Fubá Mimoso', nameEn: 'Yellow Corn Meal', code: 'LP-001', ncm: '11022000', description: 'Fubá de milho amarelo para polenta e bolos.', quantity: 1500, minQuantity: 300, costPrice: 5.50, salePrice: 8.55, packageType: 'caixa', unitsPerPackage: 10, unitMeasureValue: 1, unitMeasureType: 'kg', supplierId: 'sup_1', image: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'item_2', name: 'Tapioca (Vermelha)', nameEn: 'Tapioca Starch', code: 'LP-002', ncm: '19030000', description: 'Goma de tapioca para preparos rápidos.', quantity: 800, minQuantity: 200, costPrice: 7.20, salePrice: 9.65, packageType: 'caixa', unitsPerPackage: 10, unitMeasureValue: 1, unitMeasureType: 'kg', supplierId: 'sup_1', image: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'item_3', name: 'Batata Palha Tradicional', nameEn: 'Potato Chips (Sticks)', code: 'RB-001', ncm: '20052000', description: 'Batata palha extra fina.', quantity: 900, minQuantity: 300, costPrice: 22.00, salePrice: 29.50, packageType: 'fardo', unitsPerPackage: 20, unitMeasureValue: 300, unitMeasureType: 'g', supplierId: 'sup_2', image: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'item_4', name: 'Feijão Carioca', nameEn: 'Carioca Beans', code: 'SP-001', ncm: '07133399', description: 'Feijão carioca tipo 1.', quantity: 2000, minQuantity: 500, costPrice: 9.80, salePrice: 12.76, packageType: 'fardo', unitsPerPackage: 10, unitMeasureValue: 1, unitMeasureType: 'kg', supplierId: 'sup_3', image: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'item_5', name: 'Polvilho Azedo', nameEn: 'Sour Starch', code: 'LP-003', ncm: '11081400', description: 'Polvilho azedo para pão de queijo.', quantity: 220, minQuantity: 200, costPrice: 8.00, salePrice: 10.45, packageType: 'caixa', unitsPerPackage: 10, unitMeasureValue: 1, unitMeasureType: 'kg', supplierId: 'sup_1', image: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'item_6', name: 'Farofa Temperada', nameEn: 'Seasoned Cassava Flour', code: 'LP-004', ncm: '19019090', description: 'Farofa pronta para churrasco.', quantity: 144, minQuantity: 120, costPrice: 7.00, salePrice: 9.20, packageType: 'caixa', unitsPerPackage: 12, unitMeasureValue: 400, unitMeasureType: 'g', supplierId: 'sup_1', image: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ];
    items.length = 0;
    items.push(...fictitiousItems);

    const fictitiousMovements = [
        { id: 'mov_1', itemId: 'item_1', type: 'in', quantity: 1500, price: 5.50, reason: 'Entrada inicial', date: new Date().toISOString() },
        { id: 'mov_2', itemId: 'item_2', type: 'in', quantity: 800, price: 7.20, reason: 'Entrada inicial', date: new Date().toISOString() },
        { id: 'mov_3', itemId: 'item_3', type: 'in', quantity: 1000, price: 22.00, reason: 'Entrada inicial', date: new Date().toISOString() },
        { id: 'mov_4', itemId: 'item_4', type: 'in', quantity: 2000, price: 9.80, reason: 'Entrada inicial', date: new Date().toISOString() },
        { id: 'mov_5', itemId: 'item_5', type: 'in', quantity: 220, price: 8.00, reason: 'Entrada inicial', date: new Date().toISOString() },
        { id: 'mov_6', itemId: 'item_6', type: 'in', quantity: 180, price: 7.00, reason: 'Entrada inicial', date: new Date().toISOString() },
        { id: 'mov_7', itemId: 'item_3', type: 'out', quantity: 100, price: 29.50, reason: 'Saída por Operação', operationId: 'OP-1722880000000', date: new Date().toISOString() },
        { id: 'mov_8', itemId: 'item_6', type: 'out', quantity: 36, price: 9.20, reason: 'Saída por Operação', operationId: 'OP-1722880000000', date: new Date().toISOString() }
    ];
    movements.length = 0;
    movements.push(...fictitiousMovements);

    const fictitiousOps = [
        {
            id: 'OP-1722880000000',
            date: new Date().toISOString(),
            items: [
                { ...fictitiousItems.find(i => i.id === 'item_3'), operationQuantity: 100, operationPrice: 29.50 },
                { ...fictitiousItems.find(i => i.id === 'item_6'), operationQuantity: 36, operationPrice: 9.20 }
            ]
        }
    ];
    operationsHistory.length = 0;
    operationsHistory.push(...fictitiousOps);
}

export function clearAllData() {
    // Limpa os arrays em memória (exceto usuários)
    items.length = 0;
    suppliers.length = 0;
    movements.length = 0;
    operationsHistory.length = 0;
    importedOperationsHistory.length = 0;
    cumulativeImportedItems.length = 0;
    pendingPurchaseOrders.length = 0;

    // Limpa o localStorage (exceto usuários)
    localStorage.removeItem('stockItems_v2');
    localStorage.removeItem('stockSuppliers_v2');
    localStorage.removeItem('stockMovements_v2');
    localStorage.removeItem('stockOperations_v2');
    localStorage.removeItem('stockImportedDocs_v2');
    localStorage.removeItem('stockPendingPOs_v1');

    // Define uma flag para indicar que a limpeza foi feita
    localStorage.setItem('just_cleared', 'true');

    // Recarrega a página para aplicar o estado limpo
    window.location.reload();
}