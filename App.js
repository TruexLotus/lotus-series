(function () {
  'use strict';
  var C = window.LS_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  var SLUG = (params.get('b') || '').trim().toUpperCase();
  var T0 = Date.now();
  var watched = false, popped = false, started = false, formOpenedAt = 0;
  var MODE = 'lead';                       // lead = สมัครแพ็กเกจ / issue = ลูกค้าทรูแจ้งปัญหา
  var API_OK = C.API_URL && C.API_URL.indexOf('http') === 0;

  var VID = '';
  try { VID = localStorage.getItem('ls_vid') || ''; } catch (e) {}
  if (!VID) {
    VID = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    try { localStorage.setItem('ls_vid', VID); } catch (e) {}
  }

  /* ---------------- ส่งข้อมูล ---------------- */
  function post(data) {
    return fetch(C.API_URL, { method: 'POST', body: JSON.stringify(data) }).then(function (r) { return r.json(); });
  }
  var sent = {};
  function track(step, detail) {
    if (!API_OK) return;
    if (sent[step]) return;
    sent[step] = 1;
    var body = JSON.stringify({ action: 'track', step: step, b: SLUG, vid: VID, detail: detail || '' });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(C.API_URL, new Blob([body], { type: 'text/plain' }))) return;
    } catch (e) {}
    fetch(C.API_URL, { method: 'POST', body: body, keepalive: true }).catch(function () {});
  }

  track('scan');
  if (SLUG && API_OK) {
    post({ action: 'branch', b: SLUG }).then(function (r) {
      if (r && r.ok) $('branch').textContent = 'โลตัส ' + r.branch_name;
    }).catch(function () {});
  }

  /* ---------------- ข้อความ ---------------- */
  var O = C.OFFER || {};
  $('offerKicker').textContent = O.kicker || '';
  $('offerTitle').textContent = O.title || '';
  $('offerSub').textContent = O.subtitle || '';
  $('offerBullets').innerHTML = (O.bullets || []).map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('');
  $('offerPrice').textContent = O.price || '';
  $('offerNote').textContent = O.price_note || '';
  $('ctaBtn').textContent = O.cta || 'สมัครเลย';
  $('replayBtn').textContent = O.replay || 'ดูคลิปอีกครั้ง';
  $('midCta').textContent = O.cta || 'สมัครเลย';

  var S = C.SLOW_OFFER || {};
  $('slowKicker').textContent = S.kicker || O.kicker || '';
  $('slowTitle').textContent = S.title || 'อยากได้เน็ตแรงกว่านี้ไหม?';
  $('slowSub').textContent = S.subtitle || '';
  $('slowBullets').innerHTML = (S.bullets || []).map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('');
  $('slowPrice').textContent = O.price || '';
  $('slowNote').textContent = O.price_note || '';
  if (!O.price) $('slowPrice').parentNode.classList.add('hide');
  $('switchBtn').textContent = S.switch_btn || 'ย้ายมาทรูเลย';
  $('issueBtn').textContent = S.issue_btn || 'ใช้ทรูอยู่แล้ว? แจ้งปัญหาเน็ต';
  $('slowTip').textContent = S.banner || 'อยากได้เน็ตแรงกว่านี้ไหม';

  /* ---------------- วัดเน็ตช้า ---------------- */
  var SL = C.SLOW || {};
  var slow = false, stalls = 0, stallMs = 0, stallAt = 0;

  function markSlow(why) {
    if (slow) return;
    slow = true;
    track('slow_net', why);
    if (!popped) $('slowTip').classList.remove('hide');
  }
  function stallStart() { if (started && !stallAt) { stallAt = Date.now(); stalls++; } }
  function stallEnd() {
    if (stallAt) { stallMs += Date.now() - stallAt; stallAt = 0; }
    if (stalls >= (SL.stalls || 2) || stallMs >= (SL.stall_ms || 3000)) markSlow('stall');
  }
  function onStarted() {
    if (started) return;
    started = true;
    track('video_start');
    $('tapPlay').classList.add('hide');
    if (Date.now() - T0 > (SL.start_ms || 4000)) markSlow('slow_start');
  }
  // คลิปยังไม่เริ่มเลยนานเกินไป = เน็ตช้ามาก แสดงป๊อปอัพเน็ตช้าทันที
  setTimeout(function () {
    if (!started && !popped && $('tapPlay').classList.contains('hide')) { markSlow('no_start'); showSlowPopup(); }
  }, SL.give_up_ms || 12000);

  /* ---------------- ป๊อปอัพ ---------------- */
  function hideOverlays() {
    ['unmuteBtn', 'skipBtn', 'midCta', 'slowTip'].forEach(function (id) { $(id).classList.add('hide'); });
  }
  function showPopup(why) {
    if (popped) return;
    popped = true;
    if (why === 'ended') { watched = true; track('video_end'); }
    pausePlayer();
    hideOverlays();
    if (slow) { showSlowPopup(true); return; }
    $('pop').classList.remove('hide');
  }
  function showSlowPopup(fromEnd) {
    popped = true;
    pausePlayer();
    hideOverlays();
    track('slow_popup');
    $('slowPop').classList.remove('hide');
  }
  $('ctaBtn').onclick = function () { track('popup_click'); openForm('lead'); };
  $('midCta').onclick = function () { track('mid_cta'); openForm('lead'); };
  $('slowTip').onclick = function () { showSlowPopup(false); };
  $('switchBtn').onclick = function () { track('popup_click', 'switch'); openForm('lead', true); };
  $('issueBtn').onclick = function () {
    if (C.ISSUE_MODE === 'form') { track('issue_open', 'form'); openForm('issue'); return; }
    track('issue_open', 'app');
    var A = C.ISSUE_APP || {};
    var ua = navigator.userAgent || '';
    var ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document);
    var url = ios ? A.ios : (A.android || A.ios);
    if (url) setTimeout(function () { location.href = url; }, 150);   // รอส่งสถิติก่อนออกจากหน้า
  };
  $('slowBack').onclick = function () {
    $('slowPop').classList.add('hide');
    if (watched || !started) { $('pop').classList.remove('hide'); return; }
    popped = false;
    playPlayer();
  };
  $('replayBtn').onclick = function () { popped = false; $('pop').classList.add('hide'); replayPlayer(); };
  $('skipBtn').onclick = function () { showPopup('skip'); };

  /* ---------------- คลิป ---------------- */
  var V = C.VIDEO || {};
  var video = $('vid');
  var yt = null;
  var skipAt = Number(C.SKIP_AFTER_SEC || 0);
  var midAt = Number(C.MID_CTA_SEC || 0);
  var popAt = Number(C.POPUP_AT_SEC || 0);

  function onTime(cur, dur) {
    if (dur > 0) $('prog').style.width = Math.min(100, cur / dur * 100) + '%';
    if (popped) return;
    if (popAt > 0 && cur >= popAt) { showPopup('ended'); return; }
    if (skipAt > 0 && cur >= skipAt) $('skipBtn').classList.remove('hide');
    var endAt = popAt > 0 && (!dur || popAt < dur) ? popAt : dur;
    if (midAt > 0 && cur >= midAt && (!endAt || endAt - cur > 3)) $('midCta').classList.remove('hide');
  }
  function pausePlayer() { try { if (yt) yt.pauseVideo(); else video.pause(); } catch (e) {} }
  function playPlayer() { try { if (yt) yt.playVideo(); else video.play(); } catch (e) {} }
  function replayPlayer() {
    $('prog').style.width = '0';
    try {
      if (yt) { yt.seekTo(0); yt.playVideo(); }
      else { video.currentTime = 0; video.play(); }
    } catch (e) {}
  }

  if (V.type === 'youtube' && V.id) {
    video.classList.add('hide');
    $('yt').classList.remove('hide');
    $('yt').innerHTML = '<div id="ytInner"></div>';
    window.onYouTubeIframeAPIReady = function () {
      yt = new YT.Player('ytInner', {
        videoId: V.id,
        playerVars: { autoplay: 1, mute: 1, playsinline: 1, controls: 0, rel: 0, modestbranding: 1, fs: 0 },
        events: {
          onReady: function (e) { e.target.mute(); e.target.playVideo(); },
          onStateChange: function (e) {
            if (e.data === YT.PlayerState.PLAYING) { onStarted(); stallEnd(); }
            if (e.data === YT.PlayerState.BUFFERING) stallStart();
            if (e.data === YT.PlayerState.ENDED) showPopup('ended');
          }
        }
      });
      setInterval(function () {
        if (yt && yt.getDuration) onTime(yt.getCurrentTime() || 0, yt.getDuration() || 0);
      }, 300);
    };
    var s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  } else {
    video.src = V.src || 'video.mp4';
    if (V.poster) video.poster = V.poster;
    video.addEventListener('playing', function () { onStarted(); stallEnd(); });
    video.addEventListener('waiting', stallStart);
    video.addEventListener('timeupdate', function () { onTime(video.currentTime, video.duration); });
    video.addEventListener('ended', function () { showPopup('ended'); });
    video.addEventListener('error', function () { showPopup('error'); });
    var p = video.play();
    if (p && p.catch) p.catch(function () { $('tapPlay').classList.remove('hide'); });
    $('tapPlay').onclick = function () { $('tapPlay').classList.add('hide'); video.play(); };
  }

  $('unmuteBtn').onclick = function () {
    try {
      if (yt) { yt.unMute(); yt.setVolume(100); }
      else { video.muted = false; video.volume = 1; video.play(); }
    } catch (e) {}
    $('unmuteBtn').classList.add('hide');
  };

  /* ---------------- ฟอร์ม ---------------- */
  function radios(boxId, name, list) {
    $(boxId).innerHTML = list.map(function (x, i) {
      return '<label class="opt' + (i === 0 ? ' on' : '') + '"><input type="radio" name="' + name + '" value="' + esc(x) + '"' +
        (i === 0 ? ' checked' : '') + '><span>' + esc(x) + '</span></label>';
    }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('input[name=' + name + ']'), function (r) {
      r.addEventListener('change', function () {
        Array.prototype.forEach.call($(boxId).querySelectorAll('.opt'), function (o) {
          o.classList.toggle('on', o.querySelector('input').checked);
        });
      });
    });
  }
  radios('pkgOpts', 'pkg', C.PACKAGES || []);
  if (C.PACKAGE_NOTE) { $('pkgNote').textContent = C.PACKAGE_NOTE; $('pkgNote').classList.remove('hide'); }
  radios('svcOpts', 'svc', C.ISSUE_SERVICES || ['เน็ตมือถือทรู', 'เน็ตบ้านทรูออนไลน์']);
  $('provider').innerHTML = '<option value="">— ไม่ระบุ —</option>' + (C.PROVIDERS || []).map(function (t) {
    return '<option>' + esc(t) + '</option>';
  }).join('');
  $('calltime').innerHTML = (C.CALL_TIMES || []).map(function (t) { return '<option>' + esc(t) + '</option>'; }).join('');
  if (C.PRIVACY_URL) { $('privacyLink').href = C.PRIVACY_URL; $('privacyLink').classList.remove('hide'); }

  function openForm(mode, switching) {
    MODE = mode;
    pausePlayer();
    popped = true;
    hideOverlays();
    formOpenedAt = Date.now();
    track(mode === 'issue' ? 'issue_open' : 'form_open');
    var f = $('form');
    f.classList.toggle('form-issue', mode === 'issue');
    f.classList.toggle('form-lead', mode !== 'issue');
    if (mode === 'issue') {
      $('formKicker').textContent = 'สำหรับลูกค้าทรู';
      $('formTitle').textContent = 'แจ้งปัญหาเน็ตช้า เจ้าหน้าที่โทรกลับ';
      $('areaLabel').textContent = 'พื้นที่ที่เน็ตช้า (เขต/อำเภอ, จังหวัด)';
      $('noteLabel').textContent = 'อาการที่เจอ (ไม่บังคับ)';
      $('note').placeholder = 'เช่น เน็ตบ้านหลุดบ่อยช่วงค่ำ';
      $('sendBtn').textContent = 'ส่งเรื่อง';
    } else {
      $('formKicker').textContent = 'สมัครเน็ตทรู ราคาพิเศษที่โลตัส';
      $('formTitle').textContent = 'ฝากข้อมูลไว้ เจ้าหน้าที่โทรกลับ';
      $('areaLabel').textContent = 'ที่จะติดตั้ง (เขต/อำเภอ, จังหวัด)';
      $('noteLabel').textContent = 'ฝากข้อความ (ไม่บังคับ)';
      $('note').placeholder = 'เช่น อยากติดตั้งวันเสาร์';
      $('sendBtn').textContent = 'ส่งข้อมูล';
      if (switching && $('provider').value === '') $('provider').focus();
    }
    $('pop').classList.add('hide');
    $('slowPop').classList.add('hide');
    $('err').classList.add('hide');
    f.classList.remove('hide');
    f.scrollTop = 0;
    setTimeout(function () { $('name').focus(); }, 250);
  }
  $('backBtn').onclick = function () {
    $('form').classList.add('hide');
    if (slow) $('slowPop').classList.remove('hide'); else $('pop').classList.remove('hide');
  };

  $('phone').addEventListener('input', function () {
    var d = this.value.replace(/[^0-9]/g, '').slice(0, 10);
    this.value = d.length > 6 ? d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6)
               : d.length > 3 ? d.slice(0, 3) + '-' + d.slice(3) : d;
  });

  function showErr(t) { var e = $('err'); e.textContent = t; e.classList.remove('hide'); e.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  function picked(name) { var x = document.querySelector('input[name=' + name + ']:checked'); return x ? x.value : ''; }

  $('leadForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    $('err').classList.add('hide');
    var name = $('name').value.trim();
    var phone = $('phone').value.replace(/[^0-9]/g, '');
    if (name.length < 2) return showErr('กรุณากรอกชื่อ');
    if (!/^0[0-9]{8,9}$/.test(phone)) return showErr('กรุณากรอกเบอร์โทรให้ถูกต้อง');
    if (!$('consent').checked) return showErr('กรุณากดยินยอมให้ติดต่อกลับ');
    if (!API_OK) return showErr('ระบบยังไม่ได้ตั้งค่า กรุณาแจ้งเจ้าหน้าที่');
    var issue = MODE === 'issue';
    var btn = $('sendBtn'), label = btn.textContent;
    btn.disabled = true; btn.textContent = 'กำลังส่ง…';
    post({
      action: 'lead', request_type: MODE, b: SLUG, vid: VID,
      customer_name: name, phone: phone, area: $('area').value.trim(),
      package: issue ? '' : picked('pkg'),
      service: issue ? picked('svc') : '',
      current_provider: issue ? 'ทรู (แจ้งปัญหา)' : $('provider').value,
      preferred_call_time: $('calltime').value,
      customer_note: $('note').value.trim(), consent: true, watched: watched, slow_net: slow,
      hp: $('hp').value, elapsed_ms: Date.now() - (formOpenedAt || T0)
    }).then(function (r) {
      if (!r || !r.ok) {
        btn.disabled = false; btn.textContent = label;
        var m = { bad_phone: 'เบอร์โทรไม่ถูกต้อง', bad_name: 'กรุณากรอกชื่อ', busy: 'ระบบไม่ว่าง กรุณากดส่งอีกครั้ง' };
        return showErr(m[r && r.error] || 'ส่งไม่สำเร็จ กรุณาลองอีกครั้ง');
      }
      $('refId').textContent = r.lead_id;
      $('doneText').textContent = issue
        ? 'ได้รับเรื่องแล้ว เจ้าหน้าที่ทรูจะโทรกลับเพื่อช่วยแก้ปัญหาตามเวลาที่คุณสะดวก'
        : 'เจ้าหน้าที่ทรูจะโทรกลับตามช่วงเวลาที่คุณสะดวก';
      $('form').classList.add('hide');
      $('done').classList.remove('hide');
    }).catch(function () {
      btn.disabled = false; btn.textContent = label;
      showErr('เชื่อมต่อไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง');
    });
  });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
})();
