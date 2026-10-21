# spec.jev from PowerShell, without cmd.exe in between: the same launcher as mu.ps1, under the project's
# current name. mu.ps1 passes the arguments on exactly as they were written, which cmd.exe does not.
& "$PSScriptRoot\mu.ps1" @args
exit $LASTEXITCODE
