import { SystemError, FrameworkAction, FrameworkOutput } from '../types';

export class ErrorHandlingService {
  private errors: SystemError[] = [];
  private recoveryStrategies: Map<string, RecoveryStrategy> = new Map();
  private errorThresholds: Map<string, number> = new Map();

  constructor() {
    this.initializeRecoveryStrategies();
    this.initializeErrorThresholds();
  }

  async handleError(error: SystemError, context?: any): Promise<FrameworkAction[]> {
    // Log the error
    this.logError(error, context);
    
    // Check if error threshold is exceeded
    if (this.isErrorThresholdExceeded(error.component)) {
      return await this.handleThresholdExceeded(error);
    }

    // Attempt recovery
    const recoveryActions = await this.attemptRecovery(error, context);
    
    if (recoveryActions.length > 0) {
      return recoveryActions;
    }

    // If recovery fails, create error notification action
    return [{
      type: 'error',
      target: 'system',
      parameters: {
        error: error.error,
        component: error.component,
        severity: error.severity,
        context
      },
      priority: this.getErrorPriority(error.severity),
      dependencies: [],
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }];
  }

  private async attemptRecovery(error: SystemError, context?: any): Promise<FrameworkAction[]> {
    const strategy = this.recoveryStrategies.get(error.component);
    
    if (!strategy) {
      return [];
    }

    const recoveryActions: FrameworkAction[] = [];
    
    try {
      // Execute recovery strategy
      const actions = await strategy.recover(error, context);
      recoveryActions.push(...actions);
      
      // Mark error as resolved if recovery was successful
      if (actions.length > 0) {
        error.resolved = true;
        this.updateErrorStatus(error);
      }
    } catch (recoveryError) {
      // Log recovery failure
      this.logError({
        timestamp: new Date().toISOString(),
        error: `Recovery failed for ${error.component}: ${recoveryError.message}`,
        severity: 'high',
        component: 'ErrorHandlingService',
        resolved: false
      }, { originalError: error });
    }

    return recoveryActions;
  }

  private async handleThresholdExceeded(error: SystemError): Promise<FrameworkAction[]> {
    const actions: FrameworkAction[] = [];
    
    // Create emergency stop action
    actions.push({
      type: 'error',
      target: 'system',
      parameters: {
        error: `Error threshold exceeded for ${error.component}. System paused.`,
        component: 'ErrorHandlingService',
        severity: 'critical',
        action: 'pause_system'
      },
      priority: 'high',
      dependencies: [],
      id: `threshold_exceeded_${Date.now()}`
    });

    // Create notification action
    actions.push({
      type: 'notify',
      target: 'admin',
      parameters: {
        message: `Critical: Error threshold exceeded for ${error.component}`,
        details: {
          error_count: this.getErrorCount(error.component),
          threshold: this.errorThresholds.get(error.component),
          recent_errors: this.getRecentErrors(error.component, 5)
        }
      },
      priority: 'high',
      dependencies: [],
      id: `notify_threshold_${Date.now()}`
    });

    return actions;
  }

  private initializeRecoveryStrategies(): void {
    // Email interpretation recovery strategies
    this.recoveryStrategies.set('EmailInterpretationService', {
      name: 'Email Interpretation Recovery',
      recover: async (error: SystemError, context: any) => {
        const actions: FrameworkAction[] = [];
        
        if (error.error.includes('classification')) {
          // Retry with simplified classification
          actions.push({
            type: 'transform',
            target: 'EmailInterpretationService',
            parameters: {
              action: 'retry_classification',
              fallback_type: 'other',
              context
            },
            priority: 'medium',
            dependencies: [],
            id: `retry_classification_${Date.now()}`
          });
        }
        
        if (error.error.includes('attachment')) {
          // Retry without problematic attachments
          actions.push({
            type: 'transform',
            target: 'EmailInterpretationService',
            parameters: {
              action: 'retry_without_attachments',
              context
            },
            priority: 'medium',
            dependencies: [],
            id: `retry_no_attachments_${Date.now()}`
          });
        }
        
        return actions;
      }
    });

    // Frontend connection recovery strategies
    this.recoveryStrategies.set('FrontendConnectionService', {
      name: 'Frontend Connection Recovery',
      recover: async (error: SystemError, context: any) => {
        const actions: FrameworkAction[] = [];
        
        if (error.error.includes('authentication')) {
          // Retry with alternative authentication
          actions.push({
            type: 'connect',
            target: 'FrontendConnectionService',
            parameters: {
              action: 'retry_with_alt_auth',
              connection_name: context?.connection_name,
              context
            },
            priority: 'high',
            dependencies: [],
            id: `retry_alt_auth_${Date.now()}`
          });
        }
        
        if (error.error.includes('connection')) {
          // Test connection with timeout extension
          actions.push({
            type: 'connect',
            target: 'FrontendConnectionService',
            parameters: {
              action: 'retry_with_extended_timeout',
              connection_name: context?.connection_name,
              timeout: 30000,
              context
            },
            priority: 'medium',
            dependencies: [],
            id: `retry_extended_timeout_${Date.now()}`
          });
        }
        
        return actions;
      }
    });

    // Content transformation recovery strategies
    this.recoveryStrategies.set('ContentTransformationService', {
      name: 'Content Transformation Recovery',
      recover: async (error: SystemError, context: any) => {
        const actions: FrameworkAction[] = [];
        
        if (error.error.includes('transformation')) {
          // Retry with default transformations
          actions.push({
            type: 'transform',
            target: 'ContentTransformationService',
            parameters: {
              action: 'retry_with_defaults',
              frontend_name: context?.frontend_name,
              content_type: context?.content_type,
              context
            },
            priority: 'medium',
            dependencies: [],
            id: `retry_defaults_${Date.now()}`
          });
        }
        
        if (error.error.includes('mapping')) {
          // Use fallback field mapping
          actions.push({
            type: 'transform',
            target: 'ContentTransformationService',
            parameters: {
              action: 'use_fallback_mapping',
              frontend_name: context?.frontend_name,
              context
            },
            priority: 'medium',
            dependencies: [],
            id: `fallback_mapping_${Date.now()}`
          });
        }
        
        return actions;
      }
    });

    // Publishing execution recovery strategies
    this.recoveryStrategies.set('PublishingExecutionService', {
      name: 'Publishing Execution Recovery',
      recover: async (error: SystemError, context: any) => {
        const actions: FrameworkAction[] = [];
        
        if (error.error.includes('HTTP')) {
          // Retry with exponential backoff
          actions.push({
            type: 'publish',
            target: 'PublishingExecutionService',
            parameters: {
              action: 'retry_with_backoff',
              frontend_name: context?.frontend_name,
              max_attempts: 3,
              context
            },
            priority: 'high',
            dependencies: [],
            id: `retry_backoff_${Date.now()}`
          });
        }
        
        if (error.error.includes('timeout')) {
          // Retry with increased timeout
          actions.push({
            type: 'publish',
            target: 'PublishingExecutionService',
            parameters: {
              action: 'retry_with_timeout',
              frontend_name: context?.frontend_name,
              timeout: 60000,
              context
            },
            priority: 'medium',
            dependencies: [],
            id: `retry_timeout_${Date.now()}`
          });
        }
        
        if (error.error.includes('validation')) {
          // Retry with simplified content
          actions.push({
            type: 'publish',
            target: 'PublishingExecutionService',
            parameters: {
              action: 'retry_simplified',
              frontend_name: context?.frontend_name,
              context
            },
            priority: 'medium',
            dependencies: [],
            id: `retry_simplified_${Date.now()}`
          });
        }
        
        return actions;
      }
    });
  }

  private initializeErrorThresholds(): void {
    // Set error thresholds for different components
    this.errorThresholds.set('EmailInterpretationService', 10);
    this.errorThresholds.set('FrontendConnectionService', 5);
    this.errorThresholds.set('ContentTransformationService', 8);
    this.errorThresholds.set('PublishingExecutionService', 7);
    this.errorThresholds.set('ErrorHandlingService', 3);
  }

  private logError(error: SystemError, context?: any): void {
    // Add to errors array
    this.errors.push(error);
    
    // Keep only last 1000 errors
    if (this.errors.length > 1000) {
      this.errors = this.errors.slice(-1000);
    }
    
    // Log to console (in production, this would go to a proper logging system)
    console.error(`[${error.timestamp}] ${error.severity.toUpperCase()} in ${error.component}: ${error.error}`);
    if (context) {
      console.error('Context:', context);
    }
  }

  private updateErrorStatus(error: SystemError): void {
    const index = this.errors.findIndex(e => 
      e.timestamp === error.timestamp && 
      e.component === error.component
    );
    
    if (index !== -1) {
      this.errors[index] = error;
    }
  }

  private isErrorThresholdExceeded(component: string): boolean {
    const threshold = this.errorThresholds.get(component) || 10;
    const recentErrors = this.getRecentErrors(component, threshold);
    return recentErrors.length >= threshold;
  }

  private getErrorCount(component: string): number {
    return this.errors.filter(e => e.component === component).length;
  }

  private getRecentErrors(component: string, limit: number): SystemError[] {
    const componentErrors = this.errors.filter(e => e.component === component);
    return componentErrors.slice(-limit);
  }

  private getErrorPriority(severity: string): 'high' | 'medium' | 'low' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      case 'low':
        return 'low';
      default:
        return 'medium';
    }
  }

  // Public methods for error management
  getErrors(component?: string): SystemError[] {
    if (component) {
      return this.errors.filter(e => e.component === component);
    }
    return [...this.errors];
  }

  getUnresolvedErrors(): SystemError[] {
    return this.errors.filter(e => !e.resolved);
  }

  getErrorStats(): {
    total: number;
    resolved: number;
    unresolved: number;
    byComponent: Record<string, { total: number; resolved: number; unresolved: number }>;
    bySeverity: Record<string, number>;
  } {
    const stats = {
      total: this.errors.length,
      resolved: this.errors.filter(e => e.resolved).length,
      unresolved: this.errors.filter(e => !e.resolved).length,
      byComponent: {} as Record<string, { total: number; resolved: number; unresolved: number }>,
      bySeverity: {} as Record<string, number>
    };

    // Group by component
    this.errors.forEach(error => {
      if (!stats.byComponent[error.component]) {
        stats.byComponent[error.component] = { total: 0, resolved: 0, unresolved: 0 };
      }
      stats.byComponent[error.component].total++;
      if (error.resolved) {
        stats.byComponent[error.component].resolved++;
      } else {
        stats.byComponent[error.component].unresolved++;
      }
    });

    // Group by severity
    this.errors.forEach(error => {
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
    });

    return stats;
  }

  clearErrors(component?: string): void {
    if (component) {
      this.errors = this.errors.filter(e => e.component !== component);
    } else {
      this.errors = [];
    }
  }

  resolveError(errorTimestamp: string, component: string): boolean {
    const error = this.errors.find(e => 
      e.timestamp === errorTimestamp && e.component === component
    );
    
    if (error) {
      error.resolved = true;
      return true;
    }
    
    return false;
  }

  addRecoveryStrategy(component: string, strategy: RecoveryStrategy): void {
    this.recoveryStrategies.set(component, strategy);
  }

  setErrorThreshold(component: string, threshold: number): void {
    this.errorThresholds.set(component, threshold);
  }
}

interface RecoveryStrategy {
  name: string;
  recover: (error: SystemError, context?: any) => Promise<FrameworkAction[]>;
}