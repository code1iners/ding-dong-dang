# 01: 사용자 준비: Gmail SMTP 자격 증명과 n8n 공개 주소

**What to build:** 제보 알림 메일을 보낼 자격 증명과 폼 주소의 앞부분이 정해져, 이후 티켓이 사용자 개입 없이 진행된다. [스펙](../spec.md)의 Further Notes와 [ADR 0002](../../../docs/adr/0002-feedback-via-n8n-form.md)를 따른다.

Blocked by: None (can start immediately)

Status: done

사용자가 할 일(앱 비밀번호는 에이전트에게 알려 주지 않는다):

1. 2단계 인증이 켜진 개발자 Gmail 계정에서 앱 비밀번호를 만든다.
2. n8n에 SMTP 자격 증명을 등록한다(호스트 `smtp.gmail.com`, 포트 465 SSL, 사용자는 그 Gmail 주소, 비밀번호는 앱 비밀번호).
3. 그 자격 증명의 이름과 n8n 공개 호스트 주소(예: `https://n8n.example.com`)를 에이전트에게 알린다.

에이전트가 확인하는 완료 조건:

- [x] n8n MCP의 자격 증명 목록에 알려 준 이름의 SMTP 자격 증명이 있다(비밀 값은 보지 않는다).
- [x] 알려 준 호스트 주소에 `curl`로 요청하면 n8n이 응답한다.
- [x] 자격 증명 이름과 호스트 주소를 이 티켓의 Comments에 적는다.

## Comments

- 2026-11-19 에이전트: n8n 호스트는 `https://oracle.codeliners.cc`(워크플로 생성 결과의 주소로 확인, `/healthz` 200). 사용자가 Gmail 앱 비밀번호를 만들었다. 남은 일은 사용자가 n8n에 SMTP 자격 증명을 등록하는 것 하나다(에이전트는 비밀번호 입력을 하지 않는다). 등록되면 자격 증명 목록에서 확인하고 이 티켓을 닫는다.
- 2026-11-19 에이전트: 사용자가 SMTP 자격 증명을 등록했다. 목록의 SMTP 자격 증명은 `SMTP account`(id `jrmUcrIRGo6vFYuS`) 하나다(사용자는 "Gmail SMTP"로 등록했다고 했지만 이름은 기본값으로 저장됨). 호스트 `https://oracle.codeliners.cc` 응답 확인. 닫는다.
