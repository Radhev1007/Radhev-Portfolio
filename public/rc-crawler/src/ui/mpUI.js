// Multiplayer interface: entry (name, livery, create / join), lobby (room code, invite, players, ready, host
// settings, start / leave), voice controls, an in-game strip (room, connection, session clock, standings)
// and the results table. Built in JS and added beside the existing UI, which it does not change.
import { LIVERIES, liveryCss } from '../net/config.js';
import { MODE_INFO } from '../net/modes.js';
import { fmtTime } from '../challenges/challenges.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ms = (v) => fmtTime(v / 1000);

const ICON = {
  mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  micOff: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M4 4l16 16"/></svg>',
  spk: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>',
  spkOff: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l5 6M21 9l-5 6"/></svg>',
  crown: '<svg viewBox="0 0 24 24"><path d="M3 18h18l-2-10-5 4-2-6-2 6-5-4z"/></svg>',
};

export class MpUI {
  constructor({ mp, voice, modes, game }) {
    Object.assign(this, { mp, voice, modes, game });
    this.open = false;
    this.build();
    mp.on('change', () => this.schedule());
    mp.on('ping', () => this.schedule());
    mp.on('error', (e) => this.status(e, true));
    mp.on('notice', (t) => this.game.toast(t, ''));
    mp.on('joined', () => { this.status(''); this.schedule(); });
    mp.on('left', () => { this.schedule(); });
    voice.on('change', () => this.schedule());
    setInterval(() => this.renderHud(), 250);
  }

  // ---------------------------------------------------------------- DOM
  build() {
    // entry points: title screen and the pause menu's GAME tab
    const start = $('#btn-start');
    const t = document.createElement('button');
    t.id = 'btn-mp'; t.className = 'btn-mp'; t.innerHTML = 'MULTIPLAYER <span>· drive with friends</span>';
    start.insertAdjacentElement('afterend', t);
    t.onclick = () => this.show();
    const m = document.createElement('button');
    m.id = 'm-mp'; m.className = 'btn'; m.textContent = 'MULTIPLAYER';
    $('#m-restart').insertAdjacentElement('beforebegin', m);
    m.onclick = () => { this.game.closeMenu(); this.show(); };

    const root = document.createElement('div');
    root.id = 'mp'; root.className = 'overlay dim hidden';
    root.innerHTML = `
      <div class="panel mp-panel" role="dialog" aria-label="Multiplayer">
        <div class="mp-head"><h2>MULTIPLAYER</h2><span id="mp-conn" class="mp-conn"></span><button id="mp-close" class="mp-x" aria-label="Close">✕</button></div>
        <div id="mp-entry">
          <label class="mp-l">Your name<input id="mp-name" maxlength="16" placeholder="Driver" autocomplete="nickname" /></label>
          <div class="mp-l">Vehicle livery <span id="mp-livname" class="mp-dim"></span></div>
          <div id="mp-liveries" class="mp-liveries"></div>
          <div class="mp-row2">
            <div class="mp-box" id="mp-createbox"><h3>Create a room</h3><p class="mp-dim">You host: pick the map and mode, then share the code. Up to 20 players.</p><button id="mp-create" class="btn-primary small">CREATE ROOM</button></div>
            <div class="mp-box" id="mp-joinbox"><h3 id="mp-jointitle">Join a room</h3><p class="mp-dim" id="mp-joindesc">Enter the 5-character code a friend sent you.</p>
              <div class="mp-join"><input id="mp-code" maxlength="5" placeholder="CODE" autocapitalize="characters" autocomplete="off" spellcheck="false" /><button id="mp-join" class="btn-primary small">JOIN</button></div></div>
          </div>
        </div>
        <div id="mp-lobby" class="hidden">
          <div class="mp-roomline">
            <div><div class="mp-dim mp-cap">ROOM CODE</div><div id="mp-roomcode" class="mp-code"></div></div>
            <div class="mp-copy"><button id="mp-copycode" class="mp-chip">Copy code</button><button id="mp-copylink" class="mp-chip">Copy invite link</button></div>
            <div class="mp-count"><b id="mp-count">0/20</b><span class="mp-dim">players</span></div>
          </div>
          <div class="mp-cols">
            <div><div class="mp-dim mp-cap">PLAYERS</div><ul id="mp-players" class="mp-players"></ul></div>
            <div>
              <div id="mp-session"></div>
              <div id="mp-hostbox" class="mp-box">
                <div class="mp-dim mp-cap">GAME SETTINGS <span id="mp-hostonly" class="mp-dim"></span></div>
                <label class="mp-l">Map<select id="mp-map"></select></label>
                <label class="mp-l">Mode<select id="mp-mode"></select></label>
                <label class="mp-l" id="mp-coursel">Course<select id="mp-course"></select></label>
                <p id="mp-modedesc" class="mp-dim"></p>
              </div>
              <div class="mp-box mp-voice">
                <div class="mp-dim mp-cap">VOICE CHAT <span id="mp-vstate"></span></div>
                <div id="mp-vbody"></div>
              </div>
            </div>
          </div>
          <div class="mp-actions">
            <button id="mp-ready" class="mp-btn">READY</button>
            <button id="mp-start" class="btn-primary small">START GAME</button>
            <button id="mp-leave" class="mp-btn mp-danger">LEAVE ROOM</button>
          </div>
        </div>
        <div id="mp-status" class="mp-status"></div>
      </div>`;
    document.body.appendChild(root);
    this.root = root;

    // in-game strip + voice buttons + countdown
    const hud = document.createElement('div');
    hud.id = 'mp-hud'; hud.className = 'mp-hud hidden';
    hud.innerHTML = `<div class="mp-strip"><span id="mh-code"></span><span id="mh-net" class="mp-bars"><i></i><i></i><i></i></span><span id="mh-ms" class="mp-dim"></span><span id="mh-session"></span><button id="mh-open" class="mp-chip">ROOM</button></div>
      <ol id="mh-board" class="mp-board"></ol>`;
    document.body.appendChild(hud);
    // voice buttons down the left edge; outside the strip, whose centring transform would anchor them to it
    const vhud = document.createElement('div');
    vhud.id = 'mh-voice'; vhud.className = 'mp-vhud hidden';
    vhud.innerHTML = '<button id="mh-mic" title="Microphone"></button><button id="mh-ptt" class="mp-ptt" title="Hold to talk"><span><span class="ptt-x">HOLD TO </span>TALK<span id="mh-pttkey" class="ptt-k"></span></span></button><button id="mh-spk" title="Speaker"></button>';
    document.body.appendChild(vhud);
    const cd = document.createElement('div'); cd.id = 'mp-countdown'; cd.className = 'mp-countdown hidden'; document.body.appendChild(cd);
    this.hud = hud; this.vhud = vhud; this.cd = cd;

    // liveries
    $('#mp-liveries').innerHTML = LIVERIES.map(([n], i) => `<button data-c="${i}" title="${esc(n)}" style="background:${liveryCss(i)}"></button>`).join('');
    $('#mp-liveries').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; this.mp.saveProfile({ color: +b.dataset.c }); this.renderEntry(); };
    $('#mp-name').value = this.mp.profile.name || '';
    $('#mp-name').oninput = (e) => { clearTimeout(this.nameT); this.nameT = setTimeout(() => this.mp.saveProfile({ name: e.target.value.trim().slice(0, 16) }), 400); };
    $('#mp-code').oninput = (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); };
    $('#mp-code').onkeydown = (e) => { if (e.key === 'Enter') $('#mp-join').click(); e.stopPropagation(); };
    $('#mp-name').onkeydown = (e) => e.stopPropagation();
    $('#mp-create').onclick = async () => { this.flushName(); this.status('Creating room…'); if (await this.mp.create()) this.status(''); };
    $('#mp-join').onclick = async () => {
      this.flushName(); this.status('Joining…');
      if (await this.mp.join($('#mp-code').value)) { this.status(''); this.invite(null); return; }
      // the invite didn't work (room closed or full): offer the other ways in rather than a dead end
      if (this.inviteCode) { const why = this.mp.error || 'Could not join that room'; this.invite(null); this.status(`${why.replace(/\.?$/, '.')} You can also create your own room.`, true); }
    };
    $('#mp-close').onclick = () => this.hide();
    $('#mp-leave').onclick = async () => { await this.voice.leave(); await this.mp.leave(); this.status('You left the room'); this.render(); };
    $('#mp-ready').onclick = () => { const me = this.mp.me; if (me) this.mp.room.send('ready', { ready: !me.ready }); };
    $('#mp-start').onclick = () => this.start();
    $('#mp-copycode').onclick = () => this.copy(this.mp.code, 'Room code copied');
    $('#mp-copylink').onclick = () => this.copy(this.mp.inviteLink(), 'Invite link copied');
    $('#mp-map').innerHTML = this.game.levels.map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join('');
    $('#mp-mode').innerHTML = Object.entries(MODE_INFO).map(([k, v]) => `<option value="${k}">${esc(v.name)}</option>`).join('');
    $('#mp-map').onchange = (e) => this.config({ map: e.target.value });
    $('#mp-mode').onchange = (e) => { const mode = e.target.value; const opts = this.modes.courseOptions(mode); this.config({ mode, challenge: opts[0]?.id || '' }); };
    $('#mp-course').onchange = (e) => this.config({ challenge: e.target.value });
    $('#mp-players').addEventListener('input', (e) => { const r = e.target.closest('[data-sid]'); if (r && e.target.type === 'range') this.voice.setPlayerVolume(r.dataset.sid, +e.target.value / 100); });
    $('#mp-players').addEventListener('click', (e) => { const b = e.target.closest('button[data-mute]'); if (b) this.voice.togglePlayerMute(b.dataset.mute); });
    $('#mp-vbody').addEventListener('click', (e) => this.voiceClick(e));
    $('#mh-open').onclick = () => this.show();
    $('#mh-mic').onclick = () => this.voice.setMicMode(this.voice.micMode === 'open' ? 'muted' : 'open');
    $('#mh-spk').onclick = () => this.voice.setSpeakerMuted(!this.voice.speakerMuted);
    const ptt = $('#mh-ptt');
    const down = (e) => { e.preventDefault(); if (this.voice.micMode !== 'ptt') this.voice.setMicMode('ptt'); this.voice.setPtt(true); ptt.classList.add('on'); };
    const up = () => { this.voice.setPtt(false); ptt.classList.remove('on'); };
    ptt.addEventListener('pointerdown', down); ptt.addEventListener('pointerup', up); ptt.addEventListener('pointercancel', up); ptt.addEventListener('pointerleave', up);
    this.renderEntry();
  }

  flushName() { const n = $('#mp-name').value.trim().slice(0, 16); if (n !== this.mp.profile.name) this.mp.saveProfile({ name: n }); }

  async copy(text, ok) {
    try { await navigator.clipboard.writeText(text); this.status(ok); }
    catch {
      const i = document.createElement('textarea'); i.value = text; document.body.appendChild(i); i.select();
      const done = document.execCommand?.('copy'); i.remove();
      this.status(done ? ok : `Copy this: ${text}`);
    }
  }

  status(t, err = false) { const s = $('#mp-status'); s.textContent = t || ''; s.classList.toggle('err', !!err && !!t); }

  show() {
    if (!this.mp.available) this.status('Multiplayer needs a server. See multiplayer-server/README.md to run one.', true);
    this.open = true; this.root.classList.remove('hidden'); this.game.panelOpen(true); this.render();
    if (!this.mp.active) setTimeout(() => $('#mp-name').focus(), 50);
  }
  hide() { this.open = false; this.root.classList.add('hidden'); this.game.panelOpen(false); }

  // Arriving through an invite link: only the way into that room (name, livery, JOIN with the code filled in).
  // Create Room is for players who opened the game themselves; invite(null) brings it back.
  invite(code) {
    this.inviteCode = code ? String(code).toUpperCase().slice(0, 5) : null;
    $('#mp-entry').classList.toggle('invited', !!this.inviteCode);
    if (this.inviteCode) $('#mp-code').value = this.inviteCode;
    $('#mp-jointitle').textContent = this.inviteCode ? `You're invited · ${this.inviteCode}` : 'Join a room';
    $('#mp-joindesc').textContent = this.inviteCode ? 'Pick your name and colour, then join your friend\'s room.' : 'Enter the 5-character code a friend sent you.';
  }

  // host: game settings can change at any time; during a session, a change ends it and brings everyone back to
  // the lobby with the new settings, ready for the next start
  config(patch) {
    const st = this.mp.state, room = this.mp.room;
    if (!st || !room) return;
    if (st.phase === 'countdown' || st.phase === 'running') room.send('lobby');
    room.send('config', patch);
  }

  start() {
    const st = this.mp.state;
    if (!st) return;
    const payload = this.modes.buildStartPayload(st.mode, st.challenge);
    this.mp.room.send('start', payload);
  }

  voiceClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    const v = this.voice;
    if (b.id === 'mp-vjoin') v.status === 'on' || v.status === 'reconnecting' ? v.leave() : v.join();
    if (b.dataset.mic) v.setMicMode(b.dataset.mic);
    if (b.id === 'mp-spkbtn') v.setSpeakerMuted(!v.speakerMuted);
    if (b.id === 'mp-unlock') v.unlockAudio();
    if (b.id === 'mp-pttkey') {
      b.textContent = 'Press a key…';
      const grab = (ev) => { ev.preventDefault(); ev.stopPropagation(); removeEventListener('keydown', grab, true); if (ev.key !== 'Escape' && ev.key.length === 1 && !'wasdgxvrclmn-=+ '.includes(ev.key.toLowerCase())) { v.pttKey = ev.key.toLowerCase(); v.savePrefs(); } this.render(); };
      addEventListener('keydown', grab, true);
    }
  }

  // ---------------------------------------------------------------- rendering
  schedule() { if (this.raf) return; this.raf = requestAnimationFrame(() => { this.raf = 0; this.render(); this.renderHud(); }); }

  render() {
    const inRoom = this.mp.active || this.mp.status === 'reconnecting';
    $('#mp-entry').classList.toggle('hidden', inRoom);
    $('#mp-lobby').classList.toggle('hidden', !inRoom);
    const q = this.mp.connectionQuality();
    $('#mp-conn').innerHTML = this.mp.status === 'offline' ? '' : `<span class="mp-bars l${q.level}"><i></i><i></i><i></i></span>${esc(q.label)}`;
    for (const id of ['#mp-create', '#mp-join']) $(id).disabled = this.mp.status === 'connecting' || !this.mp.available;
    if (!inRoom) return this.renderEntry();
    if (!this.mp.state) { $('#mp-players').innerHTML = '<li class="mp-dim">Reconnecting to the room…</li>'; return; }
    this.renderLobby();
  }

  renderEntry() {
    const c = this.mp.profile.color;
    [...$('#mp-liveries').children].forEach((b, i) => b.classList.toggle('on', i === c));
    $('#mp-livname').textContent = `SCX30 · ${LIVERIES[c]?.[0] || ''}`;
  }

  renderLobby() {
    const st = this.mp.state, me = this.mp.me, host = this.mp.isHost;
    if (!st || !me) return;
    $('#mp-roomcode').textContent = st.code;
    $('#mp-count').textContent = `${[...st.players.values()].filter((p) => p.connected).length}/20`;
    const live = st.phase === 'countdown' || st.phase === 'running';
    // players
    const rows = [...st.players.entries()].sort((a, b) => a[1].joinedAt - b[1].joinedAt).map(([sid, p]) => {
      const self = sid === this.mp.room?.sessionId, v = this.voice.info(sid);
      const micIcon = v?.inVoice ? (v.mic ? ICON.mic : ICON.micOff) : '';
      const ctl = !self && v?.inVoice ? `<button class="mp-ico ${v.muted ? 'on' : ''}" data-mute="${sid}" title="${v.muted ? 'Unmute' : 'Mute'} ${esc(p.name)}">${v.muted ? ICON.spkOff : ICON.spk}</button><input type="range" min="0" max="100" value="${Math.round(v.volume * 100)}" title="Volume" />` : '';
      const badge = live ? `<span class="mp-tag">${esc(p.status === 'spectating' ? 'next round' : p.status)}</span>` : p.host ? '<span class="mp-tag host">HOST</span>' : `<span class="mp-tag ${p.ready ? 'ok' : ''}">${p.ready ? 'READY' : 'NOT READY'}</span>`;
      return `<li data-sid="${sid}" class="${p.connected ? '' : 'off'} ${v?.speaking ? 'talk' : ''}">
        <i class="mp-dot" style="background:${liveryCss(p.color)}"></i>
        <span class="mp-pn">${p.host ? `<b class="mp-crown" title="Host">${ICON.crown}</b>` : ''}${esc(p.name)}${self ? ' <em>(you)</em>' : ''}<small>SCX30 · ${esc(LIVERIES[p.color]?.[0] || '')}${p.connected ? (p.ping ? ` · ${p.ping} ms` : '') : ' · reconnecting…'}</small></span>
        <span class="mp-v ${v?.speaking ? 'talk' : ''}">${micIcon}</span>${v?.reach === 'relay' ? '<span class="mp-tag" title="No direct route to this player: voice goes through the game server">via server</span>' : v?.reach === 'failed' ? '<span class="mp-tag" title="No direct route to this player">no route</span>' : v?.reach === 'connecting' && !self ? '<span class="mp-tag">connecting</span>' : ''}${ctl}${badge}</li>`;
    });
    // keep a volume slider usable while it is being dragged
    if (!$('#mp-players').contains(document.activeElement) || document.activeElement.type !== 'range') $('#mp-players').innerHTML = rows.join('');

    // settings
    $('#mp-hostonly').textContent = host ? '' : '· chosen by the host';
    for (const id of ['#mp-map', '#mp-mode', '#mp-course']) $(id).disabled = !host;
    $('#mp-map').value = st.map;
    $('#mp-mode').value = st.mode;
    const opts = this.modes.courseOptions(st.mode);
    const kind = MODE_INFO[st.mode]?.course;
    $('#mp-coursel').classList.toggle('hidden', !(kind === 'gates' || kind === 'activity'));
    const html = opts.map((o) => `<option value="${o.id}">${esc(o.name)}</option>`).join('');
    if ($('#mp-course').dataset.h !== html) { $('#mp-course').innerHTML = html; $('#mp-course').dataset.h = html; }
    $('#mp-course').value = st.challenge;
    if (host && (kind === 'gates' || kind === 'activity') && opts.length && !opts.some((o) => o.id === st.challenge)) this.mp.room.send('config', { challenge: opts[0].id });
    $('#mp-modedesc').textContent = MODE_INFO[st.mode]?.desc || '';

    // actions
    const others = [...st.players.values()].filter((p) => p.connected && !p.host);
    const waiting = others.filter((p) => !p.ready).length;
    $('#mp-ready').classList.toggle('hidden', host || live);
    $('#mp-ready').textContent = me.ready ? 'NOT READY' : 'READY';
    $('#mp-ready').classList.toggle('on', me.ready);
    $('#mp-start').classList.toggle('hidden', !host || live);
    $('#mp-start').disabled = waiting > 0;
    $('#mp-start').textContent = st.phase === 'results' ? 'PLAY AGAIN' : 'START GAME';
    $('#mp-start').title = waiting ? `Waiting for ${waiting} player${waiting > 1 ? 's' : ''} to be ready` : '';
    // players: READY and LEAVE ROOM; the host: START GAME and LEAVE ROOM. Closing the panel (× or Esc) drives.
    $('#mp-session').innerHTML = this.sessionHtml(st, me, waiting, host);
    this.renderVoice();
  }

  sessionHtml(st, me, waiting, host) {
    const info = MODE_INFO[st.mode];
    if (st.phase === 'results') return `<div class="mp-box"><div class="mp-dim mp-cap">RESULTS · ${esc(info.name)}</div>${this.resultsTable(st)}</div>`;
    if (st.phase === 'running' || st.phase === 'countdown') return `<div class="mp-box"><div class="mp-dim mp-cap">IN PROGRESS · ${esc(info.name)}</div><p class="mp-dim">Close this panel to drive. ${me.status === 'spectating' ? 'You joined mid-session: you will be scored from the next start.' : ''}${host ? ' Changing a game setting ends this session and brings everyone back to the lobby.' : ''}</p></div>`;
    return `<div class="mp-box mp-wait">${host ? (waiting ? `Waiting for ${waiting} player${waiting > 1 ? 's' : ''} to be ready…` : 'Everyone is ready. Start when you like.') : me.ready ? 'Ready. Waiting for the host to start…' : 'Press READY when you are set.'}</div>`;
  }

  resultsTable(st) {
    const rows = this.modes.standings();
    const val = (p) => st.mode === 'race' ? (p.finish ? ms(p.finish) : `DNF · gate ${Math.max(0, p.cp + 1)}`)
      : st.mode === 'timed' ? (p.best ? `${ms(p.best)} · ${p.runs} run${p.runs === 1 ? '' : 's'}` : 'no clean run')
      : st.mode === 'stunt' ? `${Math.round(p.score)} pts`
      : st.mode === 'checkpoint' ? `${p.score} checkpoints${p.finish ? ' · ' + ms(p.finish) : ''}`
      : st.mode === 'coop' ? `${p.score} gates` : '';
    const team = st.mode === 'coop' ? `<p class="mp-team">${st.teamTime ? `Team finished in <b>${ms(st.teamTime)}</b>` : `Team reached gate ${st.team}`}</p>` : '';
    return team + `<ol class="mp-res">${rows.map(({ sid, p }, i) => `<li class="${sid === this.mp.room?.sessionId ? 'me' : ''}"><span class="mp-rk">${i + 1}</span><i class="mp-dot" style="background:${liveryCss(p.color)}"></i>${esc(p.name)}<b>${esc(val(p))}</b></li>`).join('')}</ol>`;
  }

  renderVoice() {
    const v = this.voice, on = v.status === 'on';
    $('#mp-vstate').textContent = ({ off: '', connecting: '· connecting…', on: '· connected', reconnecting: '· reconnecting…', error: '' }[v.status] || '') + (v.status === 'on' && v.via === 'p2p' ? ' · direct' : '');
    const seg = (m, l) => `<button data-mic="${m}" class="${v.micMode === m ? 'on' : ''}">${l}</button>`;
    $('#mp-vbody').innerHTML = `
      <button id="mp-vjoin" class="mp-btn ${on ? 'mp-danger' : ''}">${on || v.status === 'reconnecting' ? 'LEAVE VOICE' : v.status === 'connecting' ? 'CONNECTING…' : 'JOIN VOICE'}</button>
      ${on ? `<div class="mp-vrow"><span>Mic</span><div class="seg">${seg('muted', 'MUTED')}${seg('open', 'OPEN MIC')}${seg('ptt', 'PUSH TO TALK')}</div></div>
      <div class="mp-vrow"><span>Push-to-talk key</span><button id="mp-pttkey" class="mp-chip"><kbd>${esc(v.pttKey.toUpperCase())}</kbd> change</button></div>
      <div class="mp-vrow"><span>Your mic</span><b class="${v.micLive ? 'mp-live' : 'mp-dim'}">${v.micLive ? (v.speaking.has(this.mp.room?.sessionId) ? '● LIVE · speaking' : '● LIVE') : 'off'}</b></div>
      <div class="mp-vrow"><span>Speaker</span><button id="mp-spkbtn" class="mp-chip">${v.speakerMuted ? 'MUTED · unmute' : 'ON · mute all'}</button></div>
      ${v.needsGesture ? '<button id="mp-unlock" class="mp-btn">CLICK TO HEAR VOICES</button>' : ''}` : '<p class="mp-dim">Optional. Joining turns your microphone on so everyone in the room can talk, here in the lobby and while driving; mute it any time. Nothing is recorded.</p>'}
      ${v.status === 'on' && v.note ? `<p class="mp-dim">${esc(v.note)}</p>` : ''}
      ${v.error ? `<p class="mp-err">${esc(v.error)}</p>` : ''}`;
    $('#mp-vbody button#mp-vjoin').disabled = v.status === 'connecting' || !this.mp.active;
  }

  // ---------------------------------------------------------------- in-game strip
  renderHud() {
    const st = this.mp.state, me = this.mp.me, active = this.mp.active || this.mp.status === 'reconnecting';
    this.hud.classList.toggle('hidden', !active || !this.game.driving());
    this.vhud.classList.toggle('hidden', !active || !this.game.driving() || this.voice.status !== 'on');
    if (!active) { this.cd.classList.add('hidden'); return; }
    const q = this.mp.connectionQuality();
    $('#mh-code').textContent = st ? `${st.code} · ${[...st.players.values()].filter((p) => p.connected).length}/20` : 'RECONNECTING';
    $('#mh-net').className = `mp-bars l${q.level}`;
    $('#mh-ms').textContent = q.label;
    let sess = '';
    const now = this.mp.serverNow();
    if (st && me) {
      const info = MODE_INFO[st.mode];
      if (st.phase === 'countdown') sess = info.name;
      if (st.phase === 'running') {
        const left = st.endAt ? Math.max(0, st.endAt - now) : 0;
        const prog = st.mode === 'race' ? (me.finish ? `Finished ${ms(me.finish)}` : `Gate ${Math.max(0, me.cp + 1)}/${this.modes.course?.gates?.length || '?'}`)
          : st.mode === 'coop' ? `Team gate ${st.team}/${this.modes.course?.gates?.length || '?'}`
          : st.mode === 'checkpoint' ? `${me.score}/${this.modes.course?.points?.length || '?'} checkpoints`
          : st.mode === 'stunt' ? `${Math.round(me.score)} pts`
          : st.mode === 'timed' ? (me.best ? `Best ${ms(me.best)}` : 'No run yet') : '';
        sess = `${info.name}${prog ? ' · ' + prog : ''}${left ? ` · <b>${ms(left)}</b>` : ''}`;
        if (me.status === 'spectating') sess = `${info.name} · scored from the next start`;
      }
      if (st.phase === 'results') sess = 'Results · open ROOM';
    }
    $('#mh-session').innerHTML = sess;
    // standings during a scored session
    const showBoard = st && st.phase === 'running' && st.mode !== 'free';
    $('#mh-board').innerHTML = showBoard ? this.modes.standings().slice(0, 5).map(({ sid, p }, i) => `<li class="${sid === this.mp.room?.sessionId ? 'me' : ''}"><span>${i + 1}</span><i class="mp-dot" style="background:${liveryCss(p.color)}"></i>${esc(p.name)}</li>`).join('') : '';
    // countdown
    const cdOn = st && st.phase === 'countdown';
    this.cd.classList.toggle('hidden', !cdOn);
    if (cdOn) { const n = Math.ceil((st.startAt - now) / 1000); this.cd.textContent = n > 0 ? String(Math.min(n, 3)) : 'GO'; }
    if (st?.phase === 'results' && this.lastPhase !== 'results') { this.show(); }
    // the host started a session: everyone goes straight to the countdown, the panel would only hide it
    const live = (ph) => ph === 'countdown' || ph === 'running';
    if (st && live(st.phase) && this.lastPhase !== undefined && !live(this.lastPhase)) {
      if (this.open) this.hide();
      this.game.toast(`${MODE_INFO[st.mode]?.name || 'Session'} starting`, MODE_INFO[st.mode]?.desc || '');
    }
    this.lastPhase = st?.phase;
    // voice buttons
    const v = this.voice;
    $('#mh-mic').innerHTML = v.micLive ? ICON.mic : ICON.micOff;
    $('#mh-mic').classList.toggle('on', v.micLive);
    $('#mh-mic').title = v.micMode === 'open' ? 'Mute microphone' : 'Open microphone';
    $('#mh-spk').innerHTML = v.speakerMuted ? ICON.spkOff : ICON.spk;
    $('#mh-pttkey').textContent = ` (${v.pttKey.toUpperCase()})`;
    $('#mh-ptt').classList.toggle('on', v.micMode === 'ptt' && v.micLive);
  }
}
