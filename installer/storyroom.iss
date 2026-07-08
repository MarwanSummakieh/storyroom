; Storyroom Windows installer (Inno Setup 6).
; Built by installer\build-installer.ps1, which assembles installer\stage first.
; Installs per-user (no admin prompt) to %LOCALAPPDATA%\Programs\Storyroom.
; User data lives in %LOCALAPPDATA%\Storyroom and survives uninstall.

[Setup]
AppId={{8F4A6C7E-2B3D-4E1F-9A5C-D6E7F8091A2B}
AppName=Storyroom
AppVersion=0.1.0
AppPublisher=Storyroom
DefaultDirName={autopf}\Storyroom
PrivilegesRequired=lowest
DisableProgramGroupPage=yes
OutputDir=dist
OutputBaseFilename=StoryroomSetup
SetupIconFile=stage\storyroom.ico
UninstallDisplayIcon={app}\storyroom.ico
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional icons:"

[Files]
Source: "stage\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion

[Icons]
Name: "{autoprograms}\Storyroom"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\start-storyroom.vbs"""; IconFilename: "{app}\storyroom.ico"; Comment: "Start Storyroom and open it in your browser"
Name: "{autoprograms}\Stop Storyroom"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\stop-storyroom.vbs"""; IconFilename: "{app}\storyroom.ico"; Comment: "Stop the Storyroom background servers"
Name: "{autodesktop}\Storyroom"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\start-storyroom.vbs"""; IconFilename: "{app}\storyroom.ico"; Tasks: desktopicon

[Run]
Filename: "{sys}\wscript.exe"; Parameters: """{app}\start-storyroom.vbs"""; Description: "Launch Storyroom"; Flags: postinstall nowait skipifsilent

[UninstallRun]
; Stop the servers before removing files so nothing is locked.
Filename: "{sys}\wscript.exe"; Parameters: """{app}\stop-storyroom.vbs"""; RunOnceId: "StopStoryroom"
