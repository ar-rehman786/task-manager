const bcrypt = require('bcryptjs');
const { db, initializeDatabase } = require('./database');

async function seedDatabase() {
  console.log('🌱 Seeding database...');

  // Initialize database first
  initializeDatabase();

  // Clear existing data
  db.exec('DELETE FROM milestone_checklist_items');
  db.exec('DELETE FROM milestones');
  db.exec('DELETE FROM project_logs');
  db.exec('DELETE FROM projects');
  db.exec('DELETE FROM task_activity');
  db.exec('DELETE FROM tasks');
  db.exec('DELETE FROM boards');
  db.exec('DELETE FROM users');

  // Hash password
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const memberPassword = await bcrypt.hash('member123', 10);

  // Insert users
  const insertUser = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');

  insertUser.run('Admin User', 'admin@taskmanager.com', hashedPassword, 'admin');
  insertUser.run('Abdul Rahman', 'abdul@taskmanager.com', memberPassword, 'member');
  insertUser.run('Ali Hassan', 'ali@taskmanager.com', memberPassword, 'member');
  insertUser.run('Sarah Ahmed', 'sarah@taskmanager.com', memberPassword, 'member');

  console.log('✅ Created 4 users (1 admin, 3 members)');

  // Create boards
  const insertBoard = db.prepare('INSERT INTO boards (workspace, name, type, ownerUserId) VALUES (?, ?, ?, ?)');

  // All Tasks board
  insertBoard.run('tasks', 'All Tasks', 'ALL_TASKS', null);

  // Member boards
  insertBoard.run('tasks', "Abdul's Board", 'MEMBER_BOARD', 2);
  insertBoard.run('tasks', "Ali's Board", 'MEMBER_BOARD', 3);
  insertBoard.run('tasks', "Sarah's Board", 'MEMBER_BOARD', 4);

  console.log('✅ Created 4 boards (1 All Tasks, 3 member boards)');

  // Create sample tasks
  const insertTask = db.prepare(`
    INSERT INTO tasks (title, description, status, priority, dueDate, assignedUserId, createdBy, labels)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  insertTask.run('Design new landing page', 'Create mockups for the new product landing page', 'in_progress', 'high', tomorrow, 2, 1, 'design,frontend');
  insertTask.run('Fix login bug', 'Users unable to login with special characters in password', 'todo', 'high', today, 3, 1, 'bug,backend');
  insertTask.run('Update documentation', 'Add API documentation for new endpoints', 'todo', 'medium', nextWeek, 2, 1, 'docs');
  insertTask.run('Database optimization', 'Optimize slow queries in reports module', 'in_progress', 'medium', nextWeek, 3, 1, 'backend,performance');
  insertTask.run('Code review', 'Review pull request #234', 'todo', 'low', tomorrow, 4, 1, 'review');
  insertTask.run('Setup CI/CD pipeline', 'Configure GitHub Actions for automated testing', 'blocked', 'high', today, 2, 1, 'devops');
  insertTask.run('Mobile responsive fixes', 'Fix layout issues on mobile devices', 'done', 'medium', today, 4, 1, 'frontend,bug');
  insertTask.run('User feedback analysis', 'Analyze and categorize user feedback from last sprint', 'done', 'low', today, 3, 1, 'research');
  insertTask.run('Security audit', 'Perform security audit on authentication flow', 'todo', 'high', nextWeek, null, 1, 'security');
  insertTask.run('Performance testing', 'Load test the new API endpoints', 'todo', 'medium', nextWeek, null, 1, 'testing');

  console.log('✅ Created 10 sample tasks');

  // Create sample projects
  const insertProject = db.prepare(`
    INSERT INTO projects (name, client, status, startDate, endDate, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const projectStart = new Date('2026-01-15').toISOString().split('T')[0];
  const projectEnd1 = new Date('2026-03-30').toISOString().split('T')[0];
  const projectEnd2 = new Date('2026-04-15').toISOString().split('T')[0];

  insertProject.run(
    'E-commerce Platform Redesign',
    'TechCorp Inc.',
    'active',
    projectStart,
    projectEnd1,
    'Complete redesign of the e-commerce platform with modern UI/UX and improved performance'
  );

  insertProject.run(
    'Mobile App Development',
    'StartupXYZ',
    'active',
    projectStart,
    projectEnd2,
    'Native mobile app for iOS and Android with offline capabilities'
  );

  console.log('✅ Created 2 sample projects');

  // Create milestones for Project 1
  const insertMilestone = db.prepare(`
    INSERT INTO milestones (projectId, title, dueDate, status, details, orderIndex)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertMilestone.run(1, 'Discovery & Research', '2026-02-01', 'done', 'User research, competitor analysis, requirements gathering', 0);
  insertMilestone.run(1, 'Design Phase', '2026-02-20', 'in_progress', 'Wireframes, mockups, design system', 1);
  insertMilestone.run(1, 'Frontend Development', '2026-03-15', 'not_started', 'Implement new UI components and pages', 2);
  insertMilestone.run(1, 'Backend Integration', '2026-03-25', 'not_started', 'API integration and data migration', 3);
  insertMilestone.run(1, 'Testing & Launch', '2026-03-30', 'not_started', 'QA testing, bug fixes, deployment', 4);

  // Create milestones for Project 2
  insertMilestone.run(2, 'Requirements & Planning', '2026-02-10', 'done', 'Define features, technical architecture', 0);
  insertMilestone.run(2, 'UI/UX Design', '2026-02-25', 'in_progress', 'Mobile app design for iOS and Android', 1);
  insertMilestone.run(2, 'Development Sprint 1', '2026-03-15', 'not_started', 'Core features implementation', 2);
  insertMilestone.run(2, 'Development Sprint 2', '2026-04-01', 'not_started', 'Advanced features and offline mode', 3);
  insertMilestone.run(2, 'Beta Testing', '2026-04-15', 'not_started', 'Internal testing and bug fixes', 4);

  console.log('✅ Created 10 milestones across 2 projects');

  // Create checklist items for some milestones
  const insertChecklistItem = db.prepare(`
    INSERT INTO milestone_checklist_items (milestoneId, text, isDone, orderIndex)
    VALUES (?, ?, ?, ?)
  `);

  // Milestone 1 (Discovery - done)
  insertChecklistItem.run(1, 'Conduct user interviews', 1, 0);
  insertChecklistItem.run(1, 'Analyze competitor websites', 1, 1);
  insertChecklistItem.run(1, 'Create requirements document', 1, 2);

  // Milestone 2 (Design - in progress)
  insertChecklistItem.run(2, 'Create wireframes', 1, 0);
  insertChecklistItem.run(2, 'Design homepage mockup', 1, 1);
  insertChecklistItem.run(2, 'Design product pages', 0, 2);
  insertChecklistItem.run(2, 'Build design system', 0, 3);
  insertChecklistItem.run(2, 'Get client approval', 0, 4);

  console.log('✅ Created checklist items for milestones');

  // Create project logs
  const insertLog = db.prepare(`
    INSERT INTO project_logs (projectId, type, message, createdBy)
    VALUES (?, ?, ?, ?)
  `);

  insertLog.run(1, 'done', 'Completed user research with 15 participants', 1);
  insertLog.run(1, 'done', 'Finalized design system and color palette', 1);
  insertLog.run(1, 'not_done', 'Product page designs pending client feedback', 1);
  insertLog.run(1, 'blocker', 'Waiting for API documentation from backend team', 1);

  insertLog.run(2, 'done', 'Technical architecture approved by CTO', 1);
  insertLog.run(2, 'not_done', 'iOS design needs revision based on Apple guidelines', 1);

  console.log('✅ Created project logs');

  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📝 Login credentials:');
  console.log('   Admin: admin@taskmanager.com / admin123');
  console.log('   Member: abdul@taskmanager.com / member123');
  console.log('   Member: ali@taskmanager.com / member123');
  console.log('   Member: sarah@taskmanager.com / member123\n');
}

seedDatabase().catch(console.error);
