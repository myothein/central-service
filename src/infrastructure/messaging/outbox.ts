interface OutboxEvent {
    id: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: any;
    createdAt: Date;
    processed: boolean;
}

export class OutboxService {
    private events: OutboxEvent[] = [];

    async addEvent(event: Omit<OutboxEvent, 'id' | 'createdAt' | 'processed'>) {
        this.events.push({
            ...event,
            id: crypto.randomUUID(),
            createdAt: new Date(),
            processed: false,
        });
    }

    async listPending(): Promise<OutboxEvent[]> {
        return this.events.filter(e => !e.processed);
    }

    async markProcessed(eventId: string) {
        const evt = this.events.find(e => e.id === eventId);
        if (evt) evt.processed = true;
    }
}

export const outboxService = new OutboxService();
