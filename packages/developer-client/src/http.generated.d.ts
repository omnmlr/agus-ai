export interface paths {
    "/api/v1/assignments/{assignmentId}/receipt": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Download the scoped native receipt and key */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    assignmentId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            receipt: {
                                [key: string]: unknown;
                            };
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/assignments/{assignmentId}/reviews": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Review an exact submission or record disclosed partial credit */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    assignmentId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** Format: uuid */
                        attemptId: string;
                        /** @enum {string} */
                        decision: "accept" | "revise" | "reject" | "partial";
                        reason: string;
                        version: number;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            assignment: components["schemas"]["Assignment"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/assignments/{assignmentId}/submissions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Submit redacted structured evidence after cleanup */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    assignmentId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        actual: string;
                        /** Format: uuid */
                        attemptId: string;
                        /** @enum {string} */
                        category: "bug" | "usability" | "validation" | "agent_correction";
                        correction?: {
                            [key: string]: unknown;
                        };
                        expected: string;
                        expectedVersion: number;
                        /** @enum {string} */
                        result: "passed" | "failed" | "blocked";
                        steps: string[];
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            assignment: components["schemas"]["Assignment"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/email/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Request a single-use email sign-in code */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        email: string;
                        registrationToken?: string;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            accepted: boolean;
                            retryAfterSeconds: number;
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/email/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Exchange a delivered code for a session */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        code: string;
                        email: string;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Session"];
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/google/callback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Complete OAuth and redirect with an exchange code */
        get: {
            parameters: {
                query?: {
                    code?: string;
                    error?: string;
                    state?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Redirect to configured frontend */
                303: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/google/exchange": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Exchange OAuth code bound to the originating client */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        code: string;
                        verifier: string;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Session"];
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/google/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Request a browser OAuth flow */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        challenge: string;
                        registrationToken?: string;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            url: string;
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create a developer session */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** Format: email */
                        email: string;
                        password: string;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Session"];
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Revoke the current session */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            ok: boolean;
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read the current profile and capabilities */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            user: components["schemas"]["User"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Update the current profile */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        displayName: string;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            user: components["schemas"]["User"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Rotate the current bearer session */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Session"];
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/register": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Register a password account */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** Format: email */
                        email: string;
                        password: string;
                        registrationToken?: string;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Session"];
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/builds": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List owned APK builds */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            builds: components["schemas"]["Build"][];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        /** Upload a hashed APK */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        apkBase64: string;
                        name: string;
                        packageName?: string;
                        /** Format: uuid */
                        projectId: string;
                        sha256: string;
                    };
                };
            };
            responses: {
                /** @description Success */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            build: components["schemas"]["Build"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/campaigns": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List owned campaigns in the local preview */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            campaigns: components["schemas"]["Campaign"][];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        /** Create an immutable first draft revision */
        post: {
            parameters: {
                query?: never;
                header?: {
                    "Idempotency-Key"?: string;
                };
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CampaignDraft"];
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            campaign: components["schemas"]["Campaign"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/campaigns/{campaignId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read a campaign and its immutable revisions */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    campaignId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            campaign: components["schemas"]["Campaign"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Revise an owned draft */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    campaignId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        draft: components["schemas"]["CampaignDraft"];
                        expectedRevision: number;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            campaign: components["schemas"]["Campaign"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/campaigns/{campaignId}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Transition an owned campaign */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    campaignId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedRevision: number;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            campaign: components["schemas"]["Campaign"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/campaigns/{campaignId}/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Transition an owned campaign */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    campaignId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedRevision: number;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            campaign: components["schemas"]["Campaign"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/campaigns/{campaignId}/exports": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Prepare accepted evidence after both training grants */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    campaignId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        assignmentIds: string[];
                        /** @enum {string} */
                        purpose: "training";
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            export: {
                                [key: string]: unknown;
                            };
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/campaigns/{campaignId}/exports/{exportId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Deliver redacted data with current consent */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    campaignId: string;
                    exportId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            export: {
                                [key: string]: unknown;
                            };
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/campaigns/{campaignId}/launch": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Transition an owned campaign */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    campaignId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedRevision: number;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            campaign: components["schemas"]["Campaign"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/campaigns/{campaignId}/pause": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Transition an owned campaign */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    campaignId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedRevision: number;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            campaign: components["schemas"]["Campaign"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/campaigns/{campaignId}/report": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read qualified coverage, review and findings */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    campaignId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            report: components["schemas"]["CampaignReport"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/campaigns/{campaignId}/resume": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Transition an owned campaign */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    campaignId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedRevision: number;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            campaign: components["schemas"]["Campaign"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/devices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Discover visible devices */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            devices: components["schemas"]["Device"][];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/invitations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List private invitations involving the authenticated person */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            invitations: components["schemas"]["Invitation"][];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        /** Create a target-bound private invitation */
        post: {
            parameters: {
                query?: never;
                header?: {
                    "Idempotency-Key"?: string;
                };
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["NewInvitation"];
                };
            };
            responses: {
                /** @description Success */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            invitation: components["schemas"]["Invitation"];
                            token: string;
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/invitations/{invitationId}/accept": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Accept reviewed, unpaid private work */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    invitationId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** Format: uuid */
                        buildId?: string;
                        expectedTransaction?: components["schemas"]["TransactionExpectation"];
                        /** Format: uuid */
                        projectId?: string;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            invitation: components["schemas"]["Invitation"];
                            run: components["schemas"]["Run"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/invitations/{invitationId}/decline": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Decline private work */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    invitationId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            invitation: components["schemas"]["Invitation"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/invitations/{invitationId}/review": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Review a private request from the inbox */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    invitationId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            invitation: components["schemas"]["Invitation"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/invitations/{invitationId}/revoke": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Revoke a private authorization */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    invitationId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            invitation: components["schemas"]["Invitation"];
                            run?: components["schemas"]["Run"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/invitations/review": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Review a private link as its targeted recipient */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        token: string;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            invitation: components["schemas"]["Invitation"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/marketplace/jobs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List workload offers for an eligible provider device */
        get: {
            parameters: {
                query: {
                    deviceId: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            jobs: components["schemas"]["MarketJob"][];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/marketplace/jobs/{runId}/accept": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Reserve matching unpaid marketplace work */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    runId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        deviceId: string;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            run: components["schemas"]["Run"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/marketplace/jobs/{runId}/decline": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Hide this queued offer for an owned device */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    runId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        deviceId: string;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            declined: boolean;
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/assignments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List assigned or eligible coverage slots */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            assignments: components["schemas"]["Assignment"][];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/assignments/{assignmentId}/accept": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Reserve a coverage slot after reviewing scope */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    assignmentId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @constant */
                        consent: true;
                        /** Format: uuid */
                        installationId: string;
                        termsDigest: string;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            assignment: components["schemas"]["Assignment"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/assignments/{assignmentId}/decline": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Decline a coverage slot */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    assignmentId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": Record<string, never>;
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            declined: boolean;
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/assignments/{assignmentId}/stop": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Request owner stop on the active attempt */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    assignmentId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": Record<string, never>;
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            assignment: components["schemas"]["Assignment"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/assignments/{assignmentId}/training-consent": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read separate training rights for the assignment */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    assignmentId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            contributorGrantedAt: number | null;
                            developerGrantedAt: number | null;
                            /** @enum {string} */
                            purpose: "training";
                            termsDigest: string;
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        /** Grant current training rights */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    assignmentId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @constant */
                        grant: true;
                        termsDigest: string;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            contributorGrantedAt: number | null;
                            developerGrantedAt: number | null;
                            /** @enum {string} */
                            purpose: "training";
                            termsDigest: string;
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        post?: never;
        /** Withdraw future training delivery rights */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    assignmentId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            contributorGrantedAt: number | null;
                            developerGrantedAt: number | null;
                            /** @enum {string} */
                            purpose: "training";
                            termsDigest: string;
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/campaign-earnings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read nontransferable preview obligations */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            earnings: {
                                [key: string]: unknown;
                            };
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/devices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List provider-owned device records */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            devices: components["schemas"]["OwnedDevice"][];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/devices/{deviceId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read a provider-owned device */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    deviceId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            device: components["schemas"]["OwnedDevice"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        /** Revoke device authorization */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    deviceId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            device: components["schemas"]["OwnedDevice"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** Update device availability preferences */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    deviceId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UpdateDevice"];
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            device: components["schemas"]["OwnedDevice"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/me/devices/{deviceId}/diagnostics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Inspect the latest device diagnostics */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    deviceId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            diagnostics: components["schemas"]["Diagnostic"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/devices/{deviceId}/payout-wallet": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read the verified payout wallet */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    deviceId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            payoutWallet: components["schemas"]["PayoutWallet"] | null;
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        /** Disconnect the payout wallet for future work */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    deviceId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            payoutWallet: components["schemas"]["PayoutWallet"] | null;
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/devices/{deviceId}/payout-wallet/challenge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create a domain-bound Devnet wallet challenge */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    deviceId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        wallet: string;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            challenge: {
                                [key: string]: unknown;
                            };
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/devices/{deviceId}/payout-wallet/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Verify ownership and store the future payout destination */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    deviceId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        challengeId: string;
                        signature: string;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            payoutWallet: components["schemas"]["PayoutWallet"] | null;
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/devices/pairings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Issue a one-time runner pairing code */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            pairing: {
                                code: string;
                                /** Format: date-time */
                                expiresAt: string;
                            };
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/earnings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read actual provider settlement aggregates */
        get: {
            parameters: {
                query: {
                    bucket?: "day" | "week" | "month";
                    deviceId: string;
                    from?: string;
                    to?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            earnings: {
                                [key: string]: unknown;
                            };
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/notifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read owner-filtered notifications */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            notifications: components["schemas"]["Notification"][];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/notifications/{notificationId}/read": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Mark a notification read */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    notificationId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            notification: components["schemas"]["Notification"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/notifications/preferences": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read in-app notification preferences */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            preferences: {
                                campaignUpdates: boolean;
                                completedRuns: boolean;
                            };
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Change optional in-app notification categories */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        campaignUpdates?: boolean;
                        completedRuns?: boolean;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            preferences: {
                                campaignUpdates: boolean;
                                completedRuns: boolean;
                            };
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/me/payout-wallet": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read the verified account payout wallet */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            payoutWallet: components["schemas"]["PayoutWallet"] | null;
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        /** Disconnect the account payout wallet */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            payoutWallet: components["schemas"]["PayoutWallet"] | null;
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/payout-wallet/challenge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create an account-scoped Devnet ownership challenge */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        wallet: string;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            challenge: {
                                [key: string]: unknown;
                            };
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/payout-wallet/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Verify exact account wallet ownership */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        challengeId: string;
                        signature: string;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            payoutWallet: components["schemas"]["PayoutWallet"] | null;
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/qualifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read exercises, current qualification and review history */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            [key: string]: unknown;
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/qualifications/{qualificationId}/appeal": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Submit a person-owned qualification appeal */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    qualificationId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        reason: string;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            [key: string]: unknown;
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/qualifications/{version}/submissions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Score the reviewed qualification exercise */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    version: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        actualCode: string;
                        evidenceNote: string;
                        expectedCode: string;
                        sequence: string[];
                        walletAnswer: string;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            [key: string]: unknown;
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/runtime-enrollments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create a single-use native enrollment challenge */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        appVersion: string;
                        policyVersion: string;
                        /** @enum {string} */
                        runtimeClass: "phone_human" | "phone_cooperative";
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            enrollment: {
                                [key: string]: unknown;
                            };
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/runtime-enrollments/{installationId}/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Verify native installation proof */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    installationId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        proof: components["schemas"]["NativeProof"];
                        publicKey: string;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            credential: string;
                            installation: components["schemas"]["Installation"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/runtime-installations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List owned native installations */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            installations: components["schemas"]["Installation"][];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/runtime-installations/{installationId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Revoke an owned native installation */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    installationId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            installation: components["schemas"]["Installation"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List sessions visible to the provider */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            runs: components["schemas"]["Run"][];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/sessions/{runId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read the provider session summary */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    runId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            run: components["schemas"]["Run"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/sessions/{runId}/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Poll the provider session event stream */
        get: {
            parameters: {
                query?: {
                    after?: number;
                };
                header?: never;
                path: {
                    runId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            events: components["schemas"]["Event"][];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/sessions/{runId}/stop": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Request stop on a provider-owned session */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    runId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            run: components["schemas"]["Run"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/projects": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List owned projects */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            projects: components["schemas"]["Project"][];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        /** Create a project */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        name: string;
                    };
                };
            };
            responses: {
                /** @description Success */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            project: components["schemas"]["Project"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List owned runs */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            runs: components["schemas"]["Run"][];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        /** Queue an authorized scenario */
        post: {
            parameters: {
                query?: never;
                header?: {
                    "Idempotency-Key"?: string;
                };
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateRun"];
                };
            };
            responses: {
                /** @description Success */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            run: components["schemas"]["Run"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runs/{runId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read owned run and report */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    runId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            run: components["schemas"]["Run"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runs/{runId}/actions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List bounded actions with observations */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    runId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            actions: components["schemas"]["Action"][];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        /** Submit one bounded test action */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    runId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        args?: {
                            ms?: number;
                            target?: string;
                        };
                        type: components["schemas"]["ActionType"];
                    };
                };
            };
            responses: {
                /** @description Success */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            action: components["schemas"]["Action"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runs/{runId}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Request stop and inspect acknowledgement */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    runId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            run: components["schemas"]["Run"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runs/{runId}/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Poll or stream ordered run events */
        get: {
            parameters: {
                query?: {
                    after?: number;
                };
                header?: {
                    "Last-Event-ID"?: number;
                };
                path: {
                    runId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            events: components["schemas"]["Event"][];
                        };
                        "text/event-stream": string;
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runs/{runId}/evidence/{sha256}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Download a tenant-owned evidence artifact */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    runId: string;
                    sha256: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Signed artifact bytes */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runs/{runId}/funding": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Verify a finalized Devnet funding signature */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    runId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        signature: string;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            payment: components["schemas"]["Payment"] | null;
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runs/{runId}/payment": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read Devnet payment and reconciliation */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    runId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            payment: components["schemas"]["Payment"] | null;
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runs/{runId}/quote": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create an immutable eligible Devnet quote */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    runId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        developerWallet?: string;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            payment: components["schemas"]["Payment"] | null;
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runs/{runId}/reconcile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Reconcile the same payout signature */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    runId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            payment: components["schemas"]["Payment"] | null;
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runs/{runId}/settle": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Settle a funded and eligible report */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    runId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            payment: components["schemas"]["Payment"] | null;
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runs/{runId}/training-consent": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read purpose-specific consent as a run participant */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    runId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            consent: {
                                developer: string | null;
                                provider: string | null;
                            };
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        /** Grant consent for training export */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    runId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            consent: {
                                developer: string | null;
                                provider: string | null;
                            };
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        post?: never;
        /** Withdraw consent for future training export */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    runId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            consent: {
                                developer: string | null;
                                provider: string | null;
                            };
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runs/{runId}/training-export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Export a minimized, consented training trajectory as the developer */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    runId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            actions: {
                                index: number;
                                offsetMs: number;
                                /** @enum {string} */
                                outcome: "completed" | "failed";
                                phase?: string;
                                /** @enum {string} */
                                selectedBy?: "gemini";
                                type: string;
                            }[];
                            /** @enum {string} */
                            format: "agus.training-trajectory.v1";
                            /** @enum {string} */
                            purpose: "training";
                            scenario: components["schemas"]["Scenario"];
                            source: {
                                manifestSha256: string;
                                planner: string;
                                receiptId: string;
                                trajectorySha256: string;
                            };
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runs/{runId}/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Recheck an unresolved chain result */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    runId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            run: components["schemas"]["Run"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runtime/installations/{installationId}/claim": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Exchange a reservation for a signed workload grant */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    installationId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** Format: uuid */
                        assignmentId: string;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            lease: {
                                credential: string;
                                expiresAt: number;
                                /** Format: uuid */
                                id: string;
                                manifest: components["schemas"]["NativeManifest"];
                                serverNow: number;
                            };
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runtime/installations/{installationId}/heartbeat": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Record a signed native policy observation */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    installationId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["NativeProof"];
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            installation: components["schemas"]["Installation"];
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runtime/leases/{leaseId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Renew and read native authority */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    leaseId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            lease: {
                                [key: string]: unknown;
                            };
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runtime/leases/{leaseId}/build": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Download the leased reviewed APK */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    leaseId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Reviewed pinned APK bytes */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runtime/leases/{leaseId}/cleanup": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Acknowledge actual profile cleanup */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    leaseId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["NativeProof"];
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            cleanup: {
                                [key: string]: unknown;
                            };
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/runtime/leases/{leaseId}/report": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Seal a native execution report */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    leaseId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["NativeProof"];
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            report: {
                                [key: string]: unknown;
                            };
                        };
                    };
                };
                /** @description Stable error envelope */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        Action: {
            args: {
                [key: string]: unknown;
            };
            /** Format: date-time */
            createdAt: string;
            /** Format: uuid */
            id: string;
            observation?: {
                [key: string]: unknown;
            };
            /** @enum {string} */
            state: "queued" | "completed" | "failed";
            type: components["schemas"]["ActionType"];
        };
        /** @enum {string} */
        ActionType: "launch" | "screenshot" | "describe" | "tap" | "back" | "wait" | "finish";
        Assignment: {
            attempt?: {
                [key: string]: unknown;
            };
            /** Format: uuid */
            campaignId: string;
            campaignRevision: number;
            compensation?: {
                [key: string]: unknown;
            };
            deadlineAt: number;
            eligibleInstallationIds?: string[];
            expiresAt: number;
            /** Format: uuid */
            id: string;
            referenceActions?: {
                [key: string]: unknown;
            }[];
            run?: components["schemas"]["Run"];
            slot: number;
            /** @enum {string} */
            state: "open" | "reserved" | "active" | "cleanup_pending" | "stopping" | "awaiting_submission" | "submitted" | "needs_revision" | "accepted" | "partially_accepted" | "rejected" | "cancelled" | "interrupted" | "expired" | "dedicated";
            task: {
                [key: string]: unknown;
            };
            terms: {
                [key: string]: unknown;
            };
            termsDigest: string;
        };
        Build: {
            /** Format: date-time */
            createdAt: string;
            /** Format: uuid */
            id: string;
            name: string;
            packageName: string | null;
            /** Format: uuid */
            projectId: string;
            sha256: string;
            size: number;
        };
        Campaign: {
            assignmentIds: string[];
            createdAt: number;
            /** Format: uuid */
            id: string;
            revision: number;
            revisions: components["schemas"]["CampaignRevision"][];
            /** @enum {string} */
            state: "draft" | "active" | "paused" | "cancelled" | "completed";
            updatedAt: number;
        };
        CampaignDraft: {
            budgetTestUnits?: number;
            contributorIds?: string[];
            deadlineAt: number;
            objective: string;
            /** Format: uuid */
            projectId: string;
            retentionDays?: number;
            tasks: components["schemas"]["CampaignTask"][];
            title: string;
            /** @enum {string} */
            visibility?: "qualified_preview" | "invited";
        };
        CampaignReport: {
            acceptedTestUnits: number;
            assignments: components["schemas"]["Assignment"][];
            campaign: components["schemas"]["Campaign"];
            cells: components["schemas"]["CoverageCell"][];
            findings: {
                [key: string]: unknown;
            }[];
            reservedTestUnits: number;
        };
        CampaignRevision: {
            budgetTestUnits: number;
            contributorIds: string[];
            deadlineAt: number;
            objective: string;
            /** Format: uuid */
            projectId: string;
            retentionDays: number;
            sha256: string;
            tasks: {
                [key: string]: unknown;
            }[];
            title: string;
            /** @enum {string} */
            visibility: "qualified_preview" | "invited";
        };
        CampaignTask: {
            abi?: string | null;
            actions?: ("describe" | "advance")[];
            /** Format: uuid */
            buildId: string;
            count: number;
            expectedTransaction?: components["schemas"]["TransactionExpectation"];
            instructions: string;
            /** @enum {string} */
            kind: "automated_test" | "human_test" | "agent_evaluation" | "human_demonstration" | "agent_correction";
            maximumDurationSeconds?: number;
            maximumNetworkLatencyMs?: number | null;
            minimumApi?: number;
            /** Format: uuid */
            referenceRunId?: string;
            /** @enum {string} */
            runtimeClass: "phone_human" | "phone_cooperative" | "dedicated_runner";
            scenario?: components["schemas"]["Scenario"];
            skill?: string | null;
            stopTestUnits?: number;
            testUnits?: number;
            title: string;
            trainingEligible?: boolean;
        };
        Constraints: {
            chargingRequired: boolean;
            wifiRequired: boolean;
        };
        CoverageCell: {
            accepted: number;
            attempted: number;
            blocked: number;
            failed: number;
            kind: string;
            measured: number;
            missing: number;
            passed: number;
            planned: number;
            /** @enum {string} */
            runtimeClass: "phone_human" | "phone_cooperative" | "dedicated_runner";
            taskIndex: number;
            unverified: number;
        };
        CreateRun: {
            /** @enum {string} */
            allocation?: "marketplace";
            /** Format: uuid */
            buildId: string;
            deviceId?: string | null;
            evidence?: components["schemas"]["EvidenceConsent"];
            expectedTransaction?: components["schemas"]["TransactionExpectation"];
            maximumDurationSeconds?: number;
            mode: components["schemas"]["Mode"];
            payment?: {
                developerWallet: string;
                /** @constant */
                kind: "devnet";
            };
            /** Format: uuid */
            projectId: string;
            scenario: components["schemas"]["Scenario"];
        };
        Device: {
            autoMatch: boolean;
            /** @enum {string} */
            connectivity: "online" | "offline";
            /** @constant */
            dedicated: true;
            id: string;
            label: string;
            /** Format: date-time */
            lastSeenAt: string;
            marketplaceEligible: boolean;
            profile: components["schemas"]["DeviceProfile"];
            publicListing: boolean;
            /** @enum {string} */
            readiness: "ready" | "busy" | "offline" | "quarantined";
            /** Format: date-time */
            revokedAt?: string;
            scenarios: components["schemas"]["Scenario"][];
            /** @enum {string} */
            state: "available" | "busy" | "offline";
        };
        DeviceProfile: {
            androidVersion?: string | null;
            apiLevel?: number | null;
            batteryHealth?: string | null;
            batteryPercent?: number | null;
            batteryTemperatureC?: number | null;
            charging?: boolean | null;
            dataAvailableBytes?: number | null;
            dataTotalBytes?: number | null;
            /** @constant */
            hardwareAttested: false;
            kind: string;
            manufacturer?: string | null;
            measuredAt?: string | null;
            memoryAvailableBytes?: number | null;
            memoryTotalBytes?: number | null;
            model?: string | null;
            networkLatencyMs?: number | null;
            networkProbedAt?: string | null;
            /** @enum {string} */
            provenance: "runner_observed" | "simulated_environment";
            /** @constant */
            seekerVerified: false;
            source?: string | null;
            thermalStatus?: string | null;
            throughputMbps?: number | null;
            walletNetwork?: ("devnet" | "localnet") | null;
            wifiConnected?: boolean | null;
        };
        Diagnostic: {
            /** Format: date-time */
            checkedAt: string;
            checks: {
                id: string;
                lastSeenAt?: string | null;
                measuredAt?: string | null;
                passed: boolean;
            }[];
            source: string;
        };
        Error: {
            error: {
                code: string;
                message: string;
            };
        };
        Event: {
            /** Format: date-time */
            at: string;
            data: {
                [key: string]: unknown;
            };
            id: number;
            type: string;
        };
        EvidenceConsent: {
            logs?: boolean;
            screenshots?: boolean;
            trajectory?: boolean;
        };
        /** @enum {string} */
        ExecutionState: "queued" | "reserved" | "running" | "stopping" | "verifying" | "completed" | "cancelled" | "expired";
        Installation: {
            activeLeaseId: string | null;
            credentialExpiresAt: number;
            /** Format: uuid */
            id: string;
            lastSeenAt: number | null;
            policy: {
                [key: string]: unknown;
            } | null;
            policyVersion: string;
            provenance: string;
            readiness: string;
            /** @enum {string} */
            runtimeClass: "phone_human" | "phone_cooperative" | "dedicated_runner";
            windowExpiresAt: number | null;
        };
        Invitation: {
            /** Format: date-time */
            acceptedAt?: string;
            buildSha256: string;
            consentVersion: string;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            declinedAt?: string;
            deviceId: string;
            evidence: components["schemas"]["EvidenceConsent"];
            /** Format: date-time */
            expiresAt: string;
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            kind: "developer_request" | "provider_share";
            maximumDurationSeconds: number;
            mode: components["schemas"]["Mode"];
            packageName: string;
            /** @enum {string} */
            payout: "unpaid";
            recipient: {
                displayName?: string;
                email: string;
                /** Format: uuid */
                id: string;
            };
            requester: {
                displayName?: string;
                email: string;
                /** Format: uuid */
                id: string;
            };
            /** Format: date-time */
            reviewedAt?: string;
            /** Format: date-time */
            revokedAt?: string;
            /** Format: uuid */
            runId?: string;
            scenario: components["schemas"]["Scenario"];
            /** @enum {string} */
            state: "pending" | "reviewed" | "accepted" | "declined" | "revoked" | "expired";
            /** @enum {string} */
            viewerRole: "requester" | "recipient";
        };
        /** @enum {string} */
        LeaseState: "unallocated" | "reserved" | "running" | "stopping" | "verifying" | "released" | "expired";
        MarketJob: {
            /** @constant */
            availability: "available";
            buildSha256: string;
            /** Format: date-time */
            createdAt: string;
            evidence: components["schemas"]["EvidenceConsent"];
            /** Format: date-time */
            expiresAt: string;
            /** Format: uuid */
            id: string;
            maximumDurationSeconds: number;
            mode: components["schemas"]["Mode"];
            packageName: string;
            quote: components["schemas"]["Payout"];
            requester: {
                displayName?: string;
                email: string;
                /** Format: uuid */
                id: string;
            };
            requirements: {
                /** @constant */
                dedicatedAndroid: true;
                scenario: components["schemas"]["Scenario"];
            };
            scenario: components["schemas"]["Scenario"];
        };
        /** @enum {string} */
        Mode: "scripted" | "agent";
        NativeManifest: {
            /** @enum {string} */
            alg: "ECDSA-P256-SHA256-DER";
            /** @enum {string} */
            encoding: "base64";
            keyId: string;
            payload: string;
            sha256: string;
            signature: string;
        };
        NativeProof: {
            payload: string;
            signature: string;
        };
        NewInvitation: {
            /** Format: uuid */
            buildId: string;
            deviceId: string;
            evidence?: components["schemas"]["EvidenceConsent"];
            expectedTransaction?: components["schemas"]["TransactionExpectation"];
            /** @constant */
            kind: "developer_request";
            maximumDurationSeconds?: number;
            mode: components["schemas"]["Mode"];
            /** Format: uuid */
            projectId: string;
            scenario: components["schemas"]["Scenario"];
        } | {
            buildSha256: string;
            deviceId: string;
            evidence?: components["schemas"]["EvidenceConsent"];
            /** @constant */
            kind: "provider_share";
            maximumDurationSeconds?: number;
            mode: components["schemas"]["Mode"];
            packageName: string;
            scenario: components["schemas"]["Scenario"];
            /** Format: uuid */
            targetUserId: string;
        };
        Notification: {
            /** Format: date-time */
            createdAt: string;
            data: {
                [key: string]: unknown;
            };
            /** Format: uuid */
            id: string;
            readAt: string | null;
            type: string;
        };
        OwnedDevice: components["schemas"]["Device"] & {
            constraints: components["schemas"]["Constraints"];
            schedule: components["schemas"]["Schedule"] | null;
        };
        Paid: {
            amountAtoms: string;
            /** @enum {string} */
            asset: "USDC";
            /** @enum {string} */
            cluster: "devnet";
            decimals: number;
            destination: string;
            /** @constant */
            kind: "devnet";
            mint: string;
        };
        Payment: {
            /** Format: date-time */
            acceptedAt?: string;
            eligibleReportId?: string;
            funding?: {
                [key: string]: unknown;
            };
            quote: components["schemas"]["Quote"];
            /** Format: uuid */
            runId: string;
            settlement?: {
                [key: string]: unknown;
            };
            state: string;
        };
        Payout: components["schemas"]["Unpaid"] | components["schemas"]["Paid"];
        PayoutWallet: {
            address: string;
            verifiedAt: string | null;
        };
        Project: {
            /** Format: date-time */
            createdAt: string;
            /** Format: uuid */
            id: string;
            name: string;
        };
        Quote: {
            amountAtoms: string;
            /** @enum {string} */
            asset: "USDC";
            /** @enum {string} */
            cluster: "devnet";
            decimals: number;
            deposit: {
                tokenAccount: string;
                wallet: string;
            };
            developerWallet: string;
            /** Format: date-time */
            expiresAt: string;
            funding: {
                /** @enum {string} */
                instruction: "transferChecked";
                memo: string;
                tokenAccount: string;
            };
            mint: string;
            providerWallet: string;
            /** Format: uuid */
            reference: string;
        };
        Run: {
            acceptedWork?: {
                /** Format: date-time */
                acceptedAt: string;
                /** @enum {string} */
                method?: "manual" | "auto";
                payout: components["schemas"]["Payout"];
                /** Format: uuid */
                providerId: string;
                /** @enum {string} */
                source: "marketplace" | "private";
            };
            /** @enum {string} */
            allocation: "private" | "marketplace" | "legacy";
            /** Format: uuid */
            buildId: string;
            consentVersion?: string;
            /** Format: date-time */
            createdAt: string;
            deviceId: string | null;
            /** @enum {string} */
            evaluationOutcome?: "passed" | "failed" | "unverified";
            evidence?: components["schemas"]["EvidenceConsent"];
            executionState?: components["schemas"]["ExecutionState"];
            expectedTransaction?: components["schemas"]["TransactionExpectation"] | null;
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            invitationId?: string;
            leaseState?: components["schemas"]["LeaseState"];
            maximumDurationSeconds?: number;
            mode: components["schemas"]["Mode"];
            paymentTerms?: {
                [key: string]: unknown;
            };
            /** Format: uuid */
            projectId: string;
            receipt?: {
                [key: string]: unknown;
            };
            /** @enum {string} */
            reportSeal?: "sealed";
            /** Format: date-time */
            reservationExpiresAt?: string;
            scenario: components["schemas"]["Scenario"];
            state: components["schemas"]["RunState"];
            stop?: {
                acknowledgedAt: string | null;
                /** Format: date-time */
                requestedAt: string;
                requesterRole: string;
            };
            /** Format: date-time */
            updatedAt: string;
            verification?: {
                [key: string]: unknown;
            };
        };
        /** @enum {string} */
        RunState: "queued" | "reserved" | "running" | "verifying" | "stopping" | "passed" | "failed" | "cancelled" | "expired" | "unverified";
        /** @enum {string} */
        Scenario: "app-launch" | "wallet-connect" | "wallet-transfer" | "wallet-false-success";
        Schedule: {
            timeZone: string;
            windows: {
                days: number[];
                end: string;
                start: string;
            }[];
        };
        Session: {
            /** Format: date-time */
            expiresAt: string;
            token: string;
            user: components["schemas"]["User"];
        };
        TransactionExpectation: {
            lamports: number;
            /** @enum {string} */
            network: "devnet" | "localnet";
            payer?: string;
            recipient: string;
        };
        Unpaid: {
            /** @constant */
            amountAtoms: "0";
            asset: null;
            cluster: null;
            decimals: null;
            /** @constant */
            kind: "unpaid";
        };
        UpdateDevice: {
            autoMatch?: boolean;
            constraints?: {
                chargingRequired?: boolean;
                wifiRequired?: boolean;
            };
            label?: string;
            publicListing?: boolean;
            schedule?: components["schemas"]["Schedule"] | null;
        };
        User: {
            capabilities: {
                /** @constant */
                developer: true;
                provider: boolean;
            };
            displayName?: string;
            email: string;
            /** Format: uuid */
            id: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
