import { items, movements, suppliers } from './database.js';
import { openModal, closeModal, getStatus, formatCurrency } from './ui.js';
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
        const datePicker = document.getElementById('daily-movements-date-picker');
        if (!datePicker.value) {
            datePicker.value = new Date().toISOString().split('T')[0];
        }
        renderDailyMovementsReport();
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
    const recentMovements = [...movements].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
    if(recentMovements.length === 0) {
        container.innerHTML = `<p class="text-secondary text-center py-4">Nenhuma movimentação registada.</p>`;
        return;
    }
    recentMovements.forEach(mov => {
        const item = items.find(i => i.id === mov.itemId);
        const div = document.createElement('div');
        div.className = `report-movement-item ${mov.type}`;
        div.innerHTML = `
            <div class="movement-info">
                <span class="movement-name">${item ? item.name : 'Item Excluído'}</span>
                <span class="movement-qty">(${mov.quantity} un.)</span>
                ${mov.operationId ? `<span class="movement-op">(${mov.operationId})</span>` : ''}
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
                <span class="ranking-name">${item.name}</span>
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
    const datePicker = document.getElementById('daily-movements-date-picker');
    const selectedDate = new Date(datePicker.value + 'T00:00:00');

    container.innerHTML = '';

    const startOfDay = new Date(selectedDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(selectedDate.setHours(23, 59, 59, 999));

    const filteredMovements = movements
        .filter(mov => {
            const movDate = new Date(mov.date);
            return movDate >= startOfDay && movDate <= endOfDay;
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filteredMovements.length === 0) {
        container.innerHTML = `<div class="panel-empty-state">
            <i data-feather="calendar"></i>
            <p>Nenhuma movimentação para esta data.</p>
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
                    <span class="movement-name">${item ? item.name : 'Item Excluído'}</span>
                    <span class="movement-time">${new Date(mov.date).toLocaleTimeString('pt-BR')}</span>
                </div>
                <p class="movement-reason">${mov.reason || 'N/A'}</p>
                <div class="movement-stats">
                    <div><strong>Qtd:</strong> ${sign}${mov.quantity} un.</div>
                    <div><strong>Valor:</strong> ${formatCurrency(mov.price, 'BRL')}</div>
                    <div><strong>Total:</strong> ${formatCurrency(mov.price * mov.quantity, 'BRL')}</div>
                    <div><strong>Fornecedor:</strong> ${supplier ? supplier.name : 'N/A'}</div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
    feather.replace();
}

export { openReportsModal, switchReportTab, renderProductAnalysisReports, renderDailyMovementsReport };