// Runs during document parsing; captures explicit controls until their owner hydrates.
(() => {
        const bridge = { interacted: false, intent: null, sealed: false, pendingControls: [], readyScopes: {} };
        window.__TF_BOOT__ = bridge;

        const noteInteraction = () => { bridge.interacted = true; };

        // Controls that opt in carry data-tf-boot-intent in the prerendered
        // markup. We record the intent rather than replaying the click later:
        // the component that owns the control hydrates with its own lazy chunk,
        // long after the React root mounts, so there is no moment at which a
        // re-dispatched click is reliably heard. The component reads the intent
        // on its first render instead, which cannot race.
        const rememberControl = (event) => {
          noteInteraction();
          const target = event.target;
          if (!target || typeof target.closest !== 'function') return false;
          const control = target.closest('[data-tf-boot-replay]:not([disabled])');
          if (!control) return false;
          const scope = control.getAttribute('data-tf-boot-scope');
          if (!scope || bridge.readyScopes[scope]) return false;
          const kind = control.getAttribute('data-tf-boot-event') || 'click';
          if (event.type !== 'click' && kind !== 'pointerdown') return false;
          // The owner may still be loading even after the header has hydrated.
          // Hold the event until that owner's effect confirms handlers exist.
          event.preventDefault();
          event.stopImmediatePropagation();
          const key = control.getAttribute('data-tf-boot-replay');
          if (!bridge.pendingControls.some((entry) => entry.key === key && entry.scope === scope)) {
            if (bridge.pendingControls.length === 20) bridge.pendingControls.shift();
            bridge.pendingControls.push({ key, scope, kind });
          }
          control.setAttribute('data-tf-boot-pending', 'true');
          return true;
        };

        const rememberIntent = (event) => {
          if (rememberControl(event)) return;
          // Sealed once a hydrated control has read the intent: from then on the
          // page is live and React handles presses itself, so recording another
          // intent could only make a later remount act on a stale tap.
          if (bridge.sealed) return;
          const target = event.target;
          if (!target || typeof target.closest !== 'function') return;
          const control = target.closest('[data-tf-boot-intent]:not([disabled])');
          if (!control) return;
          bridge.intent = control.getAttribute('data-tf-boot-intent');
          // Visible acknowledgement: the page heard the tap, it is still waking up.
          control.setAttribute('data-tf-boot-pending', 'true');
        };

        document.addEventListener('pointerdown', rememberControl, { capture: true });
        document.addEventListener('keyup', noteInteraction, { capture: true, passive: true });
        window.addEventListener('scroll', noteInteraction, { capture: true, passive: true });
        document.addEventListener('click', rememberIntent, { capture: true });
        bridge.dispose = () => {
          document.removeEventListener('pointerdown', rememberControl, true);
          document.removeEventListener('keyup', noteInteraction, true);
          window.removeEventListener('scroll', noteInteraction, true);
          document.removeEventListener('click', rememberIntent, true);
        };
      })();
