' Stops a running Storyroom instance without a console window.
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
shell.Run """" & root & "\node\node.exe"" """ & root & "\stop.js""", 0, True
