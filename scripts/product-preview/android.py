"""Drive only visible controls on the disposable Android 35 preview image."""
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

ADB = str(Path(os.environ["ANDROID_HOME"]) / "platform-tools" / "adb")
OUT = Path(sys.argv[1])
APP = "app.agus.runtime.preview"
JOURNEY = os.environ.get("AGUS_PREVIEW_JOURNEY", "full")
FIXTURE = "org.example.agus.checklist" if JOURNEY in ("partner", "signer") else "app.agus.preview.fixture"
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


def bounds(node):
    return tuple(map(int, re.findall(r"\d+", node.get("bounds", ""))))


def touch(labels):
    root = tree()
    scroll_view = next((node for node in root.iter("node") if node.get("package") == APP
                        and node.get("class") == "android.widget.ScrollView"), None)
    scrolled = set(scroll_view.iter("node")) if scroll_view is not None else set()
    for node in root.iter("node"):
        label = (node.get("text") or node.get("content-desc") or "").lower()
        identifier = node.get("resource-id", "").lower()
        match = next((value for value in (identifier, label) if value in labels), None)
        if match and node.get("enabled") == "true":
            x0, y0, x1, y1 = bounds(node)
            if node in scrolled:
                left, top, right, bottom = bounds(scroll_view)
                x0, y0, x1, y1 = max(x0, left), max(y0, top), min(x1, right), min(y1, bottom)
            if x1 <= x0 or y1 - y0 < 14:
                continue
            x, y = (x0 + x1) // 2, (y0 + y1) // 2
            print(f"Touch {node.get('package')} {match!r} at ({x}, {y})", flush=True)
            adb("shell", "input", "tap", str(x), str(y))
            return match
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
                left, top, right, bottom = bounds(scroll_view)
                x = str((left + right) // 2)
                y0 = str(top + (bottom - top) // 4)
                y1 = str(top + (bottom - top) * 3 // 4)
                if (count // 2) % 6 in (4, 5, 0):
                    y0, y1 = y1, y0
                adb("shell", "input", "swipe", x, y1, x, y0, "440")
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
    enrollments = 0
    finished = 0
    modes = {"full": ("human", "owner-stop", "offline", "cooperative"),
             "safety": ("owner-stop", "offline"), "cooperative": ("cooperative",),
             "partner": ("cooperative",), "signer": ("cooperative",), "correction": ("human",)}[JOURNEY]
    for number, mode in enumerate(modes, start=1):
        if number == 1 or mode == "cooperative":
            kind = "cooperative" if mode == "cooperative" else "human"
            tap("Enroll this phone for " + kind + " testing")
            enrollments += 1
            expect("PROFILE_RUNTIME_ENROLLED", enrollments)
        if number == 1:
            tap("Enable stop notification")
            tap("Allow", scroll=False)
        tap("Open foreground window")
        expect("PROFILE_WINDOW_OPEN", number)
        tap("Show my assignments")
        if JOURNEY == "partner":
            adb("install", "--user", profile, str(OUT / "partner.apk"))
            assert package_present(profile)
            tap("Accept reviewed assignment")
            tap("Authorize", scroll=False)
            expect("PROFILE_PACKAGE_COLLISION_REJECTED")
            assert "PROFILE_LEASE_CLAIMED" not in log() and package_present(profile)
            adb("uninstall", "--user", profile, FIXTURE)
            assert not package_present(profile)
            record("A pre-existing independent publisher package prevented lease admission and was left intact")
        tap("Accept reviewed assignment")
        tap("Authorize", scroll=False)
        expect("PROFILE_LEASE_CLAIMED", number)
        tap("Allow Android installation source")
        if number == 1:
            tap("Allow from this source", scroll=False)
            adb("shell", "input", "keyevent", "KEYCODE_BACK")
        if JOURNEY == "safety" and mode == "owner-stop":
            backend = int(os.environ["AGUS_PREVIEW_BACKEND_PID"])
            os.kill(backend, signal.SIGSTOP)
            try:
                tap("Stage reviewed APK")
                expect("PROFILE_INSTALL_POLICY_RESTORED")
                assert not package_present(profile)
            finally:
                os.kill(backend, signal.SIGCONT)
            record("Failed APK download restored the Android install restriction")
            tap("Allow Android installation source")
        tap("Stage reviewed APK")
        if JOURNEY == "signer":
            expect("PROFILE_INSTALL_POLICY_RESTORED")
            expect("PROFILE_SIGNER_REJECTED")
            assert not package_present(profile) and "install_status_0" not in log()
            tap("Stop test now")
            tap("Confirm clean profile")
            expect("PROFILE_CLEANED")
            record("A reviewed digest with a mismatched publisher certificate never reached Android installation")
            break
        confirm_action("install_status_0", number, {"review android confirmation", "install", "ok"})
        assert package_present(profile) and not package_present("0")
        if mode != "offline":
            tap("Launch reviewed fixture")
        if mode == "human":
            tap("Continue")
            tap("Return to review")
            tap("Continue")
            until(lambda: any(node.get("text") == "Onboarding submissions: 2" for node in tree().iter("node")),
                  "Did not reproduce the second onboarding submission")
            tap("Finish attended test")
        if mode == "owner-stop":
            tap("Continue")
            adb("shell", "cmd", "statusbar", "expand-notifications")
            tap("Stop test", scroll=False)
            expect("WATCHDOG_OWNER_STOP")
            adb("shell", "cmd", "statusbar", "collapse")
            expect("WATCHDOG_SERVER_FENCED")
        if mode == "offline":
            # Expire after staging and before launch, so the test APP cannot trigger its own stop.
            backend = int(os.environ["AGUS_PREVIEW_BACKEND_PID"])
            os.kill(backend, signal.SIGSTOP)
            try:
                until(lambda: "WATCHDOG_AUTHORITY_LOST" in log(), "Offline watchdog did not stop", 57)
            finally:
                os.kill(backend, signal.SIGCONT)
        successful = mode in ("human", "cooperative")
        if successful:
            finished += 1
            expect("PROFILE_REPORT_VERIFIED", finished)
        else:
            until(lambda: "suspended=true" in adb("shell", "dumpsys", "package", FIXTURE),
                  "Android did not mark the stopped fixture suspended")
            open_work(profile)
        tap("Remove fixture")
        confirm_action("remove_status_0", number, {"review android confirmation", "uninstall", "ok"})
        until(lambda: not package_present(profile), "Fixture remains installed")
        tap("Confirm clean profile")
        expect("PROFILE_CLEANED", number)
        if successful:
            tap("Show my assignments")
            tap("Prepare structured submission")
            fill("Reproduction steps, one per line", "Open%sonboarding%sand%sinspect%sthe%sreview")
            fill("Expected outcome", "One%sonboarding%ssubmission")
            fill("Actual outcome", "Duplicate%ssubmission%sobserved" if mode == "human" else "Automated%sstep%spassed")
            if JOURNEY == "correction":
                reference = json.loads((OUT / "correction-reference.json").read_text())
                fill("Recorded action index starting at zero", str(reference["actionIndex"]))
            tap("Review submission", scroll=False)
            tap("Send report", scroll=False)
            expect("PERSON_SUBMISSION_SAVED", finished)
            record(mode + " profile enrollment, signed evidence, cleanup and submission passed")
            if mode == "human":
                tap("Show my assignments")
                tap("Training consent")
                tap("Grant", scroll=False)
                tap("Show my assignments")
        else:
            record(mode + " independently suspended the fixture and confirmed cleanup")
        if mode == "offline" and "cooperative" in modes:
            tap("Revoke installation")
            tap("Revoke", scroll=False)
    tap("Remove test work profile")
    tap("Remove profile", scroll=False)
    until(lambda: user() is None, "Disposable work profile remains")
    open_work("0")
    assert not package_present("0")
    record("Personal launcher restored after removing the test profile")


if __name__ == "__main__":
    try:
        run()
    except Exception:
        print("Final synthetic screen:", [item.get("text") for item in tree().iter("node") if item.get("text")], flush=True)
        print("Focus:", next((line.strip() for line in adb("shell", "dumpsys", "window").splitlines()
                              if "mCurrentFocus=" in line), "not reported"), flush=True)
        print(adb("logcat", "-d", "-t", "1000", "-s", "AndroidRuntime:E", "*:S"), flush=True)
        raise
    finally:
        (OUT / "android-checks.json").write_text(json.dumps(marks, indent=2) + "\n")
        (OUT / "android-markers.log").write_text(log() + "\n")
        print(log(), flush=True)
