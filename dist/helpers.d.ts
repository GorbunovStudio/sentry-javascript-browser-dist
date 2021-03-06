import { Mechanism, WrappedFunction } from '@sentry/types';
/**
 * @hidden
 */
export declare function shouldIgnoreOnError(): boolean;
/**
 * @hidden
 */
export declare function ignoreNextOnError(): void;
/**
 * Instruments the given function and sends an event to Sentry every time the
 * function throws an exception.
 *
 * @param fn A function to wrap.
 * @returns The wrapped function.
 * @hidden
 */
export declare function wrap(fn: WrappedFunction, options?: {
    mechanism?: Mechanism;
    capture?: boolean;
}, before?: WrappedFunction): any;
/**
 * Wraps addEventListener to capture UI breadcrumbs
 * @param eventName the event name (e.g. "click")
 * @returns wrapped breadcrumb events handler
 * @hidden
 */
export declare function breadcrumbEventHandler(eventName: string, debounce?: boolean): (event: Event) => void;
/**
 * Wraps addEventListener to capture keypress UI events
 * @returns wrapped keypress events handler
 * @hidden
 */
export declare function keypressEventHandler(): (event: Event) => void;
//# sourceMappingURL=helpers.d.ts.map