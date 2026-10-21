@echo off
rem spec.jev on Windows: the same launcher as mu.cmd, under the project's current name.
call "%~dp0mu.cmd" %*
exit /b %errorlevel%
