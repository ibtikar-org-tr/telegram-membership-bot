import { Hono } from 'hono';
import { Environment } from '../../types';
import { D1DatabaseConnection } from '../../crud/database';
import { SheetCrud } from '../../crud/task-follower/sheet';
import { TaskSheetModel } from '../../models/task-follower/sheet';

type Variables = {
  sheetCrud: SheetCrud;
};

const taskSheetRoutes = new Hono<{ Bindings: Environment; Variables: Variables }>();

// Middleware to initialize sheet CRUD
taskSheetRoutes.use('/*', async (c, next) => {
  const db = new D1DatabaseConnection(c.env.DB);
  const sheetCrud = new SheetCrud(db);
  c.set('sheetCrud', sheetCrud);
  await next();
});

// Get all registered sheets
taskSheetRoutes.get('/', async (c) => {
  try {
    const sheetCrud = c.get('sheetCrud') as SheetCrud;
    const sheets = await sheetCrud.getAll();
    return c.json({ success: true, data: sheets });
  } catch (error) {
    console.error('Error getting all sheets:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Get sheet by ID
taskSheetRoutes.get('/:id', async (c) => {
  try {
    const sheetCrud = c.get('sheetCrud') as SheetCrud;
    const sheetId = c.req.param('id');
    const sheet = await sheetCrud.getById(sheetId);
    
    if (!sheet) {
      return c.json({ success: false, error: 'Sheet not found' }, 404);
    }
    
    return c.json({ success: true, data: sheet });
  } catch (error) {
    console.error('Error getting sheet by ID:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Register a new sheet for task checking
taskSheetRoutes.post('/', async (c) => {
  try {
    const sheetCrud = c.get('sheetCrud') as SheetCrud;
    const { sheetID, sheetName } = await c.req.json();
    
    if (!sheetID || !sheetName) {
      return c.json({ 
        success: false, 
        error: 'sheetID and sheetName are required' 
      }, 400);
    }
    
    // Check if sheet already exists
    const db = new D1DatabaseConnection(c.env.DB);
    const existingSheet = await db.prepare('SELECT * FROM sheets WHERE sheetID = ? LIMIT 1')
      .bind(sheetID)
      .first();
    
    if (existingSheet) {
      return c.json({ 
        success: false, 
        error: 'Sheet already registered' 
      }, 409);
    }
    
    const sheetData = {
      sheetID,
      sheetName,
      created_at: new Date()
    };
    
    const result = await sheetCrud.create(sheetData);
    
    if (!result.success) {
      return c.json({ 
        success: false, 
        error: result.error || 'Failed to create sheet' 
      }, 500);
    }
    
    return c.json({ 
      success: true, 
      data: { id: result.id, ...sheetData },
      message: 'Sheet registered successfully' 
    });
  } catch (error) {
    console.error('Error creating sheet:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Update sheet information
taskSheetRoutes.put('/:id', async (c) => {
  try {
    const sheetCrud = c.get('sheetCrud') as SheetCrud;
    const sheetId = c.req.param('id');
    const updateData = await c.req.json();
    
    const result = await sheetCrud.update(sheetId, updateData);
    
    if (!result.success) {
      return c.json({ 
        success: false, 
        error: result.error || 'Failed to update sheet' 
      }, 500);
    }
    
    const updatedSheet = await sheetCrud.getById(sheetId);
    return c.json({ 
      success: true, 
      data: updatedSheet,
      message: 'Sheet updated successfully' 
    });
  } catch (error) {
    console.error('Error updating sheet:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Delete a sheet registration
taskSheetRoutes.delete('/:id', async (c) => {
  try {
    const sheetId = c.req.param('id');
    const db = new D1DatabaseConnection(c.env.DB);
    
    // Check if sheet exists
    const existingSheet = await db.prepare('SELECT * FROM sheets WHERE id = ? LIMIT 1')
      .bind(sheetId)
      .first();
    
    if (!existingSheet) {
      return c.json({ success: false, error: 'Sheet not found' }, 404);
    }
    
    // Delete associated tasks first (cascade delete)
    await db.prepare('DELETE FROM tasks WHERE sheetID = ?')
      .bind((existingSheet as any).sheetID)
      .run();
    
    // Delete the sheet
    const result = await db.prepare('DELETE FROM sheets WHERE id = ?')
      .bind(sheetId)
      .run();
    
    if (!result.success) {
      return c.json({ 
        success: false, 
        error: 'Failed to delete sheet' 
      }, 500);
    }
    
    return c.json({ 
      success: true, 
      message: 'Sheet and associated tasks deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting sheet:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Get sheet by sheetID (Google Sheets ID)
taskSheetRoutes.get('/by-sheet-id/:sheetId', async (c) => {
  try {
    const sheetId = c.req.param('sheetId');
    const db = new D1DatabaseConnection(c.env.DB);
    
    const sheet = await db.prepare('SELECT * FROM sheets WHERE sheetID = ? LIMIT 1')
      .bind(sheetId)
      .first();
    
    if (!sheet) {
      return c.json({ success: false, error: 'Sheet not found' }, 404);
    }
    
    return c.json({ success: true, data: sheet });
  } catch (error) {
    console.error('Error getting sheet by sheetID:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

export { taskSheetRoutes };