# Code.gs 보안 패치 (붙여넣기용)

> 이 저장소는 public이라 Code.gs 원본은 들어 있지 않습니다.
> 마스터 시트 → **확장 프로그램 → Apps Script** 를 열고 아래 내용을 반영하세요.
> 반영 후 반드시 **배포 → 배포 관리 → 새 버전** 으로 다시 배포해야 적용됩니다.

## 왜 필요한가

| # | 위험 | 이 패치가 막는 것 |
|---|---|---|
| 1 | **스프레드시트 수식 인젝션** | 신청자가 이름·건강상태·기타문의에 `=IMPORTXML(...)` 을 넣으면 담당자가 시트를 여는 순간 실행되어 옆 셀의 신청자 개인정보가 외부 서버로 전송됨 |
| 2 | 누구나 호출 가능한 공개 API | `curl` 한 줄로 시트에 무제한 행 삽입 (스팸·데이터 오염) |
| 3 | 프로그램 코드 미검증 | 클라이언트가 보낸 임의 코드가 그대로 시트에 기록됨 |
| 4 | 입력 길이 무제한 | 수십 KB 텍스트로 시트 오염 |

---

## STEP 1 — 헬퍼 함수 추가

Code.gs 아무 곳(맨 아래 권장)에 **그대로 붙여넣기**:

```javascript
// ─────────────────────────────────────────────
//  보안 헬퍼 (2026-08 추가)
// ─────────────────────────────────────────────

/** 시트에 유효한 프로그램 코드. 프로그램이 늘어나면 여기에 추가하세요. */
var VALID_PROGRAM_CODES = ['A', 'B', 'C', 'D', 'E', 'F'];

/** 시간당 전체 접수 허용 건수. 초과하면 접수를 거부합니다. */
var MAX_SUBMITS_PER_HOUR = 60;

/** 봇 판별 기준 : 페이지 진입 후 이 시간(ms) 안에 제출되면 거부 */
var MIN_FILL_MS = 5000;

/**
 * 수식 인젝션 방어 + 길이 제한.
 * 시트에 값을 넣기 전 모든 문자열은 반드시 이 함수를 통과시킬 것.
 * = + - @ 나 탭/개행으로 시작하면 앞에 작은따옴표를 붙여 '텍스트'로 강제한다.
 */
function safeCell(v, maxLen) {
  var s = (v === null || v === undefined) ? '' : String(v);
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ''); // 제어문자 제거
  s = s.slice(0, maxLen || 2000);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return s;
}

/** 객체/배열 안의 모든 문자열에 safeCell 적용 (재귀) */
function safeDeep(v, maxLen) {
  if (Array.isArray(v)) return v.map(function (x) { return safeDeep(x, maxLen); });
  if (v && typeof v === 'object') {
    var out = {};
    Object.keys(v).forEach(function (k) { out[k] = safeDeep(v[k], maxLen); });
    return out;
  }
  if (typeof v === 'string') return safeCell(v, maxLen);
  return v;
}

/**
 * 제출 요청이 정상인지 검사. 문제가 있으면 사유 문자열을, 정상이면 null을 반환.
 */
function screenSubmission(data) {
  // (1) 허니팟 : 사람에게 보이지 않는 필드가 채워졌다면 봇
  if (data.website) return 'bot:honeypot';

  // (2) 체류시간 : 페이지 열자마자 제출된 요청은 봇
  var elapsed = Number(data.elapsedMs);
  if (!isFinite(elapsed) || elapsed < MIN_FILL_MS) return 'bot:too-fast';

  // (3) 필수값 형식 검사
  var name = String(data.name || '').trim();
  var phone = String(data.phone || '').trim();
  if (!name || name.length > 40) return 'invalid:name';
  if (!/^01[016789][-\s]?\d{3,4}[-\s]?\d{4}$/.test(phone)) return 'invalid:phone';
  var age = Number(data.age);
  if (!isFinite(age) || age < 1 || age > 120) return 'invalid:age';

  // (4) 동의 검사 (클라이언트 우회 방지)
  if (data.privacyConsent !== '동의함') return 'invalid:privacy-consent';
  if (data.healthConsent !== '동의함') return 'invalid:health-consent';

  // (5) 프로그램 코드 화이트리스트
  var programs = data.programs || [];
  if (!programs.length || programs.length > VALID_PROGRAM_CODES.length) return 'invalid:programs';
  for (var i = 0; i < programs.length; i++) {
    if (VALID_PROGRAM_CODES.indexOf(String(programs[i].code)) === -1) return 'invalid:code';
  }

  var cache = CacheService.getScriptCache();

  // (6) 중복 제출 : 같은 번호로 3분 안에 재제출 차단
  var dupKey = 'dup_' + phone.replace(/\D/g, '');
  if (cache.get(dupKey)) return 'duplicate';
  cache.put(dupKey, '1', 180);

  // (7) 전체 유량 제한 : 시간당 MAX_SUBMITS_PER_HOUR 건
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    var n = Number(cache.get('rate_hour') || 0) + 1;
    cache.put('rate_hour', String(n), 3600);
    if (n > MAX_SUBMITS_PER_HOUR) return 'rate-limited';
  } catch (e) {
    // 락 획득 실패는 통과시킴 (정상 사용자를 막지 않기 위해)
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }

  return null;
}
```

---

## STEP 2 — `submitApplication` 안에 3줄 끼워넣기

`submitApplication(payloadJson)` 함수에서 **JSON을 파싱한 직후**, 시트에 쓰기 전에:

```javascript
function submitApplication(payloadJson) {
  var data = JSON.parse(payloadJson);

  // ★ 추가 ①  요청 선별
  var reject = screenSubmission(data);
  if (reject) {
    Logger.log('접수 거부: ' + reject);
    return JSON.stringify({ ok: false, error: '접수 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.' });
  }

  // ★ 추가 ②  이후 시트에 기록되는 모든 값을 텍스트로 무해화
  data = safeDeep(data, 2000);

  // ... 기존 코드 (접수번호 발급, setValues 등) 그대로 ...
}
```

> **주의** — `safeDeep` 을 통과시킨 뒤에는 `data` 안의 값이 전부 문자열입니다.
> 기존 코드에서 `data.age` 를 숫자로 쓰고 있다면 `Number(data.age)` 로 감싸 주세요.

---

## STEP 3 — setValues 직전 최종 방어 (권장)

`sheet.getRange(...).setValues([row])` 형태로 쓰는 부분이 있다면, 그 직전에:

```javascript
row = row.map(function (v) {
  return (typeof v === 'string') ? safeCell(v) : v;
});
sheet.getRange(...).setValues([row]);
```

STEP 2에서 이미 걸렀더라도, 나중에 누군가 새 필드를 추가했을 때를 대비한 이중 방어입니다.

---

## STEP 4 — 이상 징후 알림 (선택)

`screenSubmission` 이 `rate-limited` 를 반환할 때 담당자에게 메일이 가도록:

```javascript
if (n > MAX_SUBMITS_PER_HOUR) {
  var alerted = cache.get('rate_alerted');
  if (!alerted) {
    cache.put('rate_alerted', '1', 3600);
    MailApp.sendEmail(
      Session.getEffectiveUser().getEmail(),
      '[약사여래 신청] 비정상 접수 감지',
      '최근 1시간 접수 시도가 ' + n + '건을 넘어 접수를 차단했습니다. 시트를 확인해 주세요.'
    );
  }
  return 'rate-limited';
}
```

---

## STEP 5 — 배포

1. Apps Script 편집기에서 **저장**
2. 우측 상단 **배포 → 배포 관리 → (연필 아이콘) → 버전: 새 버전 → 배포**
3. 배포 URL은 그대로 유지됩니다. (index.html의 `API_URL` 수정 불필요)

---

## 반영 후 확인 방법

| 확인할 것 | 방법 | 기대 결과 |
|---|---|---|
| 정상 접수 | 신청 페이지에서 평소처럼 제출 | 접수번호 정상 발급 |
| 수식 인젝션 방어 | 이름에 `=1+1` 을 넣고 제출 | 시트에 `2` 가 아니라 `=1+1` 이라는 **글자**로 보임 |
| 봇 차단 | `curl -X POST '<API_URL>' -d '{"name":"봇"}'` | `ok:false` 응답, 시트에 행 추가 안 됨 |
| 중복 차단 | 같은 번호로 연속 2회 제출 | 두 번째는 실패 |

---

## 이 패치로도 남는 위험

- **마스터 시트 공유 설정** — 시트를 "링크가 있는 모든 사용자"로 바꾸는 순간 전체 신청자 명단이 공개됩니다. 담당자 공유는 반드시 **이메일 지정 공유**로 하세요.
- **git 히스토리** — 이전 커밋에 마스터 시트 주소가 남아 있습니다. 저장소를 계속 public으로 둘 거라면 시트 공유 설정을 비공개로 유지하는 것이 유일한 방어선입니다.
- **CSV 내보내기** — 시트를 CSV로 받아 Excel에서 열면 Excel 자체의 DDE 경고가 뜰 수 있습니다. STEP 1의 `safeCell` 이 이것도 함께 막아 줍니다.
