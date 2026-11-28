"""Approve an off-chain payout ownership proof through the pinned Fake Wallet UI."""
import json
from urllib.request import Request, urlopen

import android as ui

ui.APP = "app.agus.companion"
WALLET = "com.solana.mobilewalletadapter.fakewallet"
ORIGIN = "http://127.0.0.1:18767"
PERSON = {"email": "companion-wallet@example.invalid", "password": "DisposableWalletPreview123"}


def request(path, credentials=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    body = json.dumps(credentials).encode() if credentials else None
    with urlopen(Request(ORIGIN + "/api/v1" + path, data=body, headers=headers), timeout=5) as response:
        return json.load(response)


def observe(package, key, value):
    ui.until(lambda: any(node.get("package") == package and node.get(key) == value and node.get("enabled") == "true"
                         for node in ui.tree().iter("node")), "Missing visible state: " + value)


def sign(button):
    observe(WALLET, "resource-id", WALLET + ":id/btn_authorize_x3")
    ui.tap(WALLET + ":id/btn_authorize", scroll=False)
    observe(WALLET, "resource-id", WALLET + ":id/text_sign_payloads")
    ui.tap(WALLET + ":id/" + button, scroll=False)


def run():
    assert ui.adb("shell", "getprop", "ro.build.version.sdk") == "35" and not ui.user()
    assert "1" in [ui.adb("shell", "getprop", "ro.kernel.qemu"), ui.adb("shell", "getprop", "ro.boot.qemu")]
    registered = request("/auth/register", PERSON)
    token = registered["token"]
    ui.adb("shell", "input", "keyevent", "82")
    ui.adb("reverse", "tcp:18767", "tcp:18767")
    ui.adb("install", str(ui.OUT / "companion.apk"))
    ui.adb("install", str(ui.OUT / "fakewallet.apk"))
    ui.adb("shell", "am", "start", "-n", ui.APP + "/.MainActivity")
    ui.tap("Get started")
    ui.tap(ui.APP + ":id/auth_use_password")
    for field, value in (("origin", ORIGIN), ("email", PERSON["email"]), ("password", PERSON["password"])):
        ui.fill(ui.APP + ":id/auth_" + field, value)
    ui.tap(ui.APP + ":id/auth_sign_in")
    ui.tap("Profile")
    ui.tap("Verify test wallet")
    sign("btn_decline")
    ui.tap("Verify test wallet")
    assert request("/me/payout-wallet", token=token)["payoutWallet"] is None
    ui.record("Declined signature leaves the account without a verified payout wallet")
    sign("btn_authorize")
    ui.tap("Disconnect payout wallet")
    opened = request("/me/payout-wallet", token=token)["payoutWallet"]
    assert opened["verifiedAt"] and opened["address"]
    ui.record("Signed MWA ownership message verified by the local control plane")
    ui.tap("Disconnect", scroll=False)
    ui.until(lambda: request("/me/payout-wallet", token=token)["payoutWallet"] is None,
             "Disconnect did not clear the verified destination")
    ui.record("Disconnect cleared the verified destination")


try:
    run()
except Exception:
    print("Visible controls:", [(node.get("package"), node.get("resource-id")) for node in ui.tree().iter("node")
                                if node.get("clickable") == "true" and node.get("resource-id")], flush=True)
    raise
finally:
    (ui.OUT / "wallet-ownership.json").write_text(json.dumps({"scope": "AOSP and disposable Fake Wallet, off-chain signatures",
                                                              "checks": ui.marks}, indent=2) + "\n")
