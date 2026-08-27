# [진행 중] 대시보드 실시간 API 배포 — 남은 절차

목표: 대시보드가 Claude/컴퓨터 없이도 항상 최신이 되도록, 시트 데이터를 실시간 제공하는
Apps Script 웹앱 배포를 마무리한다. 완료되면 이 파일을 삭제할 것.

상태 (2026-08-27 18:15): Apps Script 프로젝트 생성됨(jennie.ch.kim 계정, 빈 상태),
코드 주입 직전 크롬 연결 끊김. 페이지(dashboard-template.html)와 빌드 스크립트는
실시간 로딩 지원 완료(LIVE_ENDPOINT — live-url.txt로 주입).

프로젝트 URL: https://script.google.com/home/projects/1LWCtIvPgjld45TZBXAdKJocrBsCUAAv-Y8sGK0eLrV0svrOdXnd9ikd6/edit

## 절차 (claude-in-chrome 필요, jennie.ch.kim 로그인 상태)

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
