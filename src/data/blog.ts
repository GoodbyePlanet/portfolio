const RSS_URL = 'https://blog.goodbyeplanet.dev/index.xml';

export interface BlogPost {
  title: string;
  date: string;
  link: string;
}

export const blogAllHref = 'https://blog.goodbyeplanet.dev';

export async function fetchBlogPosts(): Promise<BlogPost[]> {
  // Bypass browser/CDN caching so newly published posts always show up.
  // The feed has no Cache-Control header, so browsers apply heuristic caching;
  // 'no-store' plus a cache-busting query param defeats both layers.
  const res = await fetch(`${RSS_URL}?_=${Date.now()}`, { cache: 'no-store' });
  const text = await res.text();
  const xml = new DOMParser().parseFromString(text, 'text/xml');
  const items = xml.querySelectorAll('item');

  const posts: BlogPost[] = [];
  items.forEach((item) => {
    const title = item.querySelector('title')?.textContent ?? '';
    const pubDate = item.querySelector('pubDate')?.textContent ?? '';
    const date = pubDate ? new Date(pubDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }) : '';
    const link = item.querySelector('link')?.textContent ?? '';
    posts.push({ title, date, link: `${blogAllHref}${link}` });
  });

  return posts.slice(0, 3);
}
