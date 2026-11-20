# Capacitor Android: first plugin call after a page reload can hang

## The bug

On Android, the bridge keeps one reply channel to the page. When the page sends a plugin call, the bridge first hands the call to the plugin thread and only then stores the reply channel of the page. After a page reload, the plugin can finish before the new reply channel is stored. The reply then goes to the channel of the old page and is lost, so the promise in the new page never settles. This affects the first plugin call of a new page, for any plugin, and never happens on a cold start.

The two lines are in `android/capacitor/src/main/java/com/getcapacitor/MessageHandler.java`:

```java
postMessage(message.getData());
javaScriptReplyProxy = replyProxy;
```

Issue: https://github.com/ionic-team/capacitor/issues/8382
Pull request with the fix: https://github.com/ionic-team/capacitor/pull/8383

## What the app does

The page in `www/main.js` calls `Capacitor.Plugins.WebView.getServerBasePath()` as its first and only bridge call. This is a core plugin, so nothing else needs to be installed. If the promise settles, the page logs a line. If it has not settled after 10 seconds, the page logs a `NOT settled` line. Then the page reloads itself with `window.location.reload()`. After 300 rounds it stops and logs a summary. The three counts are also shown on screen. The button "Start again" resets the counts.

## Run it

1. Install the dependencies:

   ```sh
   npm install
   ```

2. Copy the Capacitor runtime into `www` and sync:

   ```sh
   npm run sync
   ```

3. Build and install the app on an emulator or device:

   ```sh
   cd android
   ./gradlew :app:installDebug
   cd ..
   ```

4. Watch the log in one terminal:

   ```sh
   adb logcat -c
   adb logcat -s Capacitor/Console:I | grep FIRSTCALL
   ```

   Start the app in a second terminal:

   ```sh
   adb shell am start -n com.example.firstcallrepro/.MainActivity
   ```

5. Wait for the summary line:

   ```
   FIRSTCALL SUMMARY rounds=300 settled=211 notSettled=89
   ```

## Try the fix

`fix.patch` swaps the two lines in the installed `@capacitor/android` package. This is the change of the pull request above.

```sh
npm run apply-fix
adb shell pm clear com.example.firstcallrepro
cd android
./gradlew :app:installDebug
cd ..
adb shell am start -n com.example.firstcallrepro/.MainActivity
```

To go back to the stock file, run `npm run revert-fix`.

## Results

| Bridge | Rounds | Settled | Not settled |
| --- | --- | --- | --- |
| Stock 8.6.2 | 300 | 211 | 89 (30 %) |
| With `fix.patch` | 300 | 300 | 0 |

In the stock run, the first 27 rounds were fine. After that the lost replies came often, sometimes many rounds in a row. The rate depends on timing, so it can be lower or higher on another machine. With the fix, all 300 rounds settled, in about 6 seconds in total.

## Environment

- Capacitor 8.6.2 (`@capacitor/core`, `@capacitor/android`, `@capacitor/cli`)
- Android emulator, Android 17 (API level 37), arm64
- Android System WebView 156.0.8078.47
- `androidx.webkit` 1.14.0, compile and target SDK 36
