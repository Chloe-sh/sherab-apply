// 쉐랍 방한수련 대시보드 실시간 데이터 API (독립 Apps Script, jennie.ch.kim 계정)
// 배포: Deploy > New deployment > Web app > Execute as: Me / Access: Anyone
// 호출: {EXEC_URL}?k=sherab0303 → DD JSON (5분 캐시)
// 확정 규칙(2026-08-27): tools/gen-dashboard-data.js 와 동일. 규칙 바뀌면 양쪽 다 수정할 것.
const KEY_PARAM = 'sherab0303';
const GRAYS = ['#cccccc', '#d9d9d9'];
const WL = ['260812-220450', '260812-224230'];
const GEX = ['권양희', '권영희', '김정수', '김해리'];
const META = {
  G: { name: '룽즁쥭 쌍악쑤 닥빠', org: 'h', closed: true,  range: '8/26–27',    info: '8/26(수)–27(목) · 봉천',      days: ['8/26','8/27'] },
  C: { name: '꿈요가',             org: 'h', closed: false, range: '8/29–30',    info: '8/29(토)–30(일) · 봉천',      days: ['8/29','8/30'] },
  E: { name: '한의사 茶談 수행',   org: 'a', closed: false, range: '9/1–2 저녁', info: '9/1(화)–2(수) 저녁 · 사당 · 양일', days: ['9/1','9/2'] },
  D: { name: '5일 수행',           org: 'a', closed: false, range: '9/4–8',      info: '9/4(금)–8(화) · 사당',        days: ['9/4','9/5','9/6','9/7','9/8'] },
  F: { name: '약사여래 안거 수행', org: 'b', closed: false, range: '9/10–13 숙박', info: '9/10(목)–13(일) · 대원사 숙박', days: ['9/10','9/11','9/12','9/13'] }
};

function doGet(e) {
  if (!e || !e.parameter || e.parameter.k !== KEY_PARAM) {
    return ContentService.createTextOutput('{"error":"forbidden"}').setMimeType(ContentService.MimeType.JSON);
  }
  const cache = CacheService.getScriptCache();
  let out = null;
  try { out = cache.get('dd'); } catch (err) {}
  if (!out) {
    out = JSON.stringify(buildDD());
    try { cache.put('dd', out, 300); } catch (err) {}
  }
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}

function isTest_(id, name, blob, graySet) {
  if (WL.indexOf(id) !== -1 || name.indexOf('정연아') !== -1) return false;
  if (graySet[id]) return true;
  if (/테스트|김태형|teahyung|김서니|김선희|김채형|그ㅏ이/i.test(name)) return true;
  if (/script>|alert\(/.test(blob)) return true;
  return ['ㅇ', 'ㅇㅇ', 'ㄴㄹ', 'sdf', 'dsfs', 'cvb'].indexOf(name) !== -1;
}

function extractDays_(code, txt) {
  const days = META[code].days;
  const out = {};
  let m;
  const re1 = /(\d+)월\s*(\d+)일/g;
  while ((m = re1.exec(txt)) !== null) { const k = Number(m[1]) + '/' + Number(m[2]); if (days.indexOf(k) !== -1) out[k] = 1; }
  const re2 = /(\d+)\/(\d+)\s*~\s*(?:(\d+)\/)?(\d+)/g;
  while ((m = re2.exec(txt)) !== null) {
    const m1 = +m[1], d1 = +m[2], m2 = m[3] ? +m[3] : m1, d2 = +m[4];
    days.forEach(function (k) {
      const p = k.split('/'); const km = +p[0], kd = +p[1];
      if ((km > m1 || (km === m1 && kd >= d1)) && (km < m2 || (km === m2 && kd <= d2))) out[k] = 1;
    });
  }
  if (Object.keys(out).length === 0) {
    const re3 = /(\d+)\/(\d+)/g;
    while ((m = re3.exec(txt)) !== null) { const k = Number(m[1]) + '/' + Number(m[2]); if (days.indexOf(k) !== -1) out[k] = 1; }
  }
  return days.filter(function (d) { return out[d]; });
}

function buildDD() {
  const ss = SpreadsheetApp.openById('1ZBF3ZilXm9JWroLTI7E15SjZhQIzGUFx36TeqrWFfhs');
  // 접수원본: 회색행(테스트) + 존재 접수번호(재신청 판단 기준)
  const src = ss.getSheetByName('접수원본');
  const nSrc = src.getLastRow();
  const graySet = {}, allSrc = {};
  if (nSrc > 1) {
    const ids = src.getRange(2, 2, nSrc - 1, 1).getValues();
    const bgs = src.getRange(2, 1, nSrc - 1, 4).getBackgrounds();
    for (let i = 0; i < ids.length; i++) {
      const id = String(ids[i][0]).trim();
      if (!id) continue;
      allSrc[id] = 1;
      for (let j = 0; j < bgs[i].length; j++) {
        if (GRAYS.indexOf(String(bgs[i][j]).toLowerCase()) !== -1) { graySet[id] = 1; break; }
      }
    }
  }
  // 개별내역
  const rows = ss.getSheetByName('개별내역').getDataRange().getValues();
  const prog = {};
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const code = String(r[4] || '').trim();
    if (!META[code]) continue;
    const id = String(r[1] || '').trim();
    const rawName = String(r[2] || '');
    if (!rawName) continue;
    const blob = r.join(' ');
    if (isTest_(id, rawName.trim(), blob, graySet)) continue;
    const name = rawName.replace(/[<>'"();=\\\/\t]/g, '').replace(/ལྷུན་གྲུབ་སྐྱིད་/g, '').replace(/[()]/g, '').trim();
    if (GEX.indexOf(name) !== -1) continue;
    if ((code === 'E' || code === 'F') && name === '김연희') continue;
    const ph = String(r[3] || '').replace(/\D/g, '');
    const k = name + '#' + ph.slice(-4);
    if (!prog[code]) prog[code] = {};
    if (!prog[code][k]) prog[code][k] = { name: name, entries: [] };
    prog[code][k].entries.push({ src: !!allSrc[id], ans: String(r[12] || ''), id: id });
  }
  // 분류
  function classify(code, pn) {
    let use = pn.entries.some(function (e) { return e.src; }) ? pn.entries.filter(function (e) { return e.src; }) : pn.entries;
    use = use.slice().sort(function (a, b) { return b.id.localeCompare(a.id); });
    const latest = use[0];
    const re = pn.entries.length > use.length || use.length > 1;
    if (code === 'E') return { type: '양일', days: META.E.days, latest: latest, re: re };
    let full = false; const dset = {}; let free = '';
    use.forEach(function (e) {
      const m = e.ans.match(/참가 (?:일정|형태)(?: 선택)?\s*:\s*([^\n]*)/);
      const v = m ? m[1].trim() : '';
      if (/전일|전 일정/.test(v)) full = true;
      else if (v) {
        const ds = extractDays_(code, v);
        if (ds.length) ds.forEach(function (d) { dset[d] = 1; });
        else {
          const tm = e.ans.match(/부분 참가 시[^:]*:\s*([^\n]*)/);
          const ft = (tm ? tm[1] : v).trim();
          const fd = extractDays_(code, ft);
          if (fd.length) fd.forEach(function (d) { dset[d] = 1; });
          else free = ft.slice(0, 25);
        }
      }
    });
    if (full) return { type: '전일', days: META[code].days, latest: latest, re: re };
    const dl = META[code].days.filter(function (d) { return dset[d]; });
    if (dl.length) return { type: '부분', days: dl, latest: latest, re: re };
    if (free) return { type: '부분(서술)', days: [], free: free, latest: latest, re: re };
    return { type: '일자 미기재', days: [], latest: latest, re: re };
  }
  const dows = ['일', '월', '화', '수', '목', '금', '토'];
  function tsLabel(id) {
    const m = id.match(/^(\d\d)(\d\d)(\d\d)-(\d\d)(\d\d)(\d\d)$/);
    if (!m) return { t: 0, label: id };
    const d = new Date(2000 + +m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    return { t: d.getTime(), label: (+m[2]) + '/' + (+m[3]) + '(' + dows[d.getDay()] + ') ' + m[4] + ':' + m[5] };
  }
  const DD = { asOf: '', live: 1, progs: [], matrix: [], signups: [] };
  const ord = { '전일': 0, '양일': 0, '부분': 1, '부분(서술)': 1, '일자 미기재': 2 };
  ['G', 'C', 'E', 'D', 'F'].forEach(function (code) {
    const m = META[code];
    const ps = Object.keys(prog[code] || {}).map(function (k) {
      const pn = prog[code][k];
      const c = classify(code, pn);
      c.name = pn.name;
      return c;
    });
    ps.sort(function (a, b) { return (ord[a.type] - ord[b.type]) || a.name.localeCompare(b.name, 'ko'); });
    function cnt(t2) { return ps.filter(function (x) { return x.type === t2; }).length; }
    const cells = {};
    m.days.forEach(function (d) {
      const f = ps.filter(function (x) { return x.type === '전일' || x.type === '양일'; }).length;
      const pp = ps.filter(function (x) { return x.type === '부분' && x.days.indexOf(d) !== -1; }).length;
      cells[d] = [f + pp, f, pp];
    });
    function dayNum(d) { return d.split('/')[1]; }
    DD.progs.push({
      code: code, name: m.name, org: m.org, closed: m.closed, range: m.range, info: m.info, days: m.days,
      total: ps.length, full: cnt('전일') + cnt('양일'), part: cnt('부분') + cnt('부분(서술)'), na: cnt('일자 미기재'),
      fullLabel: code === 'E' ? '양일' : '전일', cells: cells,
      fullNames: ps.filter(function (x) { return x.type === '전일' || x.type === '양일'; }).map(function (x) { return x.name; }),
      partList: ps.filter(function (x) { return x.type === '부분' || x.type === '부분(서술)'; }).map(function (x) {
        return [x.name, x.days.length ? x.days.map(dayNum).join('·') : (x.free || '')];
      }),
      naNames: ps.filter(function (x) { return x.type === '일자 미기재'; }).map(function (x) { return x.name; })
    });
    if (code === 'D') DD.matrix = ps.filter(function (x) { return x.type === '부분'; }).map(function (x) {
      return [x.name].concat(m.days.map(function (d) { return x.days.indexOf(d) !== -1 ? 1 : 0; }));
    });
    ps.forEach(function (x) {
      const ts = tsLabel(x.latest.id);
      DD.signups.push({ t: ts.t, l: ts.label, n: x.name, c: code, k: x.type, r: x.re ? 1 : 0, id: x.latest.id });
    });
  });
  DD.signups.sort(function (a, b) { return a.t - b.t; });
  DD.asOf = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
  return DD;
}
