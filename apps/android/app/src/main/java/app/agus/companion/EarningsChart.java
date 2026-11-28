package app.agus.companion;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Shader;
import android.view.MotionEvent;
import android.view.View;
import java.math.BigInteger;
import java.util.List;
import java.util.function.IntConsumer;

final class EarningsChart extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final float[] fractions;
    private final float inset;
    private final IntConsumer selection;
    private int selected = -1;

    EarningsChart(Context context, List<BigInteger> values, IntConsumer selection) {
        super(context);
        this.selection = selection;
        inset = 5 * getResources().getDisplayMetrics().density;
        BigInteger max = values.stream().max(BigInteger::compareTo).orElseThrow();
        fractions = new float[values.size()];
        if (max.signum() > 0) {
            for (int index = 0; index < values.size(); index++) {
                fractions[index] = (float) (values.get(index).doubleValue() / max.doubleValue());
            }
        }
        // A textual point selector is provided next to the graph for keyboard and accessibility.
        setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
    }

    private float x(int index) {
        return fractions.length == 1 ? getWidth() / 2f :
            inset + (getWidth() - 2 * inset) * index / (fractions.length - 1);
    }

    private float y(int index) {
        return getHeight() - inset - (getHeight() - 2 * inset) * fractions[index];
    }

    void select(int index) {
        selected = Math.max(0, Math.min(index, fractions.length - 1));
        selection.accept(selected);
        invalidate();
    }

    @Override protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float baseline = getHeight() - inset;
        paint.setColor(CompanionViews.BORDER);
        paint.setStrokeWidth(1);
        canvas.drawLine(inset, baseline, getWidth() - inset, baseline, paint);

        Path line = new Path();
        line.moveTo(x(0), y(0));
        for (int index = 1; index < fractions.length; index++) line.lineTo(x(index), y(index));
        Path fill = new Path(line);
        fill.lineTo(x(fractions.length - 1), baseline);
        fill.lineTo(x(0), baseline);
        fill.close();
        paint.setShader(new LinearGradient(0, 0, 0, getHeight(), 0x56cdd5df, 0x05cdd5df, Shader.TileMode.CLAMP));
        canvas.drawPath(fill, paint);
        paint.setShader(null);

        paint.setColor(CompanionViews.ACCENT);
        paint.setStrokeWidth(inset / 2f);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeJoin(Paint.Join.ROUND);
        canvas.drawPath(line, paint);
        paint.setStyle(Paint.Style.FILL);
        if (selected >= 0) canvas.drawCircle(x(selected), y(selected), inset * .8f, paint);
    }

    @Override public boolean onTouchEvent(MotionEvent event) {
        if (selection == null) return false;
        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_DOWN, MotionEvent.ACTION_MOVE -> {
                getParent().requestDisallowInterceptTouchEvent(true);
                select(Math.round((fractions.length - 1) * (event.getX() - inset) / Math.max(1, getWidth() - 2 * inset)));
                return true;
            }
            case MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                getParent().requestDisallowInterceptTouchEvent(false);
                if (event.getActionMasked() == MotionEvent.ACTION_UP) performClick();
                return true;
            }
            default -> { return super.onTouchEvent(event); }
        }
    }

    @Override public boolean performClick() {
        super.performClick();
        return true;
    }
}
