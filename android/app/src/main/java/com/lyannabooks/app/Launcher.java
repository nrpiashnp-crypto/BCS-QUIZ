package com.lyannabooks.app;

import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;

import com.google.androidbrowserhelper.trusted.LauncherActivity;
import com.google.androidbrowserhelper.trusted.TwaLauncher;

/**
 * ফোনে Chrome থাকলে অ্যাপ Chrome দিয়েই খোলে। কিছু ফোনের মূল ব্রাউজার (যেমন Samsung Internet-এর ডার্ক মোড)
 * সাইটের রঙ জোর করে উল্টে দেয়; Chrome সাইটের "শুধু হালকা রঙ" মানে। Chrome না থাকলে আগের মতো মূল ব্রাউজার।
 */
public class Launcher extends LauncherActivity {
    private static final String CHROME = "com.android.chrome";

    @Override
    protected TwaLauncher createTwaLauncher() {
        return new TwaLauncher(this, chromeIfAvailable());
    }

    private String chromeIfAvailable() {
        try {
            ApplicationInfo info = getPackageManager().getApplicationInfo(CHROME, 0);
            return info.enabled ? CHROME : null;
        } catch (PackageManager.NameNotFoundException e) {
            return null;
        }
    }
}
