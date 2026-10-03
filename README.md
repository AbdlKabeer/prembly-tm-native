# prembly-tm-native

Device signals for Prembly **Transaction Monitoring**, for React Native (iOS and Android).

The SDK reads signals from the phone (a stable device ID, whether it is rooted or an emulator, VPN and
proxy, screen sharing, and optionally location) and gives your app a short-lived **device session ID**.
Your backend passes that ID when it screens a transaction, so Prembly's rules can use what the device
looked like at that moment: a new device, a rooted phone, many customers on one phone, and so on.

- **Headless:** no UI, no prompts.
- **Never holds your secret key:** the app only uses your public key.
- **Fails open:** if anything goes wrong it returns no session and your payment carries on.
- **Typed:** ships its own TypeScript types.

## How it fits together

```
 your app (this SDK)               your backend                      Prembly
 ───────────────────               ────────────                      ───────
 getDeviceSession() ───────────────────────────────────────────────▶ POST /sdk/v1/sessions
        ◀──────────────────────────────────────────────────────────  device_session_id
 payment + device_session_id ─────▶ screen-transaction ────────────▶ decision (uses the signals)
                                    (secret key)
```

1. The app uses your **public** key (`live_pk_…` or `test_pk_…`) to create a device session.
2. The app sends its normal request plus the `deviceSessionId` to **your** backend.
3. Your backend screens the transaction with your **secret** key and passes `device_session_id`.
   Prembly joins the stored signals to that transaction.

Never put a secret key (`live_sk_…` / `test_sk_…`) in an app. `init` throws if you try.

## Requirements

| | |
|---|---|
| React Native | New Architecture (TurboModules) |
| iOS | 15.1 or later |
| Android | 7.0 or later (API 24) |
| Expo | Development build or prebuild. **Not Expo Go**, because the SDK contains native code. |
| Prembly | Transaction Monitoring enabled for your organisation, and your public key |

## Install

```sh
npm install prembly-tm-native
# or: yarn add prembly-tm-native
cd ios && pod install
```

With Expo, install the package and then run `npx expo run:ios` or `npx expo run:android` (or an EAS
development build). There is no config plugin to add.

## Quick start

```ts
import { PremblyTM } from 'prembly-tm-native';

// 1. Once, early (for example when the app starts). Use test_pk_... while developing.
PremblyTM.init({ publishableKey: 'test_pk_xxxxxxxx' });

// 2. When the customer signs in (and null when they sign out).
PremblyTM.identify('CUST-123');

// 3. Before a sensitive action: sign-in, payment, adding a beneficiary.
const session = await PremblyTM.getDeviceSession();

// 4. Send it with your normal request. deviceSessionId is null if no session could be created:
//    send the request anyway and your backend screens without it.
await fetch('https://your-backend.example.com/payments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ amount, to, deviceSessionId: session.deviceSessionId }),
});
```

A session is reused until shortly before it expires (about 15 minutes), so calling
`getDeviceSession()` before every action is cheap. Pass `{ forceRefresh: true }` to make a new one.

### On your backend

Your server screens the transaction with your **secret** key and passes the session ID along:

```sh
curl -X POST https://backend.prembly.com/api/v1/fraud/transaction-monitoring/screen-transaction \
  -H "X-API-KEY: $PREMBLY_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "TXN-1001",
    "amount": 25000,
    "currency": "NGN",
    "transaction_type": "transfer",
    "customer_id": "CUST-123",
    "device_session_id": "dsess_..."
  }'
```

The response says whether the session was used:

```json
{ "data": { "status": "pending_review", "risk_score": 70,
            "device_session": { "used": true, "reason": "" } } }
```

If the session is missing, expired, or from the other environment (a `test_pk_` session cannot screen a
live transaction), screening still works as before and `device_session.reason` tells you why:
`no_session_sent`, `session_not_found` or `session_expired`.

Use a `test_pk_…` key with your sandbox secret key, and `live_pk_…` with your live secret key.

## API

| Call | What it does |
|---|---|
| `PremblyTM.init({ publishableKey, baseUrl?, location?, timeoutMs?, debug? })` | Set up once. Throws if the key is not a public key. |
| `PremblyTM.identify(customerId \| null)` | Tell the SDK who is using the app. |
| `PremblyTM.getDeviceSession({ forceRefresh? })` | Returns `{ deviceSessionId, deviceId, isKnownDevice, expiresAt, error }`. Never throws. |
| `PremblyTM.setLocationEnabled(boolean)` | Turn location on or off, for example when the user's consent changes. |
| `PremblyTM.getSignalsPreview()` | The signals that would be sent, without sending anything. Useful for testing. |
| `PremblyTM.getDeviceId()` | The app-scoped device ID, or `null`. |
| `PremblyTM.reset()` | Forget the customer and the cached session (on sign-out). |

**`init` options**

| Option | Default | |
|---|---|---|
| `publishableKey` | required | `live_pk_…` or `test_pk_…` |
| `baseUrl` | `https://backend.prembly.com` | Override for a staging server |
| `location` | `false` | Include location. See [Privacy](#privacy-and-permissions) |
| `timeoutMs` | `5000` | How long to wait before failing open |
| `debug` | `false` | Log what the SDK does |

When `deviceSessionId` is `null`, `error` says why:

| `error` | Meaning |
|---|---|
| `not_initialised` | `init` was not called |
| `timeout` | No answer within `timeoutMs` |
| `network_error` | The request could not be made |
| `unauthorised` | Wrong key, or this app is not allowed for your organisation |
| `rate_limited` | Too many requests from this key or this device |
| `rejected` | The request was refused (HTTP 4xx) |
| `server_error` | Prembly returned an error (HTTP 5xx) |
| `native_error` | The device could not be read |

## What is collected

| Section | Signals |
|---|---|
| `device` | Type, model, manufacturer, OS and version, app version and build, language, timezone |
| `integrity` | Rooted or jailbroken, emulator, debugger attached, screen lock set; on Android also developer options and USB debugging |
| `network` | Connection type, VPN active, proxy configured |
| `scam_signals` | Screen shared or recorded; on Android, a known remote-access app's accessibility service enabled (and whether one is installed) |
| `location` | Latitude, longitude, accuracy and whether it is mocked. **Only when you turn it on**, and the app already holds the permission |

Also sent: an app-scoped device ID, the customer ID you pass to `identify`, and the consent flag. The
IP address comes from the network request itself; the SDK never reports it.

**Never collected:** advertising ID, IMEI, MAC address, serial number, contacts, messages, clipboard,
or a list of installed apps (only a short list of named remote-access and root-manager packages is
checked, see below).

### What Prembly does with it

Prembly turns these signals into attributes your rules can use, for example `is_rooted`, `is_emulator`,
`is_vpn_active`, `is_screen_shared_or_recorded`, `remote_access_app_running`, and values it works out
itself that the app cannot influence: `is_new_device`, `device_age_days`, `customers_per_device` and
`devices_per_customer_30d`. They appear in the rule builder alongside your other attributes.

### The device ID

- **iOS:** a random ID kept in the Keychain, marked "this device only". It survives an app reinstall and
  is not copied to another device by a backup.
- **Android:** a random ID in a file the OS excludes from backup. It is removed when the app is
  uninstalled, so a reinstall gets a new ID.

## Privacy and permissions

- The SDK **never shows a permission prompt**. Location is collected only when you call
  `init({ location: true })` or `setLocationEnabled(true)` **and** your app already holds the location
  permission. Turn it on only after the user has consented.
- **Android** adds one normal permission (no prompt): `ACCESS_NETWORK_STATE`.
- **Android package visibility:** the SDK's manifest declares a short, fixed list of packages with
  `<queries>` (remote-access apps and root managers). It does not use `QUERY_ALL_PACKAGES`. Google Play
  asks you to justify package visibility; the reason is fraud prevention (spotting customers who are
  being remotely controlled, and rooted devices).
- **iOS:** add the location usage text to your app if you turn location on. The SDK itself uses only the
  Keychain, the network state, the device lock state and (optionally) the last known location.
- Declare the data in your App Store privacy details and Google Play data-safety form: device
  identifiers, device and security information, and (optionally) approximate or precise location, used
  for fraud prevention.

## Failing open

`getDeviceSession()` never throws and waits at most `timeoutMs`. On any failure it returns
`{ deviceSessionId: null, error }`. Send the payment anyway: your backend screens without the device
signals, exactly as it did before you added the SDK. A missing SDK session should never block a payment.

## Troubleshooting

- **`unauthorised`:** check that the key is your organisation's public key for the right environment
  (`test_pk_` for sandbox, `live_pk_` for live), and that your app's bundle ID or package name is on your
  organisation's allowed-apps list, if you have one.
- **`network_error` on an Android emulator:** `localhost` there is the emulator itself. Use
  `http://10.0.2.2:<port>` for a server on your computer, or run `adb reverse tcp:<port> tcp:<port>`.
- **`device_session.used` is `false` on your backend:** the session expired (about 15 minutes), came from
  the other environment, or was not sent. Call `getDeviceSession()` shortly before the payment.
- **Every test transaction looks like an emulator:** that is correct on a simulator or emulator. Test
  on a real device to see real signals.
- **Module not found / TurboModule not found:** run `pod install` on iOS, rebuild the native app, and
  make sure you are not running in Expo Go.
- **Debugging:** set `debug: true` in `init`, or call `getSignalsPreview()` to see exactly what would be
  sent.

## Limits to know about

- Signals the app reports can be faked by an app that has been modified. Treat them as evidence for
  scoring and review; Prembly also works out signals of its own that the app cannot influence.
- Root and jailbreak detection is best effort.
- iOS cannot see which other apps are running, so `remote_access_app_running` is always `false` there.
- Android cannot see running apps either. The SDK reports `remote_access_app_running` when a known
  remote-access app has an **enabled accessibility service**, which is what remote control needs.
- Platform attestation (Play Integrity, App Attest) is not in this version.

## Changelog

- **0.1.2:** repository, issues and homepage links now point to `AbdlKabeer/prembly-tm-native`.
- **0.1.1:** package renamed to `prembly-tm-native`; README rewritten.
- **0.1.0:** first release.

## Development

```sh
yarn                  # install
yarn test             # unit tests (TypeScript layer)
yarn typecheck && yarn lint
yarn example ios      # run the example app on the iOS simulator
yarn example android  # run it on an Android emulator
```

The example app lets you enter a base URL, a public key and a customer ID, preview the signals, and
create a session.

The signal collection lives in framework-free files (`ios/TMSignalCollector.*`,
`android/.../SignalCollector.kt`) so a Flutter plugin can reuse them.

## Support

Questions or problems: olanrewaju@prembly.com

## License

MIT
