import * as tslib_1 from "tslib";
import { API, getCurrentHub } from '@sentry/core';
import { Severity } from '@sentry/types';
import { fill, getEventDescription, getGlobalObject, isString, logger, normalize, parseUrl, safeJoin, supportsHistory, supportsNativeFetch, } from '@sentry/utils';
import { breadcrumbEventHandler, keypressEventHandler, wrap } from '../helpers';
var global = getGlobalObject();
var lastHref;
/** Default Breadcrumbs instrumentations */
var Breadcrumbs = /** @class */ (function () {
    /**
     * @inheritDoc
     */
    function Breadcrumbs(options) {
        /**
         * @inheritDoc
         */
        this.name = Breadcrumbs.id;
        this._options = tslib_1.__assign({ console: true, dom: true, fetch: true, history: true, sentry: true, xhr: true }, options);
    }
    /** JSDoc */
    Breadcrumbs.prototype._instrumentConsole = function () {
        if (!('console' in global)) {
            return;
        }
        ['debug', 'info', 'warn', 'error', 'log', 'assert'].forEach(function (level) {
            if (!(level in global.console)) {
                return;
            }
            fill(global.console, level, function (originalConsoleLevel) {
                return function () {
                    var args = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        args[_i] = arguments[_i];
                    }
                    var breadcrumbData = {
                        category: 'console',
                        data: {
                            extra: {
                                arguments: normalize(args, 3),
                            },
                            logger: 'console',
                        },
                        level: Severity.fromString(level),
                        message: safeJoin(args, ' '),
                    };
                    if (level === 'assert') {
                        if (args[0] === false) {
                            breadcrumbData.message = "Assertion failed: " + (safeJoin(args.slice(1), ' ') || 'console.assert');
                            breadcrumbData.data.extra.arguments = normalize(args.slice(1), 3);
                        }
                    }
                    Breadcrumbs.addBreadcrumb(breadcrumbData, {
                        input: args,
                        level: level,
                    });
                    // this fails for some browsers. :(
                    if (originalConsoleLevel) {
                        Function.prototype.apply.call(originalConsoleLevel, global.console, args);
                    }
                };
            });
        });
    };
    /** JSDoc */
    Breadcrumbs.prototype._instrumentDOM = function () {
        if (!('document' in global)) {
            return;
        }
        // Capture breadcrumbs from any click that is unhandled / bubbled up all the way
        // to the document. Do this before we instrument addEventListener.
        global.document.addEventListener('click', breadcrumbEventHandler('click'), false);
        global.document.addEventListener('keypress', keypressEventHandler(), false);
        // After hooking into document bubbled up click and keypresses events, we also hook into user handled click & keypresses.
        ['EventTarget', 'Node'].forEach(function (target) {
            var proto = global[target] && global[target].prototype;
            if (!proto || !proto.hasOwnProperty || !proto.hasOwnProperty('addEventListener')) {
                return;
            }
            fill(proto, 'addEventListener', function (original) {
                return function (eventName, fn, options) {
                    if (fn && fn.handleEvent) {
                        if (eventName === 'click') {
                            fill(fn, 'handleEvent', function (innerOriginal) {
                                return function (event) {
                                    breadcrumbEventHandler('click')(event);
                                    return innerOriginal.call(this, event);
                                };
                            });
                        }
                        if (eventName === 'keypress') {
                            fill(fn, 'handleEvent', function (innerOriginal) {
                                return function (event) {
                                    keypressEventHandler()(event);
                                    return innerOriginal.call(this, event);
                                };
                            });
                        }
                    }
                    else {
                        if (eventName === 'click') {
                            breadcrumbEventHandler('click', true)(this);
                        }
                        if (eventName === 'keypress') {
                            keypressEventHandler()(this);
                        }
                    }
                    return original.call(this, eventName, fn, options);
                };
            });
            fill(proto, 'removeEventListener', function (original) {
                return function (eventName, fn, options) {
                    var callback = fn;
                    try {
                        callback = callback && (callback.__sentry_wrapped__ || callback);
                    }
                    catch (e) {
                        // ignore, accessing __sentry_wrapped__ will throw in some Selenium environments
                    }
                    return original.call(this, eventName, callback, options);
                };
            });
        });
    };
    /** JSDoc */
    Breadcrumbs.prototype._instrumentFetch = function () {
        if (!supportsNativeFetch()) {
            return;
        }
        fill(global, 'fetch', function (originalFetch) {
            return function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                var fetchInput = args[0];
                var method = 'GET';
                var url;
                if (typeof fetchInput === 'string') {
                    url = fetchInput;
                }
                else if ('Request' in global && fetchInput instanceof Request) {
                    url = fetchInput.url;
                    if (fetchInput.method) {
                        method = fetchInput.method;
                    }
                }
                else {
                    url = String(fetchInput);
                }
                if (args[1] && args[1].method) {
                    method = args[1].method;
                }
                var client = getCurrentHub().getClient();
                var dsn = client && client.getDsn();
                if (dsn) {
                    var filterUrl = new API(dsn).getStoreEndpoint();
                    // if Sentry key appears in URL, don't capture it as a request
                    // but rather as our own 'sentry' type breadcrumb
                    if (filterUrl && url.includes(filterUrl)) {
                        if (method === 'POST' && args[1] && args[1].body) {
                            addSentryBreadcrumb(args[1].body);
                        }
                        return originalFetch.apply(global, args);
                    }
                }
                var fetchData = {
                    method: isString(method) ? method.toUpperCase() : method,
                    url: url,
                };
                return originalFetch
                    .apply(global, args)
                    .then(function (response) {
                    fetchData.status_code = response.status;
                    Breadcrumbs.addBreadcrumb({
                        category: 'fetch',
                        data: fetchData,
                        type: 'http',
                    }, {
                        input: args,
                        response: response,
                    });
                    return response;
                })
                    .catch(function (error) {
                    Breadcrumbs.addBreadcrumb({
                        category: 'fetch',
                        data: fetchData,
                        level: Severity.Error,
                        type: 'http',
                    }, {
                        error: error,
                        input: args,
                    });
                    throw error;
                });
            };
        });
    };
    /** JSDoc */
    Breadcrumbs.prototype._instrumentHistory = function () {
        var _this = this;
        if (!supportsHistory()) {
            return;
        }
        var captureUrlChange = function (from, to) {
            var parsedLoc = parseUrl(global.location.href);
            var parsedTo = parseUrl(to);
            var parsedFrom = parseUrl(from);
            // Initial pushState doesn't provide `from` information
            if (!parsedFrom.path) {
                parsedFrom = parsedLoc;
            }
            // because onpopstate only tells you the "new" (to) value of location.href, and
            // not the previous (from) value, we need to track the value of the current URL
            // state ourselves
            lastHref = to;
            // Use only the path component of the URL if the URL matches the current
            // document (almost all the time when using pushState)
            if (parsedLoc.protocol === parsedTo.protocol && parsedLoc.host === parsedTo.host) {
                // tslint:disable-next-line:no-parameter-reassignment
                to = parsedTo.relative;
            }
            if (parsedLoc.protocol === parsedFrom.protocol && parsedLoc.host === parsedFrom.host) {
                // tslint:disable-next-line:no-parameter-reassignment
                from = parsedFrom.relative;
            }
            Breadcrumbs.addBreadcrumb({
                category: 'navigation',
                data: {
                    from: from,
                    to: to,
                },
            });
        };
        // record navigation (URL) changes
        var oldOnPopState = global.onpopstate;
        global.onpopstate = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            var currentHref = global.location.href;
            captureUrlChange(lastHref, currentHref);
            if (oldOnPopState) {
                return oldOnPopState.apply(_this, args);
            }
        };
        /**
         * @hidden
         */
        function historyReplacementFunction(originalHistoryFunction) {
            // note history.pushState.length is 0; intentionally not declaring
            // params to preserve 0 arity
            return function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                var url = args.length > 2 ? args[2] : undefined;
                // url argument is optional
                if (url) {
                    // coerce to string (this is what pushState does)
                    captureUrlChange(lastHref, String(url));
                }
                return originalHistoryFunction.apply(this, args);
            };
        }
        fill(global.history, 'pushState', historyReplacementFunction);
        fill(global.history, 'replaceState', historyReplacementFunction);
    };
    /** JSDoc */
    Breadcrumbs.prototype._instrumentXHR = function () {
        if (!('XMLHttpRequest' in global)) {
            return;
        }
        /**
         * @hidden
         */
        function wrapProp(prop, xhr) {
            // TODO: Fix XHR types
            if (prop in xhr && typeof xhr[prop] === 'function') {
                fill(xhr, prop, function (original) {
                    return wrap(original, {
                        mechanism: {
                            data: {
                                function: prop,
                                handler: (original && original.name) || '<anonymous>',
                            },
                            handled: true,
                            type: 'instrument',
                        },
                    });
                });
            }
        }
        var xhrproto = XMLHttpRequest.prototype;
        fill(xhrproto, 'open', function (originalOpen) {
            return function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                var url = args[1];
                this.__sentry_xhr__ = {
                    method: isString(args[0]) ? args[0].toUpperCase() : args[0],
                    url: args[1],
                };
                var client = getCurrentHub().getClient();
                var dsn = client && client.getDsn();
                if (dsn) {
                    var filterUrl = new API(dsn).getStoreEndpoint();
                    // if Sentry key appears in URL, don't capture it as a request
                    // but rather as our own 'sentry' type breadcrumb
                    if (isString(url) && (filterUrl && url.includes(filterUrl))) {
                        this.__sentry_own_request__ = true;
                    }
                }
                return originalOpen.apply(this, args);
            };
        });
        fill(xhrproto, 'send', function (originalSend) {
            return function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                var xhr = this; // tslint:disable-line:no-this-assignment
                if (xhr.__sentry_own_request__) {
                    addSentryBreadcrumb(args[0]);
                }
                /**
                 * @hidden
                 */
                function onreadystatechangeHandler() {
                    if (xhr.readyState === 4) {
                        if (xhr.__sentry_own_request__) {
                            return;
                        }
                        try {
                            // touching statusCode in some platforms throws
                            // an exception
                            if (xhr.__sentry_xhr__) {
                                xhr.__sentry_xhr__.status_code = xhr.status;
                            }
                        }
                        catch (e) {
                            /* do nothing */
                        }
                        Breadcrumbs.addBreadcrumb({
                            category: 'xhr',
                            data: xhr.__sentry_xhr__,
                            type: 'http',
                        }, {
                            xhr: xhr,
                        });
                    }
                }
                ['onload', 'onerror', 'onprogress'].forEach(function (prop) {
                    wrapProp(prop, xhr);
                });
                if ('onreadystatechange' in xhr && typeof xhr.onreadystatechange === 'function') {
                    fill(xhr, 'onreadystatechange', function (original) {
                        return wrap(original, {
                            mechanism: {
                                data: {
                                    function: 'onreadystatechange',
                                    handler: (original && original.name) || '<anonymous>',
                                },
                                handled: true,
                                type: 'instrument',
                            },
                        }, onreadystatechangeHandler);
                    });
                }
                else {
                    // if onreadystatechange wasn't actually set by the page on this xhr, we
                    // are free to set our own and capture the breadcrumb
                    xhr.onreadystatechange = onreadystatechangeHandler;
                }
                return originalSend.apply(this, args);
            };
        });
    };
    /**
     * Helper that checks if integration is enabled on the client.
     * @param breadcrumb Breadcrumb
     * @param hint BreadcrumbHint
     */
    Breadcrumbs.addBreadcrumb = function (breadcrumb, hint) {
        if (getCurrentHub().getIntegration(Breadcrumbs)) {
            getCurrentHub().addBreadcrumb(breadcrumb, hint);
        }
    };
    /**
     * Instrument browser built-ins w/ breadcrumb capturing
     *  - Console API
     *  - DOM API (click/typing)
     *  - XMLHttpRequest API
     *  - Fetch API
     *  - History API
     */
    Breadcrumbs.prototype.setupOnce = function () {
        if (this._options.console) {
            this._instrumentConsole();
        }
        if (this._options.dom) {
            this._instrumentDOM();
        }
        if (this._options.xhr) {
            this._instrumentXHR();
        }
        if (this._options.fetch) {
            this._instrumentFetch();
        }
        if (this._options.history) {
            this._instrumentHistory();
        }
    };
    /**
     * @inheritDoc
     */
    Breadcrumbs.id = 'Breadcrumbs';
    return Breadcrumbs;
}());
export { Breadcrumbs };
/** JSDoc */
function addSentryBreadcrumb(serializedData) {
    // There's always something that can go wrong with deserialization...
    try {
        var event_1 = JSON.parse(serializedData);
        Breadcrumbs.addBreadcrumb({
            category: 'sentry',
            event_id: event_1.event_id,
            level: event_1.level || Severity.fromString('error'),
            message: getEventDescription(event_1),
        }, {
            event: event_1,
        });
    }
    catch (_oO) {
        logger.error('Error while adding sentry type breadcrumb');
    }
}
//# sourceMappingURL=breadcrumbs.js.map