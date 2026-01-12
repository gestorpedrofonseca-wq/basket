/**
 * BasketBet Admin - Premium Features
 * Lógica para Saques, Depósitos e Analytics Avançadas
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('Admin Premium Features Loading...');

    // ===== WITHDRAWALS MANAGEMENT =====
    function loadWithdrawals() {
        const tbody = document.getElementById('withdrawals-table-body');
        if (!tbody) return;

        const withdrawals = DB.getWithdrawals();
        tbody.innerHTML = '';

        if (withdrawals.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-state">
                    <td colspan="7">
                        <div class="empty-illustration">
                            <i class="fa-solid fa-inbox"></i>
                            <p>Nenhuma solicitação de saque encontrada</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        // Update stats
        const pending = withdrawals.filter(w => w.status === 'pending');
        document.getElementById('pending-withdrawals-count').textContent = pending.length;

        const today = new Date().toDateString();
        const todayWithdrawals = withdrawals.filter(w => new Date(w.date).toDateString() === today);
        const todayTotal = todayWithdrawals.reduce((sum, w) => sum + w.amount, 0);
        document.getElementById('today-withdrawals-total').textContent = 'R$ ' + todayTotal.toFixed(2);

        withdrawals.forEach(w => {
            const tr = document.createElement('tr');
            tr.dataset.status = w.status;

            const statusBadge = w.status === 'pending' ? 'pending' : w.status === 'approved' ? 'approved' : 'rejected';
            const statusText = w.status === 'pending' ? 'Pendente' : w.status === 'approved' ? 'Aprovado' : 'Rejeitado';

            let actions = '';
            if (w.status === 'pending') {
                actions = `
                    <button class="btn-action" style="background:#00d26a;" onclick="approveWithdrawal('${w.id}')">
                        <i class="fa fa-check"></i> Aprovar
                    </button>
                    <button class="btn-action" style="background:#f53d3d;" onclick="rejectWithdrawal('${w.id}')">
                        <i class="fa fa-times"></i> Rejeitar
                    </button>
                `;
            } else {
                actions = '<span style="color:#666;">-</span>';
            }

            tr.innerHTML = `
                <td style="font-family:monospace; font-size:0.8rem;">${w.id.substring(0, 8)}</td>
                <td>${new Date(w.date).toLocaleString('pt-BR')}</td>
                <td><strong>${w.player}</strong></td>
                <td style="font-family:monospace; color:#4a90e2;">${w.pixKey}</td>
                <td style="color:#f53d3d; font-weight:bold; font-size:1.1rem;">R$ ${w.amount.toFixed(2)}</td>
                <td><span class="status-badge ${statusBadge}">${statusText}</span></td>
                <td>${actions}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.approveWithdrawal = function (id) {
        if (confirm('Confirmar aprovação deste saque?')) {
            if (DB.approveWithdrawal(id)) {
                showToast('Saque aprovado com sucesso!', 'success');
                loadWithdrawals();
            }
        }
    };

    window.rejectWithdrawal = function (id) {
        if (confirm('Rejeitar este saque? O valor será estornado ao jogador.')) {
            if (DB.rejectWithdrawal(id)) {
                showToast('Saque rejeitado e valor estornado!', 'success');
                loadWithdrawals();
            }
        }
    };

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filter = btn.dataset.filter;
            const rows = document.querySelectorAll('#withdrawals-table-body tr');

            rows.forEach(row => {
                if (filter === 'all') {
                    row.style.display = '';
                } else {
                    row.style.display = row.dataset.status === filter ? '' : 'none';
                }
            });
        });
    });

    // ===== DEPOSITS MANAGEMENT =====
    function loadDeposits() {
        const tbody = document.getElementById('deposits-table-body');
        if (!tbody) return;

        const deposits = DB.getDeposits();
        tbody.innerHTML = '';

        if (deposits.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-state">
                    <td colspan="5">
                        <div class="empty-illustration">
                            <i class="fa-solid fa-wallet"></i>
                            <p>Nenhum depósito registrado</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        // Calculate stats
        const totalDeposits = deposits.reduce((sum, d) => sum + d.amount, 0);
        const uniquePlayers = [...new Set(deposits.map(d => d.player))].length;
        const maxDeposit = Math.max(...deposits.map(d => d.amount));
        const avgDeposit = totalDeposits / deposits.length;

        const today = new Date().toDateString();
        const todayDeposits = deposits.filter(d => new Date(d.date).toDateString() === today);

        // Update stats
        document.getElementById('total-deposits-amount').textContent = 'R$ ' + totalDeposits.toFixed(2);
        document.getElementById('today-deposits-count').textContent = todayDeposits.length;
        document.getElementById('avg-deposit').textContent = 'R$ ' + avgDeposit.toFixed(2);
        document.getElementById('unique-depositors').textContent = uniquePlayers;
        document.getElementById('max-deposit').textContent = 'R$ ' + maxDeposit.toFixed(2);

        deposits.forEach(d => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-family:monospace; font-size:0.8rem; color:#888;">${d.id}</td>
                <td>${new Date(d.date).toLocaleString('pt-BR')}</td>
                <td><strong>${d.player}</strong></td>
                <td style="color:#00d26a; font-weight:bold; font-size:1.1rem;">R$ ${d.amount.toFixed(2)}</td>
                <td><span class="status-badge approved">Confirmado</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    // ===== RTP GAUGE UPDATE =====
    function updateRTPGauge(value) {
        const gauge = document.getElementById('gauge-progress');
        const display = document.getElementById('rtp-display');

        if (gauge && display) {
            const circumference = 2 * Math.PI * 90; // r=90
            const offset = circumference - (value / 100) * circumference;
            gauge.style.strokeDashoffset = offset;
            display.textContent = value + '%';

            // Color based on value
            if (value < 20) {
                gauge.style.stroke = '#f53d3d';
                display.style.color = '#f53d3d';
            } else if (value < 50) {
                gauge.style.stroke = '#ffa500';
                display.style.color = '#ffa500';
            } else if (value < 75) {
                gauge.style.stroke = '#00d26a';
                display.style.color = '#00d26a';
            } else {
                gauge.style.stroke = '#4a90e2';
                display.style.color = '#4a90e2';
            }
        }
    }

    // RTP Slider
    const rtpSlider = document.getElementById('rtp-slider');
    if (rtpSlider) {
        const config = DB.getConfig();
        rtpSlider.value = config.rtp;
        updateRTPGauge(config.rtp);

        rtpSlider.addEventListener('input', (e) => {
            updateRTPGauge(e.target.value);
        });
    }

    // ===== ANALYTICS CHARTS =====
    function renderAnalyticsCharts() {
        const history = JSON.parse(localStorage.getItem(DB.KEYS.HISTORY) || '[]');

        // Win/Loss Chart
        const winLossCtx = document.getElementById('winLossChart');
        if (winLossCtx) {
            const wins = history.filter(h => h.isWin).length;
            const losses = history.length - wins;

            new Chart(winLossCtx.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: ['Vitórias', 'Derrotas'],
                    datasets: [{
                        data: [wins, losses],
                        backgroundColor: ['#00d26a', '#f53d3d'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: 'white', font: { size: 14 } }
                        }
                    }
                }
            });

            document.getElementById('total-wins').textContent = wins;
            document.getElementById('total-losses').textContent = losses;
        }

        // Revenue Over Time
        const revenueCtx = document.getElementById('revenueOverTimeChart');
        if (revenueCtx) {
            const last7Days = history.slice(0, 50).reverse();
            const labels = last7Days.map(h => new Date(h.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
            const revenue = last7Days.map(h => h.isWin ? -(h.win - h.bet) : h.bet);
            const bets = last7Days.map(h => h.bet);

            new Chart(revenueCtx.getContext('2d'), {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Receita',
                            data: revenue,
                            borderColor: '#00d26a',
                            backgroundColor: 'rgba(0,210,106,0.1)',
                            tension: 0.4,
                            fill: true
                        },
                        {
                            label: 'Apostas',
                            data: bets,
                            borderColor: '#4a90e2',
                            backgroundColor: 'rgba(74,144,226,0.1)',
                            tension: 0.4,
                            fill: true
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#999' } },
                        x: { grid: { display: false }, ticks: { color: '#999' } }
                    }
                }
            });
        }

        // Funnel Chart
        const funnelCtx = document.getElementById('funnelChart');
        if (funnelCtx) {
            const players = DB.getPlayers();
            const leads = DB.getLeads();
            const active = players.filter(p => p.totalWagered > 0).length;

            new Chart(funnelCtx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: ['Visitantes', 'Cadastros', 'Depositantes'],
                    datasets: [{
                        data: [500, leads.length, active],
                        backgroundColor: ['#4a90e2', '#ffa500', '#00d26a'],
                        borderRadius: 8
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { display: false },
                        y: { grid: { display: false }, ticks: { color: 'white' } }
                    }
                }
            });
        }

        // Peak Hours (Mock)
        const peakCtx = document.getElementById('peakHoursChart');
        if (peakCtx) {
            new Chart(peakCtx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: ['00h', '04h', '08h', '12h', '16h', '20h'],
                    datasets: [{
                        label: 'Apostas',
                        data: [12, 5, 18, 45, 78, 92],
                        backgroundColor: 'rgba(255,107,53,0.8)',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#999' } },
                        x: { grid: { display: false }, ticks: { color: '#999' } }
                    }
                }
            });
        }

        // Devices (Mock)
        const devicesCtx = document.getElementById('devicesChart');
        if (devicesCtx) {
            new Chart(devicesCtx.getContext('2d'), {
                type: 'pie',
                data: {
                    labels: ['Mobile', 'Desktop', 'Tablet'],
                    datasets: [{
                        data: [65, 30, 5],
                        backgroundColor: ['#00d26a', '#4a90e2', '#ffa500']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { color: 'white' } }
                    }
                }
            });
        }

        // RTP History
        const rtpHistoryCtx = document.getElementById('rtpHistoryChart');
        if (rtpHistoryCtx) {
            new Chart(rtpHistoryCtx.getContext('2d'), {
                type: 'line',
                data: {
                    labels: ['00h', '04h', '08h', '12h', '16h', '20h', '24h'],
                    datasets: [{
                        label: 'RTP Efetivo (%)',
                        data: [10, 12, 15, 18, 14, 11, 10],
                        borderColor: '#ff6b35',
                        backgroundColor: 'rgba(255,107,53,0.1)',
                        tension: 0.4,
                        fill: true,
                        borderWidth: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            min: 0,
                            max: 100,
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            ticks: { color: '#999', callback: (value) => value + '%' }
                        },
                        x: { grid: { display: false }, ticks: { color: '#999' } }
                    }
                }
            });
        }
    }

    // ===== LEADS MANAGEMENT =====
    let allLeadsData = []; // Store for filtering

    function loadLeads() {
        const tbody = document.getElementById('leads-table-body');
        if (!tbody) return;

        const leads = DB.getLeads();
        const players = DB.getPlayers();
        allLeadsData = []; // Reset
        tbody.innerHTML = '';

        if (leads.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-state">
                    <td colspan="7">
                        <div class="empty-illustration">
                            <i class="fa-solid fa-address-book"></i>
                            <p>Nenhum lead cadastrado</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        // Calculate stats
        const today = new Date().toDateString();
        const leadsToday = leads.filter(l => new Date(l.date).toDateString() === today);
        const converted = leads.filter(l => {
            const player = players.find(p => p.name === l.name);
            return player && player.totalWagered > 0;
        });
        const pending = leads.length - converted.length;
        const conversionRate = leads.length > 0 ? ((converted.length / leads.length) * 100).toFixed(1) : 0;

        // Update stats
        document.getElementById('total-leads-count').textContent = leads.length;
        document.getElementById('leads-conversion-rate').textContent = conversionRate + '%';
        document.getElementById('leads-today').textContent = leadsToday.length;
        document.getElementById('leads-converted').textContent = converted.length;
        document.getElementById('leads-pending').textContent = pending;

        leads.forEach(lead => {
            const player = players.find(p => p.name === lead.name);
            const hasDeposited = player && player.totalWagered > 0;
            const firstDeposit = hasDeposited ? 'R$ ' + (player.totalWagered * 0.1).toFixed(2) : '-';
            const status = hasDeposited ? 'Convertido' : 'Pendente';
            const statusClass = hasDeposited ? 'approved' : 'pending';

            // Store for filtering
            allLeadsData.push({
                lead: lead,
                player: player,
                status: status.toLowerCase(),
                hasDeposited: hasDeposited
            });

            const tr = document.createElement('tr');
            tr.dataset.leadStatus = status.toLowerCase();
            tr.innerHTML = `
                <td>${new Date(lead.date).toLocaleDateString('pt-BR')}</td>
                <td><strong>${lead.name}</strong></td>
                <td>${lead.phone || '-'}</td>
                <td>${lead.email || '-'}</td>
                <td><span class="status-badge ${statusClass}">${status}</span></td>
                <td style="color:#00d26a; font-weight:bold;">${firstDeposit}</td>
                <td>
                    <button class="btn-action view-lead-btn" style="background:#4a90e2;" data-lead-name="${lead.name}">
                        <i class="fa fa-eye"></i> Ver
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Attach event listeners to "Ver" buttons
        document.querySelectorAll('.view-lead-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const leadName = e.currentTarget.dataset.leadName;
                openLeadModal(leadName);
            });
        });
    }

    // Open Lead Modal
    function openLeadModal(leadName) {
        const leads = DB.getLeads();
        const players = DB.getPlayers();
        const lead = leads.find(l => l.name === leadName);
        const player = players.find(p => p.name === leadName);

        if (!lead) return;

        const modal = document.getElementById('lead-modal');
        const hasDeposited = player && player.totalWagered > 0;

        // Fill modal data
        document.getElementById('lead-name').textContent = lead.name;
        document.getElementById('lead-date').textContent = new Date(lead.date).toLocaleString('pt-BR');
        document.getElementById('lead-phone').textContent = lead.phone || 'Não informado';
        document.getElementById('lead-email').textContent = lead.email || 'Não informado';

        const statusBadge = hasDeposited
            ? '<span class="status-badge approved">Convertido</span>'
            : '<span class="status-badge pending">Pendente</span>';
        document.getElementById('lead-status').innerHTML = statusBadge;

        const firstDeposit = hasDeposited ? 'R$ ' + (player.totalWagered * 0.1).toFixed(2) : 'Nenhum depósito';
        document.getElementById('lead-first-deposit').textContent = firstDeposit;

        // Show player stats if converted
        const playerStatsSection = document.getElementById('lead-player-stats');
        if (hasDeposited && player) {
            playerStatsSection.classList.remove('hidden');
            document.getElementById('lead-player-balance').textContent = 'R$ ' + player.balance.toFixed(2);
            document.getElementById('lead-player-wagered').textContent = 'R$ ' + player.totalWagered.toFixed(2);
            document.getElementById('lead-player-won').textContent = 'R$ ' + player.totalWon.toFixed(2);
            document.getElementById('lead-player-winrate').textContent = (player.winRate || 0) + '%';
        } else {
            playerStatsSection.classList.add('hidden');
        }

        // Show modal
        modal.classList.remove('hidden');
    }

    // Close Lead Modal
    document.querySelectorAll('.btn-close-lead-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('lead-modal').classList.add('hidden');
        });
    });

    // Lead Actions
    document.getElementById('btn-contact-lead')?.addEventListener('click', () => {
        const phone = document.getElementById('lead-phone').textContent;
        if (phone && phone !== 'Não informado') {
            window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
        } else {
            alert('Telefone não disponível');
        }
    });

    document.getElementById('btn-send-email-lead')?.addEventListener('click', () => {
        const email = document.getElementById('lead-email').textContent;
        if (email && email !== 'Não informado') {
            window.location.href = `mailto:${email}`;
        } else {
            alert('Email não disponível');
        }
    });

    // Export Leads to CSV
    document.getElementById('export-leads-csv')?.addEventListener('click', () => {
        const leads = DB.getLeads();
        const players = DB.getPlayers();

        if (leads.length === 0) {
            alert('Nenhum lead para exportar');
            return;
        }

        // CSV Header
        let csv = 'Data Cadastro,Nome,Telefone,Email,Status,Primeiro Depósito,Total Apostado,Saldo Atual\n';

        // CSV Rows
        leads.forEach(lead => {
            const player = players.find(p => p.name === lead.name);
            const hasDeposited = player && player.totalWagered > 0;
            const status = hasDeposited ? 'Convertido' : 'Pendente';
            const firstDeposit = hasDeposited ? (player.totalWagered * 0.1).toFixed(2) : '0.00';
            const totalWagered = player ? player.totalWagered.toFixed(2) : '0.00';
            const balance = player ? player.balance.toFixed(2) : '0.00';

            csv += `${new Date(lead.date).toLocaleDateString('pt-BR')},`;
            csv += `${lead.name},`;
            csv += `${lead.phone || '-'},`;
            csv += `${lead.email || '-'},`;
            csv += `${status},`;
            csv += `${firstDeposit},`;
            csv += `${totalWagered},`;
            csv += `${balance}\n`;
        });

        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `leads_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('Leads exportados com sucesso!', 'success');
    });

    // Filter Leads
    document.querySelectorAll('#leads .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            document.querySelectorAll('#leads .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filter = btn.dataset.filter;
            const rows = document.querySelectorAll('#leads-table-body tr');

            rows.forEach(row => {
                if (filter === 'all') {
                    row.style.display = '';
                } else {
                    const status = row.dataset.leadStatus;
                    row.style.display = status === filter ? '' : 'none';
                }
            });
        });
    });

    // ===== INIT =====
    function initPremiumFeatures() {
        loadWithdrawals();
        loadDeposits();
        loadLeads();

        // Delay chart rendering to ensure canvas elements are ready
        setTimeout(() => {
            if (typeof Chart !== 'undefined') {
                renderAnalyticsCharts();
            }
        }, 500);
    }

    // Helper toast
    function showToast(msg, type) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed; top: 90px; right: 20px; z-index: 9999;
            background: ${type === 'success' ? '#00d26a' : '#f53d3d'};
            color: white; padding: 1rem 1.5rem; border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            animation: slideIn 0.3s forwards;
        `;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // Run init
    initPremiumFeatures();

    console.log('Admin Premium Features Loaded ✓');
});
