!macro customUnInstall
  MessageBox MB_YESNO "Do you want to keep your KeyHive app data (settings and vault data)?$\n$\nSelect 'Yes' to keep your data.$\nSelect 'No' to permanently delete all locally saved data." /SD IDYES IDYES keepData

  ; User clicked No — delete data
  ; Switch to current user context so $APPDATA resolves correctly (not admin's)
  SetShellVarContext current
  RMDir /r "$APPDATA\${APP_FILENAME}"
  RMDir /r "$LOCALAPPDATA\${APP_FILENAME}"
  SetShellVarContext all
  Goto done

  keepData:
    ; User clicked Yes — keep data intact

  done:
!macroend
