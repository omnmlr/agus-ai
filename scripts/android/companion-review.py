"""Capture the Companion against a disposable local control plane on Android 15."""
import json
import os
from pathlib import Path
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "product-preview"))
import android as ui

ui.APP = "app.agus.companion"
out = ui.OUT
out.mkdir(parents=True, exist_ok=True)
fixture = Path(__file__).with_name("companion-review-fixture.mjs")

def ident(name):
    return f"{ui.APP}:id/{name}"

def screen(name, title):
    ui.until(lambda: any(node.get("resource-id") == ident("screen_title") and node.get("text") == title
                         for node in ui.tree().iter("node")), "Missing screen: " + title)
    capture(name)
    ui.record(title)

def capture(name):
    # Capture through ADB rather than reconstructing the UI from fixture data.
    (out / (name + ".png")).write_bytes(subprocess.check_output(
        [ui.ADB, "-s", "emulator-5554", "exec-out", "screencap", "-p"], timeout=20))

def back():
    ui.adb("shell", "input", "keyevent", "4")

def run():
    ui.adb("shell", "input", "keyevent", "82")
    ui.adb("shell", "wm", "size", "400x890")
    ui.adb("shell", "wm", "density", "160")
    ui.adb("reverse", "tcp:18768", "tcp:18768")
    ui.adb("install", os.environ["AGUS_COMPANION_APK"], timeout=60)
    subprocess.run(["node", str(fixture), "register"], check=True)
    ui.adb("shell", "am", "start", "-W", "-n", ui.APP + "/.MainActivity")
    screen("01-welcome", "Put your phone to work. Get paid.")
    ui.tap(ident("welcome_get_started"))
    screen("02-auth", "Your AGUS account")
    ui.tap(ident("auth_use_email"))
    screen("02-email", "Continue with email")
    back()
    ui.tap(ident("auth_use_password"))
    for field, value in [("origin", "http://127.0.0.1:18768"), ("email", "reviewer@example.invalid"),
                         ("password", "CompanionReviewOnly123")]:
        ui.fill(ident("auth_" + field), value)
    ui.tap(ident("auth_sign_in"))
    ui.tap(ident("open_enrollment"))
    screen("03-enrollment", "Set up your device")
    ui.tap(ident("generate_pairing"))
    ui.tap("Copy pairing code")
    ui.record("Generated and copied a server-issued pairing code")
    subprocess.run(["node", str(fixture), "seed", str(out), os.environ["AGUS_WORKLOAD_APK"]], check=True)
    back()
    screen("04-home", "Your device is ready")
    ui.tap(ident("open_my_device"))
    screen("05-device", "My Device")
    back()
    ui.tap(ident("tab_activity"))
    screen("06-activity", "Activity")
    ui.tap("Review job details")
    screen("07-job-details", "Job Details")
    ui.tap(ident("invitation_accept"))
    ui.tap("Accept", scroll=False)
    screen("08-running", "Running session")
    ui.tap(ident("session_stop"), scroll=False)
    ui.tap("Request stop", scroll=False)
    screen("09-completed", "Session cancelled")
    back()
    ui.tap(ident("tab_earnings"))
    screen("10-earnings", "Earnings")
    ui.tap(ident("tab_home"))
    ui.tap("Profile", scroll=False)
    screen("11-profile", "Profile")
    back()
    ui.tap("Inbox", scroll=False)
    screen("12-inbox", "Inbox")
    back()
    ui.adb("shell", "wm", "size", "320x720")
    ui.adb("shell", "settings", "put", "system", "font_scale", "1.15")
    screen("13-narrow-home", "Your device is ready")
    ui.adb("shell", "wm", "size", "400x890")
    ui.adb("shell", "settings", "put", "system", "font_scale", "1.0")
    ui.tap("Profile", scroll=False)
    ui.tap(ident("auth_sign_out"))
    ui.tap("Sign out", scroll=False)
    ui.tap(ident("welcome_get_started"))
    ui.tap(ident("auth_use_email"))
    ui.fill(ident("auth_email"), "reviewer@example.invalid")
    ui.tap(ident("auth_email_send"))
    screen("02-email-code", "Check your inbox")
    otp = Path(os.environ["AGUS_REVIEW_DATA"]) / "review-otp.txt"
    ui.fill(ident("auth_email_code"), otp.read_text().strip())
    ui.tap(ident("auth_email_verify"))
    screen("14-email-session", "Your device is ready")

try:
    run()
except Exception:
    capture("failure")
    print(ui.adb("logcat", "-d", "-s", "AgusCompanion:W", "AndroidRuntime:E"), flush=True)
    print("Visible app controls:", [(node.get("text"), node.get("resource-id"))
        for node in ui.tree().iter("node") if node.get("package") == ui.APP], flush=True)
    raise
finally:
    (out / "visual-checks.json").write_text(json.dumps({
        "scope": "Android 15 emulator, real Companion, disposable local API and test workload metadata",
        "screens": ui.marks,
    }, indent=2) + "\n")
