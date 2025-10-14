-- Migration script for Telegram Membership Bot (Cloudflare D1/SQLite)
-- Created: 2025-10-12
-- Description: Initial database schema for activities, sheets, and tasks


-- Activities table (Daily checkup for the manager)
CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_reported TEXT,
    managerName TEXT NOT NULL,
    managerID TEXT NOT NULL,
    projectName TEXT NOT NULL
);

-- Sheets table
CREATE TABLE IF NOT EXISTS sheets (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    sheetID TEXT NOT NULL,
    sheetName TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_sent TEXT,
    last_reported TEXT,
    sheetID TEXT NOT NULL,
    projectName TEXT NOT NULL,
    pageID TEXT NOT NULL,
    row_number INTEGER NOT NULL,
    ownerID TEXT NOT NULL,
    ownerName TEXT NOT NULL,
    ownerEmail TEXT NOT NULL,
    ownerPhone TEXT NOT NULL,
    managerName TEXT NOT NULL,
    points TEXT NOT NULL,
    status TEXT NOT NULL,
    taskText TEXT NOT NULL,
    priority TEXT NOT NULL,
    dueDate TEXT,
    completed_at TEXT,
    blocked_at TEXT,
    notes TEXT,
    milestone TEXT NOT NULL DEFAULT ''
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_activities_manager_id ON activities(managerID);
CREATE INDEX IF NOT EXISTS idx_activities_project_name ON activities(projectName);
CREATE INDEX IF NOT EXISTS idx_sheets_sheet_id ON sheets(sheetID);
CREATE INDEX IF NOT EXISTS idx_tasks_sheet_id ON tasks(sheetID);
CREATE INDEX IF NOT EXISTS idx_tasks_owner_id ON tasks(ownerID);
CREATE INDEX IF NOT EXISTS idx_tasks_manager_name ON tasks(managerName);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(dueDate);
CREATE INDEX IF NOT EXISTS idx_tasks_project_name ON tasks(projectName);

-- Create triggers for updating updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_activities_updated_at 
    AFTER UPDATE ON activities 
    FOR EACH ROW 
    BEGIN
        UPDATE activities SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_tasks_updated_at 
    AFTER UPDATE ON tasks 
    FOR EACH ROW 
    BEGIN
        UPDATE tasks SET updated_at = datetime('now') WHERE id = NEW.id;
    END;