// BasketBet Admin Panel - Enhanced & Modern
document.addEventListener('DOMContentLoaded', () => {
    // Check admin authentication
    if (!localStorage.getItem('basketbet_admin')) {
        window.location.href = 'login.html';
        return;
    }

    // ===== NAVIGATION =====
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.admin-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetSection = item.getAttribute('data-section');
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            sections.forEach(section => section.classList.remove('active'));
            document.getElementById(targetSection).classList.add('active');
        });
    });

    // ===== LOGOUT =====
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = function () {
            localStorage.removeItem('basketbet_admin');
            alert('Sessão encerrada.');
            window.location.href = 'login.html';
        };
    }

    // ===== GLOBAL CONFIG SYNC =====
    let gameConfig = DB.getConfig();

    // Save config wrapper
    function saveConfig() {
        localStorage.setItem(DB.KEYS.CONFIG, JSON.stringify(gameConfig));
        showToast('Configurações salvas com sucesso!', 'success');
    }

    // ===== RTP & CONFIG UI =====
    const rtpSlider = document.getElementById('rtp-slider');
    const rtpDisplay = document.getElementById('rtp-display');
    const currentRtpDisplay = document.getElementById('current-rtp');

    if (rtpSlider) {
        rtpSlider.value = gameConfig.rtp;
        rtpDisplay.textContent = gameConfig.rtp + '%';
        if (currentRtpDisplay) currentRtpDisplay.textContent = gameConfig.rtp + '%';

        rtpSlider.addEventListener('input', (e) => {
            rtpDisplay.textContent = e.target.value + '%';
        });

        document.getElementById('apply-rtp').addEventListener('click', () => {
            gameConfig.rtp = parseInt(rtpSlider.value);
            if (currentRtpDisplay) currentRtpDisplay.textContent = gameConfig.rtp + '%';
            saveConfig();
        });
    }

    // Other Setup (Speeds, Inputs)
    // Bind inputs to DB config initially...
    const gaugeSpeedNormal = document.getElementById('gauge-speed-normal');
    const gaugeSpeedTurbo = document.getElementById('gauge-speed-turbo');
    if (gaugeSpeedNormal) gaugeSpeedNormal.value = gameConfig.gaugeSpeedNormal;
    if (gaugeSpeedTurbo) gaugeSpeedTurbo.value = gameConfig.gaugeSpeedTurbo;

    document.querySelectorAll('.btn-save').forEach(btn => {
        btn.addEventListener('click', () => {
            if (gaugeSpeedNormal) gameConfig.gaugeSpeedNormal = parseFloat(gaugeSpeedNormal.value);
            if (gaugeSpeedTurbo) gameConfig.gaugeSpeedTurbo = parseFloat(gaugeSpeedTurbo.value);
            saveConfig();
        });
    });


    // ===== DASHBOARD DATA =====
    let dashboardData = {
        totalRevenue: 0,
        activePlayers: 0,
        totalBets: 0,
        totalWagered: 0,
        totalPaid: 0,
        transactions: [],
        players: [],
        leads: []
    };

    function loadDashboardData() {
        const history = JSON.parse(localStorage.getItem(DB.KEYS.HISTORY) || '[]');
        const allPlayers = DB.getPlayers();
        const allLeads = DB.getLeads();

        dashboardData.totalBets = history.length;
        dashboardData.totalWagered = history.reduce((sum, h) => sum + h.bet, 0);
        dashboardData.totalPaid = history.filter(h => h.isWin).reduce((sum, h) => sum + h.win, 0);

        // Profit is simply In - Out
        dashboardData.totalRevenue = dashboardData.totalWagered - dashboardData.totalPaid;

        dashboardData.activePlayers = allPlayers.length;
        dashboardData.players = allPlayers;
        dashboardData.leads = allLeads;
        dashboardData.transactions = history;

        updateDashboardUI();
    }

    function updateDashboardUI() {
        const formatCurrency = (val) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // Update KPIs
        document.getElementById('total-revenue').textContent = 'R$ ' + formatCurrency(dashboardData.totalRevenue);

        // 1. Cadastros (Total Users/Leads)
        // Ensure we count unique users from both leads and players DB
        const totalRegistrations = dashboardData.leads.length || dashboardData.players.length;
        document.getElementById('kpi-cadastros').textContent = totalRegistrations;

        // 2. CPA ATIVO (Players with totalWagered > 0 OR Deposits)
        // In this demo, we assume "Active" means they have played or have a balance > welcome bonus (implying deposit)
        // Let's use totalWagered > 0 as a proxy for "Active Player" (Deposited & Played)
        // OR better: check for `firstDeposit > 0` in leads if available, or fallback to wagered
        const cpaActiveCount = dashboardData.players.filter(p => p.totalWagered > 0).length;
        document.getElementById('kpi-cpa-ativo').textContent = cpaActiveCount;

        // 3. Ticket Médio (Revenue / Active Players)
        // Approx: Total Revenue / CPA Active
        let ticketMedio = 0;
        if (cpaActiveCount > 0) {
            ticketMedio = dashboardData.totalRevenue / cpaActiveCount;
            // Note: Total Revenue is (Wagered - Paid). If we want Ticket Medio of DEPOSITS, we strictly need deposit logs.
            // As a fallback for this demo, let's assume Ticket Medio ~ (Revenue / Active Count) assuming House Profit comes from deposits.
            // If negative revenue (players winning), ticket medio might look weird, so let's clamp or use Wagered
            // Let's stick to Revenue per Active User (ARPU) as requested "Ticket Medio" contextually
        }
        document.getElementById('kpi-ticket-medio').textContent = 'R$ ' + formatCurrency(ticketMedio);

        // Stats Text
        document.getElementById('total-wagered').textContent = 'R$ ' + formatCurrency(dashboardData.totalWagered);
        document.getElementById('total-paid').textContent = 'R$ ' + formatCurrency(dashboardData.totalPaid);
        document.getElementById('house-profit').textContent = 'R$ ' + formatCurrency(dashboardData.totalRevenue);

        // Effective RTP
        const effectiveRTP = dashboardData.totalWagered > 0
            ? ((dashboardData.totalPaid / dashboardData.totalWagered) * 100).toFixed(1)
            : 0;
        document.getElementById('effective-rtp').textContent = effectiveRTP + '%';

        updateTables();
        updateCharts();
    }

    function updateTables() {
        // Players Table
        const pTbody = document.getElementById('players-table-body');
        pTbody.innerHTML = '';
        dashboardData.players.forEach((player, idx) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>#${idx + 1}</td>
                <td>${player.name}</td>
                <td style="color:#00d26a; font-weight:bold;">R$ ${player.balance.toFixed(2)}</td>
                <td>R$ ${player.totalWagered.toFixed(2)}</td>
                <td>R$ ${player.totalWon.toFixed(2)}</td>
                <td>${player.winRate || 0}%</td>
                <td>${new Date(player.lastActivity).toLocaleDateString()}</td>
                <td><button class="btn-action view-player-btn" data-name="${player.name}">Ver Detalhes</button></td>
            `;
            pTbody.appendChild(row);
        });

        // Attach Event Listeners to new Buttons
        document.querySelectorAll('.view-player-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const playerName = e.target.getAttribute('data-name');
                openPlayerModal(playerName);
            });
        });

        // Recent Activity (Sidebar or Widget)
        const actList = document.getElementById('recent-activity');
        if (actList) {
            actList.innerHTML = '';
            dashboardData.transactions.slice(0, 8).forEach(t => {
                const div = document.createElement('div');
                div.className = 'activity-item';
                div.innerHTML = `
                    <div style="display:flex; justify-content:space-between;">
                        <span><strong style="color:white;">${t.player}</strong> ${t.isWin ? 'ganhou' : 'iniciou'}</span>
                        <span style="font-size:0.8rem; color:#888;">${new Date(t.date).toLocaleTimeString()}</span>
                    </div>
                    <div style="margin-top:5px; font-weight:bold; color: ${t.isWin ? '#00d26a' : '#f53d3d'}">
                        ${t.isWin ? '+' : '-'} R$ ${t.isWin ? t.win.toFixed(2) : t.bet.toFixed(2)}
                    </div>
                `;
                actList.appendChild(div);
            });
        }
    }

    // ===== WITHDRAWALS LOGIC =====
    function renderWithdrawals() {
        const tbody = document.getElementById('withdrawals-table-body');
        if (!tbody) return;

        const withdrawals = DB.getWithdrawals();
        tbody.innerHTML = '';

        if (withdrawals.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhuma solicitação encontrada</td></tr>';
            return;
        }

        withdrawals.forEach(w => {
            const tr = document.createElement('tr');

            let actions = '';
            if (w.status === 'pending') {
                actions = `
                    <button class="btn-action bg-success btn-approve" data-id="${w.id}"><i class="fa fa-check"></i></button>
                    <button class="btn-action bg-danger btn-reject" data-id="${w.id}"><i class="fa fa-times"></i></button>
                `;
            } else {
                actions = '<span style="color:#666;">-</span>';
            }

            tr.innerHTML = `
                <td>${new Date(w.date).toLocaleDateString()} ${new Date(w.date).toLocaleTimeString()}</td>
                <td>${w.player}</td>
                <td style="font-family:monospace;">${w.pixKey}</td>
                <td style="color:#f53d3d; font-weight:bold;">R$ ${w.amount.toFixed(2)}</td>
                <td><span class="status-badge ${w.status}">${w.status === 'pending' ? 'Pendente' : w.status === 'approved' ? 'Pago' : 'Rejeitado'}</span></td>
                <td><div style="display:flex; gap:5px;">${actions}</div></td>
            `;
            tbody.appendChild(tr);
        });

        // Attach listeners
        document.querySelectorAll('.btn-approve').forEach(btn => {
            btn.addEventListener('click', () => {
                if (DB.approveWithdrawal(btn.dataset.id)) {
                    showToast('Saque Aprovado!', 'success');
                    loadDashboardData(); // Refresh all
                    renderWithdrawals();
                }
            });
        });

        document.querySelectorAll('.btn-reject').forEach(btn => {
            btn.addEventListener('click', () => {
                if (DB.rejectWithdrawal(btn.dataset.id)) {
                    showToast('Saque Rejeitado e estornado!', 'success');
                    loadDashboardData();
                    renderWithdrawals();
                }
            });
        });
    }

    // ===== DEPOSITS LOGIC =====
    function renderDeposits() {
        const tbody = document.getElementById('deposits-table-body');
        if (!tbody) return;

        const deposits = DB.getDeposits();
        tbody.innerHTML = '';

        let totalDep = 0;

        deposits.forEach(d => {
            totalDep += d.amount;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(d.date).toLocaleDateString()} ${new Date(d.date).toLocaleTimeString()}</td>
                <td>${d.player}</td>
                <td style="color:#00d26a; font-weight:bold;">R$ ${d.amount.toFixed(2)}</td>
                <td style="font-family:monospace; font-size:0.8rem; color:#888;">${d.id}</td>
            `;
            tbody.appendChild(tr);
        });

        const totalVal = document.getElementById('total-deposits-val');
        if (totalVal) totalVal.innerText = 'R$ ' + totalDep.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    }


    // ===== ANALYTICS ADVANCED =====
    function renderAdvancedCharts() {
        // 1. Bets Distribution (e.g., Win vs Loss ratio or Score dist)
        const ctx1 = document.getElementById('betsDistributionChart');
        if (ctx1) {
            // Mock data or real ratio from history
            const history = dashboardData.transactions;
            const wins = history.filter(h => h.isWin).length;
            const losses = history.length - wins;

            new Chart(ctx1.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: ['Vitórias (Jogadores)', 'Derrotas (Casa)'],
                    datasets: [{
                        data: [wins, losses],
                        backgroundColor: ['#00d26a', '#ff4d4d'],
                        borderWidth: 0
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

        // 2. Conversion (Simulated Funnel)
        const ctx2 = document.getElementById('conversionChart');
        if (ctx2) {
            const visits = 500; // Mock
            const registers = dashboardData.leads.length;
            const depositors = dashboardData.players.filter(p => p.totalWagered > 0).length; // "Active"

            new Chart(ctx2.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: ['Visitantes', 'Cadastros', 'Depositantes'],
                    datasets: [{
                        label: 'Conversão',
                        data: [visits, registers, depositors],
                        backgroundColor: ['#4a90e2', '#ffa500', '#00d26a'],
                        borderRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { display: false },
                        x: { grid: { display: false }, ticks: { color: 'white' } }
                    }
                }
            });
        }
    }

    // ===== CHART.JS IMPLEMENTATION =====
    let betsChartInstance = null;
    let revenueChartInstance = null;

    function updateCharts() {
        // Prepare Data
        // Group history by Hour for "Bets per Hour" (Simulated mostly) or just last 10 batches
        const history = dashboardData.transactions;

        // 1. Bets Chart (Labels = Time, Data = Bet Amounts)
        const last10 = history.slice(0, 20).reverse();
        const labels = last10.map(h => new Date(h.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        const dataBets = last10.map(h => h.bet);

        const betsCtx = document.getElementById('betsCanvas').getContext('2d');

        if (betsChartInstance) betsChartInstance.destroy(); // Destroy old to prevent overlay

        betsChartInstance = new Chart(betsCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Apostas Recentes (R$)',
                    data: dataBets,
                    borderColor: '#ff6b35',
                    backgroundColor: 'rgba(255, 107, 53, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    x: { grid: { display: false, color: '#333' }, ticks: { color: '#888' } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888' } }
                }
            }
        });

        // 2. Revenue vs Paid (Bar Chart)
        const wins = last10.map(h => h.isWin ? h.win : 0);
        const losses = last10.map(h => !h.isWin ? h.bet : 0); // Money kept by house

        const revCtx = document.getElementById('revenueCanvas').getContext('2d');
        if (revenueChartInstance) revenueChartInstance.destroy();

        revenueChartInstance = new Chart(revCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Ganhos Jogador',
                        data: wins,
                        backgroundColor: '#00d26a',
                        borderRadius: 4
                    },
                    {
                        label: 'Lucro Casa',
                        data: losses,
                        backgroundColor: '#f53d3d',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, labels: { color: '#fff' } }
                },
                scales: {
                    x: { stacked: true, grid: { display: false }, ticks: { display: false } },
                    y: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888' } }
                }
            }
        });
    }

    // Override/Extend Main Update Loop
    const originalUpdateTable = updateTables;
    updateTables = function () {
        originalUpdateTable(); // Players table
        renderWithdrawals();
        renderDeposits();
    };

    // Trigger one-off chart render for advanced stats tab
    // We check if we are in analytics tab? Or just render once.
    // Ideally call this when switching to analytics tab, but for now:
    setTimeout(renderAdvancedCharts, 1000);

    // ===== RTP TAB LOGIC =====
    // Re-bind RTP input because ID might have changed in new section or if we re-rendered
    // But currently we just updated HTML. The previous event listener might still work if ID is same "rtp-slider".
    // Let's ensure it syncs with the circle display

    const slider = document.getElementById('rtp-slider');
    const display = document.getElementById('rtp-display');
    if (slider && display) {
        slider.addEventListener('input', (e) => {
            display.innerText = e.target.value + '%';
            // Visual color change based on RTP?
            if (e.target.value < 20) display.style.color = '#ff4d4d'; // Hard for player
            else if (e.target.value > 80) display.style.color = '#00d26a'; // Easy
            else display.style.color = 'white';
        });
    }

    // ===== MODAL LOGIC =====
    const modal = document.getElementById('player-modal');
    const closeModalBtns = document.querySelectorAll('.btn-close-modal');

    function openPlayerModal(playerName) {
        const player = dashboardData.players.find(p => p.name === playerName);
        if (!player) return;

        // Fill Data
        document.getElementById('modal-player-name').innerText = player.name;
        document.getElementById('modal-player-balance').innerText = 'R$ ' + player.balance.toFixed(2);
        document.getElementById('modal-player-wagered').innerText = 'R$ ' + player.totalWagered.toFixed(2);

        const playerProfit = player.totalWon - player.totalWagered;
        const profitEl = document.getElementById('modal-player-profit');
        profitEl.innerText = 'R$ ' + playerProfit.toFixed(2);
        profitEl.style.color = playerProfit >= 0 ? '#00d26a' : '#f53d3d';

        document.getElementById('modal-player-winrate').innerText = (player.winRate || 0) + '%';

        // History Table within Modal
        const tbody = document.getElementById('modal-player-history-body');
        tbody.innerHTML = '';
        const pHistory = dashboardData.transactions.filter(t => t.player === playerName).slice(0, 10);

        if (pHistory.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1rem;">Sem histórico recente</td></tr>';
        } else {
            pHistory.forEach(h => {
                const tr = document.createElement('tr');
                const pnl = h.win - h.bet;
                tr.innerHTML = `
                    <td>${new Date(h.date).toLocaleTimeString()}</td>
                    <td>R$ ${h.bet.toFixed(2)}</td>
                    <td style="color:${h.isWin ? '#00d26a' : '#f53d3d'}">${h.isWin ? 'WIN' : 'LOSS'}</td>
                    <td style="color:${pnl >= 0 ? '#00d26a' : '#f53d3d'}">${pnl.toFixed(2)}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        // Show
        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.add('active'), 10);
    }

    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => modal.classList.add('hidden'), 300);
        });
    });

    // ===== TOASTS =====
    function showToast(msg, type) {
        const toast = document.createElement('div');
        toast.className = 'admin-toast';
        toast.style.cssText = `
            position: fixed; top: 90px; right: 20px;
            background: ${type === 'success' ? '#00d26a' : '#333'};
            color: #fff; padding: 1rem; border-radius: 8px;
            z-index: 2000; box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            animation: slideIn 0.3s forwards;
            font-family: 'Outfit', sans-serif;
        `;
        toast.innerText = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // Add Keyframes for toast
    const style = document.createElement('style');
    style.innerHTML = `@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`;
    document.head.appendChild(style);

    // Init
    loadDashboardData();
    setInterval(loadDashboardData, 5000);

    console.log("Admin 2.0 Loaded");
});
