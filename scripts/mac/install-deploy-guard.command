#!/bin/bash
# এক চাপে: Mac-এর deploy.sh-কে পাহারার ওপর বসানো (PIASH, ২০২৬-১১-১৩)।
# Finder-এ এই ফাইলে দুবার চাপুন, বা Terminal-এ: bash ~/Lyanna-Backup/news-bot/BCS-QUIZ/scripts/mac/install-deploy-guard.command
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
B="$HOME/Lyanna-Backup"
T="$B/BCS-QUIZ/deploy.sh"
echo "== সাইটে তোলার পাহারা বসানো =="
if [ ! -d "$B/BCS-QUIZ" ]; then echo "✗ $B/BCS-QUIZ ফোল্ডার নেই; কিছু বদলানো হয়নি।"; read -r -p "Enter চাপুন…" _; exit 1; fi
if [ -f "$T" ] && ! grep -q deploy_guard "$T"; then
  cp -p "$T" "$T.old-1113" && echo "✓ পুরোনো deploy.sh রাখা হলো: deploy.sh.old-1113"
fi
cp "$HERE/deploy.sh" "$T" && chmod +x "$T" && echo "✓ নতুন deploy.sh বসানো হলো (দুই দিক মিলিয়ে GitHub-এ push)"
for x in live.json deploy.sh deploy.sh.old-1113; do
  grep -qx "$x" "$B/BCS-QUIZ/.git/info/exclude" 2>/dev/null || echo "$x" >> "$B/BCS-QUIZ/.git/info/exclude"
done
echo
echo "== অন্য স্ক্রিপ্টে সরাসরি Cloudflare-এ তোলা আছে কি না =="
found=0
for f in "$B"/*.command "$B"/*.sh "$B"/news-bot/*.sh; do
  [ -f "$f" ] || continue
  if grep -n "wrangler pages deploy\|wrangler\" *\"pages\"" "$f" >/dev/null 2>&1; then
    echo "⚠ $f — এখানে এখনো সরাসরি Cloudflare-এ তোলার লাইন আছে:"; grep -n "wrangler" "$f" | head -5; found=1
  fi
done
[ $found = 0 ] && echo "✓ আর কোথাও সরাসরি তোলা পাওয়া যায়নি; ইনবক্স-মেলাও এখন নতুন deploy.sh দিয়েই লাইভ করবে।"
[ $found = 1 ] && echo "ওপরের ফাইলগুলো Claude-কে দেখান (Mac-যুক্ত সেশনে); ওগুলো বদলানোর আগে ওগুলো দিয়ে লাইভ করবেন না।"
echo
read -r -p "শেষ। Enter চাপুন…" _
