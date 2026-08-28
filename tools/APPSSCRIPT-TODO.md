# [진행 중] 대시보드 실시간 API 배포 — 남은 절차

목표: 대시보드가 Claude/컴퓨터 없이도 항상 최신이 되도록, 시트 데이터를 실시간 제공하는
Apps Script 웹앱 배포를 마무리한다. 완료되면 이 파일을 삭제할 것.

상태 (2026-08-28 10:4x): **거의 완료.** gkondelas 계정 프로젝트 "sherab-dashboard-api"에
코드 주입·저장·이름 변경 완료, 새 배포(웹 앱 · 실행: 나 · 액세스: 모든 사용자) 구성 후
**"액세스 승인" 단계에서 중단** — 구글 OAuth 승인 팝업이 별도 창으로 떠서 브라우저 확장으로
제어 불가(게다가 현재 크롬은 원격 기기라 클립보드 우회도 불가, URL 추출은 분류기가 차단).

**남은 것 (사용자 2분 작업 또는 승인 완료 후 자동화 재개):**
A. 사용자: 프로젝트 열기 → 배포 > 새 배포 > 웹 앱 (실행: 나 / 액세스: 모든 사용자) → 배포 →
   "액세스 승인" → 계정 선택 → (인증되지 않은 앱 경고 시 고급 > 이동) → 허용 → 웹 앱 URL 복사.
B. 이후 Claude: 그 URL 검증(7단계)부터 이어서 진행. 승인이 한 번 완료되면 재배포는 팝업 없이
   자동화 가능하므로, 사용자가 승인만 해두면 나머지는 크론이 마무리한다.

주의: 현재 크롬이 윈도우 본체가 아닌 다른 기기에서 연결됨 → 클립보드 브리지(3~4단계) 불가로
**정기 데이터 갱신도 이 상태에서는 불가**. 윈도우 본체 크롬으로 연결되면 정상 재개.

프로젝트 URL(정본, gkondelas): https://script.google.com/home/projects/1m4fveKQHSms5E29Nky1oQciF8i0gjbFYJKPStJuGYUQH4F7YZZSXlJfp/edit
(구 jennie 프로젝트 1LWCtIvPgjld45TZBXAdKJocrBsCUAAv-Y8sGK0eLrV0svrOdXnd9ikd6 은 폐기 — 접근 불가)

## 절차 (claude-in-chrome 필요, 어느 계정이든 시트 접근되는 프로필이면 됨)

1. 위 프로젝트 URL을 크롬 탭에서 연다 (계정 팝업 뜨면 OK).
2. 코드 주입: `tools/gs-b64.txt`의 base64 문자열을 읽어 javascript_tool로
   `monaco.editor.getModels()[0].setValue(new TextDecoder().decode(Uint8Array.from(atob(B64), c=>c.charCodeAt(0))))`
   실행 (원본 코드는 tools/dashboard-appsscript.gs).
3. Ctrl+S로 저장. 프로젝트명은 "sherab-dashboard-api"로 변경(상단 Untitled project 클릭).
4. Deploy(우상단 파란 버튼) → New deployment → 톱니에서 type: Web app →
   Execute as: **Me** / Who has access: **Anyone** → Deploy.
5. 권한 승인 흐름: Authorize access → jennie.ch.kim 선택 → (unverified 경고 시)
   Advanced → Go to ... (unsafe) → Allow.
6. 배포 완료 화면의 **Web app URL**(…/exec) 복사.
7. 검증: 새 탭에서 `{EXEC_URL}?k=sherab0303` fetch → `{"asOf":...}` JSON이 오는지,
   progs 합산이 대시보드와 일치하는지 확인. k 없이 호출하면 forbidden이어야 함.
8. 로컬: `{EXEC_URL}?k=sherab0303` 전체 문자열을 `C:\Users\sihac\sherab-apply\live-url.txt`에
   저장(UTF-8, 개행 없이) → `node tools/build-dashboard.js` → dashboard.html에
   LIVE_ENDPOINT가 박혔는지 grep 확인.
9. git add dashboard.html dashboard-artifact.html live-url.txt → commit "실시간 데이터 연결" → push.
10. 라이브 확인: 캐시 우회로 dashboard.html 열어 마스트헤드에 "●실시간" 표시 + 최신 asOf 확인.
11. Artifact 재게시(url=https://claude.ai/code/artifact/7bd7c30a-52d2-409f-90c4-d0b0e3b6a682).
12. 이 파일 삭제, 인수인계서에 실시간 구조 기록, 30분 로컬 갱신 크론은 백업으로 유지하거나
    사용자 컨펌 후 제거.

주의: 실시간 API가 붙으면 시트가 곧 진실이 된다 — 운영진이 접수원본에 회색(테스트) 표시만
하면 몇 분 안에(캐시 5분) 대시보드에 반영된다. 확정 규칙 변경 시 dashboard-appsscript.gs와
gen-dashboard-data.js 양쪽을 같이 고칠 것.
