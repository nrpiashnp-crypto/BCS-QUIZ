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
# আগে মূল কপির (~/Lyanna-Backup/BCS-QUIZ) নতুন কাজ বটের কপিতে মেলানো, যাতে বট পুরোনো সাইট তুলে না দেয়।
# মেলানো না গেলে এই খেপ বাদ (দিনে একবার জানায়)।
if [ -x "$HOME/Lyanna-Backup/sync-copies.sh" ]; then
  if ! "$HOME/Lyanna-Backup/sync-copies.sh" "$BOT/BCS-QUIZ" "$HOME/Lyanna-Backup/BCS-QUIZ"; then
    STAMP="$BOT/.sync-fail-$(date +%F)"
    if [ ! -f "$STAMP" ]; then touch "$STAMP"
      osascript -e 'display notification "মূল কপির সঙ্গে মেলানো গেল না, তাই খবর তোলা বন্ধ। Claude-কে জানান।" with title "খবরের বট"' 2>/dev/null
    fi
    exit 0
  fi
fi
# খবর ও নিয়োগ-বটের নতুন কাজ নিজে থেকে বসানো (PIASH, ২০২৬-১১-১০): Claude inbox/news-auto/-এ zip রাখে →
# বটের কপিতে git am → test_news আর test_jobs পাস হলে থাকে (পরের প্রকাশে সাইটেও যায়), না হলে আগের অবস্থায় ফেরত।
AUTO="$HOME/Lyanna-Backup/inbox/news-auto"
note(){ osascript -e "display notification \"$1\" with title \"খবরের বট\"" 2>/dev/null; }
if [ -d "$AUTO" ] && ! pgrep -f "mac_daily.py|mac_jobs.py" >/dev/null; then
  shopt -s nullglob
  for f in "$AUTO"/*.zip; do
    name="$(basename "$f")"; tmp="$(mktemp -d)"; unzip -q -o "$f" -d "$tmp"
    patches=$(find "$tmp" -type f -name '*.patch' | sort)
    cd "$BOT/BCS-QUIZ" || break
    if ! git diff --quiet || ! git diff --cached --quiet; then
      echo "$(date '+%F %T') news-auto: বটের কপিতে না-রাখা বদল আছে, $name বসানো হলো না"; rm -rf "$tmp"; break
    fi
    before=$(git rev-parse HEAD)
    if [ -n "$patches" ] && git -c user.name="Claude" -c user.email="noreply@anthropic.com" am --3way $patches \
       && python3 scripts/news/test_news.py && { [ ! -f scripts/jobs/test_jobs.py ] || python3 scripts/jobs/test_jobs.py; }; then
      mkdir -p "$AUTO/done"; mv "$f" "$AUTO/done/"
      echo "$(date '+%F %T') news-auto: ✔ $name বসানো হলো"; note "নতুন নিয়ম নিজে থেকে বসানো হলো ✓ ($name)"
    else
      git am --abort >/dev/null 2>&1; git reset -q --hard "$before"
      mkdir -p "$AUTO/failed"; mv "$f" "$AUTO/failed/"
      echo "$(date '+%F %T') news-auto: ✗ $name বসানো বা পরীক্ষা ব্যর্থ, আগের অবস্থায় ফেরত"
      note "নতুন নিয়ম বসানো গেল না, আগের মতো চলছে। Claude-কে জানান। ($name)"
    fi
    rm -rf "$tmp"
  done
  cd "$BOT"
fi
# কাজ চলার সময় Mac ঘুমাবে না (caffeinate), শেষ হলে আবার স্বাভাবিক
caffeinate -i python3 "$BOT/BCS-QUIZ/scripts/news/mac/mac_daily.py"
# নিয়োগ বিজ্ঞপ্তির বট (দিনে তিন খেপ; খেপের সময় না হলে সঙ্গে সঙ্গে ফেরে)
if [ -f "$BOT/BCS-QUIZ/scripts/jobs/mac_jobs.py" ]; then
  caffeinate -i python3 "$BOT/BCS-QUIZ/scripts/jobs/mac_jobs.py" >>"$BOT/jobs.log" 2>&1
fi
tail -n 3000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
