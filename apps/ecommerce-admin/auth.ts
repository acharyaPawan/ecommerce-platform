import { createAuthClient } from "better-auth/client"
import { inferAdditionalFields, jwtClient } from "better-auth/client/plugins"
import { customSessionClient } from "better-auth/client/plugins"
import { env } from "./env/server"

export const authClient = createAuthClient({
    baseURL: env.BETTER_AUTH_URL,
	plugins: [
		jwtClient(),
        inferAdditionalFields({
			user: {
				roles: {
					type: "string[]" // Based on your extractUserRoles function
				}
			}
		})
	]
})