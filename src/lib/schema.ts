// Feature detection for schema drift: the worker can be deployed before the
// D1 migrations are applied, so anything that depends on a newer column or
// table asks first and degrades gracefully instead of throwing.

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export async function hasColumn(db: D1Database, table: string, column: string): Promise<boolean> {
  if (!IDENTIFIER_RE.test(table)) throw new Error(`invalid table name: ${table}`);
  const columns = (await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>()).results;
  return columns.some((c) => c.name === column);
}

export async function hasTable(db: D1Database, table: string): Promise<boolean> {
  const row = await db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .bind(table)
    .first();
  return !!row;
}

export interface CommentFeatures {
  /** `comments.parent_id` — threaded replies (migration 0012). */
  replies: boolean;
  /** `comments.deleted_at` — tombstones for deleted comments (migration 0013). */
  deletes: boolean;
  /** `comment_votes` table — upvotes on comments (migration 0013). */
  votes: boolean;
}

export async function commentFeatures(db: D1Database): Promise<CommentFeatures> {
  const columns = (await db.prepare('PRAGMA table_info(comments)').all<{ name: string }>()).results;
  return {
    replies: columns.some((c) => c.name === 'parent_id'),
    deletes: columns.some((c) => c.name === 'deleted_at'),
    votes: await hasTable(db, 'comment_votes'),
  };
}
