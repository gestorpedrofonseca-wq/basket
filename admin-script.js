// BasketBet Admin Panel - Complete Logic
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

            // Update active states
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            sections.forEach(section => section.classList.remove('active'));
            document.getElementById(targetSection).classList.add('active');
        });
    });

    // ===== LOGOUT =====
    document.getElementById('logout-btn').addEventListener('click', () => {
        if (confirm('Deseja realmente sair do painel admin?')) {
            localStorage.removeItem('basketbet_admin');
            window.location.href = 'login.html';
        }
    });

    // ===== GAME CONFIGURATION =====
    const gameConfig = {
        rtp: 85,
        perfectZone: { min: 82, max: 98 },
        perfectMultiplier: { min: 1.5, max: 3.0 },
        rimZone: { min: 75, max: 82 },
        minBet: 5.00,
        maxBet: 1000.00,
        gaugeSpeedNormal: 1.5,
        gaugeSpeedTurbo: 2.5,
        maintenanceMode: false,
        maintenanceMessage: 'Sistema em manutenção. Voltamos em breve!',
        welcomeBalance: 1000.00
    };

    // Load config from localStorage
    const savedConfig = localStorage.getItem('basketbet_config');
    if (savedConfig) {
        Object.assign(gameConfig, JSON.parse(savedConfig));
    }

    // Save config to localStorage
    function saveConfig() {
        localStorage.setItem('basketbet_config', JSON.stringify(gameConfig));
        showToast('Configurações salvas com sucesso!', 'success');
    }

    // ===== RTP CONTROL =====
    const rtpSlider = document.getElementById('rtp-slider');
    const rtpDisplay = document.getElementById('rtp-display');
    const currentRtpDisplay = document.getElementById('current-rtp');

    if (rtpSlider) {
        rtpSlider.value = gameConfig.rtp;
        rtpDisplay.textContent = gameConfig.rtp + '%';
        if (currentRtpDisplay) currentRtpDisplay.textContent = gameConfig.rtp + '%';

        rtpSlider.addEventListener('input', (e) => {
            const value = e.target.value;
            rtpDisplay.textContent = value + '%';
        });

        document.getElementById('apply-rtp').addEventListener('click', () => {
            gameConfig.rtp = parseInt(rtpSlider.value);
            if (currentRtpDisplay) currentRtpDisplay.textContent = gameConfig.rtp + '%';
            saveConfig();
            updateRTPStats();
        });
    }

    // Zone Configuration
    const perfectMinInput = document.getElementById('perfect-min');
    const perfectMaxInput = document.getElementById('perfect-max');
    const perfectMultMinInput = document.getElementById('perfect-mult-min');
    const perfectMultMaxInput = document.getElementById('perfect-mult-max');
    const rimMinInput = document.getElementById('rim-min');
    const rimMaxInput = document.getElementById('rim-max');

    if (perfectMinInput) {
        perfectMinInput.value = gameConfig.perfectZone.min;
        perfectMaxInput.value = gameConfig.perfectZone.max;
        perfectMultMinInput.value = gameConfig.perfectMultiplier.min;
        perfectMultMaxInput.value = gameConfig.perfectMultiplier.max;
        rimMinInput.value = gameConfig.rimZone.min;
        rimMaxInput.value = gameConfig.rimZone.max;

        document.getElementById('apply-zones').addEventListener('click', () => {
            gameConfig.perfectZone.min = parseInt(perfectMinInput.value);
            gameConfig.perfectZone.max = parseInt(perfectMaxInput.value);
            gameConfig.perfectMultiplier.min = parseFloat(perfectMultMinInput.value);
            gameConfig.perfectMultiplier.max = parseFloat(perfectMultMaxInput.value);
            gameConfig.rimZone.min = parseInt(rimMinInput.value);
            gameConfig.rimZone.max = parseInt(rimMaxInput.value);
            saveConfig();
        });
    }

    // ===== GAME SETTINGS =====
    const minBetInput = document.getElementById('min-bet');
    const maxBetInput = document.getElementById('max-bet');
    const gaugeSpeedNormalInput = document.getElementById('gauge-speed-normal');
    const gaugeSpeedTurboInput = document.getElementById('gauge-speed-turbo');
    const maintenanceModeInput = document.getElementById('maintenance-mode');
    const maintenanceMessageInput = document.getElementById('maintenance-message');
    const welcomeBalanceInput = document.getElementById('welcome-balance');

    if (minBetInput) {
        minBetInput.value = gameConfig.minBet;
        maxBetInput.value = gameConfig.maxBet;
        gaugeSpeedNormalInput.value = gameConfig.gaugeSpeedNormal;
        gaugeSpeedTurboInput.value = gameConfig.gaugeSpeedTurbo;
        maintenanceModeInput.checked = gameConfig.maintenanceMode;
        maintenanceMessageInput.value = gameConfig.maintenanceMessage;
        welcomeBalanceInput.value = gameConfig.welcomeBalance;

        // Save buttons for each config card
        document.querySelectorAll('.btn-save').forEach(btn => {
            btn.addEventListener('click', () => {
                gameConfig.minBet = parseFloat(minBetInput.value);
                gameConfig.maxBet = parseFloat(maxBetInput.value);
                gameConfig.gaugeSpeedNormal = parseFloat(gaugeSpeedNormalInput.value);
                gameConfig.gaugeSpeedTurbo = parseFloat(gaugeSpeedTurboInput.value);
                gameConfig.maintenanceMode = maintenanceModeInput.checked;
                gameConfig.maintenanceMessage = maintenanceMessageInput.value;
                gameConfig.welcomeBalance = parseFloat(welcomeBalanceInput.value);
                saveConfig();
            });
        });
    }

    // ===== DASHBOARD DATA =====
    const dashboardData = {
        totalRevenue: 0,
        activePlayers: 0,
        totalBets: 0,
        totalWagered: 0,
        totalPaid: 0,
        transactions: [],
        players: [],
        leads: []
    };

    // Load data from localStorage
    function loadDashboardData() {
        const history = JSON.parse(localStorage.getItem('basketbet_history') || '[]');
        const allPlayers = JSON.parse(localStorage.getItem('basketbet_all_players') || '[]');
        const allLeads = JSON.parse(localStorage.getItem('basketbet_leads') || '[]');

        dashboardData.totalBets = history.length;
        dashboardData.totalWagered = history.reduce((sum, h) => sum + h.bet, 0);
        dashboardData.totalPaid = history.filter(h => h.isWin).reduce((sum, h) => sum + h.win, 0);
        dashboardData.totalRevenue = dashboardData.totalWagered - dashboardData.totalPaid;
        dashboardData.activePlayers = allPlayers.length;
        dashboardData.players = allPlayers;
        dashboardData.leads = allLeads;
        dashboardData.transactions = history;

        updateDashboard();
    }

    function updateDashboard() {
        const formatCurrency = (val) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // Update KPIs
        document.getElementById('total-revenue').textContent = 'R$ ' + formatCurrency(dashboardData.totalRevenue);
        document.getElementById('active-players').textContent = dashboardData.activePlayers;
        document.getElementById('total-bets').textContent = dashboardData.totalBets;

        // Update RTP Stats
        const effectiveRTP = dashboardData.totalWagered > 0
            ? ((dashboardData.totalPaid / dashboardData.totalWagered) * 100).toFixed(1)
            : 0;

        document.getElementById('effective-rtp').textContent = effectiveRTP + '%';
        document.getElementById('total-wagered').textContent = 'R$ ' + formatCurrency(dashboardData.totalWagered);
        document.getElementById('total-paid').textContent = 'R$ ' + formatCurrency(dashboardData.totalPaid);
        document.getElementById('house-profit').textContent = 'R$ ' + formatCurrency(dashboardData.totalRevenue);

        // Update Recent Activity
        updateRecentActivity();
        updatePlayersTable();
        updateLeadsTable();
        updateTransactionsTable();
    }

    function updateRecentActivity() {
        const activityList = document.getElementById('recent-activity');
        if (!activityList) return;

        activityList.innerHTML = '';
        const recentTransactions = dashboardData.transactions.slice(0, 10);

        if (recentTransactions.length === 0) {
            activityList.innerHTML = '<p style="color: #a0a0a0; text-align: center; padding: 2rem;">Nenhuma atividade recente</p>';
            return;
        }

        recentTransactions.forEach(trans => {
            const item = document.createElement('div');
            item.className = 'activity-item';
            const time = new Date(trans.date).toLocaleString('pt-BR');
            const type = trans.isWin ? 'Vitória' : 'Perda';
            const color = trans.isWin ? '#00d26a' : '#f53d3d';

            item.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong style="color: ${color}">${type}</strong> - 
                        Aposta: R$ ${trans.bet.toFixed(2)}
                        ${trans.isWin ? ` | Ganho: R$ ${trans.win.toFixed(2)}` : ''}
                    </div>
                    <span style="color: #a0a0a0; font-size: 0.85rem;">${time}</span>
                </div>
            `;
            activityList.appendChild(item);
        });
    }

    function updatePlayersTable() {
        const tbody = document.getElementById('players-table-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (dashboardData.players.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #a0a0a0;">Nenhum jogador cadastrado</td></tr>';
            return;
        }

        dashboardData.players.forEach((player, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>#${index + 1}</td>
                <td>${player.name || 'Jogador ' + (index + 1)}</td>
                <td>R$ ${player.balance.toFixed(2)}</td>
                <td>R$ ${player.totalWagered.toFixed(2)}</td>
                <td>R$ ${player.totalWon.toFixed(2)}</td>
                <td>${player.winRate}%</td>
                <td>${new Date(player.lastActivity).toLocaleString('pt-BR')}</td>
                <td>
                    <button class="btn-action" style="padding: 0.4rem 0.8rem; background: #4a90e2; border: none; border-radius: 6px; color: white; cursor: pointer;">
                        Ver Detalhes
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    function updateLeadsTable() {
        const tbody = document.getElementById('leads-table-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (dashboardData.leads.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #a0a0a0;">Nenhum lead cadastrado</td></tr>';
            return;
        }

        dashboardData.leads.forEach(lead => {
            const row = document.createElement('tr');
            const statusColor = lead.converted ? '#00d26a' : '#ffa500';
            const statusText = lead.converted ? 'Convertido' : 'Pendente';

            row.innerHTML = `
                <td>${new Date(lead.date).toLocaleDateString('pt-BR')}</td>
                <td>${lead.name}</td>
                <td>${lead.phone}</td>
                <td><span style="color: ${statusColor}; font-weight: 600;">${statusText}</span></td>
                <td>R$ ${lead.firstDeposit ? lead.firstDeposit.toFixed(2) : '0,00'}</td>
                <td>
                    <button class="btn-action" style="padding: 0.4rem 0.8rem; background: #00d26a; border: none; border-radius: 6px; color: white; cursor: pointer;">
                        Contatar
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    function updateTransactionsTable() {
        const tbody = document.getElementById('transactions-table-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (dashboardData.transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #a0a0a0;">Nenhuma transação registrada</td></tr>';
            return;
        }

        dashboardData.transactions.slice(0, 50).forEach((trans, index) => {
            const row = document.createElement('tr');
            const type = trans.isWin ? 'Ganho' : 'Aposta';
            const typeColor = trans.isWin ? '#00d26a' : '#ff6b35';
            const value = trans.isWin ? trans.win : trans.bet;

            row.innerHTML = `
                <td>#${index + 1}</td>
                <td>${new Date(trans.date).toLocaleString('pt-BR')}</td>
                <td>Jogador</td>
                <td><span style="color: ${typeColor}; font-weight: 600;">${type}</span></td>
                <td>R$ ${value.toFixed(2)}</td>
                <td><span style="color: #00d26a;">Concluído</span></td>
                <td>
                    <button class="btn-action" style="padding: 0.4rem 0.8rem; background: #4a90e2; border: none; border-radius: 6px; color: white; cursor: pointer;">
                        Ver
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    function updateRTPStats() {
        loadDashboardData();
    }

    // ===== REFRESH DASHBOARD =====
    document.getElementById('refresh-dashboard')?.addEventListener('click', () => {
        loadDashboardData();
        showToast('Dashboard atualizado!', 'success');
    });

    // ===== SEARCH FUNCTIONALITY =====
    document.getElementById('search-players')?.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#players-table-body tr');

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    });

    // ===== TRANSACTION FILTER =====
    document.getElementById('transaction-filter')?.addEventListener('change', (e) => {
        const filter = e.target.value;
        // Implement filter logic here
        showToast(`Filtro aplicado: ${filter}`, 'info');
    });

    // ===== CHARTS (Simple Canvas Placeholders) =====
    function initCharts() {
        const betsCanvas = document.getElementById('betsCanvas');
        const revenueCanvas = document.getElementById('revenueCanvas');

        if (betsCanvas) {
            const ctx = betsCanvas.getContext('2d');
            ctx.fillStyle = '#ff6b35';
            ctx.fillRect(20, 50, 50, 200);
            ctx.fillRect(90, 100, 50, 150);
            ctx.fillRect(160, 80, 50, 170);
            ctx.fillRect(230, 120, 50, 130);
            ctx.fillStyle = '#fff';
            ctx.font = '14px Outfit';
            ctx.fillText('Apostas por Hora (Exemplo)', 20, 30);
        }

        if (revenueCanvas) {
            const ctx = revenueCanvas.getContext('2d');
            ctx.fillStyle = '#00d26a';
            ctx.fillRect(20, 100, 50, 150);
            ctx.fillStyle = '#f53d3d';
            ctx.fillRect(90, 120, 50, 130);
            ctx.fillStyle = '#fff';
            ctx.font = '14px Outfit';
            ctx.fillText('Receita vs Pagamentos (Exemplo)', 20, 30);
        }
    }

    // ===== TOAST NOTIFICATIONS =====
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: ${type === 'success' ? '#00d26a' : type === 'error' ? '#f53d3d' : '#4a90e2'};
            color: white;
            border-radius: 12px;
            font-weight: 600;
            z-index: 1000;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Add animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(400px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(400px); opacity: 0; }
        }
    `;
    document.head.appendChild(style);

    // ===== INITIALIZE =====
    loadDashboardData();
    initCharts();

    // Simulate some demo data if empty
    if (dashboardData.players.length === 0) {
        const demoPlayers = [
            { name: 'João Silva', balance: 1500, totalWagered: 5000, totalWon: 4200, winRate: 65, lastActivity: new Date().toISOString() },
            { name: 'Maria Santos', balance: 800, totalWagered: 3000, totalWon: 2100, winRate: 55, lastActivity: new Date().toISOString() },
            { name: 'Pedro Costa', balance: 2200, totalWagered: 8000, totalWon: 7500, winRate: 72, lastActivity: new Date().toISOString() }
        ];
        localStorage.setItem('basketbet_all_players', JSON.stringify(demoPlayers));

        const demoLeads = [
            { date: new Date().toISOString(), name: 'Carlos Oliveira', phone: '(11) 98765-4321', converted: false, firstDeposit: 0 },
            { date: new Date().toISOString(), name: 'Ana Paula', phone: '(21) 97654-3210', converted: true, firstDeposit: 100 }
        ];
        localStorage.setItem('basketbet_leads', JSON.stringify(demoLeads));

        loadDashboardData();
    }

    console.log('BasketBet Admin Panel Loaded Successfully! 🏀🔐');
});
