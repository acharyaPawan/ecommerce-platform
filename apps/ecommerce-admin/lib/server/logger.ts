import "server-only";
import { createLogger } from "@ecommerce/core";

const logger = createLogger({ service: "ecommerce-admin" });

export default logger;
