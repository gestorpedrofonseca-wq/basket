/**
 * BasketBet Shared Database Logic directly on localStorage
 * Acts as a centralized "backend" for both Game and Admin.
 */
const DB = {
    KEYS: {
        CONFIG: 'basketbet_config',
        USER: 'basketbet_user',
        BALANCE: 'basketbet_balance',
        HISTORY: 'basketbet_history',
        LEADS: 'basketbet_leads',
        PLAYERS: 'basketbet_all_players',
        ADMIN: 'basketbet_admin',
        WITHDRAWALS: 'basketbet_withdrawals',
        DEPOSITS: 'basketbet_deposits'
    },

    // --- Configuration (RTP, etc) ---
    getConfig: () => {
        const defaults = {
            rtp: 10,
            perfectZone: { min: 82, max: 98 },
            perfectMultiplier: { min: 1.5, max: 3.0 },
            rimZone: { min: 75, max: 82 },
            minBet: 5.00,
            maxBet: 1000.00,
            gaugeSpeedNormal: 0.6,
            gaugeSpeedTurbo: 1.5,
            maintenanceMode: false
            // Welcome Balance Removed
        };
        const stored = JSON.parse(localStorage.getItem(DB.KEYS.CONFIG) || '{}');
        return { ...defaults, ...stored };
    },

    // --- User Management ---
    getCurrentUser: () => {
        return localStorage.getItem(DB.KEYS.USER);
    },

    loginUser: (name, phone) => {
        localStorage.setItem(DB.KEYS.USER, name);

        // Add/Update in Players DB
        const players = DB.getPlayers();
        let player = players.find(p => p.name === name);

        if (!player) {
            // New Player - Starts with 0 balance (Deposit required)
            player = {
                name: name,
                balance: 0,
                totalWagered: 0,
                totalWon: 0,
                winRate: 0,
                lastActivity: new Date().toISOString()
            };
            players.push(player);
        } else {
            player.lastActivity = new Date().toISOString();
        }

        // Bônus para conta admin (Teste)
        if (name.toLowerCase() === 'admin') {
            player.balance += 100.00;
        }

        localStorage.setItem(DB.KEYS.PLAYERS, JSON.stringify(players));

        // Registry in Leads if new
        const leads = DB.getLeads();
        if (!leads.find(l => l.phone === phone)) {
            leads.push({
                date: new Date().toISOString(),
                name: name,
                phone: phone,
                converted: true, // They logged in
                firstDeposit: 0 // Will update on deposit
            });
            localStorage.setItem(DB.KEYS.LEADS, JSON.stringify(leads));
        }

        return player;
    },

    getPlayers: () => {
        return JSON.parse(localStorage.getItem(DB.KEYS.PLAYERS) || '[]');
    },

    getLeads: () => {
        return JSON.parse(localStorage.getItem(DB.KEYS.LEADS) || '[]');
    },

    // --- Transaction Logic ---
    getPlayerBalance: (name) => {
        const players = DB.getPlayers();
        const player = players.find(p => p.name === name);
        return player ? player.balance : 0;
    },

    processBet: (name, betAmount, force) => {
        const config = DB.getConfig();
        const players = DB.getPlayers();
        const playerIndex = players.findIndex(p => p.name === name);

        if (playerIndex === -1) return { error: 'Player not found' };

        const player = players[playerIndex];

        if (player.balance < betAmount) return { error: 'Saldo insuficiente' };

        // --- RTP & Outcome Logic (Admin Control Priority) ---
        // User Request: "acertos vão condizer com o RTP do painel de admin, e não da jogabilidade"

        let outcome = 'loss';
        let winAmount = 0;
        let multiplier = 0;

        // 1. Determine Win based on RTP % (House Edge)
        // config.rtp is integer 0-100 (percentage)
        const rtpChance = config.rtp / 100;
        const isRtpWin = Math.random() < rtpChance;

        // 2. Gameplay still Visualizes the "Force", but result is rigged by RTP
        // We can optionally require "minimum effort" (e.g. force > 10) to avoid betting with 0 power
        // But strictly satisfying "not gameplay" means we rely on RTP.

        if (isRtpWin) {
            outcome = 'win';
            // Multiplier logic
            const minM = config.perfectMultiplier.min;
            const maxM = config.perfectMultiplier.max;
            multiplier = minM + Math.random() * (maxM - minM);

            // Critical: If RTP says win, we pretend it was a perfect shot for stats if needed
            // Or just payout.
            winAmount = betAmount * multiplier;
        } else {
            // Force Loss even if "Perfect" (The "Rigged" part)
            outcome = 'loss';
        }

        // --- Stats Update ---

        // Update stats
        player.balance -= betAmount;
        player.totalWagered += betAmount;

        if (outcome === 'win') {
            player.balance += winAmount;
            player.totalWon += winAmount;
        }

        // Recalculate WinRate
        // Needs total bets count... we can approximate or store it. 
        // Let's store "wins" count separately if needed, but for now we just update timestamp
        player.lastActivity = new Date().toISOString();

        // Save Player
        players[playerIndex] = player;
        localStorage.setItem(DB.KEYS.PLAYERS, JSON.stringify(players));

        // Add to Global History (for Admin Dashboard)
        const history = JSON.parse(localStorage.getItem(DB.KEYS.HISTORY) || '[]');
        history.unshift({
            date: new Date().toISOString(),
            bet: betAmount,
            win: winAmount,
            isWin: outcome === 'win',
            player: name
        });
        // Keep history size manageable
        if (history.length > 200) history.pop();
        localStorage.setItem(DB.KEYS.HISTORY, JSON.stringify(history));

        return {
            outcome,
            winAmount,
            multiplier,
            newBalance: player.balance
        };
    },

    // Process Deposit
    addDeposit: (name, amount) => {
        const players = DB.getPlayers();
        const player = players.find(p => p.name === name);
        if (player) {
            player.balance += amount;
            player.totalDeposited = (player.totalDeposited || 0) + amount; // Track totals
            localStorage.setItem(DB.KEYS.PLAYERS, JSON.stringify(players));

            // Log Deposit specifically
            const deposits = JSON.parse(localStorage.getItem(DB.KEYS.DEPOSITS) || '[]');
            deposits.unshift({
                id: Date.now().toString(36),
                date: new Date().toISOString(),
                player: name,
                amount: amount
            });
            localStorage.setItem(DB.KEYS.DEPOSITS, JSON.stringify(deposits));

            // Update Lead info
            const leads = DB.getLeads();
            const lead = leads.find(l => l.name === name);
            if (lead && lead.firstDeposit === 0) {
                lead.firstDeposit = amount;
                localStorage.setItem(DB.KEYS.LEADS, JSON.stringify(leads));
            }

            return player.balance;
        }
        return 0;
    },

    // Withdrawals
    requestWithdrawal: (name, amount, pixKey) => {
        const players = DB.getPlayers();
        const player = players.find(p => p.name === name);
        if (!player) return { error: 'Player not found' };
        if (player.balance < amount) return { error: 'Saldo insuficiente' };

        // Deduct immediately to lock funds
        player.balance -= amount;
        localStorage.setItem(DB.KEYS.PLAYERS, JSON.stringify(players));

        const withdrawals = JSON.parse(localStorage.getItem(DB.KEYS.WITHDRAWALS) || '[]');
        withdrawals.unshift({
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            date: new Date().toISOString(),
            player: name,
            amount: amount,
            pixKey: pixKey,
            status: 'pending' // pending, approved, rejected
        });
        localStorage.setItem(DB.KEYS.WITHDRAWALS, JSON.stringify(withdrawals));

        return { success: true, newBalance: player.balance };
    },

    getWithdrawals: () => {
        return JSON.parse(localStorage.getItem(DB.KEYS.WITHDRAWALS) || '[]');
    },

    getDeposits: () => {
        return JSON.parse(localStorage.getItem(DB.KEYS.DEPOSITS) || '[]');
    },

    approveWithdrawal: (id) => {
        const withdrawals = DB.getWithdrawals();
        const w = withdrawals.find(x => x.id === id);
        if (w && w.status === 'pending') {
            w.status = 'approved';
            w.approvedDate = new Date().toISOString();
            localStorage.setItem(DB.KEYS.WITHDRAWALS, JSON.stringify(withdrawals));
            return true;
        }
        return false;
    },

    rejectWithdrawal: (id) => {
        const withdrawals = DB.getWithdrawals();
        const w = withdrawals.find(x => x.id === id);
        if (w && w.status === 'pending') {
            w.status = 'rejected';
            localStorage.setItem(DB.KEYS.WITHDRAWALS, JSON.stringify(withdrawals));

            // Refund balance
            const players = DB.getPlayers();
            const player = players.find(p => p.name === w.player);
            if (player) {
                player.balance += w.amount;
                localStorage.setItem(DB.KEYS.PLAYERS, JSON.stringify(players));
            }
            return true;
        }
        return false;
    }
};

// Expose globally
window.DB = DB;
