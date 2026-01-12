/**
 * BasketBet Client Logic
 * Connected to centralized DB (localStorage)
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const ballContainer = document.querySelector('.ball-container');
    const ball = document.querySelector('.ball');
    const playBtn = document.getElementById('btn-play');
    const arBtn = document.getElementById('btn-ar');
    const betInput = document.getElementById('bet-amount');
    const userBalanceDisplay = document.getElementById('user-balance');
    const plusBtn = document.getElementById('btn-plus');
    const minusBtn = document.getElementById('btn-minus');
    const turboBtn = document.getElementById('turbo-btn');
    const gaugeArrow = document.getElementById('gauge-arrow');
    const aimLine = document.querySelector('.aim-line');

    // AR Elements
    const arVideo = document.getElementById('ar-video');
    const arScanOverlay = document.getElementById('ar-scan-overlay');

    // Modals
    const modalOverlay = document.getElementById('modal-overlay');
    const modals = document.querySelectorAll('.modal-content');
    const closeBtns = document.querySelectorAll('.close-modal');
    const modalTriggers = document.querySelectorAll('[data-modal]');

    // --- State ---
    const currentUser = DB.getCurrentUser();

    // Auth Check
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    let isShooting = false;
    let isTurbo = false;
    // Load Config
    let config = DB.getConfig();

    let balance = DB.getPlayerBalance(currentUser);
    let gaugePosition = 0; // 0 to 100
    let gaugeDirection = 1; // 1 = up, -1 = down
    let gaugeSpeed = config.gaugeSpeedNormal;
    let isARMode = false;
    let animationFrameId;

    // --- Init ---
    const formatCurrency = (val) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    userBalanceDisplay.innerText = formatCurrency(balance);

    showToast(`Bem-vindo, ${currentUser}!`, 'success');

    // Set Profile Name
    const profileNameEl = document.querySelectorAll('#modal-profile h3, #profile-display-name h3');
    if (profileNameEl) profileNameEl.forEach(el => el.innerText = currentUser);

    startGaugeLoop();
    updateProfileStats();

    // --- Avatar Upload ---
    const avatarTrigger = document.getElementById('avatar-trigger');
    const avatarInput = document.getElementById('avatar-input');
    const avatarImg = document.getElementById('user-avatar-img');

    // Load saved avatar if exists locally (avatars usually local only or separate DB)
    const savedAvatar = localStorage.getItem('basketbet_avatar');
    if (savedAvatar) {
        avatarImg.src = savedAvatar;
    }

    avatarTrigger.addEventListener('click', () => avatarInput.click());
    avatarInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target.result;
                avatarImg.src = base64;
                localStorage.setItem('basketbet_avatar', base64);
                showToast("Foto atualizada!", "success");
            };
            reader.readAsDataURL(file);
        }
    });

    // --- Edit Profile (Redundant now as we use DB login, but kept for UI) ---
    const editDataTrigger = document.getElementById('edit-data-trigger');
    const editProfileForm = document.getElementById('edit-profile-form');
    const profileDisplayName = document.getElementById('profile-display-name');
    const editNameInput = document.getElementById('edit-name');
    const saveProfileBtn = document.getElementById('save-profile-btn');

    editDataTrigger.addEventListener('click', () => {
        editProfileForm.classList.toggle('active');
        profileDisplayName.style.display = editProfileForm.classList.contains('active') ? 'none' : 'block';
        editNameInput.value = currentUser;
    });

    saveProfileBtn.addEventListener('click', () => {
        // We restrict name change for consistency in this demo
        showToast("Nome de usuário gerido pelo administrador/login.", "info");
        editProfileForm.classList.remove('active');
        profileDisplayName.style.display = 'block';
    });

    // --- History & Stats ---
    function updateProfileStats() {
        // Reload fresh data from DB
        const players = DB.getPlayers();
        const player = players.find(p => p.name === currentUser);

        if (player) {
            document.getElementById('stat-bets').innerText = (player.totalWagered > 0) ? 'Ativo' : '0';
            document.getElementById('stat-winrate').innerText = `${player.winRate || 0}%`;
            // Update Balance UI
            balance = player.balance;
            userBalanceDisplay.innerText = formatCurrency(balance);

            // Update Withdraw Balance Display
            const withdrawDisplay = document.getElementById('withdraw-balance-display');
            if (withdrawDisplay) withdrawDisplay.innerText = formatCurrency(balance);
        }

        // Update Modal History List (From Global History filtered by user)
        const history = JSON.parse(localStorage.getItem(DB.KEYS.HISTORY) || '[]');
        const userHistory = history.filter(h => h.player === currentUser);

        const list = document.querySelector('#modal-history .modal-body');
        if (list) {
            list.innerHTML = '';
            userHistory.slice(0, 20).forEach(item => {
                const div = document.createElement('div');
                div.className = `history-item ${item.isWin ? 'win' : 'loss'}`;
                div.innerHTML = `
                    <span>Aposta: R$ ${formatCurrency(item.bet)}</span>
                    <span>${item.isWin ? 'Ganho: R$ ' + formatCurrency(item.win) : 'Perda'}</span>
                `;
                list.appendChild(div);
            });
        }
    }

    // --- Logout Logic ---
    window.logoutUser = function () {
        // You can add any cleanup or session clearing logic here if needed
        showToast('Saindo...', 'info');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
    };

    const logoutProfileBtn = document.getElementById('btn-logout-profile');
    const logoutMenuBtn = document.getElementById('btn-logout-menu');

    if (logoutProfileBtn) {
        logoutProfileBtn.addEventListener('click', () => window.logoutUser());
    }

    if (logoutMenuBtn) {
        logoutMenuBtn.addEventListener('click', () => window.logoutUser());
    }

    // --- Withdraw Logic ---
    const confirmWithdrawBtn = document.getElementById('confirm-withdraw-btn');
    const withdrawAmountInput = document.getElementById('withdraw-amount');

    if (confirmWithdrawBtn) {
        confirmWithdrawBtn.addEventListener('click', () => {
            const amount = parseFloat(withdrawAmountInput.value);
            const pixKey = document.querySelector('#modal-withdraw input[type="text"]').value; // crude selector but works

            if (isNaN(amount) || amount <= 0) {
                showToast("Insira um valor válido!", "error");
                return;
            }
            if (amount > balance) {
                showToast("Saldo insuficiente!", "error");
                return;
            }
            if (!pixKey) {
                showToast("Insira sua chave PIX!", "error");
                return;
            }

            // DB Request
            const res = DB.requestWithdrawal(currentUser, amount, pixKey);
            if (res.success) {
                balance = res.newBalance;
                userBalanceDisplay.innerText = formatCurrency(balance);
                updateProfileStats();
                closeModal();
                showToast(`Saque solicitado! Aguarde aprovação.`, "success");
                withdrawAmountInput.value = '';
            } else {
                showToast(res.error, "error");
            }
        });
    }

    // --- Deposit Logic ---
    const pixButtons = document.querySelectorAll('.pix-options button');
    const manualDepositInput = document.getElementById('deposit-amount-input');
    const generatePixBtn = document.getElementById('generate-pix-btn');

    let selectedDeposit = 20;

    if (manualDepositInput) {
        manualDepositInput.addEventListener('input', (e) => selectedDeposit = parseFloat(e.target.value));
    }

    pixButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            selectedDeposit = parseFloat(btn.dataset.value);
            if (manualDepositInput) manualDepositInput.value = selectedDeposit.toFixed(2);
        });
    });

    if (generatePixBtn) {
        generatePixBtn.addEventListener('click', () => {
            // Simulate Immediate Deposit for Demo
            const amount = selectedDeposit;
            const newBal = DB.addDeposit(currentUser, amount);
            balance = newBal;
            userBalanceDisplay.innerText = formatCurrency(balance);
            showToast(`Depósito de R$ ${formatCurrency(amount)} confirmado!`, "success");
            closeModal();
            updateProfileStats();
            SoundManager.playMoney();
        });
    }


    function addToHistoryUI(bet, win, isWin) {
        // UI History (Bubbles)
        const historyBoard = document.getElementById('score-board');
        const bubble = document.createElement('div');
        bubble.classList.add('score-item', isWin ? 'win' : 'loss');
        bubble.innerText = isWin ? `x${(win / bet).toFixed(1)}` : '0.0x';
        historyBoard.prepend(bubble);
        if (historyBoard.children.length > 5) historyBoard.lastElementChild.remove();

        // Sync stats
        updateProfileStats();
    }

    // Start ball spinning idle
    ball.classList.add('spinning');

    // --- Gauge Loop ---
    function startGaugeLoop() {
        function animate() {
            if (!isShooting) {
                // Update position
                gaugePosition += gaugeDirection * gaugeSpeed;

                // Bounce bounds
                if (gaugePosition >= 100) {
                    gaugePosition = 100;
                    gaugeDirection = -1;
                } else if (gaugePosition <= 0) {
                    gaugePosition = 0;
                    gaugeDirection = 1;
                }

                // Update Visuals
                gaugeArrow.style.bottom = `${gaugePosition}%`;

                // AIM LINE Logic
                const aimHeight = 40 + (gaugePosition * 3.5);
                aimLine.style.height = `${aimHeight}px`;

                // Check Zones visually from config
                const { perfectZone } = config; // { min, max }

                // Add visual color feedback to arrow
                if (gaugePosition >= perfectZone.min && gaugePosition <= perfectZone.max) {
                    gaugeArrow.style.color = '#00ff00'; // Green in perfect zone
                    aimLine.style.borderColor = 'rgba(0, 255, 0, 0.4)';
                } else {
                    gaugeArrow.style.color = '#000000'; // Black by default
                    aimLine.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }
            }
            animationFrameId = requestAnimationFrame(animate);
        }
        animate();
    }

    // --- Bet Logic ---
    plusBtn.addEventListener('click', () => {
        let current = parseFloat(betInput.value);
        if (current < balance) {
            betInput.value = (current + 5.00).toFixed(2);
        }
    });

    minusBtn.addEventListener('click', () => {
        let current = parseFloat(betInput.value);
        if (current > 5) {
            betInput.value = (current - 5.00).toFixed(2);
        }
    });

    // --- Turbo ---
    turboBtn.addEventListener('click', () => {
        isTurbo = !isTurbo;
        turboBtn.classList.toggle('active');

        // Refresh config in case admin changed it
        config = DB.getConfig();
        gaugeSpeed = isTurbo ? config.gaugeSpeedTurbo : config.gaugeSpeedNormal;

        // Spin faster
        if (isTurbo) {
            ball.classList.remove('spinning');
            ball.classList.add('spinning-turbo');
            SoundManager.startMusic(); // Start Loop
        } else {
            ball.classList.remove('spinning-turbo');
            ball.classList.add('spinning');
            SoundManager.stopMusic(); // Stop Loop
        }
    });

    // --- AR LOGIC (Modified to support DB) ---
    arBtn.addEventListener('click', async () => {
        const isMobile = window.innerWidth <= 768; // Check if mobile

        if (!isARMode) {
            // Start AR
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'environment'
                    },
                    audio: false
                });

                arVideo.srcObject = stream;
                arVideo.classList.add('active');
                document.body.classList.add('ar-mode');

                // Show Scan Overlay temporarily
                arScanOverlay.classList.add('active');
                arBtn.innerHTML = '<i class="fa-solid fa-xmark"></i> SAIR';

                // Play AR scan sound
                SoundManager.playARScan();

                // Pseudo-scanning effect
                setTimeout(() => {
                    arScanOverlay.classList.remove('active');
                    showToast('Ambiente Mapeado!', 'success');
                }, 3000);

                isARMode = true;

                // --- GLOBAL AR EXCLUSIVE FEATURE (Desktop + Mobile) ---
                // Hide Play Button & Controls
                playBtn.style.display = 'none';

                // Apply AR Button Class
                arBtn.className = 'ar-exit-btn'; // Use CSS class instead of inline styles

                // Show Swipe/Drag Instruction
                // Remove existing if any
                const existingHint = document.getElementById('ar-swipe-hint');
                if (existingHint) existingHint.remove();

                const swipeHint = document.createElement('div');
                swipeHint.id = 'ar-swipe-hint';
                swipeHint.className = 'ar-hint'; // Use CSS class
                swipeHint.innerHTML = '<i class="fa-solid fa-hand-pointer"></i>Arraste para Arremessar ↑';

                document.body.appendChild(swipeHint); // Append to body to be full screen centered

                // --- NEW EXIT BUTTON FOR AR ---
                const exitARBtn = document.createElement('button');
                exitARBtn.id = 'exit-ar-overlay-btn';
                exitARBtn.innerHTML = '<i class="fa-solid fa-door-open"></i> SAIR DA RA';
                Object.assign(exitARBtn.style, {
                    position: 'fixed',
                    top: '40px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '12px 24px',
                    background: 'rgba(255, 68, 68, 0.95)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50px',
                    fontWeight: 'bold',
                    zIndex: '2000',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.5)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    backdropFilter: 'blur(5px)',
                    fontSize: '1rem',
                    minWidth: '160px',
                    justifyContent: 'center'
                });

                exitARBtn.addEventListener('click', () => {
                    arBtn.click(); // Trigger existing toggle logic
                });
                document.body.appendChild(exitARBtn);


                // Enable Gestures Logic (Touch + Mouse)
                enableGestureToShoot();

            } catch (err) {
                console.error(err);
                if (window.location.protocol === 'file:') {
                    // Fallback for local testing
                    // alert("A câmera não pôde ser iniciada. Simulando AR.");
                    document.body.classList.add('ar-mode');
                    arBtn.innerHTML = '<i class="fa-solid fa-xmark"></i> SAIR';
                    isARMode = true;

                    // Apply same mobile logic even in fallback
                    playBtn.style.display = 'none';

                    // Add exit button fallback
                    const exitARBtn = document.createElement('button');
                    exitARBtn.id = 'exit-ar-overlay-btn';
                    exitARBtn.innerHTML = '<i class="fa-solid fa-door-open"></i> SAIR DA RA';
                    Object.assign(exitARBtn.style, {
                        position: 'fixed',
                        top: '40px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        padding: '12px 24px',
                        background: 'rgba(255, 68, 68, 0.95)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50px',
                        fontWeight: 'bold',
                        zIndex: '2000',
                        boxShadow: '0 8px 25px rgba(0,0,0,0.5)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        backdropFilter: 'blur(5px)',
                        fontSize: '1rem',
                        minWidth: '160px',
                        justifyContent: 'center'
                    });

                    exitARBtn.addEventListener('click', () => {
                        arBtn.click(); // Trigger existing toggle logic
                    });
                    document.body.appendChild(exitARBtn);

                    arBtn.style.position = 'fixed';
                    arBtn.style.top = '20px';
                    arBtn.style.right = '20px';
                    arBtn.style.left = 'auto'; // Reset
                    arBtn.style.zIndex = '100';
                    arBtn.style.width = 'auto';
                    arBtn.style.height = 'auto';
                    arBtn.style.padding = '10px 20px';
                    arBtn.style.background = 'rgba(0,0,0,0.6)';
                    arBtn.style.backdropFilter = 'blur(4px)';
                    arBtn.style.border = '1px solid rgba(255,255,255,0.2)';
                    arBtn.style.borderRadius = '12px';

                    if (window.innerWidth <= 480) {
                        // Mobile adjustment small screens
                        arBtn.style.padding = '8px 16px';
                        arBtn.style.fontSize = '0.8rem';
                    }

                    const swipeHint = document.createElement('div');
                    swipeHint.id = 'ar-swipe-hint';
                    swipeHint.innerHTML = '<i class="fa-solid fa-hand-pointer"></i><br>Arraste para Arremessar ↑';
                    Object.assign(swipeHint.style, {
                        position: 'absolute',
                        bottom: '20%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        color: '#fff',
                        textAlign: 'center',
                        fontSize: '1.2rem',
                        opacity: '0.8',
                        pointerEvents: 'none',
                        zIndex: '50',
                        textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                        animation: 'bounce-idle 1s infinite'
                    });
                    document.querySelector('.game-viewport').appendChild(swipeHint);
                    // enableSwipeToShoot matches enableGestureToShoot in fallback context
                    enableGestureToShoot();
                } else {
                    alert("Erro ao acessar câmera: " + err.message);
                }
            }
        } else {
            // Stop AR
            const stream = arVideo.srcObject;
            if (stream) {
                const tracks = stream.getTracks();
                tracks.forEach(track => track.stop());
            }
            arVideo.srcObject = null;
            arVideo.classList.remove('active');
            document.body.classList.remove('ar-mode');
            arBtn.innerHTML = '<i class="fa-solid fa-camera"></i> JOGAR EM RA';
            isARMode = false;

            // Reset UI changes
            playBtn.style.display = ''; // Restore default
            arBtn.style = ''; // Reset inline styles
            const hint = document.getElementById('ar-swipe-hint');
            if (hint) hint.remove();

            // Remove Exit AR Button
            const exitBtn = document.getElementById('exit-ar-overlay-btn');
            if (exitBtn) exitBtn.remove();

            // Disable Swipe (Remove listeners if attached)
            disableGestureToShoot();
        }
    });

    // --- GESTURE LOGIC (Touch + Mouse) ---
    let startY = 0;
    let startTime = 0;
    let isDragging = false;

    function handleInputStart(y) {
        if (!isARMode) return;
        startY = y;
        startTime = Date.now();
        isDragging = true;
    }

    function handleInputEnd(y) {
        if (!isShooting && isARMode && isDragging) {
            const endY = y;
            const endTime = Date.now();
            const distance = startY - endY;
            const duration = endTime - startTime;

            if (distance > 50 && duration < 600) {
                const speed = distance / duration;
                let swipeForce = 50 + (speed * 30);
                if (swipeForce > 100) swipeForce = 95 + (Math.random() * 5);
                if (swipeForce < 40) swipeForce = 40;

                const betAmount = parseFloat(betInput.value);
                if (betAmount <= balance) {
                    triggerManualShot(swipeForce);
                } else {
                    showToast("Saldo Insuficiente!", "error");
                }
            }
        }
        isDragging = false;
    }

    function handleTouchStart(e) { handleInputStart(e.touches[0].clientY); }
    function handleTouchEnd(e) { handleInputEnd(e.changedTouches[0].clientY); }
    function handleMouseDown(e) { handleInputStart(e.clientY); }
    function handleMouseUp(e) { handleInputEnd(e.clientY); }

    function enableGestureToShoot() {
        document.addEventListener('touchstart', handleTouchStart, { passive: false });
        document.addEventListener('touchend', handleTouchEnd, { passive: false });
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('dragstart', (e) => e.preventDefault());
    }

    function disableGestureToShoot() {
        document.removeEventListener('touchstart', handleTouchStart);
        document.removeEventListener('touchend', handleTouchEnd);
        document.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mouseup', handleMouseUp);
    }

    function triggerManualShot(force) {
        if (isShooting) return;
        const betAmount = parseFloat(betInput.value);
        if (betAmount > balance) return;

        isShooting = true;
        // Balance is deducted in executeShot via DB
        executeShot(force, betAmount);

        setTimeout(() => {
            isShooting = false;
        }, 1200);
    }

    // --- Play Logic ---
    playBtn.addEventListener('click', () => {
        if (isShooting) return;

        // Refresh config
        config = DB.getConfig();
        const betAmount = parseFloat(betInput.value);
        if (betAmount > balance) {
            showToast("Saldo insuficiente!", "error");
            return;
        }

        const shots = isTurbo ? 3 : 1;
        const totalCost = betAmount * shots;

        if (totalCost > balance) {
            showToast(`Saldo insuficiente para modo Turbo (${shots}x)!`, "error");
            return;
        }

        // Lock state
        isShooting = true;
        playBtn.disabled = true;
        playBtn.innerText = isTurbo ? "TURBO..." : "LANÇANDO...";

        let shotCount = 0;

        // Trigger sequence
        function playShotSequence() {
            if (shotCount >= shots) {
                // Done
                isShooting = false;
                playBtn.disabled = false;
                playBtn.innerText = "JOGAR";
                return;
            }

            let force = gaugePosition;
            if (isTurbo && shotCount > 0) {
                force = force + (Math.random() * 10 - 5);
                if (force > 100) force = 100;
                if (force < 0) force = 0;
            }

            executeShot(force, betAmount);
            shotCount++;

            const delay = 600;
            if (shotCount < shots) {
                setTimeout(playShotSequence, delay);
            } else {
                setTimeout(() => {
                    isShooting = false;
                    playBtn.disabled = false;
                    playBtn.innerText = "JOGAR";
                }, 1000);
            }
        }

        playShotSequence();
    });

    function executeShot(force, betAmount) {
        // Sound
        if (isTurbo) {
            SoundManager.playShoot();
        }

        // --- CORE DB TRANSACTION ---
        const result = DB.processBet(currentUser, betAmount, force);
        if (result.error) {
            showToast(result.error, "error");
            return;
        }

        // Update local Balance from DB Result
        balance = result.newBalance;
        userBalanceDisplay.innerText = formatCurrency(balance);

        // --- ANIMATIONS based on Result ---
        const outcome = result.outcome;

        // Clone Ball for Animation
        const ballClone = ball.cloneNode(true);

        // Sync clone style with original for immediate rendering
        ballClone.style.position = 'absolute';
        ballClone.style.bottom = '120px'; // Align with original position in CSS
        ballClone.style.left = '50%';
        ballClone.style.transform = 'translateX(-50%)';
        ballClone.style.zIndex = '100';
        ballClone.style.opacity = '1';
        ballClone.style.display = 'block';
        ballClone.style.animation = 'none';

        ballContainer.appendChild(ballClone);

        // Hide original only AFTER clone is added to DOM to prevent flickering
        requestAnimationFrame(() => {
            ball.style.opacity = '0';
        });

        // Animation Classes Logic
        let animClass = '';
        if (outcome === 'win') {
            animClass = 'anim-shoot-win';
        } else {
            animClass = (force > 60 && force < 99) ? 'anim-shoot-rim' : 'anim-shoot-miss';
        }

        // --- PHYSICS API-LIKE LOGIC (Velocity & Gravity System) ---
        // Consolidada e limpa para evitar bugs de redeclaração

        // --- PHYSICS ENGINE 2.0 (Hoop Collision & RTP Focus) ---

        // 1. Core Elements for Physics
        const rimBack = document.querySelector('.rim-back');
        const rimFront = document.querySelector('.rim-front');
        const rimRect = rimBack.getBoundingClientRect();
        const ballRect = ball.getBoundingClientRect();

        const startX = 0;
        const startY = 0;

        // Target is the Rim Center
        const targetY = (rimRect.top + rimRect.height / 2) - (ballRect.top + ballRect.height / 2);
        const targetX = 0; // All shots go to center line

        // RTP Logic: Override final landing spot if loss
        let impactX = 0;
        if (outcome !== 'win') {
            // Force hit on the rim metal (Left or Right side of the ring)
            impactX = (Math.random() > 0.5 ? 30 : -30);
        }

        // Duration based on Force
        const duration = 1300 - (force * 4);
        const tSec = duration / 1000;
        const gravity = 1800; // px/s^2
        const startTime = performance.now();

        // Initial velocities to reach target in tSec
        // Vertical: dist = v0*t + 0.5*g*t^2 -> v0 = (dist - 0.5*g*t^2)/t
        const v0y = (targetY - 0.5 * gravity * tSec * tSec) / tSec;
        const v0x = (impactX / tSec); // Horizontal velocity to hit rim or center

        const maxRotation = -360 - (force * 10);

        let hasCollided = false;
        let vx = v0x;
        let vy = v0y;
        let lastTime = startTime;
        let curX = startX;
        let curY = startY;

        function animateBall(time) {
            const dt = Math.min((time - lastTime) / 1000, 0.032);
            lastTime = time;

            const totalElapsed = (time - startTime) / 1000;
            const progress = totalElapsed / tSec;

            if (!hasCollided) {
                // Apply Gravity & Update Position
                vy += gravity * dt;
                curX += vx * dt;
                curY += vy * dt;

                // --- LAYER MANAGEMENT (Prevent Ghosting) ---
                if (progress > 0.5) {
                    // Ball is nearing the hoop plane
                    // It should be behind the rim-front (z=20) but in front of backboard (z=1)
                    ballClone.style.zIndex = '10';
                }

                // --- COLLISION DETECTION (Loss Only) ---
                if (outcome !== 'win' && progress >= 0.85) {
                    // We hit the destination!
                    hasCollided = true;
                    // Bounce Physics: Reverse velocity and add "clank"
                    vx = (impactX > 0 ? 150 : -150); // Bounce away
                    vy = -vy * 0.3; // Bounce slightly up
                    SoundManager.playRim();
                }
            } else {
                // Post-Collision Physics
                vy += gravity * dt;
                curX += vx * dt;
                curY += vy * dt;

                // End after falling out of view
                if (curY > targetY + 300) {
                    endShot();
                    return;
                }
            }

            // Depth Scale: 1.0 -> 0.45
            const scale = 1 - (Math.min(progress, 1) * 0.55);
            const rotation = maxRotation * Math.min(progress, 1.5);

            ballClone.style.transform = `translate(calc(-50% + ${curX}px), ${curY}px) scale(${scale}) rotate(${rotation}deg)`;

            if (progress < 1.5) { // Safety buffer for bounce
                requestAnimationFrame(animateBall);
            } else {
                endShot();
            }
        }

        function endShot() {
            if (outcome === 'win') {
                const net = document.getElementById('hoop-net');
                if (net) {
                    net.classList.add('splash');
                    setTimeout(() => net.classList.remove('splash'), 500);
                }
                SoundManager.playWin();
                showToast(`+ R$ ${result.winAmount.toFixed(2)}`, "success");
            } else {
                SoundManager.playLoss();
            }

            ballClone.style.transition = 'opacity 0.3s ease-out';
            ballClone.style.opacity = '0';

            setTimeout(() => {
                ballClone.remove();
                ball.style.transition = 'none';
                ball.style.opacity = '1';
                addToHistoryUI(betAmount, result.winAmount, outcome === 'win');
            }, 300);
        }

        requestAnimationFrame(animateBall);
    }

    // SOUND MANAGER (Copied/Kept from original)
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();

    const SoundManager = {
        // Synthesizer Helpers
        createOsc: (freq, type, startTime, duration, vol, rampTo = 0.001) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(vol, startTime);
            gain.gain.exponentialRampToValueAtTime(rampTo, startTime + duration);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(startTime);
            osc.stop(startTime + duration);
        },
        playClick: () => {
            const t = audioCtx.currentTime;
            SoundManager.createOsc(800, 'sine', t, 0.05, 0.08);
            SoundManager.createOsc(1200, 'sine', t + 0.01, 0.05, 0.05);
        },
        playShoot: () => {
            const t = audioCtx.currentTime;
            const bufSize = audioCtx.sampleRate * 0.3;
            const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
            const noise = audioCtx.createBufferSource();
            noise.buffer = buf;
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(600, t);
            filter.frequency.linearRampToValueAtTime(100, t + 0.3);
            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0.3, t);
            gain.gain.linearRampToValueAtTime(0, t + 0.3);
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);
            noise.start(t);
        },
        playWin: () => {
            const t = audioCtx.currentTime;
            SoundManager.createOsc(523.25, 'triangle', t, 0.5, 0.15);
            SoundManager.createOsc(659.25, 'triangle', t, 0.5, 0.15);
            SoundManager.createOsc(783.99, 'triangle', t, 0.5, 0.15);
            SoundManager.createOsc(1046.5, 'sine', t + 0.1, 0.7, 0.08);
            SoundManager.createOsc(1318.51, 'sine', t + 0.2, 0.6, 0.06);
            setTimeout(() => {
                const swishSize = audioCtx.sampleRate * 0.4;
                const swishBuf = audioCtx.createBuffer(1, swishSize, audioCtx.sampleRate);
                const swishData = swishBuf.getChannelData(0);
                for (let i = 0; i < swishSize; i++) swishData[i] = Math.random() * 2 - 1;
                const swish = audioCtx.createBufferSource();
                swish.buffer = swishBuf;
                const swishFilter = audioCtx.createBiquadFilter();
                swishFilter.type = 'highpass';
                swishFilter.frequency.value = 3000;
                const swishGain = audioCtx.createGain();
                swishGain.gain.setValueAtTime(0.15, audioCtx.currentTime);
                swishGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
                swish.connect(swishFilter);
                swishFilter.connect(swishGain);
                swishGain.connect(audioCtx.destination);
                swish.start();
            }, 100);
        },
        playLoss: () => {
            const t = audioCtx.currentTime;
            SoundManager.createOsc(400, 'sawtooth', t, 0.3, 0.12);
            SoundManager.createOsc(300, 'sawtooth', t + 0.15, 0.4, 0.12);
            SoundManager.createOsc(200, 'sawtooth', t + 0.3, 0.5, 0.15);
            SoundManager.createOsc(80, 'sine', t + 0.5, 0.4, 0.25);
        },
        playRim: () => {
            const t = audioCtx.currentTime;
            SoundManager.createOsc(200, 'square', t, 0.1, 0.25);
            SoundManager.createOsc(250, 'sawtooth', t, 0.08, 0.2);
            SoundManager.createOsc(800, 'sine', t, 0.05, 0.05);
        },
        playBackboard: () => {
            const t = audioCtx.currentTime;
            SoundManager.createOsc(120, 'square', t, 0.1, 0.3);
            SoundManager.createOsc(80, 'sine', t, 0.2, 0.4);
        },
        playARScan: () => {
            const t = audioCtx.currentTime;
            SoundManager.createOsc(600, 'sine', t, 0.1, 0.1);
            SoundManager.createOsc(800, 'sine', t + 0.1, 0.1, 0.1);
            SoundManager.createOsc(1000, 'sine', t + 0.2, 0.1, 0.1);
            SoundManager.createOsc(1200, 'sine', t + 0.3, 0.15, 0.12);
            SoundManager.createOsc(1500, 'triangle', t + 0.5, 0.3, 0.08);
        },
        beatTimer: null,
        isPlayingMusic: false,
        nextNoteTime: 0,
        beatCount: 0,
        startMusic: () => {
            if (SoundManager.isPlayingMusic) return;
            if (audioCtx.state === 'suspended') audioCtx.resume();
            SoundManager.isPlayingMusic = true;
            SoundManager.nextNoteTime = audioCtx.currentTime;
            SoundManager.scheduler();
        },
        stopMusic: () => {
            SoundManager.isPlayingMusic = false;
            clearTimeout(SoundManager.beatTimer);
        },
        scheduler: () => {
            if (!SoundManager.isPlayingMusic) return;
            while (SoundManager.nextNoteTime < audioCtx.currentTime + 0.1) {
                SoundManager.playBeat(SoundManager.nextNoteTime, SoundManager.beatCount);
                SoundManager.nextNoteTime += 0.25;
                SoundManager.beatCount++;
            }
            SoundManager.beatTimer = setTimeout(SoundManager.scheduler, 25);
        },
        playBeat: (time, beat) => {
            const step = beat % 4;
            if (step === 0) {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.frequency.setValueAtTime(150, time);
                osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
                gain.gain.setValueAtTime(0.5, time);
                gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(time);
                osc.stop(time + 0.5);
            }
            if (step === 2) {
                const bufSize = audioCtx.sampleRate * 0.1;
                const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
                const data = buf.getChannelData(0);
                for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
                const noise = audioCtx.createBufferSource();
                noise.buffer = buf;
                const filter = audioCtx.createBiquadFilter();
                filter.type = 'highpass';
                filter.frequency.value = 5000;
                const gain = audioCtx.createGain();
                gain.gain.setValueAtTime(0.1, time);
                gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
                noise.connect(filter);
                filter.connect(gain);
                gain.connect(audioCtx.destination);
                noise.start(time);
            }
            if (step === 2 || step === 3) {
                const osc = audioCtx.createOscillator();
                osc.type = 'sawtooth';
                osc.frequency.value = 60;
                const gain = audioCtx.createGain();
                gain.gain.setValueAtTime(0.1, time);
                gain.gain.linearRampToValueAtTime(0, time + 0.1);
                const filter = audioCtx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(200, time);
                filter.frequency.linearRampToValueAtTime(600, time + 0.1);
                osc.connect(filter);
                filter.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(time);
                osc.stop(time + 0.1);
            }
        }
    };
    // Interaction Hook to resume AudioContext
    document.body.addEventListener('click', () => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
    }, { once: true });

    // Toast UI
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.style.cssText = `position: fixed; top: 100px; right: 20px; padding: 1rem 1.5rem; background: ${type === 'success' ? '#00d26a' : type === 'error' ? '#f53d3d' : '#4a90e2'}; color: white; border-radius: 12px; font-weight: 600; z-index: 1000; box-shadow: 0 4px 20px rgba(0,0,0,0.3); animation: slideIn 0.3s ease; font-family: 'Outfit';`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // Modal Logic
    modalTriggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            const target = trigger.getAttribute('data-modal');
            const action = trigger.getAttribute('data-action');
            if (target && document.getElementById(target)) {
                document.getElementById(target).classList.remove('hidden');
                modalOverlay.classList.remove('hidden');
            }
            // If action play, already handled by nav
        });
    });

    closeBtns.forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    // Bottom Nav logic
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            const action = item.getAttribute('data-action');
            if (action === 'play') {
                closeModal();
            }
        });
    });

    function closeModal() {
        modals.forEach(m => m.classList.add('hidden'));
        modalOverlay.classList.add('hidden');
    }
});
