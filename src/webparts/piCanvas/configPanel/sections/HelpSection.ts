/**
 * HelpSection — Getting started, feature docs, troubleshooting, and about.
 */

export interface IHelpSectionOptions {
  onChanged: () => void;
}

export class HelpSection {
  private _el: HTMLElement | null = null;
  private _options: IHelpSectionOptions;

  constructor(options: IHelpSectionOptions) {
    this._options = options;
  }

  public render(container: HTMLElement): void {
    this._el = container;
    this.rebuild();
  }

  public rebuild(): void {
    if (!this._el) return;

    this._el.innerHTML = `
      <div class="picanvas-config-section-title">Help &amp; Documentation</div>
      <div class="picanvas-config-section-desc">Learn how to use PiCanvas and troubleshoot common issues.</div>

      <div class="picanvas-help-accordion" data-accordion="getting-started">
        <button type="button" class="picanvas-help-accordion-header">
          <span class="picanvas-help-accordion-icon">&#9654;</span>
          <span>Getting Started</span>
        </button>
        <div class="picanvas-help-accordion-body">
          <div class="picanvas-help-steps">
            <div class="picanvas-help-step"><span class="picanvas-help-step-num">1</span><div><strong>Add PiCanvas to your page</strong><br>Place this web part where you want tabs to appear.</div></div>
            <div class="picanvas-help-step"><span class="picanvas-help-step-num">2</span><div><strong>Add your content</strong><br>Add other web parts anywhere on the page, or use built-in content types (Markdown, HTML, Mermaid, etc.).</div></div>
            <div class="picanvas-help-step"><span class="picanvas-help-step-num">3</span><div><strong>Configure tabs</strong><br>Go to the <strong>Tabs</strong> section in this panel, or click any tab row in the edit-mode summary to jump directly to that tab&apos;s settings.</div></div>
            <div class="picanvas-help-step"><span class="picanvas-help-step-num">4</span><div><strong>Publish</strong><br>Save your page and the tabs will appear to readers.</div></div>
          </div>
        </div>
      </div>

      <div class="picanvas-help-accordion" data-accordion="features">
        <button type="button" class="picanvas-help-accordion-header">
          <span class="picanvas-help-accordion-icon">&#9654;</span>
          <span>Features</span>
        </button>
        <div class="picanvas-help-accordion-body">
          <div class="picanvas-help-feature-list">
            <div class="picanvas-help-feature">
              <strong>Tabbed Layouts</strong>
              <p>Organize web parts into clean, navigable tabs. Supports horizontal and vertical orientations with customizable positioning.</p>
            </div>
            <div class="picanvas-help-feature">
              <strong>Section Support</strong>
              <p>Group entire page sections under a single tab. PiCanvas detects section boundaries and hides/shows them as tabs are clicked.</p>
            </div>
            <div class="picanvas-help-feature">
              <strong>Theme Awareness</strong>
              <p>Automatically adapts to light and dark mode. Supports auto-detection, forced light, and forced dark modes.</p>
            </div>
            <div class="picanvas-help-feature">
              <strong>Permission-Based Tabs</strong>
              <p>Show or hide tabs based on SharePoint group membership. Supports allow-lists, deny-lists, and custom fallback messages.</p>
            </div>
            <div class="picanvas-help-feature">
              <strong>Content Types</strong>
              <p>Create tab content without extra web parts: Markdown, HTML, Mermaid diagrams, Embed (iframe), RSS feeds, Table of Contents, Profile Reports, JavaScript templates, and Text Web Part sources.</p>
            </div>
            <div class="picanvas-help-feature">
              <strong>Styling &amp; Colors</strong>
              <p>Choose from built-in tab styles (Default, Pills, Underline, Boxed) and customize colors, fonts, spacing, borders, and animations.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="picanvas-help-accordion" data-accordion="troubleshooting">
        <button type="button" class="picanvas-help-accordion-header">
          <span class="picanvas-help-accordion-icon">&#9654;</span>
          <span>Troubleshooting</span>
        </button>
        <div class="picanvas-help-accordion-body">
          <div class="picanvas-help-tips">
            <div class="picanvas-help-tip">
              <strong>Web parts not detected?</strong>
              <p>Go to <strong>Advanced &gt; CSS Selectors</strong> and try different selector options. SharePoint section layouts vary.</p>
            </div>
            <div class="picanvas-help-tip">
              <strong>Tabs not showing?</strong>
              <p>Make sure the page is published (not just saved as draft). Tabs only render in read/display mode.</p>
            </div>
            <div class="picanvas-help-tip">
              <strong>Content looks wrong after resize?</strong>
              <p>Some embedded content may need a page refresh. PiCanvas re-measures on window resize but iframes may not respond.</p>
            </div>
            <div class="picanvas-help-tip">
              <strong>Mermaid diagrams not rendering?</strong>
              <p>Ensure the Mermaid syntax is valid. Use the live preview in the Tabs section to verify before publishing.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="picanvas-help-accordion" data-accordion="about">
        <button type="button" class="picanvas-help-accordion-header">
          <span class="picanvas-help-accordion-icon">&#9654;</span>
          <span>About &amp; Links</span>
        </button>
        <div class="picanvas-help-accordion-body">
          <div class="picanvas-help-about">
            <p>PiCanvas is a SharePoint Framework (SPFx) web part that creates tabbed layouts for SharePoint Online pages.</p>
            <p>
              <strong>Upgraded by</strong> <a href="https://linkedin.com/in/anthonyrhopkins" target="_blank" rel="noopener">@anthonyrhopkins</a><br>
              <strong>Originally by</strong> <a href="http://www.markrackley.net/2022/06/29/the-return-of-hillbilly-tabs/" target="_blank" rel="noopener">Mark Rackley</a>
            </p>
            <div class="picanvas-help-links">
              <a href="https://github.com/anthonyrhopkins/PiCanvas" target="_blank" rel="noopener">GitHub Repository</a>
              <a href="https://pispace.dev" target="_blank" rel="noopener">PiSpace.dev</a>
            </div>
          </div>
        </div>
      </div>
    `;

    // Bind accordion toggles
    this._el.querySelectorAll('.picanvas-help-accordion-header').forEach(btn => {
      btn.addEventListener('click', () => {
        const accordion = btn.closest('.picanvas-help-accordion');
        if (accordion) {
          accordion.classList.toggle('open');
        }
      });
    });
  }

  public dispose(): void {
    this._el = null;
  }
}
