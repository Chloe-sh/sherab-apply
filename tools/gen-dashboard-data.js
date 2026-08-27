// 쉐랍 방한수련 대시보드 데이터 생성기 (브라우저용)
// 사용법 (Claude Code + claude-in-chrome 기준):
//  1) 크롬에서 관리 시트(docs.google.com/spreadsheets/d/1ZBF3…) 탭을 열고
//  2) javascript_tool로 이 파일 전체 코드를 실행 → window.DD_OUT 생성
//     (localhost POST는 구글 CSP로 차단되므로 결과는 클립보드로 꺼낸다)
//  3) 페이지 아무 곳 클릭(문서 포커스) 후
//     javascript_tool: await navigator.clipboard.writeText(JSON.stringify(window.DD_OUT))
//  4) PowerShell: Get-Clipboard -Raw → UTF-8(no BOM)로 dd-data.json 저장
//  5) node tools/build-dashboard.js → dashboard.html 재생성 → git commit & push
// 확정 규칙(2026-08-27 운영진 확정):
//  - 테스트 = 접수원본 회색행(8/10 이후분) + 이름 휴리스틱(초기 구간)
//  - 동일인 중복 신청은 접수원본에 있는(=재신청) 건만 인정
//  - 전역 제외: 권양희·김정수·김해리 / 김연희는 E·F만 제외 / 260812 김선희·김태형은 실참가
//  - F 신형 질문지 "참가 일정 선택: 전 일정 참가" 파싱 필수
(async () => {
const SID = '1ZBF3ZilXm9JWroLTI7E15SjZhQIzGUFx36TeqrWFfhs';
// ── 접수원본 회색행 (xlsx ZIP 수동 파싱) ──
const buf = await fetch('https://docs.google.com/spreadsheets/d/'+SID+'/export?format=xlsx').then(r=>r.arrayBuffer());
const dv = new DataView(buf), u8 = new Uint8Array(buf);
let eocd=-1; for(let i=buf.byteLength-22;i>=0;i--){ if(dv.getUint32(i,true)===0x06054b50){eocd=i;break;} }
const cdOff=dv.getUint32(eocd+16,true), cdN=dv.getUint16(eocd+10,true);
const entries={}; let p=cdOff;
for(let k=0;k<cdN;k++){ const method=dv.getUint16(p+10,true), csz=dv.getUint32(p+20,true), nl=dv.getUint16(p+28,true), el=dv.getUint16(p+30,true), cl=dv.getUint16(p+32,true), lho=dv.getUint32(p+42,true); entries[new TextDecoder().decode(u8.slice(p+46,p+46+nl))]={method,csz,lho}; p+=46+nl+el+cl; }
async function readE(name){ const e=entries[name]; const nl2=dv.getUint16(e.lho+26,true), el2=dv.getUint16(e.lho+28,true); const chunk=u8.slice(e.lho+30+nl2+el2, e.lho+30+nl2+el2+e.csz); if(e.method===0) return new TextDecoder().decode(chunk); return await new Response(new Blob([chunk]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text(); }
const wb=await readE('xl/workbook.xml'), rels=await readE('xl/_rels/workbook.xml.rels');
const shId=[...wb.matchAll(/<sheet [^>]*name="([^"]*)"[^>]*r:id="(rId\d+)"/g)].find(m=>m[1]==='접수원본')[2];
const target=Object.fromEntries([...rels.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]*)"/g)].map(m=>[m[1],m[2]]))[shId];
const styles=await readE('xl/styles.xml'), sst=await readE('xl/sharedStrings.xml'), sh=await readE('xl/'+target);
const fills=[...styles.match(/<fills[^>]*>([\s\S]*?)<\/fills>/)[1].matchAll(/<fill>([\s\S]*?)<\/fill>/g)].map(m=>{const fg=m[1].match(/fgColor rgb="([0-9A-F]+)"/i); return fg?fg[1]:'none';});
const xfFill=[...styles.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)[1].matchAll(/<xf [^>]*>|<xf [^>]*\/>/g)].map(m=>{const f=m[0].match(/fillId="(\d+)"/); return f?+f[1]:0;});
const ss=[...sst.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m=>m[1].replace(/<[^>]+>/g,''));
const graySet=new Set(), allSrc=new Set();
for(const rm of sh.matchAll(/<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)){
  if(+rm[1]===1) continue; let id='', gray=false;
  for(const c of rm[2].matchAll(/<c r="([A-Z]+)\d+"(?:[^>]*s="(\d+)")?(?:[^>]*t="(\w+)")?[^>]*(?:\/>|>([\s\S]*?)<\/c>)/g)){
    const col=c[1], s=c[2]?+c[2]:0, t2=c[3], inner=c[4]||'';
    const color=fills[xfFill[s]||0]||'none';
    if(color==='FFCCCCCC'||color==='FFD9D9D9') gray=true;
    if(col==='B'){ const vm=inner.match(/<v>([\s\S]*?)<\/v>/); let v=vm?vm[1]:''; if(t2==='s'&&v!=='')v=ss[+v]||''; id=String(v).trim(); }
  }
  if(id){ allSrc.add(id); if(gray) graySet.add(id); }
}
// ── 개별내역 ──
const t = await fetch('https://docs.google.com/spreadsheets/d/'+SID+'/gviz/tq?tqx=out:csv&sheet='+encodeURIComponent('개별내역')).then(r=>r.text());
function parseCSV(s){const rows=[];let row=[],cur='',q=false;for(let i=0;i<s.length;i++){const c=s[i];if(q){if(c==='"'){if(s[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=c;}else{if(c==='"')q=true;else if(c===','){row.push(cur);cur='';}else if(c==='\n'){row.push(cur);rows.push(row);row=[];cur='';}else if(c!=='\r')cur+=c;}}if(cur!==''||row.length){row.push(cur);rows.push(row);}return rows;}
const recs = parseCSV(t).slice(1).filter(r=>r.length>5&&r[2]);
const WL=new Set(['260812-220450','260812-224230']), GEX=['권양희','김정수','김해리'];
function isTest(r){ const id=String(r[1]).trim(), name=(r[2]||'').trim(), blob=r.join(' ');
  if(WL.has(id)||name.includes('정연아')) return false;
  if(graySet.has(id)) return true;
  return /테스트|김태형|teahyung|김서니|김선희|김채형|그ㅏ이/i.test(name)||/script>|alert\(/.test(blob)||['ㅇ','ㅇㅇ','ㄴㄹ','sdf','dsfs','cvb'].includes(name);
}
function nm(r){ return (r[2]||'').replace(/[<>'"();=\\\/\t]/g,'').replace(/ལྷུན་གྲུབ་སྐྱིད་/g,'').replace(/[()]/g,'').trim(); }
function pk(r){ const ph=(r[3]||'').replace(/\D/g,''); return nm(r)+'#'+ph.slice(-4); }
const META={
  G:{name:'룽즁쥭 쌍악쑤 닥빠',org:'h',closed:true, range:'8/26–27', info:'8/26(수)–27(목) · 봉천', days:['8/26','8/27']},
  C:{name:'꿈요가',org:'h',closed:false,range:'8/29–30', info:'8/29(토)–30(일) · 봉천', days:['8/29','8/30']},
  E:{name:'한의사 茶談 수행',org:'a',closed:true, range:'9/1–2 저녁', info:'9/1(화)–2(수) 저녁 · 사당 · 양일', days:['9/1','9/2']},
  D:{name:'5일 수행',org:'a',closed:true, range:'9/4–8', info:'9/4(금)–8(화) · 사당', days:['9/4','9/5','9/6','9/7','9/8']},
  F:{name:'약사여래 안거 수행',org:'b',closed:false,range:'9/10–13 숙박', info:'9/10(목)–13(일) · 대원사 숙박', days:['9/10','9/11','9/12','9/13']}
};
const DOW={'8/26':'수','8/27':'목','8/29':'토','8/30':'일','9/1':'화','9/2':'수','9/4':'금','9/5':'토','9/6':'일','9/7':'월','9/8':'화','9/10':'목','9/11':'금','9/12':'토','9/13':'일'};
// 응답 텍스트에서 날짜 추출 ("9월 4일", "9/10~9/12" 범위 포함)
function extractDays(code, txt){
  const days = META[code].days, out = new Set();
  [...txt.matchAll(/(\d+)월\s*(\d+)일/g)].forEach(m=>{ const k=(+m[1])+'/'+(+m[2]); if(days.includes(k)) out.add(k); });
  [...txt.matchAll(/(\d+)\/(\d+)\s*~\s*(?:(\d+)\/)?(\d+)/g)].forEach(m=>{
    const m1=+m[1], d1=+m[2], m2=m[3]?+m[3]:m1, d2=+m[4];
    days.forEach(k=>{ const [km,kd]=k.split('/').map(Number);
      if((km>m1||(km===m1&&kd>=d1)) && (km<m2||(km===m2&&kd<=d2))) out.add(k); });
  });
  if(!out.size) [...txt.matchAll(/(\d+)\/(\d+)/g)].forEach(m=>{ const k=(+m[1])+'/'+(+m[2]); if(days.includes(k)) out.add(k); });
  return days.filter(d=>out.has(d));
}
const prog={};
recs.forEach(r=>{ const code=r[4]; if(!META[code]||isTest(r)) return;
  const name=nm(r); if(GEX.includes(name)) return;
  if((code==='E'||code==='F')&&name==='김연희') return;
  const k=pk(r), src=allSrc.has(String(r[1]).trim());
  if(!prog[code])prog[code]={}; if(!prog[code][k])prog[code][k]={name,entries:[]};
  prog[code][k].entries.push({src,ans:r[12]||'',id:String(r[1]).trim()});
});
function classify(code,pn){
  const use=pn.entries.some(e=>e.src)?pn.entries.filter(e=>e.src):pn.entries;
  use.sort((a,b)=>b.id.localeCompare(a.id));
  const latest=use[0];
  if(code==='E') return {type:'양일',days:META.E.days,latest,re:pn.entries.length>use.length||use.length>1};
  let full=false, dset=new Set(), free='';
  use.forEach(e=>{ const m=e.ans.match(/참가 (?:일정|형태)(?: 선택)?\s*:\s*([^\n]*)/); const v=m?m[1].trim():'';
    if(/전일|전 일정/.test(v)) full=true;
    else if(v){ const ds=extractDays(code,v); if(ds.length) ds.forEach(d=>dset.add(d));
      else { const tm=e.ans.match(/부분 참가 시[^:]*:\s*([^\n]*)/); const ft=(tm?tm[1]:v).trim();
        const fd=extractDays(code,ft); if(fd.length) fd.forEach(d=>dset.add(d)); else free=ft.slice(0,25); } }
  });
  const re=pn.entries.length>use.length||use.length>1;
  if(full) return {type:'전일',days:META[code].days,latest,re};
  if(dset.size) return {type:'부분',days:META[code].days.filter(d=>dset.has(d)),latest,re};
  if(free) return {type:'부분(서술)',days:[],free,latest,re};
  return {type:'일자 미기재',days:[],latest,re};
}
const dows=['일','월','화','수','목','금','토'];
function tsLabel(id){ const m=id.match(/^(\d\d)(\d\d)(\d\d)-(\d\d)(\d\d)(\d\d)$/); if(!m) return {label:id,d:new Date(0)};
  const d=new Date(2000+ +m[1], +m[2]-1, +m[3], +m[4], +m[5], +m[6]);
  return { d, label:(+m[2])+'/'+(+m[3])+'('+dows[d.getDay()]+') '+m[4]+':'+m[5] }; }
const DD={ asOf:'', progs:[], matrix:[], signups:[] };
const ord={'전일':0,'양일':0,'부분':1,'부분(서술)':1,'일자 미기재':2};
['G','C','E','D','F'].forEach(code=>{
  const m=META[code];
  const ps=Object.values(prog[code]||{}).map(pn=>({name:pn.name, ...classify(code,pn)}));
  ps.sort((a,b)=>ord[a.type]-ord[b.type]||a.name.localeCompare(b.name,'ko'));
  const cnt=t2=>ps.filter(x=>x.type===t2).length;
  const cells={};
  m.days.forEach(d=>{ const f=ps.filter(x=>(x.type==='전일'||x.type==='양일')).length;
    const pp=ps.filter(x=>x.type==='부분'&&x.days.includes(d)).length;
    cells[d]=[f+pp,f,pp]; });
  const dayNum=d=>d.split('/')[1];
  DD.progs.push({ code, name:m.name, org:m.org, closed:m.closed, range:m.range, info:m.info, days:m.days,
    total:ps.length, full:cnt('전일')+cnt('양일'), part:cnt('부분')+cnt('부분(서술)'), na:cnt('일자 미기재'),
    fullLabel: code==='E'?'양일':'전일', cells,
    fullNames: ps.filter(x=>x.type==='전일'||x.type==='양일').map(x=>x.name),
    partList: ps.filter(x=>x.type==='부분'||x.type==='부분(서술)').map(x=>[x.name, x.days.length?x.days.map(dayNum).join('·'):(x.free||'')]),
    naNames: ps.filter(x=>x.type==='일자 미기재').map(x=>x.name) });
  if(code==='D') DD.matrix = ps.filter(x=>x.type==='부분').map(x=>[x.name, ...m.days.map(d=>x.days.includes(d)?1:0)]);
  ps.forEach(x=>{ const ts=tsLabel(x.latest.id); DD.signups.push({t:ts.d.getTime(), l:ts.label, n:x.name, c:code, k:x.type, r:x.re?1:0, id:x.latest.id}); });
});
DD.signups.sort((a,b)=>a.t-b.t);
const now=new Date();
DD.asOf = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0')+' '+String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
window.DD_OUT = DD;
return '합산 '+DD.progs.reduce((s,x)=>s+x.total,0)+'명 · 신청건 '+DD.signups.length+' → window.DD_OUT 저장됨. 클립보드로 꺼내서 dd-data.json에 저장할 것.';
})()