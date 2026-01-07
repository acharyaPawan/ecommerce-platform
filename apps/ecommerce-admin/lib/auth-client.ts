import { createAuthClient } from "better-auth/client"
import { inferAdditionalFields, jwtClient } from "better-auth/client/plugins"
import { customSessionClient } from "better-auth/client/plugins"
import { env } from "@/env/client"

export const authClient = createAuthClient({
    baseURL: env.NEXT_PUBLIC_BETTER_AUTH_URL,
	plugins: [
		jwtClient(),
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