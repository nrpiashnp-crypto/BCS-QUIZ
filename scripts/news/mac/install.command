#!/bin/bash
# লিয়ানার খবর ও নিয়োগ বিজ্ঞপ্তির বট Mac-এ চালু করা। একবার চালালেই হবে।
# নতুন Mac-এ (যেমন Mac mini) Terminal-এ এক লাইনে:
#   curl -fsSL https://raw.githubusercontent.com/nrpiashnp-crypto/BCS-QUIZ/main/scripts/news/mac/install.command -o /tmp/lyanna-bot.command && bash /tmp/lyanna-bot.command
# চাবি বদলাতে: bash ~/Lyanna-Backup/খবরের-বট-চালু.command --new-key   (Gemini)   বা   --new-token   (GitHub)
# প্রকাশ চলে বটের আলাদা রাস্তায় (scripts/bot_lane.py): শুধু news/ আর circular/ GitHub-এর main-এ, PR-এর সঙ্গে conflict ছাড়া।
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
BOT="$HOME/Lyanna-Backup/news-bot"
KEYDIR="$HOME/.lyanna"
REPO_API="https://api.github.com/repos/nrpiashnp-crypto/BCS-QUIZ"
mkdir -p "$BOT" "$KEYDIR" "$HOME/Library/LaunchAgents"; chmod 700 "$KEYDIR"
echo "== লিয়ানার খবর ও নিয়োগ বিজ্ঞপ্তির বট চালু করা =="

# ১. দরকারি যন্ত্র
if ! xcode-select -p >/dev/null 2>&1 || ! command -v git >/dev/null || ! python3 -c 'print(1)' >/dev/null 2>&1; then
  echo "git আর python3 এখনো নেই। একটা জানালা আসবে: 'Install' চাপুন (১০-২০ মিনিট), শেষ হলে এটা আবার চালান।"
  xcode-select --install 2>/dev/null; exit 1
fi
echo "✓ git আর python3 আছে"

# ২. Gemini চাবি
if [ ! -s "$KEYDIR/gemini.key" ] || [ "${1:-}" = "--new-key" ]; then
  echo
  echo "Gemini চাবি পেস্ট করুন (লেখা দেখা যাবে না), তারপর Enter:"
  read -rs KEY; echo
  [ -n "$KEY" ] || { echo "চাবি খালি, থামলাম।"; exit 1; }
  printf '%s' "$KEY" > "$KEYDIR/gemini.key"; chmod 600 "$KEYDIR/gemini.key"
fi
KEY="$(tr -d '[:space:]' < "$KEYDIR/gemini.key")"; printf '%s' "$KEY" > "$KEYDIR/gemini.key"
BODY="$(mktemp)"
# নতুন ধরনের চাবি (AQ. দিয়ে শুরু) মডেল-তালিকায় অনেক সময় 401 দেয়, তাই আসল একটা ছোট প্রশ্ন পাঠিয়ে পরীক্ষা
code=000
for MODEL in gemini-3.1-flash-lite gemini-3.6-flash gemini-2.5-flash-lite; do
  code=$(curl -s -o "$BODY" -w '%{http_code}' -X POST -H "x-goog-api-key: $KEY" -H 'Content-Type: application/json' \
    -d '{"contents":[{"parts":[{"text":"Reply with OK"}]}]}' \
    "https://generativelanguage.googleapis.com/v1beta/models/$MODEL:generateContent")
  [ "$code" = "200" ] && break
done
if [ "$code" != "200" ]; then
  echo "Gemini চাবি কাজ করছে না (উত্তর $code)।"
  echo "  পেস্ট হওয়া চাবির দৈর্ঘ্য: ${#KEY} অক্ষর, শুরু: ${KEY:0:4}…"
  msg=$(python3 -c 'import json,sys;e=json.load(open(sys.argv[1])).get("error",{});print(e.get("status",""),"—",e.get("message","")[:200])' "$BODY" 2>/dev/null)
  [ -n "$msg" ] && echo "  Google-এর বার্তা: $msg"
  echo "আবার চালান।"
  rm -f "$KEYDIR/gemini.key" "$BODY"; exit 1
fi
rm -f "$BODY"
echo "✓ Gemini চাবি ঠিক আছে ($MODEL উত্তর দিল)"

# ৩. GitHub চাবি (শুধু BCS-QUIZ-এ লেখার; বট শুধু news/ আর circular/ পাঠায়)
gh_ok(){ curl -s -H "Authorization: Bearer $1" -H "Accept: application/vnd.github+json" "$REPO_API" \
  | python3 -c 'import json,sys;d=json.load(sys.stdin);print("yes" if d.get("permissions",{}).get("push") else "no")' 2>/dev/null; }
TOK=""; [ -s "$KEYDIR/github.token" ] && TOK="$(tr -d '[:space:]' < "$KEYDIR/github.token")"
if [ -z "$TOK" ] || [ "${1:-}" = "--new-token" ] || [ "$(gh_ok "$TOK")" != "yes" ]; then
  echo
  echo "GitHub চাবি লাগবে (একবারই)। ব্রাউজারে খুলুন:"
  echo "  https://github.com/settings/personal-access-tokens/new"
  echo "  নাম: lyanna-news-bot · Expiration: 1 year · Repository access: Only select repositories → BCS-QUIZ"
  echo "  Permissions → Repository permissions → Contents: Read and write → Generate token → কপি"
  echo "চাবি পেস্ট করুন (লেখা দেখা যাবে না), তারপর Enter:"
  read -rs TOK; echo; TOK="$(printf '%s' "$TOK" | tr -d '[:space:]')"
  [ -n "$TOK" ] || { echo "চাবি খালি, থামলাম।"; exit 1; }
  if [ "$(gh_ok "$TOK")" != "yes" ]; then
    echo "এই চাবি দিয়ে BCS-QUIZ-এ লেখা যাচ্ছে না। ওপরের ধাপে Contents: Read and write আর BCS-QUIZ বাছা হয়েছে কি না দেখে আবার চালান।"
    exit 1
  fi
  printf '%s' "$TOK" > "$KEYDIR/github.token"; chmod 600 "$KEYDIR/github.token"
fi
echo "✓ GitHub চাবি ঠিক আছে (BCS-QUIZ-এ লেখা যায়)"

# ৪. রিপোর আলাদা কপি আর প্রতি ঘণ্টার চালানো
python3 -m pip install -q --user certifi 2>/dev/null || true
if [ ! -d "$BOT/BCS-QUIZ/.git" ]; then
  echo "রিপোর আলাদা কপি নামানো হচ্ছে (কয়েক মিনিট)…"
  git clone -q --depth 20 https://github.com/nrpiashnp-crypto/BCS-QUIZ.git "$BOT/BCS-QUIZ" || { echo "নামানো গেল না"; exit 1; }
fi
( cd "$BOT/BCS-QUIZ" && python3 scripts/bot_lane.py fresh . >/dev/null )
cp "$BOT/BCS-QUIZ/scripts/news/mac/run.sh" "$BOT/run.sh"; chmod +x "$BOT/run.sh"
cp "$BOT/BCS-QUIZ/scripts/news/mac/install.command" "$HOME/Lyanna-Backup/খবরের-বট-চালু.command"; chmod +x "$HOME/Lyanna-Backup/খবরের-বট-চালু.command"
# নতুন Mac-এ পরীক্ষামূলক হাতে-অনুমোদনের দিন নয় (PIASH ১০/১১-এ বন্ধ করেছেন): সরাসরি নিজে থেকে প্রকাশ
if [ ! -s "$BOT/state.json" ]; then
  printf '{"_trial": {"left": 0, "since": "%s", "note": "নতুন Mac-এ চালু"}}\n' "$(date +%F)" > "$BOT/state.json"
fi
sed "s#/Users/piash/#$HOME/#g" "$BOT/BCS-QUIZ/scripts/news/mac/com.lyanna.news.plist" > "$HOME/Library/LaunchAgents/com.lyanna.news.plist"
launchctl bootout gui/$(id -u)/com.lyanna.news 2>/dev/null
launchctl bootstrap gui/$(id -u) "$HOME/Library/LaunchAgents/com.lyanna.news.plist"
echo
( cd "$BOT/BCS-QUIZ" && python3 scripts/bot_lane.py status . )
echo
echo "চালু হলো ✓  Mac চালু থাকলে প্রতি ঘণ্টায় দেখবে। প্রথম চালানো এখনই শুরু হয়েছে (প্রতিটা দিনে ১০-১৫ মিনিট)।"
echo "সাইটে না থাকা শেষ ৩ দিনের সংবাদও বানাবে। প্রকাশ হলে Mac-এর কোণে বার্তা আসবে।"
echo "লগ দেখতে: tail -n 30 $BOT/news-bot.log"
echo "গুরুত্বপূর্ণ: অন্য কোনো Mac-এ এই বট চালু থাকলে সেখানে বন্ধ করুন: launchctl bootout gui/\$(id -u)/com.lyanna.news"
