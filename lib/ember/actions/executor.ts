import type { Action } from "@/lib/ember/core/decision-maker";
import { logger } from "@/lib/logger";

/**
 * Actions Executor - Orchestrates execution of actions decided by AI
 */

export interface ActionHandler {
	name: string;
	execute: (params: Record<string, unknown>) => Promise<unknown>;
	validate: (params: Record<string, unknown>) => boolean;
}

class ActionsExecutor {
	private handlers: Map<string, ActionHandler> = new Map();

	/**
	 * Register an action handler
	 */
	register(handler: ActionHandler): void {
		this.handlers.set(handler.name, handler);
		logger.info({ action: handler.name }, "Action handler registered");
	}

	/**
	 * Execute an action
	 */
	async execute(action: Action): Promise<unknown> {
		const handler = this.handlers.get(action.type);

		if (!handler) {
			logger.warn({ actionType: action.type }, "No handler found for action");
			throw new Error(`No handler registered for action: ${action.type}`);
		}

		// Validate params
		if (!handler.validate(action.params)) {
			logger.error(
				{ actionType: action.type, params: action.params },
				"Action params validation failed",
			);
			throw new Error(`Invalid params for action: ${action.type}`);
		}

		try {
			logger.info(
				{ actionType: action.type, params: action.params },
				"Executing action",
			);
			const result = await handler.execute(action.params);
			logger.info({ actionType: action.type }, "Action executed successfully");
			return result;
		} catch (error) {
			logger.error(
				{ actionType: action.type, error },
				"Action execution failed",
			);
			throw error;
		}
	}

	/**
	 * Execute multiple actions in parallel
	 */
	async executeAll(actions: Action[]): Promise<unknown[]> {
		return Promise.all(actions.map((action) => this.execute(action)));
	}

	/**
	 * Get all registered handlers
	 */
	getHandlers(): string[] {
		return Array.from(this.handlers.keys());
	}

	/**
	 * Check if handler exists
	 */
	hasHandler(actionType: string): boolean {
		return this.handlers.has(actionType);
	}
}

// Singleton instance
export const actionsExecutor = new ActionsExecutor();

// Auto-register handlers
import "./handlers/send-link";
import "./handlers/send-document";
import "./handlers/create-quote";
import "./handlers/schedule-meeting";
import "./handlers/transfer-to-human";
import "./handlers/create-note";
import "./handlers/update-tags";
import "./handlers/search-product";
