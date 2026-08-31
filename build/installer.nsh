; Custom NSIS for the uninstaller. The installer itself is untouched and stays one-click.
;
; Removing the app used to leave everything it had done behind: the mods still sitting in the
; game's language folder, the app's folder with its settings, caches and downloaded toolchain,
; and - if safe mode had been turned off - the game's own gameinfo_branchspecific.gi and
; dota.signatures still carrying our edit, with the one program that knows how to put them
; back being the one now deleted.
;
; None of that can be worked out from here: which files in the game folder are ours is in a
; manifest, and undoing the patch means restoring backups and checking them against Valve's
; own hash list. So the uninstaller asks the app. It runs it once with --uninstall, which puts
; up a window with the questions, does what was ticked, and answers with its exit code:
;
;   3  the person changed their mind - nothing at all is removed
;   4  done, and the app's own folder should go too
;   *  done (or never ran) - carry on with the plain uninstall
;
; The app deliberately does not delete its own folder: it is running out of it, with its log
; and Chromium's caches open, so it would leave a scatter of locked files. Down here it is a
; second later and nothing holds them.
;
; Anything unexpected - the exe missing, a crash, a machine where it will not start - carries
; on with the uninstall. Somebody removing a program that is already broken must not be
; stopped by the broken program.

; The same script is compiled twice, once for the installer and once for the uninstaller, and
; only the second pass inserts the macros below. Declaring the variable in both makes NSIS
; warn that it is never referenced, and electron-builder turns warnings into errors.
!ifdef BUILD_UNINSTALLER
  Var d2mmWipeData
!endif

!macro customUnInit
  StrCpy $d2mmWipeData "0"

  ; An update is an uninstall too, and it must ask nothing and remove nothing.
  ;
  ; electron-builder replaces a version by running the OLD uninstaller first:
  ;
  ;   old-uninstaller.exe /S /KEEP_APP_DATA --updated _?=<dir>
  ;
  ; (app-builder-lib/templates/nsis/include/installUtil.nsh, uninstallOldVersion). This macro
  ; runs in un.onInit for every uninstall, update included, and without this guard a routine
  ; update put the removal window on screen mid-install - with the boxes ticked. People
  ; updating were being asked whether to delete their mods.
  ;
  ; ${Silent} cannot be the test: the one-click uninstaller turns silent mode on itself right
  ; after the person confirms, so by the time this runs it is on either way. The flags above
  ; are what tell the two apart, and --updated is the one that means it.
  ; /S is in the list on its own account: it means "no interface", and a window asking
  ; questions is an interface. It also arrives with every update. Windows' own uninstall entry
  ; passes no arguments at all, which is exactly when the questions should be asked.
  ClearErrors
  ${GetParameters} $R8
  ${GetOptions} $R8 "--updated" $R9
  ${IfNot} ${Errors}
    Goto d2mmNothingToAsk
  ${EndIf}
  ClearErrors
  ${GetOptions} $R8 "/KEEP_APP_DATA" $R9
  ${IfNot} ${Errors}
    Goto d2mmNothingToAsk
  ${EndIf}
  ClearErrors
  ${GetOptions} $R8 "/S" $R9
  ${IfNot} ${Errors}
    Goto d2mmNothingToAsk
  ${EndIf}
  ClearErrors

  IfFileExists "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 d2mmNothingToAsk
    ExecWait '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --uninstall' $0
    ${If} $0 == 3
      Quit
    ${EndIf}
    ${If} $0 == 4
      StrCpy $d2mmWipeData "1"
    ${EndIf}
  d2mmNothingToAsk:
!macroend

!macro customUnInstall
  ${If} $d2mmWipeData == "1"
    ; the same folders electron-builder's own deleteAppDataOnUninstall clears, and for the
    ; same reason: Electron writes under the product name and caches under the package name
    RMDir /r "$APPDATA\${APP_PACKAGE_NAME}"
    !ifdef APP_PRODUCT_FILENAME
      RMDir /r "$APPDATA\${APP_PRODUCT_FILENAME}"
    !endif
  ${EndIf}
!macroend
