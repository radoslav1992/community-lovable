import type { APIRoute } from 'astro';
import { commentFeatures } from '../../../lib/schema';

/**
 * Removes a comment written by the current user (moderators and admins may
 * remove any). A comment that still has replies is kept as an empty tombstone
 * so the discussion under it survives; once its last reply is gone the
 * tombstone is pruned as well.
 */
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/vhod', 303);

  const db = locals.runtime.env.DB;
  const form = await request.formData();
  const commentId = Number(form.get('comment_id'));

  const features = await commentFeatures(db);

  const comment = await db
    .prepare(
      `SELECT c.id, c.user_id, ${features.replies ? 'c.parent_id' : 'NULL AS parent_id'}, p.slug
       FROM comments c JOIN posts p ON p.id = c.post_id
       WHERE c.id = ?`
    )
    .bind(commentId)
    .first<{ id: number; user_id: number; parent_id: number | null; slug: string }>();
  if (!comment) return redirect('/', 303);

  const backUrl = `/t/${comment.slug}`;
  const isModerator = user.role === 'admin' || user.role === 'moderator';
  if (comment.user_id !== user.id && !isModerator) {
    return redirect(`${backUrl}?greshka=neotorizirano#komentari`, 303);
  }

  const hasReplies = features.replies
    ? !!(await db
        .prepare('SELECT 1 FROM comments WHERE parent_id = ? LIMIT 1')
        .bind(comment.id)
        .first())
    : false;

  if (hasReplies) {
    if (!features.deletes) return redirect(`${backUrl}?greshka=iztrivane#comment-${comment.id}`, 303);
    if (features.votes) await db.prepare('DELETE FROM comment_votes WHERE comment_id = ?').bind(comment.id).run();
    await db
      .prepare(`UPDATE comments SET body = '', deleted_at = datetime('now') WHERE id = ?`)
      .bind(comment.id)
      .run();
    return redirect(`${backUrl}?iztrito=1#comment-${comment.id}`, 303);
  }

  if (features.votes) await db.prepare('DELETE FROM comment_votes WHERE comment_id = ?').bind(comment.id).run();
  await db.prepare('DELETE FROM comments WHERE id = ?').bind(comment.id).run();

  // Walk up and drop tombstones that were only kept alive by this reply.
  if (features.replies && features.deletes) {
    let parentId = comment.parent_id;
    while (parentId) {
      const parent = await db
        .prepare(
          `SELECT id, parent_id FROM comments
           WHERE id = ? AND deleted_at IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM comments child WHERE child.parent_id = comments.id)`
        )
        .bind(parentId)
        .first<{ id: number; parent_id: number | null }>();
      if (!parent) break;
      await db.prepare('DELETE FROM comments WHERE id = ?').bind(parent.id).run();
      parentId = parent.parent_id;
    }
  }

  return redirect(`${backUrl}?iztrito=1#komentari`, 303);
};
