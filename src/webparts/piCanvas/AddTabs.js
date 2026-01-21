/**
 * PiCanvas Tabs Library v3.0.0
 *
 * Originally based on AddTabs by dustinpoissant
 * https://www.jqueryscript.net/other/Minimal-Handy-jQuery-Tabs-Plugin-AddTabs.html
 *
 * Enhanced by @anthonyrhopkins with:
 * - WCAG 2.2 accessibility (ARIA roles, keyboard navigation)
 * - Web part labels support (Image, etc.)
 * - Lazy loading hooks
 * - Reduced motion support
 * - Deep linking support
 * - Banner/Hero webpart full-width fix
 */
RenderTabs = function() {
    if (typeof($add) == "undefined") var $add = { version: {}, auto: { disabled: false } };

    !function(a) {
        $add.version.Tabs = "3.0.0";

        /**
         * Fix SharePoint Banner/Hero webpart width issues when moved into tabs.
         *
         * SharePoint Banner webpart configurations:
         * 1. "Image and heading" - background image with text overlay
         * 2. "Heading only" - just text, colored background
         * 3. "Color block" - solid color with text
         * 4. "Fade" - image fades into page background
         * 5. "Overlap" - image with overlapping text box
         *
         * All configurations use deeply nested flex containers with inline styles
         * that contain calculated pixel widths. When the webpart is moved via DOM
         * manipulation, these calculations become stale and must be reset.
         *
         * TWO MODES:
         * - Full-width mode (data-fullwidth-banner="true" or not set): Clear inline styles so CSS can make banner full-width
         * - Contained mode (data-fullwidth-banner="false"): Apply inline styles to constrain banner to container width
         *   because SharePoint's CSS classes use viewport-escaping tricks that our CSS can't override
         *
         * @param {jQuery} $container - The tab content container to fix
         */
        function fixBannerWebparts($container) {
            // Check if this container is in contained mode
            var isContainedMode = $container.attr('data-fullwidth-banner') === 'false';

            // Find all Banner webparts in this container
            var $banners = $container.find('[data-automation-id="BannerWebPart"], [class*="bannerWebPart"], [class*="BannerWebPart"]');

            $banners.each(function() {
                var $banner = a(this);

                if (isContainedMode) {
                    // CONTAINED MODE: Apply inline styles to override SharePoint's viewport-escaping CSS
                    // SharePoint uses CSS classes with "width: 100vw; margin-left: calc(-50vw + 50%)"
                    // Our CSS can't override these, so we use inline styles
                    $banner.addClass('picanvas-contained-banner');

                    // Find and fix the fullWidthImageLayout element
                    var $fullWidthLayout = $banner.find('[data-automation-id="fullWidthImageLayout"]');
                    if ($fullWidthLayout.length === 0) {
                        // Banner might BE the fullWidthImageLayout
                        $fullWidthLayout = $container.find('[data-automation-id="fullWidthImageLayout"]');
                    }

                    $fullWidthLayout.each(function() {
                        var el = this;
                        el.style.cssText = 'width: 100% !important; max-width: 100% !important; margin-left: 0 !important; margin-right: 0 !important; min-width: 0 !important;';
                        el.classList.add('picanvas-contained-banner');

                        // Also fix the image inside - preserve focal point (object-position)
                        var img = el.querySelector('img');
                        if (img) {
                            // Get existing focal point before overwriting styles
                            var existingPosition = img.style.objectPosition || window.getComputedStyle(img).objectPosition;
                            img.style.setProperty('width', '100%', 'important');
                            img.style.setProperty('max-width', '100%', 'important');
                            img.style.setProperty('height', '100%', 'important');
                            img.style.setProperty('object-fit', 'cover', 'important');
                            // Preserve SharePoint's focal point setting
                            if (existingPosition && existingPosition !== '50% 50%') {
                                img.style.setProperty('object-position', existingPosition, 'important');
                            }

                            // CRITICAL: Lock container height after image loads to prevent resize animations
                            lockBannerHeight(el, img);
                        }
                    });
                } else {
                    // FULL-WIDTH MODE: Clear inline styles so CSS can make banner full-width
                    $banner.find('*').addBack().each(function() {
                        var el = this;
                        var style = el.style;

                        // Clear width-related inline styles
                        if (style.width) style.width = '';
                        if (style.maxWidth) style.maxWidth = '';
                        if (style.minWidth) style.minWidth = '';
                        if (style.flex) style.flex = '';
                        if (style.flexBasis) style.flexBasis = '';
                        if (style.flexGrow) style.flexGrow = '';
                        if (style.flexShrink) style.flexShrink = '';
                    });

                    $banner.addClass('picanvas-banner-fixed');
                }

                // Force the banner to recalculate its layout
                void $banner[0].offsetHeight;
            });

            // Also fix Hero webparts (similar structure to Banner)
            var $heroes = $container.find('[data-automation-id="HeroWebPart"], [class*="heroWebPart"], [class*="HeroWebPart"]');

            $heroes.each(function() {
                var $hero = a(this);

                if (isContainedMode) {
                    $hero.addClass('picanvas-contained-banner');
                    $hero.find('[data-automation-id="fullWidthImageLayout"]').each(function() {
                        var el = this;
                        el.style.cssText = 'width: 100% !important; max-width: 100% !important; margin-left: 0 !important; margin-right: 0 !important; min-width: 0 !important;';
                        var img = el.querySelector('img');
                        if (img) {
                            // Preserve focal point (object-position)
                            var existingPosition = img.style.objectPosition || window.getComputedStyle(img).objectPosition;
                            img.style.setProperty('width', '100%', 'important');
                            img.style.setProperty('max-width', '100%', 'important');
                            img.style.setProperty('height', '100%', 'important');
                            img.style.setProperty('object-fit', 'cover', 'important');
                            if (existingPosition && existingPosition !== '50% 50%') {
                                img.style.setProperty('object-position', existingPosition, 'important');
                            }

                            // CRITICAL: Lock container height after image loads to prevent resize animations
                            lockBannerHeight(el, img);
                        }
                    });
                } else {
                    $hero.find('*').addBack().each(function() {
                        var el = this;
                        var style = el.style;

                        if (style.width) style.width = '';
                        if (style.maxWidth) style.maxWidth = '';
                        if (style.minWidth) style.minWidth = '';
                        if (style.flex) style.flex = '';
                        if (style.flexBasis) style.flexBasis = '';
                        if (style.flexGrow) style.flexGrow = '';
                        if (style.flexShrink) style.flexShrink = '';
                    });

                    $hero.addClass('picanvas-hero-fixed');
                }

                void $hero[0].offsetHeight;
            });

            // Fix fullWidthImageLayout elements that might not be inside BannerWebPart
            // (e.g., PageTitle webpart also uses fullWidthImageLayout)
            // ALWAYS apply inline styles in contained mode - SharePoint may re-render and clear them
            if (isContainedMode) {
                $container.find('[data-automation-id="fullWidthImageLayout"]').each(function() {
                    var el = this;
                    // Always apply inline styles - SharePoint's resize/re-render may clear them
                    el.style.cssText = 'width: 100% !important; max-width: 100% !important; margin-left: 0 !important; margin-right: 0 !important; min-width: 0 !important;';
                    el.classList.add('picanvas-contained-banner');
                    var img = el.querySelector('img');
                    if (img) {
                        // Preserve focal point (object-position)
                        var existingPosition = img.style.objectPosition || window.getComputedStyle(img).objectPosition;
                        img.style.setProperty('width', '100%', 'important');
                        img.style.setProperty('max-width', '100%', 'important');
                        img.style.setProperty('height', '100%', 'important');
                        img.style.setProperty('object-fit', 'cover', 'important');
                        if (existingPosition && existingPosition !== '50% 50%') {
                            img.style.setProperty('object-position', existingPosition, 'important');
                        }

                        // CRITICAL: Lock container height after image loads to prevent resize animations
                        lockBannerHeight(el, img);
                    }
                });
            }
        }

        /**
         * Lock the banner container height after the image loads to prevent
         * SharePoint's resize observers from recalculating dimensions and causing
         * visual "zoom" effects.
         *
         * @param {HTMLElement} container - The fullWidthImageLayout container
         * @param {HTMLImageElement} img - The image element inside
         */
        function lockBannerHeight(container, img) {
            function applyHeightLock() {
                // Only lock if we have valid dimensions
                if (container.offsetHeight > 0) {
                    var currentHeight = container.offsetHeight;
                    container.style.setProperty('height', currentHeight + 'px', 'important');
                    container.style.setProperty('min-height', currentHeight + 'px', 'important');
                    container.classList.add('picanvas-height-locked');

                    // Also lock the image
                    img.style.setProperty('height', '100%', 'important');
                    img.style.setProperty('min-height', currentHeight + 'px', 'important');
                }
            }

            // If image is already loaded, lock immediately
            if (img.complete && img.naturalHeight > 0) {
                // Use requestAnimationFrame to ensure layout is complete
                requestAnimationFrame(function() {
                    applyHeightLock();
                });
            } else {
                // Wait for image to load
                img.addEventListener('load', function onLoad() {
                    img.removeEventListener('load', onLoad);
                    requestAnimationFrame(function() {
                        applyHeightLock();
                    });
                });
            }
        }

        $add.Tabs = function(d, s) {
            return a(d).each(function(d, e) {
                var t = a(e),
                    i = a.extend({ change: "click" }, t.data(), s),
                    n = t.find("[role=tabs]"),
                    uniqueId = 'picanvas-' + Math.random().toString(36).substr(2, 9);

                n.addClass("addui-Tabs-tabHolder");

                var c = n.children(),
                    o = t.find("[role=contents]");
                o.addClass("addui-Tabs-contentHolder");

                var r = o.children(),
                    u = 0;

                t.addClass("addui-Tabs").attr("role", "").removeAttr("role");
                c.addClass("addui-Tabs-tab");

                r.addClass("addui-Tabs-content").each(function(d, s) {
                    a(s).hasClass("active") && (a(s).removeClass("active"), u = d);
                });

                r.removeClass("addui-Tabs-active").eq(u).addClass("addui-Tabs-active");
                c.removeClass("addui-Tabs-active").eq(u).addClass("addui-Tabs-active");

                // ========== FIX BANNER WEBPARTS IN ALL TAB PANELS ==========
                // Run with delays to ensure SharePoint has finished rendering banners
                // SharePoint lazy-loads banner content, so we need multiple attempts
                r.each(function() {
                    fixBannerWebparts(a(this));
                });

                // Retry after SharePoint finishes rendering (banners load async)
                setTimeout(function() {
                    r.each(function() {
                        fixBannerWebparts(a(this));
                    });
                }, 100);

                setTimeout(function() {
                    r.each(function() {
                        fixBannerWebparts(a(this));
                    });
                }, 500);

                setTimeout(function() {
                    r.each(function() {
                        fixBannerWebparts(a(this));
                    });
                }, 1500);

                // ========== MUTATION OBSERVER FOR BANNER RE-RENDERS ==========
                // SharePoint continuously re-renders banners (especially on the active tab)
                // Watch for style changes and reapply our containment styles
                // CRITICAL: Use aggressive debouncing (200ms) to prevent rapid-fire re-triggering
                // that causes visible "zoom" animations.
                r.each(function() {
                    var $panel = a(this);
                    var isContainedMode = $panel.attr('data-fullwidth-banner') === 'false';

                    if (isContainedMode) {
                        var debounceTimer = null;
                        var DEBOUNCE_MS = 200; // Aggressive debounce to prevent visual jitter

                        // Create observer to watch for fullWidthImageLayout style changes
                        var observer = new MutationObserver(function(mutations) {
                            // Skip if banners are already height-locked (stable state)
                            var layouts = $panel[0].querySelectorAll('[data-automation-id="fullWidthImageLayout"]');
                            var allLocked = true;
                            for (var i = 0; i < layouts.length; i++) {
                                if (!layouts[i].classList.contains('picanvas-height-locked')) {
                                    allLocked = false;
                                    break;
                                }
                            }
                            if (allLocked && layouts.length > 0) {
                                return; // All banners are locked, no need to fix
                            }

                            var needsFix = false;
                            mutations.forEach(function(mutation) {
                                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                                    var el = mutation.target;
                                    // Only check unlocked elements
                                    if (!el.classList.contains('picanvas-height-locked')) {
                                        // Check if SharePoint reset the styles
                                        if (el.style.width && el.style.width !== '100%') {
                                            needsFix = true;
                                        }
                                        if (el.style.marginLeft && el.style.marginLeft !== '0px') {
                                            needsFix = true;
                                        }
                                    }
                                }
                                // Also watch for child additions (SharePoint lazy-loading)
                                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                                    needsFix = true;
                                }
                            });

                            if (needsFix) {
                                // Aggressive debounce: wait 200ms of inactivity before fixing
                                if (debounceTimer) {
                                    clearTimeout(debounceTimer);
                                }
                                debounceTimer = setTimeout(function() {
                                    debounceTimer = null;
                                    fixBannerWebparts($panel);
                                }, DEBOUNCE_MS);
                            }
                        });

                        // Start observing the panel for attribute and child changes
                        observer.observe($panel[0], {
                            attributes: true,
                            attributeFilter: ['style'],
                            childList: true,
                            subtree: true
                        });

                        // Store observer reference for cleanup if needed
                        $panel.data('bannerObserver', observer);
                    }
                });

                // ========== WCAG 2.2 ACCESSIBILITY ==========

                // Add ARIA role to tab list container
                n.attr({
                    'role': 'tablist',
                    'aria-label': t.attr('data-aria-label') || 'Content sections'
                });

                // Check if vertical orientation
                var isVertical = t.attr('data-tab-orientation') === 'vertical';
                if (isVertical) {
                    n.attr('aria-orientation', 'vertical');
                }

                // Add ARIA attributes to each tab
                c.each(function(index) {
                    var $tab = a(this);
                    var tabId = uniqueId + '-tab-' + index;
                    var panelId = uniqueId + '-panel-' + index;

                    $tab.attr({
                        'role': 'tab',
                        'id': tabId,
                        'aria-selected': index === u ? 'true' : 'false',
                        'aria-controls': panelId,
                        'tabindex': index === u ? '0' : '-1'
                    });

                    // Check if this is a placeholder (restricted) tab
                    if ($tab.attr('data-placeholder') === 'true') {
                        $tab.attr('aria-disabled', 'true');
                    }
                });

                // Add ARIA attributes to each content panel
                r.each(function(index) {
                    var $panel = a(this);
                    var tabId = uniqueId + '-tab-' + index;
                    var panelId = uniqueId + '-panel-' + index;

                    $panel.attr({
                        'role': 'tabpanel',
                        'id': panelId,
                        'aria-labelledby': tabId,
                        'tabindex': '0'
                    });

                    // Mark non-active panels as hidden from screen readers
                    if (index !== u) {
                        $panel.attr('aria-hidden', 'true');
                    }
                });

                // ========== REDUCED MOTION SUPPORT ==========

                var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                var transitionsDisabled = t.attr('data-transitions') === 'false';

                if (prefersReducedMotion || transitionsDisabled) {
                    t.addClass('picanvas-no-transitions');
                }

                // ========== TAB ACTIVATION FUNCTION ==========

                function activateTab(newIndex, focusTab) {
                    // Skip if clicking on placeholder tab
                    var $newTab = c.eq(newIndex);
                    if ($newTab.attr('data-placeholder') === 'true') {
                        return false;
                    }

                    // Update active states
                    r.removeClass("addui-Tabs-active").attr('aria-hidden', 'true');
                    r.eq(newIndex).addClass("addui-Tabs-active").removeAttr('aria-hidden');

                    c.removeClass("addui-Tabs-active")
                     .attr('aria-selected', 'false')
                     .attr('tabindex', '-1');
                    $newTab.addClass("addui-Tabs-active")
                           .attr('aria-selected', 'true')
                           .attr('tabindex', '0');

                    u = newIndex;

                    // Focus management
                    if (focusTab) {
                        $newTab.focus();
                    }

                    // ========== LAZY LOADING ==========

                    var $panel = r.eq(newIndex);
                    if ($panel.attr('data-lazy') === 'true' && $panel.attr('data-lazy-loaded') !== 'true') {
                        // Mark as loaded
                        $panel.attr('data-lazy-loaded', 'true');

                        // Trigger custom event for mermaid/custom content initialization
                        $panel.trigger('picanvas:lazy-load', { tabIndex: newIndex });

                        // Load any lazy iframes
                        $panel.find('iframe[data-src]').each(function() {
                            var $iframe = a(this);
                            $iframe.attr('src', $iframe.attr('data-src'));
                            $iframe.removeAttr('data-src');
                        });
                    }

                    // Trigger custom event for deep linking and analytics
                    t.trigger('picanvas:tab-change', {
                        tabIndex: newIndex,
                        tabElement: $newTab,
                        panelElement: $panel
                    });

                    // ========== FORCE BACKGROUND IMAGES TO LOAD ==========
                    // SharePoint Hero/Banner web parts use lazy loading that depends on
                    // IntersectionObserver. When tabs are hidden (display:none), images
                    // don't load.
                    // NOTE: We do NOT dispatch resize events as that causes SharePoint to
                    // recalculate image dimensions, creating a visual "zoom" effect.
                    setTimeout(function() {
                        // Fix Banner/Hero webparts that may have re-injected styles
                        fixBannerWebparts($panel);

                        // ========== FIX VIEWPORT-ESCAPE STYLES ON ALL ELEMENTS ==========
                        // SharePoint may inject width:100vw and margin-left:calc(-50vw+50%)
                        // on ANY element when it becomes visible. This causes content to
                        // expand beyond the tab container. Fix by resetting these styles.
                        function fixViewportEscapeStyles(container) {
                            a(container).find('[style*="100vw"], [style*="calc(-50vw"], [style*="calc( -50vw"]').each(function() {
                                var el = this;
                                // Skip images entirely - don't touch their styles
                                if (el.tagName === 'IMG') return;

                                var style = el.getAttribute('style') || '';
                                if (style.indexOf('100vw') !== -1 || style.indexOf('calc(-50vw') !== -1 || style.indexOf('calc( -50vw') !== -1) {
                                    // ONLY reset margins - don't touch width as it affects image resolution
                                    el.style.setProperty('margin-left', '0', 'important');
                                    el.style.setProperty('margin-right', '0', 'important');
                                }
                            });
                        }

                        // Fix immediately
                        fixViewportEscapeStyles($panel[0]);

                        // Watch for SharePoint re-injecting styles (it may do this async)
                        var observer = new MutationObserver(function(mutations) {
                            var needsFix = false;
                            mutations.forEach(function(mutation) {
                                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                                    var style = mutation.target.getAttribute('style') || '';
                                    if (style.indexOf('100vw') !== -1 || style.indexOf('calc(-50vw') !== -1) {
                                        needsFix = true;
                                    }
                                }
                            });
                            if (needsFix) {
                                fixViewportEscapeStyles($panel[0]);
                            }
                        });
                        observer.observe($panel[0], { attributes: true, subtree: true, attributeFilter: ['style'] });

                        // Stop observing after 2 seconds (SharePoint should be done by then)
                        setTimeout(function() { observer.disconnect(); }, 2000);

                        // Force re-layout of elements with background-image
                        $panel.find('[style*="background-image"]').each(function() {
                            var $el = a(this);
                            // Force reflow by reading offsetHeight
                            void $el[0].offsetHeight;
                        });

                        // Handle SharePoint's lazy image loading
                        // Look for placeholder images that need to be loaded
                        $panel.find('img[data-src], img[loading="lazy"]').each(function() {
                            var $img = a(this);
                            if ($img.attr('data-src')) {
                                $img.attr('src', $img.attr('data-src'));
                                $img.removeAttr('data-src');
                            }
                        });
                    }, 50);

                    return true;
                }

                // ========== CLICK HANDLER ==========

                var l = "click";
                if ("hover" == i.change) { l = "mouseenter"; }

                // Enhanced click handler that works with nested elements
                c.on(l, function(evt) {
                    evt.preventDefault();
                    evt.stopPropagation();

                    var clickedTab = a(evt.target).closest('.addui-Tabs-tab');
                    if (clickedTab.length === 0) return;

                    var newIndex = c.index(clickedTab);
                    if (newIndex >= 0 && newIndex !== u) {
                        activateTab(newIndex, false);
                    }
                });

                // Prevent default on clickable elements inside tabs
                c.find('a, button, img, [role="button"]').on('click', function(evt) {
                    evt.preventDefault();
                    evt.stopPropagation();
                    a(this).closest('.addui-Tabs-tab').trigger('click');
                });

                // ========== KEYBOARD NAVIGATION (WCAG 2.1.1) ==========

                n.on('keydown', '.addui-Tabs-tab', function(e) {
                    var $tabs = c;
                    var currentIndex = $tabs.index(this);
                    var newIndex = currentIndex;
                    var tabCount = $tabs.length;

                    // Determine navigation keys based on orientation
                    var nextKey = isVertical ? 'ArrowDown' : 'ArrowRight';
                    var prevKey = isVertical ? 'ArrowUp' : 'ArrowLeft';

                    switch(e.key) {
                        case nextKey:
                            // Move to next tab (wrap around)
                            newIndex = (currentIndex + 1) % tabCount;
                            e.preventDefault();
                            break;

                        case prevKey:
                            // Move to previous tab (wrap around)
                            newIndex = (currentIndex - 1 + tabCount) % tabCount;
                            e.preventDefault();
                            break;

                        case 'Home':
                            // Move to first tab
                            newIndex = 0;
                            e.preventDefault();
                            break;

                        case 'End':
                            // Move to last tab
                            newIndex = tabCount - 1;
                            e.preventDefault();
                            break;

                        case 'Enter':
                        case ' ':
                            // Activate current tab
                            activateTab(currentIndex, false);
                            e.preventDefault();
                            return;

                        default:
                            return;
                    }

                    // Skip placeholder tabs
                    var attempts = 0;
                    while ($tabs.eq(newIndex).attr('data-placeholder') === 'true' && attempts < tabCount) {
                        if (e.key === nextKey || e.key === 'End') {
                            newIndex = (newIndex + 1) % tabCount;
                        } else {
                            newIndex = (newIndex - 1 + tabCount) % tabCount;
                        }
                        attempts++;
                    }

                    if (newIndex !== currentIndex) {
                        activateTab(newIndex, true);
                    }
                });

                // ========== DEEP LINKING SUPPORT ==========

                // Expose activation function for external use (deep linking)
                t.data('picanvas-activate-tab', function(index) {
                    if (index >= 0 && index < c.length) {
                        activateTab(index, false);
                    }
                });

                // Expose method to get tab by label text
                t.data('picanvas-find-tab', function(labelText) {
                    var foundIndex = -1;
                    c.each(function(index) {
                        var tabText = a(this).text().trim().toLowerCase().replace(/\s+/g, '-');
                        if (tabText === labelText.toLowerCase().replace(/\s+/g, '-')) {
                            foundIndex = index;
                            return false;
                        }
                    });
                    return foundIndex;
                });

                // Initialize first tab's lazy content
                var $firstPanel = r.eq(u);
                if ($firstPanel.attr('data-lazy') === 'true') {
                    $firstPanel.attr('data-lazy-loaded', 'true');
                    setTimeout(function() {
                        $firstPanel.trigger('picanvas:lazy-load', { tabIndex: u });
                    }, 0);
                }

                // Force background images to load on first tab after SharePoint finishes rendering
                // SharePoint Hero/Banner web parts set background-image via React after initial mount
                // NOTE: We do NOT dispatch resize events as that causes SharePoint to recalculate
                // image dimensions, creating a visual "zoom" effect.
                setTimeout(function() {
                    $firstPanel.find('[style*="background-image"]').each(function() {
                        void a(this)[0].offsetHeight;
                    });
                }, 100);
            });

            return this;
        };

        a.fn.addTabs = function(a) { $add.Tabs(this, a); };
        $add.auto.Tabs = function() { $add.auto.disabled || a("[data-addui=tabs]").addTabs(); };
    }(jQuery);

    $(function() {
        for (var k in $add.auto) {
            if (typeof($add.auto[k]) == "function") {
                $add.auto[k]();
            }
        }
    });
}
