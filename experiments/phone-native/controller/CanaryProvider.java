package app.agus.phase1;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;

public class CanaryProvider extends ContentProvider {
    @Override public boolean onCreate() { return true; }

    @Override public Cursor query(Uri uri, String[] projection, String selection,
                                  String[] args, String sortOrder) {
        MatrixCursor cursor = new MatrixCursor(new String[]{"canary"});
        if (getContext().getSharedPreferences("phase1", 0).getBoolean("personalCanary", false)) {
            cursor.addRow(new String[]{"SYNTHETIC_PARENT_ONLY"});
        }
        return cursor;
    }

    @Override public String getType(Uri uri) { return null; }
    @Override public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException(); }
    @Override public int delete(Uri uri, String selection, String[] args) { throw new UnsupportedOperationException(); }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] args) {
        throw new UnsupportedOperationException();
    }
}
