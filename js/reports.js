import { items, movements, operationsHistory } from './database.js';
import { openModal, closeModal } from './ui.js';
import { editOperation } from './operations.js';

window.editOperation = editOperation;

let charts = {};

function openReportsModal() {
    if (!checkPermission('reports')) {
        showNotification('Não tem permissão para ver relatórios.', 'danger');
        return;
    }
    openModal('reports-modal');
    switchReportTab(document.querySelector('#reports-tab-nav .report-tab'), 'overview');
}

function switchReportTab(button, tabName) {
    document.querySelectorAll('.report-tab').forEach(tab => tab.classList.remove('active'));
    button.classList.add('active');
    document.querySelectorAll('.report-tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');

    if (tabName === 'overview') {
        setTimeout(renderOverviewReports, 100);
    } else if (tabName === 'products') {
        renderProductAnalysisReports();
    } else if (tabName === 'history') {
        renderOperationsHistory();
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
        data: { labels: Object.keys(valueData), datasets: [{ data: Object.values(valueData), backgroundColor: ['#4f46e5', '#f97316', '#22c55e'] }] },
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
        data: { labels: Object.keys(statusData), datasets: [{ label: 'Nº de Itens', data: Object.values(statusData), backgroundColor: ['#22c55e', '#f97316', '#ef4444', '#6b7280'] }] },
        options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y' }
    });
    
    renderReportsMovements();
}

function renderReportsMovements() {
    const container = document.getElementById('reports-movements-history');
    container.innerHTML = '';
    const recentMovements = [...movements].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
    if(recentMovements.length === 0) {
        container.innerHTML = `<p class="text-secondary text-center py-4">Nenhuma movimentação registada.</p>`;
        return;
    }
    recentMovements.forEach(mov => {
        const item = items.find(i => i.id === mov.itemId);
        const div = document.createElement('div');
        div.className = `p-3 rounded-md border-l-4 ${mov.type === 'in' ? 'bg-blue-50 border-blue-500' : 'bg-red-50 border-red-500'}`;
        div.innerHTML = `
            <div class="flex justify-between items-start text-sm">
                <div class="flex-grow pr-2">
                    <span class="font-bold">${item ? item.name : 'Item Excluído'}</span>
                    <span class="text-secondary">(${mov.quantity} un.)</span>
                     ${mov.operationId ? `<span class="text-xs text-blue-600 ml-2">(${mov.operationId})</span>` : ''}
                </div>
                <span class="text-xs text-secondary flex-shrink-0 whitespace-nowrap">${new Date(mov.date).toLocaleString('pt-BR')}</span>
            </div>
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
        div.innerHTML = `
            <div class="flex justify-between items-center mb-1">
                <span class="text-sm font-medium text-gray-700">${item.name}</span>
                <span class="text-sm font-bold text-primary-DEFAULT">${formattedValue}</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="bg-primary-DEFAULT h-2 rounded-full" style="width: ${percentage}%"></div>
            </div>
        `;
        container.appendChild(div);
    });
}

function renderOperationsHistory() {
    const container = document.getElementById('operations-history-list');
    container.innerHTML = '';

    if (operationsHistory.length === 0) {
        container.innerHTML = `<p class="text-secondary text-center">Nenhuma operação foi finalizada ainda.</p>`;
        return;
    }

    operationsHistory.forEach(op => {
        const div = document.createElement('div');
        div.className = 'p-3 rounded-md bg-gray-50 border flex flex-col sm:flex-row justify-between items-start sm:items-center';
        div.innerHTML = `
            <div>
                <p class="font-bold">${op.id}</p>
                <p class="text-sm text-secondary">${new Date(op.date).toLocaleString('pt-BR')}</p>
            </div>
            <div class="flex space-x-2 mt-2 sm:mt-0">
                <button onclick="editOperation('${op.id}')" class="btn btn-sm btn-secondary"><i class="fas fa-edit mr-2"></i>Editar</button>
                <button onclick="regenerateDocument('${op.id}', 'invoice')" class="btn btn-sm btn-secondary"><i class="fas fa-file-invoice-dollar mr-2"></i>Fatura</button>
                <button onclick="regenerateDocument('${op.id}', 'packlist')" class="btn btn-sm btn-secondary"><i class="fas fa-box-open mr-2"></i>Lista de Embalagem</button>
            </div>
        `;
        container.appendChild(div);
    });
}

export { openReportsModal, switchReportTab, renderProductAnalysisReports };
