!ifndef BUILD_UNINSTALLER

Var InstallerProgress
Var InstallerLogoAnimation

; DPI-aware so Windows does not bitmap-stretch (blur) the window. We scale the
; window + controls to the real DPI, feed a 2x (800x600) bitmap that
; SS_REALSIZECONTROL downscales crisply, and play a white-background AVI (crisp
; 1:1 because the process is DPI-aware) over the logo card.
!macro customHeader
  ManifestDPIAware true
!macroend

; Scale a logical (96-dpi) value to physical pixels. $8 holds the current DPI.
!macro Scale outVar base
  IntOp ${outVar} $8 * ${base}
  IntOp ${outVar} ${outVar} / 96
!macroend

!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

!macro customPageAfterChangeDir
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW onInstFilesShow
  !define MUI_PAGE_CUSTOMFUNCTION_LEAVE onInstFilesLeave
!macroend

Function onInstFilesShow
  SetAutoClose true

  ; --- Read system DPI (LOGPIXELSX = 88); keep it in $8 for Scale ---
  System::Call 'user32::GetDC(i 0) i .r9'
  System::Call 'gdi32::GetDeviceCaps(i r9, i 88) i .r8'
  System::Call 'user32::ReleaseDC(i 0, i r9)'
  IntCmp $8 1 +2 0 +2
    StrCpy $8 96

  !insertmacro Scale $R0 400   ; window width  (physical)
  !insertmacro Scale $R1 300   ; window height (physical)

  ; --- Frameless parent ---
  System::Call 'user32::GetWindowLong(i $HWNDPARENT, i -16) i.r0'
  IntOp $0 $0 & 0xFF3BFFFF
  System::Call 'user32::SetWindowLong(i $HWNDPARENT, i -16, i $0)'

  ; --- Center at scaled size ---
  System::Call 'user32::GetSystemMetrics(i 0) i .r1'
  System::Call 'user32::GetSystemMetrics(i 1) i .r2'
  IntOp $R2 $1 - $R0
  IntOp $R2 $R2 / 2
  IntOp $R3 $2 - $R1
  IntOp $R3 $R3 / 2
  System::Call 'user32::SetWindowPos(i $HWNDPARENT, i 0, i $R2, i $R3, i $R0, i $R1, i 0x0040)'
  SetCtlColors $HWNDPARENT "" 0x1E3A8A

  ; --- Hide all parent controls ---
  GetDlgItem $1 $HWNDPARENT 1
  ShowWindow $1 0
  GetDlgItem $1 $HWNDPARENT 2
  ShowWindow $1 0
  GetDlgItem $1 $HWNDPARENT 3
  ShowWindow $1 0
  GetDlgItem $1 $HWNDPARENT 1034
  ShowWindow $1 0
  GetDlgItem $1 $HWNDPARENT 1035
  ShowWindow $1 0
  GetDlgItem $1 $HWNDPARENT 1036
  ShowWindow $1 0
  GetDlgItem $1 $HWNDPARENT 1037
  ShowWindow $1 0
  GetDlgItem $1 $HWNDPARENT 1038
  ShowWindow $1 0
  GetDlgItem $1 $HWNDPARENT 1039
  ShowWindow $1 0
  GetDlgItem $1 $HWNDPARENT 1045
  ShowWindow $1 0
  GetDlgItem $1 $HWNDPARENT 1256
  ShowWindow $1 0

  ; --- Inner dialog fills the window ---
  FindWindow $0 "#32770" "" $HWNDPARENT
  System::Call 'user32::SetWindowPos(i $0, i 0, i 0, i 0, i $R0, i $R1, i 0x0040)'
  SetCtlColors $0 "" 0x1E3A8A
  GetDlgItem $1 $0 1016
  ShowWindow $1 0
  GetDlgItem $1 $0 1006
  ShowWindow $1 0

  InitPluginsDir
  File "/oname=$PLUGINSDIR\splash.bmp" "${BUILD_RESOURCES_DIR}\splash.bmp"
  File "/oname=$PLUGINSDIR\installer-logo.avi" "${BUILD_RESOURCES_DIR}\installer-logo.avi"

  ; --- Splash: downscale the 800x600 source to the physical window size with
  ; StretchBlt HALFTONE (high quality — crisp text), then show it 1:1 in a plain
  ; SS_BITMAP static created bottom-most. SS_REALSIZECONTROL was avoided because
  ; it scales with COLORONCOLOR, which makes text look rough. ---
  System::Call 'user32::LoadImage(i 0, t "$PLUGINSDIR\splash.bmp", i 0, i 0, i 0, i 0x0010) i.r5' ; hSrc (800x600)
  System::Call 'user32::GetDC(i 0) i.r6'                          ; screen DC
  System::Call 'gdi32::CreateCompatibleDC(i r6) i.r7'             ; src DC
  System::Call 'gdi32::SelectObject(i r7, i r5) i.r9'             ; old src obj
  System::Call 'gdi32::CreateCompatibleBitmap(i r6, i $R0, i $R1) i.r2' ; dst bitmap (W x H)
  System::Call 'gdi32::CreateCompatibleDC(i r6) i.r3'             ; dst DC
  System::Call 'gdi32::SelectObject(i r3, i r2) i.r4'             ; old dst obj
  System::Call 'gdi32::SetStretchBltMode(i r3, i 4)'             ; HALFTONE
  System::Call 'gdi32::StretchBlt(i r3, i 0, i 0, i $R0, i $R1, i r7, i 0, i 0, i 800, i 600, i 0x00CC0020)' ; SRCCOPY
  System::Call 'gdi32::SelectObject(i r3, i r4)'
  System::Call 'gdi32::SelectObject(i r7, i r9)'
  System::Call 'gdi32::DeleteDC(i r3)'
  System::Call 'gdi32::DeleteDC(i r7)'
  System::Call 'gdi32::DeleteObject(i r5)'
  System::Call 'user32::ReleaseDC(i 0, i r6)'
  System::Call 'user32::CreateWindowEx(i 0, t "STATIC", t "", i 0x5000000E, i 0, i 0, i $R0, i $R1, i $0, i 0, i 0, i 0) i.r1' ; SS_BITMAP
  SendMessage $1 0x0172 0 $2 ; STM_SETIMAGE (static shows the halftone-scaled bitmap)
  System::Call 'user32::SetWindowPos(i $1, i 1, i 0, i 0, i 0, i 0, i 0x0013)' ; HWND_BOTTOM

  ; --- AVI logo animation centered on the white card (native 88px, crisp) ---
  !insertmacro Scale $R4 200   ; card centre X (physical)
  !insertmacro Scale $R5 91    ; card centre Y (physical)
  IntOp $R4 $R4 - 44
  IntOp $R5 $R5 - 44
  System::Call 'user32::CreateWindowEx(i 0, t "SysAnimate32", t "", i 0x50000004, i $R4, i $R5, i 88, i 88, i $0, i 0, i 0, i 0) i.r4'
  StrCpy $InstallerLogoAnimation $4
  SendMessage $4 0x0467 0 "STR:$PLUGINSDIR\installer-logo.avi" ; ACM_OPENW
  SendMessage $4 0x0465 -1 -1                                  ; ACM_PLAY

  ; --- Progress bar (1004), scaled + green fill ---
  GetDlgItem $3 $0 1004
  StrCpy $InstallerProgress $3
  !insertmacro Scale $R2 40    ; x
  !insertmacro Scale $R3 240   ; y
  !insertmacro Scale $R6 320   ; w
  !insertmacro Scale $R7 8     ; h
  System::Call 'user32::SetWindowPos(i $3, i 0, i $R2, i $R3, i $R6, i $R7, i 0x0040)'
  ShowWindow $3 1
  System::Call 'uxtheme::SetWindowTheme(i $3, t " ", t " ")'
  System::Call 'user32::GetWindowLong(i $3, i -16) i.r2'
  IntOp $2 $2 & 0xFFFFFFF7
  System::Call 'user32::SetWindowLong(i $3, i -16, i $2)'
  ; PBM_SETBKCOLOR: track = blue-900 #1e3a8a -> BGR 0x8A3A1E
  SendMessage $3 0x2001 0 0x8A3A1E
  ; PBM_SETBARCOLOR: fill = green-500 #22c55e (checked-in) -> BGR 0x5EC522
  SendMessage $3 0x0409 0 0x5EC522
FunctionEnd

Function onInstFilesLeave
  SendMessage $InstallerLogoAnimation 0x0466 0 0 ; ACM_STOP
  Exec '"$INSTDIR\KruDee Timestamp.exe"'
  Quit
FunctionEnd

!endif ; BUILD_UNINSTALLER

!macro customInstall
  CreateDirectory "$SMPROGRAMS\KruDee Timestamp"
  CreateShortCut "$SMPROGRAMS\KruDee Timestamp\KruDee Timestamp.lnk" "$INSTDIR\KruDee Timestamp.exe" "" "$INSTDIR\KruDee Timestamp.exe" 0
  CreateShortCut "$DESKTOP\KruDee Timestamp.lnk" "$INSTDIR\KruDee Timestamp.exe" "" "$INSTDIR\KruDee Timestamp.exe" 0
!macroend

!macro customUnInstall
  RMDir /r "$LOCALAPPDATA\krudee-timestamp-updater"
  RMDir /r "$APPDATA\KruDee Timestamp"
!macroend
