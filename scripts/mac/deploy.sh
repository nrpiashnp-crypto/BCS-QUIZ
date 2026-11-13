#!/bin/bash
# সাইট লাইভ (Mac): দুই দিক মিলিয়ে GitHub-এ push; Cloudflare GitHub থেকে নিজে তোলে (PIASH, ২০২৬-১১-১৩)।
# বসানো থাকে ~/Lyanna-Backup/BCS-QUIZ/deploy.sh-এ (install-deploy-guard.command বসায়); ইনবক্স-মেলাও এটাই ডাকে।
# পাহারা সবসময় GitHub-এর main-এর scripts/deploy_guard.py থেকে চলে, তাই Mac-এর কপি পুরোনো হলেও নিয়ম নতুন।
# আগের deploy.sh (সরাসরি wrangler) পাশে deploy.sh.old-1113 নামে রাখা।
set -u
cd "$(dirname "$0")" || exit 1
B="$HOME/Lyanna-Backup"
if [ -x "$B/sync-copies.sh" ]; then
  "$B/sync-copies.sh" || { echo "✗ থামানো হলো: Mac-এর দুই কপি (মূল আর খবরের বট) মেলানো গেল না, তাই লাইভ নয়।"; exit 1; }
fi
G="$(mktemp "${TMPDIR:-/tmp}/deploy_guard.XXXXXX")" || exit 1
if git fetch -q --depth 200 origin +refs/heads/main:refs/remotes/origin/main && git show origin/main:scripts/deploy_guard.py > "$G"; then
  python3 "$G" ship "$PWD"; rc=$?
elif [ -f "$B/allow-direct-deploy" ] && [ -f scripts/deploy_guard.py ]; then
  echo "GitHub পাওয়া যাচ্ছে না; অনুমতি-ফাইল আছে, তাই জরুরি পথে সরাসরি Cloudflare।"
  python3 scripts/deploy_guard.py direct "$PWD"; rc=$?
else
  echo "✗ থামানো হলো: GitHub পাওয়া যাচ্ছে না, তাই দুই দিক মেলানো গেল না। কাজ Mac-এ জমা থাকল।"
  echo "  খুব জরুরি হলে: touch ~/Lyanna-Backup/allow-direct-deploy তারপর আবার চালান (পরে ফাইলটা মুছে দেবেন)।"
  rc=1
fi
rm -f "$G"
exit $rc
