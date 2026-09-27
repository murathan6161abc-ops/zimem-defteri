#!/bin/zsh
# ============================================================
# D-Zimem — Tarama bilgisayarını başlat (çift tıkla)
# Ollama kapalıysa açar, ardından tarama programını çalıştırır.
# Bu pencere açık kaldığı sürece esnaflar defter tarayabilir.
# İstersen bu dosyayı Masaüstü'ne kısayol (alias) olarak sürükle.
# ============================================================
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1

if ! curl -s --max-time 2 http://127.0.0.1:11434/api/version >/dev/null; then
  echo "Ollama başlatılıyor…"
  OLLAMA_FLASH_ATTENTION=1 OLLAMA_KV_CACHE_TYPE=q8_0 nohup ollama serve >/tmp/dzimem-ollama.log 2>&1 &
  for i in {1..20}; do
    curl -s --max-time 1 http://127.0.0.1:11434/api/version >/dev/null && break
    sleep 1
  done
fi

npm run --silent tarama
echo
read -k 1 "?Kapatmak için bir tuşa bas…"
