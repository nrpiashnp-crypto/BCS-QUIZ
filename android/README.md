# লিয়ানা বুকস Android অ্যাপ

Trusted Web Activity (TWA): অ্যাপ খুললে Chrome-এর ভেতরে lyannabooks.com খোলে, ঠিকানা-বার ছাড়া। আলাদা কোড নেই,
তাই সাইটে যা বদলায় অ্যাপেও সাথে সাথে বদলায়। Google লগইন Chrome-এর ভেতরে চলে, তাই WebView-এর মতো আটকায় না।

- প্যাকেজ: `com.lyannabooks.app`
- বিল্ড: GitHub Actions (`.github/workflows/android.yml`); `android/` বদলালে নিজে চলে, নয়তো Actions → Android app → Run workflow।
  ফল: Actions রানের নিচে `lyanna-books-android` (APK + AAB)।
- সাইনিং চাবি রিপোতে নেই, GitHub Secrets-এ। চাবির ফিঙ্গারপ্রিন্ট `/.well-known/assetlinks.json`-এ; Google Play-র
  "App signing key"-এর ফিঙ্গারপ্রিন্টও (Play Console → Test and release → App integrity) সেখানে যোগ করতে হবে,
  নইলে Play থেকে বসানো অ্যাপে উপরে ঠিকানা-বার দেখাবে।
- নতুন সংস্করণ Play-তে তুলতে `app/build.gradle`-এ `versionCode` এক বাড়ান।
- আইকন `img/logo/icon-512.png` আর `icon-maskable-512.png` থেকে বানানো।
