# Design system

| Area | Implementation |
| --- | --- |
| Identity | Uppercase AGUS AI. The text is a standalone Geist outline with optical tracking. The original orbital ghost supplies the symbol. The lockups have separate variants designed for dark and light backgrounds. |
| Color | Void `#080809`, Obsidian `#151518`, Graphite `#29292E`, Stone `#3F3F46`, Silver `#A1A1AA`, Pearl `#F5F5F7`. Green, amber, red, and blue appear as semantic status colors with theme-specific foregrounds. |
| Typography | Self-hosted [Geist](../../apps/web/public/assets/geist-OFL.txt) variable weights 400–800 and [IBM Plex Mono](../../apps/web/public/assets/ibm-plex-mono-OFL.txt) 400/500/600. Use Geist for headings and controls, mono for IDs, hashes, code and exact values. |
| Grid | Marketing max 1280px with 64/48/32/20px gutters; the hero scene can extend full bleed. The workspace has a 240px desktop rail, a 64px top bar, 32px content padding, and a mobile drawer. |
| Controls | Marketing 48px CTAs with 8px corners. Console controls use smaller corners and 44px minimum height on touch widths. Tables use 44px rows and scroll within their own container. |
| Themes | Marketing uses fixed lighting and deliberate light editorial sections. Docs, auth and console follow the system until an explicit override is set in local storage. The same-origin theme script initializes before the stylesheets. |
| Motion | Stage transitions use the approved 800ms easing. Logs reveal at 135ms intervals, and the terminal always remains readable as text. Manual changes announce the stage. Reduced motion keeps the full sequence and turns off the animation and scroll-directed staging. |
| Adjustments | The narrow hero uses a 37–40px headline and holds the phrase “mobile intelligence” together. The approved starting type width produced an isolated line at 390px. Arrow marks use strokes so varying fallback glyph support cannot change their appearance. |

## Brand assets

- [Dark lockup](../../apps/web/public/assets/brand-lockup-dark.svg) and [light lockup](../../apps/web/public/assets/brand-lockup-light.svg)
- [Dark wordmark](../../apps/web/public/assets/brand-wordmark-dark.svg) and [light wordmark](../../apps/web/public/assets/brand-wordmark-light.svg)
- [Flat light-on-dark symbol](../../apps/web/public/assets/brand-symbol-dark.png) and [flat dark-on-light symbol](../../apps/web/public/assets/brand-symbol-light.png)
- [Favicon and app icon](../../apps/web/public/assets/agus-orbital-mark.png) and [Google square logo](../../apps/web/public/assets/oauth-logo.png)
- [Transparent mascot](../../apps/web/public/assets/orbital-ghost.webp) and [social preview](../../apps/web/public/assets/social.png)

The flat symbol derives from the supplied original mark, preserving its ring and eye cutouts. The large mascot is a faithful, higher-resolution transparent rendering of the supplied recognizable form. The website uses the raster at its designed optical size. The handset is an original CSS render informed by published Seeker dimensions and industrial design. Both are presentation assets. [Seeker specifications](https://solanamobile.com/seeker)
