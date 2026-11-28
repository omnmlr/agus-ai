export const steps = [
  {
    label: 'Register', title: 'Start with the exact APK.',
    description: 'The project binds the Android package to a SHA-256 fingerprint.',
    event1: 'build.registered', value1: 'com.example.release',
    event2: 'digest.recorded', value2: 'SHA-256 · exact APK',
    event3: 'scope.prepared', value3: 'Wallet authorization',
    trace: 'Build registered', traceDetail: 'Package and digest recorded',
    deviceNumber: '01', deviceTitle: 'Build identified', deviceDetail: 'Android application',
  },
  {
    label: 'Execute', title: 'Follow the work on device.',
    description: 'Read what the scoped test observed, who acted, and what happened next.',
    event1: 'scope.active', value1: 'Bounded Android environment',
    event2: 'observation.recorded', value2: 'Authorization prompt visible',
    event3: 'action.selected', value3: 'Agent · confirm test prompt',
    trace: 'Action observed', traceDetail: 'Prompt confirmed in the test flow',
    deviceNumber: '02', deviceTitle: 'Authorization prompt', deviceDetail: 'Agent checks the interaction',
  },
  {
    label: 'Verify', title: 'Inspect the signed result.',
    description: 'Review the seal alongside the test outcome. Supported Solana tests can include a separate chain check.',
    event1: 'report.sealed', value1: 'Scoped execution receipt',
    event2: 'signature.checked', value2: 'Runner key · Ed25519',
    event3: 'chain.check', value3: 'Separate for supported tests',
    trace: 'Receipt sealed', traceDetail: 'Issuer and build bound to the report',
    deviceNumber: '03', deviceTitle: 'Result ready', deviceDetail: 'Receipt and observations',
  },
];
