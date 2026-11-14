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
# বটের আলাদা রাস্তা (PIASH, ২০২৬-১১-১৫; scripts/bot_lane.py): বটের কপি প্রতি খেপে GitHub-এর সর্বশেষ main-এ ফেরে,
# আর প্রকাশের সময় শুধু news/ আর circular/ GitHub-এ যায়। তাই মূল কপির সঙ্গে মেলানো (sync-copies.sh) আর
# inbox/news-auto দিয়ে বটের কপিতে কোড বসানো আর লাগে না: কোডের বদল সাধারণ PR-এ যায়, বট পরের খেপেই সেটা নেয়।
# কাজ চলার সময় Mac ঘুমাবে না (caffeinate), শেষ হলে আবার স্বাভাবিক
caffeinate -i python3 "$BOT/BCS-QUIZ/scripts/news/mac/mac_daily.py"
# নিয়োগ বিজ্ঞপ্তির বট (দিনে তিন খেপ; খেপের সময় না হলে সঙ্গে সঙ্গে ফেরে)
if [ -f "$BOT/BCS-QUIZ/scripts/jobs/mac_jobs.py" ]; then
  caffeinate -i python3 "$BOT/BCS-QUIZ/scripts/jobs/mac_jobs.py" >>"$BOT/jobs.log" 2>&1
fi
tail -n 3000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
