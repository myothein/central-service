import { logger } from '../../shared/utils/logger';

export class HeartbeatScheduler {
    private intervalId: NodeJS.Timeout | null = null;

    start(intervalMs: number = 60000) {
        if (this.intervalId) return;
        this.intervalId = setInterval(() => void this.checkHeartbeats(), intervalMs);
        logger.info('Heartbeat scheduler started');
    }

    stop() {
        if (this.intervalId) clearInterval(this.intervalId);
        this.intervalId = null;
        logger.info('Heartbeat scheduler stopped');
    }

    private async checkHeartbeats() {
        // TODO: persist DB-backed heartbeat monitoring before production release.
        logger.info('Checking heartbeats...');
    }
}

export const heartbeatScheduler = new HeartbeatScheduler();
