export const steps = [
  {
    label: 'Build', title: 'Register the exact build.',
    description: 'Upload an Android APK to a project. Its package and SHA-256 fingerprint identify what the test is allowed to run.',
    console: 'Build registration', action: 'APK fingerprinted', signal: 'SHA-256 digest',
    expected: 'Package registered', observed: 'Fingerprint matched', phone: 'Build identified',
    receipt: '01 / BUILD IDENTITY',
  },
  {
    label: 'Run', title: 'Observe the execution.',
    description: 'Run a bounded scenario on eligible Android infrastructure or commission a campaign with automated and attended tasks.',
    console: 'Execution log', action: 'Wallet prompt observed', signal: 'Approval response',
    expected: 'Authorization requested', observed: 'Test wallet approved', phone: 'Authorization prompt',
    receipt: '02 / EXECUTION RECORD',
  },
  {
    label: 'Verify', title: 'Inspect the evidence.',
    description: 'Connect the outcome to a signed execution receipt. For supported Solana scenarios, inspect the independent chain result alongside it.',
    console: 'Evidence review', action: 'Receipt sealed', signal: 'Execution evidence',
    expected: 'Matching chain effect', observed: 'Transaction matched', phone: 'Outcome recorded',
    receipt: '03 / SIGNED RECEIPT',
  },
];
