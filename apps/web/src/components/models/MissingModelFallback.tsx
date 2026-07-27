import type { JSX } from 'react';
import type { ModelType } from './types';
import './model-factory.css';

interface MissingModelFallbackProps {
  type: ModelType;
}

/**
 * MissingModelFallback — prod-friendly placeholder shown when
 * `ModelFactory` is asked to render a `type` that isn't registered.
 *
 * In dev this branch is unreachable (we throw instead). In prod it
 * keeps the page from going blank so the user sees a useful message
 * while ops fix the missing registration.
 */
export function MissingModelFallback({ type }: MissingModelFallbackProps): JSX.Element {
  return (
    <div className="model-missing" role="alert">
      <div className="model-missing__badge">!</div>
      <div className="model-missing__body">
        <strong>Model unavailable</strong>
        <p>
          The viewer for <code>{type}</code> is temporarily unavailable.
          Please try a different route.
        </p>
      </div>
    </div>
  );
}

export default MissingModelFallback;