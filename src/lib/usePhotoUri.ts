/**
 * Resolves a stored photo filename to something `<Image source>` can take.
 *
 * Native answers immediately and this never re-renders. On the web the answer
 * comes from IndexedDB, so a photo the user has not looked at yet is null for
 * one frame and appears just after.
 */
import { useEffect, useState } from 'react';

import { cachedPhotoUri, resolvePhotoUri } from './photos';

export const usePhotoUri = (filename: string | null | undefined): string | null => {
  const [uri, setUri] = useState(() => cachedPhotoUri(filename));

  useEffect(() => {
    const immediate = cachedPhotoUri(filename);
    setUri(immediate);
    if (!filename || immediate) return;

    let alive = true;
    void resolvePhotoUri(filename).then((resolved) => {
      if (alive) setUri(resolved);
    });
    return () => {
      alive = false;
    };
  }, [filename]);

  return uri;
};
