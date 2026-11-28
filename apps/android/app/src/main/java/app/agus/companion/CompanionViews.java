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
    static final int BACKGROUND = 0xff09090b;
    static final int PANEL = 0xff161618;
    static final int RAISED = 0xff23242a;
    static final int BORDER = 0xff333336;
    static final int TEXT = 0xfff5f5f7;
    static final int MUTED = 0xffa1a1aa;
    static final int ACCENT = 0xffcdd5df;
    static final int ERROR = 0xffff9ba1;
    private final Context context;
    private final Typeface regular;
    private final Typeface semibold;
    private final Typeface bold;

    CompanionViews(Context context) {
        this.context = context;
        Typeface font = context.getResources().getFont(R.font.plus_jakarta_sans);
        regular = Typeface.create(font, 400, false);
        semibold = Typeface.create(font, 600, false);
        bold = Typeface.create(font, 700, false);
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
        label.setTypeface(bold ? this.bold : regular);
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
        field.setTypeface(regular);
        field.setHint(hint);
        field.setPadding(dp(14), dp(12), dp(14), dp(12));
        field.setBackground(surface(PANEL, 0xff787880, 14));
        return field;
    }

    Button button(String text, boolean primary, View.OnClickListener listener) {
        Button button = new Button(context);
        button.setText(text);
        button.setTextSize(15);
        button.setTypeface(semibold);
        button.setAllCaps(false);
        button.setTextColor(new ColorStateList(new int[][] {{-android.R.attr.state_enabled}, {}},
            new int[] {0xff777780, primary ? BACKGROUND : TEXT}));
        button.setMinHeight(dp(primary ? 54 : 48));
        button.setMinimumHeight(dp(primary ? 54 : 48));
        button.setPadding(dp(14), dp(10), dp(14), dp(10));
        button.setBackground(new RippleDrawable(ColorStateList.valueOf(primary ? 0x33000000 : 0x30ffffff),
            surface(primary ? TEXT : PANEL, primary ? TEXT : BORDER, 28), null));
        button.setOnClickListener(listener);
        return button;
    }

    Button tab(String label, int icon, boolean selected, View.OnClickListener listener) {
        Button tab = button(label, false, listener);
        tab.setTextSize(12);
        tab.setTextColor(selected ? TEXT : MUTED);
        tab.setMinimumHeight(dp(58));
        tab.setCompoundDrawablesWithIntrinsicBounds(0, icon, 0, 0);
        tab.setCompoundDrawableTintList(ColorStateList.valueOf(selected ? TEXT : MUTED));
        tab.setCompoundDrawablePadding(dp(5));
        tab.setBackground(new RippleDrawable(ColorStateList.valueOf(0x22ffffff),
            surface(selected ? RAISED : BACKGROUND, selected ? BORDER : BACKGROUND, 16), null));
        return tab;
    }

    android.widget.ImageButton iconButton(String title, int icon, View.OnClickListener listener) {
        android.widget.ImageButton button = new android.widget.ImageButton(context);
        button.setContentDescription(title);
        button.setImageResource(icon);
        button.setImageTintList(ColorStateList.valueOf(TEXT));
        button.setBackground(new RippleDrawable(ColorStateList.valueOf(0x35ffffff), surface(PANEL, BORDER, 24), null));
        button.setLayoutParams(new LinearLayout.LayoutParams(dp(48), dp(48)));
        button.setOnClickListener(listener);
        return button;
    }

    LinearLayout hero(LinearLayout parent, int height) {
        LinearLayout stage = column();
        stage.setGravity(Gravity.CENTER);
        GradientDrawable glow = new GradientDrawable(GradientDrawable.Orientation.TL_BR,
            new int[] {0xff31343e, 0xff16171c, BACKGROUND});
        glow.setCornerRadius(dp(28));
        stage.setBackground(glow);
        stage.addView(brandImage(R.drawable.brand_mascot, true), new LinearLayout.LayoutParams(dp(height), dp(height)));
        add(parent, stage, 16);
        return stage;
    }

    void rule(LinearLayout parent, int margin) {
        View line = new View(context);
        line.setBackgroundColor(BORDER);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, dp(1));
        params.topMargin = dp(margin);
        parent.addView(line, params);
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

    GradientDrawable surface(int color, int stroke, int radius) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(radius));
        drawable.setStroke(dp(1), stroke);
        return drawable;
    }
}
