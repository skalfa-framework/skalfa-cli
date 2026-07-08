import path from "node:path";
import fs from "node:fs";
import {
  workerQueueBase,
  workerQueueWithDa,
  authQueueWorker,
  activityLogQueueWorker,
  accessLogQueueWorker,
  errorLogQueueWorker
} from "./jobs/queues";
import {
  workerCron,
  cronIndex
} from "./jobs/crons";
import {
  workerSocket
} from "./jobs/sockets";

interface StubOptions {
  target: string;
  authType: "username" | "email";
  queue: boolean;
  cron: boolean;
  socket: boolean;
  da: boolean;
  redis: boolean;
  cache: boolean;
}

export function applyStubs(opts: StubOptions): void {
  const target = opts.target;

  // 1. Write exports to utils/index.ts
  const utilsIndexPath = path.join(target, "utils", "index.ts");
  let exportsContent = `export * from "@skalfa/skalfa-api-core";\nexport * from "@skalfa/skalfa-orm";\n`;
  if (opts.redis) exportsContent += `export * from "@skalfa/skalfa-redis";\n`;
  if (opts.queue) exportsContent += `export * from "@skalfa/skalfa-queue";\n`;
  if (opts.cache) exportsContent += `export * from "@skalfa/skalfa-cache";\n`;
  if (opts.cron) exportsContent += `export * from "@skalfa/skalfa-cron";\n`;
  if (opts.da) exportsContent += `export * from "@skalfa/skalfa-da";\n`;
  if (opts.socket) exportsContent += `export * from "@skalfa/skalfa-socket";\n`;
  fs.writeFileSync(utilsIndexPath, exportsContent, "utf8");

  // 2. Apply Auth/User Stubs
  const controllersIamDir = path.join(target, "app", "controllers", "iam");
  const modelsIamDir = path.join(target, "app", "models", "iam");
  const routesDir = path.join(target, "app", "routes");
  const migrationsDir = path.join(target, "database", "migrations", "0000_00");
  const seedersDir = path.join(target, "database", "seeders");

  // Ensure directories exist
  fs.mkdirSync(controllersIamDir, { recursive: true });
  fs.mkdirSync(modelsIamDir, { recursive: true });
  fs.mkdirSync(routesDir, { recursive: true });
  fs.mkdirSync(migrationsDir, { recursive: true });
  fs.mkdirSync(seedersDir, { recursive: true });

  if (opts.authType === "email") {
    const stubsDir = path.join(__dirname, "auth-email");

    const authControllerContent = fs.readFileSync(path.join(stubsDir, "controller", "auth.controller.stub"), "utf8");
    const userControllerContent = fs.readFileSync(path.join(stubsDir, "controller", "user.controller.stub"), "utf8");
    const userModelContent = fs.readFileSync(path.join(stubsDir, "models", "user.model.stub"), "utf8");
    const baseRoutesContent = fs.readFileSync(path.join(stubsDir, "routes", "base.routes.stub"), "utf8");
    const usersMigrationContent = fs.readFileSync(path.join(stubsDir, "migrations", "users.stub"), "utf8");
    const userSeederContent = fs.readFileSync(path.join(stubsDir, "seeders", "user.seeder.stub"), "utf8");

    fs.writeFileSync(path.join(controllersIamDir, "auth.controller.ts"), authControllerContent, "utf8");
    fs.writeFileSync(path.join(controllersIamDir, "user.controller.ts"), userControllerContent, "utf8");
    fs.writeFileSync(path.join(modelsIamDir, "user.model.ts"), userModelContent, "utf8");
    fs.writeFileSync(path.join(routesDir, "base.routes.ts"), baseRoutesContent, "utf8");
    fs.writeFileSync(path.join(migrationsDir, "users.ts"), usersMigrationContent, "utf8");
    fs.writeFileSync(path.join(seedersDir, "user.seeder.ts"), userSeederContent, "utf8");
  } else {
    // If username auth, we do not need to overwrite any template files (since they are already username auth).
    // However, we clean up the mails directory if it exists, since mail tokens are not used in username auth.
    const mailsDir = path.join(target, "app", "outputs", "mails");
    if (fs.existsSync(mailsDir)) {
      fs.rmSync(mailsDir, { recursive: true, force: true });
    }
  }

  // 3. Apply Jobs Stubs
  const jobsDir = path.join(target, "app", "jobs");

  // Queue
  const queuesDir = path.join(jobsDir, "queues");
  if (opts.queue) {
    fs.mkdirSync(queuesDir, { recursive: true });
    fs.writeFileSync(
      path.join(queuesDir, "worker.queue.ts"),
      opts.da ? workerQueueWithDa : workerQueueBase,
      "utf8"
    );
    fs.writeFileSync(path.join(queuesDir, "auth.queue.worker.ts"), authQueueWorker, "utf8");

    if (opts.da) {
      fs.writeFileSync(path.join(queuesDir, "activity-log.queue.worker.ts"), activityLogQueueWorker, "utf8");
      fs.writeFileSync(path.join(queuesDir, "access-log.queue.worker.ts"), accessLogQueueWorker, "utf8");
      fs.writeFileSync(path.join(queuesDir, "error-log.queue.worker.ts"), errorLogQueueWorker, "utf8");
    } else {
      // Remove DA queue worker files if they exist
      const daFiles = ["activity-log.queue.worker.ts", "access-log.queue.worker.ts", "error-log.queue.worker.ts"];
      for (const file of daFiles) {
        const filePath = path.join(queuesDir, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }
  } else {
    if (fs.existsSync(queuesDir)) {
      fs.rmSync(queuesDir, { recursive: true, force: true });
    }
  }

  // Cron
  const cronsDir = path.join(jobsDir, "crons");
  if (opts.cron) {
    fs.mkdirSync(cronsDir, { recursive: true });
    fs.writeFileSync(path.join(cronsDir, "worker.cron.ts"), workerCron, "utf8");
    fs.writeFileSync(path.join(cronsDir, "index.ts"), cronIndex, "utf8");
  } else {
    if (fs.existsSync(cronsDir)) {
      fs.rmSync(cronsDir, { recursive: true, force: true });
    }
  }

  // Socket
  const socketsDir = path.join(jobsDir, "sockets");
  if (opts.socket) {
    fs.mkdirSync(socketsDir, { recursive: true });
    fs.writeFileSync(path.join(socketsDir, "worker.socket.ts"), workerSocket, "utf8");
  } else {
    if (fs.existsSync(socketsDir)) {
      fs.rmSync(socketsDir, { recursive: true, force: true });
    }
  }

  // Clean up parent jobs folder if completely empty
  if (fs.existsSync(jobsDir)) {
    const files = fs.readdirSync(jobsDir);
    if (files.length === 0) {
      fs.rmSync(jobsDir, { recursive: true, force: true });
    }
  }

  // OLAP migrations
  if (!opts.da) {
    const daDir = path.join(target, "database", "da.migrations");
    if (fs.existsSync(daDir)) {
      fs.rmSync(daDir, { recursive: true, force: true });
    }
  }
}
