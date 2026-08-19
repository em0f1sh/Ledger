@echo off
rem 记账本启动器：双击本文件即可打开应用（绿色便携，整个文件夹拷走可用）
cd /d "%~dp0"
start "" "node_modules\electron\dist\electron.exe" .