export interface paths {
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
        Constraints: {
            chargingRequired: boolean;
            wifiRequired: boolean;
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
