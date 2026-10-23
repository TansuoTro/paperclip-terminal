import { PROJECTS, PROJECTS_BY_ID, payProject, projectCostMet } from '../content/projects';
import { pushLog, type GameState, type ProjectId } from '../state';

export const MAX_VISIBLE_PROJECTS = 6;

/** Latch newly-triggered projects into the available set. Never un-triggers. */
export function research(s: GameState): void {
  for (const p of PROJECTS) {
    if (s.projectsDone.has(p.id) || s.projectsAvailable.has(p.id)) continue;
    if (s.act >= p.act && p.trigger(s)) s.projectsAvailable.add(p.id);
  }
}

/** Available projects, cheapest-first, capped to avoid choice paralysis. */
export function visibleProjects(s: GameState): ProjectId[] {
  return [...s.projectsAvailable]
    .map((id) => PROJECTS_BY_ID.get(id)!)
    .filter(Boolean)
    .sort((a, b) => {
      const affordable = Number(projectCostMet(s, b)) - Number(projectCostMet(s, a));
      if (affordable) return affordable;
      const ca = Object.values(a.cost)[0] ?? 0;
      const cb = Object.values(b.cost)[0] ?? 0;
      return a.act - b.act || ca - cb;
    })
    .slice(0, MAX_VISIBLE_PROJECTS)
    .map((p) => p.id);
}

export function canBuyProject(s: GameState, id: ProjectId): boolean {
  const p = PROJECTS_BY_ID.get(id);
  if (!p || !s.projectsAvailable.has(id)) return false;
  return projectCostMet(s, p);
}

export function buyProject(s: GameState, id: ProjectId): boolean {
  const p = PROJECTS_BY_ID.get(id);
  if (!p || !canBuyProject(s, id)) return false;
  payProject(s, p);
  s.projectsAvailable.delete(id);
  s.projectsDone.add(id);
  pushLog(s, 'project', {
    en: `PROJECT COMPLETE — ${p.name.en}`,
    zh: `项目完成 — ${p.name.zh}`,
  });
  p.effect(s);
  return true;
}
