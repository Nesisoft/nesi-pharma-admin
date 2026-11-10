import { useEffect, useState } from 'react';
import { RELEASES_REPO } from './site';

export type LatestRelease =
  | { status: 'loading' }
  | { status: 'ready'; url: string; version: string; size: number; publishedAt: string }
  | { status: 'none' } // nothing published yet
  | { status: 'error' }; // GitHub unreachable or rate-limited: link to the releases page

export const RELEASES_PAGE = `https://github.com/${RELEASES_REPO}/releases/latest`;

interface GitHubRelease {
  tag_name: string;
  published_at: string;
  assets: { name: string; browser_download_url: string; size: number }[];
}

/**
 * The newest published Windows installer, from the public releases repository
 */
export function useLatestRelease(): LatestRelease {
  const [release, setRelease] = useState<LatestRelease>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`https://api.github.com/repos/${RELEASES_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 404) return setRelease({ status: 'none' });
        if (!response.ok) return setRelease({ status: 'error' });
        const data = (await response.json()) as GitHubRelease;
        const installers = (data.assets || []).filter((asset) => /\.exe$/i.test(asset.name));
        const installer = installers.find((asset) => /setup/i.test(asset.name)) || installers[0];
        if (!installer) return setRelease({ status: 'none' });
        setRelease({
          status: 'ready',
          url: installer.browser_download_url,
          version: data.tag_name.replace(/^v/i, ''),
          size: installer.size,
          publishedAt: data.published_at,
        });
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setRelease({ status: 'error' });
        }
      });
    return () => controller.abort();
  }, []);

  return release;
}
