import { Hono } from 'hono';
import { Environment } from '../types';
import { GroupsCrud } from '../crud/groups';
import { authMiddleware } from '../middleware/auth';
import { GroupAdmin, GroupModel } from '../models/groups';

const groupsRouter = new Hono<{ Bindings: Environment }>();

// Apply auth middleware to all group routes
groupsRouter.use('*', authMiddleware);

/**
 * POST /groups/store
 * Store or update a group with admins
 * Body: {
 *   chat_id: string,
 *   title: string,
 *   type: string,
 *   username?: string,
 *   description?: string,
 *   invite_link?: string,
 *   is_active?: boolean,
 *   member_count?: number,
 *   needs_admin_approval?: boolean,
 *   admins?: Array<{ user_id: string, username?: string, first_name?: string, last_name?: string, status: 'creator' | 'administrator' }>,
 *   notes?: string
 * }
 */
groupsRouter.post('/store', async (c) => {
  try {
    const body = await c.req.json();
    
    const { 
      chat_id, 
      title, 
      type, 
      username, 
      description, 
      invite_link, 
      is_active, 
      member_count, 
      needs_admin_approval,
      admins, 
      notes 
    } = body;

    // Validate required fields
    if (!chat_id || !title || !type) {
      return c.json({ 
        error: 'Missing required fields: chat_id, title, and type are required' 
      }, 400);
    }

    const groupsCrud = new GroupsCrud(c.env.DB);

    const groupData: GroupModel = {
      chat_id: chat_id.toString(),
      title,
      type,
      username: username || null,
      description: description || null,
      invite_link: invite_link || null,
      is_active: is_active ? 1 : 0,
      member_count: member_count || null,
      needs_admin_approval: needs_admin_approval ? 1 : 0,
      notes: notes || null
    };

    // Validate admins format if provided
    let adminsList: GroupAdmin[] | undefined;
    if (admins) {
      if (!Array.isArray(admins)) {
        return c.json({ 
          error: 'admins must be an array' 
        }, 400);
      }

      // Validate each admin object
      for (const admin of admins) {
        if (!admin.user_id) {
          return c.json({ 
            error: 'Each admin must have a user_id' 
          }, 400);
        }
        if (admin.status && !['creator', 'administrator'].includes(admin.status)) {
          return c.json({ 
            error: 'Admin status must be either "creator" or "administrator"' 
          }, 400);
        }
      }

      adminsList = admins;
    }

    // Upsert the group (create if new, update if exists)
    const result = await groupsCrud.upsertGroup(groupData, adminsList);

    if (!result.success) {
      return c.json({ 
        error: result.error || 'Failed to store group' 
      }, 500);
    }

    return c.json({ 
      success: true,
      id: result.id,
      isNew: result.isNew,
      message: result.isNew ? 'Group created successfully' : 'Group updated successfully'
    });
  } catch (error) {
    console.error('Store group error:', error);
    return c.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /groups
 * Get all groups with pagination
 * Query params: limit, offset
 */
groupsRouter.get('/', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    const groupsCrud = new GroupsCrud(c.env.DB);
    const groups = await groupsCrud.getGroups(limit, offset);

    return c.json({ 
      success: true,
      groups,
      count: groups.length
    });
  } catch (error) {
    console.error('Get groups error:', error);
    return c.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /groups/active
 * Get all active groups
 */
groupsRouter.get('/active', async (c) => {
  try {
    const groupsCrud = new GroupsCrud(c.env.DB);
    const groups = await groupsCrud.getActiveGroups();

    return c.json({ 
      success: true,
      groups,
      count: groups.length
    });
  } catch (error) {
    console.error('Get active groups error:', error);
    return c.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /groups/:id
 * Get a group by ID
 */
groupsRouter.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const groupsCrud = new GroupsCrud(c.env.DB);
    const group = await groupsCrud.getGroupById(id);

    if (!group) {
      return c.json({ 
        error: 'Group not found' 
      }, 404);
    }

    return c.json({ 
      success: true,
      group
    });
  } catch (error) {
    console.error('Get group by ID error:', error);
    return c.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /groups/chat/:chatId
 * Get a group by chat ID
 */
groupsRouter.get('/chat/:chatId', async (c) => {
  try {
    const chatId = c.req.param('chatId');

    const groupsCrud = new GroupsCrud(c.env.DB);
    const group = await groupsCrud.getGroupByChatId(chatId);

    if (!group) {
      return c.json({ 
        error: 'Group not found' 
      }, 404);
    }

    return c.json({ 
      success: true,
      group
    });
  } catch (error) {
    console.error('Get group by chat ID error:', error);
    return c.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * PUT /groups/:id/admins
 * Update group admins
 * Body: {
 *   admins: Array<{ user_id: string, username?: string, first_name?: string, last_name?: string, status: 'creator' | 'administrator' }>
 * }
 */
groupsRouter.put('/:id/admins', async (c) => {
  try {
    const id = c.req.param('id');
    const { admins } = await c.req.json();

    if (!admins || !Array.isArray(admins)) {
      return c.json({ 
        error: 'admins must be an array' 
      }, 400);
    }

    // Validate each admin object
    for (const admin of admins) {
      if (!admin.user_id) {
        return c.json({ 
          error: 'Each admin must have a user_id' 
        }, 400);
      }
      if (admin.status && !['creator', 'administrator'].includes(admin.status)) {
        return c.json({ 
          error: 'Admin status must be either "creator" or "administrator"' 
        }, 400);
      }
    }

    const groupsCrud = new GroupsCrud(c.env.DB);
    const result = await groupsCrud.updateGroupAdmins(id, admins);

    if (!result.success) {
      return c.json({ 
        error: result.error || 'Failed to update admins' 
      }, 500);
    }

    return c.json({ 
      success: true,
      message: 'Admins updated successfully'
    });
  } catch (error) {
    console.error('Update admins error:', error);
    return c.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * PUT /groups/:id/status
 * Update group active status
 * Body: { is_active: boolean }
 */
groupsRouter.put('/:id/status', async (c) => {
  try {
    const id = c.req.param('id');
    const { is_active } = await c.req.json();

    if (typeof is_active !== 'boolean') {
      return c.json({ 
        error: 'is_active must be a boolean' 
      }, 400);
    }

    const groupsCrud = new GroupsCrud(c.env.DB);
    const result = await groupsCrud.setGroupActiveStatus(id, is_active);

    if (!result.success) {
      return c.json({ 
        error: result.error || 'Failed to update status' 
      }, 500);
    }

    return c.json({ 
      success: true,
      message: 'Group status updated successfully'
    });
  } catch (error) {
    console.error('Update status error:', error);
    return c.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /groups/search/:term
 * Search groups by title
 */
groupsRouter.get('/search/:term', async (c) => {
  try {
    const term = c.req.param('term');
    const limit = parseInt(c.req.query('limit') || '20');

    const groupsCrud = new GroupsCrud(c.env.DB);
    const groups = await groupsCrud.searchGroupsByTitle(term, limit);

    return c.json({ 
      success: true,
      groups,
      count: groups.length
    });
  } catch (error) {
    console.error('Search groups error:', error);
    return c.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /groups/admin/:userId
 * Get groups where user is admin
 */
groupsRouter.get('/admin/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');

    const groupsCrud = new GroupsCrud(c.env.DB);
    const groups = await groupsCrud.getGroupsByAdmin(userId);

    return c.json({ 
      success: true,
      groups,
      count: groups.length
    });
  } catch (error) {
    console.error('Get groups by admin error:', error);
    return c.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * DELETE /groups/:id
 * Delete a group (soft delete by setting is_active to 0)
 */
groupsRouter.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const groupsCrud = new GroupsCrud(c.env.DB);
    const result = await groupsCrud.setGroupActiveStatus(id, false);

    if (!result.success) {
      return c.json({ 
        error: result.error || 'Failed to delete group' 
      }, 500);
    }

    return c.json({ 
      success: true,
      message: 'Group deleted successfully'
    });
  } catch (error) {
    console.error('Delete group error:', error);
    return c.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default groupsRouter;
