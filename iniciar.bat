@echo off
cd /d "%~dp0"
set LOCAL_MODE=1
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe app.py
pause
