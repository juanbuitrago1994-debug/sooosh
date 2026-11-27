#!/usr/bin/env bash
# Regla de Juan (27-nov-2026): las pruebas en navegador se hacen SOLO con Safari/WebKit; JAMÁS con Chrome o Chromium.
# Este guardia se ejecuta antes de cada herramienta de Playwright (hook PreToolUse de .claude/settings.json) y la BLOQUEA si el servidor de Playwright
# que está corriendo no se inició con `--browser webkit` (un servidor viejo, iniciado antes de configurar WebKit, abre Chrome por defecto).
procs=$(ps -eo command | grep -E "playwright(/|-)mcp|@playwright/mcp" | grep -v grep | grep -v "guard-playwright")
if ! printf '%s\n' "$procs" | grep -q -- "--browser webkit"; then
  echo "BLOQUEADO: el servidor de Playwright que está corriendo NO usa WebKit y abriría Chrome. Regla de Juan: pruebas en navegador solo con Safari/WebKit, nunca Chrome. Pídele a Juan reiniciar Claude Code (o reconectar el servidor con /mcp) para que tome .mcp.json (--browser webkit) y vuelve a intentar. No uses otra vía que abra Chrome." >&2
  exit 2
fi
exit 0
