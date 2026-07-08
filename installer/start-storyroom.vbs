' Starts Storyroom without a console window.
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
shell.Run """" & root & "\node\node.exe"" """ & root & "\launcher.js""", 0, False
