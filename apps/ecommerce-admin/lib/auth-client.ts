import { createAuthClient } from "better-auth/react"
import { inferAdditionalFields, jwtClient } from "better-auth/client/plugins"
import { customSessionClient } from "better-auth/client/plugins"
import { env } from "@/env/client"

export const authClient = createAuthClient({
    baseURL: env.NEXT_PUBLIC_APP_URL,
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
