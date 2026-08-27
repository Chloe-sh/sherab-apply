// dashboard-template.html + dd-data.json → dashboard.html (+ dashboard-artifact.html)
// 실행: node tools/build-dashboard.js  (저장소 루트에서)
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const tpl = fs.readFileSync(path.join(root, 'dashboard-template.html'), 'utf8');
const dd = fs.readFileSync(path.join(root, 'dd-data.json'), 'utf8').trim();
if (!dd.startsWith('{')) throw new Error('dd-data.json이 JSON이 아님');
JSON.parse(dd); // 유효성 검사
const page = tpl.replace('__DD_JSON__', dd);
fs.writeFileSync(path.join(root, 'dashboard.html'), page);
// 아티팩트용: 문서 래퍼 제거본 (Claude Artifact는 스켈레톤을 자체 부착)
const art = page
  .replace(/^<!doctype html>\s*/i, '')
  .replace(/<html lang="ko">\s*/, '')
  .replace(/<head>\s*/, '')
  .replace(/<\/head>\s*/, '')
  .replace(/<body>\s*/, '')
  .replace(/<\/body>\s*<\/html>\s*$/, '')
  .replace(/<meta charset="utf-8">\s*/, '')
  .replace(/<meta name="viewport"[^>]*>\s*/, '');
fs.writeFileSync(path.join(root, 'dashboard-artifact.html'), art);
const asOf = (dd.match(/"asOf":"([^"]+)"/) || [])[1];
console.log('built dashboard.html (' + page.length + ' bytes), asOf=' + asOf);
