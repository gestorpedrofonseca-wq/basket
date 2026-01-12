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
    let isShooting = false;
    let balance = 1000.00;
    let isTurbo = false;
    let gaugePosition = 0; // 0 to 100
    let gaugeDirection = 1; // 1 = up, -1 = down
    let gaugeSpeed = 1.5; // Base speed
    let isARMode = false;
    let animationFrameId;

    // --- Init ---
    const formatCurrency = (val) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    userBalanceDisplay.innerText = formatCurrency(balance);

    // Load User Data
    const savedName = localStorage.getItem('basketbet_user');
    const savedAvatar = localStorage.getItem('basketbet_avatar');

    if (savedName) {
        document.querySelectorAll('#modal-profile h3, #profile-display-name h3').forEach(el => el.innerText = savedName);
        showToast(`Bem-vindo, ${savedName}!`, 'success');
    }
    if (savedAvatar) {
        document.getElementById('user-avatar-img').src = savedAvatar;
    }

    startGaugeLoop();
    updateProfileStats();

    // --- Avatar Upload ---
    const avatarTrigger = document.getElementById('avatar-trigger');
    const avatarInput = document.getElementById('avatar-input');
    const avatarImg = document.getElementById('user-avatar-img');

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

    // --- Edit Profile ---
    const editDataTrigger = document.getElementById('edit-data-trigger');
    const editProfileForm = document.getElementById('edit-profile-form');
    const profileDisplayName = document.getElementById('profile-display-name');
    const editNameInput = document.getElementById('edit-name');
    const saveProfileBtn = document.getElementById('save-profile-btn');

    editDataTrigger.addEventListener('click', () => {
        editProfileForm.classList.toggle('active');
        profileDisplayName.style.display = editProfileForm.classList.contains('active') ? 'none' : 'block';
        editNameInput.value = localStorage.getItem('basketbet_user') || "Usuário VIP";
    });

    saveProfileBtn.addEventListener('click', () => {
        const newName = editNameInput.value.trim();
        if (newName) {
            localStorage.setItem('basketbet_user', newName);
            document.querySelectorAll('#modal-profile h3, #profile-display-name h3').forEach(el => el.innerText = newName);
            editProfileForm.classList.remove('active');
            profileDisplayName.style.display = 'block';
            showToast("Dados salvos!", "success");
        }
    });

    // --- History & Stats ---
    function updateProfileStats() {
        const history = JSON.parse(localStorage.getItem('basketbet_history') || '[]');
        const totalBets = history.length;
        const wins = history.filter(h => h.isWin).length;
        const winRate = totalBets > 0 ? ((wins / totalBets) * 100).toFixed(0) : 0;

        document.getElementById('stat-bets').innerText = totalBets;
        document.getElementById('stat-winrate').innerText = `${winRate}%`;

        // Update Withdraw Balance Display
        const withdrawDisplay = document.getElementById('withdraw-balance-display');
        if (withdrawDisplay) withdrawDisplay.innerText = formatCurrency(balance);

        // Update Modal List
        const list = document.querySelector('#modal-history .modal-body');
        if (list) {
            list.innerHTML = '';
            history.slice(0, 20).forEach(item => {
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

    // --- Withdraw Logic ---
    const confirmWithdrawBtn = document.getElementById('confirm-withdraw-btn');
    const withdrawAmountInput = document.getElementById('withdraw-amount');

    confirmWithdrawBtn.addEventListener('click', () => {
        const amount = parseFloat(withdrawAmountInput.value);
        if (isNaN(amount) || amount <= 0) {
            showToast("Insira um valor válido!", "error");
            return;
        }
        if (amount > balance) {
            showToast("Saldo insuficiente!", "error");
            return;
        }

        balance -= amount;
        userBalanceDisplay.innerText = formatCurrency(balance);
        updateProfileStats();
        closeModal();
        showToast(`Saque de R$ ${formatCurrency(amount)} solicitado!`, "success");
        withdrawAmountInput.value = '';
    });

    function addToHistory(bet, win, isWin) {
        // UI History (Bubbles)
        const historyBoard = document.getElementById('score-board');
        const bubble = document.createElement('div');
        bubble.classList.add('score-item', isWin ? 'win' : 'loss');
        bubble.innerText = isWin ? `x${(win / bet).toFixed(1)}` : '0.0x';
        historyBoard.prepend(bubble);
        if (historyBoard.children.length > 5) historyBoard.lastElementChild.remove();

        // Persistent History
        const history = JSON.parse(localStorage.getItem('basketbet_history') || '[]');
        history.unshift({ bet, win, isWin, date: new Date().toISOString() });
        localStorage.setItem('basketbet_history', JSON.stringify(history.slice(0, 50)));

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

                // Add visual color feedback to arrow
                if (gaugePosition > 80 && gaugePosition < 98) {
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
        gaugeSpeed = isTurbo ? 2.5 : 1.5; // Faster gauge in turbo

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

    // --- AR LOGIC ---
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

                // Enable Gestures Logic (Touch + Mouse)
                enableGestureToShoot();

            } catch (err) {
                console.error(err);
                if (window.location.protocol === 'file:') {
                    // Fallback for local testing
                    alert("A câmera não pôde ser iniciada (Restrição de Navegador em arquivo local). Simulando AR.");
                    document.body.classList.add('ar-mode');
                    arBtn.innerHTML = '<i class="fa-solid fa-xmark"></i> SAIR';
                    isARMode = true;

                    // Apply same mobile logic even in fallback
                    playBtn.style.display = 'none';
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
                    alert("A câmera não pôde ser iniciada (Restrição de Navegador em arquivo local). Simulando AR.");
                    document.body.classList.add('ar-mode');
                    arBtn.innerHTML = '<i class="fa-solid fa-xmark"></i> SAIR';
                    isARMode = true;

                    if (isMobile) {
                        // Apply same mobile logic even in fallback
                        playBtn.style.display = 'none';
                        arBtn.style.position = 'fixed';
                        arBtn.style.top = '20px';
                        arBtn.style.left = '20px';
                        arBtn.style.width = 'auto'; // Reset size

                        const swipeHint = document.createElement('div');
                        swipeHint.id = 'ar-swipe-hint';
                        swipeHint.innerHTML = '<i class="fa-solid fa-hand-pointer"></i><br>Arraste para Arremessar ↑';
                        Object.assign(swipeHint.style, {
                            position: 'absolute',
                            bottom: '25%',
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
                        enableSwipeToShoot();
                    }
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

            const distance = startY - endY; // Up is positive
            const duration = endTime - startTime;

            // Check for valid swipe up (at least 50px quickly)
            if (distance > 50 && duration < 600) {
                const speed = distance / duration;
                // Speed ranges roughly 0.5 to 2.0+

                let swipeForce = 50 + (speed * 30);
                // Add some randomness/skill
                if (swipeForce > 100) swipeForce = 95 + (Math.random() * 5);
                if (swipeForce < 40) swipeForce = 40; // Minimum force

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

    // Touch Handlers
    function handleTouchStart(e) { handleInputStart(e.touches[0].clientY); }
    function handleTouchEnd(e) { handleInputEnd(e.changedTouches[0].clientY); }

    // Mouse Handlers
    function handleMouseDown(e) { handleInputStart(e.clientY); }
    function handleMouseUp(e) { handleInputEnd(e.clientY); }

    function triggerManualShot(force) {
        if (isShooting) return;
        const betAmount = parseFloat(betInput.value);
        if (betAmount > balance) return;

        isShooting = true;
        balance -= betAmount;
        userBalanceDisplay.innerText = formatCurrency(balance);

        executeShot(force, betAmount);

        // Reset flag after animation
        setTimeout(() => {
            isShooting = false;
        }, 1200);
    }

    function enableGestureToShoot() {
        // Touch
        document.addEventListener('touchstart', handleTouchStart, { passive: false });
        document.addEventListener('touchend', handleTouchEnd, { passive: false });
        // Mouse
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mouseup', handleMouseUp);
        // Prevent default drag issues to allow smooth swiping
        document.addEventListener('dragstart', (e) => e.preventDefault());
    }

    function disableGestureToShoot() {
        document.removeEventListener('touchstart', handleTouchStart);
        document.removeEventListener('touchend', handleTouchEnd);
        document.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mouseup', handleMouseUp);
    }



    // --- Sound Manager (Premium iGaming Audio) ---
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
            // UI Click sound (for all buttons)
            const t = audioCtx.currentTime;
            SoundManager.createOsc(800, 'sine', t, 0.05, 0.08);
            SoundManager.createOsc(1200, 'sine', t + 0.01, 0.05, 0.05);
        },

        playShoot: () => {
            // Powerful Whoosh
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
            // Victory sound with net swish (for NORMAL mode)
            const t = audioCtx.currentTime;
            // Major chord celebration
            SoundManager.createOsc(523.25, 'triangle', t, 0.5, 0.15);
            SoundManager.createOsc(659.25, 'triangle', t, 0.5, 0.15);
            SoundManager.createOsc(783.99, 'triangle', t, 0.5, 0.15);
            // High sparkle
            SoundManager.createOsc(1046.5, 'sine', t + 0.1, 0.7, 0.08);
            SoundManager.createOsc(1318.51, 'sine', t + 0.2, 0.6, 0.06);

            // Net swish sound
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
            // Sad/miss sound (for NORMAL mode)
            const t = audioCtx.currentTime;
            // Descending sad tone
            SoundManager.createOsc(400, 'sawtooth', t, 0.3, 0.12);
            SoundManager.createOsc(300, 'sawtooth', t + 0.15, 0.4, 0.12);
            SoundManager.createOsc(200, 'sawtooth', t + 0.3, 0.5, 0.15);
            // Low thud
            SoundManager.createOsc(80, 'sine', t + 0.5, 0.4, 0.25);
        },

        playRim: () => {
            // Metallic rim clank
            const t = audioCtx.currentTime;
            SoundManager.createOsc(200, 'square', t, 0.1, 0.25);
            SoundManager.createOsc(250, 'sawtooth', t, 0.08, 0.2);
            SoundManager.createOsc(800, 'sine', t, 0.05, 0.05);
        },

        playBackboard: () => {
            // Dull thud on backboard
            const t = audioCtx.currentTime;
            SoundManager.createOsc(120, 'square', t, 0.1, 0.3);
            SoundManager.createOsc(80, 'sine', t, 0.2, 0.4);
        },

        playARScan: () => {
            // Futuristic AR scanning sound
            const t = audioCtx.currentTime;
            // Ascending beeps
            SoundManager.createOsc(600, 'sine', t, 0.1, 0.1);
            SoundManager.createOsc(800, 'sine', t + 0.1, 0.1, 0.1);
            SoundManager.createOsc(1000, 'sine', t + 0.2, 0.1, 0.1);
            SoundManager.createOsc(1200, 'sine', t + 0.3, 0.15, 0.12);
            // Completion tone
            SoundManager.createOsc(1500, 'triangle', t + 0.5, 0.3, 0.08);
        },

        // --- Turbo Music (Dopamine Loop) ---
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
                // Kick
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
                // Hat/Snare
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
                // Bass pulse
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


    // --- Interaction Hook ---
    document.body.addEventListener('click', () => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
    }, { once: true });

    // --- Add click sound to ALL buttons ---
    document.addEventListener('DOMContentLoaded', () => {
        const allButtons = document.querySelectorAll('button, .btn, .modal-btn');
        allButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                SoundManager.playClick();
            });
        });
    });



    // --- Play Logic ---
    playBtn.addEventListener('click', () => {
        if (isShooting) return;

        const betAmount = parseFloat(betInput.value);
        if (betAmount > balance) {
            alert("Saldo insuficiente!");
            return;
        }

        const shots = isTurbo ? 3 : 1;
        const totalCost = betAmount * shots;

        if (totalCost > balance) {
            alert(`Saldo insuficiente para modo Turbo (${shots}x apostas)!`);
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

            // Deduct cost
            balance -= betAmount;
            userBalanceDisplay.innerText = formatCurrency(balance);

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
        // Sound: Shoot sound only in Turbo
        if (isTurbo) {
            SoundManager.playShoot();
        }

        // Clone Ball
        const ballClone = ball.cloneNode(true);
        ballContainer.appendChild(ballClone);

        ball.style.opacity = '0';

        ballClone.style.position = 'absolute';
        ballClone.style.bottom = '0';
        ballClone.style.left = '50%';
        ballClone.style.transform = 'translate(-50%, 0)';

        let outcome = 'loss';
        let animClass = '';

        // 82-98 Win
        if (force > 82 && force < 98) {
            outcome = 'win';
            animClass = 'shooting-swish';
        } else if (force >= 98) {
            outcome = 'long';
            animClass = 'shooting-miss-long';
        } else if (force > 75) {
            outcome = 'rim-out';
            animClass = 'shooting-rim-out';
        } else {
            outcome = 'short';
            animClass = 'shooting-miss-short';
        }

        ballClone.classList.remove('spinning', 'spinning-turbo');
        void ballClone.offsetWidth;
        ballClone.classList.add(animClass);

        setTimeout(() => {
            if (outcome === 'win') {
                // ALWAYS play win sound (normal + turbo)
                SoundManager.playWin();

                // Net Splash Animation
                const net = document.getElementById('hoop-net');
                if (net) {
                    net.classList.remove('splash');
                    void net.offsetWidth;
                    net.classList.add('splash');
                }

                const multiplier = (Math.random() * (1.5) + 1.5).toFixed(2);
                const winAmount = betAmount * multiplier;
                balance += winAmount;
                showToast(`+R$ ${formatCurrency(winAmount)}`, 'success', true);
                addToHistory(betAmount, winAmount, true);
            } else if (outcome === 'rim-out') {
                if (isTurbo) {
                    SoundManager.playRim();
                }
                // ALWAYS play loss sound (normal + turbo)
                setTimeout(SoundManager.playLoss, isTurbo ? 400 : 200);
                addToHistory(betAmount, 0, false);
            } else if (outcome === 'long') {
                if (isTurbo) {
                    SoundManager.playBackboard();
                }
                // ALWAYS play loss sound (normal + turbo)
                setTimeout(SoundManager.playLoss, isTurbo ? 400 : 200);
                addToHistory(betAmount, 0, false);
            } else {
                // Short
                if (isTurbo) {
                    SoundManager.playRim();
                }
                // ALWAYS play loss sound (normal + turbo)
                setTimeout(SoundManager.playLoss, isTurbo ? 400 : 200);
                addToHistory(betAmount, 0, false);
            }
            userBalanceDisplay.innerText = formatCurrency(balance);

            setTimeout(() => ballClone.remove(), 200);

        }, 600);

        setTimeout(() => {
            ball.style.opacity = '1';
        }, 400);
    }



    // --- Modals Logic ---
    function openModal(modalId) {
        if (modalId === 'modal-withdraw' || modalId === 'modal-history' || modalId === 'modal-profile') {
            updateProfileStats();
        }
        modalOverlay.classList.remove('hidden');
        modals.forEach(m => m.classList.add('hidden'));
        document.getElementById(modalId).classList.remove('hidden');
    }

    function closeModal() {
        modalOverlay.classList.add('hidden');
        modals.forEach(m => m.classList.add('hidden'));
    }

    modalTriggers.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = btn.getAttribute('data-modal');
            if (target) openModal(target);
        });
    });

    closeBtns.forEach(btn => btn.addEventListener('click', closeModal));
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    // --- Logout ---
    const logoutBtns = document.querySelectorAll('.btn-action.danger, .logout-trigger');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            localStorage.removeItem('basketbet_user');
            window.location.href = 'login.html';
        });
    });

    // --- Deposit Logic ---
    const depositInput = document.getElementById('deposit-amount-input');
    const depositButtons = document.querySelectorAll('.pix-options button');
    const generatePixBtn = document.getElementById('generate-pix-btn');

    if (depositButtons) {
        depositButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const val = btn.getAttribute('data-value');
                if (val && depositInput) {
                    depositInput.value = parseFloat(val).toFixed(2);
                    // Add visual feedback
                    depositButtons.forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                }
            });
        });
    }

    if (generatePixBtn) {
        generatePixBtn.addEventListener('click', () => {
            const amount = parseFloat(depositInput.value);
            if (isNaN(amount) || amount <= 0) {
                showToast("Insira um valor válido!", "error");
                return;
            }

            // Simulation of PIX generation
            showToast(`QR Code de R$ ${formatCurrency(amount)} gerado!`, "success");

            // For testing: add balance after 2 seconds
            setTimeout(() => {
                balance += amount;
                userBalanceDisplay.innerText = formatCurrency(balance);
                updateProfileStats();
                showToast("Depósito de R$ " + formatCurrency(amount) + " confirmado!", "success");
                closeModal();
            }, 3000);
        });
    }

    // --- Toast ---
    function showToast(msg, type, quick = false) {
        const toast = document.createElement('div');
        toast.innerText = msg;
        Object.assign(toast.style, {
            position: 'fixed',
            top: '30%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '0.5rem 1.5rem',
            borderRadius: '12px',
            color: '#fff',
            fontWeight: 'bold',
            zIndex: '200',
            background: type === 'success' ? '#00d26a' : '#f53d3d',
            boxShadow: '0 5px 15px rgba(0,0,0,0.5)',
            fontSize: '1rem',
            textAlign: 'center',
            pointerEvents: 'none'
        });
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), quick ? 800 : 2000);
    }
});
