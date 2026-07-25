type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: string;
    data?: Record<string, unknown>;
}

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

class Logger {
    private minLevel: LogLevel;

    constructor(minLevel: LogLevel = "info") {
        this.minLevel = minLevel;
    }

    private shouldLog(level: LogLevel): boolean {
        return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
    }

    private formatLog(entry: LogEntry): string {
        return JSON.stringify(entry);
    }

    private log(level: LogLevel, message: string, data?: Record<string, unknown>) {
        if (!this.shouldLog(level)) return;

        const entry: LogEntry = {
            level,
            message,
            timestamp: new Date().toISOString(),
            ...(data && { data }),
        };

        const formatted = this.formatLog(entry);

        switch (level) {
            case "error":
                console.error(formatted);
                break;
            case "warn":
                console.warn(formatted);
                break;
            case "info":
                console.info(formatted);
                break;
            case "debug":
                console.debug(formatted);
                break;
        }
    }

    debug(message: string, data?: Record<string, unknown>) {
        this.log("debug", message, data);
    }

    info(message: string, data?: Record<string, unknown>) {
        this.log("info", message, data);
    }

    warn(message: string, data?: Record<string, unknown>) {
        this.log("warn", message, data);
    }

    error(message: string, data?: Record<string, unknown>) {
        this.log("error", message, data);
    }

    // Request logging helper
    request(method: string, path: string, status: number, durationMs: number, extra?: Record<string, unknown>) {
        this.info("API Request", {
            method,
            path,
            status,
            durationMs,
            ...extra,
        });
    }
}

// Export singleton
export const logger = new Logger(
    process.env.NODE_ENV === "development" ? "debug" : "info"
);
