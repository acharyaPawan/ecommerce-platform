import "server-only";
import { createLogger } from "@ecommerce/core";

const logger = createLogger({ service: "ecommerce-frontend" });

export default logger;
