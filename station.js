/* station.js — Main application: bootstrap, player, shortcuts, inspector binding */
(function () {
  'use strict';

  const D = window.STATION_DATA;
  if (!D) { console.error('STATION_DATA missing'); return; }

  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function pad(n, w) { return String(n).padStart(w, '0'); }
  function tc(sec) {
    sec = Math.max(0, sec);
    const hh = Math.floor(sec / 3600);
    const mm = Math.floor((sec % 3600) / 60);
    const ss = Math.floor(sec % 60);
    const ms = Math.round((sec - Math.floor(sec)) * 1000);
    return `${pad(hh,2)}:${pad(mm,2)}:${pad(ss,2)}.${pad(ms,3)}`;
  }
  function tcShort(sec) {
    sec = Math.max(0, sec);
    const mm = Math.floor(sec / 60);
    const ss = Math.floor(sec % 60);
    return `${pad(mm,2)}:${pad(ss,2)}`;
  }

  /* ---------- 绑定 meta 文本 ---------- */
  function bindMeta() {
    $$('[data-bind]').forEach(el => {
      const path = el.getAttribute('data-bind').split('.');
      // Paths are written without the leading "meta." — e.g. "specs.duration"
      let v = D.meta;
      for (const k of path) {
        if (k === 'meta') continue;   // tolerate "meta.xxx" too
        v = v && v[k];
      }
      if (v != null) el.textContent = String(v);
    });
  }

  /* ---------- 项目浏览器 ---------- */
  function renderBrowser() {
    const tree = $('#acts-tree');
    tree.innerHTML = '';
    D.acts.forEach((act, ai) => {
      const wrap = document.createElement('div');
      wrap.className = 'act';
      const head = document.createElement('div');
      head.className = 'act-head';
      const dotColor = actClassColor(act.name);
      head.innerHTML = `
        <div class="act-name">
          <span class="act-dot" style="background:${dotColor}"></span>
          ${act.name}
        </div>
        <div class="act-count">${act.items.length}</div>
      `;
      head.addEventListener('click', () => {
        wrap.classList.toggle('collapsed');
        body.style.display = wrap.classList.contains('collapsed') ? 'none' : '';
      });
      const body = document.createElement('div');
      body.className = 'act-body';
      act.items.forEach(it => {
        const item = document.createElement('div');
        item.className = 'shot-item';
        item.dataset.id = it.id;
        item.innerHTML = `
          <span class="shot-id">${it.id === 'TITLE' ? '◆' : (it.id === 'END' ? '◇' : it.id)}</span>
          <span class="shot-title">${it.title}</span>
          <span class="shot-tc">${tcShort(it.t_in)}</span>
        `;
        item.addEventListener('click', () => {
          const shot = D.shots.find(s => s.id === it.id);
          if (shot) seekTo(shot.t_in, shot);
        });
        body.appendChild(item);
      });
      wrap.appendChild(head);
      wrap.appendChild(body);
      tree.appendChild(wrap);
    });
  }

  function actClassColor(name) {
    return {
      '片头':                  '#7c8a99',
      '片尾':                  '#7c8a99',
      '第一幕 · 开场':         '#2aa97b',
      '第二幕 · Demo 演示':    '#2563b8',
      '第三幕 · 结尾':         '#d98218',
    }[name] || '#7c8a99';
  }

  /* ---------- 检视器播放器 ---------- */
  const player = $('#player');
  const overlay = $('#viewer-overlay');
  const banner = {
    act: $('#v-act'), title: $('#v-title'), time: $('#v-time'),
  };
  const tcEl = $('#t-timecode');

  function setOverlay(visible) {
    overlay.classList.toggle('hide', !visible);
  }

  function loadVideo() {
    // Try each candidate URL until one loads. This makes the station work
    // whether you serve from station/ or from the project root.
    const cands = D.meta.videoCandidates && D.meta.videoCandidates.length
      ? D.meta.videoCandidates
      : [D.meta.videoFile];
    let i = 0;
    const tryNext = () => {
      if (i >= cands.length) {
        console.warn('[station] no video source reachable:', cands);
        setOverlay(true);
        return;
      }
      const url = cands[i++];
      player.src = url;
      player.load();
    };
    player.addEventListener('error', tryNext);
    player.addEventListener('loadedmetadata', () => {
      console.log('[station] video loaded:', player.src);
      setOverlay(true);
    }, { once: true });
    tryNext();
  }

  function fmtTime(sec) {
    return `${tcShort(sec)} / ${tcShort(D.shots[D.shots.length - 1].t_out)}`;
  }

  function findShotAtTime(t) {
    return D.shots.find(s => t >= s.t_in - 0.01 && t < s.t_out) || D.shots[0];
  }

  function seekTo(t, shot, autoplay) {
    shot = shot || findShotAtTime(t);
    const target = Math.max(0, t);
    const doSeek = () => { player.currentTime = target; };
    if (player.readyState >= 1) doSeek();
    else player.addEventListener('loadedmetadata', doSeek, { once: true });

    if (autoplay !== false) {
      player.play().then(() => setOverlay(false)).catch(() => {
        // Not ready to play yet — keep overlay hidden anyway, poster shows frame
        setOverlay(false);
      });
    }
    updateInspector(shot);
    window.STATION_TIMELINE.setActiveShot(shot.id);

    // After seek settles, refresh current frame display
    player.addEventListener('seeked', () => {
      banner.time.textContent = fmtTime(player.currentTime);
      tcEl.textContent = tc(player.currentTime);
    }, { once: true });
  }

  function updateInspector(shot) {
    banner.act.textContent = shot.act;
    banner.title.textContent = shot.title;
    banner.time.textContent = fmtTime(shot.t_in);

    $('#i-act').textContent = shot.act;
    $('#i-id').textContent = shot.id;
    $('#i-page').textContent = shot.page || '—';
    $('#i-tin').textContent = tc(shot.t_in);
    $('#i-tout').textContent = tc(shot.t_out);
    $('#i-dur').textContent = shot.dur.toFixed(1) + ' s';
    $('#i-vo-len').textContent = (shot.narration || '').length + ' 字';
    $('#i-sub').textContent = shot.subtitle || shot.narration || '—';
    $('#i-vo').textContent = shot.narration || '—';

    // Actions
    const acts = $('#i-actions');
    acts.innerHTML = '';
    (shot.actions || []).forEach(a => {
      const t = document.createElement('span');
      t.className = 'act-tag';
      t.textContent = a;
      acts.appendChild(t);
    });
    if (!acts.children.length) acts.textContent = '—';

    // Metrics (only for END card)
    const ms = $('#i-metrics-section');
    if (shot.metrics && shot.metrics.length) {
      ms.hidden = false;
      const m = $('#i-metrics');
      m.innerHTML = '';
      shot.metrics.forEach(it => {
        const d = document.createElement('div');
        d.className = 'ins-metric';
        d.innerHTML = `<div class="m-v">${it.v}</div><div class="m-l">${it.l}</div>`;
        m.appendChild(d);
      });
    } else {
      ms.hidden = true;
    }
  }

  /* ---------- 传输栏 ---------- */
  function bindTransport() {
    const play = $('#t-play');
    const updatePlay = () => { play.textContent = player.paused ? '▶' : '❚❚'; };
    play.addEventListener('click', () => {
      if (player.paused) { player.play().catch(()=>{}); setOverlay(false); }
      else player.pause();
      updatePlay();
    });

    $('#t-prev-shot').addEventListener('click', () => {
      const cur = player.currentTime;
      const i = D.shots.findIndex(s => cur >= s.t_in - 0.01 && cur < s.t_out);
      const prev = D.shots[Math.max(0, i - 1)];
      seekTo(prev.t_in, prev);
    });
    $('#t-next-shot').addEventListener('click', () => {
      const cur = player.currentTime;
      const i = D.shots.findIndex(s => cur >= s.t_in - 0.01 && cur < s.t_out);
      const next = D.shots[Math.min(D.shots.length - 1, i + 1)];
      seekTo(next.t_in, next);
    });
    $('#t-step-back').addEventListener('click', () => { player.currentTime = Math.max(0, player.currentTime - 5); });
    $('#t-step-fwd') .addEventListener('click', () => { player.currentTime = Math.min(player.duration || 0, player.currentTime + 5); });

    $$('.rate-btn').forEach(b => {
      b.addEventListener('click', () => {
        $$('.rate-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        player.playbackRate = parseFloat(b.dataset.rate);
      });
    });
    // Default 1×
    $$('.rate-btn').forEach(x => x.classList.toggle('active', x.dataset.rate === '1'));

    $('#t-volume').addEventListener('input', e => { player.volume = parseFloat(e.target.value); });

    $$('.jump-btn').forEach(b => {
      b.addEventListener('click', () => {
        const act = b.dataset.act;
        const shot = D.shots.find(s => s.act === act);
        if (shot) seekTo(shot.t_in, shot);
      });
    });

    player.addEventListener('play', () => { setOverlay(false); updatePlay(); });
    player.addEventListener('pause', updatePlay);
    player.addEventListener('ended', updatePlay);

    overlay.addEventListener('click', () => {
      player.play().catch(() => {});
      setOverlay(false);
    });
  }

  /* ---------- 时间码 / 进度 ---------- */
  function bindProgress() {
    const ppsRef = { v: window.STATION_TIMELINE.pxPerSecond(D.shots[D.shots.length - 1].t_out) };

    player.addEventListener('timeupdate', () => {
      const t = player.currentTime;
      tcEl.textContent = tc(t);
      banner.time.textContent = fmtTime(t);
      window.STATION_TIMELINE.updateCursor(t, ppsRef.v);
      // Highlight current shot if changed
      const cur = findShotAtTime(t);
      if (cur && cur.id !== (window.__curShot && window.__curShot.id)) {
        window.__curShot = cur;
        window.STATION_TIMELINE.setActiveShot(cur.id);
        // Only update inspector if not actively scrubbing
        if (!player.seeking) {
          updateInspector(cur);
        }
      }
    });
  }

  /* ---------- 键盘快捷键 ---------- */
  function bindKeys() {
    document.addEventListener('keydown', e => {
      // Skip if user is typing in search box
      if (e.target && e.target.tagName === 'INPUT') return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (player.paused) { player.play().catch(()=>{}); setOverlay(false); }
          else player.pause();
          break;
        case 'j': case 'J':
          player.currentTime = Math.max(0, player.currentTime - 5);
          break;
        case 'k': case 'K':
          if (player.paused) player.play().catch(()=>{}); else player.pause();
          break;
        case 'l': case 'L':
          player.currentTime = Math.min(player.duration || 0, player.currentTime + 5);
          break;
        case 'ArrowLeft':
          $('#t-prev-shot').click();
          break;
        case 'ArrowRight':
          $('#t-next-shot').click();
          break;
        case 'Home':
          seekTo(0, D.shots[0]);
          break;
        case 'End':
          seekTo(D.shots[D.shots.length - 1].t_in, D.shots[D.shots.length - 1]);
          break;
        case '0': case '1': case '2': case '3':
          // 1/2/3 jumps to act 1/2/3
          {
            const map = { '1': '第一幕 · 开场', '2': '第二幕 · Demo 演示', '3': '第三幕 · 结尾' };
            const act = map[e.key];
            if (act) {
              const sh = D.shots.find(s => s.act === act);
              if (sh) seekTo(sh.t_in, sh);
            }
          }
          break;
      }
    });
  }

  /* ---------- 搜索 ---------- */
  function bindSearch() {
    const input = $('#search');
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      $$('.shot-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = (!q || text.includes(q)) ? '' : 'none';
      });
      $$('.act').forEach(act => {
        const any = $$('.shot-item', act).some(i => i.style.display !== 'none');
        act.style.display = any ? '' : 'none';
      });
    });
  }

  /* ---------- 项目信息模态 ---------- */
  function bindModal() {
    const fab = $('#fab-info');
    const modal = $('#modal-project');
    const close = $('#modal-close');
    const body = $('#modal-body');
    const open = () => {
      const m = D.meta;
      body.innerHTML = `
        <h4>项目</h4>
        <div class="kv"><div class="k">标题</div><div class="v">${m.title}</div></div>
        <div class="kv"><div class="k">副标题</div><div class="v">${m.subtitle}</div></div>
        <div class="kv"><div class="k">赛事</div><div class="v">${m.team.project}</div></div>
        <div class="kv"><div class="k">命题企业</div><div class="v">${m.team.sponsor}</div></div>
        <div class="kv"><div class="k">承担单位</div><div class="v">${m.team.org}</div></div>
        <div class="kv"><div class="k">负责人</div><div class="v">${m.team.lead}</div></div>
        <h4>成片规格</h4>
        <div class="kv"><div class="k">时长</div><div class="v">${m.specs.duration}</div></div>
        <div class="kv"><div class="k">分辨率</div><div class="v">${m.specs.resolution} @ ${m.specs.fps} fps</div></div>
        <div class="kv"><div class="k">编码</div><div class="v">${m.specs.codec} · ${m.specs.audioCodec}</div></div>
        <div class="kv"><div class="k">大小</div><div class="v">${m.specs.size}</div></div>
        <div class="kv"><div class="k">字体</div><div class="v">${m.specs.subtitleFont}</div></div>
        <div class="kv"><div class="k">TTS</div><div class="v">${m.specs.tts}</div></div>
        <h4>镜头构成</h4>
        <div class="kv"><div class="k">总数</div><div class="v">${m.stats.shots} 段 / ${m.stats.acts} 幕 / Demo 镜头 ${m.stats.scenes} 个</div></div>
        <div class="kv"><div class="k">理论总长</div><div class="v">${m.stats.total_seconds.toFixed(2)} s（实际 25:27，录屏预留 headroom）</div></div>
        <h4>关联交付物</h4>
        <div class="kv"><div class="k">源 Demo</div><div class="v"><a href="${m.links.demo}" target="_blank">${m.links.demo}</a></div></div>
        <div class="kv"><div class="k">分镜文档</div><div class="v"><a href="${m.links.storyboard}" target="_blank">${m.links.storyboard}</a></div></div>
        <div class="kv"><div class="k">分镜源代码</div><div class="v"><a href="${m.links.shotsScript}" target="_blank">${m.links.shotsScript}</a></div></div>
      `;
      modal.hidden = false;
    };
    fab.addEventListener('click', open);
    close.addEventListener('click', () => modal.hidden = true);
    modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });
  }

  /* ---------- 启动 ---------- */
  function boot() {
    bindMeta();
    renderBrowser();
    loadVideo();
    bindTransport();
    bindProgress();
    bindKeys();
    bindSearch();
    bindModal();
    window.STATION_TIMELINE.render(D.shots);
    // Initial inspector: TITLE
    updateInspector(D.shots[0]);
    window.STATION_TIMELINE.setActiveShot(D.shots[0].id);
    window.STATION_APP = { seekTo, findShotAtTime, player };
    console.log('[station] ready ·', D.shots.length, 'shots ·', D.shots[D.shots.length - 1].t_out.toFixed(1), 's');
  }

  // Wait for data + dom
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();