"""Drive only visible controls on the disposable Android 35 preview image."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

ADB = str(Path(os.environ["ANDROID_HOME"]) / "platform-tools" / "adb")
OUT = Path(sys.argv[1])
APP = "app.agus.runtime.preview"
FIXTURE = "app.agus.preview.fixture"
marks = []


def adb(*args, timeout=25):
    return subprocess.check_output([ADB, "-s", "emulator-5554", *args], text=True,
                                   stderr=subprocess.STDOUT, timeout=timeout).strip()


def until(condition, name, seconds=45):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        value = condition()
        if value:
            return value
        time.sleep(0.5)
    raise AssertionError(name)


def tree():
    try:
        result = adb("shell", "uiautomator", "dump", "/data/local/tmp/agus-product.xml", timeout=12)
        if "dumped to" not in result.lower():
            return ET.Element("empty")
        return ET.fromstring(adb("shell", "cat", "/data/local/tmp/agus-product.xml"))
    except (ET.ParseError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return ET.Element("empty")


def touch(labels):
    for node in tree().iter("node"):
        label = (node.get("text") or node.get("content-desc") or "").lower()
        if label in labels and node.get("enabled") == "true":
            x0, y0, x1, y1 = map(int, re.findall(r"\d+", node.get("bounds")))
            adb("shell", "input", "tap", str((x0 + x1) // 2), str((y0 + y1) // 2))
            return label
    return None


def tap(label, scroll=True):
    count = 0

    def find():
        nonlocal count
        clicked = touch({label.lower()})
        count += 1
        if not clicked and scroll and count % 2 == 0:
            scroll_view = next((node for node in tree().iter("node") if node.get("package") == APP
                                and node.get("class") == "android.widget.ScrollView"), None)
            if scroll_view is not None:
                left, top, right, bottom = map(int, re.findall(r"\d+", scroll_view.get("bounds")))
                x = str((left + right) // 2)
                y0 = str(top + (bottom - top) // 4)
                y1 = str(top + (bottom - top) * 3 // 4)
                if (count // 2) % 6 in (4, 5, 0):
                    y0, y1 = y1, y0
                adb("shell", "input", "swipe", x, y1, x, y0, "220")
        return clicked
    return until(find, "Missing visible control: " + label)


def fill(hint, value):
    tap(hint)
    adb("shell", "input", "text", value)
    print("Entered synthetic field:", hint, flush=True)



def log():
    return adb("logcat", "-d", "-v", "brief", "-s", "AgusPreview:I", "*:S")


def expect(marker, count=1):
    until(lambda: log().count(marker) >= count, "Missing marker: " + marker)


def user():
    return next((value for value in re.findall(r"UserInfo\{(\d+):", adb("shell", "pm", "list", "users"))
                 if value != "0"), None)


def record(text):
    marks.append(text)
    print(text, flush=True)


def open_work(profile):
    assert "Error" not in adb("shell", "am", "start", "--user", profile, "-n", APP + "/.RuntimeActivity")


def package_present(profile):
    return "package:" + FIXTURE in adb("shell", "pm", "list", "packages", "--user", profile, FIXTURE).splitlines()


def confirm_action(marker, count, labels):
    def finish():
        if log().count(marker) >= count:
            return True
        touch(labels)
        return False
    until(finish, "Android package result unavailable: " + marker)


def run():
    assert adb("shell", "id", "-u") == "2000"
    assert adb("shell", "getprop", "ro.build.version.sdk") == "35" and not user()
    assert "1" in [adb("shell", "getprop", "ro.kernel.qemu"), adb("shell", "getprop", "ro.boot.qemu")]
    adb("shell", "input", "keyevent", "KEYCODE_WAKEUP")
    adb("shell", "input", "keyevent", "82")
    adb("logcat", "-c")
    adb("install", str(OUT / "runtime.apk"))
    open_work("0")
    tap("Set up test work profile")
    approvals = []

    def provision():
        label = touch({"accept & continue", "next", "got it"})
        if label:
            approvals.append(label)
        return user() if "next" in approvals else None

    profile = until(provision, "Android provisioning did not finish", 130)
    assert "accept & continue" in approvals
    open_work(profile)
    record("Android-managed profile created with visible system approval")
    fill("Preview account email", "reviewer@example.invalid")
    fill("Preview password", "DisposablePilotPassword123")
    tap("Sign in to AGUS")
    expect("PROFILE_PERSON_AUTHENTICATED")
    for number, mode in enumerate(("human", "cooperative"), start=1):
        tap("Enroll this phone for " + mode + " testing")
        expect("PROFILE_RUNTIME_ENROLLED", number)
        if number == 1:
            tap("Enable stop notification")
            tap("Allow", scroll=False)
        tap("Open foreground window")
        expect("PROFILE_WINDOW_OPEN", number)
        tap("Show my assignments")
        tap("Accept reviewed assignment")
        tap("Authorize", scroll=False)
        expect("PROFILE_LEASE_CLAIMED", number)
        tap("Allow Android installation source")
        if number == 1:
            tap("Allow from this source", scroll=False)
            adb("shell", "input", "keyevent", "KEYCODE_BACK")
        tap("Stage reviewed APK")
        confirm_action("install_status_0", number, {"review android confirmation", "install", "ok"})
        assert package_present(profile) and not package_present("0")
        tap("Launch reviewed fixture")
        if mode == "human":
            tap("Continue")
            tap("Return to review")
            tap("Continue")
            until(lambda: any(node.get("text") == "Onboarding submissions: 2" for node in tree().iter("node")),
                  "Did not reproduce the second onboarding submission")
            tap("Finish attended test")
        expect("PROFILE_REPORT_VERIFIED", number)
        tap("Remove fixture")
        confirm_action("remove_status_0", number, {"review android confirmation", "uninstall", "ok"})
        until(lambda: not package_present(profile), "Fixture remains installed")
        tap("Confirm clean profile")
        expect("PROFILE_CLEANED", number)
        tap("Show my assignments")
        tap("Prepare structured submission")
        fill("Reproduction steps, one per line", "Open%sonboarding%sand%sinspect%sthe%sreview")
        fill("Expected outcome", "One%sonboarding%ssubmission")
        fill("Actual outcome", "Duplicate%ssubmission%sobserved" if mode == "human" else "Automated%sstep%spassed")
        tap("Review submission")
        tap("Send report", scroll=False)
        expect("PERSON_SUBMISSION_SAVED", number)
        record(mode + " profile enrollment, signed evidence, cleanup and submission passed")
        if mode == "human":
            tap("Revoke installation")
            tap("Revoke", scroll=False)
    tap("Remove test work profile")
    tap("Remove profile", scroll=False)
    until(lambda: user() is None, "Disposable work profile remains")
    open_work("0")
    assert not package_present("0")
    record("Personal launcher restored after removing the test profile")


try:
    run()
except Exception:
    print("Final synthetic screen:", [item.get("text") for item in tree().iter("node") if item.get("text")], flush=True)
    print(adb("logcat", "-d", "-t", "1000", "-s", "AndroidRuntime:E", "*:S"), flush=True)
    raise
finally:
    (OUT / "android-checks.json").write_text(json.dumps(marks, indent=2) + "\n")
    (OUT / "android-markers.log").write_text(log() + "\n")
    print(log(), flush=True)
