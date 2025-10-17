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
    manager_telegram_id TEXT,
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
    owner_telegram_id TEXT,
    owner_telegram_username TEXT,
    managerID TEXT,
    managerName TEXT NOT NULL,
    manager_telegram_id TEXT,
    manager_telegram_username TEXT,
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

-- Telegram User States table
CREATE TABLE IF NOT EXISTS telegram_user_states (
    telegram_id TEXT PRIMARY KEY,
    state TEXT NOT NULL DEFAULT 'normal',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    modified_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- All Private Messages table
CREATE TABLE IF NOT EXISTS all_messages_private (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    message_json TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- All Group Messages table
CREATE TABLE IF NOT EXISTS all_messages_groups (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    message_json TEXT NOT NULL,
    chat_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    message_thread_id TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    chat_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    username TEXT,
    description TEXT,
    invite_link TEXT, -- Only used if the group has static invite link, otherwise links are generated dynamically for every user
    is_active INTEGER NOT NULL DEFAULT 1,
    member_count INTEGER,
    admins TEXT NOT NULL DEFAULT '[]',
    needs_admin_approval INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_activities_manager_id ON activities(managerID);
CREATE INDEX IF NOT EXISTS idx_activities_manager_telegram_id ON activities(manager_telegram_id);
CREATE INDEX IF NOT EXISTS idx_activities_project_name ON activities(projectName);
CREATE INDEX IF NOT EXISTS idx_sheets_sheet_id ON sheets(sheetID);
CREATE INDEX IF NOT EXISTS idx_tasks_sheet_id ON tasks(sheetID);
CREATE INDEX IF NOT EXISTS idx_tasks_owner_id ON tasks(ownerID);
CREATE INDEX IF NOT EXISTS idx_tasks_owner_telegram_id ON tasks(owner_telegram_id);
CREATE INDEX IF NOT EXISTS idx_tasks_owner_telegram_username ON tasks(owner_telegram_username);
CREATE INDEX IF NOT EXISTS idx_tasks_manager_id ON tasks(managerID);
CREATE INDEX IF NOT EXISTS idx_tasks_manager_name ON tasks(managerName);
CREATE INDEX IF NOT EXISTS idx_tasks_manager_telegram_id ON tasks(manager_telegram_id);
CREATE INDEX IF NOT EXISTS idx_tasks_manager_telegram_username ON tasks(manager_telegram_username);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(dueDate);
CREATE INDEX IF NOT EXISTS idx_tasks_project_name ON tasks(projectName);
CREATE INDEX IF NOT EXISTS idx_telegram_user_states_telegram_id ON telegram_user_states(telegram_id);
CREATE INDEX IF NOT EXISTS idx_telegram_user_states_state ON telegram_user_states(state);
CREATE INDEX IF NOT EXISTS idx_telegram_user_states_modified_at ON telegram_user_states(modified_at);
CREATE INDEX IF NOT EXISTS idx_all_messages_private_created_at ON all_messages_private(created_at);
CREATE INDEX IF NOT EXISTS idx_all_messages_groups_created_at ON all_messages_groups(created_at);
CREATE INDEX IF NOT EXISTS idx_all_messages_groups_chat_id ON all_messages_groups(chat_id);
CREATE INDEX IF NOT EXISTS idx_all_messages_groups_user_id ON all_messages_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_all_messages_groups_message_thread_id ON all_messages_groups(message_thread_id);
CREATE INDEX IF NOT EXISTS idx_all_messages_groups_chat_thread ON all_messages_groups(chat_id, message_thread_id);
CREATE INDEX IF NOT EXISTS idx_groups_chat_id ON groups(chat_id);
CREATE INDEX IF NOT EXISTS idx_groups_type ON groups(type);
CREATE INDEX IF NOT EXISTS idx_groups_is_active ON groups(is_active);
CREATE INDEX IF NOT EXISTS idx_groups_username ON groups(username);

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

CREATE TRIGGER IF NOT EXISTS update_telegram_user_states_modified_at 
    AFTER UPDATE ON telegram_user_states 
    FOR EACH ROW 
    BEGIN
        UPDATE telegram_user_states SET modified_at = datetime('now') WHERE telegram_id = NEW.telegram_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_groups_updated_at 
    AFTER UPDATE ON groups 
    FOR EACH ROW 
    BEGIN
        UPDATE groups SET updated_at = datetime('now') WHERE id = NEW.id;
    END;