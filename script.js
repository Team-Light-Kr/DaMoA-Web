// ============================================================
// DaMoA — Hebi Inspired Dashboard script.js v3.1
// Client ID: 1558397761861451806
// Support Server: https://discord.gg/ZnWmyyXF5s
// ============================================================

const CLIENT_ID = '1558397761861451806';
const MAX_SLOTS = 30;

// Official Platform Metadata & Image Icons
const PLATFORMS = {
    instagram: {
        name: '인스타그램',
        en: 'Instagram',
        color: '#E4405F',
        icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR1mEo2-NnFTlPRLM13eEJf-qv66rqJUPRu-bAneh4Ncg&s=10'
    },
    twitter: {
        name: '트위터',
        en: 'X / Twitter',
        color: '#1DA1F2',
        icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSFbqet-sK8lwsz1nprOmg_E1x993Wvuliu2MmbCwVcOw&s=10'
    },
    spotify: {
        name: '스포티파이',
        en: 'Spotify',
        color: '#1DB954',
        icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRgoYNyRiH1MSuh1ZL_KreEfYiturY4NYE4RCGB4WhaWw&s=10'
    },
    cime: {
        name: '씨미',
        en: '씨미',
        color: '#AA70FF',
        icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRwoAs9YU5vS94EgfUPeMLdzq7EQLy7SlpRNK0i_6J8Bg&s=10'
    },
    chzzk: {
        name: '치지직',
        en: '치지직',
        color: '#00FFA3',
        icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTL5o8WMTcizruTWGFYaAhK61h-fAJWIeRGGI5g8NC9dA&s=10'
    },
    youtube: {
        name: '유튜브',
        en: 'YouTube',
        color: '#FF0000',
        icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT35KBL5ifTR1qh-c7-UZJc5bGYTI2kXnyaGDGnZmeuiA&s=10'
    },
    naver_cafe: {
        name: '네이버 카페',
        en: '네이버 카페',
        color: '#03C75A',
        icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSxadZQFctX2N4f0GoOvuwyhOZSZY-ekXKG3f01L6-Ugw&s=10'
    },
    soop: {
        name: 'SOOP',
        en: 'SOOP',
        color: '#0C8CE9',
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
        const res = await fetch(path, { cache: 'no-store', ...opts, headers });
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
    const pickerUserEl = $('server-picker-user');

    if (state.user) {
        const uName = state.user.global_name || state.user.username || '사용자';
        nameEl.textContent = uName;
        const cleanName = uName.replace(/^!+\s*/, '');
        if (pickerUserEl) pickerUserEl.textContent = cleanName;
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
    const grid = $('guild-card-grid');
    if (sel) {
        sel.innerHTML = '';
        if (!state.guilds || state.guilds.length === 0) {
            sel.innerHTML = '<option value="">관리 가능한 서버 없음</option>';
        } else {
            state.guilds.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g.id;
                const isConnected = state.botGuilds.has(g.id);
                opt.textContent = isConnected ? g.name : `${g.name} (봇 초대 필요)`;
                if (g.id === state.selectedGuild) opt.selected = true;
                sel.appendChild(opt);
            });
        }
    }

    // Card grid matching todo1.png perfectly
    if (grid) {
        if (!state.guilds || state.guilds.length === 0) {
            grid.innerHTML = '<div class="guild-empty">관리자 권한이 있는 Discord 서버가 없습니다.</div>';
        } else {
            const botHas = state.guilds.filter(g => state.botGuilds.has(String(g.id)));
            const noBot = state.guilds.filter(g => !state.botGuilds.has(String(g.id)));

            let html = '';
            if (botHas.length > 0) {
                html += `<div class="guild-section-label">DaMoA가 있는 서버 ${botHas.length}</div>`;
                html += '<div class="server-large-grid">';
                botHas.forEach(g => {
                    const isSelected = g.id === state.selectedGuild;
                    const icon = g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : null;
                    const initials = g.name.replace(/[^\p{L}\p{N}]/gu, '').substring(0, 2).toUpperCase() || 'S';
                    const channelInfo = (isSelected && state.channels.length > 0) ? ` · 채널 ${state.channels.length}개` : '';
                    html += `
                    <div class="server-large-card ${isSelected ? 'selected' : ''}" data-guild-id="${g.id}" role="button" tabindex="0">
                        <div class="server-card-top">
                            <div class="server-icon-large">
                                ${icon ? `<img src="${icon}" alt="${escapeHtml(g.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
                                <span class="server-icon-initials" style="${icon ? 'display:none' : ''}">${escapeHtml(initials)}</span>
                            </div>
                            <span class="server-role-badge">관리자</span>
                        </div>
                        <div class="server-card-name" title="${escapeHtml(g.name)}">${escapeHtml(g.name)}</div>
                        <div class="server-card-meta">알림 설정 · 슬롯 관리${channelInfo}</div>
                        <div class="server-card-action">열기 →</div>
                    </div>`;
                });
                html += '</div>';
            }

            if (noBot.length > 0) {
                html += `<div class="guild-section-label">초대할 수 있는 서버 ${noBot.length}</div>`;
                html += '<div class="server-compact-grid">';
                noBot.forEach(g => {
                    const icon = g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64` : null;
                    const initials = g.name.replace(/[^\p{L}\p{N}]/gu, '').substring(0, 2).toUpperCase() || 'S';
                    const inviteUrl = `https://damoa.teamlight.pe.kr/invite?guild_id=${g.id}`;
                    html += `
                    <div class="server-compact-card">
                        <div class="server-compact-left">
                            <div class="server-icon-compact">
                                ${icon ? `<img src="${icon}" alt="${escapeHtml(g.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
                                <span class="server-icon-initials" style="${icon ? 'display:none' : ''}">${escapeHtml(initials)}</span>
                            </div>
                            <span class="server-compact-name" title="${escapeHtml(g.name)}">${escapeHtml(g.name)}</span>
                        </div>
                        <a class="server-invite-btn" href="${inviteUrl}" target="_blank" rel="noopener">+ 초대</a>
                    </div>`;
                });
                html += '</div>';
            }
            grid.innerHTML = html;

            // Bind large card click (열기 ->)
            grid.querySelectorAll('.server-large-card[data-guild-id]').forEach(card => {
                const handler = async (e) => {
                    const gid = card.dataset.guildId;
                    if (gid !== state.selectedGuild) {
                        await onGuildChange(gid);
                    }
                    const target = document.getElementById('dash-section-title') || document.getElementById('main-grid-panel');
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                    const guildObj = state.guilds.find(g => String(g.id) === String(gid));
                    showToast(`'${guildObj ? guildObj.name : '선택한 서버'}' 알림 설정으로 이동했습니다.`);
                };
                card.addEventListener('click', handler);
                card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') handler(e); });
            });
        }
    }

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
    if (currentId && !state.botGuilds.has(String(currentId))) {
        banner.style.display = 'flex';
        inviteLink.href = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&permissions=8&integration_type=0&scope=bot%20applications.commands&guild_id=${currentId}`;
    } else {
        banner.style.display = 'none';
    }
}

function renderStats() {
    const activeSlots = state.settings.filter(s => s.enabled).length;
    if ($('stat-active-slots')) $('stat-active-slots').textContent = activeSlots;
    if ($('slots-badge')) $('slots-badge').textContent = `${state.settings.length}개 설정됨 (플랫폼당 30개, 총 240개 가능)`;

    const isConnected = state.demo ? true : state.botGuilds.has(String(state.selectedGuild));
    const botStatus = $('stat-bot-status');
    const botNote = $('stat-bot-note');
    if (botStatus && botNote) {
        if (isConnected) {
            botStatus.textContent = '연결됨';
            botStatus.style.color = '#3b827e';
            botNote.textContent = '정상 작동 중';
        } else {
            botStatus.textContent = '초대 필요';
            botStatus.style.color = '#c2410c';
            botNote.textContent = '서버에 봇을 추가하세요';
        }
    }

    if ($('stat-delivered')) $('stat-delivered').textContent = state.demo ? '128' : '0';

    // Render Platform Category Grid (Image 2 - Discord /시작하기 style)
    renderPlatformCardsGrid();
}

function renderPlatformCardsGrid() {
    const grid = $('platform-cards-grid');
    if (!grid) return;

    const platformsOrder = ['instagram', 'twitter', 'spotify', 'cime', 'chzzk', 'youtube', 'naver_cafe', 'soop'];
    grid.innerHTML = platformsOrder.map(p => {
        const meta = PLATFORMS[p] || { name: p, en: p, icon: '' };
        const count = (state.settings || []).filter(s => s.platform === p).length;
        const isFull = count >= MAX_SLOTS;

        return `
        <article class="platform-card" data-platform="${p}">
            <div class="platform-card-head">
                <span class="platform-card-icon">
                    <img src="${meta.icon}" alt="${escapeHtml(meta.name)}">
                </span>
                <div class="platform-card-titles">
                    <span class="platform-card-name">${escapeHtml(meta.name)}</span>
                    <span class="platform-card-en">${escapeHtml(meta.en)}</span>
                </div>
            </div>
            <div class="platform-card-count">
                알림 대상 <span class="badge ${isFull ? 'full' : ''}">${count} / ${MAX_SLOTS}</span> 개
            </div>
            <div class="platform-card-actions">
                <button class="btn btn-card-add" data-platform="${p}" ${isFull ? 'disabled' : ''}>
                    <i class="fas fa-plus"></i> 알림 추가
                </button>
                <button class="btn btn-card-manage" data-platform="${p}">
                    <i class="fas fa-sliders-h"></i> 알림 관리
                </button>
            </div>
        </article>
        `;
    }).join('');

    const totalBadge = $('platform-total-slots-badge');
    if (totalBadge) totalBadge.textContent = `${(state.settings || []).length} / 240`;

    grid.querySelectorAll('.btn-card-add').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const platform = btn.dataset.platform;
            openConfigModal(null, platform);
        });
    });

    grid.querySelectorAll('.btn-card-manage').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const platform = btn.dataset.platform;
            state.filter = platform;
            const searchInput = $('input-source-search');
            if (searchInput) searchInput.value = PLATFORMS[platform]?.name || platform;
            state.searchQuery = PLATFORMS[platform]?.name || platform;
            renderSourceList();
            const container = $('source-list-container');
            if (container) {
                container.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    });
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
        const broadcasterName = s.target_name || (s.target_url ? s.target_url.split('/').filter(Boolean).pop() : pMeta.name);
        const kindsCount = (s.kinds || []).length;

        return `
        <article class="source-row">
            <div class="source-identity">
                <span class="platform-bubble">
                    <img src="${pMeta.icon}" alt="${escapeHtml(pMeta.name)}">
                </span>
                <div class="source-info">
                    <strong title="${escapeHtml(broadcasterName)}">${escapeHtml(broadcasterName)}</strong>
                    <small title="${escapeHtml(targetLabel)}"><span style="color:#6366f1;font-weight:600;">${escapeHtml(pMeta.name)}</span> · 슬롯 #${s.slot}</small>
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
                <button class="btn-edit-slot" data-slot="${s.slot}" data-platform="${s.platform}" aria-label="설정 변경">
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
            const platform = btn.dataset.platform;
            openConfigModal(slotNum, platform);
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
        let bg = await apiFetch('/api/bot/guilds').catch(() => null);
        if (!bg || !bg.guild_ids) {
            bg = await apiFetch('/api/bot_guilds').catch(() => null);
        }
        if (bg && bg.guild_ids) {
            state.botGuilds = new Set(bg.guild_ids.map(String));
        }
    } catch {
        console.warn('Bot guild status unavailable from backend.');
    }

    // Auto-select first guild with bot, or fallback to first guild
    if (state.guilds.length > 0) {
        const preferred = state.guilds.find(g => state.botGuilds.has(String(g.id))) || state.guilds[0];
        state.selectedGuild = preferred.id;
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
        // Load channels, roles, settings and live bot check in parallel
        const [chRes, roleRes, setRes, botCheck] = await Promise.all([
            apiFetch(`/api/channels?guild_id=${guildId}`).catch(() => ({ channels: [] })),
            apiFetch(`/api/roles?guild_id=${guildId}`).catch(() => ({ roles: [] })),
            apiFetch(`/api/settings?guild_id=${guildId}`).catch(() => ({ settings: [] })),
            apiFetch(`/api/bot/check_guild?guild_id=${guildId}`).catch(() => 
                apiFetch(`/api/bot_check_guild?guild_id=${guildId}`).catch(() => ({ present: false }))
            ),
        ]);
        if (botCheck && botCheck.present) {
            state.botGuilds.add(guildId);
        }

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

        const guildObj = state.guilds.find(g => String(g.id) === String(guildId));
        if (guildObj) {
            const crumb = $('crumb-title');
            if (crumb) crumb.textContent = guildObj.name;
            const dashTitle = $('dash-section-title');
            if (dashTitle) dashTitle.textContent = `${guildObj.name} 알림 공간`;
            const dashDesc = $('dash-section-desc');
            if (dashDesc) {
                const chText = state.channels.length > 0 ? `감지된 텍스트 채널 ${state.channels.length}개 · 역할 ${state.roles.length}개` : '채널 불러오는 중...';
                dashDesc.textContent = `${guildObj.name} 서버의 ${chText}와 연결된 알림 슬롯을 설정하세요.`;
            }
        }
    } catch (e) {
        console.error('Failed to load guild details:', e);
    }

    checkBotInviteBanner();
    renderGuildSelect();
    renderSourceList();
    renderStats();
}

// ── Modal Dialog Operations ─────────────────────────────────

// ── Platform-specific Event Kinds & URL Hints ────────────────
const PLATFORM_EVENT_KINDS = {
    youtube: [
        { id: 'ev-post', value: 'post', label: '새 영상 (Upload)' },
        { id: 'ev-short', value: 'short', label: '쇼츠 (Short)' },
        { id: 'ev-community', value: 'community_post', label: '커뮤니티 글' },
        { id: 'ev-live-start', value: 'live_start', label: '라이브 시작' },
        { id: 'ev-live-end', value: 'live_end', label: '방송 종료' },
        { id: 'ev-live-scheduled', value: 'live_scheduled', label: '방송 예약' },
        { id: 'ev-premiere', value: 'premiere', label: '프리미어' },
    ],
    chzzk: [
        { id: 'ev-live-start', value: 'live_start', label: '라이브 시작' },
        { id: 'ev-live-end', value: 'live_end', label: '방송 종료' },
        { id: 'ev-live-scheduled', value: 'live_scheduled', label: '방송 예약' },
    ],
    soop: [
        { id: 'ev-live-start', value: 'live_start', label: '라이브 시작' },
        { id: 'ev-live-end', value: 'live_end', label: '방송 종료' },
        { id: 'ev-live-scheduled', value: 'live_scheduled', label: '방송 예약' },
    ],
    cime: [
        { id: 'ev-live-start', value: 'live_start', label: '라이브 시작' },
        { id: 'ev-live-end', value: 'live_end', label: '방송 종료' },
        { id: 'ev-live-scheduled', value: 'live_scheduled', label: '방송 예약' },
    ],
    twitter: [
        { id: 'ev-post', value: 'post', label: '새 트윗 (Post)' },
        { id: 'ev-space-start', value: 'space_start', label: '스페이스 시작 (음성 방송)' },
        { id: 'ev-space-end', value: 'space_end', label: '스페이스 종료' },
    ],
    instagram: [
        { id: 'ev-feed-post', value: 'feed_post', label: '피드 포스트' },
        { id: 'ev-story', value: 'story', label: '스토리' },
        { id: 'ev-reel', value: 'reel', label: '릴스 (Reels)' },
    ],
    spotify: [
        { id: 'ev-post', value: 'post', label: '새 트랙/음원' },
        { id: 'ev-playlist', value: 'playlist', label: '플레이리스트' },
        { id: 'ev-album', value: 'album', label: '새 앨범 (Album)' },
    ],
    naver_cafe: [
        { id: 'ev-post', value: 'post', label: '새 게시글' },
        { id: 'ev-notice', value: 'notice', label: '공지사항' },
        { id: 'ev-comment', value: 'comment', label: '댓글' },
    ],
};

const PLATFORM_URL_HINTS = {
    youtube: {
        placeholder: '예: https://youtube.com/@채널명  또는  https://youtube.com/channel/UC...',
        hint: 'YouTube 채널 핸들(@이름) 또는 채널 전체 URL을 입력하세요.'
    },
    chzzk: {
        placeholder: '예: https://chzzk.naver.com/4b73b508d4b31a89bba4c1800f40d172',
        hint: '치지직 채널 URL 또는 32자리 고유 채널 ID를 입력하세요.'
    },
    soop: {
        placeholder: '예: https://sooplive.com/방송국ID',
        hint: 'SOOP(아프리카TV) 방송국 URL 또는 BJ 아이디를 입력하세요.'
    },
    cime: {
        placeholder: '예: https://ci.me/@채널명',
        hint: '씨미(ci.me) 채널 URL 또는 @채널명을 입력하세요.'
    },
    twitter: {
        placeholder: '예: https://x.com/계정명  또는  아이디 (@ 제외)',
        hint: 'X (Twitter) 프로필 URL 또는 @를 제외한 영문 계정명을 입력하세요.'
    },
    instagram: {
        placeholder: '예: https://instagram.com/계정명',
        hint: 'Instagram 프로필 URL 또는 계정명을 입력하세요.'
    },
    spotify: {
        placeholder: '예: https://open.spotify.com/artist/아티스트ID',
        hint: '스포티파이 아티스트 URL 또는 아티스트 ID를 입력하세요.'
    },
    naver_cafe: {
        placeholder: '예: https://cafe.naver.com/카페명',
        hint: '네이버 카페 주소(카페 고유명)를 입력하세요.'
    },
};

function detectPlatformFromUrl(url) {
    if (!url) return null;
    const lower = url.toLowerCase().trim();
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
    if (lower.includes('chzzk.naver.com')) return 'chzzk';
    if (lower.includes('sooplive.com') || lower.includes('afreecatv.com')) return 'soop';
    if (lower.includes('ci.me')) return 'cime';
    if (lower.includes('twitter.com') || lower.includes('x.com')) return 'twitter';
    if (lower.includes('instagram.com')) return 'instagram';
    if (lower.includes('spotify.com')) return 'spotify';
    if (lower.includes('cafe.naver.com')) return 'naver_cafe';
    return null;
}

function updateWysiwygPreview() {
    const platform = $('modal-platform')?.value || 'chzzk';
    const targetUrl = $('modal-target')?.value || '';
    const roleId = $('modal-role')?.value || '';
    const customMsg = $('modal-custom-msg')?.value || '';
    const pMeta = PLATFORMS[platform] || { name: platform, color: '#6366f1', icon: '' };

    // Accent color on container
    const v2Container = $('prev-v2-container');
    if (v2Container) {
        v2Container.style.borderLeftColor = pMeta.color || '#6366f1';
    }

    // Platform sub & icon
    const platSub = $('prev-platform-sub');
    if (platSub) {
        platSub.textContent = `-# 오늘 오후 5:00 · ${pMeta.name}`;
    }

    // Avatar image
    const prevAvatarImg = $('prev-avatar-img');
    if (prevAvatarImg) prevAvatarImg.src = pMeta.icon;
    const prevAuthorImg = $('prev-author-img');
    if (prevAuthorImg) prevAuthorImg.src = pMeta.icon;

    // Creator / Author name
    const authorNameEl = $('prev-author-name');
    let creatorName = pMeta.name;
    if (targetUrl) {
        const parts = targetUrl.split('/').filter(Boolean);
        const lastPart = parts.pop();
        if (lastPart) {
            creatorName = lastPart.replace(/^@/, '');
        }
    }
    if (authorNameEl) authorNameEl.textContent = creatorName;

    // Mention Row
    const mentionRow = $('prev-mention-row');
    const roleTag = $('prev-mention-role');
    const customMsgEl = $('prev-mention-custom-msg');
    const roleObj = state.roles.find(r => r.id === roleId);

    if (roleObj || customMsg) {
        if (mentionRow) mentionRow.style.display = 'block';
        if (roleTag) {
            roleTag.textContent = roleObj ? `@${roleObj.name}` : '';
            roleTag.style.display = roleObj ? 'inline-block' : 'none';
        }
        if (customMsgEl) customMsgEl.textContent = customMsg;
    } else {
        if (mentionRow) mentionRow.style.display = 'none';
    }

    // Action Buttons Row (Feature 3)
    const btnRow = $('prev-buttons-row');
    if (btnRow) {
        let buttonsHtml = `
            <a class="discord-link-btn" href="#" onclick="return false;">
                <i class="fas fa-external-link-alt" style="font-size:11px;"></i> 원문 보기
            </a>
        `;
        document.querySelectorAll('.custom-btn-row').forEach(row => {
            const labelInput = row.querySelector('.custom-btn-label');
            if (labelInput && labelInput.value.trim()) {
                buttonsHtml += `
                    <a class="discord-link-btn" href="#" onclick="return false;" style="background:#5865f2;">
                        <i class="fas fa-link" style="font-size:11px;"></i> ${escapeHtml(labelInput.value.trim())}
                    </a>
                `;
            }
        });
        btnRow.innerHTML = buttonsHtml;
    }

    // Footer timestamp
    const footerEl = $('prev-footer-text');
    if (footerEl) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        footerEl.textContent = `${pMeta.name} | ${y}.${m}.${d} ${hh}:${mm}:${ss}`;
    }
}

function addCustomActionBtnRow(label = '', url = '') {
    const list = $('custom-buttons-list');
    if (!list) return;
    const currentCount = list.querySelectorAll('.custom-btn-row').length;
    if (currentCount >= 5) {
        showToast('사용자 정의 액션 버튼은 최대 5개까지 추가할 수 있습니다.');
        return;
    }
    const row = document.createElement('div');
    row.className = 'custom-btn-row';
    row.innerHTML = `
        <input type="text" class="custom-btn-label" placeholder="버튼 라벨 (예: 팬카페)" value="${escapeHtml(label)}">
        <input type="url" class="custom-btn-url" placeholder="https://..." value="${escapeHtml(url)}">
        <button type="button" class="btn-remove-custom-action" aria-label="버튼 삭제">
            <i class="fas fa-times"></i>
        </button>
    `;
    row.querySelectorAll('input').forEach(inp => inp.addEventListener('input', updateWysiwygPreview));
    row.querySelector('.btn-remove-custom-action').addEventListener('click', () => {
        row.remove();
        updateWysiwygPreview();
    });
    list.appendChild(row);
    updateWysiwygPreview();
}

function updateModalForPlatform(platform, selectedKinds = null) {
    const box = $('events-box');
    const targetEl = $('modal-target');
    const hintEl = $('modal-target-hint');

    const kinds = PLATFORM_EVENT_KINDS[platform] || PLATFORM_EVENT_KINDS.chzzk;
    if (box) {
        box.innerHTML = kinds.map(k => {
            const defaultChecked = selectedKinds ? selectedKinds.includes(k.value) : true;
            return `<label><input type="checkbox" id="${k.id}" value="${k.value}" ${defaultChecked ? 'checked' : ''}> ${escapeHtml(k.label)}</label>`;
        }).join('');
    }

    const hintInfo = PLATFORM_URL_HINTS[platform] || { placeholder: 'URL 또는 ID 입력', hint: '추적할 URL을 입력하세요.' };
    if (targetEl) targetEl.placeholder = hintInfo.placeholder;
    if (hintEl) hintEl.textContent = hintInfo.hint;
    updateWysiwygPreview();
}

async function openConfigModal(slotNum = null, platform = null) {
    state.editingSlot = (slotNum !== null && platform) ? { slot: slotNum, platform } : null;
    const dialog = $('config-dialog');
    const titleEl = $('modal-dialog-title');
    const deleteBtn = $('btn-delete-slot');
    const errorEl = $('modal-form-error');
    errorEl.style.display = 'none';

    // Reset custom buttons list
    const btnList = $('custom-buttons-list');
    if (btnList) btnList.innerHTML = '';

    // If channels or roles are empty, fetch live
    if (state.selectedGuild && (!state.channels || state.channels.length === 0)) {
        try {
            const [ch, ro] = await Promise.all([
                apiFetch(`/api/channels?guild_id=${state.selectedGuild}`).catch(() => ({ channels: [] })),
                apiFetch(`/api/roles?guild_id=${state.selectedGuild}`).catch(() => ({ roles: [] }))
            ]);
            if (ch && ch.channels) state.channels = ch.channels;
            if (ro && ro.roles) state.roles = ro.roles;
        } catch {}
    }

    // Populate channels dropdown
    const chSel = $('modal-channel');
    if (state.channels && state.channels.length > 0) {
        chSel.innerHTML = '<option value="">채널을 선택하세요</option>';
        state.channels.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = `# ${c.name}`;
            chSel.appendChild(opt);
        });
    } else {
        chSel.innerHTML = '<option value="">텍스트 채널이 감지되지 않았습니다 (봇 초대 권한 확인)</option>';
    }

    // Populate roles dropdown
    const roleSel = $('modal-role');
    roleSel.innerHTML = '<option value="">멘션하지 않음</option>';
    if (state.roles) {
        state.roles.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.id;
            opt.textContent = `@ ${r.name}`;
            roleSel.appendChild(opt);
        });
    }

    if (slotNum !== null && platform) {
        // Editing existing slot
        const item = state.settings.find(s => s.slot === slotNum && s.platform === platform);
        const displayName = item?.target_name || PLATFORMS[platform]?.name || platform;
        titleEl.textContent = `[${displayName}] 알림 설정 (${PLATFORMS[platform]?.name || platform} 슬롯 #${slotNum})`;
        deleteBtn.style.display = 'inline-flex';

        if (item) {
            const p = item.platform || platform || 'chzzk';
            $('modal-platform').value = p;
            $('modal-platform').disabled = true;
            $('modal-target').value = item.target_url || '';
            chSel.value = item.channel_id || '';
            roleSel.value = item.role_id || '';
            $('modal-custom-msg').value = item.custom_message || '';
            $('modal-enabled').checked = !!item.enabled;
            if ($('modal-exclude-membership')) $('modal-exclude-membership').checked = !!item.exclude_membership;
            if ($('modal-drops-active')) $('modal-drops-active').checked = item.drops_active !== false;

            // Load custom action buttons if present
            if (item.buttons && Array.isArray(item.buttons)) {
                item.buttons.forEach(b => addCustomActionBtnRow(b.label, b.url));
            }

            updateModalForPlatform(p, item.kinds || null);
        }
    } else {
        // Adding new slot
        const defaultPlatform = platform || $('modal-platform').value || 'chzzk';
        const nextSlot = getNextAvailableSlot(defaultPlatform);
        titleEl.textContent = `새 ${PLATFORMS[defaultPlatform]?.name || defaultPlatform} 알림 등록 (슬롯 #${nextSlot} / ${MAX_SLOTS})`;
        deleteBtn.style.display = 'none';
        $('modal-platform').disabled = false;

        const pCount = state.settings.filter(s => s.platform === defaultPlatform).length;
        if (pCount >= MAX_SLOTS) {
            showToast(`${PLATFORMS[defaultPlatform]?.name || defaultPlatform} 플랫폼은 최대 ${MAX_SLOTS}개까지 등록 가능합니다.`);
            return;
        }

        $('modal-platform').value = defaultPlatform;
        $('modal-target').value = '';
        chSel.value = state.channels.length > 0 ? state.channels[0].id : '';
        roleSel.value = '';
        $('modal-custom-msg').value = '';
        $('modal-enabled').checked = true;
        updateModalForPlatform(defaultPlatform, null);
    }

    updateWysiwygPreview();
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
    const excludeMembership = $('modal-exclude-membership')?.checked || false;
    const dropsActive = $('modal-drops-active')?.checked || false;

    // Collect custom action buttons
    const customButtons = [];
    document.querySelectorAll('.custom-btn-row').forEach(row => {
        const label = row.querySelector('.custom-btn-label')?.value.trim();
        const url = row.querySelector('.custom-btn-url')?.value.trim();
        if (label && url) {
            customButtons.push({ label, url });
        }
    });

    const kinds = [];
    $('events-box')?.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
        kinds.push(cb.value);
    });
    if (kinds.length === 0) {
        if ($('ev-live-start')?.checked) kinds.push('live_start');
        if ($('ev-live-end')?.checked) kinds.push('live_end');
        if ($('ev-live-scheduled')?.checked) kinds.push('live_scheduled');
    }

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

    // 플랫폼별 최대 30개 슬롯 제한 검증
    if (!state.editingSlot) {
        const platformCount = state.settings.filter(s => s.platform === platform).length;
        if (platformCount >= MAX_SLOTS) {
            errorEl.textContent = `${PLATFORMS[platform]?.name || platform} 플랫폼은 최대 ${MAX_SLOTS}개까지 등록할 수 있습니다.`;
            errorEl.style.display = 'block';
            return;
        }
    }

    const chObj = state.channels.find(c => c.id === channelId);
    const roleObj = state.roles.find(r => r.id === roleId);

    const slotNumber = state.editingSlot 
        ? state.editingSlot.slot 
        : getNextAvailableSlot(platform);

    const newSetting = {
        slot: slotNumber,
        platform,
        target_url: targetUrl,
        channel_id: channelId,
        channel_name: chObj ? chObj.name : '알림-채널',
        role_id: roleId,
        role_name: roleObj ? roleObj.name : null,
        enabled,
        kinds,
        custom_message: customMessage,
        buttons: customButtons,
        exclude_membership: excludeMembership,
        drops_active: dropsActive,
    };

    if (state.demo) {
        const existingIdx = state.settings.findIndex(s => s.slot === slotNumber && s.platform === platform);
        if (existingIdx >= 0) {
            state.settings[existingIdx] = { ...state.settings[existingIdx], ...newSetting };
        } else {
            state.settings.push(newSetting);
        }
        localStorage.setItem('damoa_demo_settings', JSON.stringify(state.settings));
        showToast(`${PLATFORMS[platform]?.name || platform} 슬롯 #${slotNumber} 설정이 저장되었습니다.`);
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
        showToast(`${PLATFORMS[platform]?.name || platform} 슬롯 #${slotNumber} 설정이 저장되었습니다!`);
        $('config-dialog').close();
        await onGuildChange(state.selectedGuild);
    } catch (err) {
        errorEl.textContent = `저장 실패: ${err.message}`;
        errorEl.style.display = 'block';
    }
}

async function handleDeleteSlot() {
    if (!state.editingSlot) return;
    const { slot: slotNum, platform } = state.editingSlot;

    const item = state.settings.find(s => s.slot === slotNum && s.platform === platform);
    const displayName = item?.target_name || `${PLATFORMS[platform]?.name || platform} 슬롯 #${slotNum}`;

    if (!confirm(`[${displayName}] 알림 설정을 삭제하시겠습니까?`)) return;

    if (state.demo) {
        state.settings = state.settings.filter(s => !(s.slot === slotNum && s.platform === platform));
        localStorage.setItem('damoa_demo_settings', JSON.stringify(state.settings));
        showToast(`알림이 삭제되었습니다.`);
        $('config-dialog').close();
        renderSourceList();
        renderStats();
        return;
    }

    try {
        await apiFetch(`/api/settings?guild_id=${state.selectedGuild}&platform=${platform}&slot=${slotNum}`, {
            method: 'DELETE'
        });
        showToast(`[${displayName}] 알림이 정상적으로 삭제되었습니다.`);
        $('config-dialog').close();
        await onGuildChange(state.selectedGuild);
    } catch (err) {
        showToast(`삭제 실패: ${err.message}`);
    }
}

function getNextAvailableSlot(platform) {
    const used = new Set(state.settings.filter(s => s.platform === platform).map(s => s.slot));
    for (let i = 1; i <= MAX_SLOTS; i++) {
        if (!used.has(i)) return i;
    }
    return 1;
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

    // Refresh guild buttons
    const handleRefresh = async () => {
        try {
            if (state.token) {
                const guildsRes = await fetch('https://discord.com/api/v10/users/@me/guilds', {
                    headers: { Authorization: `Bearer ${state.token}` }
                }).catch(() => null);
                if (guildsRes && guildsRes.ok) {
                    const allGuilds = await guildsRes.json();
                    state.guilds = allGuilds.filter(g => {
                        const p = BigInt(g.permissions || '0');
                        return g.owner || (p & 0x8n) === 0x8n || (p & 0x20n) === 0x20n;
                    });
                }
            }
            let bg = await apiFetch('/api/bot/guilds').catch(() => null);
            if (!bg || !bg.guild_ids) {
                bg = await apiFetch('/api/bot_guilds').catch(() => null);
            }
            if (bg && bg.guild_ids) {
                bg.guild_ids.forEach(id => state.botGuilds.add(String(id)));
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
    $('btn-refresh-guilds')?.addEventListener('click', handleRefresh);

    // Test notify modal
    $('btn-test-notify')?.addEventListener('click', () => {
        if (!state.token && !state.demo) {
            showToast('로그인 후 사용할 수 있습니다.');
            return;
        }
        $('test-notify-dialog')?.showModal();
    });
    $('btn-close-test-dialog')?.addEventListener('click', () => $('test-notify-dialog')?.close());
    $('btn-cancel-test-dialog')?.addEventListener('click', () => $('test-notify-dialog')?.close());
    $('btn-send-test-notify')?.addEventListener('click', async () => {
        const platform = $('test-platform')?.value;
        const errEl = $('test-notify-error');
        if (errEl) errEl.style.display = 'none';

        if (state.demo) {
            showToast(`${platform} 테스트 알림은 체험 모드에서 지원하지 않습니다. 실제 서버에 봇을 초대하고 시도해주세요.`);
            $('test-notify-dialog')?.close();
            return;
        }

        try {
            const result = await apiFetch('/api/test_notify', {
                method: 'POST',
                body: JSON.stringify({ guild_id: state.selectedGuild, platform })
            });
            showToast(result.message || '테스트 알림을 전송했습니다!');
            $('test-notify-dialog')?.close();
        } catch (err) {
            if (errEl) {
                errEl.textContent = `전송 실패: ${err.message}`;
                errEl.style.display = 'block';
            }
        }
    });

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

    // Intelligent Platform URL Auto-Detection & WYSIWYG Live Update (Features 1 & 150)
    $('modal-target')?.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (!state.editingSlot) {
            const detected = detectPlatformFromUrl(val);
            if (detected && detected !== $('modal-platform').value) {
                $('modal-platform').value = detected;
                updateModalForPlatform(detected);
                showToast(`💡 ${PLATFORMS[detected]?.name || detected} 플랫폼이 자동 감지되었습니다.`);
            }
        }
        updateWysiwygPreview();
    });

    $('modal-platform')?.addEventListener('change', (e) => {
        updateModalForPlatform(e.target.value);
        updateWysiwygPreview();
    });

    $('modal-role')?.addEventListener('change', updateWysiwygPreview);
    $('modal-custom-msg')?.addEventListener('input', updateWysiwygPreview);

    // Custom action link button addition (Feature 3)
    $('btn-add-action-link')?.addEventListener('click', () => {
        addCustomActionBtnRow();
    });

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
