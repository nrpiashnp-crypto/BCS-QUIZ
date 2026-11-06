#!/bin/bash
# launchd প্রতি ঘণ্টায় এটা চালায় (~/Library/LaunchAgents/com.lyanna.news.plist)। কাজ: scripts/news/mac/mac_daily.py
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
BOT="$HOME/Lyanna-Backup/news-bot"
LOG="$BOT/news-bot.log"
mkdir -p "$BOT"
exec >>"$LOG" 2>&1
if [ ! -d "$BOT/BCS-QUIZ/.git" ]; then
  git clone -q --depth 20 https://github.com/nrpiashnp-crypto/BCS-QUIZ.git "$BOT/BCS-QUIZ" || exit 1
fi
# কাজ চলার সময় Mac ঘুমাবে না (caffeinate), শেষ হলে আবার স্বাভাবিক
caffeinate -i python3 "$BOT/BCS-QUIZ/scripts/news/mac/mac_daily.py"
tail -n 3000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
