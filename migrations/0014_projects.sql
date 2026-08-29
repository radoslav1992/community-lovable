-- Публичен showcase на проекти, направени с Lovable: всеки член споделя линк
-- към живото си приложение, а общността гласува.
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- NULL за проекти, добавени от общността/seed или след изтрит акаунт.
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  tagline TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Друго',
  -- Показва се само когато няма свързан профил (user_id IS NULL).
  author_name TEXT NOT NULL DEFAULT '',
  base_votes INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_projects_created ON projects(created_at DESC);
CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_projects_category ON projects(category);

CREATE TABLE project_votes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, project_id)
);
CREATE INDEX idx_project_votes_project ON project_votes(project_id);

-- Първият споделен проект.
INSERT INTO projects (title, url, tagline, category, author_name) VALUES (
  'Free Website Analyzer',
  'https://free-website-analyzer.lovable.app',
  'Безплатен анализ на всеки сайт — проверява SEO, скорост и техническо състояние и връща конкретни препоръки за подобрение.',
  'Инструмент',
  'Общността'
);
