import { SaveSystem } from './SaveSystem';

/**
 * Moving a camp in and out of a file.
 *
 * The game saves to localStorage, which a browser can clear without warning and which
 * does not follow a player to another machine. Exporting to a file is the only way a
 * camp genuinely belongs to the person who built it.
 *
 * Kept separate from SaveSystem because this is browser plumbing: blobs, object URLs
 * and a file picker. SaveSystem stays about the save itself.
 */
export const SaveFile = {
  /** Download the current camp. Returns the filename used. */
  download(): string {
    const filename = SaveSystem.suggestedFilename();
    const json = SaveSystem.exportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    // Give the browser a moment to start the download before tearing the URL down.
    window.setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1000);

    return filename;
  },

  /**
   * Ask for a file and restore it. The callback receives a readable result either way,
   * because the player picked the file and needs to be told what happened to it.
   *
   * Nothing happens at all if they cancel the picker.
   */
  pickAndRestore(onResult: (result: { ok: boolean; message: string }) => void): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      cleanup();
      if (!file) return;

      if (file.size > 2_000_000) {
        onResult({ ok: false, message: 'That file is far too large to be a camp.' });
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => onResult({ ok: false, message: 'That file could not be read.' });
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : '';
        const result = SaveSystem.importJson(text);
        if (result.ok) {
          onResult({ ok: true, message: 'Camp restored.' });
        } else {
          onResult({ ok: false, message: result.reason });
        }
      };
      reader.readAsText(file);
    });

    // Firefox needs the input in the document for the picker to open.
    document.body.appendChild(input);
    input.click();

    function cleanup(): void {
      if (input.parentNode) document.body.removeChild(input);
    }
  },
};
