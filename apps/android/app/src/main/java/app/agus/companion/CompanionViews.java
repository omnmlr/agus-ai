package app.agus.companion;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

final class CompanionViews {
    static final int BACKGROUND = Color.rgb(11, 17, 17);
    static final int PANEL = Color.rgb(19, 28, 28);
    static final int BORDER = Color.rgb(44, 63, 59);
    static final int TEXT = Color.rgb(239, 247, 243);
    static final int MUTED = Color.rgb(166, 188, 180);
    static final int ACCENT = Color.rgb(174, 242, 195);
    static final int ERROR = Color.rgb(255, 177, 162);
    private final Context context;

    CompanionViews(Context context) {
        this.context = context;
    }

    LinearLayout column() {
        LinearLayout layout = new LinearLayout(context);
        layout.setOrientation(LinearLayout.VERTICAL);
        return layout;
    }

    LinearLayout row() {
        LinearLayout layout = new LinearLayout(context);
        layout.setOrientation(LinearLayout.HORIZONTAL);
        layout.setGravity(Gravity.CENTER_VERTICAL);
        return layout;
    }

    TextView text(String text, int size, int color, boolean bold) {
        TextView label = new TextView(context);
        label.setText(text);
        label.setTextColor(color);
        label.setTextSize(size);
        label.setLineSpacing(dp(3), 1f);
        if (bold) {
            label.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        }
        return label;
    }

    TextView heading(String text, int size) {
        TextView heading = text(text, size, TEXT, true);
        heading.setAccessibilityHeading(true);
        return heading;
    }

    ImageView brandImage(int drawable, boolean decorative) {
        ImageView image = new ImageView(context);
        image.setImageResource(drawable);
        image.setScaleType(ImageView.ScaleType.FIT_CENTER);
        if (decorative) {
            image.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        } else {
            image.setContentDescription(context.getString(R.string.brand_name));
        }
        return image;
    }

    EditText input(String hint, int inputType) {
        EditText field = new EditText(context);
        field.setSingleLine();
        field.setInputType(inputType);
        field.setTextColor(TEXT);
        field.setHintTextColor(MUTED);
        field.setTextSize(16);
        field.setHint(hint);
        field.setPadding(dp(14), dp(12), dp(14), dp(12));
        field.setBackground(surface(PANEL, BORDER, 12));
        return field;
    }

    Button button(String text, boolean primary, View.OnClickListener listener) {
        Button button = new Button(context);
        button.setText(text);
        button.setTextSize(14);
        button.setAllCaps(false);
        button.setTextColor(primary ? BACKGROUND : TEXT);
        button.setMinHeight(dp(48));
        button.setMinimumHeight(dp(48));
        button.setPadding(dp(14), dp(10), dp(14), dp(10));
        button.setBackground(new RippleDrawable(ColorStateList.valueOf(0x263B6350),
            surface(primary ? ACCENT : PANEL, primary ? ACCENT : BORDER, 12), null));
        button.setOnClickListener(listener);
        return button;
    }

    LinearLayout card(LinearLayout parent) {
        LinearLayout card = column();
        card.setPadding(dp(16), dp(15), dp(16), dp(15));
        card.setBackground(surface(PANEL, BORDER, 16));
        add(parent, card, 12);
        return card;
    }

    void add(LinearLayout parent, View child, int marginTop) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.topMargin = dp(marginTop);
        parent.addView(child, params);
    }

    void weighted(LinearLayout parent, View child, int marginEnd) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, -2, 1f);
        params.setMarginEnd(dp(marginEnd));
        parent.addView(child, params);
    }

    int dp(int value) {
        return Math.round(value * context.getResources().getDisplayMetrics().density);
    }

    private GradientDrawable surface(int color, int stroke, int radius) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(radius));
        drawable.setStroke(dp(1), stroke);
        return drawable;
    }
}
