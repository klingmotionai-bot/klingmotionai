Dim fso, shell, scriptDir, batPath
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
batPath = scriptDir & "\run-all.bat"
If Not fso.FileExists(batPath) Then
  MsgBox "run-all.bat not found.", 48, "Error"
  WScript.Quit 1
End If
shell.CurrentDirectory = scriptDir
shell.Run Chr(34) & batPath & Chr(34), 1, False
