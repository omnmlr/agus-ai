import { escapeHtml as e, snippet } from './content.mjs';
import { replay } from './replay.mjs';

const arrow = '<span class="action-arrow" aria-hidden="true"></span>';
const link = (href, title) => `<a class="text-link" href="${href}">${title} ${arrow}</a>`;
const capabilities = [
  ['Mobile testing', 'mobile-testing'], ['Agent evaluation', 'agent-evaluation'],
  ['Human intelligence', 'human-intelligence'], ['Verifiable execution', 'verification'],
];

function hero(primary) {
  return `<section class="hero orbital-hero" aria-labelledby="hero-title">
    <div class="orbital-scene" data-orbital-scene>
      <picture>
        <source media="(max-width: 720px)" srcset="/assets/orbital-stage-mobile.webp">
        <img src="/assets/orbital-stage.webp" alt="" width="1440" height="1060" fetchpriority="high">
      </picture>
    </div>
    <div class="shell hero-copy">
      <h1 id="hero-title"><span>The execution</span> <span>layer <em>for mobile</em></span> <span><em>intelligence.</em></span></h1>
      <p class="hero-lede">Test mobile applications, evaluate AI agents, and collect structured human feedback. Inspect evidence tied to the work that ran.</p>
      <div class="hero-actions">${primary}<a class="site-button secondary" href="/docs">Read the docs</a></div>
    </div>
    <div class="shell hero-index">
      <a class="hero-cue" href="#execution"><span aria-hidden="true">↓</span> Explore an execution</a>
      <p>Orbital ghost <span aria-hidden="true">/</span> Solana Seeker</p>
    </div>
  </section>`;
}

function theater() {
  const [first] = replay.chapters;
  return `<section class="section execution orbital-execution" id="execution" aria-labelledby="execution-title">
    <div class="shell">
      <div class="section-heading">
        <h2 id="execution-title">From instruction<br>to evidence.</h2>
        <p>Register the exact build, run a scoped test, and inspect the result and the evidence behind it.</p>
      </div>
      <figure class="replay" data-replay data-command="${e(replay.command)}" data-screen="build">
        <figcaption class="replay-top">
          <div><span class="replay-record" aria-hidden="true"></span><strong>Recorded execution</strong></div>
          <span>Wallet transfer <span class="replay-id">/ ${e(replay.run)}</span></span>
        </figcaption>
        <div class="replay-controls" hidden>
          <button type="button" class="replay-toggle" data-replay-toggle><span aria-hidden="true"></span><span data-replay-toggle-label>Play replay</span></button>
          <div class="replay-rail">
            <div class="replay-progress" aria-hidden="true"><i></i></div>
            <div class="replay-chapters" aria-label="Replay chapters">
              ${replay.chapters.map((chapter, index) => `<button type="button" data-step="${index}" aria-pressed="${index === 0}" data-state="${e(chapter.state)}" data-detail="${e(chapter.detail)}" data-evidence="${e(chapter.evidence)}" data-value="${e(chapter.value)}"${index === 0 ? ` data-full-value="${e(replay.build)}"` : index === 3 ? ` data-full-value="${e(replay.digest)}"` : ''}>${e(chapter.name)}</button>`).join('')}
            </div>
          </div>
        </div>
        <div class="replay-stage">
          <div class="replay-terminal">
            <div class="replay-label"><span>Terminal</span><span>AGUS CLI</span></div>
            <div class="replay-command"><span aria-hidden="true">$</span> <code data-replay-command>${e(replay.command)}</code><span class="replay-caret" aria-hidden="true"></span></div>
            <ol class="replay-log" aria-label="Execution events">
              ${replay.events.map((event, index) => `<li data-event data-at="${event.at}" data-chapter="${event.chapter}" data-screen="${event.screen}"${index ? ' hidden' : ''}><span aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><div><strong>${e(event.label)}</strong><small>${e(event.detail)}</small></div></li>`).join('')}
            </ol>
          </div>
          <div class="replay-device">
            <span class="replay-label">Android runner</span>
            <div class="replay-device-orbit" aria-hidden="true"></div>
            <div class="replay-phone" aria-hidden="true">
              <div class="replay-phone-glass">
                <div class="replay-phone-camera"></div>
                <img src="/assets/brand-wordmark-dark.svg" width="46" height="9" alt="">
                <div class="replay-phone-figure"><i></i><i></i><i></i></div>
                <div class="replay-phone-flow"><div><b></b><b></b></div><div><b></b><b></b></div><div><b></b><b></b></div></div>
                <div class="replay-phone-message" data-replay-device>${e(replay.events[0].label)}</div>
                <div class="replay-phone-indicator"></div>
              </div>
            </div>
          </div>
          <div class="replay-evidence">
            <span class="replay-label">Evidence</span>
            <strong data-replay-state>${e(first.state)}</strong>
            <p data-replay-detail>${e(first.detail)}</p>
            <dl>
              <dt data-replay-evidence>${e(first.evidence)}</dt>
              <dd><code data-replay-value title="${e(replay.build)}">${e(first.value)}</code></dd>
            </dl>
            <a data-replay-chain href="${e(replay.explorer)}" hidden>Open Devnet attestation ${arrow}</a>
          </div>
        </div>
        <div class="replay-foot">
          <span>Reconstructed runner UI · Localnet run · Devnet receipt attestation</span>
          <a href="${e(replay.source)}">Acceptance record ${arrow}</a>
        </div>
        <p class="visually-hidden" data-replay-announcement role="status"></p>
      </figure>
    </div>
  </section>`;
}

export function home(primary) {
  return `
    ${hero(primary)}
    <nav class="capability-strip" aria-label="Capabilities"><div class="shell">
      ${capabilities.map(([name,id])=>`<a href="#${id}">${name}${arrow}</a>`).join('')}
    </div></nav>
    ${theater()}

    <div class="workflow-chapter"><section class="section paper" id="mobile-testing">
      <span id="platform"></span>
      <div class="shell split product-split">
        <div><h2>Test the exact<br>application build.</h2><p>Connect an Android APK to a defined test scope. See which package ran, what the test observed, and what happened next.</p>${link('/product#android','Explore mobile testing')}</div>
        <ol class="build-route" aria-label="Mobile testing workflow">
          <li><span>01</span><div><h3>Build identity</h3><p>APK, application ID, SHA-256</p></div></li>
          <li><span>02</span><div><h3>Device and scope</h3><p>Compatible environment and approved scenario</p></div></li>
          <li><span>03</span><div><h3>Execution record</h3><p>Observations and the resulting evidence</p></div></li>
        </ol>
      </div>
    </section>

    <section class="section paper agent-section" id="agent-evaluation">
      <div class="shell">
        <div class="section-heading"><h2>Understand<br>every action.</h2><p>Review a scripted scenario or follow a model’s bounded actions. When human judgment matters, commission a correction tied to the source run.</p></div>
        <ol class="agent-trace">
          <li><span>01</span><h3>Observe</h3><p>Read the scoped app state.</p></li>
          <li><span>02</span><h3>Decide</h3><p>Select an allowed action.</p></li>
          <li><span>03</span><h3>Act</h3><p>Apply the action on device.</p></li>
          <li><span>04</span><h3>Review</h3><p>Inspect the outcome or correct the action.</p></li>
        </ol>
        ${link('/product#agents','Explore agent evaluation')}
      </div>
    </section>

    <section class="section paper human-section" id="human-intelligence">
      <div class="shell split product-split">
        <div><h2>Human judgment, structured for engineering.</h2><p>Commission targeted feedback and review expected and observed behavior side by side. Eligible corrections can be exported when both participants grant training rights.</p>${link('/product#humans','Explore human testing')}</div>
        <div class="finding-example">
          <header><span>Example finding</span><span>Onboarding</span></header>
          <dl><div><dt>Expected</dt><dd>One submission after tapping Continue.</dd></div><div><dt>Observed</dt><dd>A second submission after returning to review.</dd></div></dl>
          <details><summary>Review the reproduction steps</summary><ol><li>Continue through onboarding.</li><li>Return to the review screen.</li><li>Tap Continue again.</li></ol></details>
        </div>
      </div>
    </section>

    </div>

    <section class="section evidence-section" id="verification">
      <span id="evidence"></span>
      <div class="shell evidence-layout">
        <div class="evidence-copy"><h2>Evidence you can inspect.</h2><p>Read the signed execution report and its verified build identity. Check the app outcome and, where supported, the independent Solana transaction result separately.</p>${link('/docs/evidence','Understand verification')}</div>
        <div class="specimen" aria-label="Fields in an execution record">
          <div class="specimen-top"><span>EXECUTION RECORD</span><span>RECEIPT FIELDS</span></div>
          <div><span class="specimen-symbol" aria-hidden="true">01</span><b>Build identity</b><code>APK SHA-256</code></div>
          <div><span class="specimen-symbol" aria-hidden="true">02</span><b>Runner provenance</b><code>Ed25519 signature</code></div>
          <div><span class="specimen-symbol" aria-hidden="true">03</span><b>Chain outcome</b><code>Solana RPC</code></div>
          <div class="specimen-bottom">${link('/product#solana','Explore Solana assurance')}</div>
        </div>
      </div>
    </section>

    <section class="section workflow-section" id="developers">
      <div class="shell split product-split">
        <div><h2>Built to fit<br>your workflow.</h2><p>Follow a run in the console, then use the documented HTTP API, client, and developer tools to connect the workflow to your own systems.</p><div class="inline-links">${link('/docs/quickstart','Read the quickstart')}${link('/docs/api','API reference')}</div></div>
        <div class="integration-preview">
          ${snippet('node packages/developer-client/src/cli.mjs projects','AGUS CLI')}
          <div class="integration-result"><code>GET /api/v1/projects</code><p>Lists projects owned by the authenticated developer.</p></div>
        </div>
      </div>
    </section>

    <section class="section console-preview-section">
      <div class="shell">
        <div class="section-heading"><h2>One workspace.<br>Every execution.</h2><div><p>Organize builds, campaigns, findings, and evidence in the developer console.</p>${link('/console.html','Open console')}</div></div>
        <figure class="console-preview">
          <img src="/assets/console-preview.webp" width="1200" height="600" alt="AGUS AI campaign review with coverage, findings and signed evidence controls" loading="lazy" decoding="async">
          <figcaption>Developer console · Example workspace</figcaption>
        </figure>
      </div>
    </section>

    <section class="section contributor-section" id="providers">
      <div class="shell contributor-layout">
        <img src="/assets/device-network.webp" alt="" width="960" height="540" loading="lazy" decoding="async">
        <div><h2>Put your device and judgment to work.</h2><p>Choose scoped assignments, control participation, and submit useful findings. Explore available contribution and compensation workflows.</p>${link('/contributors','Explore contributing')}</div>
      </div>
    </section>

    <section class="launch-section">
      <div class="shell"><h2>Build with evidence.</h2><div>${primary}<a class="site-button secondary" href="/contact">Contact us</a></div></div>
    </section>`;
}
