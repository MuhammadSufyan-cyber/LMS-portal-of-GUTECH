import { Router, type Request } from 'express';
import { getServiceSupabase } from '../config/supabase.js';
import { requireAuth, requireRole } from '../middleware/require-auth.js';
import { paginationSchema } from '../schemas/courses.schema.js';
import { asyncHandler } from '../utils/async-handler.js';
export const auditRouter = Router();
auditRouter.get(
  '/admin/audit',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req: Request, res) => {
    const query = paginationSchema.parse(req.query);
    const from = (query.page - 1) * query.pageSize;
    const { data, error, count } = await getServiceSupabase()
      .from('audit_log')
      .select(
        'id,actor_id,action,entity,entity_id,at,profile:profiles!audit_log_actor_id_fkey(full_name,email)',
        { count: 'exact' },
      )
      .order('at', { ascending: false })
      .range(from, from + query.pageSize - 1);
    if (error) throw error;
    res.json({
      data: data ?? [],
      meta: { page: query.page, pageSize: query.pageSize, total: count ?? 0 },
    });
  }),
);
