// 앱 내 업데이트 파일의 서명을 검증하는 Ed25519 공개 키 목록이다. 앱과 릴리스 명령의 서명 재검증이 함께 쓴다.
// `npm run update:keygen`이 이 파일을 다시 쓴다. 손으로 고치는 것은 키를 바꾸는 일을 마치며 옛 키를 뺄 때뿐이다.

/** Ed25519 공개 키(SPKI DER의 base64). 평소에는 하나이고, 키를 바꾸는 동안에만 둘이다. */
export const UPDATE_PUBLIC_KEYS: readonly string[] = [
  'MCowBQYDK2VwAyEAYUYRPTq3CL0JKeuEgmKreTwimo38uiUn+zE84/wmsP4=',
];
