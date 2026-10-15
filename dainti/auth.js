/* ===== 登录 / 权限 / 用户管理 / 操作日志 =====
   与后端 scripts/serve.py + auth.py 配套。纯静态打开(file://)时自动进入"本地模式",
   不做鉴权,编辑只存浏览器本地。
*/
(function () {
  'use strict';
  // mode: server(后端鉴权) | local(浏览器内 PBKDF2 校验) | open(无账号文件,不校验)
  const AUTH = window.AUTH = {
    ready: false, mode: 'open', local: false, user: null, roles: {},
    publicView: false, localUsers: [],
    can(need) {
      const R = { viewer: 1, editor: 2, admin: 3 };
      if (this.mode === 'open') return true;             // 没有账号文件:不校验
      return (R[(this.user || {}).role] || 0) >= (R[need] || 99);
    },
    async logout() {
      if (this.mode === 'server') {
        try { await fetch('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); } catch (e) {}
        location.href = '/';
      } else {
        localStorage.removeItem(LS_SESS);
        location.reload();
      }
    },
  };

  /* ---------------- 本地模式:浏览器内 PBKDF2 校验 ---------------- */
  const LS_SESS = 'dsh_local_session';
  const LS_EXTRA = 'dsh_local_users_extra';      // 管理员在页面里新增的账号
  const PBKDF2_ITER = 200000;
  const ROLE_NAME = { viewer: '只读', editor: '编辑', admin: '管理员' };

  function hex2bytes(h) {
    const a = new Uint8Array(h.length / 2);
    for (let i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16);
    return a;
  }
  function bytes2hex(b) {
    return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
  }
  async function pbkdf2hex(pw, saltHex, iter) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: hex2bytes(saltHex), iterations: iter || PBKDF2_ITER, hash: 'SHA-256' },
      key, 256);
    return bytes2hex(bits);
  }
  function ctEqual(a, b) {            // 定长比较,避免明显的时序差异
    if (a.length !== b.length) return false;
    let d = 0;
    for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
  }
  function extraUsers() {
    try { return JSON.parse(localStorage.getItem(LS_EXTRA) || '{}'); } catch (e) { return {}; }
  }
  function allLocalUsers() {
    const base = (window.__LOCAL_USERS__ && window.__LOCAL_USERS__.users) || [];
    const ex = extraUsers();
    const out = base.filter(u => !ex[u.name]).slice();
    Object.values(ex).forEach(u => out.push(u));
    return out.filter(u => !u.disabled);
  }
  function readLocalSession() {
    try {
      const s = JSON.parse(localStorage.getItem(LS_SESS) || 'null');
      if (!s || !s.expires || s.expires < Date.now()) { localStorage.removeItem(LS_SESS); return null; }
      const u = allLocalUsers().find(x => x.name === s.name);
      if (!u) { localStorage.removeItem(LS_SESS); return null; }
      return { user: { name: u.name, display: u.display || u.name, role: u.role,
                       roleName: ROLE_NAME[u.role] || u.role, mustChange: false }, expires: s.expires };
    } catch (e) { return null; }
  }
  function writeLocalSession(u, days) {
    localStorage.setItem(LS_SESS, JSON.stringify(
      { name: u.name, expires: Date.now() + (days || 12 / 24) * 86400000 }));
  }
  async function localLogin(name, pw) {
    const u = allLocalUsers().find(x => x.name === name);
    if (!u) return null;
    const h = await pbkdf2hex(pw, u.salt, u.iter);
    return ctEqual(h, u.hash) ? u : null;
  }
  async function localAddUser(name, pw, role, display) {
    if (!name || name.length > 32) throw new Error('用户名需 1~32 字符');
    if (!pw || pw.length < 8) throw new Error('口令至少 8 位');
    if (allLocalUsers().some(u => u.name === name)) throw new Error('用户名已存在');
    const salt = bytes2hex(crypto.getRandomValues(new Uint8Array(16)));
    const ex = extraUsers();
    ex[name] = { name, display: display || name, role,
                 salt, hash: await pbkdf2hex(pw, salt, PBKDF2_ITER), iter: PBKDF2_ITER };
    localStorage.setItem(LS_EXTRA, JSON.stringify(ex));
  }
  function localRemoveUser(name) {
    const ex = extraUsers();
    if (ex[name]) { delete ex[name]; localStorage.setItem(LS_EXTRA, JSON.stringify(ex)); return true; }
    return false;   // 来自 local-users.js 的账号不能在页面里删,需要用脚本
  }

  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  /* ---------------- 登录遮罩 ---------------- */
  function showLogin(msg) {
    const ov = el('loginOverlay');
    if (!ov) return;
    ov.classList.add('show');
    const m = el('loginMsg');
    if (m) { m.textContent = msg || ''; m.style.display = msg ? 'block' : 'none'; }
    setTimeout(() => { const u = el('loginUser'); if (u) u.focus(); }, 80);
  }
  function hideLogin() { const ov = el('loginOverlay'); if (ov) ov.classList.remove('show'); }

  async function doLogin(e) {
    if (e) e.preventDefault();
    const btn = el('loginBtn');
    const u = (el('loginUser').value || '').trim();
    const p = el('loginPass').value || '';
    if (!u || !p) { showLogin('请输入用户名和口令'); return; }
    btn.disabled = true; btn.textContent = '登录中…';
    try {
      if (AUTH.mode === 'local') {
        const lu = await localLogin(u, p);
        if (!lu) { showLogin('用户名或口令错误'); }
        else { writeLocalSession(lu); location.reload(); return; }
      } else {
        const r = await fetch('/api/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u, password: p }),
        });
        const d = await r.json();
        if (!d.ok) { showLogin(d.error || '登录失败'); }
        else { location.reload(); return; }             // 拿到 Cookie 后整页重载,重新拉数据
      }
    } catch (err) {
      showLogin('登录失败：' + err.message);
    }
    btn.disabled = false; btn.textContent = '登 录';
  }

  /* ---------------- 右上角用户区 ---------------- */
  function renderUserChip() {
    const box = el('userChip');
    if (!box) return;
    if (AUTH.mode === 'open') {
      box.innerHTML = `<span class="uc-local" title="未发现 local-users.js，也未连接服务：不校验权限">本地模式 · 无鉴权</span>`;
      return;
    }
    const u = AUTH.user;
    if (!u) {
      box.innerHTML = `${AUTH.mode === 'local' ? '<span class="uc-local" title="浏览无需登录，编辑需登录">未登录</span>' : ''}
        <button class="mini-btn" id="ucLogin">登录</button>`;
      el('ucLogin').onclick = () => (AUTH.mode === 'local' || AUTH.publicView)
        ? openLoginModal({ need: 'viewer' }) : showLogin('');
      return;
    }
    box.innerHTML = `
      ${AUTH.mode === 'local' ? '<span class="uc-local" title="口令在浏览器内校验，不构成安全边界">离线</span>' : ''}
      <span class="uc-av">${esc(u.display.slice(0, 1))}</span>
      <span class="uc-name">${esc(u.display)}</span>
      <span class="uc-role r-${esc(u.role)}">${esc(u.roleName)}</span>
      <button class="mini-btn" id="ucMenu" title="更多">⋯</button>`;
    el('ucMenu').onclick = (ev) => { ev.stopPropagation(); openUserMenu(); };
  }

  function openUserMenu() {
    closeModal();
    const m = document.createElement('div');
    m.className = 'dropdown';
    m.id = 'userDropdown';
    m.innerHTML = `
      <div class="dd-head">${esc(AUTH.user.display)} <em>${esc(AUTH.user.roleName)}</em></div>
      ${AUTH.user.mustChange ? '<div class="dd-warn">初始口令仍未修改，建议立即修改</div>' : ''}
      <button data-act="pwd">修改我的口令</button>
      ${AUTH.can('admin') ? `<button data-act="users">${AUTH.mode === 'local' ? '本地账号管理' : '用户与权限管理'}</button>` : ''}
      ${AUTH.can('editor') ? '<button data-act="audit">操作日志</button>' : ''}
      <button data-act="logout" class="dd-danger">退出登录</button>`;
    document.body.appendChild(m);
    const r = el('userChip').getBoundingClientRect();
    m.style.top = (r.bottom + 6) + 'px';
    m.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
    m.querySelectorAll('button').forEach(b => b.onclick = () => {
      const a = b.dataset.act;
      closeModal();
      if (a === 'pwd') { if (AUTH.mode === 'local') toast('本地模式的口令在 local-users.js 里,请用脚本重置', true); else openPassword(); }
      else if (a === 'users') openUsers();
      else if (a === 'audit') openAudit();
      else if (a === 'logout') AUTH.logout();
    });
    setTimeout(() => document.addEventListener('click', closeDropdown, { once: true }), 0);
  }
  function closeDropdown() {
    const d = el('userDropdown'); if (d) d.remove();
  }

  /* ---------------- 通用弹窗 ---------------- */
  function modal(title, bodyHtml, footHtml) {
    closeModal();
    const m = document.createElement('div');
    m.className = 'modal-mask'; m.id = 'modalMask';
    m.innerHTML = `<div class="modal">
      <div class="modal-hd"><h3>${title}</h3><button class="icon-btn sm" id="modalX">✕</button></div>
      <div class="modal-bd">${bodyHtml}</div>
      ${footHtml ? `<div class="modal-ft">${footHtml}</div>` : ''}
    </div>`;
    document.body.appendChild(m);
    el('modalX').onclick = closeModal;
    m.addEventListener('click', e => { if (e.target === m) closeModal(); });
    return m;
  }
  function closeModal() {
    const m = el('modalMask'); if (m) m.remove();
    closeDropdown();
  }
  function toast(msg, err) {
    let t = el('authToast');
    if (!t) { t = document.createElement('div'); t.id = 'authToast'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.className = 'toast show' + (err ? ' err' : '');
    clearTimeout(t._h); t._h = setTimeout(() => t.className = 'toast', 2800);
  }
  window.AUTH_TOAST = toast;

  /* ---------------- 修改口令 ---------------- */
  function openPassword() {
    modal('修改我的口令', `
      <div class="frm">
        <label>当前口令</label><input type="password" id="pwCur" autocomplete="current-password">
        <label>新口令</label><input type="password" id="pwNew" autocomplete="new-password" placeholder="至少 8 位">
        <label>确认新口令</label><input type="password" id="pwNew2" autocomplete="new-password">
        <div class="frm-msg" id="pwMsg"></div>
      </div>`, `<button class="mini-btn primary" id="pwOk">保存</button><button class="mini-btn" id="pwCancel">取消</button>`);
    el('pwCancel').onclick = closeModal;
    el('pwOk').onclick = async () => {
      const cur = el('pwCur').value, n1 = el('pwNew').value, n2 = el('pwNew2').value;
      const msg = el('pwMsg');
      if (n1.length < 8) { msg.textContent = '新口令至少 8 位'; return; }
      if (n1 !== n2) { msg.textContent = '两次输入不一致'; return; }
      const r = await fetch('/api/password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current: cur, next: n1 }),
      });
      const d = await r.json();
      if (!d.ok) { msg.textContent = d.error || '修改失败'; return; }
      toast('口令已修改'); closeModal();
      setTimeout(() => location.reload(), 800);
    };
  }

  /* ---------------- 编辑前登录弹窗(不拦截浏览,只拦编辑) ---------------- */
  function openLoginModal(opts) {
    opts = opts || {};
    const need = opts.need || 'editor';
    const who = need === 'admin' ? '管理员' : '编辑';
    modal('需要登录',
      `<div class="frm">
        <p class="lg-tip">${AUTH.mode === 'local'
          ? '查看不需要登录；<b>修改数据</b>需要有' + who + '权限的账号。口令在浏览器内校验。'
          : '查看不需要登录；<b>修改数据</b>需要有' + who + '权限的账号。'}</p>
        <label>用户名</label>
        <input id="mlUser" autocomplete="username" placeholder="请输入用户名">
        <label>口令</label>
        <input id="mlPass" type="password" autocomplete="current-password" placeholder="请输入口令">
        <div class="frm-msg" id="mlMsg"></div>
        <div class="lg-foot2">${AUTH.mode === 'local'
          ? '没有账号？请联系管理员，或用 <code>scripts/make_local_users.py --add 用户名 角色</code> 新建。'
          : '没有账号？请联系管理员。'}</div>
      </div>`,
      `<button class="mini-btn" id="mlCancel">取消</button>
       <button class="mini-btn primary" id="mlOk">登 录</button>`);
    const msg = el('mlMsg');
    const submit = async () => {
      const u = (el('mlUser').value || '').trim(), p = el('mlPass').value || '';
      if (!u || !p) { msg.textContent = '请输入用户名和口令'; return; }
      const btn = el('mlOk'); btn.disabled = true; btn.textContent = '登录中…';
      try {
        if (AUTH.mode === 'local') {
          const lu = await localLogin(u, p);
          if (!lu) { msg.textContent = '用户名或口令错误'; }
          else { applyLogin({ name: lu.name, display: lu.display || lu.name, role: lu.role,
                              roleName: ROLE_NAME[lu.role] || lu.role }, lu); return; }
        } else {
          const r = await fetch('/api/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p }),
          });
          const d = await r.json();
          if (!d.ok) { msg.textContent = d.error || '登录失败'; }
          else { applyLogin(d.user, null); return; }
        }
      } catch (e) { msg.textContent = '登录失败：' + e.message; }
      btn.disabled = false; btn.textContent = '登 录';
    };
    function applyLogin(user, localU) {
      if (localU) writeLocalSession(localU);
      AUTH.user = user;
      renderUserChip(); renderModeBanner();
      closeModal();
      const R = { viewer: 1, editor: 2, admin: 3 };
      if ((R[user.role] || 0) < (R[need] || 99)) {
        toast(`${user.display} 是${user.roleName}，没有${who}权限`, true);
        return;
      }
      toast(`已登录：${user.display}（${user.roleName}）`);
      if (opts.then) opts.then(user);
    }
    el('mlCancel').onclick = closeModal;
    el('mlOk').onclick = submit;
    el('mlPass').onkeydown = ev => { if (ev.key === 'Enter') submit(); };
    el('mlUser').onkeydown = ev => { if (ev.key === 'Enter') el('mlPass').focus(); };
    setTimeout(() => { const n = el('mlUser'); if (n) n.focus(); }, 60);
  }

  /* ---------------- 本地账号管理 ---------------- */
  function openLocalUsers() {
    const base = (window.__LOCAL_USERS__ && window.__LOCAL_USERS__.users) || [];
    const ex = extraUsers();
    const rows = allLocalUsers().map(u => {
      const fromFile = !ex[u.name];
      return `<tr>
        <td><b>${esc(u.display || u.name)}</b><div class="mut sm">${esc(u.name)}</div></td>
        <td>${esc(ROLE_NAME[u.role] || u.role)}</td>
        <td><span class="pill ${fromFile ? 'on' : 'warn'}">${fromFile ? '来自 local-users.js' : '页面内新增'}</span></td>
        <td class="right">${fromFile
          ? '<span class="mut sm">需用脚本删除</span>'
          : `<button class="mini-btn danger" data-act="del" data-name="${esc(u.name)}">删除</button>`}</td>
      </tr>`;
    }).join('');
    modal('本地账号管理', `
      <div class="usr-bar">
        <input id="luName" placeholder="登录名" style="width:110px">
        <input id="luDisplay" placeholder="姓名/备注" style="width:130px">
        <select id="luRole">
          <option value="viewer">只读</option><option value="editor">编辑</option><option value="admin">管理员</option>
        </select>
        <input id="luPass" type="password" placeholder="口令(≥8位)" style="width:150px">
        <button class="mini-btn primary" id="luAdd">新增本地账号</button>
      </div>
      <div class="tbl-wrap"><table class="usr-tbl">
        <thead><tr><th>用户</th><th>角色</th><th>来源</th><th></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" class="mut">暂无账号</td></tr>'}</tbody></table></div>
      <div class="frm-msg" id="luMsg"></div>
      <div class="callout-mini">
        <b>本地模式说明</b>：口令用 PBKDF2-SHA256 哈希校验（与服务端算法一致），但校验过程在浏览器里完成，
        <b>不是安全边界</b>——能接触源码的人可以绕过。这里只用于区分使用人、防止随手翻看。
        需要真正的权限控制，请改用 <code>./serve.sh</code>（服务端鉴权）。
      </div>
      <div class="mut sm" style="margin-top:6px">
        <code>local-users.js</code> 里的账号要在命令行删除：
        <code>python3 scripts/make_local_users.py --remove 用户名</code>；
        页面内新增的账号存在本浏览器 localStorage，换机器不会同步。
      </div>`,
      `<button class="mini-btn" id="luClose">关闭</button>`);
    el('luClose').onclick = closeModal;
    el('luAdd').onclick = async () => {
      const msg = el('luMsg');
      try {
        await localAddUser(el('luName').value.trim(), el('luPass').value,
                           el('luRole').value, el('luDisplay').value.trim());
        toast('已新增本地账号 ' + el('luName').value.trim());
        openLocalUsers();
      } catch (err) { msg.textContent = err.message; }
    };
    el('modalMask').querySelectorAll('button[data-act="del"]').forEach(b => b.onclick = () => {
      if (!confirm(`删除本地账号「${b.dataset.name}」？`)) return;
      localRemoveUser(b.dataset.name);
      toast('已删除'); openLocalUsers();
    });
  }

  /* ---------------- 模式提示条 ---------------- */
  function renderModeBanner() {
    let b = el('modeBanner');
    if (AUTH.mode === 'open') {
      if (!b) {
        b = document.createElement('div');
        b.id = 'modeBanner'; b.className = 'mode-banner open';
        b.innerHTML = '未连接后台服务，也未找到 <code>local-users.js</code>：<b>当前不做权限校验</b>，'
          + '任何人打开都能查看与编辑。需要用登录保护请运行 <code>./serve.sh</code>，'
          + '或执行 <code>python3 scripts/make_local_users.py</code> 生成本地账号。';
        document.body.appendChild(b);
      }
      document.body.classList.add('has-mode-banner');
      return;
    }
    if (AUTH.mode === 'local') {
      if (!b) {
        b = document.createElement('div');
        b.id = 'modeBanner'; b.className = 'mode-banner local';
        b.innerHTML = '<b>本地模式</b>：查看无需登录，点「编辑」时校验口令（浏览器内完成，'
          + '<u>不构成安全边界</u>）；改动保存在本浏览器。需要真正的权限控制请用 <code>./serve.sh</code>。'
          + '<button class="mb-x" title="知道了">✕</button>';
        document.body.appendChild(b);
        document.body.classList.add('has-mode-banner');
        b.querySelector('.mb-x').onclick = () => { b.remove(); document.body.classList.remove('has-mode-banner'); };
      }
    }
  }

  /* ---------------- 用户管理 ---------------- */
  async function openUsers() {
    if (AUTH.mode === 'local') return openLocalUsers();
    const r = await fetch('/api/users', { cache: 'no-store' });
    const d = await r.json();
    if (!d.ok) { toast(d.error || '读取失败', true); return; }
    const roleOpts = (sel) => Object.entries(d.roles)
      .map(([k, v]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${v}</option>`).join('');
    const rows = d.users.map(u => `<tr data-name="${esc(u.name)}">
        <td><b>${esc(u.display)}</b><div class="mut sm">${esc(u.name)}</div></td>
        <td><select class="roleSel" data-name="${esc(u.name)}">${roleOpts(u.role)}</select></td>
        <td class="sm mut">${esc(u.updatedAt || u.createdAt || '')}</td>
        <td><span class="pill ${u.disabled ? 'off' : 'on'}">${u.disabled ? '已停用' : '正常'}</span>
            ${u.mustChange ? '<span class="pill warn">待改密</span>' : ''}</td>
        <td class="right">
          <button class="mini-btn" data-act="reset" data-name="${esc(u.name)}">重置口令</button>
          <button class="mini-btn" data-act="toggle" data-name="${esc(u.name)}" data-disabled="${u.disabled ? 1 : 0}">${u.disabled ? '启用' : '停用'}</button>
          <button class="mini-btn danger" data-act="del" data-name="${esc(u.name)}">删除</button>
        </td></tr>`).join('');
    modal('用户与权限管理', `
      <div class="usr-bar">
        <input id="nuName" placeholder="登录名" style="width:110px">
        <input id="nuDisplay" placeholder="姓名/备注" style="width:120px">
        <select id="nuRole">${roleOpts('viewer')}</select>
        <input id="nuPass" placeholder="初始口令(留空自动生成)" style="width:170px">
        <button class="mini-btn primary" id="nuAdd">新增用户</button>
      </div>
      <div class="tbl-wrap"><table class="usr-tbl">
        <thead><tr><th>用户</th><th>角色</th><th>更新时间</th><th>状态</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      <div class="frm-msg" id="usrMsg"></div>
      <div class="mut sm" style="margin-top:8px">角色权限：只读＝只能看；编辑＝可改数据、可重建；管理员＝另可管理用户与查看全部日志。</div>`,
      `<button class="mini-btn" id="usrClose">关闭</button>`);
    el('usrClose').onclick = closeModal;

    el('nuAdd').onclick = async () => {
      const msg = el('usrMsg');
      const r2 = await fetch('/api/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create', name: el('nuName').value.trim(), display: el('nuDisplay').value.trim(),
          role: el('nuRole').value, password: el('nuPass').value.trim() || undefined,
        }),
      });
      const d2 = await r2.json();
      if (!d2.ok) { msg.textContent = d2.error || '创建失败'; return; }
      toast('已创建用户 ' + d2.user.name); openUsers();
    };
    el('modalMask').querySelectorAll('.roleSel').forEach(sel => sel.onchange = async () => {
      const rr = await fetch('/api/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', name: sel.dataset.name, role: sel.value }),
      });
      const dd = await rr.json();
      toast(dd.ok ? '角色已更新' : (dd.error || '更新失败'), !dd.ok);
      if (dd.ok) openUsers();
    });
    el('modalMask').querySelectorAll('button[data-act]').forEach(b => b.onclick = async () => {
      const name = b.dataset.name, act = b.dataset.act;
      if (act === 'del' && !confirm(`确认删除用户「${name}」？`)) return;
      if (act === 'reset') {
        const pw = prompt(`为「${name}」设置新口令（留空自动生成）：`);
        if (pw === null) return;
        const usePw = pw.trim() || (Math.random().toString(36).slice(2, 9) + 'Aa1Bb2');
        const resp = await fetch('/api/users', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update', name, password: usePw, mustChange: true }),
        });
        const dd = await resp.json();
        if (dd.ok) {
          modal('新口令已生成', `<div class="frm"><p style="font-size:12px;line-height:1.8">
            用户 <b>${esc(name)}</b> 的新口令：<br>
            <code style="font-size:15px;color:var(--accent);letter-spacing:1px">${esc(usePw)}</code><br>
            <span class="mut" style="font-size:11px">请立即转交本人，并要求其首次登录后修改。</span></p></div>`,
            `<button class="mini-btn primary" id="pwOk2">知道了</button>`);
          el('pwOk2').onclick = () => { closeModal(); openUsers(); };
        } else toast(dd.error || '失败', true);
        return;
      }
      const payload = act === 'toggle'
        ? { action: 'update', name, disabled: b.dataset.disabled === '1' ? false : true }
        : { action: 'delete', name };
      const resp2 = await fetch('/api/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const dd2 = await resp2.json();
      toast(dd2.ok ? '已保存' : (dd2.error || '失败'), !dd2.ok);
      if (dd2.ok) openUsers();
    });
  }

  /* ---------------- 操作日志 ---------------- */
  async function openAudit() {
    const r = await fetch('/api/audit', { cache: 'no-store' });
    const d = await r.json();
    if (!d.ok) { toast(d.error || '读取失败', true); return; }
    const rows = (d.items || []).map(x => `<tr>
      <td class="sm mut">${esc(x.ts)}</td><td><b>${esc(x.user)}</b></td>
      <td><span class="pill z">${esc(x.action)}</span></td>
      <td class="sm">${esc(x.target)}</td><td class="sm mut">${esc(x.detail)}</td></tr>`).join('');
    modal('操作日志（最近 300 条）',
      `<div class="tbl-wrap"><table class="usr-tbl">
        <thead><tr><th>时间</th><th>操作人</th><th>动作</th><th>对象</th><th>详情</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" class="mut">暂无记录</td></tr>'}</tbody></table></div>`,
      `<button class="mini-btn" id="auClose">关闭</button>`);
    el('auClose').onclick = closeModal;
  }

  const _origRenderChip = renderUserChip;
  renderUserChip = function () { _origRenderChip(); if (window.__refreshEditBtn) window.__refreshEditBtn(); };
  window.AUTH_UI = { showLogin, hideLogin, renderUserChip, openUsers, openAudit, openPassword,
                     modal, closeModal, toast, renderModeBanner, openLoginModal };
  window.AUTH_LOCAL = { addUser: localAddUser, removeUser: localRemoveUser, users: allLocalUsers, pbkdf2hex };

  /* ---------------- 启动:先问会话状态 ---------------- */
  window.AUTH_READY = (async function () {
    try {
      const r = await fetch('/api/session', { cache: 'no-store' });
      if (!r.ok) throw new Error('bad status');
      const d = await r.json();
      AUTH.mode = 'server';
      AUTH.publicView = !!d.publicView;
      AUTH.roles = d.roles || {};
      AUTH.user = d.user || null;
    } catch (e) {
      // 没有后端(file:// 双击打开 / 纯静态部署)→ 降级
      const LU = window.__LOCAL_USERS__;
      if (LU && Array.isArray(LU.users) && LU.users.length) {
        AUTH.mode = 'local';
        AUTH.localUsers = allLocalUsers();
        const s2 = readLocalSession();
        AUTH.user = s2 ? s2.user : null;
      } else {
        AUTH.mode = 'open';              // 连账号文件都没有:不校验
        AUTH.local = true;               // 兼容旧判断
      }
    }
    AUTH.ready = true;
    const onReady = () => {
      renderUserChip();
      renderModeBanner();
      // 服务端模式下数据未登录不下发,必须整页拦截;
      // 本地模式数据就在本地,浏览不该被拦——只在点「编辑」时才要求登录。
      if (AUTH.mode === 'server' && !AUTH.user && !AUTH.publicView) showLogin('');
      // 深链直接打开管理面板(/#admin=users 、/#admin=audit)
      const h = location.hash || '';
      if (h.includes('admin=users') && AUTH.can('admin')) setTimeout(openUsers, 900);
      else if (h.includes('admin=audit') && AUTH.can('editor')) setTimeout(openAudit, 900);
      const f = el('loginForm'); if (f) f.onsubmit = doLogin;
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady);
    else onReady();
    return AUTH;
  })();
})();
