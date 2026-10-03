# @prembly/tm-sdk-react-native

Prembly Transaction Monitoring SDK for React Native. It reads signals from the device (device ID,
integrity, network, optional location) and gives your app a short-lived **device session ID**. Your
backend passes that ID when it screens a transaction, so the decision can use what the device
looked like at the time.

The SDK is **headless** (no UI), **never holds your secret key**, and **fails open**: if anything goes
wrong it returns no session and your payment flow carries on.

## How it fits together

```
 app (this SDK)                    your backend                     Prembly
 ──────────────                    ────────────                     ───────
 getDeviceSession() ─────────────────────────────────────────────▶ POST /sdk/v1/sessions
        ◀────────────────────────────────────────────────────────── device_session_id
 send payment + device_session_id ─▶ screen-transaction  ─────────▶ decision (uses the signals)
                                      (secret key)
```

1. The app uses your **public** key (`live_pk_…` or `test_pk_…`) to create a device session.
2. The app sends the transaction request and the `deviceSessionId` to **your** backend.
3. Your backend screens the transaction with your **secret** key and passes
   `device_session_id`. Prembly joins the stored signals to it.

Never put a secret key (`live_sk_…` / `test_sk_…`) in an app. `init` refuses it.

## Install

```sh
npm install @prembly/tm-sdk-react-native
# or: yarn add @prembly/tm-sdk-react-native
cd ios && pod install
```

Requires React Native with the New Architecture (TurboModules). iOS 15.1+ and Android 7.0+ (API 24).
It contains native code, so it does not run in Expo Go; use a development build.

## Use

```ts
import { PremblyTM } from '@prembly/tm-sdk-react-native';

// Once, early (for example when the app starts).
PremblyTM.init({ publishableKey: 'test_pk_xxxxxxxx' });

// When the customer signs in (and null when they sign out).
PremblyTM.identify('CUST-123');

// Before a sensitive action: sign-in, payment, adding a beneficiary.
const session = await PremblyTM.getDeviceSession();

// Send it with your normal request. It is null when no session could be created: send the request
// anyway and your backend screens without it.
await api.post('/payments', { amount, to, deviceSessionId: session.deviceSessionId });
```

Your backend then calls Prembly's `screen-transaction` with `device_session_id`.

A session is reused until shortly before it expires (about 15 minutes), so calling
`getDeviceSession()` before every action is cheap. Pass `{ forceRefresh: true }` to make a new one.

### API

| Call | What it does |
|---|---|
| `PremblyTM.init({ publishableKey, baseUrl?, location?, timeoutMs?, debug? })` | Set up once. Throws if the key is not a public key. |
| `PremblyTM.identify(customerId \| null)` | Tell the SDK who is using the app. |
| `PremblyTM.getDeviceSession({ forceRefresh? })` | Returns `{ deviceSessionId, deviceId, isKnownDevice, expiresAt, error }`. Never throws. |
| `PremblyTM.setLocationEnabled(boolean)` | Turn location on or off, for example when consent changes. |
| `PremblyTM.getSignalsPreview()` | The signals that would be sent, without sending them. |
| `PremblyTM.getDeviceId()` | The app-scoped device ID. |
| `PremblyTM.reset()` | Forget the customer and the cached session (on sign-out). |

When `deviceSessionId` is `null`, `error` says why: `not_initialised`, `timeout`, `network_error`,
`unauthorised`, `rate_limited`, `rejected`, `server_error` or `native_error`.

## What is collected

| Section | Signals |
|---|---|
| `device` | Type, model, manufacturer, OS and version, app version and build, language, timezone |
| `integrity` | Rooted or jailbroken, emulator, debugger attached, device lock set; on Android also developer options and USB debugging |
| `network` | Connection type, VPN active, proxy configured |
| `scam_signals` | Screen shared or recorded; on Android, a known remote-access app's accessibility service enabled (and whether one is installed) |
| `location` | Latitude, longitude, accuracy and whether it is mocked, **only when you turn it on** and the app already holds the permission |

Also sent: an app-scoped device ID, the customer ID you pass to `identify`, and the consent flag.
Your backend's request gives Prembly the IP address; the SDK never reports it.

**Never collected:** advertising ID, IMEI, MAC address, serial number, contacts, messages, clipboard,
or a list of installed apps (only a short list of named remote-access and root-manager packages is
checked, see below).

### The device ID

- **iOS:** a random ID kept in the Keychain, marked "this device only". It survives an app reinstall
  and is not copied to another device by a backup.
- **Android:** a random ID in a file the OS excludes from backup. It is removed when the app is
  uninstalled, so a reinstall gets a new ID.

## Privacy and permissions

- The SDK **never shows a permission prompt**. Location is collected only when you call
  `init({ location: true })` or `setLocationEnabled(true)` **and** your app already holds the location
  permission. Turn it on only after the user has consented.
- **Android** adds one normal permission (no prompt): `ACCESS_NETWORK_STATE`.
- **Android package visibility:** the SDK's manifest declares a short, fixed list of packages with
  `<queries>` (remote-access apps and root managers). It does not use `QUERY_ALL_PACKAGES`. Google Play
  asks for a justification for package visibility; the reason is fraud prevention (detecting scam
  victims being remotely controlled and rooted devices).
- **iOS:** add the usage text for location in your app if you turn location on. The SDK itself uses
  only the Keychain, the network state, the device lock state and (optionally) the last known location.
- Declare the data in your App Store privacy details and Google Play data-safety form: device
  identifiers, device and security information, and (optionally) approximate or precise location, used
  for fraud prevention.

## Failing open

`getDeviceSession()` never throws and waits at most `timeoutMs` (5 seconds by default). On any
failure it returns `{ deviceSessionId: null, error }`. Send the payment anyway: your backend screens
without the device signals, exactly as it does today.

## Limits to know about

- Signals the app reports can be faked by an app that has been modified. Treat them as evidence for
  scoring and review; Prembly also works out signals of its own that the app cannot influence (device
  age, customers per device, devices per customer).
- Root and jailbreak detection is best effort.
- iOS cannot see which other apps are running, so `remote_access_app_running` is always `false` there.
- Android cannot see running apps either. The SDK reports `remote_access_app_running` when a known
  remote-access app has an **enabled accessibility service**, which is what remote control needs.
- Platform attestation (Play Integrity, App Attest) is not in this version.

## Development

```sh
yarn                  # install
yarn test             # unit tests (TypeScript layer)
yarn typecheck && yarn lint
yarn example ios      # run the example app on the iOS simulator
yarn example android  # run it on an Android emulator
```

The example app lets you enter a base URL, a public key and a customer ID, preview the signals, and
create a session. For a local backend use `http://localhost:<port>` on iOS and
`http://10.0.2.2:<port>` from the Android emulator.

The signal collection lives in framework-free files (`ios/TMSignalCollector.*`,
`android/.../SignalCollector.kt`) so a Flutter plugin can reuse them.

## License

MIT
