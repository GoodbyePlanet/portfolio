const RSS_URL = 'https://goodbyeplanet-blog.vercel.app/index.xml';

export interface BlogPost {
  title: string;
  date: string;
  link: string;
}

export const blogAllHref = 'https://goodbyeplanet-blog.vercel.app';

export async function fetchBlogPosts(): Promise<BlogPost[]> {
  const res = await fetch(RSS_URL);
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
