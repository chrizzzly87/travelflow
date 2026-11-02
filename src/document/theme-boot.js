// Runs before first paint; stylesheet tokens remain the source of theme colours.
(() => {
        // Restore the chosen theme before the first paint.
        //
        // Inline and synchronous by necessity: marketing routes are prerendered,
        // so the served HTML is already painted markup and doing this from the
        // bundle would flash light on every one of them.
        //
        // No stored value means "follow the device", which is also the default
        // for someone who has never touched the toggle.
        //
        // Deliberately does NOT seed --background and friends inline. index.css
        // is a render-blocking <link> in this same <head>, so :root and .dark are
        // already applied on frame one. Seeding them inline broke light mode
        // outright once: an inline style outranks every rule, so the dark values
        // kept winning after `.dark` came off and the page stayed dark forever.
        //
        // These literals are duplicated from THEME_BOOT_KEYS in
        // contexts/theme/themeStore.ts; the unit test asserts they still match.
        try {
          let stored = null;
          try {
            stored = window.localStorage.getItem('tf_theme_preference_v1');
          } catch (e) {
            // Private mode, blocked storage, or a locked-down embed.
          }
          const dark =
            stored === 'dark' ||
            (stored !== 'light' &&
              typeof window.matchMedia === 'function' &&
              window.matchMedia('(prefers-color-scheme: dark)').matches);
          const root = document.documentElement;
          root.setAttribute('data-dark-tone', 'warm');
          if (dark) {
            root.classList.add('dark');
            root.style.colorScheme = 'dark';
          } else {
            root.style.colorScheme = 'light';
          }
          // Literals, not a computed style read: this runs before index.css is
          // guaranteed to have parsed, and the values are asserted against
          // THEME_SURFACE_COLOR in contexts/theme/themeStore.ts by a unit test.
          const themeColorMeta = document.querySelector('meta[data-tf-theme-color]');
          if (themeColorMeta) themeColorMeta.setAttribute('content', dark ? '#242322' : '#ffffff');
        } catch (e) {
          // Never let the theme stop the page from rendering.
        }
      })();
