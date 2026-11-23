!macro customUnInstall
  ${if} ${FileExists} "$INSTDIR\data\*.*"
    CreateDirectory "$APPDATA\FDShowStudio\data_backup"
    CopyFiles /SILENT "$INSTDIR\data\*.*" "$APPDATA\FDShowStudio\data_backup"
  ${endif}
!macroend

!macro customInstall
  ${if} ${FileExists} "$APPDATA\FDShowStudio\data_backup\*.*"
    CreateDirectory "$INSTDIR\data"
    CopyFiles /SILENT "$APPDATA\FDShowStudio\data_backup\*.*" "$INSTDIR\data"
  ${endif}
!macroend
