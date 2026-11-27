# Proposed economics and unit economics

All prices below are **illustrative USD-equivalent modeling assumptions**, not live quotes, income promises, or revenue. The implemented test settlement uses Devnet test tokens; those have no cash value. Real compensation requires operational, legal, tax, dispute and payment controls.

## Revenue options

- Fixed-price release assurance campaigns, based on scenario count and compatibility coverage.
- Human studies priced by completed, accepted assignments, plus campaign setup and analysis.
- Recurring CI regression bundles with bounded usage.
- Custom agent evaluations, priced per accepted evaluation or batch; rights-cleared datasets licensed separately.
- Sponsored builder credits funded by an ecosystem partner only if actually contracted.

AWS's $0.17/device-minute ($10.20/device-hour) [R1] is a reference, not a promise that AGUS can deliver equivalent coverage or undercut it. Human work is a distinct product with different costs.

## Cost model

Gross billings = customer spend excluding taxes. Contribution = gross billings − provider compensation − variable inference/storage/egress − review/support/rework − transaction fees and refund reserve. Fixed engineering, sales, legal, compliance and infrastructure overhead are excluded. A marketplace take rate is not contribution margin.

| Illustrative unit | Customer | Provider | Compute/data | Review/support | fees/reserve | Contribution |
|---|---:|---:|---:|---:|---:|---:|
| 30 min automated run | $6.00 | $2.50 | $0.70 | $0.60 | $0.20 | $2.00 (33.3%) |
| 30 min human assignment | $12.00 | $7.00 | $0.35 | $2.00 | $0.40 | $2.25 (18.75%) |
| 20 min agent correction/eval | $10.00 | $4.00 | $1.25 | $1.50 | $0.35 | $2.90 (29%) |

Assumptions: acceptance-based provider compensation; modeled review labor includes routine rework, not exceptional incidents. Actual provider compensation must reflect disclosed effort, eligibility and local rules. For the human example, $7 per 30 minutes of paid task time implies $14/hour of paid work, not $14 per hour online. Including 15 minutes of unpaid waiting/qualification amortization yields $9.33/hour effective. Pay fair compensation for requested work and avoid arbitrary rejection.

## Example campaign

10 automated runs × $6 + 20 human assignments × $12 = $300 billings. Direct provider compensation = $165; modeled contribution = 10×$2 + 20×$2.25 = $65 (21.7%). If an extra $25 analyst review is required, contribution is $40 (13.3%). At $1,000 monthly fixed overhead, roughly 16 such $65-contribution campaigns are needed before fixed overhead break-even (ignoring additional costs/taxes). This is a planning illustration.

## Stress test

For the $12 human unit, doubling the $2 review cost reduces contribution from $2.25 to $0.25; adding $1 rework or incentive makes it negative. If a $6 automated unit costs an extra $2 in inference, contribution becomes zero. Cheap devices do not guarantee cheap delivery. Measure model cost per step, bytes per session, human review time, failed work compensation and disputes. Price complex work separately.

## Supply incentives and safeguards

Pay only for real contracted work or explicitly purchased reserved capacity; no idle-online reward by default. Disclose compensation, expected effort, review window and payout conditions before acceptance. Do not use provider deposits or personal assets to fund tests. Device scarcity premiums should reflect actual demand, not a flagship-only score. Do not penalize safety stops in a way that discourages reclamation. Use transparent appeal and compensation rules.

## Operating metrics

Fill rate, median time to match, utilization (paid task time / committed time), completion and acceptance rates, effective provider pay, net revenue, margin by job, refund/rework cost, buyer retention, cost per actionable defect. Establish actual cost assumptions from pilot measurements before quoting public rates.

Payment safety: immutable job terms, separate Devnet test identities today, verified payout address, idempotent reconciliation, no general-purpose custodial account. Review regulatory and tax obligations and licensed payment options before real-money launch.

Source benchmark: [R1](REFERENCES.md).
