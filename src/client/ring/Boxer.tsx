import { Pixels } from './Pixels';

// A robot boxer facing right. k outline, m metal, d shade, e visor, a antenna light,
// g glove and t trunks (both take the seat colour), w trunk stripe.
const BODY = [
  '......a.........',
  '......k.........',
  '....kkkkkk......',
  '...kmmmmmmk.....',
  '...kmmmmeek.....',
  '...kmmmmeek.....',
  '...kmmmmmmk.....',
  '....kkkkkk......',
  '...kkmmmmkk.....',
  '..kmmmmmmmmk....',
  '.kgggkmmmmmk....',
  'kgggggkmmmmk....',
  'kgggggkdmmmk....',
  '.kgggkdmmmmk....',
  '..kkkttttttk....',
  '...kttwwtttk....',
  '...kttttttk.....',
  '...kmmk.kmmk....',
  '...kmmk.kmmk....',
  '...kddk..kddk...',
  '..kkkkk..kkkkk..',
];

const GLOVE = ['.kkkk.', 'kggggk', 'kggggk', 'kggggk', '.kkkk.'];

export type BoxerState = 'idle' | 'windup' | 'punch' | 'hurt' | 'empty' | 'rest' | 'win' | 'ko';

export function Boxer({ seat, state }: { seat: number; state: BoxerState }) {
  return (
    <div className={`boxer boxer-${seat} is-${state}`}>
      <svg viewBox="0 0 26 21" shapeRendering="crispEdges" aria-hidden>
        <g className="sprite">
          <Pixels map={BODY} />
          <g className="arm">
            <rect className="px-k" x={10} y={9} width={2} height={4} />
            <rect className="px-m" x={10} y={10} width={2} height={2} />
          </g>
          <g className="fist">
            <Pixels map={GLOVE} x={11} y={8} />
          </g>
        </g>
      </svg>
      {state === 'empty' && <span className="insert">INSERT CLAUDE</span>}
    </div>
  );
}
