-- Галерията с проекти става витрина: демо/ремикс линкове, свободни етикети и
-- „проект на седмицата“.
ALTER TABLE projects ADD COLUMN remix_url TEXT;
-- Свободни етикети, разделени със запетая ("SEO,Производителност,Достъпност").
ALTER TABLE projects ADD COLUMN tags TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_projects_featured ON projects(featured);

UPDATE projects SET
  featured = 1,
  tags = 'SEO,Производителност,Достъпност',
  tagline = 'Безплатен анализ на SEO, производителност, достъпност, сигурност и AI видимост.'
WHERE url = 'https://free-website-analyzer.lovable.app';
