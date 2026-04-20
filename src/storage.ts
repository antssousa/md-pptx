// ─── Storage keys ────────────────────────────────────────────────────────────
export const PROJECTS_KEY        = 'md-pptx-projects'
export const PROJECT_KEY_PREFIX  = 'md-pptx-project-'
export const CURRENT_PROJECT_KEY = 'md-pptx-current-project'

// ─── Data model ──────────────────────────────────────────────────────────────

export interface ProjectMeta {
  id:         string
  name:       string
  themeId:    string
  slideCount: number
  modifiedAt: number
}

export interface Project extends ProjectMeta {
  markdown: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extracts a project name from the first h1 heading in markdown.
 * Returns null if no h1 found.
 */
export function extractProjectName(md: string): string | null {
  const match = md.match(/^#[ \t]+(.+)/m)
  if (!match) return null
  const name = match[1].trim()
  return name.length > 0 ? name : null
}

function nextUntitledName(projects: ProjectMeta[]): string {
  const nums = projects
    .map(p => { const m = p.name.match(/^Untitled Project (\d+)$/); return m ? parseInt(m[1], 10) : 0 })
    .filter(n => n > 0)
  const max = nums.length > 0 ? Math.max(...nums) : 0
  return `Untitled Project ${max + 1}`
}

function generateId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function listProjects(): ProjectMeta[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY)
    const list = raw ? (JSON.parse(raw) as ProjectMeta[]) : []
    return list.slice().sort((a, b) => b.modifiedAt - a.modifiedAt)
  } catch {
    return []
  }
}

export function saveProject(proj: Project): void {
  try {
    localStorage.setItem(`${PROJECT_KEY_PREFIX}${proj.id}`, proj.markdown)
  } catch { /* quota */ }

  try {
    const raw  = localStorage.getItem(PROJECTS_KEY)
    const list: ProjectMeta[] = raw ? JSON.parse(raw) : []
    const idx  = list.findIndex(p => p.id === proj.id)
    const meta: ProjectMeta = {
      id:         proj.id,
      name:       proj.name,
      themeId:    proj.themeId,
      slideCount: proj.slideCount,
      modifiedAt: proj.modifiedAt,
    }
    if (idx >= 0) list[idx] = meta
    else list.push(meta)
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(list))
  } catch { /* quota */ }
}

export function loadProjectContent(id: string): string | null {
  try {
    return localStorage.getItem(`${PROJECT_KEY_PREFIX}${id}`)
  } catch {
    return null
  }
}

export function deleteProject(id: string): void {
  try { localStorage.removeItem(`${PROJECT_KEY_PREFIX}${id}`) } catch { /* ignore */ }
  try {
    const raw  = localStorage.getItem(PROJECTS_KEY)
    const list: ProjectMeta[] = raw ? JSON.parse(raw) : []
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(list.filter(p => p.id !== id)))
  } catch { /* ignore */ }
}

export function createProject(md: string, themeId: string): Project {
  const existing = listProjects()
  const proj: Project = {
    id:         generateId(),
    name:       extractProjectName(md) ?? nextUntitledName(existing),
    themeId,
    slideCount: 0,
    modifiedAt: Date.now(),
    markdown:   md,
  }
  saveProject(proj)
  return proj
}

export function updateProjectMeta(id: string, partial: Partial<ProjectMeta>): void {
  try {
    const raw  = localStorage.getItem(PROJECTS_KEY)
    const list: ProjectMeta[] = raw ? JSON.parse(raw) : []
    const idx  = list.findIndex(p => p.id === id)
    if (idx < 0) return
    Object.assign(list[idx], partial)
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(list))
  } catch { /* quota */ }
}

export function setCurrentProjectId(id: string): void {
  try { localStorage.setItem(CURRENT_PROJECT_KEY, id) } catch { /* quota */ }
}

export function getCurrentProjectId(): string | null {
  try { return localStorage.getItem(CURRENT_PROJECT_KEY) } catch { return null }
}
