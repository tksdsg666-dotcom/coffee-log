/**
 * Getting the backup JSON out of the app and back in — the web half.
 *
 * Two routes out, chosen by how the app is running rather than by feature
 * detection alone. Installed on the home screen there is no browser chrome and
 * no downloads shelf, so a plain `<a download>` gives the user nothing they can
 * find; the iOS share sheet does, and "存储到文件" lands it in iCloud Drive.
 * In an ordinary tab the download is the familiar thing and the share sheet
 * would be a surprise, so that is what a tab gets.
 */
import { isStandalone } from './pwa';

export const saveBackupFile = async (filename: string, json: string): Promise<boolean> => {
  const blob = new Blob([json], { type: 'application/json' });

  if (isStandalone()) {
    const file = new File([blob], filename, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: '咖啡记录备份' });
        return true;
      } catch (e) {
        // Backing out of the share sheet is not a failure worth reporting.
        if (e instanceof DOMException && e.name === 'AbortError') return true;
        // Anything else falls through to the download below.
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
};

export const pickBackupFile = async (): Promise<string | null> =>
  new Promise<string | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    // Kept off-screen rather than never attached: Safari ignores a click on an
    // input that is not in the document.
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);

    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(value);
    };

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return finish(null);
      void file.text().then(finish, () => finish(null));
    };
    // There is no cancel event for a file input; this is what unblocks the
    // caller when the user dismisses the picker.
    input.oncancel = () => finish(null);

    input.click();
  });
