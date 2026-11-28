import { steps } from '../public/tour-data.mjs';
import { snippet } from './content.mjs';

const arrow = '<span class="action-arrow" aria-hidden="true"></span>';
const link = (href, title) => `<a class="text-link" href="${href}">${title} ${arrow}</a>`;
const capabilities = [
  ['Mobile testing', 'mobile-testing'], ['Agent evaluation', 'agent-evaluation'],
  ['Human intelligence', 'human-intelligence'], ['Verifiable execution', 'verification'],
];

function handset({ dynamic = false } = {}) {
  const first = steps[0];
  const bind = field => dynamic ? ` data-demo="${field}"` : '';
  return `<div class="seeker" aria-hidden="true">
    <div class="seeker-glass">
      <span class="seeker-camera"></span>
      <div class="seeker-top"><img src="/assets/brand-wordmark-dark.svg" width="48" height="10" alt=""></div>
      <div class="seeker-screen-orbit"><span${bind('deviceNumber')}>${first.deviceNumber}</span></div>
      <div class="seeker-details"><strong${bind('deviceTitle')}>${first.deviceTitle}</strong><span${bind('deviceDetail')}>${first.deviceDetail}</span></div>
      <div class="seeker-home"></div>
    </div>
  </div>`;
}

function hero(primary) {
  return `<section class="hero" aria-labelledby="hero-title">
    <div class="shell hero-copy">
      <h1 id="hero-title">The execution layer <em>for <span>mobile intelligence.</span></em></h1>
      <p class="hero-lede">Test mobile applications, evaluate AI agents, and collect structured human feedback. Inspect evidence tied to the work that ran.</p>
      <div class="hero-actions">${primary}<a class="site-button secondary" href="/docs">Read the docs</a></div>
    </div>
    <div class="lab-visual">
      <div class="stage-horizon" aria-hidden="true"></div>
      <div class="stage-orbit" aria-hidden="true"></div>
      <div class="stage-annotation stage-annotation-left"><strong>Build identity</strong><span>APK · SHA-256</span></div>
      <div class="stage-annotation stage-annotation-right"><strong>Signed evidence</strong><span>Report · issuer</span></div>
      <div class="ghost-flight">
        <picture><source type="image/webp" srcset="/assets/orbital-ghost.webp"><img src="/assets/brand-symbol-dark.png" alt="" width="700" height="700" fetchpriority="high"></picture>
      </div>
      <div class="seeker-flight">${handset()}<span class="seeker-name">Solana Seeker</span></div>
    </div>
  </section>`;
}

function theater() {
  const first = steps[0];
  return `<section class="section execution" id="execution" aria-labelledby="execution-title">
    <div class="shell">
      <div class="section-heading">
        <h2 id="execution-title">From instruction<br>to evidence.</h2>
        <p>Register the exact build, run a scoped test, and inspect the result and the evidence behind it.</p>
      </div>
      <figure class="theater" data-stage="0">
        <figcaption class="theater-header"><span>Example execution</span><span class="example-id">RUN · AGUS-EXAMPLE</span></figcaption>
        <div class="theater-body">
          <div class="theater-terminal">
            <div class="terminal-header"><span>Run events</span><code>JSON</code></div>
            <div class="terminal-lines">
              ${[1,2,3].map(i=>`<div class="log-row"><span>0${i}</span><div><code data-demo="event${i}">${first['event'+i]}</code><span data-demo="value${i}">${first['value'+i]}</span></div></div>`).join('')}
            </div>
          </div>
          <div class="theater-display">
            <div class="theater-phone">${handset({ dynamic: true })}</div>
            <ol class="theater-trace">
              ${[
                ['Build identity','Exact app package'],
                ['Device execution','Scoped actions and observations'],
                ['Signed evidence','Outcome and provenance'],
              ].map(([label,description], i)=>`<li data-trace-row${i===0?' aria-current="step"':''}><strong data-original="${label}">${i===0?first.trace:label}</strong><small data-original="${description}">${i===0?first.traceDetail:description}</small></li>`).join('')}
            </ol>
          </div>
        </div>
        <div class="lab-controls">
          <p class="step-caption" data-tour-fallback>Register an exact build, observe its execution, and inspect the resulting evidence.</p>
          <div class="step-controls" aria-label="Execution stages" hidden>
            ${steps.map(({label}, i)=>`<button type="button" data-step="${i}" aria-pressed="${i===0}"><small>0${i+1}</small><span>${label}</span></button>`).join('')}
          </div>
          <p class="step-caption" hidden><strong data-demo="title">${first.title}</strong> <span data-demo="description">${first.description}</span></p>
          <p class="visually-hidden" data-stage-announcement aria-live="polite"></p>
        </div>
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

    <section class="section paper" id="mobile-testing">
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

    <section class="section agent-section" id="agent-evaluation">
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
