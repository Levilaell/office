import type { AgentRole, AgentState, Department } from '@office/shared-types';
import type { Department as RoomDepartment } from './rooms';

// Forma interna usada por scene.ts pra renderizar um avatar. Recebe a sala
// já resolvida (department visual pode diferir do domínio — ex: `platform`
// → `recepcao`) e tilePos já calculado em coords da sala.
export type RenderAgent = {
  id: string;
  name: string;
  roomDepartment: RoomDepartment;
  domainDepartment: Department;
  role: AgentRole;
  state: AgentState;
  tilePos: { x: number; y: number };
};
