// ============================================================
// DaMoA Dashboard — script.js v2.0
// ============================================================

const API = '';           // same origin
const MAX_SLOTS = 30;

// ── State ──────────────────────────────────────────────────
const state = {
    token: null,
    user: null,
    demo: false,
    guilds: [],
    botGuilds: [],
    selectedGuild: null,
    settings: [],
    channels: [],
    roles: [],
    platforms: [],
    filter: 'all',
    searchQ: '',
    // Modal
    modalSlot: null,
};

// ── Platform icon/color lookup ──────────────────────────────
const PLATFORM_COLORS = {
    youtube:    '#FF0000',
    chzzk:      '#00FFA3',
    soop:       '#0C8CE9',
    cime:       '#7B4EFF',
    twitter:    '#000000',
    instagram:  '#E1306C',
    spotify:    '#1DB954',
    naver_cafe: '#03C75A',
};
const PLATFORM_ICONS_CLASS = {
    youtube:    'fab fa-youtube',
    chzzk:      'fas fa-broadcast-tower',
    soop:       'fas fa-broadcast-tower',
    cime:       'fas fa-microphone',
    twitter:    'fab fa-x-twitter',
    instagram:  'fab fa-instagram',
    spotify:    'fab fa-spotify',
    naver_cafe: 'fas fa-coffee',
};
const PLATFORM_NAMES = {
    youtube: 'YouTube', chzzk: '치지직', soop: 'SOOP',
    cime: '씨미', twitter: 'X (Twitter)', instagram: 'Instagram',
    spotify: 'Spotify', naver_cafe: '네이버 카페',
};

// ── Helpers ─────────────────────────────────────────────────
function apiFetch(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
    if (state.demo)  headers['X-Demo'] = '1';
    return fetch(API + path, { ...opts, headers }).then(r => r.json());
}

function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show' + (type ? ' ' + type : '');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.className = 'toast'; }, 3000);
}

function platformIcon(pid, size = 20) {
    const cls = PLATFORM_ICONS_CLASS[pid] || 'fas fa-bell';
    const col = PLATFORM_COLORS[pid] || '#888';
    return `<span class="modal-platform-icon" style="background:${col};width:${size}px;height:${size}px;border-radius:${size > 24 ? '10' : '6'}px;display:inline-flex;align-items:center;justify-content:center;font-size:${Math.floor(size*.55)}px;"><i class="${cls}" style="color:#fff;"></i></span>`;
}

// ── Auth ────────────────────────────────────────────────────
function loginWithDiscord() {
    const params = new URLSearchParams({
        client_id: '1547952661196701777',
        redirect_uri: window.location.origin + '/auth/callback',
        response_type: 'code',
        scope: 'identify guilds',
    });
    window.location.href = `https://discord.com/oauth2/authorize?${params}`;
}

function logout() {
    state.token = null;
    state.user = null;
    state.demo = false;
    localStorage.removeItem('damoa_token');
    showSection('settings');
    updateAuthUI();
    showLoginWall();
}

function enterDemo() {
    state.demo = true;
    showSection('settings');
    document.getElementById('demo-banner').style.display = 'flex';
    document.getElementById('login-wall').style.display = 'none';
    document.getElementById('settings-main').style.display = 'block';
    loadDemoGuilds();
}

function resetDemo() {
    state.settings = [];
    renderNotiList();
}

function updateAuthUI() {
    const loggedIn = !!(state.token || state.demo);
    document.getElementById('btn-login').style.display = loggedIn ? 'none' : '';
    document.getElementById('user-info').style.display = loggedIn ? 'flex' : 'none';
    if (state.user) {
        document.getElementById('user-name').textContent = state.user.username || state.user.global_name || '-';
        const av = state.user.avatar
            ? `https://cdn.discordapp.com/avatars/${state.user.id}/${state.user.avatar}.png?size=64`
            : `https://cdn.discordapp.com/embed/avatars/0.png`;
        document.getElementById('user-avatar').src = av;
    } else if (state.demo) {
        document.getElementById('user-name').textContent = '체험 사용자';
        document.getElementById('user-avatar').src = 'https://cdn.discordapp.com/embed/avatars/5.png';
    }
}

// ── Navigation ───────────────────────────────────────────────
function showSection(id) {
    document.querySelectorAll('.page-section').forEach(s => {
        s.style.display = 'none';
        s.classList.remove('active');
    });
    const el = document.getElementById('section-' + id);
    if (el) { el.style.display = 'block'; el.classList.add('active'); }

    document.querySelectorAll('.nav-item').forEach(a => a.classList.remove('active'));
    const nav = document.getElementById('nav-' + id);
    if (nav) nav.classList.add('active');

    const labels = { home: '대시보드', settings: '알림 설정', status: '현황판', guide: '가이드' };
    document.getElementById('topbar-page').textContent = labels[id] || id;

    if (id === 'home') loadHomePlatforms();
    if (id === 'status') loadStatus();
}

document.querySelectorAll('.nav-item[data-section]').forEach(el => {
    el.addEventListener('click', e => {
        e.preventDefault();
        showSection(el.dataset.section);
    });
});

// ── Home ─────────────────────────────────────────────────────
async function loadHomePlatforms() {
    const grid = document.getElementById('home-platform-grid');
    const data = await apiFetch('/api/platforms');
    if (!data.platforms) return;
    state.platforms = data.platforms;
    grid.innerHTML = data.platforms.map(p => {
        const color = PLATFORM_COLORS[p.id] || '#888';
        const icon  = PLATFORM_ICONS_CLASS[p.id] || 'fas fa-bell';
        const kinds = p.kinds || [];
        return `<div class="platform-card" style="border-top:3px solid ${color};">
            <div class="platform-card-icon" style="background:${color};"><i class="${icon}"></i></div>
            <div class="platform-card-name">${p.name}</div>
            <div class="platform-card-kinds">${kinds.length} 알림 종류</div>
        </div>`;
    }).join('');
}

// ── Settings ─────────────────────────────────────────────────
function showLoginWall() {
    document.getElementById('login-wall').style.display = 'flex';
    document.getElementById('settings-main').style.display = 'none';
    document.getElementById('demo-banner').style.display = 'none';
}

async function loadGuilds() {
    // Fetch user guilds + bot guilds in parallel
    const [ugRes, bgRes] = await Promise.all([
        apiFetch('/api/users/@me/guilds'),
        apiFetch('/api/bot/guilds'),
    ]);
    const userGuilds = Array.isArray(ugRes) ? ugRes : (ugRes.guilds || []);
    const botGuildIds = new Set((bgRes.guild_ids || []));
    state.botGuilds = botGuildIds;

    // Filter: admin permission guilds where bot is also present
    state.guilds = userGuilds.filter(g => {
        const perm = BigInt(g.permissions || 0);
        const isAdmin = (perm & BigInt(0x8)) === BigInt(0x8);
        return isAdmin && botGuildIds.has(g.id);
    });

    // Demo mode: include demo guilds even if no real bot guilds
    if (state.demo && state.guilds.length === 0) {
        state.guilds = [{ id: '100000000000000001', name: '데모 서버 1', icon: null }];
    }

    renderGuildSelect();
}

function loadDemoGuilds() {
    state.guilds = [{ id: '100000000000000001', name: '데모 서버 1', icon: null }];
    renderGuildSelect();
    // Auto-select first
    const sel = document.getElementById('server-select');
    if (sel.options.length > 1) {
        sel.value = state.guilds[0].id;
        onServerChange();
    }
}

function renderGuildSelect() {
    const sel = document.getElementById('server-select');
    sel.innerHTML = '<option value="">서버 선택...</option>';
    state.guilds.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = g.name;
        sel.appendChild(opt);
    });

    if (state.guilds.length === 1) {
        sel.value = state.guilds[0].id;
        onServerChange();
    }
}

async function onServerChange() {
    const sel = document.getElementById('server-select');
    const gid = sel.value;
    if (!gid) { state.selectedGuild = null; state.settings = []; renderNotiList(); return; }
    state.selectedGuild = gid;

    // Load channels, roles, settings in parallel
    const [chRes, roleRes, setRes] = await Promise.all([
        apiFetch(`/api/channels?guild_id=${gid}`),
        apiFetch(`/api/roles?guild_id=${gid}`),
        apiFetch(`/api/settings?guild_id=${gid}`),
    ]);
    state.channels = chRes.channels || [];
    state.roles    = roleRes.roles   || [];
    state.settings = setRes.settings || [];

    renderNotiList();
}

async function refreshSettings() {
    if (!state.selectedGuild) return;
    await onServerChange();
    showToast('새로고침 완료', 'success');
}

// ── Notification List ─────────────────────────────────────────
function setFilter(btn, f) {
    state.filter = f;
    document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderNotiList();
}

function filterNotis() {
    state.searchQ = document.getElementById('noti-search').value.toLowerCase();
    renderNotiList();
}

function renderNotiList() {
    const list = document.getElementById('noti-list');
    let items = [...state.settings];

    // Filter
    if (state.filter === 'on')   items = items.filter(s => s.enabled);
    if (state.filter === 'need') items = items.filter(s => !s.channel_id);

    // Search
    if (state.searchQ) {
        items = items.filter(s =>
            (PLATFORM_NAMES[s.platform] || s.platform).toLowerCase().includes(state.searchQ) ||
            (s.target_url || '').toLowerCase().includes(state.searchQ) ||
            (s.channel_name || '').toLowerCase().includes(state.searchQ)
        );
    }

    document.getElementById('noti-count').textContent = state.settings.length + ' SOURCES';

    if (items.length === 0) {
        list.innerHTML = `<div class="noti-placeholder"><i class="fas fa-bell-slash"></i><p>${state.settings.length === 0 ? '등록된 알림이 없습니다' : '검색 결과 없음'}</p></div>`;
        return;
    }

    list.innerHTML = items.map(s => renderNotiRow(s)).join('');
}

function renderNotiRow(s) {
    const color  = PLATFORM_COLORS[s.platform] || '#888';
    const icon   = PLATFORM_ICONS_CLASS[s.platform] || 'fas fa-bell';
    const name   = PLATFORM_NAMES[s.platform] || s.platform;
    const target = s.target_url ? new URL(s.target_url).pathname.replace('/', '@') : '';
    const channel = s.channel_name || (s.channel_id ? '#' + s.channel_id : '미설정');
    const hasChannel = !!s.channel_id;
    const enabled = s.enabled;
    const statusText = hasChannel ? '정상 (예시)' : '채널 설정 필요';
    const statusCls  = hasChannel ? '' : 'warn';
    const now = new Date().toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true });

    return `<div class="noti-row${enabled ? '' : ' disabled'}" data-platform="${s.platform}" data-slot="${s.slot || 1}">
        <div class="noti-thumb" style="background:${color};">
            <i class="${icon}" style="color:#fff;font-size:20px;"></i>
        </div>
        <div class="noti-info">
            <div class="noti-name">${name}${s.slot > 1 ? ' #' + s.slot : ''}${target ? ' · <span style="font-weight:400;color:#6b7299;">' + target + '</span>' : ''}</div>
            <div class="noti-sub">${s.kinds_labels && s.kinds_labels.length ? s.kinds_labels.join(' · ') : '알림 종류 미설정'}</div>
        </div>
        <div class="noti-meta">
            <div class="noti-channel">${channel}</div>
            <div class="noti-status ${statusCls}">${statusText}</div>
            <div class="noti-time">체험 데이터 · ${now}</div>
        </div>
        <div class="noti-actions">
            <button class="btn-toggle ${enabled ? 'on' : 'off'}" onclick="toggleEnabled('${s.platform}', ${s.slot || 1})">${enabled ? '켜짐' : '꺼짐'}</button>
            <button class="btn-settings" onclick="openModal('${s.platform}', ${s.slot || 1})"><i class="fas fa-cog"></i> 설정</button>
        </div>
    </div>`;
}

async function toggleEnabled(platform, slot) {
    const idx = state.settings.findIndex(s => s.platform === platform && (s.slot || 1) == slot);
    if (idx < 0) return;
    state.settings[idx].enabled = !state.settings[idx].enabled;
    renderNotiList();
    if (!state.demo && state.selectedGuild) {
        await apiFetch('/api/settings', {
            method: 'POST',
            body: JSON.stringify({ guild_id: state.selectedGuild, platform, slot, enabled: state.settings[idx].enabled }),
        });
    }
}

// ── Modal ─────────────────────────────────────────────────────
async function openModal(platform, slot) {
    const s = state.settings.find(x => x.platform === platform && (x.slot || 1) == slot);
    if (!s) return;
    state.modalSlot = { platform, slot, original: s };

    // Fill modal header
    const color = PLATFORM_COLORS[platform] || '#888';
    const icon  = PLATFORM_ICONS_CLASS[platform] || 'fas fa-bell';
    const name  = PLATFORM_NAMES[platform] || platform;
    document.getElementById('modal-title').textContent = `${name} 설정`;
    const iconWrap = document.getElementById('modal-icon-wrap');
    iconWrap.style.cssText = `background:${color};width:28px;height:28px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-size:14px;`;
    iconWrap.innerHTML = `<i class="${icon}" style="color:#fff;"></i>`;

    // Target info
    document.getElementById('modal-target-info').textContent = s.target_url || '대상 URL 없음';
    document.getElementById('modal-target-info').style.display = s.target_url ? 'block' : 'none';

    // Fill channel select
    const chSel = document.getElementById('modal-channel');
    chSel.innerHTML = '<option value="">채널 선택...</option>';
    state.channels.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = '# ' + c.name;
        if (c.id == s.channel_id) opt.selected = true;
        chSel.appendChild(opt);
    });

    // Fill role select
    const roleSel = document.getElementById('modal-role');
    roleSel.innerHTML = '<option value="">멘션하지 않음</option>';
    state.roles.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = '@' + r.name;
        if (r.id == s.role_id) opt.selected = true;
        roleSel.appendChild(opt);
    });

    // Kinds
    const platformData = state.platforms.find(p => p.id === platform);
    const kindsField = document.getElementById('modal-kinds-field');
    const kindsGrid  = document.getElementById('modal-kinds');
    if (platformData && platformData.kinds && platformData.kinds.length > 0) {
        kindsField.style.display = 'flex';
        const selectedKinds = new Set(s.kinds || []);
        kindsGrid.innerHTML = platformData.kinds.map(k => {
            const label = (platformData.kind_labels || {})[k] || k;
            const sel   = selectedKinds.has(k);
            return `<label class="kind-chip ${sel ? 'selected' : ''}" data-kind="${k}">
                <input type="checkbox" ${sel ? 'checked' : ''} onchange="toggleKindChip(this)">
                ${label}
            </label>`;
        }).join('');
    } else {
        kindsField.style.display = 'none';
    }

    // Enabled
    document.getElementById('modal-enabled').checked = !!s.enabled;

    // Open
    document.getElementById('modal-overlay').classList.add('open');
}

function toggleKindChip(el) {
    el.closest('.kind-chip').classList.toggle('selected', el.checked);
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
    state.modalSlot = null;
}

async function saveModal() {
    if (!state.modalSlot) return;
    const { platform, slot } = state.modalSlot;

    const channelId = document.getElementById('modal-channel').value;
    const roleId    = document.getElementById('modal-role').value;
    const enabled   = document.getElementById('modal-enabled').checked;
    const kinds     = [...document.querySelectorAll('#modal-kinds .kind-chip.selected')].map(el => el.dataset.kind);

    // Update local state
    const idx = state.settings.findIndex(s => s.platform === platform && (s.slot || 1) == slot);
    if (idx >= 0) {
        const ch = state.channels.find(c => c.id == channelId);
        state.settings[idx] = {
            ...state.settings[idx],
            channel_id: channelId || null,
            channel_name: ch ? ch.name : null,
            role_id: roleId || null,
            enabled,
            kinds,
            kinds_labels: kinds.map(k => {
                const p = state.platforms.find(pl => pl.id === platform);
                return (p && p.kind_labels && p.kind_labels[k]) || k;
            }),
        };
    }

    // Persist if not demo
    if (!state.demo && state.selectedGuild) {
        const btn = document.getElementById('modal-save-btn');
        btn.disabled = true; btn.textContent = '저장 중...';
        try {
            const res = await apiFetch('/api/settings', {
                method: 'POST',
                body: JSON.stringify({
                    guild_id: state.selectedGuild,
                    platform, slot,
                    channel_id: channelId || null,
                    role_id: roleId || null,
                    enabled, kinds,
                }),
            });
            if (res.status !== 'success') throw new Error(res.error || '저장 실패');
            showToast('설정이 저장되었습니다.', 'success');
        } catch (e) {
            showToast(e.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> 설정 저장';
        }
    } else {
        showToast(state.demo ? '체험 모드: 화면에만 반영됩니다' : '설정이 저장되었습니다.', state.demo ? '' : 'success');
    }

    closeModal();
    renderNotiList();
}

// ── Status Board ─────────────────────────────────────────────
async function loadStatus() {
    const [metRes, statRes] = await Promise.all([
        apiFetch('/api/metrics'),
        apiFetch('/api/status'),
    ]);

    const m = (metRes.metrics || {});
    document.getElementById('metric-active').textContent    = m.active_notifications ?? '-';
    document.getElementById('metric-targets').textContent   = m.unique_targets        ?? '-';
    document.getElementById('metric-servers').textContent   = m.total_servers         ?? '-';
    document.getElementById('metric-delivered').textContent = m.delivered_total       ?? '-';

    const grid = document.getElementById('status-grid');
    const platforms = statRes.platforms || [];

    if (platforms.length === 0) {
        grid.innerHTML = '<p style="color:var(--c-text-3);font-size:13px;">데이터를 불러오는 중...</p>';
        return;
    }

    grid.innerHTML = platforms.map(p => {
        const icon = PLATFORM_ICONS_CLASS[p.platform] || 'fas fa-bell';
        return `<div class="status-card">
            <div class="status-card-header">
                <div class="status-card-icon" style="background:${p.color};">
                    <i class="${icon}"></i>
                </div>
                <div class="status-card-name">${p.name}</div>
            </div>
            <div class="status-stat"><span>참여 서버</span><span class="status-stat-val">${p.total_guilds}</span></div>
            <div class="status-stat"><span>활성 슬롯</span><span class="status-stat-val">${p.active_slots}</span></div>
            <div class="status-stat"><span>추적 대상</span><span class="status-stat-val">${p.unique_targets}</span></div>
        </div>`;
    }).join('');
}

// ── Boot ─────────────────────────────────────────────────────
async function init() {
    // Check hash for access_token from OAuth redirect
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get('access_token')) {
        state.token = hash.get('access_token');
        localStorage.setItem('damoa_token', state.token);
        history.replaceState(null, '', '/');
    }

    // Restore saved token
    if (!state.token) state.token = localStorage.getItem('damoa_token');

    // Load platforms (always)
    apiFetch('/api/platforms').then(r => { if (r.platforms) state.platforms = r.platforms; });

    if (state.token) {
        try {
            const user = await apiFetch('/api/users/@me');
            if (user.id) {
                state.user = user;
                updateAuthUI();
                document.getElementById('login-wall').style.display = 'none';
                document.getElementById('settings-main').style.display = 'block';
                await loadGuilds();
            } else {
                state.token = null;
                localStorage.removeItem('damoa_token');
                showLoginWall();
            }
        } catch {
            state.token = null;
            showLoginWall();
        }
    } else {
        showLoginWall();
    }

    // Show default section
    showSection('settings');
}

window.addEventListener('DOMContentLoaded', init);
