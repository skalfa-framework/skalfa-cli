export const workerCron = `import { cron, logger } from "@utils";
import "./index"



// ============================================>
// ## Run of cron job worker.
// ============================================>
cron.worker();
logger.start(\`Cron job workers is running!\`)
`;

export const cronIndex = `import { cron } from "@utils";



// ============================================>
// ## List of cron jobs.
// ============================================>
// eslint-disable-next-line no-console
cron.add("1 * * * *", () => console.log('example cron job...'), 'example');
`;
