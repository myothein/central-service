import { logger } from '../../shared/utils/logger';

export class HeartbeatScheduler {
    private intervalId: NodeJS.Timer | null = null;

    start(intervalMs: number = 60000) {
        if (this.intervalId) return;
        this.intervalId = setInterval(() => this.checkHeartbeats(), intervalMs);
        logger.info('Heartbeat scheduler started');
    }

    stop() {
        if (this.intervalId) clearInterval(this.intervalId);
        this.intervalId = null;
        logger.info('Heartbeat scheduler stopped');
    }

    private async checkHeartbeats() {
        // TODO: check tenant/agent heartbeats from DB and mark offline if needed
        logger.info('Checking heartbeats...');
    }
}

export const heartbeatScheduler = new HeartbeatScheduler();
