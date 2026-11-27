#!/usr/bin/env python3
"""Observe a disposable API 35 emulator using ADB only for bootstrap, taps and observations."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

SERIAL = os.environ.get("AGUS_PHASE1_SERIAL", "emulator-5554")
if not re.fullmatch(r"emulator-\d+", SERIAL):
    raise SystemExit("A disposable emulator serial is required")
APK = Path(sys.argv[1])
OUT = Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
APP = "app.agus.phase1"
FIXTURE = APP + ".fixture"
results = []


def adb(*args, timeout=60):
    command = [str(Path(os.environ["ANDROID_HOME"]) / "platform-tools" / "adb"), "-s", SERIAL, *args]
    return subprocess.check_output(command, text=True, stderr=subprocess.STDOUT, timeout=timeout).strip()


def eventually(check, description, seconds=60):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        value = check()
        if value:
            return value
        time.sleep(1)
    raise AssertionError(description)


def record(check, detail=None):
    print(check, detail or "", flush=True)
    results.append({"check": check, "detail": detail})


def markers():
    return adb("logcat", "-d", "-v", "brief", "-s", "AgusPhase1:I", "*:S")


def mark(name, count=1):
    eventually(lambda: markers().count(name) >= count, f"Missing marker {name} #{count}")


def ui():
    try:
        adb("shell", "uiautomator", "dump", "/data/local/tmp/agus-phase1.xml", timeout=15)
        return ET.fromstring(adb("shell", "cat", "/data/local/tmp/agus-phase1.xml", timeout=10))
    except (ET.ParseError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return ET.Element("empty")


def click(texts, tree=None):
    nodes = (ui() if tree is None else tree).iter("node")
    for node in nodes:
        label = (node.get("text") or node.get("content-desc") or "").strip().lower()
        if label not in texts or node.get("enabled") != "true":
            continue
        x1, y1, x2, y2 = map(int, re.findall(r"\d+", node.get("bounds", "")))
        adb("shell", "input", "tap", str((x1 + x2) // 2), str((y1 + y2) // 2))
        return label
    return None


def tap(text):
    return eventually(lambda: click({text.lower()}), f"UI action unavailable: {text}", 55)


def profile():
    users = adb("shell", "pm", "list", "users")
    return next((user for user in re.findall(r"UserInfo\{(\d+):", users) if user != "0"), None)


def installed(user, package):
    return f"package:{package}" in adb("shell", "pm", "list", "packages", "--user", user, package).splitlines()


def activate(user):
    output = adb("shell", "am", "start", "--user", user, "-n", APP + "/.Controller")
    if "Error" in output or "Exception" in output:
        raise AssertionError(output)


def package_operation(kind, count):
    deadline = time.monotonic() + 65
    while time.monotonic() < deadline:
        log = markers()
        if log.count(kind + "_SUCCESS") >= count:
            return
        if kind + "_ANDROID_CONFIRMATION_REQUIRED" in log:
            click({"review android package operation", "install", "uninstall", "ok"})
        time.sleep(1)
    raise AssertionError(f"Package operation failed: {kind} #{count}")


def run():
    sdk = adb("shell", "getprop", "ro.build.version.sdk")
    if sdk != "35" or adb("shell", "getprop", "ro.kernel.qemu") != "1" or profile() or installed("0", APP):
        raise AssertionError("Expected a clean, disposable API 35 emulator")
    if not adb("shell", "cmd", "package", "has-feature", "android.software.managed_users") == "true":
        raise AssertionError("System image does not advertise managed users")
    if adb("shell", "id", "-u") != "2000":
        raise AssertionError("ADB harness must run as unprivileged shell")
    record("environment", {"sdk": sdk, "fingerprint": adb("shell", "getprop", "ro.build.fingerprint"),
                           "harnessUid": 2000})
    adb("shell", "input", "keyevent", "KEYCODE_WAKEUP")
    adb("shell", "input", "keyevent", "82")
    adb("logcat", "-c")
    adb("install", str(APK))
    activate("0")
    tap("Create testing profile")
    mark("PARENT_CANARY_POSITIVE_CONTROL")
    progress = {"accept & continue", "accept and continue", "agree", "continue", "next", "set up",
                "set up work profile", "got it", "done", "i agree", "start"}
    approvals = []
    seen_screens = set()

    def provisioned():
        if "PROFILE_OWNER_POLICY_APPLIED" in markers() and profile():
            return profile()
        tree = ui()
        screen = tuple(node.get("text") for node in tree.iter("node") if node.get("text"))
        if screen and screen not in seen_screens:
            seen_screens.add(screen)
            print("provisioning screen:", screen, flush=True)
        approved = click(progress, tree)
        if approved:
            approvals.append(approved)
        return None

    user = eventually(provisioned, "Managed profile provisioning did not complete", 140)
    assert approvals, "No Android provisioning approval click observed"
    record("profile_created_with_android_ui", {"user": user, "consentControls": approvals})
    # Finish any informational transition left on top before opening the work launcher activity.
    click({"next", "got it", "done"})
    activate(user)
    tap("Enroll disposable AGUS account")
    mark("BACKEND_REGISTER_AND_AUTH_ME_OK")
    record("app_registered_and_authenticated_to_existing_control_plane")

    for attempt in (1, 2):
        tap("Install reviewed fixture")
        package_operation("FIXTURE_INSTALL", attempt)
        mark("ARTIFACT_REJECTED", attempt)
        assert installed(user, FIXTURE) and not installed("0", FIXTURE)
        assert not installed(user, APP + ".untrusted") and not installed("0", APP + ".untrusted")
        tap("Run bounded fixture")
        mark("FIXTURE_OWN_VIEW_ADVANCED", attempt)
        mark("FIXTURE_FRESH_STATE", attempt)
        mark("FIXTURE_NO_INTERNET_SOCKET_DENIED", attempt)
        mark("PARENT_EXPLICIT_USER_DENIED", attempt)
        mark("PARENT_CANARY_BLOCKED", attempt)
        if attempt == 1:
            tap("Feedback: clear")
            mark("FIXTURE_EVIDENCE_VERIFIED_CLEAR")
            record("profile_local_install_and_action", {"unreviewedRejected": True, "noParentSentinel": True,
                   "explicitParentDenied": True, "fixtureWithoutInternetSocketDenied": True})
            record("structured_selection_keystore_signature_verified_in_app")
        else:
            tap("Stop fixture now")
            mark("EMERGENCY_STOP_LOCAL")
            record("cooperating_fixture_stop", {"reinstallStartedWithFreshFixtureData": True})
        package_operation("FIXTURE_REMOVE", attempt)
        eventually(lambda: not installed(user, FIXTURE), "Fixture remains installed")
    log = markers()
    assert "FIXTURE_STALE_STATE" not in log and "FIXTURE_SUSPENSION_FAILED" not in log
    assert log.count("FIXTURE_EVIDENCE_VERIFIED_CLEAR") == 1 and "PARENT_CANARY_LEAKED" not in log
    record("two_uninstall_confirmations_with_no_fixture_in_parent")
    tap("Remove testing profile")
    eventually(lambda: not profile(), "Profile remained present")
    activate("0")
    tap("Personal fixture presence check")
    mark("PERSONAL_FIXTURE_ABSENT")
    assert installed("0", APP) and not installed("0", FIXTURE)
    record("profile_removed_personal_app_usable")


try:
    run()
except Exception:
    try:
        tree = ui()
        print("last UI:", [node.get("text") for node in tree.iter("node") if node.get("text")], flush=True)
        (OUT / "last-ui.xml").write_text(ET.tostring(tree, encoding="unicode") + "\n")
        print(adb("shell", "pm", "list", "users"), flush=True)
        print(adb("logcat", "-d", "-t", "800", "-s", "ManagedProvisioning:V", "AndroidRuntime:E", "*:S"), flush=True)
    except Exception:
        pass
    raise
finally:
    (OUT / "checks.json").write_text(json.dumps({"recordedAtUtc": datetime.now(timezone.utc).isoformat(),
                                                "checks": results}, indent=2) + "\n")
    log = markers()
    print(log, flush=True)
    (OUT / "markers.log").write_text(log + "\n")
