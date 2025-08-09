#!/usr/bin/env node
/**
 * Database backup script for StarForgeFrontier
 * Creates timestamped backups of the SQLite database
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DATABASE_PATH = process.env.DATABASE_PATH || 'starforge.db';
const BACKUP_DIR = process.env.BACKUP_DIR || './backups';
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS) || 7; // Keep 7 days of backups

async function createBackup() {
  try {
    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // Check if database exists
    if (!fs.existsSync(DATABASE_PATH)) {
      console.log('❌ Database file not found:', DATABASE_PATH);
      process.exit(1);
    }

    // Generate backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `starforge_backup_${timestamp}.db`);

    console.log('🔄 Creating backup...');
    console.log('Source:', DATABASE_PATH);
    console.log('Backup:', backupPath);

    // Create backup using SQLite's backup API
    const sourceDb = new sqlite3.Database(DATABASE_PATH, sqlite3.OPEN_READONLY);
    const backupDb = new sqlite3.Database(backupPath);

    await new Promise((resolve, reject) => {
      sourceDb.backup(backupDb, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    await new Promise((resolve, reject) => {
      sourceDb.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await new Promise((resolve, reject) => {
      backupDb.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Verify backup
    const stats = fs.statSync(backupPath);
    console.log(`✅ Backup created successfully (${Math.round(stats.size / 1024)} KB)`);

    // Clean up old backups
    await cleanupOldBackups();

  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    process.exit(1);
  }
}

async function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('starforge_backup_') && file.endsWith('.db'))
      .map(file => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        time: fs.statSync(path.join(BACKUP_DIR, file)).mtime
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > MAX_BACKUPS) {
      const filesToDelete = files.slice(MAX_BACKUPS);
      console.log(`🧹 Cleaning up ${filesToDelete.length} old backups...`);
      
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
        console.log(`   Deleted: ${file.name}`);
      }
    }

    console.log(`📦 Keeping ${Math.min(files.length, MAX_BACKUPS)} backup(s)`);
  } catch (error) {
    console.error('⚠️  Cleanup warning:', error.message);
  }
}

async function listBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('starforge_backup_') && file.endsWith('.db'))
      .map(file => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: Math.round(stats.size / 1024),
          date: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (files.length === 0) {
      console.log('📝 No backups found');
    } else {
      console.log('📝 Available backups:');
      files.forEach(file => {
        console.log(`   ${file.name} (${file.size} KB) - ${file.date}`);
      });
    }
  } catch (error) {
    console.error('❌ Failed to list backups:', error.message);
  }
}

async function restoreBackup(backupFile) {
  try {
    const backupPath = path.join(BACKUP_DIR, backupFile);
    
    if (!fs.existsSync(backupPath)) {
      console.log('❌ Backup file not found:', backupPath);
      process.exit(1);
    }

    // Create backup of current database
    if (fs.existsSync(DATABASE_PATH)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const currentBackupPath = path.join(BACKUP_DIR, `starforge_current_${timestamp}.db`);
      fs.copyFileSync(DATABASE_PATH, currentBackupPath);
      console.log('💾 Current database backed up to:', currentBackupPath);
    }

    // Restore from backup
    fs.copyFileSync(backupPath, DATABASE_PATH);
    console.log('✅ Database restored from:', backupFile);

  } catch (error) {
    console.error('❌ Restore failed:', error.message);
    process.exit(1);
  }
}

// Command line interface
const command = process.argv[2];
const argument = process.argv[3];

switch (command) {
  case 'create':
  case undefined:
    createBackup();
    break;
  case 'list':
    listBackups();
    break;
  case 'restore':
    if (!argument) {
      console.log('❌ Please specify backup file to restore');
      console.log('Usage: node backup.js restore <backup-filename>');
      process.exit(1);
    }
    restoreBackup(argument);
    break;
  default:
    console.log('Usage:');
    console.log('  node backup.js create  - Create a new backup');
    console.log('  node backup.js list    - List available backups');
    console.log('  node backup.js restore <filename> - Restore from backup');
    process.exit(1);
}