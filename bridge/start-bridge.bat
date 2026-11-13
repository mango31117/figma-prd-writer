@echo off
cd /d "%~dp0"
echo Starting WorkBuddy -^> Figma PRD bridge on http://localhost:9876
echo Keep this window open while the Figma plugin panel is open.
echo.
node server.js
pause
