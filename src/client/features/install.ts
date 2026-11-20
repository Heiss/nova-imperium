// Installing the game as an app (PWA): the button of the help page, which
// shows only while the browser offers an installation, and the offer on a
// phone, which the player can dismiss for good on this device.
import { $ } from '../dom.ts';
import { client } from '../logic/state.svelte.ts';
import type { ClientFeature } from './contract.ts';

interface InstallPrompt extends Event {
  prompt: () => Promise<unknown>;
}

const DISMISSED_KEY = 'nova.pwa.install-dismissed';

function readDismissal(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** What the browser told about an installation, and the two places that show it. */
function createInstall() {
  let prompt: InstallPrompt | null = null;
  let installedHere = false;
  let dismissed = readDismissal();
  const mobile = matchMedia('(max-width: 800px) and (pointer: coarse)');
  const standalone = matchMedia('(display-mode: standalone)');

  const isInstalled = (): boolean => {
    const platform = navigator as Navigator & { standalone?: boolean };
    return installedHere || standalone.matches || platform.standalone === true;
  };

  const update = (): void => {
    const button = $('#pwa-install');
    if (button) button.hidden = !prompt || isInstalled();
    const offer = $('#pwa-offer');
    if (offer) offer.hidden = !mobile.matches || isInstalled() || dismissed;
  };

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    prompt = event as InstallPrompt;
    update();
  });
  window.addEventListener('appinstalled', () => {
    installedHere = true;
    prompt = null;
    update();
  });
  mobile.addEventListener('change', update);
  standalone.addEventListener('change', update);
  update();

  return {
    update,
    prompt: () => prompt,
    used: () => {
      prompt = null;
      update();
    },
    dismiss: () => {
      dismissed = true;
      try {
        localStorage.setItem(DISMISSED_KEY, '1');
      } catch {
        // The offer still stays hidden in this tab when storage is unavailable.
      }
      update();
    },
  };
}

let install: ReturnType<typeof createInstall> | null = null;

export const clientFeature = {
  listen: () => {
    install = createInstall();
  },
  acts: ({ modal, toast }) => {
    const state = {
      dismiss: () => install?.dismiss(),
      prompt: () => install?.prompt() ?? null,
      used: () => install?.used(),
    };
    return {
      dismissInstall: () => state.dismiss(),
      installApp: async () => {
        const prompt = state.prompt();
        if (!prompt) {
          modal(
            '<p>Öffne das Browsermenü und wähle „App installieren“ oder „Zum Startbildschirm hinzufügen“.</p><p>Auf iPhone und iPad in Safari: „Teilen“ → „Zum Home-Bildschirm“ → „Als Web-App öffnen“.</p><p>Zum Spielen brauchst du eine Internetverbindung.</p><button type="button" data-act="closeModal">Schließen</button>',
          );
          return;
        }
        state.used();
        try {
          await prompt.prompt();
        } catch {
          toast('Bitte installiere die App über das Browsermenü.', true);
        }
      },
    };
  },
  afterRender: () => {
    if (client.ui.view === 'help') install?.update();
  },
} satisfies ClientFeature;
