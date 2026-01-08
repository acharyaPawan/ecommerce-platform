// import { hc } from "hono/client";
// import type { AppType } from "../app"; // Your Hono app type

// const authUrl = process.env.BETTER_AUTH ?? 'http://localhost:3000';

// export const client = hc<AppType>(authUrl, {
//   init: {
//     credentials: "include", // Required for sending cookies cross-origin
//   },
// });

import { createAuthClient } from "better-auth/client"
import { jwtClient } from "better-auth/client/plugins"
import { customSessionClient } from "better-auth/client/plugins"
import type { auth } from "../auth" // Import your auth instance as a type

export const authClient = createAuthClient({
	plugins: [
		jwtClient(),
		customSessionClient < typeof auth > ()
	]
})