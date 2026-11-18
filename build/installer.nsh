; Windows 제거 프로그램에 끼워 넣는 매크로. electron-builder가 nsis.include로 읽는다.
; 한국어 문구가 깨지지 않도록 이 파일은 UTF-8 BOM으로 저장한다.
; 지우는 범위는 설정의 "모든 데이터 지우기"(src/main/data-wipe.ts)와 같다.

!macro customUnInstall
  ; 앱 내 업데이트가 옛 버전을 걷어 낼 때는 묻지 않고 모두 남긴다.
  ; 새 버전이 같은 자리에 깔려 자동 시작 등록도 그대로 맞는다
  ${ifNot} ${isUpdated}
    ; 자동 시작 등록은 아래 질문에 어떻게 답하든 지운다. 값 이름은 앱 식별자(AppUserModelID)다
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "app.squadify.dingdongdang"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "app.squadify.dingdongdang"
    ; 기본 단추와 조용한 제거의 답은 "아니요"다. 다시 설치하면 시간표와 종소리가 돌아온다
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "저장한 시간표와 종소리도 지울까요?" /SD IDNO IDNO dingDongDangKeepData
      RMDir /r "$APPDATA\ding-dong-dang"
      RMDir /r "$LOCALAPPDATA\ding-dong-dang-updater"
    dingDongDangKeepData:
  ${endIf}
!macroend
