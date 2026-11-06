#!/bin/bash
# খবরের খসড়া অনুমোদন: ব্রাউজারে সারাংশ খোলে আর জিজ্ঞেস করে "প্রকাশ করুন / পরে / বাদ দিন"।
# বট নিজে এটা খোলে; হাতেও যেকোনো সময় দুবার চেপে চালানো যায় (~/Lyanna-Backup/news-bot/approve.command)।
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
BOT="$HOME/Lyanna-Backup/news-bot"
echo "== খবরের খসড়া অনুমোদন =="
python3 "$BOT/BCS-QUIZ/scripts/news/mac/mac_daily.py" --approve 2>&1 | tee -a "$BOT/news-bot.log"
echo; echo "শেষ। এই জানালা বন্ধ করতে পারেন।"
