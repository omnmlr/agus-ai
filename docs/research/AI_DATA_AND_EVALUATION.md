# Mobile agent evaluation and human data

## Evidence of a market

Scale publicly lists computer-use/GUI trajectory datasets, evaluations and RL environments for licensing [R6]. AndroidControl's published research reports 14,548 unique tasks across 833 Android applications [R7]. AndroidWorld is an open, repeatable mobile-control benchmark [R20]. These establish interest in the data and evaluation category, not demand for AGUS or a right to resell existing datasets.

## Proposed differentiated benchmark

A task definition binds app version/build hash, allowed actions, initial state, wallet/network configuration, max duration and steps, deterministic outcome assertion, and evidence policy. Compare model-selected actions, scripted baseline and human demonstrations with the same task spec and comparable starting states. A transaction task can check finality and exact chain effect rather than infer success from UI text.

| Metric | Definition |
|---|---|
| Task success | Deterministic assertion passes among eligible attempts |
| False success | Agent reports success despite failed/unresolved independent outcome |
| Recovery | Correct completion after a defined recoverable failure |
| Efficiency | Steps, duration and inference cost per attempt/success |
| Invalid action rate | Actions rejected by declared scope or unsupported targets |
| Human quality | Versioned review rubric, acceptance and inter-rater agreement where sampled |

Report denominators, missing evidence, task difficulty, environment, model/version and randomization. Do not mix synthetic adapter results with actual Android performance. A signed report proves integrity relative to its issuer, not perfect ground truth.

## Data products

- Human demonstration: authorized actions and outcomes with task-level goal, action provenance and evidence references.
- Human correction: failed agent decision, reviewer correction, rationale and resulting state.
- Agent trajectory: bounded observations/actions, result and independent evaluator output.
- Evaluation pack: reproducible task, initial state specification, rubric and allowed interfaces.

Proposed schema: dataset/task version, build digest, device class, pseudonymous session, consent/version, relative timestamps, action types, selected/observed distinction, outcome labels and redacted evidence references. Avoid raw credentials, personal identifiers, unrelated screens, wallet secrets, unlicensed app content and unnecessary sensor data.

## Rights and governance

Obtain separate, informed developer and contributor authorization for training beyond evidence needed to deliver a test. Document what can be exported, who may access it, retention, deletion/withdrawal limits, purpose, derivative use and compensation. Withdrawal blocks future export; existing copies require contractual retention/deletion terms. The baseline has a consent-controlled trajectory export in its [frontend contract](../../FRONTEND_CONTRACT.md); commercial data licensing, human trajectory instrumentation and quality review are expanded requirements, not demonstrated functionality.

Use disposable accounts and approved workloads. Prefer redacted structured events to raw screen recordings; per-session capture authorization and protected surfaces must be respected. No personal phone surveillance. Review app content rights before licensing.

## Commercial sequence

Start with commissioned agent evaluation for customer-owned test apps. Add human demonstrations and corrections when a buyer provides a concrete schema and quality rubric. Only build a reusable licensed dataset after rights and buyer acceptance are established. Data volume without quality, rights or useful task coverage is a liability.
