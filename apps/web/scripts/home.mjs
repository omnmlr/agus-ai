import { steps } from '../public/tour-data.mjs';

const arrow = '<span aria-hidden="true">↗</span>';

export function home(primary, launchMode) {
  const first = steps[0];
  return `
    <section class="hero shell" aria-labelledby="hero-title">
      <div class="hero-copy">
        <p class="hero-label"><span></span> ANDROID TESTING INFRASTRUCTURE</p>
        <h1 id="hero-title">Test on devices.<br><em>Ship with proof.</em></h1>
        <p class="hero-lede">Test Android apps, evaluate agents, and bring human feedback into the same workflow. See what ran, what happened, and what the evidence supports.</p>
        <div class="hero-actions">
          ${primary}
          <a class="site-button secondary" href="/docs/quickstart">Read the quickstart</a>
        </div>
        ${launchMode === 'demo' ? '<p class="hero-access">Console access requires a preview account.</p>' : ''}
      </div>

      <figure id="product-tour" class="lab" aria-label="Interactive walkthrough of an illustrative Android run">
        <div class="lab-visual" data-stage="0">
          <div class="lab-grid" aria-hidden="true"></div>
          <div class="lab-beam" aria-hidden="true"></div>
          <div class="lab-label"><i></i> RUN EXPLORER <span>Illustration</span></div>
          <div class="lab-console">
            <div class="lab-window"><span></span><span></span><span></span><code>agus / workspace</code></div>
            <div class="lab-console-body">
              <small>WALLET FLOW</small>
              <strong data-demo="console">${first.console}</strong>
              <p><i></i><span data-demo="action">${first.action}</span></p>
              <p><i></i><span data-demo="signal">${first.signal}</span></p>
            </div>
          </div>
          <div class="handset">
            <div class="handset-screen">
              <div class="handset-camera"></div>
              <div class="handset-top"><span>09:41</span><span>◒ ▪</span></div>
              <div class="handset-orbit"><b></b><b></b><b></b><span>↗</span></div>
              <div class="handset-caption"><small>TEST APPLICATION</small><strong data-demo="phone">${first.phone}</strong><i></i></div>
              <div class="handset-bar"></div>
            </div>
          </div>
          <div class="lab-receipt">
            <div class="receipt-ref"><span data-demo="receipt">${first.receipt}</span><b aria-hidden="true">⌁</b></div>
            <div><small>Expected</small><strong data-demo="expected">${first.expected}</strong></div>
            <div><small>Observed</small><strong data-demo="observed">${first.observed}</strong></div>
          </div>
        </div>
        <figcaption class="lab-controls">
          <div class="step-controls" aria-label="Run explorer steps" hidden>
            ${steps.map(({ label }, i) => `<button type="button" data-step="${i}" aria-pressed="${i === 0}"><small>0${i + 1}</small>${label}</button>`).join('')}
          </div>
          <noscript><p class="step-caption">Register an exact build, observe its execution, and inspect the resulting evidence.</p></noscript>
          <div class="step-caption" aria-live="polite" hidden><strong data-demo="title">${first.title}</strong> <span data-demo="description">${first.description}</span></div>
        </figcaption>
      </figure>
    </section>

    <div class="capability-strip">
      <div class="shell">
        <a href="/product#android"><span aria-hidden="true">◫</span> Android testing</a>
        <a href="/product#agents"><span aria-hidden="true">⌁</span> Agent evaluation</a>
        <a href="/product#humans"><span aria-hidden="true">◎</span> Human feedback</a>
        <a href="/product#solana"><span aria-hidden="true">≋</span> Solana assurance</a>
      </div>
    </div>

    <section class="section paper" id="platform">
      <div class="shell">
        <div class="section-heading"><h2>From test result<br>to release decision.</h2><p>Give your team the context to reproduce a failure, understand an agent’s decision, or check that a wallet action actually reached the chain.</p></div>
        <div class="feature-lines">
          <a href="/product#android"><span class="feature-index">01</span><h3>Reproduce an Android issue</h3><p>Use a known APK, a scoped device session, and scenario-specific observations to trace what happened.</p>${arrow}</a>
          <a href="/product#agents"><span class="feature-index">02</span><h3>Evaluate an agent action</h3><p>Review bounded steps, observations, and outcomes. Have a qualified person correct an approved action when needed.</p>${arrow}</a>
          <a href="/product#humans"><span class="feature-index">03</span><h3>Commission human feedback</h3><p>Define the task and coverage, then review structured findings with expected and observed behavior.</p>${arrow}</a>
        </div>
      </div>
    </section>

    <section class="section evidence-section" id="evidence">
      <div class="shell split">
        <div class="evidence-copy"><h2>Evidence you<br>can inspect.</h2>
          <p>A signed receipt ties an execution record to the exact APK and available evidence. In supported Solana flows, an independent chain check helps distinguish a wallet response from a matching transaction.</p>
          <a class="text-link" href="/docs/evidence">Explore signed evidence ${arrow}</a>
        </div>
        <div class="specimen" aria-label="Illustration of evidence layers">
          <div class="specimen-top"><span>EXECUTION RECORD</span><span>ILLUSTRATION</span></div>
          <div><span class="specimen-symbol">◫</span><b>Build identity</b><code>APK SHA-256</code></div>
          <div><span class="specimen-symbol">⌁</span><b>Runner provenance</b><code>Ed25519 signature</code></div>
          <div><span class="specimen-symbol">≋</span><b>Chain outcome</b><code>Solana RPC</code></div>
          <div class="specimen-bottom">Verification available on supported workflows</div>
        </div>
      </div>
    </section>

    <section class="section workflow-section">
      <div class="shell split">
        <div><h2>Start with the build<br>you already have.</h2><p>Create a project, register an authorized APK, and choose a test scenario or campaign. Follow the work in the console or integrate through the HTTP API.</p><a class="text-link" href="/docs/quickstart">Follow the quickstart ${arrow}</a></div>
        <div class="workflow-steps"><div><span>01</span><div><h3>Register a build</h3><p>Group exact APKs under a project.</p></div></div><div><span>02</span><div><h3>Set the scope</h3><p>Choose a test scenario or specify campaign coverage.</p></div></div><div><span>03</span><div><h3>Review the outcome</h3><p>Inspect findings and download authorized evidence.</p></div></div></div>
      </div>
    </section>

    <section class="section contributor-section" id="providers">
      <div class="shell contributor-layout">
        <div><h2>Put your Android<br>experience to work.</h2><p>Contributors can join approved device sessions, reproduce issues, or help improve agent behavior. Review the scope before taking on work.</p><a class="text-link" href="/contributors">Explore contributing ${arrow}</a></div>
        <img src="/assets/contributor-devices.webp" alt="" width="960" height="540" loading="lazy" decoding="async">
      </div>
    </section>

    <section class="launch-section">
      <div class="shell"><h2>Put your next build<br>to the test.</h2><div>${primary}<a class="site-button secondary" href="/docs">Browse documentation</a></div></div>
    </section>`;
}
