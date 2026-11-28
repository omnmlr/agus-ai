package app.agus.runtime.preview;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class RuntimeWatchdog extends Service {
    private final Handler timer = new Handler(Looper.getMainLooper());
    private final ExecutorService network = Executors.newSingleThreadExecutor();
    private long lastRequest;
    private volatile boolean requestRunning;
    private final Runnable check = new Runnable() {
        @Override public void run() {
            var work = RuntimeState.live;
            if (work == null) { stopSelf(); return; }
            if (!work.eligible()) {
                if (!work.stopped) Log.i("AgusPreview", "WATCHDOG_AUTHORITY_LOST");
                work.stop();
                stopSelf();
                return;
            }
            long now = SystemClock.elapsedRealtime();
            if (!requestRunning && now - lastRequest > 8_000) {
                lastRequest = now;
                requestRunning = true;
                network.execute(() -> {
                    try { work.renew(); }
                    catch (Exception unavailable) { /* The independent local timer enforces expiry. */ }
                    finally { requestRunning = false; }
                });
            }
            timer.postDelayed(this, 500);
        }
    };

    @Override public int onStartCommand(Intent intent, int flags, int id) {
        var manager = getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel("testing", "Authorized testing", NotificationManager.IMPORTANCE_LOW));
        var stop = PendingIntent.getService(this, 5, new Intent(this, RuntimeWatchdog.class).setAction("stop"),
            PendingIntent.FLAG_IMMUTABLE);
        startForeground(735, new Notification.Builder(this, "testing").setSmallIcon(R.drawable.brand_notification)
            .setContentTitle("Work Runtime testing window").setContentText("Stop immediately to reclaim your screen.")
            .setOngoing(true).addAction(new Notification.Action.Builder(null, "Stop test", stop).build()).build(),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        timer.removeCallbacks(check);
        var work = RuntimeState.live;
        if (intent != null && "stop".equals(intent.getAction()) && work != null) {
            work.stop();
            Log.i("AgusPreview", "WATCHDOG_OWNER_STOP");
            network.execute(() -> {
                try {
                    work.notifyOwnerStop();
                    Log.i("AgusPreview", "WATCHDOG_SERVER_FENCED");
                }
                catch (Exception unavailable) { /* Local suspension and expiry stand independently. */ }
                finally { stopSelf(id); }
            });
        } else {
            timer.post(check);
        }
        return START_NOT_STICKY;
    }

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override public void onDestroy() {
        timer.removeCallbacksAndMessages(null);
        network.shutdownNow();
        super.onDestroy();
    }
}
