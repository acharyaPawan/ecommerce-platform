import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

const transport = isProduction
  ? undefined
  : {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    };

const logger = pino(transport ? { transport } : {});

export default logger;
