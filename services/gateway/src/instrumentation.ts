import "dotenv/config";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

process.env.OTEL_SERVICE_NAME ??= "gateway";

const otlpLogsUrl =
  process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT ?? "http://localhost:4318/v1/logs";

const sdk = new NodeSDK({
  instrumentations: [getNodeAutoInstrumentations()],
  logRecordProcessor: new SimpleLogRecordProcessor(
    new OTLPLogExporter({ url: otlpLogsUrl })
  ),
});

await sdk.start();

const shutdown = async () => {
  await sdk.shutdown();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
