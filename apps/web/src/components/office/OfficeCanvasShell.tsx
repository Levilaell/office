'use client';

import { OfficeCanvas } from './OfficeCanvas';
import { MOCK_AGENTS } from './agents-mock';

export function OfficeCanvasShell() {
  return (
    <OfficeCanvas
      agents={MOCK_AGENTS}
      onAgentClick={(id) => {
        // eslint-disable-next-line no-console
        console.log('[escritorio] agent clicked', id);
      }}
      onRoomClick={(dept) => {
        // eslint-disable-next-line no-console
        console.log('[escritorio] room clicked', dept);
      }}
    />
  );
}
