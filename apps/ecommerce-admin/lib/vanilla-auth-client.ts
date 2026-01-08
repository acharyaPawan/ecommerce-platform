import { env } from "@/env/client"
import { createAuthClient } from "better-auth/client"
import { inferAdditionalFields } from "better-auth/client/plugins"
export const authClient = createAuthClient({
    /** The base URL of the server (optional if you're using the same domain) */
    baseURL: env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001',
    plugins: [
        // jwtClient(),
        inferAdditionalFields({
            user: {
                roles: {
                    'input': false,
                    'required': true,
                    type: "string[]" // Based on your extractUserRoles function
                }
            }
        }),
    ],
})