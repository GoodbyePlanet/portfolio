import { useState, useEffect } from 'react';
import { useStaggeredReveal } from '../../hooks/useStaggeredReveal';
import { projects } from '../../data/projects';
import { fetchBlogPosts, blogAllHref, type BlogPost } from '../../data/blog';
import { HudFrame } from './HudFrame';
import styles from './HUD.module.css';

export function HudRight() {
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const projectVisibility = useStaggeredReveal(projects.length, 1200, 200);

  useEffect(() => {
    fetchBlogPosts().then(setBlogPosts);
  }, []);

  const blogBaseDelay = 1200 + projects.length * 200 + 400;
  const blogVisibility = useStaggeredReveal(blogPosts.length, blogBaseDelay, 200);

  const [linkVisible, setLinkVisible] = useState(false);

  useEffect(() => {
    if (blogPosts.length === 0) return;
    const delay = blogBaseDelay + blogPosts.length * 200 + 300;
    const t = window.setTimeout(() => setLinkVisible(true), delay);
    return () => clearTimeout(t);
  }, [blogBaseDelay, blogPosts.length]);

  return (
    <div className={styles.hudRight}>
      {/* Projects Panel */}
      <HudFrame title="SIDE_PROJECTS">
        <ul className={styles.hudList}>
          {projects.map((p, i) => (
            <li
              key={p.name}
              className={projectVisibility[i] ? styles.hudListItemVisible : ''}
            >
              <span
                role="link"
                className={styles.projectName}
                onClick={() => window.open(p.link, '_blank', 'noopener,noreferrer')}
              >
                {p.name}
              </span>
              <br />
              <span className={styles.projectTech}>{p.tech}</span>
            </li>
          ))}
        </ul>
      </HudFrame>

      {/* Blog Panel */}
      <HudFrame title="RECENT_LOGS">
        <ul className={styles.hudList}>
          {blogPosts.map((post, i) => (
            <li
              key={post.title}
              className={blogVisibility[i] ? styles.hudListItemVisible : ''}
            >
              <span
                role="link"
                className={styles.blogTitle}
                onClick={() => window.open(post.link, '_blank', 'noopener,noreferrer')}
              >
                {post.title}
              </span>
              <br />
              <span className={styles.blogDate}>{post.date}</span>
            </li>
          ))}
        </ul>
        <span
          role="link"
          onClick={() => window.open(`${blogAllHref}/post`, '_blank', 'noopener,noreferrer')}
          className={`${styles.hudLink}${linkVisible ? ` ${styles.hudLinkVisible}` : ''}`}
        >
          View all Logs
        </span>
      </HudFrame>
    </div>
  );
}
