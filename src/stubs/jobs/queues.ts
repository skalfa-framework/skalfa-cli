export const workerQueueBase = `import { logger, queue } from "@utils";



// ============================================>
// ## Run of queue workers.
// ============================================>
queue.worker("example", async (payload, id) => {
    logger.queue(\`Start queue \${id}\`)

    if (Math.random() < 0.5) {
        logger.queueError(\`Queue \${id} intentionally failed\`)
        throw new Error(\`Random failure for job \${id}\`)
    }

    const wait = () => new Promise((resolve) =>
        setTimeout(() => {
            logger.queue("Queue payload date:" + payload?.date)
            resolve("")
        }, 5000)
    )
    
    await wait()

    logger.queue(\`Finish queue \${id}\`)
});


logger.start(\`Queue job workers is running!\`)
`;

export const workerQueueWithDa = `import { logger, queue } from "@utils";
import { activityLogQueueWorker } from "./activity-log.queue.worker";
import { accessLogQueueWorker } from "./access-log.queue.worker";
import { errorLogQueueWorker } from "./error-log.queue.worker";



// ============================================>
// ## Run of queue workers.
// ============================================>
queue.worker("example", async (payload, id) => {
    logger.queue(\`Start queue \${id}\`)

    if (Math.random() < 0.5) {
        logger.queueError(\`Queue \${id} intentionally failed\`)
        throw new Error(\`Random failure for job \${id}\`)
    }

    const wait = () => new Promise((resolve) =>
        setTimeout(() => {
            logger.queue("Queue payload date:" + payload?.date)
            resolve("")
        }, 5000)
    )
    
    await wait()

    logger.queue(\`Finish queue \${id}\`)
});

activityLogQueueWorker()
accessLogQueueWorker()
errorLogQueueWorker()


logger.start(\`Queue job workers is running!\`)
`;

export const authQueueWorker = `import { auth, queue } from "@utils"



export const activityLogQueueWorker = () => {
  queue.worker("auth:revalidate-permission", async (payload) => {
      const userId = payload?.userId

      await auth.revalidateUserPermissions(userId)
    }
  )
}
`;

export const activityLogQueueWorker = `import { queue, da } from '@utils'



const ACTIVITY_LOG_QUEUE        =  process.env.ACTIVITY_LOG_QUEUE     ||'activity-log'
const ACTIVITY_LOG_CONCURRENCY  =  process.env.ACCESS_LOG_CONCURRENCY || 500
const ACTIVITY_LOG_FLUSH        =  process.env.ACCESS_LOG_FLUS        || 2000
const ACTIVITY_LOG_DA_TABLE     =  process.env.ACTIVITY_LOG_DA_TABLE  || 'activity_logs'

let buffer: any[]  =  []
let lastFlush      =  Date.now()

export const activityLogQueueWorker = () => {
  queue.worker(ACTIVITY_LOG_QUEUE, async (payload) => {
      buffer.push(payload)

      const now = Date.now()
      if (buffer.length >= Number(ACTIVITY_LOG_CONCURRENCY) || now - lastFlush >= Number(ACTIVITY_LOG_FLUSH)) {
        if (!buffer.length) return

        const batch = buffer
        buffer = []
        lastFlush = Date.now()

        await da.insert(ACTIVITY_LOG_DA_TABLE, {
          values : batch,
          format : 'JSONEachRow'
        })
      }
    },
    { concurrency: 1, interval: 50 }
  )

}
`;

export const accessLogQueueWorker = `import { queue, da, AccessLog } from '@utils'



const ACCESS_LOG_QUEUE        =  process.env.ACCESS_LOG_QUEUE        || "access-log"
const ACCESS_LOG_TABLE        =  process.env.ACCESS_LOG_TABLE        || 'access_logs'
const ACCESS_LOG_CONCURRENCY  =  process.env.ACCESS_LOG_CONCURRENCY  || 500
const ACCESS_LOG_FLUSH        =  process.env.ACCESS_LOG_FLUSH        || 1000

let accessBuffer: AccessLog[] = []
let lastAccessFlush = Date.now()

export const accessLogQueueWorker = () => {
  queue.worker(ACCESS_LOG_QUEUE, async (payload) => {
      accessBuffer.push(payload as AccessLog)

      const now = Date.now()

      if (accessBuffer.length >= Number(ACCESS_LOG_CONCURRENCY) || now - lastAccessFlush >= Number(ACCESS_LOG_FLUSH)) {
        if (!accessBuffer.length) return

        const batch = accessBuffer
        accessBuffer = []
        lastAccessFlush = Date.now()

        await da.insert(ACCESS_LOG_TABLE, {
          values : batch,
          format : 'JSONEachRow'
        })
      }
    },
    { concurrency: 1, interval: 50 }
  )
}
`;

export const errorLogQueueWorker = `import { queue, da, ErrorLog } from '@utils'



const ERROR_LOG_QUEUE        =  process.env.ERROR_LOG_QUEUE        || "error-log"
const ACCESS_LOG_TABLE        =  process.env.ACCESS_LOG_TABLE      || 'error_logs'
const ERROR_LOG_CONCURRENCY  =  process.env.ERROR_LOG_CONCURRENCY  || 10
const ERROR_LOG_FLUSH        =  process.env.ERROR_LOG_FLUSH        || 200

let errorBuffer: ErrorLog[] = []
let lastErrorFlush = Date.now()

export const errorLogQueueWorker = () => {
  queue.worker(ERROR_LOG_QUEUE, async (payload) => {
      errorBuffer.push(payload as ErrorLog)

      const now = Date.now()

      if (errorBuffer.length >= Number(ERROR_LOG_CONCURRENCY) || now - lastErrorFlush >= Number(ERROR_LOG_FLUSH)) {
        if (!errorBuffer.length) return

        const batch = errorBuffer
        errorBuffer = []
        lastErrorFlush = Date.now()

        await da.insert(ACCESS_LOG_TABLE, {
          values : batch,
          format : 'JSONEachRow'
        })
      }
    },
    { concurrency: 1, interval: 50 }
  )
}
`;

export const notificationQueueWorker = `import { queue, notification, NotificationPayload, NotificationCancelPayload } from '@utils'



export const notificationQueueWorker = () => {
  queue.worker("notifications", async (payload) => {
      if (payload?.type != "cancel") {
        notification.send(payload as NotificationPayload)
      } else {
        notification.cancel(payload as NotificationCancelPayload)
      }
  }, { concurrency: 1, interval: 50 })
}
`;
