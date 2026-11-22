// ============================================================================
// WallpaperGlass — Clean, Lightweight & Fast theme.js with Background Customizer
// ============================================================================
// Companion runtime script for user.css:
//   1. Strips dynamic inline & computed opaque purple/dark background fills on
//      playlist/album/artist top bars, sticky tracklist column headers, and
//      the bottom Now Playing player bar (and its outer wrappers).
//   2. Automatically detects any white-background boxes, toast popups, or
//      floating buttons (like "+ Add CSS" or "Added to Liked Songs") and locks
//      high-contrast dark ink (`#0b0b10`) onto them so no box ever whites out.
//   3. Guarantees the bottom-left Now Playing song name & artist stay 100%
//      visible and unmasked, with full Spicy Lyrics compatibility.
//   4. Background customization & persistence is handled by the dedicated
//      Spicetify extension `bgPicker.js`.
// ============================================================================

(function WallpaperGlassRuntime() {
  // 2. DOM Background Cleanup & White-Out Fixes
  // --------------------------------------------------------------------------
  function clearElementBg(el, clearBackdrop) {
    if (!el || !el.style) return;
    el.style.setProperty("background", "transparent", "important");
    el.style.setProperty("background-color", "transparent", "important");
    el.style.setProperty("background-image", "none", "important");
    el.style.setProperty("--background-base", "transparent", "important");
    el.style.setProperty("--background-elevated-base", "transparent", "important");
    el.style.setProperty("--spice-main-elevated", "transparent", "important");
    el.style.setProperty("--spice-player", "transparent", "important");
    if (clearBackdrop) {
      el.style.setProperty("backdrop-filter", "none", "important");
      el.style.setProperty("-webkit-backdrop-filter", "none", "important");
      el.style.setProperty("box-shadow", "none", "important");
      el.style.setProperty("border", "none", "important");
    }
  }

  function fixWhiteOutBoxesAndSongTitle() {
    // Ensure bottom-left Now Playing song title & artist are never masked out
    const nowPlayingWidget = document.querySelector(
      '[data-testid="now-playing-widget"], .main-nowPlayingWidget-nowPlaying, footer[data-testid="now-playing-bar"], [data-testid="now-playing-bar"]'
    );
    if (nowPlayingWidget) {
      nowPlayingWidget
        .querySelectorAll(
          '[data-testid="context-item-info-title"], [data-testid="context-item-info-subtitles"], .main-trackInfo-name, .main-trackInfo-artists, .trk-title, a, span'
        )
        .forEach((el) => {
          el.style.setProperty("-webkit-mask-image", "none", "important");
          el.style.setProperty("mask-image", "none", "important");
        });
    }

    // Ensure full-width snackbar/toast wrappers never show a white bar
    document
      .querySelectorAll(
        '.notistack-SnackbarContainer, [class*="Snackbar"], [class*="snackbar"], [data-encore-id="snackbar"], .notistack-SnackbarContainer [role="status"], .notistack-SnackbarContainer [role="alert"]'
      )
      .forEach((el) => {
        el.style.setProperty("background", "transparent", "important");
        el.style.setProperty("background-color", "transparent", "important");
        el.style.setProperty("box-shadow", "none", "important");
        el.style.setProperty("border", "none", "important");
        el.querySelectorAll("*:not(button)").forEach((child) => {
          child.style.setProperty("color", "#f5f5fa", "important");
        });
      });

    // Fix white-background buttons so text is dark #0b0b10
    document
      .querySelectorAll(
        '#main-view button.encore-inverted-light-set, .GenericModal button.encore-inverted-light-set, ' +
        '#main-view button[class*="add-snippet"], .marketplace-add-snippet-btn, ' +
        '#main-view button[style*="255, 255, 255"], #main-view button[style*="#fff"]'
      )
      .forEach((el) => {
        el.style.setProperty("color", "#0b0b10", "important");
        el.querySelectorAll("*:not(button)").forEach((child) => {
          child.style.setProperty("color", "#0b0b10", "important");
          child.style.setProperty("fill", "#0b0b10", "important");
        });
      });
  }

  function cleanTopBarsAndStickyHeaders() {
    // Clear all global & playlist topbar containers, backgrounds, and overlays
    document
      .querySelectorAll(
        'header[data-testid="topbar"], [data-testid="global-nav-bar"], .Root__top-bar, ' +
          "#main-view header, .main-topBar-container, .main-topBar-background, " +
          ".main-topBar-overlay, .main-topBar-topbarContentWrapper, " +
          ".main-topBar-topbarContent, .main-entityHeader-topbarContent"
      )
      .forEach((el) => clearElementBg(el, true));

    // Clear sticky tracklist column headers ("# Title Album Date added")
    document
      .querySelectorAll(
        ".main-trackList-trackListHeader, .main-trackList-trackListHeaderStuck, " +
          ".main-trackList-trackListHeaderRow, " +
          '[data-testid="track-list"] [role="presentation"], ' +
          '[data-testid="playlist-tracklist"] [role="presentation"], ' +
          '[data-testid="track-list"] > div[style*="top"], ' +
          '[data-testid="playlist-tracklist"] > div[style*="top"], ' +
          '[data-testid="track-list"] > div[style*="sticky"], ' +
          '[data-testid="playlist-tracklist"] > div[style*="sticky"]'
      )
      .forEach((el) => clearElementBg(el, true));

    const mainView = document.getElementById("main-view");
    if (mainView) {
      mainView.querySelectorAll('[role="columnheader"]').forEach((colHeader) => {
        let cur = colHeader;
        while (
          cur &&
          cur !== mainView &&
          cur.getAttribute("role") !== "grid" &&
          cur.getAttribute("data-testid") !== "playlist-tracklist" &&
          cur.getAttribute("data-testid") !== "track-list"
        ) {
          clearElementBg(cur, true);
          cur = cur.parentElement;
        }
      });
    }
  }

  function cleanNowPlayingBar() {
    const npBars = document.querySelectorAll(
      '[data-testid="now-playing-bar"], footer[data-testid="now-playing-bar"], ' +
        'aside[data-testid="now-playing-bar"], .Root__now-playing-bar, ' +
        ".main-nowPlayingBar-container, .main-nowPlayingBar-nowPlayingBar, " +
        ".main-nowPlayingBar-left, .main-nowPlayingBar-center, .main-nowPlayingBar-right"
    );

    npBars.forEach((bar) => {
      const isMainDock = bar.getAttribute("data-testid") === "now-playing-bar";
      clearElementBg(bar, !isMainDock);
      if (isMainDock) {
        bar.style.setProperty(
          "backdrop-filter",
          "blur(var(--glass-blur, 12px)) saturate(135%)",
          "important"
        );
        bar.style.setProperty(
          "-webkit-backdrop-filter",
          "blur(var(--glass-blur, 12px)) saturate(135%)",
          "important"
        );
      }

      let parent = bar.parentElement;
      while (parent && parent !== document.body && parent !== document.documentElement) {
        if (
          parent.id !== "main-view" &&
          parent.id !== "Desktop_LeftSidebar_Id" &&
          !parent.classList.contains("Root__right-sidebar")
        ) {
          const isDockAncestor = parent.getAttribute("data-testid") === "now-playing-bar";
          clearElementBg(parent, !isDockAncestor);
        }
        parent = parent.parentElement;
      }

      bar.querySelectorAll(":scope > div, :scope > aside, :scope > footer").forEach((child) => {
        if (
          child.tagName !== "BUTTON" &&
          child.getAttribute("role") !== "button" &&
          child.getAttribute("role") !== "progressbar"
        ) {
          clearElementBg(child, true);
        }
      });
    });
  }

  function cleanDynamicBackgrounds() {
    fixWhiteOutBoxesAndSongTitle();
    cleanTopBarsAndStickyHeaders();
    cleanNowPlayingBar();

    const mainView = document.getElementById("main-view");
    if (!mainView || mainView.querySelector("#SpicyLyricsPage")) return;

    const inlineBgNodes = mainView.querySelectorAll(
      '[style*="background"], ' +
        '[data-testid="playlist-page"] [style*="background"], ' +
        '[data-testid="album-page"] [style*="background"], ' +
        '[data-testid="artist-page"] [style*="background"], ' +
        '.marketplace-header[style*="background"]'
    );

    for (const el of inlineBgNodes) {
      if (
        el.tagName === "BUTTON" ||
        el.getAttribute("role") === "button" ||
        el.getAttribute("role") === "progressbar" ||
        el.hasAttribute("data-encore-id") ||
        el.classList.contains("main-playButton-PlayButton") ||
        el.classList.contains("main-playButton-button") ||
        el.closest('[data-testid="progress-bar"], [role="progressbar"], button')
      ) {
        continue;
      }
      const bgImg = el.style.backgroundImage || "";
      if (!bgImg.includes("url(")) {
        el.style.setProperty("background", "transparent", "important");
        el.style.setProperty("background-color", "transparent", "important");
        el.style.setProperty("background-image", "none", "important");
      }
    }
  }

  // --------------------------------------------------------------------------
  function start() {
    cleanDynamicBackgrounds();
    // Background modal handled by bgPicker.js extension

    const attachHistoryListener = () => {
      if (window.Spicetify && Spicetify.Platform && Spicetify.Platform.History) {
        Spicetify.Platform.History.listen(() => {
          setTimeout(cleanDynamicBackgrounds, 60);
          setTimeout(cleanDynamicBackgrounds, 300);
        });
      } else {
        setTimeout(attachHistoryListener, 800);
      }
    };
    attachHistoryListener();

    let scrollTicking = false;
    document.addEventListener(
      "scroll",
      () => {
        if (!scrollTicking) {
          scrollTicking = true;
          requestAnimationFrame(() => {
            cleanTopBarsAndStickyHeaders();
            scrollTicking = false;
          });
        }
      },
      { capture: true, passive: true }
    );

    let timer = null;
    const observer = new MutationObserver(() => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        requestAnimationFrame(cleanDynamicBackgrounds);
      }, 160);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
