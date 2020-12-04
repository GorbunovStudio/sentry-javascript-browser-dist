import { BaseBackend } from '@sentry/core';
import { Event, EventHint, Options, Severity, Transport } from '@sentry/types';
import { SyncPromise } from '@sentry/utils';
/**
 * Configuration options for the Sentry Browser SDK.
 * @see BrowserClient for more information.
 */
export interface BrowserOptions extends Options {
    /**
     * A pattern for error URLs which should not be sent to Sentry.
     * To whitelist certain errors instead, use {@link Options.whitelistUrls}.
     * By default, all errors will be sent.
     */
    blacklistUrls?: Array<string | RegExp>;
    /**
     * A pattern for error URLs which should exclusively be sent to Sentry.
     * This is the opposite of {@link Options.blacklistUrls}.
     * By default, all errors will be sent.
     */
    whitelistUrls?: Array<string | RegExp>;
}
/**
 * The Sentry Browser SDK Backend.
 * @hidden
 */
export declare class BrowserBackend extends BaseBackend<BrowserOptions> {
    /**
     * @inheritDoc
     */
    protected _setupTransport(): Transport;
    /**
     * @inheritDoc
     */
    eventFromException(exception: any, hint?: EventHint): SyncPromise<Event>;
    /**
     * This is an internal helper function that creates an event.
     */
    private _buildEvent;
    /**
     * @inheritDoc
     */
    eventFromMessage(message: string, level?: Severity, hint?: EventHint): SyncPromise<Event>;
}
//# sourceMappingURL=backend.d.ts.map