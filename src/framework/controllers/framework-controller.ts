import { 
  FrameworkInput, 
  FrameworkOutput, 
  FrameworkAction, 
  ProcessedContent, 
  SystemError,
  FrontendSchema 
} from '../types';
import { EmailInterpretationService } from '../services/email-interpretation';
import { FrontendConnectionService } from '../services/frontend-connection';
import { ContentTransformationService } from '../services/content-transformation';
import { PublishingExecutionService } from '../services/publishing-execution';
import { ErrorHandlingService } from '../services/error-handling';
import { LoggingService, LogLevel } from '../utils/logging';

export class FrameworkController {
  private emailInterpretationService: EmailInterpretationService;
  private frontendConnectionService: FrontendConnectionService;
  private contentTransformationService: ContentTransformationService;
  private publishingExecutionService: PublishingExecutionService;
  private errorHandlingService: ErrorHandlingService;
  private loggingService: LoggingService;
  private schemas: Map<string, FrontendSchema> = new Map();

  constructor() {
    this.emailInterpretationService = new EmailInterpretationService();
    this.frontendConnectionService = new FrontendConnectionService();
    this.contentTransformationService = new ContentTransformationService();
    this.publishingExecutionService = new PublishingExecutionService();
    this.errorHandlingService = new ErrorHandlingService();
    this.loggingService = LoggingService.getInstance();
    
    this.loggingService.info('FrameworkController', 'Framework controller initialized');
  }

  async processInput(input: FrameworkInput): Promise<FrameworkOutput> {
    const traceId = this.loggingService.startOperation('processInput', {
      userEmail: input.email.sender,
      targetFrontends: input.frontend_connections.map(c => c.name)
    });

    try {
      this.loggingService.info('FrameworkController', 'Starting email processing', {
        traceId,
        emailSubject: input.email.subject,
        frontendCount: input.frontend_connections.length
      });

      // Step 1: Email Interpretation
      const interpretationResult = await this.interpretEmail(input.email, traceId);
      if (interpretationResult.errors.length > 0) {
        this.loggingService.warn('FrameworkController', 'Email interpretation had errors', {
          traceId,
          errorCount: interpretationResult.errors.length
        });
      }

      // Step 2: Frontend Connection Management
      const connectionResult = await this.manageConnections(input.frontend_connections, traceId);
      if (connectionResult.errors.length > 0) {
        this.loggingService.warn('FrameworkController', 'Connection management had errors', {
          traceId,
          errorCount: connectionResult.errors.length
        });
      }

      // Step 3: Content Transformation
      const transformationResult = await this.transformContent(
        interpretationResult.processedContent,
        connectionResult.activeConnections,
        traceId
      );
      if (transformationResult.errors.length > 0) {
        this.loggingService.warn('FrameworkController', 'Content transformation had errors', {
          traceId,
          errorCount: transformationResult.errors.length
        });
      }

      // Step 4: Publishing Execution
      const publishingResult = await this.executePublishing(
        transformationResult.transformedContents,
        connectionResult.activeConnections,
        traceId
      );
      if (publishingResult.errors.length > 0) {
        this.loggingService.warn('FrameworkController', 'Publishing execution had errors', {
          traceId,
          errorCount: publishingResult.errors.length
        });
      }

      // Generate actions based on results
      const actions = this.generateActions(
        interpretationResult,
        connectionResult,
        transformationResult,
        publishingResult,
        traceId
      );

      // Determine overall status
      const overallStatus = this.determineOverallStatus(
        interpretationResult,
        connectionResult,
        transformationResult,
        publishingResult
      );

      // Generate next steps
      const nextSteps = this.generateNextSteps(
        interpretationResult,
        connectionResult,
        transformationResult,
        publishingResult
      );

      // Update system state
      this.updateSystemState(input, publishingResult, traceId);

      // Record metrics
      this.recordProcessingMetrics(
        interpretationResult,
        connectionResult,
        transformationResult,
        publishingResult,
        overallStatus,
        traceId
      );

      const executionTime = Date.now() - parseInt(traceId.split('_')[1]);
      
      const result: FrameworkOutput = {
        actions,
        content_mapping: transformationResult.mappings,
        status: {
          overall: overallStatus,
          details: this.generateStatusDetails(
            overallStatus,
            executionTime,
            interpretationResult.errors.length + connectionResult.errors.length + 
            transformationResult.errors.length + publishingResult.errors.length
          )
        },
        errors: [
          ...interpretationResult.errors,
          ...connectionResult.errors,
          ...transformationResult.errors,
          ...publishingResult.errors
        ],
        next_steps: nextSteps
      };

      this.loggingService.info('FrameworkController', 'Email processing completed', {
        traceId,
        overallStatus,
        executionTime,
        totalErrors: result.errors.length
      });

      this.loggingService.endOperation(traceId, true, { overallStatus, executionTime });

      return result;

    } catch (error) {
      // Handle catastrophic failures
      const systemError: SystemError = {
        timestamp: new Date().toISOString(),
        error: `Framework processing failed: ${error.message}`,
        severity: 'critical',
        component: 'FrameworkController',
        resolved: false
      };

      this.loggingService.error('FrameworkController', 'Catastrophic processing failure', {
        traceId,
        error: error.message,
        stack: error.stack
      });

      this.loggingService.logSecurityEvent('processing_failure', {
        traceId,
        error: error.message,
        component: 'FrameworkController'
      }, input.user_context.id);

      const recoveryActions = await this.errorHandlingService.handleError(systemError, { input });

      this.loggingService.endOperation(traceId, false, { error: error.message });

      return {
        actions: recoveryActions,
        content_mapping: [],
        status: {
          overall: 'failure',
          details: `Critical system failure: ${error.message}`
        },
        errors: [systemError],
        next_steps: [{
          action: 'System recovery required',
          trigger: 'immediate'
        }]
      };
    }
  }

  private async interpretEmail(email: any, traceId: string): Promise<{
    processedContent: ProcessedContent;
    errors: SystemError[];
  }> {
    try {
      this.loggingService.debug('FrameworkController', 'Starting email interpretation', { traceId });
      
      const processedContent = await this.emailInterpretationService.interpretEmail(email);
      const errors = this.emailInterpretationService.getErrors();
      
      // Handle any errors from email interpretation
      for (const error of errors) {
        this.loggingService.warn('EmailInterpretationService', error.error, {
          traceId,
          component: error.component,
          severity: error.severity
        });
        
        const recoveryActions = await this.errorHandlingService.handleError(error, { email, traceId });
        if (recoveryActions.length === 0) {
          // If no recovery actions, add to our error list
          this.errorHandlingService.logError(error, { email, traceId });
        }
      }

      this.loggingService.info('FrameworkController', 'Email interpretation completed', {
        traceId,
        contentType: processedContent.type,
        intent: processedContent.intent,
        targetFrontends: processedContent.target_frontends,
        errorCount: errors.length
      });

      return { processedContent, errors };
    } catch (error) {
      this.loggingService.error('FrameworkController', 'Email interpretation failed', {
        traceId,
        error: error.message,
        stack: error.stack
      });
      
      const systemError: SystemError = {
        timestamp: new Date().toISOString(),
        error: `Email interpretation failed: ${error.message}`,
        severity: 'high',
        component: 'FrameworkController',
        resolved: false
      };

      await this.errorHandlingService.handleError(systemError, { email, traceId });
      return {
        processedContent: this.createFallbackProcessedContent(email),
        errors: [systemError]
      };
    }
  }

  private async manageConnections(connections: any[], traceId: string): Promise<{
    activeConnections: any[];
    errors: SystemError[];
  }> {
    try {
      this.loggingService.debug('FrameworkController', 'Starting connection management', {
        traceId,
        connectionCount: connections.length
      });

      const activeConnections: any[] = [];
      const errors: SystemError[] = [];

      for (const connection of connections) {
        try {
          this.loggingService.debug('FrameworkController', `Managing connection: ${connection.name}`, {
            traceId,
            connectionName: connection.name,
            endpoint: connection.api_endpoint
          });

          const success = await this.frontendConnectionService.manageConnection(connection);
          if (success) {
            activeConnections.push(connection);
            
            // Cache schema
            const schema = this.frontendConnectionService.getSchema(connection.name);
            if (schema) {
              this.schemas.set(connection.name, schema);
            }

            this.loggingService.info('FrameworkController', `Connection established: ${connection.name}`, {
              traceId,
              connectionName: connection.name
            });
          } else {
            const serviceErrors = this.frontendConnectionService.getErrors();
            errors.push(...serviceErrors);
            
            this.loggingService.warn('FrameworkController', `Connection failed: ${connection.name}`, {
              traceId,
              connectionName: connection.name,
              errorCount: serviceErrors.length
            });
            
            // Handle connection errors
            for (const error of serviceErrors) {
              await this.errorHandlingService.handleError(error, { connection, traceId });
            }
          }
        } catch (error) {
          this.loggingService.error('FrameworkController', `Connection management failed for ${connection.name}`, {
            traceId,
            connectionName: connection.name,
            error: error.message,
            stack: error.stack
          });

          const systemError: SystemError = {
            timestamp: new Date().toISOString(),
            error: `Connection management failed for ${connection.name}: ${error.message}`,
            severity: 'high',
            component: 'FrameworkController',
            resolved: false
          };

          await this.errorHandlingService.handleError(systemError, { connection, traceId });
          errors.push(systemError);
        }
      }

      this.loggingService.info('FrameworkController', 'Connection management completed', {
        traceId,
        totalConnections: connections.length,
        activeConnections: activeConnections.length,
        failedConnections: connections.length - activeConnections.length
      });

      return { activeConnections, errors };
    } catch (error) {
      this.loggingService.error('FrameworkController', 'Connection management failed catastrophically', {
        traceId,
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }

  private async transformContent(
    processedContent: ProcessedContent,
    activeConnections: any[],
    traceId: string
  ): Promise<{
    transformedContents: Map<string, any>;
    mappings: any[];
    errors: SystemError[];
  }> {
    try {
      this.loggingService.debug('FrameworkController', 'Starting content transformation', {
        traceId,
        contentType: processedContent.type,
        activeConnections: activeConnections.length
      });

      const transformedContents = new Map<string, any>();
      const mappings: any[] = [];
      const errors: SystemError[] = [];

      for (const connection of activeConnections) {
        try {
          this.loggingService.debug('FrameworkController', `Transforming content for: ${connection.name}`, {
            traceId,
            connectionName: connection.name
          });

          const schema = this.schemas.get(connection.name);
          if (!schema) {
            throw new Error(`No schema found for ${connection.name}`);
          }

          const result = await this.contentTransformationService.transformContent(
            processedContent,
            schema
          );

          transformedContents.set(connection.name, result.transformedContent);
          mappings.push(...result.mappings);

          const serviceErrors = this.contentTransformationService.getErrors();
          errors.push(...serviceErrors);

          // Handle transformation errors
          for (const error of serviceErrors) {
            this.loggingService.warn('ContentTransformationService', error.error, {
              traceId,
              connectionName: connection.name,
              component: error.component,
              severity: error.severity
            });
            
            await this.errorHandlingService.handleError(error, { 
              connection, 
              processedContent,
              traceId 
            });
          }

          this.loggingService.debug('FrameworkController', `Content transformation completed for: ${connection.name}`, {
            traceId,
            connectionName: connection.name,
            mappingCount: result.mappings.length,
            errorCount: serviceErrors.length
          });
        } catch (error) {
          this.loggingService.error('FrameworkController', `Content transformation failed for ${connection.name}`, {
            traceId,
            connectionName: connection.name,
            error: error.message,
            stack: error.stack
          });

          const systemError: SystemError = {
            timestamp: new Date().toISOString(),
            error: `Content transformation failed for ${connection.name}: ${error.message}`,
            severity: 'high',
            component: 'FrameworkController',
            resolved: false
          };

          await this.errorHandlingService.handleError(systemError, { 
            connection, 
            processedContent,
            traceId 
          });
          errors.push(systemError);
        }
      }

      this.loggingService.info('FrameworkController', 'Content transformation completed', {
        traceId,
        totalConnections: activeConnections.length,
        successfulTransformations: transformedContents.size,
        totalMappings: mappings.length,
        totalErrors: errors.length
      });

      return { transformedContents, mappings, errors };
    } catch (error) {
      this.loggingService.error('FrameworkController', 'Content transformation failed catastrophically', {
        traceId,
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }

  private async executePublishing(
    transformedContents: Map<string, any>,
    activeConnections: any[],
    traceId: string
  ): Promise<{
    results: any[];
    errors: SystemError[];
  }> {
    try {
      this.loggingService.debug('FrameworkController', 'Starting publishing execution', {
        traceId,
        targetCount: activeConnections.length
      });

      const results: any[] = [];
      const errors: SystemError[] = [];

      for (const connection of activeConnections) {
        try {
          this.loggingService.debug('FrameworkController', `Publishing to: ${connection.name}`, {
            traceId,
            connectionName: connection.name
          });

          const transformedContent = transformedContents.get(connection.name);
          if (!transformedContent) {
            throw new Error(`No transformed content found for ${connection.name}`);
          }

          // Create processed content object for publishing
          const processedContent: ProcessedContent = {
            type: transformedContent.type || 'content',
            intent: transformedContent.publishing_intent || 'immediate',
            target_frontends: [connection.name],
            content: transformedContent,
            media: transformedContent.media || []
          };

          const result = await this.publishingExecutionService.executePublishing(
            processedContent,
            [connection],
            this.schemas
          );

          results.push(result);
          errors.push(...result.errors);

          // Handle publishing errors
          for (const error of result.errors) {
            this.loggingService.warn('PublishingExecutionService', error.error, {
              traceId,
              connectionName: connection.name,
              component: error.component,
              severity: error.severity
            });
            
            await this.errorHandlingService.handleError(error, { 
              connection, 
              transformedContent,
              traceId 
            });
          }

          this.loggingService.info('FrameworkController', `Publishing completed for: ${connection.name}`, {
            traceId,
            connectionName: connection.name,
            success: result.success,
            executionTime: result.execution_time,
            apiCallsCount: result.api_requests?.length || 0,
            errorCount: result.errors.length
          });

          // Record publishing metrics
          this.loggingService.recordMetric(`publishing.${connection.name}.success`, result.success ? 1 : 0);
          this.loggingService.recordMetric(`publishing.${connection.name}.execution_time`, result.execution_time);
          this.loggingService.incrementMetric(`publishing.${connection.name}.total_requests`);

        } catch (error) {
          this.loggingService.error('FrameworkController', `Publishing execution failed for ${connection.name}`, {
            traceId,
            connectionName: connection.name,
            error: error.message,
            stack: error.stack
          });

          const systemError: SystemError = {
            timestamp: new Date().toISOString(),
            error: `Publishing execution failed for ${connection.name}: ${error.message}`,
            severity: 'high',
            component: 'FrameworkController',
            resolved: false
          };

          await this.errorHandlingService.handleError(systemError, { 
            connection, 
            transformedContent: transformedContents.get(connection.name),
            traceId 
          });
          errors.push(systemError);
        }
      }

      this.loggingService.info('FrameworkController', 'Publishing execution completed', {
        traceId,
        totalTargets: activeConnections.length,
        successfulPublishing: results.filter(r => r.success).length,
        failedPublishing: results.filter(r => !r.success).length,
        totalErrors: errors.length
      });

      return { results, errors };
    } catch (error) {
      this.loggingService.error('FrameworkController', 'Publishing execution failed catastrophically', {
        traceId,
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }

  private generateActions(
    interpretationResult: any,
    connectionResult: any,
    transformationResult: any,
    publishingResult: any,
    traceId: string
  ): FrameworkAction[] {
    const actions: FrameworkAction[] = [];
    let actionId = 1;

    // Add connection actions
    connectionResult.activeConnections.forEach((connection: any) => {
      actions.push({
        type: 'connect',
        target: connection.name,
        parameters: {
          status: 'connected',
          api_endpoint: connection.api_endpoint
        },
        priority: 'high',
        dependencies: [],
        id: `action_${actionId++}`
      });
    });

    // Add transformation actions
    transformationResult.transformedContents.forEach((content: any, frontend: string) => {
      actions.push({
        type: 'transform',
        target: frontend,
        parameters: {
          content_type: content.type,
          fields_transformed: Object.keys(content).length
        },
        priority: 'medium',
        dependencies: [`action_${actionId - 1}`],
        id: `action_${actionId++}`
      });
    });

    // Add publishing actions
    publishingResult.results.forEach((result: any, index: number) => {
      actions.push({
        type: result.success ? 'publish' : 'error',
        target: connectionResult.activeConnections[index]?.name || 'unknown',
        parameters: {
          success: result.success,
          execution_time: result.execution_time,
          api_calls_count: result.api_requests?.length || 0
        },
        priority: result.success ? 'medium' : 'high',
        dependencies: [`action_${actionId - 1}`],
        id: `action_${actionId++}`
      });
    });

    this.loggingService.debug('FrameworkController', 'Generated actions', {
      traceId,
      actionCount: actions.length
    });

    return actions;
  }

  private determineOverallStatus(
    interpretationResult: any,
    connectionResult: any,
    transformationResult: any,
    publishingResult: any
  ): 'success' | 'partial_success' | 'failure' {
    const totalErrors = [
      interpretationResult.errors.length,
      connectionResult.errors.length,
      transformationResult.errors.length,
      publishingResult.errors.length
    ].reduce((sum, count) => sum + count, 0);

    const successfulPublishing = publishingResult.results.filter((r: any) => r.success).length;
    const totalPublishing = publishingResult.results.length;

    if (totalErrors === 0 && successfulPublishing === totalPublishing) {
      return 'success';
    }

    if (successfulPublishing > 0 || totalErrors < 3) {
      return 'partial_success';
    }

    return 'failure';
  }

  private generateStatusDetails(
    status: string,
    executionTime: number,
    errorCount: number
  ): string {
    const timeSeconds = (executionTime / 1000).toFixed(2);
    
    switch (status) {
      case 'success':
        return `Successfully processed in ${timeSeconds}s with no errors`;
      case 'partial_success':
        return `Partially processed in ${timeSeconds}s with ${errorCount} errors`;
      case 'failure':
        return `Processing failed in ${timeSeconds}s with ${errorCount} errors`;
      default:
        return `Processing completed in ${timeSeconds}s`;
    }
  }

  private generateNextSteps(
    interpretationResult: any,
    connectionResult: any,
    transformationResult: any,
    publishingResult: any
  ): any[] {
    const nextSteps: any[] = [];

    // Add next steps based on errors
    const allErrors = [
      ...interpretationResult.errors,
      ...connectionResult.errors,
      ...transformationResult.errors,
      ...publishingResult.errors
    ];

    if (allErrors.length > 0) {
      nextSteps.push({
        action: 'Review and resolve errors',
        trigger: 'immediate'
      });
    }

    // Add next steps based on publishing results
    const failedPublishing = publishingResult.results.filter((r: any) => !r.success);
    if (failedPublishing.length > 0) {
      nextSteps.push({
        action: 'Retry failed publishing operations',
        trigger: '5_minutes'
      });
    }

    // Add maintenance next steps
    nextSteps.push({
      action: 'System health check',
      trigger: '1_hour'
    });

    return nextSteps;
  }

  private updateSystemState(input: FrameworkInput, publishingResult: any, traceId: string): void {
    // Update system state with processing results
    const successfulPublishing = publishingResult.results.filter((r: any) => r.success).length;
    
    input.system_state.total_processed += 1;
    input.system_state.success_rate = Math.round(
      (input.system_state.total_processed - publishingResult.errors.length) / 
      input.system_state.total_processed * 100
    );

    // Update active connections
    input.system_state.active_connections = input.frontend_connections
      .filter(conn => conn.is_active)
      .map(conn => conn.name);

    this.loggingService.debug('FrameworkController', 'System state updated', {
      traceId,
      totalProcessed: input.system_state.total_processed,
      successRate: input.system_state.success_rate,
      activeConnections: input.system_state.active_connections
    });
  }

  private recordProcessingMetrics(
    interpretationResult: any,
    connectionResult: any,
    transformationResult: any,
    publishingResult: any,
    overallStatus: string,
    traceId: string
  ): void {
    // Record processing metrics
    this.loggingService.incrementMetric('processing.total_requests');
    this.loggingService.incrementMetric(`processing.status.${overallStatus}`);
    this.loggingService.incrementMetric('processing.connections.total', connectionResult.activeConnections.length);
    this.loggingService.incrementMetric('processing.connections.successful', connectionResult.activeConnections.length);
    this.loggingService.incrementMetric('processing.publishing.total', publishingResult.results.length);
    this.loggingService.incrementMetric('processing.publishing.successful', publishingResult.results.filter((r: any) => r.success).length);
    this.loggingService.incrementMetric('processing.errors.total', 
      interpretationResult.errors.length + connectionResult.errors.length + 
      transformationResult.errors.length + publishingResult.errors.length
    );

    // Record component-specific metrics
    this.loggingService.incrementMetric('components.email_interpretation.requests');
    this.loggingService.incrementMetric('components.email_interpretation.errors', interpretationResult.errors.length);
    this.loggingService.incrementMetric('components.frontend_connection.requests');
    this.loggingService.incrementMetric('components.frontend_connection.errors', connectionResult.errors.length);
    this.loggingService.incrementMetric('components.content_transformation.requests');
    this.loggingService.incrementMetric('components.content_transformation.errors', transformationResult.errors.length);
    this.loggingService.incrementMetric('components.publishing_execution.requests');
    this.loggingService.incrementMetric('components.publishing_execution.errors', publishingResult.errors.length);

    this.loggingService.debug('FrameworkController', 'Processing metrics recorded', { traceId });
  }

  private createFallbackProcessedContent(email: any): ProcessedContent {
    return {
      type: 'other',
      intent: 'draft',
      target_frontends: ['all'],
      content: {
        title: email.subject || 'Untitled',
        body: email.body || '',
        author: email.sender || 'unknown',
        created_at: email.timestamp || new Date().toISOString()
      },
      media: []
    };
  }

  // Public methods for framework management
  getSystemHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    errors: SystemError[];
    stats: any;
  } {
    const allErrors = [
      ...this.emailInterpretationService.getErrors(),
      ...this.frontendConnectionService.getErrors(),
      ...this.contentTransformationService.getErrors(),
      ...this.publishingExecutionService.getErrors(),
      ...this.errorHandlingService.getErrors()
    ];

    const errorStats = this.errorHandlingService.getErrorStats();
    const loggingStats = this.loggingService.getStatistics();
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (errorStats.unresolved > 10 || loggingStats.averageOperationDuration > 30000) {
      status = 'unhealthy';
    } else if (errorStats.unresolved > 3 || loggingStats.averageOperationDuration > 15000) {
      status = 'degraded';
    }

    return {
      status,
      errors: allErrors,
      stats: {
        ...errorStats,
        logging: loggingStats
      }
    };
  }

  reset(): void {
    this.emailInterpretationService.clearErrors();
    this.frontendConnectionService.clearErrors();
    this.contentTransformationService.clearErrors();
    this.publishingExecutionService.clearErrors();
    this.errorHandlingService.clearErrors();
    this.schemas.clear();
    
    this.loggingService.info('FrameworkController', 'Framework reset completed');
  }
}