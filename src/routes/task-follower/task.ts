import { Hono } from 'hono';
import { Environment } from '../../types';
import { D1DatabaseConnection } from '../../crud/database';
import { TaskService } from '../../services/task-follower/task-service';
import { TaskModel } from '../../models/task-follower/task';

type Variables = {
  taskService: TaskService;
};

const taskRoutes = new Hono<{ Bindings: Environment; Variables: Variables }>();

// Middleware to initialize task service
taskRoutes.use('/*', async (c, next) => {
  const db = new D1DatabaseConnection(c.env.DB);
  const taskService = new TaskService(db, c.env);
  c.set('taskService', taskService);
  await next();
});

// Get all tasks
taskRoutes.get('/', async (c) => {
  try {
    const taskService = c.get('taskService') as TaskService;
    const tasks = await taskService.getAllTasks();
    return c.json({ success: true, data: tasks });
  } catch (error) {
    console.error('Error getting all tasks:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Get task by ID
taskRoutes.get('/:id', async (c) => {
  try {
    const taskService = c.get('taskService') as TaskService;
    const taskId = c.req.param('id');
    const task = await taskService.getTaskById(taskId);
    
    if (!task) {
      return c.json({ success: false, error: 'Task not found' }, 404);
    }
    
    return c.json({ success: true, data: task });
  } catch (error) {
    console.error('Error getting task by ID:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Get tasks by owner ID
taskRoutes.get('/owner/:ownerId', async (c) => {
  try {
    const taskService = c.get('taskService') as TaskService;
    const ownerId = c.req.param('ownerId');
    
    const db = new D1DatabaseConnection(c.env.DB);
    const tasks = await db.prepare('SELECT * FROM tasks WHERE ownerID = ? ORDER BY created_at DESC')
      .bind(ownerId)
      .all();
    
    return c.json({ success: true, data: tasks.results || [] });
  } catch (error) {
    console.error('Error getting tasks by owner ID:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Get tasks by project name
taskRoutes.get('/project/:projectName', async (c) => {
  try {
    const taskService = c.get('taskService') as TaskService;
    const projectName = c.req.param('projectName');
    
    const db = new D1DatabaseConnection(c.env.DB);
    const tasks = await db.prepare('SELECT * FROM tasks WHERE projectName = ? ORDER BY created_at DESC')
      .bind(projectName)
      .all();
    
    return c.json({ success: true, data: tasks.results || [] });
  } catch (error) {
    console.error('Error getting tasks by project name:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Get tasks by status
taskRoutes.get('/status/:status', async (c) => {
  try {
    const taskService = c.get('taskService') as TaskService;
    const status = c.req.param('status');
    
    const db = new D1DatabaseConnection(c.env.DB);
    const tasks = await db.prepare('SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC')
      .bind(status)
      .all();
    
    return c.json({ success: true, data: tasks.results || [] });
  } catch (error) {
    console.error('Error getting tasks by status:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Get tasks needing attention (overdue, due soon, blocked)
taskRoutes.get('/attention/all', async (c) => {
  try {
    const taskService = c.get('taskService') as TaskService;
    const tasksNeedingAttention = await taskService.getTasksNeedingAttention();
    return c.json({ success: true, data: tasksNeedingAttention });
  } catch (error) {
    console.error('Error getting tasks needing attention:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Create a new task
taskRoutes.post('/', async (c) => {
  try {
    const taskService = c.get('taskService') as TaskService;
    const taskData = await c.req.json();
    
    // Validate required fields
    if (!taskData.sheetID || !taskData.projectName || !taskData.ownerID || 
        !taskData.ownerName || !taskData.taskText || !taskData.status) {
      return c.json({ 
        success: false, 
        error: 'Missing required fields: sheetID, projectName, ownerID, ownerName, taskText, status' 
      }, 400);
    }
    
    // Parse date strings to Date objects where needed
    if (taskData.dueDate && typeof taskData.dueDate === 'string') {
      try {
        taskData.dueDate = new Date(taskData.dueDate);
        // Check if date is valid
        if (isNaN(taskData.dueDate.getTime())) {
          taskData.dueDate = null;
        }
      } catch {
        taskData.dueDate = null;
      }
    }
    
    const task = new TaskModel(taskData);
    const createdTask = await taskService.createNewTask(task);
    
    if (!createdTask) {
      return c.json({ success: false, error: 'Failed to create task' }, 500);
    }
    
    return c.json({ success: true, data: createdTask });
  } catch (error) {
    console.error('Error creating task:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Update a task
taskRoutes.put('/:id', async (c) => {
  try {
    const taskService = c.get('taskService') as TaskService;
    const taskId = c.req.param('id');
    const taskData = await c.req.json();
    
    const updatedTask = await taskService.updateTaskById(taskId, taskData);
    
    if (!updatedTask) {
      return c.json({ success: false, error: 'Task not found or update failed' }, 404);
    }
    
    return c.json({ success: true, data: updatedTask });
  } catch (error) {
    console.error('Error updating task:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Update task status
taskRoutes.patch('/:id/status', async (c) => {
  try {
    const taskService = c.get('taskService') as TaskService;
    const taskId = c.req.param('id');
    const { status } = await c.req.json();
    
    if (!status) {
      return c.json({ success: false, error: 'Status is required' }, 400);
    }
    
    const db = new D1DatabaseConnection(c.env.DB);
    const updateData: any = { 
      status, 
      updated_at: new Date().toISOString()
    };

    // Set completion or block timestamps
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    } else if (status === 'blocked') {
      updateData.blocked_at = new Date().toISOString();
    }

    const result = await db.prepare(
      'UPDATE tasks SET status = ?, updated_at = ?, completed_at = ?, blocked_at = ? WHERE id = ?'
    ).bind(
      status,
      updateData.updated_at,
      updateData.completed_at || null,
      updateData.blocked_at || null,
      taskId
    ).run();
    
    if (!result.success) {
      return c.json({ success: false, error: 'Failed to update task status' }, 500);
    }
    
    const updatedTask = await taskService.getTaskById(taskId);
    return c.json({ success: true, data: updatedTask });
  } catch (error) {
    console.error('Error updating task status:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Delete a task
taskRoutes.delete('/:id', async (c) => {
  try {
    const taskId = c.req.param('id');
    const db = new D1DatabaseConnection(c.env.DB);
    
    const result = await db.prepare('DELETE FROM tasks WHERE id = ?').bind(taskId).run();
    
    if (!result.success) {
      return c.json({ success: false, error: 'Failed to delete task' }, 500);
    }
    
    return c.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Trigger task checking for a specific sheet
taskRoutes.post('/check-sheet/:sheetId', async (c) => {
  try {
    const taskService = c.get('taskService') as TaskService;
    const sheetId = c.req.param('sheetId');
    
    const result = await taskService.checkTasksFromSheet(sheetId);
    return c.json({ success: true, message: result });
  } catch (error) {
    console.error('Error checking sheet tasks:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Trigger task checking for all sheets
taskRoutes.post('/check-all', async (c) => {
  try {
    const taskService = c.get('taskService') as TaskService;
    
    await taskService.checkAllSheets();
    return c.json({ success: true, message: 'All sheets checked successfully' });
  } catch (error) {
    console.error('Error checking all sheets:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

// Trigger task checking during work hours
taskRoutes.post('/check-work-hours', async (c) => {
  try {
    const taskService = c.get('taskService') as TaskService;
    
    await taskService.checkAllSheetsAtWorkHours();
    return c.json({ success: true, message: 'Work hours check completed' });
  } catch (error) {
    console.error('Error checking tasks during work hours:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

export { taskRoutes };