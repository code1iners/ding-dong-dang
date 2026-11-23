# 종 음량을 지금보다 더 키울 수 있는가

조사일 2026-11-23. 기준: 딩동댕 0.2.4(`main` 57cc353), Electron 45.3.3(Chromium 156.0.8078.100, `process.versions`로 확인), macOS 27.2 / Xcode SDK(MacOSX.sdk) 로컬 헤더.
표기: **[원문 확인]** 1차 자료(명세·소스·공식 문서·SDK 헤더)나 저장소 코드를 직접 열어 확인, **[실험]** 이번에 설치된 Electron 45.3.3을 직접 돌리거나 ffmpeg·Python으로 측정, **[확인 못 함]** 열지 못했거나 측정하지 못함.
블로그·Q&A·요약 글은 근거로 쓰지 않았다. 이 문서는 추천하지 않고 관찰한 사실, 선택지별 한계, 바뀌어야 할 범위만 적는다.

## 조사 대상

사용자 요청: "알림(종) 음량이 너무 작아서 다른 앱(유튜브 음악 등) 소리에 묻혀 안 들린다." 슬라이더 100%에서도 작다는 뜻이므로, 앱이 내는 최대 음량을 지금보다 키울 수 있는지, 키운다면 어떤 방법이 있고 각각 한계(왜곡·플랫폼·부작용)가 무엇인지를 조사한다. 사용자의 실제 PC 환경(출력 장치, 재생 중인 음악의 크기)은 알 수 없다.

## 결론

**조건부로 가능하다.** 막힌 곳과 열린 곳이 갈린다.

- **지금 구조(`<audio>`의 `volume`)로는 불가능하다.** HTML 표준과 Chromium 156 모두 `volume`의 상한이 1.0이고, 1.0은 "원본 파일 진폭 그대로"다 [원문 확인][실험].
- **Web Audio `GainNode`로는 1.0 초과 증폭이 가능하다.** 명세상 `gain` 범위에 상한이 없고, Electron 45.3.3에서 게인 2·4를 걸면 그래프 안의 최대값이 1.64·3.28로 실제로 커졌다 [원문 확인][실험]. 다만 **출력 단계에서 ±1.0으로 잘린다**(Chromium 156 소스에서 확인, 명세는 범위 밖 값의 재생을 "정의하지 않음"). 잘리면 왜곡이다.
- **왜곡 없이 올릴 수 있는 폭은 내장 음원이 작다.** 12개 모두 RMS가 같은 -17.7 dBFS로 맞춰져 있고, 샘플 최대값 여유(헤드룸)는 **0.5~5.5 dB(×1.06~×1.89)**다. 기본 웨스트민스터는 5.5 dB, 화음은 0.5~1.0 dB뿐이다 [실험]. 게인 ×2부터 샘플의 0.004~0.77%가 잘리고, ×4에서는 7.2~8.9%가 잘린다.
- **왜곡을 감수하면 훨씬 올라간다.** 하드 클리핑으로 ×4(+12 dB 계산값)를 걸면 RMS가 +10~11 dB 오른다(-17.7 → -7.5~-6.4 dBFS). 대신 오차 에너지가 신호의 -10~-16 dB 수준이다. 컴프레서·소프트 클리퍼를 앞에 두면 왜곡은 줄지만 같은 게인에서 RMS 이득도 줄어든다(§5). 청감 평가는 하지 않았다.
- **OS 시스템 음량 변경과 다른 앱 덕킹은 Electron 내장 API가 없다.** `electron.d.ts` 45.3.3에 volume·duck 관련 API가 없다. macOS는 `osascript`로 시스템 출력 음량을 바꿀 수 있고(사용자 설정을 건드린다), 다른 앱을 낮추는 공개 API는 찾지 못했다. Windows는 시스템이 "통신 스트림"에만 기본 덕킹을 하고, 앱이 그 범주로 스트림을 열거나 다른 세션 음량을 직접 건드리려면 네이티브 코드가 필요하다(§6, §7).

## 1. 현재 구현 (직접 확인, 요청서 내용 정정 없음)

- **[원문 확인]** `src/renderer/src/bell.ts:28-31`: `new Audio(url)`, `audio.volume = Math.min(1, Math.max(0, volume))`. 0~1로 고정해서 넘기므로 예외가 나지 않는다.
- **[원문 확인]** `src/main/bell-sound.ts:44`: `((data.soundVolumes[id] ?? 100) * data.masterVolume) / 10_000`. 둘 다 0~100 정수의 곱이라 100×100이면 1.0이다.
- **[원문 확인]** `bell.ts:77-85`: `AudioContext`는 파일 등록 때 길이 확인용 `decodeAudioData`에만 쓰고 바로 `close()`한다. 재생에는 쓰지 않는다. 재생 창(`src/main/bell-player.ts:57-64`)은 `autoplayPolicy: 'no-user-gesture-required'`다.
- **[원문 확인]** 내장 음원은 `scripts/bell-synth.mts`가 합성한다(`TARGET_RMS = 0.13` 약 -17.7 dBFS, `PEAK_CEILING = 0.95`, 163-166행). 파일은 `resources/sounds/builtin/`의 WAV 12개, 44.1 kHz, 16비트, 모노(`ffprobe`).
- **[원문 확인]** 등록 음원은 `mp3, wav, m4a, ogg`, 60초 이하(`src/main/sound-files.ts:7-13`). 크기는 사용자 파일에 달렸고 이번에 측정하지 않았다.
- **[실험]** 이 Electron에서 `AudioContext`는 사용자 입력 없이 만들면 곧바로 `state: 'running'`이다(`autoplayPolicy: 'no-user-gesture-required'`, 숨은 창). 출력 샘플레이트는 48000 Hz(파일은 44100 Hz라 재샘플된다).

## 2. `HTMLAudioElement.volume`은 1.0이 상한

- **[원문 확인]** WHATWG HTML, media element 절: "A media element has a playback volume, which is a fraction in the range 0.0 (silent) to 1.0 (loudest)." setter 단계: "If the given value is not in the range 0.0 to 1.0 inclusive, then throw an "IndexSizeError" DOMException." [1]
- **[원문 확인]** Chromium 156.0.8078.100 `HTMLMediaElement::setVolume`(`html_media_element.cc` 3381행~): `vol < 0.0f || vol > 1.0f`이면 `kIndexSizeError`를 던진다 [2]. **예외:** `RuntimeEnabledFeatures::MediaElementVolumeGreaterThanOneEnabled()`가 켜져 있으면 `vol < 0`만 막는다(3387-3394행). 이 기능은 `runtime_enabled_features.json5`에 이름만 있고(`status` 없음, 4204행) 기본은 꺼짐이다 [3].
- **[실험]** 설치된 Electron 45.3.3에서 `new Audio().volume = 2`는 `IndexSizeError: ... The volume provided (2) is outside the range [0, 1].`.
- **[실험]** `BrowserWindow`의 `webPreferences.enableBlinkFeatures: 'MediaElementVolumeGreaterThanOne'`(Electron 공식 옵션, [4])을 주면 `volume = 2`가 받아지고 읽으면 2다. `createMediaElementSource`로 Web Audio 그래프에 연결한 경우 그래프 안의 최대값이 volume 1일 때 0.8189, 0.5일 때 0.4095, 2일 때 1.6378로 비례해서 커졌다(분석기 표본이라 파일의 실제 최대값 0.944보다 작게 읽힌 것이고, 비율이 의미 있다).
- **[원문 확인]** 그러나 **그래프에 연결하지 않은 직접 재생**에서는 아래 경로가 1.0 초과를 막는다. `WebMediaPlayerImpl::SetVolume`(`web_media_player_impl.cc` 1231-1235행) → `AudioRendererImpl::SetVolume`(`audio_renderer_impl.cc` 901-917행) → `AudioOutputDevice::SetVolume`: `if (volume < 0 || volume > 1.0) return false;`(`audio_output_device.cc` 150-158행). 출력 스트림도 같다: Windows `WASAPIAudioOutputStream::SetVolume`은 1.0 초과를 무시하고(`audio_low_latency_output_win.cc` 758-769행), macOS `AVFoundationOutputStream::SetVolume`은 `std::clamp(volume, 0.0, 1.0)`이다(`avfoundation_output_stream.mm` 221-226행) [5]. 직접 재생 경로에서 실제 출력이 커지는지는 **[확인 못 함]**(출력 신호를 캡처하지 못함).
- 이 플래그는 공식 문서에 설명이 없고 이름만 소스에 있다. Electron을 올릴 때 사라지거나 동작이 바뀔 수 있는지는 **[확인 못 함]**.

## 3. Web Audio `GainNode`로 1.0 초과 증폭

- **[원문 확인]** W3C Web Audio API, GainNode: "Each sample of each channel of the input data of the GainNode MUST be multiplied by the computedValue of the gain AudioParam." `gain`의 `minValue`는 `most-negative-single-float`(약 -3.4028235e38), `maxValue`는 `most-positive-single-float`(약 3.4028235e38), 기본 1, `a-rate` [6].
- **[원문 확인]** AudioBuffer: "linear PCM values with a nominal range of [-1,1] but the values are not limited to this range." 즉 그래프 안에서는 1.0을 넘는 값을 그대로 들고 간다 [6].
- **[원문 확인]** 출력: "The range of all audio signals at a destination node of any audio graph is nominally [-1, 1]. The audio rendition of signal values outside this range, or of the values NaN, positive infinity or negative infinity, is undefined by this specification." (§5.2 Rendering) [6]. 명세는 잘린다고 정하지 않았다. 구현이 정한다.
- **[실험]** `decodeAudioData` → `AudioBufferSourceNode` → `GainNode` → `AnalyserNode`(소리는 `setAudioMuted`로 껐다)에서 `chord-start.wav`의 읽힌 최대값이 게인 1/2/4일 때 0.8189 / 1.6379 / 3.2758. 그래프 안에서는 잘리지 않고 곱해진다.
- **연결 방식 두 가지**(둘 다 같은 `GainNode`):
  - `decodeAudioData` + `AudioBufferSourceNode`: 파일을 통째로 풀어 메모리에 둔다. 이 앱 파일은 최대 60초(등록 한도)다. 이 방식이면 재생 창에 `<audio>` 요소가 없어진다.
  - `createMediaElementSource(<audio>)`: 요소는 그대로 두고 소리만 그래프로 보낸다. 명세상 요소의 `volume`·일시정지·탐색은 그대로 동작한다(§MediaElementAudioSourceNode: "pausing, seeking, volume, src attribute changes ... MUST behave as they normally would"). **[실험]** volume 0.5에서 최대값이 정확히 절반이었다.
- **한계**: 위 두 방식 모두 출력 단계에서 잘린다(§4). 증폭한 만큼 덜 잘리게 하려면 그래프에 별도 처리가 필요하다(§5).

## 4. 출력 단계 클리핑과 내장 음원의 여유

### 4.1 Chromium의 동작

- **[원문 확인]** macOS: `AVFoundationOutputStream`이 `bus.ToInterleavedBytes<Float32SampleTypeTraits>`로 쓴다(`avfoundation_output_stream.mm` 77행). 이 특성 클래스의 변환은 `std::clamp(..., -1.0f, +1.0f)`이고 NaN은 0이 된다. 주석: "Apply clipping (aka. clamping). These values are frequently sent to OS level drivers that may not properly handle these values."(`audio_sample_types.h` 65-71행) [5]. Chromium 156의 `media/audio/mac/` 폴더에는 이 AVFoundation 출력 스트림만 있었다(목록 확인). 어느 경로가 실제로 쓰이는지는 실행 중 확인하지 않았다.
- **[원문 확인]** Windows: `WASAPIAudioOutputStream`은 부동소수점을 클립 없이 쓰고(`Float32SampleTypeTraitsNoClip`) 주석으로 "We skip clipping since that occurs at the shared memory boundary."라 한다(`audio_low_latency_output_win.cc` 1104-1106행) [5]. 공유 메모리 경계에서 클램프하는 구현(`AudioBus::CopyAndClipTo`는 `audio_bus.cc` 358행에 있음)의 호출 지점은 **[확인 못 함]**.
- 어느 쪽이든 **하드 클리핑**(평평하게 잘림)이고 소프트 클리핑이 아니다. 그 뒤 OS 믹서·장치에서 일어나는 일(Windows 공유 모드 엔진, 사운드 카드 후처리)은 **[확인 못 함]**.

### 4.2 내장 음원 12개 측정 [실험]

`ffmpeg volumedetect`·`ebur128`과 `python3 -I`(WAV를 읽어 직접 계산)로 쟀다. "게인 후 잘리는 샘플 %"는 `|x × 게인| > 1.0`인 샘플 비율이다. 한 파일씩 독립된 소리이고 여러 소리가 겹쳐 울리지 않는다(앱은 한 번에 하나만 재생, `bell.ts` 머리 주석).

| 파일 | 샘플 최대값 dBFS | 잘림 없이 줄 수 있는 최대 게인 | LUFS(통합) | ×2 잘림 % | ×3 | ×4 |
| --- | --- | --- | --- | --- | --- | --- |
| westminster-start | -5.54 | ×1.89 (+5.5 dB) | -17.4 | 0.007 | 1.97 | 7.32 |
| westminster-end | -5.39 | ×1.86 (+5.4 dB) | -17.4 | 0.004 | 1.92 | 7.22 |
| five-note-start | -4.45 | ×1.67 (+4.5 dB) | -16.3 | 0.093 | 2.71 | 8.36 |
| five-note-end | -3.82 | ×1.55 (+3.8 dB) | -16.3 | 0.123 | 2.67 | 8.31 |
| four-note-start | -4.22 | ×1.62 (+4.2 dB) | -15.8 | 0.170 | 2.93 | 8.38 |
| four-note-end | -4.06 | ×1.60 (+4.1 dB) | -15.7 | 0.196 | 2.79 | 8.59 |
| tiring-start | -3.58 | ×1.51 (+3.6 dB) | -16.9 | 0.387 | 3.29 | 8.61 |
| tiring-end | -3.53 | ×1.50 (+3.5 dB) | -17.0 | 0.331 | 3.45 | 8.94 |
| arpeggio-start | -1.76 | ×1.23 (+1.8 dB) | -15.3 | 0.630 | 3.82 | 7.76 |
| arpeggio-end | -2.99 | ×1.41 (+3.0 dB) | -15.5 | 0.518 | 3.77 | 7.99 |
| chord-start | -0.50 | ×1.06 (+0.5 dB) | -16.2 | 0.766 | 3.61 | 7.59 |
| chord-end | -1.04 | ×1.13 (+1.0 dB) | -16.2 | 0.712 | 3.60 | 7.57 |

- 12개 모두 평균(RMS) -17.7 dBFS로 같다(`volumedetect` mean_volume -17.7 dB). 소리가 감쇠하는 종이라 최대값은 시작 순간에 나오고 평균은 훨씬 낮다.
- 헤드룸 안에서만 올리면(무왜곡) 올라가는 크기는 +0.5~+5.5 dB다. 가장 흔히 쓸 기본 음원(웨스트민스터)이 가장 여유가 크다.
- 샘플 사이에서 생기는 최대값(true peak)은 측정하지 않았다 **[확인 못 함]**.
- 사용자 등록 음원은 이 표와 무관하고 파일마다 다르다. 이미 최대값 가까이 맞춰진 파일은 헤드룸이 거의 없을 수 있다 **[확인 못 함]**(측정 대상 아님).
- 사용자 음악 앱의 재생 크기는 알 수 없다. 이 앱 종소리의 LUFS(-15.3~-17.4)와 비교할 수 있는 1차 자료의 음악 앱 크기 값을 이번에 확보하지 않았다 **[확인 못 함]**.

## 5. 클리핑을 피하거나 줄이는 방법 [실험 + 명세]

### 5.1 명세가 말하는 것

- **[원문 확인]** `DynamicsCompressorNode`: "It lowers the volume of the loudest parts of the signal and raises the volume of the softest parts." 파라미터는 `threshold`, `knee`(최대 40), `ratio`, `attack`(0~1), `release`이고 기본값은 threshold -24, knee 30, ratio 12, attack 0.003, release 0.25. 특성: "Fixed look-ahead (this means that an DynamicsCompressorNode adds a fixed latency to the signal chain)", 사이드체인 미지원, `makeupGain` 기본 "automatic" [6]. 노드는 tail-time이 있다(look-ahead 지연 때문에 입력이 끝나도 잠시 출력). 명세의 이 노드 절에는 limiter라는 말이 없고, 곡선은 "연속이고 구간별 미분 가능"해야 한다고만 정한다(brickwall 보장 없음).
- **[원문 확인]** `WaveShaperNode`: 입력은 [-1, 1] 범위로 곡선에 매핑되고 "Any sample value less than -1 will correspond to the first value in the curve array. Any sample value greater than +1 will correspond to the last value in the curve array." 곧 게인 뒤에 곡선을 두면 1.0 초과는 곡선 끝 값으로 잘린다. 소프트 클리핑을 하려면 게인을 곡선 앞에서 낮춰서 범위 안으로 넣거나 곡선을 설계해야 한다 [6].
- 사전 정규화(파일의 최대값·RMS·LUFS를 맞춰 새 파일을 만드는 방식)는 명세가 아니라 파일 작업이다. 이 저장소는 이미 내장 음원에 RMS 정규화(`scripts/bell-synth.mts` `levelToTarget`)를 쓰고, 최대값이 `PEAK_CEILING`을 넘으면 빌드를 멈춘다.

### 5.2 Chromium 156에서 측정 [실험]

`OfflineAudioContext`로 12개 파일에 게인 ×2/×3/×4를 걸고 방식별로 렌더해, 출력 클램프 뒤의 평균(RMS)을 쟀다. 원래 -17.72 dBFS. "오차"는 하드 클램프 결과와 이상적으로 곱한 신호의 차이 에너지를 신호 에너지로 나눈 것(dB, 낮을수록 왜곡이 작음). 컴프레서 설정은 예시이고 조정한 값이 아니다.

| 게인 | 이상적 곱셈의 RMS | (A) 하드 클램프 RMS / 오차 | (B) 컴프레서 threshold -12 dB, knee 6, ratio 20, attack 0.001, release 0.1 → 클램프, RMS | (B') 컴프레서 기본값 → 클램프, RMS |
| --- | --- | --- | --- | --- |
| ×2 (+6.0 dB) | -11.7 | -11.7~-11.9 / -22~-60 dB | -10.4~-13.5 | -11.6~-13.6 |
| ×3 (+9.5 dB) | -8.2 | -8.3~-9.1 / -14~-24 dB | -9.7~-12.7 | -9.7~-12.2 |
| ×4 (+12.0 dB) | -5.7 | -6.4~-7.5 / -10~-16 dB | -9.3~-12.1 | -8.7~-11.4 |

(범위는 12개 파일의 최소~최대. westminster가 가장 왜곡이 작고 chord가 가장 크다. 예: ×2에서 westminster-start 오차 -60.5 dB, chord-start -22.6 dB.)

- (A)는 평균 크기가 이상적 값에 가장 가깝게 오르지만 오차가 크다(×4에서 -10~-16 dB).
- (B)는 컴프레서 출력의 최대값이 대부분 1.0 이하로 눌려(×4에서 0.78~1.00) 클램프할 일이 거의 없다. 대신 평균 이득이 하드 클램프보다 작다(×4에서 +5.6~+8.4 dB 대 +10~+11 dB).
- (B')는 컴프레서 기본값이 limiter가 아니라서 출력 최대값이 1.0을 넘는다(×4에서 최대 1.22) → 클램프됨. 기본값 그대로는 잘림을 막지 못한다.
- tanh 웨이브셰이퍼도 렌더했으나 내 곡선의 작은 신호 기울기가 1이 아니라 평균이 다른 방식과 같은 기준이 아니어서 이 표에 싣지 않았다 **[확인 못 함]**(비교 가능한 곡선으로 재측정하지 않음).
- 이 측정은 숫자일 뿐이고 **청감상 왜곡이 들리는지는 평가하지 않았다**. 평균 크기(RMS)가 사람이 느끼는 크기와 같은지도 평가하지 않았다.

## 6. OS 시스템 음량을 앱이 올리는 방법

- **Electron 내장 API 없음 [원문 확인]**: 설치된 `node_modules/electron/electron.d.ts`(45.3.3)에서 `volume`·`duck`·`loudness`로 검색한 결과가 0건이다. 오디오 관련은 `webContents.setAudioMuted`, `isAudioMuted`, `isCurrentlyAudible`, `audio-state-changed`뿐이다(`electron.d.ts` 19497·21376행, docs/api/web-contents [7]). 따라서 방법은 아래처럼 OS 도구를 직접 부르는 것이다.
- **macOS, AppleScript**: 로컬 `sdef /System/Library/ScriptingAdditions/StandardAdditions.osax`: `set volume`은 `output volume`(0~100 정수), `input volume`, `alert volume`, `output muted`를 받는다("Set the sound output and/or input volume") [8]. 메인 프로세스에서 `child_process`로 `osascript`를 부르는 방식이 가능하다(실행해 보지 않았다). 권한 대화상자가 뜨는지, 일부 출력 장치(HDMI·DisplayPort 등)에서 동작하는지는 **[확인 못 함]**.
- **macOS, CoreAudio**: SDK 헤더에 `kAudioDevicePropertyVolumeScalar`(`AudioHardware.h`)와 `kAudioHardwareServiceDeviceProperty_VirtualMainVolume`(`AudioHardwareService.h`, "vmvc")이 있다 [8]. 네이티브 코드(Node 애드온 등)가 필요하다. 장치별로 볼륨 속성 지원 여부가 달라지는지는 **[확인 못 함]**.
- **Windows, Core Audio**: `IAudioEndpointVolume::SetMasterVolumeLevelScalar`(0.0~1.0). Microsoft는 이 인터페이스를 "In rare cases, a specialized audio application might require ..."라 하며 "A client of IAudioEndpointVolume must take care to avoid the potentially disruptive effects on other audio applications of altering the master volume levels ... Typically, the user has exclusive control over the master volume levels through the Windows volume-control program, Sndvol.exe."라고 경고한다. 하드웨어 볼륨이 없는 장치에서는 엔진이 소프트웨어 볼륨을 적용하되 전용(exclusive) 모드에는 반영되지 않는다 [9]. 이 호출도 COM이므로 Electron에서 쓰려면 네이티브 애드온이나 외부 실행 파일이 필요하다.
- **부작용(문서에서 확인된 것)**: 마스터 볼륨은 사용자가 직접 관리하는 값이고, 변경은 모든 앱에 영향을 준다(위 Microsoft 문구). 앱이 올린 뒤 되돌리지 않고 종료하거나 죽으면 올라간 채로 남는다(되돌림 보장 방법은 문서에 없음). 이 앱은 트레이에 상주하고 종이 울릴 때마다 호출하게 된다. 사용자 몰래 시스템 음량을 바꾸는 것이 허용되는 UX인지는 이 조사 범위 밖이다.
- OS 마스터 음량은 장치의 최대(100%)가 상한이다. 이미 100%인 환경에서는 효과가 없다. 사용자 PC의 현재 음량은 **[확인 못 함]**.

## 7. 다른 앱 소리에 묻히는 문제 자체: 덕킹

### Windows

- **[원문 확인]** 기본 덕킹은 통신 세션에 반응한다: "Depending on the options specified by the user in the Sounds control panel, the operating system automatically provides this functionality through ducking or stream attenuation". 기본 감쇠는 사용자 설정(기본 80%, 끄기·음소거도 선택 가능)이고, 앱이 따로 하려면 덕킹 이벤트를 받아 직접 처리할 수 있다(그러면 기본 동작이 꺼진다) [10].
- **[원문 확인]** `AUDIO_STREAM_CATEGORY`: `AudioCategory_Communications` = "Real-time communications, such as VOIP or chat." `AudioCategory_GameChat` = "Similar to AudioCategory_Communications except that AudioCategory_GameChat will not attenuate other streams." 즉 통신 범주 스트림은 다른 스트림을 감쇠시키는 범주다 [11]. 이 범주는 Windows 8 이상이다. 종소리를 통신 범주로 열면 그 덕킹이 일어난다고 문서는 암시하지만, 사용자가 덕킹을 끈 PC에서는 동작하지 않는다.
- **[원문 확인]** Chromium 156의 Windows 출력(`audio_low_latency_output_win.cc`)에서 `eConsole/eMultimedia/eCommunications`는 **장치 역할**을 고르는 코드이고(67-71행, 406행), 파일 안에 스트림 범주(`AudioCategory_*`)·`SetClientProperties`·`ducking` 문자열은 없었다. 즉 Electron의 `<audio>`·Web Audio는 통신 범주로 열리지 않는다. 다른 Chromium 파일에서 설정하는지는 **[확인 못 함]**.
- **[원문 확인]** 세션 볼륨: `ISimpleAudioVolume`은 "control the master volume level of an audio session"이고, 기존 세션의 인터페이스를 세션 GUID로 얻을 수 있다. 문서는 Sndvol이 세션 마스터 볼륨을 바꾸고 "Subsequent volume changes by Sndvol or other clients are persistent across computer restarts."라고 한다 [12]. 다른 앱 세션 목록을 열거하는 API(`IAudioSessionManager2`) 문서는 열지 못했다 **[확인 못 함]**. 쓸 수 있다고 해도 네이티브 코드가 필요하고, 낮춘 값을 되돌리기 전에 앱이 죽으면 낮은 채로 남는 위험이 문서의 지속성 문구에서 읽힌다.

### macOS

- **[원문 확인]** `AVAudioSession`은 macOS에서 사용할 수 없다: `AVAudioSession.h` 31행 `API_UNAVAILABLE(macos)`, 주요 메서드 모두 `API_UNAVAILABLE(macos)` [8]. iOS식 "다른 오디오 낮추기 카테고리"(`kAudioSessionProperty_OtherMixableAudioShouldDuck`, `AudioSession.h` 423·571행)는 AudioSession 계열이고 macOS 사용 가능 여부는 이번에 확인하지 않았다 **[확인 못 함]**.
- **[원문 확인]** macOS에서 SDK 헤더에 보이는 덕킹은 음성 처리 쪽이다: `AVAudioInputNode.voiceProcessingOtherAudioDuckingConfiguration`(`API_AVAILABLE(macos(14.0))`, `AVAudioIONode.h` 259-267행)은 "ducking of other (i.e. non-voice) audio"를 설정한다. 이는 음성 처리를 켠 입력 노드(`setVoiceProcessingEnabled:`, macOS 10.15+)가 전제이고, 다른 앱의 소리까지 낮추는지, 마이크 권한이 필요한지는 헤더 주석에 없다 **[확인 못 함]**. 네이티브 코드가 필요하다.
- 위 외에 AVFAudio·AudioToolbox·CoreAudio·AudioUnit·AVFoundation·MediaPlayer 헤더에서 `duck`로 찾은 것은 위 두 가지(AudioSession.h, AudioUnitProperties.h의 `AUVoiceIO` 덕킹 수준)뿐이었다. 즉 **다른 앱을 일시적으로 낮추는 일반 공개 API는 이번 검색에서 찾지 못했다**("없다"는 단정이 아니라 헤더 검색 결과다).

### Electron 쪽

- **[원문 확인]** Electron 45.3.3 `electron.d.ts`에 덕킹·음량 API 없음(§6). 접근 수단은 네이티브 애드온(Electron 문서의 [native code 튜토리얼 목록](https://github.com/electron/electron/tree/v45.3.3/docs/tutorial)에 `using-native-node-modules.md`, `native-code-and-electron*.md`가 있음)이나 별도 실행 파일뿐이다. 이 저장소 `package.json`·`node_modules` 최상위에서 `node-addon-api`·`bindings`·`ffi`·`koffi` 계열 이름은 찾지 못했다(하위 의존성까지는 보지 않음).
- 요약: **다른 앱을 낮추는 길은 Windows의 통신 범주 스트림·세션 볼륨, macOS의 음성 처리 설정뿐인데 모두 Electron 단독으로는 닿지 않고, 이 앱이 쓰는 오디오 경로로는 설정할 수 없다.**

## 8. 바꿔야 할 곳(코드는 건드리지 않음)

음량이 "0~100 정수 = 원본 진폭의 0~100%"라는 계약으로 퍼져 있다. 100% 초과를 허용한다면 아래가 영향을 받는다.

| 위치 | 현재 | 영향 |
| --- | --- | --- |
| `src/shared/data.ts:64, 69` | `soundVolumes: 0~100`, `masterVolume: 0~100` 주석, 기본 100 | 범위·의미 주석, 기본값 |
| `src/shared/sound-ops.ts:24-26, 91-98` | `clampVolume`이 0~100 정수로 보정 | 상한(예: 200)을 바꿔야 함. `sound-ops.test.ts:68-73`이 130→100을 단언 |
| `src/main/bridge.ts:73-77, 124-126` | `isVolume`: 0 이상 100 이하인 유한한 수 | 검증 상한 |
| `src/main/data-format.ts:63, 88` | `isIntIn(..., 0, 100)`: 범위 밖이면 파일 전체가 "형태에 안 맞음" | 상한. 아래 호환 쟁점 |
| `src/main/bell-sound.ts:12, 44` | 결과 `volume`은 "0~1", 곱해서 `/ 10_000` | 1.0 초과 값을 낼 수 있는 계산·타입 주석, `bell-sound.test.ts` |
| `src/shared/bell-player.ts:11` | `PlayRequest.volume`은 "0~1" | 계약 주석 |
| `src/renderer/src/bell.ts:31` | `audio.volume = clamp(0..1)` | 재생 방식을 바꾸는 지점. 1.0 초과 게인은 여기서 `GainNode`로 가야 함 |
| `src/renderer/src/Slider.tsx:20` | `max = 100`, `valueText` "50%" | 슬라이더 최대, `BellScreen.tsx:113-120, 182-190`에서 `max` 안 넘김 |
| `DESIGN.md:118` | 종 화면 슬라이더 설명 | 문서 계약. 슬라이더 모양(100% 초과 표시)은 DESIGN.md를 먼저 확인해야 함 |
| `e2e/bell-screen.spec.ts:93-94, 255-303`, `e2e/bell-playback.spec.ts:34, 128` | 재생 창의 `document.querySelector('audio').volume`을 읽어 0.4·0.5·0.25 등을 단언 | **재생을 `AudioBufferSourceNode`로 옮기면 `<audio>`가 사라져 이 테스트의 읽는 방식이 깨진다.** `createMediaElementSource` 방식이면 `<audio>`는 남지만 `volume` 값은 게인과 나뉘어 의미가 달라진다 |
| `e2e/timetable.spec.ts:169, 200`, `e2e/app-shell.spec.ts:100-103`, `src/main/storage.test.ts:44-47`, `data-format.test.ts:48-51` | 저장 형태 단언 | 새 범위·기본값 반영 |
| `scripts/bell-synth.mts:163-166`, `bell-synth.test.mts:52-61` | 내장 음원 생성 시 RMS 0.13, 최대값 0.95 | 내장 음원을 더 크게 다시 만들면 여기와 `resources/sounds/builtin/*.wav` 12개가 바뀜. 헤드룸 한도(§4.2)가 상한 |

### 기존 저장 데이터와의 호환

- **[원문 확인]** 기존 값에서 100은 "원본 진폭"이다(`bell-sound.ts:44`, `emptyData`의 `masterVolume: 100`, `soundVolumes`가 없으면 100). 범위만 늘리고(예: 0~200, 100 = 원본 그대로) 의미를 유지하면 기존 데이터는 그대로 같은 소리를 낸다. 반대로 "100%일 때 게인을 N배로 올린다"처럼 기준을 옮기면 같은 저장값이 이전보다 큰 소리가 되어 기존 사용자 소리가 말없이 바뀐다.
- **[원문 확인]** 새 버전이 100 초과를 저장한 뒤 이전 버전이 읽으면 `data-format.ts:63, 88`이 거부해 파일이 형태에 안 맞는 것으로 처리된다. 저장소는 본 파일 → 예비본(`data.backup.json`) 순으로 읽고 둘 다 실패하면 본 파일을 `data.corrupt.json`으로 격리하고 빈 데이터로 시작한다(`src/main/storage.ts:108-123`). 앱이 아는 것보다 높은 `version`도 같은 취급이다(같은 파일 56-59행). 즉 이전 버전으로 되돌리면(수동 설치) 시간표 등 전체 데이터가 보이지 않게 된다. 현재 `Data.version`은 2이고 마이그레이션은 낮은 버전을 올리는 방향만 있다.

## 9. 확인하지 못한 것

| 항목 | 이유 |
| --- | --- |
| 실제 스피커 출력의 왜곡·크기 | 오디오 출력을 캡처하지 못했다. 그래프 안의 값과 소스의 클램프 코드만 확인했다. 청감 평가는 하지 않았다 |
| 직접 재생(`<audio>` 그래프 미연결)에서 `MediaElementVolumeGreaterThanOne`로 실제 출력이 커지는지 | 출력 캡처 불가. 소스상 하위 단계(`AudioOutputDevice`, WASAPI/AVFoundation 스트림)가 1.0 초과를 막는다 |
| `MediaElementVolumeGreaterThanOne` 플래그의 도입 목적·안정성 | json5에 이름만 있고 설명·상태가 없다. 커밋 이력은 보지 않았다 |
| Windows에서 공유 메모리 경계 클램프의 호출 지점, 장치·OS 믹서 후단 동작 | 해당 파일을 열지 못했다 |
| `AudioRendererMixerInput`(미디어 요소 오디오를 믹서에 연결하는 경로)의 볼륨 처리 | `media/base/audio_renderer_mixer_input.cc` 경로가 156 태그에서 404였고 다른 위치를 찾지 못했다 |
| macOS `osascript set volume`의 권한·장치별 동작, CoreAudio 볼륨 속성의 장치별 지원 | 실행하지 않았다(사용자 시스템 음량을 바꾸지 않으려고) |
| Windows 다른 앱 세션 열거·조정(`IAudioSessionManager2`) | 문서를 열지 못했다 |
| macOS 다른 앱 덕킹 가능 여부(AUVoiceIO 덕킹이 다른 앱에 미치는 범위, `AudioSession.h`의 macOS 가용성) | 헤더 주석에 범위 설명이 없거나 가용성을 확인하지 않았다 |
| 사용자 등록 음원의 레벨·헤드룸 | 파일마다 다름. 측정 대상 아님 |
| 사용자의 PC 음량, 유튜브·음악 앱의 크기 | 알 수 없음. 음악 앱 레벨 1차 자료도 확보하지 않았다 |
| 소프트 클리퍼(tanh 곡선)와 룩어헤드 리미터의 비교 가능한 측정 | 곡선 기울기를 1로 맞춘 재측정을 하지 않았다 |
| true peak(샘플 사이 최대값) | 측정하지 않았다 |
| 미디어 키로 다른 앱을 일시정지하는 방법(Electron `globalShortcut` 등으로 보내기) | 이번 질문 범위 밖이라 조사하지 않았다 |

실험 스크립트(저장소 밖, 재현용): `/private/tmp/claude-501/-Users-wraith-workspace-personal-ding-dong-dang/dc8360e0-6c3f-44c9-98ee-f3eceb99fc4a/scratchpad/exp/main.js`(볼륨·게인 동작), `.../exp/chain.js`(오프라인 렌더 비교, 결과 `.../exp/chain.json`), `.../sim/sim.py`(잘림 비율). 내려받은 명세·소스 사본은 `.../dl/`에 있다.

## 근거

[1] WHATWG HTML Standard, media element — https://html.spec.whatwg.org/multipage/media.html#dom-media-volume ("A media element has a playback volume ...", `volume` setter steps)
[2] Chromium 156.0.8078.100 `HTMLMediaElement::setVolume` — https://chromium.googlesource.com/chromium/src/+/refs/tags/156.0.8078.100/third_party/blink/renderer/core/html/media/html_media_element.cc (3381-3406행)
[3] Chromium 156.0.8078.100 `MediaElementVolumeGreaterThanOne` — https://chromium.googlesource.com/chromium/src/+/refs/tags/156.0.8078.100/third_party/blink/renderer/platform/runtime_enabled_features.json5 (4203-4205행)
[4] Electron 45.3.3 webPreferences `enableBlinkFeatures` — https://github.com/electron/electron/blob/v45.3.3/docs/api/structures/web-preferences.md (62-66행), `autoplayPolicy` 138-141행
[5] Chromium 156.0.8078.100 오디오 출력 — https://chromium.googlesource.com/chromium/src/+/refs/tags/156.0.8078.100/ 아래: `third_party/blink/renderer/platform/media/web_media_player_impl.cc`(1231-1235행), `media/renderers/audio_renderer_impl.cc`(901-917행), `media/audio/audio_output_device.cc`(150-158행), `media/audio/win/audio_low_latency_output_win.cc`(67-71, 406, 758-769, 1104-1106행), `media/audio/mac/avfoundation_output_stream.mm`(77, 221-226행), `media/base/audio_sample_types.h`(65-71행), `media/base/audio_bus.cc`(358행)
[6] W3C Web Audio API — https://webaudio.github.io/web-audio-api/ (§1.4 AudioBuffer, §1.20 GainNode, §1.19 DynamicsCompressorNode, WaveShaperNode의 `curve`, MediaElementAudioSourceNode, §5.2 Rendering)
[7] Electron 45.3.3 — https://github.com/electron/electron/blob/v45.3.3/docs/api/web-contents.md (`setAudioMuted`, `isAudioMuted`, `isCurrentlyAudible`, `audio-state-changed`) 및 설치본 `node_modules/electron/electron.d.ts`
[8] Apple(로컬 SDK·시스템 파일) — `sdef /System/Library/ScriptingAdditions/StandardAdditions.osax`의 `set volume` 정의(592-599행), `/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk/System/Library/Frameworks/` 아래 `AVFAudio.framework/Headers/AVAudioSession.h`(31행 등 `API_UNAVAILABLE(macos)`), `AVAudioIONode.h`(67-93, 259-267행), `AudioToolbox.framework/Headers/AudioHardwareService.h`(49-71행), `AudioSession.h`(423, 571행), `AudioUnitProperties.h`(2683-2700행), `CoreAudio.framework/Headers/AudioHardware.h`(1299행)
[9] Microsoft Learn, IAudioEndpointVolume — https://learn.microsoft.com/en-us/windows/win32/api/endpointvolume/nn-endpointvolume-iaudioendpointvolume
[10] Microsoft Learn, Default Ducking Experience — https://learn.microsoft.com/en-us/windows/win32/coreaudio/stream-attenuation , Providing a Custom Ducking Behavior — https://learn.microsoft.com/en-us/windows/win32/coreaudio/providing-a-custom-ducking-experience
[11] Microsoft Learn, AUDIO_STREAM_CATEGORY — https://learn.microsoft.com/en-us/windows/win32/api/audiosessiontypes/ne-audiosessiontypes-audio_stream_category
[12] Microsoft Learn, ISimpleAudioVolume — https://learn.microsoft.com/en-us/windows/win32/api/audioclient/nn-audioclient-isimpleaudiovolume
