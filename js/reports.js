import { items, movements, suppliers } from './database.js';
import { openModal, closeModal, getStatus, formatCurrency, showNotification } from './ui.js';
import { escapeHTML } from './utils/helpers.js';
import { checkPermission } from './auth.js';

let charts = {};

function openReportsModal() {
    if (!checkPermission('reports')) {
        showNotification('Não tem permissão para ver relatórios.', 'danger');
        return;
    }
    openModal('reports-modal');
    // Ativa a primeira aba por padrão ao abrir
    const overviewTab = document.querySelector('#reports-tab-nav .report-tab[data-tab="overview"]');
    if (overviewTab) {
        switchReportTab(overviewTab, 'overview');
    }
}

function switchReportTab(button, tabName) {
    document.querySelectorAll('.report-tab').forEach(tab => tab.classList.remove('active'));
    button.classList.add('active');
    document.querySelectorAll('.report-tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');

    // Renderiza o conteúdo da aba selecionada
    if (tabName === 'overview') {
        renderOverviewReports();
    } else if (tabName === 'products') {
        renderProductAnalysisReports();
    } else if (tabName === 'history') {
        const startDatePicker = document.getElementById('report-start-date');
        const endDatePicker = document.getElementById('report-end-date');

        if (!startDatePicker.value || !endDatePicker.value) {
            const today = new Date();
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

            startDatePicker.value = firstDay.toISOString().split('T')[0];
            endDatePicker.value = today.toISOString().split('T')[0];
        }
        renderDailyMovementsReport();
    } else if (tabName === 'fiscal') {
        const yearSelect = document.getElementById('fiscal-year-filter');
        if (yearSelect.options.length === 0) {
            const currentYear = new Date().getFullYear();
            for (let i = 0; i < 5; i++) {
                const year = currentYear - i;
                const option = document.createElement('option');
                option.value = year;
                option.text = year;
                yearSelect.add(option);
            }
        }
        renderFiscalReport();
    }
}

function renderOverviewReports() {
    if (charts.valueChart) charts.valueChart.destroy();
    if (charts.statusChart) charts.statusChart.destroy();

    const valueData = items.reduce((acc, item) => {
        const value = item.quantity * item.costPrice;
        acc['Valor Total em Stock'] = (acc['Valor Total em Stock'] || 0) + value;
        return acc;
    }, {});
    const valueCtx = document.getElementById('valueChart').getContext('2d');
    charts.valueChart = new Chart(valueCtx, {
        type: 'doughnut',
        data: { labels: Object.keys(valueData), datasets: [{ data: Object.values(valueData), backgroundColor: ['#FACC15', '#374151', '#9CA3AF'] }] },
        options: { responsive: true, maintainAspectRatio: false }
    });

    const statusData = items.reduce((acc, item) => {
        const status = getStatus(item).text;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, { 'OK': 0, 'Baixo': 0, 'Crítico': 0, 'Esgotado': 0 });
    const statusCtx = document.getElementById('statusChart').getContext('2d');
    charts.statusChart = new Chart(statusCtx, {
        type: 'bar',
        data: { labels: Object.keys(statusData), datasets: [{ label: 'Nº de Itens', data: Object.values(statusData), backgroundColor: ['#22C55E', '#F97316', '#EF4444', '#6B7280'] }] },
        options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y' }
    });

    renderReportsMovements();
}

function renderReportsMovements() {
    const container = document.getElementById('reports-movements-history');
    container.innerHTML = '';
    const recentMovements = [...movements].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
    if (recentMovements.length === 0) {
        container.innerHTML = `<p class="text-secondary text-center py-4">Nenhuma movimentação registada.</p>`;
        return;
    }
    recentMovements.forEach(mov => {
        const item = items.find(i => i.id === mov.itemId);
        const div = document.createElement('div');
        div.className = `report-movement-item ${mov.type}`;
        div.innerHTML = `
            <div class="movement-info">
                <span class="movement-name">${item ? escapeHTML(item.name) : 'Item Excluído'}</span>
                <span class="movement-qty">(${mov.quantity} un.)</span>
                ${mov.operationId ? `<span class="movement-op">(${escapeHTML(mov.operationId)})</span>` : ''}
            </div>
            <span class="movement-date">${new Date(mov.date).toLocaleString('pt-BR')}</span>
        `;
        container.appendChild(div);
    });
}

function renderProductAnalysisReports() {
    const periodDays = document.getElementById('reports-period-filter').value;
    const now = new Date();
    const startDate = new Date();
    if (periodDays !== 'all') {
        startDate.setDate(now.getDate() - parseInt(periodDays));
    }

    const filteredMovements = (periodDays === 'all')
        ? movements.filter(m => m.type === 'out')
        : movements.filter(m => m.type === 'out' && new Date(m.date) >= startDate);

    const salesByQuantity = filteredMovements.reduce((acc, mov) => {
        acc[mov.itemId] = (acc[mov.itemId] || 0) + mov.quantity;
        return acc;
    }, {});

    const topSelling = Object.entries(salesByQuantity)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

    const leastSelling = Object.entries(salesByQuantity)
        .sort(([, a], [, b]) => a - b)
        .slice(0, 5);

    const packageFormatter = (itemId, value) => {
        const item = items.find(i => i.id === itemId);
        if (!item || !item.unitsPerPackage) {
            return `${value} un.`;
        }
        const packagesSold = Math.floor(value / item.unitsPerPackage);
        const packageLabel = item.packageType === 'fardo' ? (packagesSold > 1 ? 'fardos' : 'fardo') : (packagesSold > 1 ? 'caixas' : 'caixa');
        return `${packagesSold} ${packageLabel}`;
    };

    renderRankingList('top-selling-items', topSelling, 'embalagens vendidas', packageFormatter);
    renderRankingList('least-selling-items', leastSelling, 'embalagens vendidas', packageFormatter);
}

function renderRankingList(containerId, data, label, formatter) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    if (data.length === 0) {
        container.innerHTML = `<p class="text-secondary text-center py-4">Nenhum dado para o período selecionado.</p>`;
        return;
    }
    const maxValue = data.length > 0 ? data[0][1] : 0;
    data.forEach(([itemId, value]) => {
        const item = items.find(i => i.id === itemId);
        if (!item) return;
        const percentage = maxValue > 0 ? (value / maxValue * 100) : 0;
        const formattedValue = formatter(itemId, value);
        const div = document.createElement('div');
        div.className = 'ranking-item';
        div.innerHTML = `
            <div class="ranking-header">
                <span class="ranking-name">${escapeHTML(item.name)}</span>
                <span class="ranking-value">${formattedValue}</span>
            </div>
            <div class="ranking-bar-background">
                <div class="ranking-bar-foreground" style="width: ${percentage}%"></div>
            </div>
        `;
        container.appendChild(div);
    });
}

function renderDailyMovementsReport() {
    const container = document.getElementById('daily-movements-list');
    const startDateVal = document.getElementById('report-start-date').value;
    const endDateVal = document.getElementById('report-end-date').value;

    if (!startDateVal || !endDateVal) return;

    const startDate = new Date(startDateVal + 'T00:00:00');
    const endDate = new Date(endDateVal + 'T23:59:59.999');

    container.innerHTML = '';

    const filteredMovements = movements
        .filter(mov => {
            const movDate = new Date(mov.date);
            return movDate >= startDate && movDate <= endDate;
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filteredMovements.length === 0) {
        container.innerHTML = `<div class="panel-empty-state">
            <i data-feather="calendar"></i>
            <p>Nenhuma movimentação para este período.</p>
        </div>`;
        feather.replace();
        return;
    }

    filteredMovements.forEach(mov => {
        const item = items.find(i => i.id === mov.itemId);
        const supplier = item ? suppliers.find(s => s.id === item.supplierId) : null;

        const isOut = mov.type === 'out';
        const sign = isOut ? '-' : '+';

        const card = document.createElement('div');
        card.className = `daily-movement-card ${mov.type}`;

        card.innerHTML = `
            <div class="movement-icon"><i data-feather="${isOut ? 'arrow-up-circle' : 'arrow-down-circle'}"></i></div>
            <div class="movement-details">
                <div class="movement-header">
                    <span class="movement-name">${item ? escapeHTML(item.name) : 'Item Excluído'}</span>
                    <span class="movement-time">${new Date(mov.date).toLocaleDateString('pt-BR')} ${new Date(mov.date).toLocaleTimeString('pt-BR')}</span>
                </div>
                <p class="movement-reason">${escapeHTML(mov.reason || 'N/A')}</p>
                <div class="movement-stats">
                    <div><strong>Qtd:</strong> ${sign}${mov.quantity} un.</div>
                    <div><strong>Valor:</strong> ${formatCurrency(mov.price, 'BRL')}</div>
                    <div><strong>Total:</strong> ${formatCurrency(mov.price * mov.quantity, 'BRL')}</div>
                    <div><strong>Fornecedor:</strong> ${supplier ? escapeHTML(supplier.name) : 'N/A'}</div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
    feather.replace();
}
function renderFiscalReport() {
    if (charts.supplierSpendingChart) charts.supplierSpendingChart.destroy();

    const selectedYear = parseInt(document.getElementById('fiscal-year-filter').value);
    const selectedSupplierFilter = document.getElementById('fiscal-supplier-filter').value;
    const container = document.getElementById('fiscal-invoices-list');
    container.innerHTML = '';

    const allInvoicesForYear = [];
    const availableSuppliers = new Set();

    // 1. First Pass: Collect all relevant movements for the year to build full dataset and supplier list
    movements.forEach(mov => {
        if (mov.type !== 'in') return;
        const movDate = new Date(mov.date);
        if (movDate.getFullYear() !== selectedYear) return;

        const nfMatch = (mov.reason || '').match(/(?:NF-e|Nota Fiscal|NF):?\s*(\d+)/i);
        if (!nfMatch) return;

        const nfNumber = nfMatch[1];
        const itemId = mov.itemId || mov.item_id;
        const item = items.find(i => i.id == itemId);
        const supplierId = item ? (item.supplierId || item.supplier_id) : 'unknown';
        const supplier = suppliers.find(s => s.id == supplierId);
        const supplierName = supplier ? supplier.name : 'Fornecedor Desconhecido';

        if (supplierName !== 'Fornecedor Desconhecido') {
            availableSuppliers.add(supplierName);
        }

        allInvoicesForYear.push({
            nfNumber,
            supplierName,
            supplierId,
            date: mov.date,
            totalValue: mov.quantity * mov.price
        });
    });

    // 2. Populate Supplier Filter (if necessary)
    // We strictly should only update if the year changed, but checking "if options match availableSuppliers" is safer.
    // Simplest approach: Clear and rebuild, adhering to current selection.
    const supplierFilter = document.getElementById('fiscal-supplier-filter');
    const previousSelection = supplierFilter.value;

    // Sort suppliers alphabetically
    const sortedAvailableSuppliers = Array.from(availableSuppliers).sort();

    // Only rebuild if the list is different (optimization) or just rebuild always for safety on year change.
    // Let's rebuild always to ensure correctness for the selected year.
    supplierFilter.innerHTML = '<option value="">Todos os Fornecedores</option>';
    sortedAvailableSuppliers.forEach(supName => {
        const option = document.createElement('option');
        option.value = supName;
        option.textContent = supName;
        supplierFilter.appendChild(option);
    });

    // Restore selection if it's still valid
    if (previousSelection && sortedAvailableSuppliers.includes(previousSelection)) {
        supplierFilter.value = previousSelection;
    } else {
        supplierFilter.value = ""; // Reset to all if selected supplier is not in this year
    }

    // 3. Process Data for Display (Filtering)
    const filteredInvoicesMap = {};
    const supplierSpending = {};
    const currentFilter = supplierFilter.value; // Use the actual value after update

    allInvoicesForYear.forEach(invoice => {
        if (currentFilter && invoice.supplierName !== currentFilter) return;

        const key = `${invoice.nfNumber}_${invoice.supplierId}`;
        if (!filteredInvoicesMap[key]) {
            filteredInvoicesMap[key] = {
                number: invoice.nfNumber,
                supplier: invoice.supplierName,
                date: invoice.date,
                total: 0
            };
        }
        filteredInvoicesMap[key].total += invoice.totalValue;

        supplierSpending[invoice.supplierName] = (supplierSpending[invoice.supplierName] || 0) + invoice.totalValue;
    });

    const sortedInvoices = Object.values(filteredInvoicesMap).sort((a, b) => new Date(b.date) - new Date(a.date));

    if (sortedInvoices.length === 0) {
        container.innerHTML = `<div class="panel-empty-state">
            <i data-feather="file-text"></i>
            <p>Nenhuma nota fiscal encontrada para ${selectedYear}${currentFilter ? ' com este fornecedor' : ''}.</p>
        </div>`;
    } else {
        const table = document.createElement('table');
        table.className = 'w-full text-left border-collapse';
        table.innerHTML = `
            <thead>
                <tr>
                    <th class="p-3 border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wider">Data</th>
                    <th class="p-3 border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wider">Nota Fiscal</th>
                    <th class="p-3 border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wider">Fornecedor</th>
                    <th class="p-3 border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">Valor Total</th>
                </tr>
            </thead>
            <tbody>
                ${sortedInvoices.map(inv => `
                    <tr class="hover:bg-gray-50 transition-colors">
                        <td class="p-3 border-b border-gray-200 text-sm text-gray-700">${new Date(inv.date).toLocaleDateString('pt-BR')}</td>
                        <td class="p-3 border-b border-gray-200 text-sm font-medium text-gray-900">${inv.number}</td>
                        <td class="p-3 border-b border-gray-200 text-sm text-gray-700">${inv.supplier}</td>
                        <td class="p-3 border-b border-gray-200 text-sm font-bold text-gray-900 text-right">${formatCurrency(inv.total, 'BRL')}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        container.appendChild(table);
    }
    feather.replace();

    // Render Chart
    const chartCtx = document.getElementById('supplierSpendingChart').getContext('2d');
    const sortedSuppliers = Object.entries(supplierSpending).sort(([, a], [, b]) => b - a); // Top spenders first

    charts.supplierSpendingChart = new Chart(chartCtx, {
        type: 'bar',
        data: {
            labels: sortedSuppliers.map(([name]) => name),
            datasets: [{
                label: 'Total Gasto (R$)',
                data: sortedSuppliers.map(([, value]) => value),
                backgroundColor: '#3B82F6',
                borderColor: '#2563EB',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return 'R$ ' + value; // Simple currency format
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

export { openReportsModal, switchReportTab, renderProductAnalysisReports, renderDailyMovementsReport, renderFiscalReport };