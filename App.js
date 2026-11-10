(function () {
  'use strict';
  var C = window.LS_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  var SLUG = (params.get('b') || '').trim().toUpperCase();
  var T0 = Date.now();
  var watched = false, popped = false, formOpenedAt = 0;

  var VID = '';
  try { VID = localStorage.getItem('ls_vid') || ''; } catch (e) {}
  if (!VID) {
    VID = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    try { localStorage.setItem('ls_vid', VID); } catch (e) {}
  }

  /* ---------------- ส่งข้อมูล ---------------- */
  function post(data) {
    return fetch(C.API_URL, { method: 'POST', body: JSON.stringify(data) })
      .then(function (r) { return r.json(); });
  }
  var sent = {};
  function track(step, detail) {
    if (!C.API_URL || C.API_URL.indexOf('http') !== 0) return;
    if (sent[step] && step !== 'popup_click') return;
    sent[step] = 1;
    var body = JSON.stringify({ action: 'track', step: step, b: SLUG, vid: VID, detail: detail || '' });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(C.API_URL, new Blob([body], { type: 'text/plain' }))) return;
    } catch (e) {}
    fetch(C.API_URL, { method: 'POST', body: body, keepalive: true }).catch(function () {});
  }

  track('scan');
  if (SLUG && C.API_URL && C.API_URL.indexOf('http') === 0) {
    post({ action: 'branch', b: SLUG }).then(function (r) {
      if (r && r.ok) $('branch').textContent = 'โลตัส ' + r.branch_name;
    }).catch(function () {});
  }

  /* ---------------- ป๊อปอัพ ---------------- */
  var O = C.OFFER || {};
  $('offerKicker').textContent = O.kicker || '';
  $('offerTitle').textContent = O.title || '';
  $('offerSub').textContent = O.subtitle || '';
  $('offerBullets').innerHTML = (O.bullets || []).map(function (b) {
    return '<li>' + esc(b) + '</li>';
  }).join('');
  $('offerPrice').textContent = O.price || '';
  $('offerNote').textContent = O.price_note || '';
  $('ctaBtn').textContent = O.cta || 'สมัครเลย';
  $('replayBtn').textContent = O.replay || 'ดูคลิปอีกครั้ง';

  function showPopup(why) {
    if (popped) return;
    popped = true;
    if (why === 'ended') { watched = true; track('video_end'); }
    pausePlayer();
    $('unmuteBtn').classList.add('hide');
    $('skipBtn').classList.add('hide');
    $('pop').classList.remove('hide');
  }
  $('ctaBtn').onclick = function () { track('popup_click'); openForm(); };
  $('replayBtn').onclick = function () {
    popped = false;
    $('pop').classList.add('hide');
    replayPlayer();
  };
  $('skipBtn').onclick = function () { showPopup('skip'); };

  /* ---------------- คลิป ---------------- */
  var V = C.VIDEO || {};
  var video = $('vid');
  var yt = null;
  var skipAt = Number(C.SKIP_AFTER_SEC || 0);

  function onTime(cur, dur) {
    if (dur > 0) $('prog').style.width = Math.min(100, cur / dur * 100) + '%';
    if (skipAt > 0 && cur >= skipAt && !popped) $('skipBtn').classList.remove('hide');
  }

  function pausePlayer() {
    try { if (yt) yt.pauseVideo(); else video.pause(); } catch (e) {}
  }
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
            if (e.data === YT.PlayerState.PLAYING) track('video_start');
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
    video.addEventListener('playing', function () { track('video_start'); $('tapPlay').classList.add('hide'); });
    video.addEventListener('timeupdate', function () { onTime(video.currentTime, video.duration); });
    video.addEventListener('ended', function () { showPopup('ended'); });
    video.addEventListener('error', function () { showPopup('error'); });
    var p = video.play();
    if (p && p.catch) p.catch(function () { $('tapPlay').classList.remove('hide'); });
    $('tapPlay').onclick = function () { video.play(); };
  }

  $('unmuteBtn').onclick = function () {
    try {
      if (yt) { yt.unMute(); yt.setVolume(100); }
      else { video.muted = false; video.volume = 1; video.play(); }
    } catch (e) {}
    $('unmuteBtn').classList.add('hide');
  };

  // กันคลิปโหลดไม่ขึ้นนานเกินไป: 40 วินาทีแล้วยังไม่จบ ให้แสดงป๊อปอัพเลย
  setTimeout(function () { showPopup('timeout'); }, 40000);

  /* ---------------- ฟอร์ม ---------------- */
  var pk = C.PACKAGES || [];
  $('pkgOpts').innerHTML = pk.map(function (x, i) {
    return '<label class="opt' + (i === 0 ? ' on' : '') + '"><input type="radio" name="pkg" value="' + esc(x) + '"' +
      (i === 0 ? ' checked' : '') + '><span>' + esc(x) + '</span></label>';
  }).join('');
  Array.prototype.forEach.call(document.querySelectorAll('input[name=pkg]'), function (r) {
    r.addEventListener('change', function () {
      Array.prototype.forEach.call(document.querySelectorAll('.opt'), function (o) {
        o.classList.toggle('on', o.querySelector('input').checked);
      });
    });
  });
  $('calltime').innerHTML = (C.CALL_TIMES || []).map(function (t) {
    return '<option>' + esc(t) + '</option>';
  }).join('');
  if (C.PRIVACY_URL) { $('privacyLink').href = C.PRIVACY_URL; $('privacyLink').classList.remove('hide'); }

  function openForm() {
    pausePlayer();
    formOpenedAt = Date.now();
    track('form_open');
    $('pop').classList.add('hide');
    $('form').classList.remove('hide');
    setTimeout(function () { $('name').focus(); }, 250);
  }
  $('backBtn').onclick = function () {
    $('form').classList.add('hide');
    $('pop').classList.remove('hide');
  };

  $('phone').addEventListener('input', function () {
    var d = this.value.replace(/[^0-9]/g, '').slice(0, 10);
    this.value = d.length > 6 ? d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6)
               : d.length > 3 ? d.slice(0, 3) + '-' + d.slice(3) : d;
  });

  function showErr(t) { var e = $('err'); e.textContent = t; e.classList.remove('hide'); e.scrollIntoView({ block: 'center', behavior: 'smooth' }); }

  $('leadForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    $('err').classList.add('hide');
    var name = $('name').value.trim();
    var phone = $('phone').value.replace(/[^0-9]/g, '');
    if (name.length < 2) return showErr('กรุณากรอกชื่อ');
    if (!/^0[0-9]{8,9}$/.test(phone)) return showErr('กรุณากรอกเบอร์โทรให้ถูกต้อง');
    if (!$('consent').checked) return showErr('กรุณากดยินยอมให้ติดต่อกลับ');
    if (!C.API_URL || C.API_URL.indexOf('http') !== 0) return showErr('ระบบยังไม่ได้ตั้งค่า กรุณาแจ้งเจ้าหน้าที่');
    var sel = document.querySelector('input[name=pkg]:checked');
    var btn = $('sendBtn');
    btn.disabled = true; btn.textContent = 'กำลังส่ง…';
    post({
      action: 'lead', b: SLUG, vid: VID,
      customer_name: name, phone: phone, area: $('area').value.trim(),
      package: sel ? sel.value : '', preferred_call_time: $('calltime').value,
      customer_note: $('note').value.trim(), consent: true, watched: watched,
      hp: $('hp').value, elapsed_ms: Date.now() - (formOpenedAt || T0)
    }).then(function (r) {
      if (!r || !r.ok) {
        btn.disabled = false; btn.textContent = 'ส่งข้อมูล';
        var m = { bad_phone: 'เบอร์โทรไม่ถูกต้อง', bad_name: 'กรุณากรอกชื่อ', busy: 'ระบบไม่ว่าง กรุณากดส่งอีกครั้ง' };
        return showErr(m[r && r.error] || 'ส่งไม่สำเร็จ กรุณาลองอีกครั้ง');
      }
      $('refId').textContent = r.lead_id;
      $('form').classList.add('hide');
      $('done').classList.remove('hide');
    }).catch(function () {
      btn.disabled = false; btn.textContent = 'ส่งข้อมูล';
      showErr('เชื่อมต่อไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง');
    });
  });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
})();
