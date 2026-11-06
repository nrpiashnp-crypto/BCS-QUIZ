#!/bin/bash
# লিয়ানার খবরের বট Mac-এ চালু করা। একবার চালালেই হবে (চাবি বদলাতে চাইলে আবার চালান)।
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
BOT="$HOME/Lyanna-Backup/news-bot"
KEYDIR="$HOME/.lyanna"
mkdir -p "$BOT" "$KEYDIR"; chmod 700 "$KEYDIR"
echo "== লিয়ানার খবরের বট চালু করা =="
command -v python3 >/dev/null || { echo "python3 নেই। একটা জানালা এলে 'Install' চাপুন, শেষ হলে এটা আবার চালান."; xcode-select --install; exit 1; }
if [ ! -s "$KEYDIR/gemini.key" ] || [ "$1" = "--new-key" ]; then
  echo
  echo "Gemini চাবি পেস্ট করুন (লেখা দেখা যাবে না), তারপর Enter:"
  read -rs KEY; echo
  [ -n "$KEY" ] || { echo "চাবি খালি, থামলাম।"; exit 1; }
  printf '%s' "$KEY" > "$KEYDIR/gemini.key"; chmod 600 "$KEYDIR/gemini.key"
fi
KEY="$(tr -d '[:space:]' < "$KEYDIR/gemini.key")"; printf '%s' "$KEY" > "$KEYDIR/gemini.key"
BODY="$(mktemp)"
code=$(curl -s -o "$BODY" -w '%{http_code}' -H "x-goog-api-key: $KEY" \
  "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1")
if [ "$code" != "200" ]; then
  echo "চাবি কাজ করছে না (উত্তর $code)।"
  echo "  পেস্ট হওয়া চাবির দৈর্ঘ্য: ${#KEY} অক্ষর (ঠিক চাবি সাধারণত ৩৯), শুরু: ${KEY:0:4}… (ঠিক চাবি শুরু হয় AIza দিয়ে)"
  msg=$(python3 -c 'import json,sys;d=json.load(open(sys.argv[1]));print(d.get("error",{}).get("message","")[:200])' "$BODY" 2>/dev/null)
  [ -n "$msg" ] && echo "  Google-এর বার্তা: $msg"
  echo "আবার চালান: খবরের-বট-চালু.command --new-key  (অথবা ফাইলে আবার দুবার চাপুন)"
  rm -f "$KEYDIR/gemini.key" "$BODY"; exit 1
fi
rm -f "$BODY"
echo "চাবি ঠিক আছে ✓"
python3 -m pip install -q --user certifi 2>/dev/null || true
if [ ! -d "$BOT/BCS-QUIZ/.git" ]; then
  echo "রিপোর আলাদা কপি নামানো হচ্ছে…"
  git clone -q --depth 20 https://github.com/nrpiashnp-crypto/BCS-QUIZ.git "$BOT/BCS-QUIZ" || { echo "নামানো গেল না"; exit 1; }
fi
git -C "$BOT/BCS-QUIZ" pull -q --ff-only 2>/dev/null
cp "$BOT/BCS-QUIZ/scripts/news/mac/run.sh" "$BOT/run.sh"; chmod +x "$BOT/run.sh"
sed "s#/Users/piash#$HOME#g" "$BOT/BCS-QUIZ/scripts/news/mac/com.lyanna.news.plist" > "$HOME/Library/LaunchAgents/com.lyanna.news.plist"
launchctl bootout gui/$(id -u)/com.lyanna.news 2>/dev/null
launchctl bootstrap gui/$(id -u) "$HOME/Library/LaunchAgents/com.lyanna.news.plist"
echo
echo "চালু হলো ✓  এখন থেকে Mac চালু থাকলে প্রতি ঘণ্টায় দেখবে।"
echo "প্রথম চালানো শুরু হয়েছে। খসড়া তৈরি হলে (১০-১৫ মিনিট) ব্রাউজারে সারাংশ আর একটা প্রশ্নের জানালা আসবে।"
echo "লগ: $BOT/news-bot.log"
echo; echo "এই জানালা বন্ধ করতে পারেন।"
