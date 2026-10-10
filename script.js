// ============================================================
// DaMoA — Hebi Inspired Dashboard script.js v3.1
// Client ID: 1558397761861451806
// Support Server: https://discord.gg/ZnWmyyXF5s
// ============================================================

const CLIENT_ID = '1558397761861451806';
const MAX_SLOTS = 30;

// Official Platform Metadata & Image Icons
const PLATFORMS = {
    youtube: {
        name: 'YouTube',
        icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT35KBL5ifTR1qh-c7-UZJc5bGYTI2kXnyaGDGnZmeuiA&s=10'
    },
    chzzk: {
        name: '치지직',
        icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTL5o8WMTcizruTWGFYaAhK61h-fAJWIeRGGI5g8NC9dA&s=10'
    },
    twitter: {
        name: 'X (Twitter)',
        icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSFbqet-sK8lwsz1nprOmg_E1x993Wvuliu2MmbCwVcOw&s=10'
    },
    cime: {
        name: '씨미',
        icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRwoAs9YU5vS94EgfUPeMLdzq7EQLy7SlpRNK0i_6J8Bg&s=10'
    },
    instagram: {
        name: 'Instagram',
        icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR1mEo2-NnFTlPRLM13eEJf-qv66rqJUPRu-bAneh4Ncg&s=10'
    },
    spotify: {
        name: '스포티파이',
        icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRgoYNyRiH1MSuh1ZL_KreEfYiturY4NYE4RCGB4WhaWw&s=10'
    },
    naver_cafe: {
        name: '네이버 카페',
        icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSxadZQFctX2N4f0GoOvuwyhOZSZY-ekXKG3f01L6-Ugw&s=10'
    },
    soop: {
        name: 'SOOP',
        icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTTET5t-HJitRYOD1ESgF4E8MwfCTcwztdUaGdP6a7Wdg&s=10'
    },
};

// Global State
const state = {
    token: null,
    user: null,
    demo: false,
    guilds: [],
    botGuilds: new Set(),
    selectedGuild: null,
    settings: [],
    channels: [],
    roles: [],
    filter: 'all',
    searchQuery: '',
    currentView: 'landing', // 'landing' | 'dashboard'
    currentTab: 'overview', // 'overview' | 'settings' | 'history'
    editingSlot: null,      // null for new, slot number for edit
};

// ── Helpers ─────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }

function showToast(msg) {
    const t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 3500);
}

function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

async function apiFetch(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
    if (state.demo) headers['X-Demo'] = '1';
    try {
        const res = await fetch(path, { ...opts, headers });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        return await res.json();
    } catch (e) {
        console.warn(`API Error [${path}]:`, e);
        throw e;
    }
}

// ── Authentication ──────────────────────────────────────────
function loginWithDiscord() {
    const redirectUri = window.location.origin + '/auth/callback';
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'identify guilds',
    });
    window.location.href = `https://discord.com/oauth2/authorize?${params.toString()}`;
}

function logout() {
    state.token = null;
    state.user = null;
    state.demo = false;
    state.guilds = [];
    state.settings = [];
    localStorage.removeItem('damoa_token');
    localStorage.removeItem('damoa_demo_settings');
    switchView('landing');
    showToast('로그아웃되었습니다.');
}

// ── View Switching ──────────────────────────────────────────
function switchView(viewName) {
    state.currentView = viewName;
    const landing = $('view-landing');
    const dash = $('view-dashboard');

    if (viewName === 'dashboard') {
        if (landing) landing.style.display = 'none';
        if (dash) dash.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'instant' });
    } else {
        if (landing) landing.style.display = 'block';
        if (dash) dash.style.display = 'none';
    }
}

function switchTab(tabName) {
    state.currentTab = tabName;
    
    // Update active nav button
    ['overview', 'settings', 'history'].forEach(t => {
        const btn = $(`nav-tab-${t}`);
        const mBtn = $(`m-nav-${t}`);
        if (btn) btn.classList.toggle('active', t === tabName);
        if (mBtn) mBtn.classList.toggle('active', t === tabName);
    });

    const crumb = $('crumb-title');
    const heading = $('dash-section-title');
    const desc = $('dash-section-desc');
    const stats = $('stats-panel');
    const mainGrid = $('main-grid-panel');
    const historyPanel = $('panel-history');

    if (tabName === 'overview') {
        if (crumb) crumb.textContent = '대시보드';
        if (heading) heading.textContent = '알림을 한눈에';
        if (desc) desc.textContent = '치지직, SOOP, YouTube 등의 새로운 소식을 전하는 연결들을 살펴보세요.';
        if (stats) stats.style.display = 'grid';
        if (mainGrid) mainGrid.style.display = 'grid';
        if (historyPanel) historyPanel.style.display = 'none';
    } else if (tabName === 'settings') {
        if (crumb) crumb.textContent = '알림 설정';
        if (heading) heading.textContent = '알림 슬롯 설정';
        if (desc) desc.textContent = '알림을 받을 채널과 멘션 역할, 방송 이벤트 종류를 세부적으로 조정하세요.';
        if (stats) stats.style.display = 'none';
        if (mainGrid) mainGrid.style.display = 'grid';
        if (historyPanel) historyPanel.style.display = 'none';
    } else if (tabName === 'history') {
        if (crumb) crumb.textContent = '전송 기록';
        if (heading) heading.textContent = '최근 전송 내역';
        if (desc) desc.textContent = '서버 채널로 성공적으로 전달된 알림 기록입니다.';
        if (stats) stats.style.display = 'none';
        if (mainGrid) mainGrid.style.display = 'none';
        if (historyPanel) historyPanel.style.display = 'block';
        renderHistoryList();
    }
}

// ── Demo Mode ───────────────────────────────────────────────
function enterDemo() {
    state.demo = true;
    state.user = { id: 'demo_user', username: '체험 사용자', avatar: null };
    
    let saved = null;
    try {
        saved = JSON.parse(localStorage.getItem('damoa_demo_settings'));
    } catch {}

    state.guilds = [
        { id: 'demo_guild_1', name: '✨ 체험용 디스코드 서버' }
    ];
    state.botGuilds = new Set(['demo_guild_1']);
    state.selectedGuild = 'demo_guild_1';

    state.channels = [
        { id: 'ch_1', name: '방송-알림' },
        { id: 'ch_2', name: '영상-소식' },
        { id: 'ch_3', name: '일반-채팅' }
    ];
    state.roles = [
        { id: 'role_1', name: '방송 알림' },
        { id: 'role_2', name: '유튜브 알림' }
    ];

    if (saved && Array.isArray(saved) && saved.length > 0) {
        state.settings = saved;
    } else {
        state.settings = [
            {
                slot: 1,
                platform: 'chzzk',
                target_url: 'https://chzzk.naver.com/4b73b508d4b31a89bba4c1800f40d172',
                target_name: '치지직 공식 스트리머',
                channel_id: 'ch_1',
                channel_name: '방송-알림',
                role_id: 'role_1',
                role_name: '방송 알림',
                enabled: true,
                kinds: ['live_start', 'live_end', 'live_scheduled'],
                custom_message: '치지직 라이브가 시작되었습니다! 함께해요 ✨'
            },
            {
                slot: 2,
                platform: 'soop',
                target_url: 'https://ch.sooplive.co.kr/afreecatv',
                target_name: 'SOOP 라이브 방송',
                channel_id: 'ch_1',
                channel_name: '방송-알림',
                role_id: null,
                role_name: null,
                enabled: true,
                kinds: ['live_start'],
                custom_message: null
            },
            {
                slot: 3,
                platform: 'youtube',
                target_url: 'https://www.youtube.com/@damoa_official',
                target_name: 'YouTube 콘텐츠 채널',
                channel_id: 'ch_2',
                channel_name: '영상-소식',
                role_id: 'role_2',
                role_name: '유튜브 알림',
                enabled: false,
                kinds: ['live_start', 'live_end'],
                custom_message: '새로운 영상이 업로드되었습니다!'
            }
        ];
    }

    $('banner-demo').style.display = 'flex';
    $('banner-bot-invite').style.display = 'none';
    updateUserInfoUI();
    renderGuildSelect();
    renderSourceList();
    renderStats();
    switchView('dashboard');
    switchTab('overview');
    showToast('체험 공간에 오신 것을 환영합니다! 마음껏 변경해보세요.');
}

function resetDemo() {
    localStorage.removeItem('damoa_demo_settings');
    enterDemo();
}

// ── UI Updates ──────────────────────────────────────────────
function updateUserInfoUI() {
    const avatarEl = $('dash-user-avatar');
    const nameEl = $('dash-user-name');

    if (state.user) {
        nameEl.textContent = state.user.global_name || state.user.username || '사용자';
        if (state.user.avatar) {
            avatarEl.innerHTML = `<img src="https://cdn.discordapp.com/avatars/${state.user.id}/${state.user.avatar}.png?size=64" alt="avatar">`;
        } else {
            avatarEl.textContent = (nameEl.textContent.charAt(0) || 'D').toUpperCase();
        }
    } else {
        nameEl.textContent = '체험 사용자';
        avatarEl.textContent = 'D';
    }
}

function renderGuildSelect() {
    const sel = $('dash-guild-select');
    sel.innerHTML = '';

    if (!state.guilds || state.guilds.length === 0) {
        sel.innerHTML = '<option value="">관리 가능한 서버 없음</option>';
        return;
    }

    state.guilds.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id;
        const isConnected = state.botGuilds.has(g.id);
        opt.textContent = isConnected ? g.name : `${g.name} (봇 초대 필요)`;
        if (g.id === state.selectedGuild) opt.selected = true;
        sel.appendChild(opt);
    });

    checkBotInviteBanner();
}

function checkBotInviteBanner() {
    const banner = $('banner-bot-invite');
    const inviteLink = $('link-invite-server');
    if (!banner || !inviteLink) return;

    if (state.demo) {
        banner.style.display = 'none';
        return;
    }

    const currentId = state.selectedGuild;
    if (currentId && !state.botGuilds.has(currentId)) {
        banner.style.display = 'flex';
        inviteLink.href = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&permissions=8&scope=bot%20applications.commands&guild_id=${currentId}`;
    } else {
        banner.style.display = 'none';
    }
}

function renderStats() {
    const activeSlots = state.settings.filter(s => s.enabled).length;
    $('stat-active-slots').textContent = activeSlots;
    $('slots-badge').textContent = `${state.settings.length} / ${MAX_SLOTS} SLOTS`;

    const isConnected = state.demo ? true : state.botGuilds.has(state.selectedGuild);
    const botStatus = $('stat-bot-status');
    const botNote = $('stat-bot-note');
    if (isConnected) {
        botStatus.textContent = '연결됨';
        botStatus.style.color = '#3b827e';
        botNote.textContent = '정상 작동 중';
    } else {
        botStatus.textContent = '초대 필요';
        botStatus.style.color = '#c2410c';
        botNote.textContent = '서버에 봇을 추가하세요';
    }

    $('stat-delivered').textContent = state.demo ? '128' : '0';
}

function renderSourceList() {
    const container = $('source-list-container');
    if (!container) return;

    let items = state.settings || [];

    // Filter
    if (state.filter === 'enabled') {
        items = items.filter(s => s.enabled);
    } else if (state.filter === 'disabled') {
        items = items.filter(s => !s.enabled);
    }

    // Search query
    if (state.searchQuery.trim()) {
        const q = state.searchQuery.toLowerCase();
        items = items.filter(s => {
            const pName = (PLATFORMS[s.platform]?.name || '').toLowerCase();
            const target = (s.target_name || s.target_url || '').toLowerCase();
            const ch = (s.channel_name || '').toLowerCase();
            return pName.includes(q) || target.includes(q) || ch.includes(q);
        });
    }

    if (items.length === 0) {
        container.innerHTML = `<div class="empty">
            조건에 일치하는 알림이 없습니다.<br>
            검색어나 필터를 변경하거나 새로운 알림을 등록해보세요.
        </div>`;
        return;
    }

    container.innerHTML = items.map(s => {
        const pMeta = PLATFORMS[s.platform] || { name: s.platform, icon: '' };
        const chName = s.channel_name ? `# ${s.channel_name}` : '채널 미선택';
        const targetLabel = s.target_name || s.target_url || '대상 미지정';
        const kindsCount = (s.kinds || []).length;

        return `
        <article class="source-row">
            <div class="source-identity">
                <span class="platform-bubble">
                    <img src="${pMeta.icon}" alt="${escapeHtml(pMeta.name)}">
                </span>
                <div class="source-info">
                    <strong>${escapeHtml(pMeta.name)}</strong>
                    <small title="${escapeHtml(targetLabel)}">${escapeHtml(targetLabel)}</small>
                </div>
            </div>
            <div class="source-detail">
                <span class="source-channel">${escapeHtml(chName)}</span>
                <span class="source-health">
                    <i class="fas fa-check" style="font-size:10px;"></i> ${kindsCount}개 이벤트 활성
                </span>
                ${s.role_name ? `<small style="color:#7b4eff;">@ ${escapeHtml(s.role_name)} 멘션</small>` : ''}
            </div>
            <div class="source-state">
                <span class="pill ${s.enabled ? '' : 'muted'}">
                    <i></i>${s.enabled ? '켜짐' : '꺼짐'}
                </span>
                <button class="btn-edit-slot" data-slot="${s.slot}" aria-label="설정 변경">
                    <i class="fas fa-sliders-h"></i> <span>설정</span>
                </button>
            </div>
        </article>
        `;
    }).join('');

    // Bind edit buttons
    container.querySelectorAll('.btn-edit-slot').forEach(btn => {
        btn.addEventListener('click', () => {
            const slotNum = parseInt(btn.dataset.slot, 10);
            openConfigModal(slotNum);
        });
    });
}

function renderHistoryList() {
    const container = $('history-list-container');
    if (!container) return;

    if (state.demo) {
        container.innerHTML = `
            <div class="history-row">
                <span>치지직 라이브 시작 알림</span>
                <span><span class="pill">전송 완료</span></span>
                <time>방금 전</time>
            </div>
            <div class="history-row">
                <span>SOOP 스트림 감지 알림</span>
                <span><span class="pill">전송 완료</span></span>
                <time>15분 전</time>
            </div>
            <div class="history-row">
                <span>YouTube 새 동영상 알림</span>
                <span><span class="pill muted">전송 완료</span></span>
                <time>1시간 전</time>
            </div>
        `;
    } else {
        container.innerHTML = `<div class="empty">새로운 방송 소식이 전송되면 여기에 기록됩니다.</div>`;
    }
}

// ── Guild Data Loading & Real-time Bot Sync ─────────────────
async function loadUserData() {
    // 1. Fetch user profile from Discord
    const userRes = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (userRes.status === 401) {
        localStorage.removeItem('damoa_token');
        state.token = null;
        switchView('landing');
        return;
    }

    if (!userRes.ok) {
        throw new Error('Discord 사용자 정보를 가져올 수 없습니다.');
    }

    state.user = await userRes.json();
    updateUserInfoUI();

    // 2. Fetch user's guilds from Discord
    const guildsRes = await fetch('https://discord.com/api/v10/users/@me/guilds', {
        headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (!guildsRes.ok) {
        throw new Error('Discord 서버 목록을 가져올 수 없습니다.');
    }

    const allGuilds = await guildsRes.json();

    // Filter guilds where user is Owner OR has Administrator (0x8) OR Manage Guild (0x20)
    state.guilds = allGuilds.filter(g => {
        if (g.owner) return true;
        const p = BigInt(g.permissions || 0);
        return ((p & 0x8n) === 0x8n) || ((p & 0x20n) === 0x20n);
    });

    // 3. Try to fetch bot's joined guilds from backend
    try {
        const bg = await apiFetch('/api/bot/guilds');
        if (bg && bg.guild_ids) {
            state.botGuilds = new Set(bg.guild_ids);
        }
    } catch {
        console.warn('Bot guild status unavailable from backend.');
    }

    // Auto-select first guild
    if (state.guilds.length > 0) {
        state.selectedGuild = state.guilds[0].id;
        renderGuildSelect();
        await onGuildChange(state.selectedGuild);
    } else {
        renderGuildSelect();
        renderStats();
    }

    switchView('dashboard');
    switchTab('overview');
}

async function onGuildChange(guildId) {
    state.selectedGuild = guildId;

    if (state.demo) return;

    try {
        // Load channels, roles, settings
        const [chRes, roleRes, setRes] = await Promise.all([
            apiFetch(`/api/channels?guild_id=${guildId}`).catch(() => ({ channels: [] })),
            apiFetch(`/api/roles?guild_id=${guildId}`).catch(() => ({ roles: [] })),
            apiFetch(`/api/settings?guild_id=${guildId}`).catch(() => ({ settings: [] })),
        ]);

        state.channels = chRes.channels || [];
        state.roles = roleRes.roles || [];
        state.settings = setRes.settings || [];

        // Real-time synchronization: If channels or settings exist, bot is definitely connected!
        if (state.channels.length > 0 || state.settings.length > 0) {
            state.botGuilds.add(guildId);
            
            // Real-time update dropdown option text
            const sel = $('dash-guild-select');
            if (sel) {
                const opt = sel.querySelector(`option[value="${guildId}"]`);
                const guildObj = state.guilds.find(g => g.id === guildId);
                if (opt && guildObj) opt.textContent = guildObj.name;
            }
        }
    } catch (e) {
        console.error('Failed to load guild details:', e);
    }

    checkBotInviteBanner();
    renderSourceList();
    renderStats();
}

// ── Modal Dialog Operations ─────────────────────────────────
function openConfigModal(slotNum = null) {
    state.editingSlot = slotNum;
    const dialog = $('config-dialog');
    const titleEl = $('modal-dialog-title');
    const deleteBtn = $('btn-delete-slot');
    const errorEl = $('modal-form-error');
    errorEl.style.display = 'none';

    // Populate channels dropdown
    const chSel = $('modal-channel');
    chSel.innerHTML = '<option value="">채널을 선택하세요</option>';
    state.channels.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `# ${c.name}`;
        chSel.appendChild(opt);
    });

    // Populate roles dropdown
    const roleSel = $('modal-role');
    roleSel.innerHTML = '<option value="">멘션하지 않음</option>';
    state.roles.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = `@ ${r.name}`;
        roleSel.appendChild(opt);
    });

    if (slotNum !== null) {
        // Editing existing slot
        titleEl.textContent = `슬롯 #${slotNum} 알림 설정`;
        deleteBtn.style.display = 'inline-flex';

        const item = state.settings.find(s => s.slot === slotNum);
        if (item) {
            $('modal-platform').value = item.platform || 'chzzk';
            $('modal-target').value = item.target_url || '';
            chSel.value = item.channel_id || '';
            roleSel.value = item.role_id || '';
            $('modal-custom-msg').value = item.custom_message || '';
            $('modal-enabled').checked = !!item.enabled;

            const kinds = item.kinds || ['live_start'];
            $('ev-live-start').checked = kinds.includes('live_start');
            $('ev-live-end').checked = kinds.includes('live_end');
            $('ev-live-scheduled').checked = kinds.includes('live_scheduled');
        }
    } else {
        // Adding new slot
        titleEl.textContent = '새 알림 등록';
        deleteBtn.style.display = 'none';

        if (state.settings.length >= MAX_SLOTS) {
            showToast(`최대 슬롯(${MAX_SLOTS}개)을 모두 사용 중입니다.`);
            return;
        }

        $('modal-platform').value = 'chzzk';
        $('modal-target').value = '';
        chSel.value = state.channels.length > 0 ? state.channels[0].id : '';
        roleSel.value = '';
        $('modal-custom-msg').value = '';
        $('modal-enabled').checked = true;
        $('ev-live-start').checked = true;
        $('ev-live-end').checked = true;
        $('ev-live-scheduled').checked = true;
    }

    dialog.showModal();
}

async function handleSaveSlot(e) {
    e.preventDefault();
    const errorEl = $('modal-form-error');
    errorEl.style.display = 'none';

    const platform = $('modal-platform').value;
    const targetUrl = $('modal-target').value.trim();
    const channelId = $('modal-channel').value;
    const roleId = $('modal-role').value || null;
    const customMessage = $('modal-custom-msg').value.trim() || null;
    const enabled = $('modal-enabled').checked;

    const kinds = [];
    if ($('ev-live-start').checked) kinds.push('live_start');
    if ($('ev-live-end').checked) kinds.push('live_end');
    if ($('ev-live-scheduled').checked) kinds.push('live_scheduled');

    if (!targetUrl) {
        errorEl.textContent = '추적할 URL 또는 채널 ID를 입력해주세요.';
        errorEl.style.display = 'block';
        return;
    }
    if (!channelId) {
        errorEl.textContent = '알림을 전송할 채널을 선택해주세요.';
        errorEl.style.display = 'block';
        return;
    }
    if (kinds.length === 0) {
        errorEl.textContent = '적어도 하나 이상의 방송 이벤트를 선택해주세요.';
        errorEl.style.display = 'block';
        return;
    }

    const chObj = state.channels.find(c => c.id === channelId);
    const roleObj = state.roles.find(r => r.id === roleId);

    const slotNumber = state.editingSlot !== null 
        ? state.editingSlot 
        : getNextAvailableSlot();

    const newSetting = {
        slot: slotNumber,
        platform,
        target_url: targetUrl,
        target_name: targetUrl.split('/').pop() || platform,
        channel_id: channelId,
        channel_name: chObj ? chObj.name : '알림-채널',
        role_id: roleId,
        role_name: roleObj ? roleObj.name : null,
        enabled,
        kinds,
        custom_message: customMessage,
    };

    if (state.demo) {
        const existingIdx = state.settings.findIndex(s => s.slot === slotNumber);
        if (existingIdx >= 0) {
            state.settings[existingIdx] = newSetting;
        } else {
            state.settings.push(newSetting);
        }
        localStorage.setItem('damoa_demo_settings', JSON.stringify(state.settings));
        showToast(`슬롯 #${slotNumber} 설정이 저장되었습니다.`);
        $('config-dialog').close();
        renderSourceList();
        renderStats();
        return;
    }

    // Call Real Backend API
    try {
        await apiFetch(`/api/settings`, {
            method: 'POST',
            body: JSON.stringify({
                guild_id: state.selectedGuild,
                ...newSetting
            })
        });
        showToast(`슬롯 #${slotNumber} 설정이 Discord 봇에 적용되었습니다!`);
        $('config-dialog').close();
        await onGuildChange(state.selectedGuild);
    } catch (err) {
        errorEl.textContent = `저장 실패: ${err.message}`;
        errorEl.style.display = 'block';
    }
}

async function handleDeleteSlot() {
    if (state.editingSlot === null) return;
    const slotNum = state.editingSlot;

    if (!confirm(`슬롯 #${slotNum} 알림을 삭제하시겠습니까?`)) return;

    if (state.demo) {
        state.settings = state.settings.filter(s => s.slot !== slotNum);
        localStorage.setItem('damoa_demo_settings', JSON.stringify(state.settings));
        showToast(`슬롯 #${slotNum} 알림이 삭제되었습니다.`);
        $('config-dialog').close();
        renderSourceList();
        renderStats();
        return;
    }

    try {
        await apiFetch(`/api/settings/${slotNum}?guild_id=${state.selectedGuild}`, {
            method: 'DELETE'
        });
        showToast(`슬롯 #${slotNum} 알림이 삭제되었습니다.`);
        $('config-dialog').close();
        await onGuildChange(state.selectedGuild);
    } catch (err) {
        showToast(`삭제 실패: ${err.message}`);
    }
}

function getNextAvailableSlot() {
    const used = new Set(state.settings.map(s => s.slot));
    for (let i = 1; i <= MAX_SLOTS; i++) {
        if (!used.has(i)) return i;
    }
    return state.settings.length + 1;
}

// ── Event Listeners ─────────────────────────────────────────
function setupEventListeners() {
    // Topbar & Hero actions
    $('btn-hero-login')?.addEventListener('click', loginWithDiscord);
    $('btn-cta-login')?.addEventListener('click', loginWithDiscord);
    $('btn-hero-demo')?.addEventListener('click', enterDemo);
    $('btn-preview-demo')?.addEventListener('click', enterDemo);

    $('btn-top-dashboard')?.addEventListener('click', () => {
        if (state.token || state.demo) {
            switchView('dashboard');
        } else {
            loginWithDiscord();
        }
    });

    $('btn-logout')?.addEventListener('click', logout);
    $('link-back-home')?.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('landing');
    });
    $('link-side-home')?.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('landing');
    });

    // Motion pause toggle
    $('motion-toggle')?.addEventListener('click', () => {
        const isPaused = document.body.classList.toggle('motion-paused');
        $('motion-toggle').innerHTML = `<i class="fas fa-${isPaused ? 'play' : 'pause'}"></i> ${isPaused ? '애니메이션 재생' : '애니메이션 멈춤'}`;
    });

    // Reset Demo
    $('btn-reset-demo')?.addEventListener('click', resetDemo);

    // Sidebar navigation tabs
    $('nav-tab-overview')?.addEventListener('click', () => switchTab('overview'));
    $('nav-tab-settings')?.addEventListener('click', () => switchTab('settings'));
    $('nav-tab-history')?.addEventListener('click', () => switchTab('history'));

    $('m-nav-overview')?.addEventListener('click', () => switchTab('overview'));
    $('m-nav-settings')?.addEventListener('click', () => switchTab('settings'));
    $('m-nav-history')?.addEventListener('click', () => switchTab('history'));

    // Server select change
    $('dash-guild-select')?.addEventListener('change', (e) => {
        onGuildChange(e.target.value);
    });

    // Search input
    $('input-source-search')?.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        renderSourceList();
    });

    // Refresh buttons with live bot guild recheck
    const handleRefresh = async () => {
        try {
            const bg = await apiFetch('/api/bot/guilds');
            if (bg && bg.guild_ids) {
                bg.guild_ids.forEach(id => state.botGuilds.add(id));
            }
        } catch {}
        if (state.selectedGuild) {
            await onGuildChange(state.selectedGuild);
        }
        renderGuildSelect();
        showToast('서버 및 봇 연결 상태를 실시간 동기화했습니다.');
    };

    $('btn-refresh-sources')?.addEventListener('click', handleRefresh);
    $('btn-aside-refresh')?.addEventListener('click', handleRefresh);

    // Filter tabs (all / enabled / disabled)
    document.querySelectorAll('.source-filters button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.source-filters button').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');
            state.filter = btn.dataset.filter;
            renderSourceList();
        });
    });

    // Slot Add button
    $('btn-add-slot')?.addEventListener('click', () => openConfigModal(null));

    // Modal dialog controls
    $('btn-close-dialog')?.addEventListener('click', () => $('config-dialog').close());
    $('btn-cancel-dialog')?.addEventListener('click', () => $('config-dialog').close());
    $('config-form')?.addEventListener('submit', handleSaveSlot);
    $('btn-delete-slot')?.addEventListener('click', handleDeleteSlot);
}

// ── Application Boot ────────────────────────────────────────
async function init() {
    setupEventListeners();

    // 1. Check URL Hash for OAuth Access Token
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get('access_token')) {
        state.token = hash.get('access_token');
        localStorage.setItem('damoa_token', state.token);
        history.replaceState(null, '', window.location.pathname);
    }

    // 2. Check LocalStorage for saved token
    if (!state.token) {
        state.token = localStorage.getItem('damoa_token');
    }

    // 3. Check Query parameter for demo mode
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('demo') === '1') {
        enterDemo();
        return;
    }

    // 4. If token exists, load user profile & guilds
    if (state.token) {
        try {
            await loadUserData();
        } catch (err) {
            console.error('Auth initialization error:', err);
            if (String(err).includes('401')) {
                localStorage.removeItem('damoa_token');
                state.token = null;
                switchView('landing');
            } else {
                showToast(`Discord 연결 알림: ${err.message}`);
                switchView('landing');
            }
        }
    } else {
        switchView('landing');
    }
}

window.addEventListener('DOMContentLoaded', init);
