/**
 * Event Validator
 *
 * Validates Event objects against the JSON schema.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { getLogger, type Logger } from '@axiom/common';
import type { Event } from '../types/events.js';

export interface ValidationResult {
    valid: boolean;
    errors?: ErrorObject[];
}

export class EventValidator {
    private validate: ValidateFunction;
    private logger: Logger;

    /**
     * Creates a new EventValidator
     */
    constructor() {
        this.logger = getLogger();
        this.validate = this.loadSchema();
    }

    /**
     * Loads and compiles the JSON schema
     *
     * @returns Compiled validation function
     */
    private loadSchema(): ValidateFunction {
        try {
            // Load schema from file
            const schemaPath = join(process.cwd(), 'schemas', 'event.schema.json');
            const schemaContent = readFileSync(schemaPath, 'utf-8');
            const schema = JSON.parse(schemaContent);

            // Initialize AJV with formats support
            const ajv = new Ajv({ allErrors: true, verbose: true });
            addFormats(ajv);

            // Compile schema
            const validate = ajv.compile(schema);

            this.logger.info('Event schema loaded and compiled', {
                schemaPath,
                schemaId: schema.$id,
            });

            return validate;
        } catch (error) {
            this.logger.error('Failed to load event schema', error as Error);
            throw new Error(`Failed to load event schema: ${(error as Error).message}`);
        }
    }

    /**
     * Validates an Event object
     *
     * @param event Event object to validate
     * @returns ValidationResult
     */
    validateEvent(event: Event): ValidationResult {
        const isValid = this.validate(event);

        if (!isValid) {
            return {
                valid: false,
                errors: this.validate.errors || [],
            };
        }

        return { valid: true };
    }

    /**
     * Formats validation errors for logging
     *
     * @param errors Array of AJV error objects
     * @returns Formatted error string
     */
    formatErrors(errors: ErrorObject[]): string {
        return errors
            .map((err) => {
                const path = err.instancePath || '/';
                const message = err.message || 'unknown error';
                const params = err.params ? ` (${JSON.stringify(err.params)})` : '';
                return `  ${path}: ${message}${params}`;
            })
            .join('\n');
    }
}
