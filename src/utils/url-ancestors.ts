/**
 * Build the list of ancestor URL paths for a given URL, ordered from most
 * specific to least specific (root last).
 *
 * Examples:
 *   "/destination/vietnam"  -> ["/destination/vietnam", "/destination", "/"]
 *   "/destination/vietnam/" -> ["/destination/vietnam", "/destination", "/"]
 *   "/destination"          -> ["/destination", "/"]
 *   "/"                     -> ["/"]
 *   ""                      -> []
 *
 * Trailing slashes are stripped from non-root paths so "/foo" and "/foo/"
 * are treated as the same path. Useful for "fallback to parent path"
 * lookups where a more specific URL inherits config from an ancestor.
 */
export function buildUrlAncestors(url: string | null | undefined): string[] {
  if (!url) return [];

  // Normalize: strip query & hash, collapse duplicate slashes, drop trailing /.
  let path = url.trim();
  if (!path) return [];

  // Strip query/hash
  const queryIdx = path.indexOf('?');
  if (queryIdx >= 0) path = path.substring(0, queryIdx);
  const hashIdx = path.indexOf('#');
  if (hashIdx >= 0) path = path.substring(0, hashIdx);

  // Collapse duplicate slashes
  path = path.replace(/\/+/g, '/');

  // Strip trailing slash (except for the root)
  if (path.length > 1 && path.endsWith('/')) {
    path = path.replace(/\/+$/, '');
  }

  if (!path) return [];

  // Root URL — only itself.
  if (path === '/') return ['/'];

  const ancestors: string[] = [];
  let current = path;

  while (current && current !== '/') {
    ancestors.push(current);
    const lastSlash = current.lastIndexOf('/');
    if (lastSlash <= 0) {
      break;
    }
    current = current.substring(0, lastSlash);
  }

  ancestors.push('/');
  return ancestors;
}
