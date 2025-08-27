import { APIRequest, ProcessedContent, FrontendConnection, FrontendSchema, SystemError, ProcessingResult } from '../types';

export class PublishingExecutionService {
  private errors: SystemError[] = [];
  private executionHistory: ProcessingResult[] = [];

  async executePublishing(
    processedContent: ProcessedContent,
    frontendConnections: FrontendConnection[],
    schemas: Map<string, FrontendSchema>
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const apiRequests: APIRequest[] = [];
    const errors: SystemError[] = [];

    try {
      // Filter active connections that are targeted
      const targetConnections = frontendConnections.filter(conn => 
        conn.is_active && 
        (processedContent.target_frontends.includes('all') || 
         processedContent.target_frontends.includes(conn.name))
      );

      if (targetConnections.length === 0) {
        throw new Error('No active frontend connections found for publishing');
      }

      // Generate API requests for each target frontend
      for (const connection of targetConnections) {
        try {
          const schema = schemas.get(connection.name);
          if (!schema) {
            throw new Error(`No schema found for frontend: ${connection.name}`);
          }

          const requests = await this.generateAPIRequests(processedContent, connection, schema);
          apiRequests.push(...requests);

          // Execute requests based on intent
          if (processedContent.intent === 'immediate') {
            await this.executeRequests(requests, connection);
          }
        } catch (error) {
          errors.push({
            timestamp: new Date().toISOString(),
            error: `Failed to generate requests for ${connection.name}: ${error.message}`,
            severity: 'high',
            component: 'PublishingExecutionService',
            resolved: false
          });
        }
      }

      const executionTime = Date.now() - startTime;
      const success = errors.length === 0 || errors.length < targetConnections.length;

      const result: ProcessingResult = {
        success,
        processed_content: processedContent,
        api_requests: apiRequests,
        errors,
        execution_time: executionTime
      };

      this.executionHistory.push(result);
      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const result: ProcessingResult = {
        success: false,
        processed_content: processedContent,
        api_requests: apiRequests,
        errors: [{
          timestamp: new Date().toISOString(),
          error: `Publishing execution failed: ${error.message}`,
          severity: 'critical',
          component: 'PublishingExecutionService',
          resolved: false
        }],
        execution_time: executionTime
      };

      this.executionHistory.push(result);
      return result;
    }
  }

  private async generateAPIRequests(
    processedContent: ProcessedContent,
    connection: FrontendConnection,
    schema: FrontendSchema
  ): Promise<APIRequest[]> {
    const requests: APIRequest[] = [];

    // Find the appropriate endpoint for the content type
    const endpoint = this.findEndpointForContentType(schema, processedContent.type);
    
    if (!endpoint) {
      throw new Error(`No suitable endpoint found for content type: ${processedContent.type}`);
    }

    // Generate request based on endpoint method
    switch (endpoint.method) {
      case 'POST':
        requests.push(await this.createPostRequest(processedContent, connection, endpoint));
        break;
      
      case 'PUT':
        requests.push(await this.createPutRequest(processedContent, connection, endpoint));
        break;
      
      case 'PATCH':
        requests.push(await this.createPatchRequest(processedContent, connection, endpoint));
        break;
      
      default:
        throw new Error(`Unsupported HTTP method: ${endpoint.method}`);
    }

    return requests;
  }

  private findEndpointForContentType(schema: FrontendSchema, contentType: string): any {
    // Look for endpoints that match the content type
    const typeToEndpointMap: Record<string, string[]> = {
      'article': ['/articles', '/posts', '/content', '/blog'],
      'product': ['/products', '/items', '/listings'],
      'update': ['/updates', '/news', '/announcements'],
      'announcement': ['/announcements', '/news', '/updates']
    };

    const possiblePaths = typeToEndpointMap[contentType] || ['/content'];
    
    // Find matching endpoint
    return schema.endpoints.find(endpoint => 
      possiblePaths.some(path => endpoint.path.includes(path)) &&
      ['POST', 'PUT', 'PATCH'].includes(endpoint.method)
    );
  }

  private async createPostRequest(
    processedContent: ProcessedContent,
    connection: FrontendConnection,
    endpoint: any
  ): Promise<APIRequest> {
    const headers = await this.createAuthHeaders(connection);
    const url = `${connection.api_endpoint.replace(/\/$/, '')}${endpoint.path}`;
    
    // Prepare request body
    const body = this.prepareRequestBody(processedContent, endpoint);

    return {
      method: 'POST',
      url,
      headers,
      body,
      auth: {
        type: connection.auth_type,
        credentials: connection.credentials
      }
    };
  }

  private async createPutRequest(
    processedContent: ProcessedContent,
    connection: FrontendConnection,
    endpoint: any
  ): Promise<APIRequest> {
    const headers = await this.createAuthHeaders(connection);
    const url = `${connection.api_endpoint.replace(/\/$/, '')}${endpoint.path}`;
    
    // For PUT, we might need an ID - try to extract from content
    const contentId = processedContent.content.id || 
                     processedContent.content.metadata?.id ||
                     Date.now().toString();
    
    const fullUrl = `${url}/${contentId}`;
    const body = this.prepareRequestBody(processedContent, endpoint);

    return {
      method: 'PUT',
      url: fullUrl,
      headers,
      body,
      auth: {
        type: connection.auth_type,
        credentials: connection.credentials
      }
    };
  }

  private async createPatchRequest(
    processedContent: ProcessedContent,
    connection: FrontendConnection,
    endpoint: any
  ): Promise<APIRequest> {
    const headers = await this.createAuthHeaders(connection);
    const url = `${connection.api_endpoint.replace(/\/$/, '')}${endpoint.path}`;
    
    // For PATCH, we might need an ID
    const contentId = processedContent.content.id || 
                     processedContent.content.metadata?.id ||
                     Date.now().toString();
    
    const fullUrl = `${url}/${contentId}`;
    const body = this.prepareRequestBody(processedContent, endpoint);

    return {
      method: 'PATCH',
      url: fullUrl,
      headers,
      body,
      auth: {
        type: connection.auth_type,
        credentials: connection.credentials
      }
    };
  }

  private prepareRequestBody(processedContent: ProcessedContent, endpoint: any): any {
    const body: any = {};
    
    // Start with the processed content
    Object.assign(body, processedContent.content);
    
    // Add content type if not present
    if (!body.type) {
      body.type = processedContent.type;
    }
    
    // Handle media files
    if (processedContent.media.length > 0) {
      body.media = processedContent.media.map(media => ({
        filename: media.filename,
        content_type: media.content_type,
        data: media.data,
        alt_text: media.metadata?.alt_text || '',
        caption: media.metadata?.caption || ''
      }));
    }
    
    // Add metadata
    if (Object.keys(processedContent.content.metadata || {}).length > 0) {
      body.metadata = processedContent.content.metadata;
    }
    
    // Add publishing intent
    body.publishing_intent = processedContent.intent;
    
    // Filter body to match endpoint schema requirements
    if (endpoint.request_body && endpoint.request_body.properties) {
      const filteredBody: any = {};
      const requiredFields = endpoint.request_body.required || [];
      const properties = endpoint.request_body.properties;
      
      // Include required fields
      requiredFields.forEach((field: string) => {
        if (body[field] !== undefined) {
          filteredBody[field] = body[field];
        }
      });
      
      // Include optional fields that exist in our body
      Object.keys(properties).forEach(field => {
        if (body[field] !== undefined && !filteredBody[field]) {
          filteredBody[field] = body[field];
        }
      });
      
      return filteredBody;
    }
    
    return body;
  }

  private async createAuthHeaders(connection: FrontendConnection): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'LLM-Backend-Framework/1.0'
    };

    switch (connection.auth_type) {
      case 'api_key':
        headers['Authorization'] = `Bearer ${connection.credentials}`;
        break;
      
      case 'jwt':
        headers['Authorization'] = `JWT ${connection.credentials}`;
        break;
      
      case 'oauth2':
        headers['Authorization'] = `OAuth ${connection.credentials}`;
        break;
    }

    return headers;
  }

  private async executeRequests(requests: APIRequest[], connection: FrontendConnection): Promise<void> {
    for (const request of requests) {
      try {
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: JSON.stringify(request.body),
          timeout: 30000 // 30 second timeout
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Update connection last used timestamp
        connection.last_used = new Date().toISOString();
        
        // Log successful execution
        console.log(`Successfully published to ${connection.name} via ${request.method} ${request.url}`);
      } catch (error) {
        this.errors.push({
          timestamp: new Date().toISOString(),
          error: `Failed to execute request to ${connection.name}: ${error.message}`,
          severity: 'high',
          component: 'PublishingExecutionService',
          resolved: false
        });
        
        // Attempt recovery
        await this.attemptRecovery(request, connection, error);
      }
    }
  }

  private async attemptRecovery(request: APIRequest, connection: FrontendConnection, error: any): Promise<void> {
    const recoveryStrategies = [
      () => this.retryWithBackoff(request, connection),
      () => this.retryWithAlternativeAuth(request, connection),
      () => this.retryWithSimplifiedContent(request, connection)
    ];

    for (const strategy of recoveryStrategies) {
      try {
        await strategy();
        console.log(`Recovery successful for ${connection.name}`);
        return;
      } catch (recoveryError) {
        console.log(`Recovery strategy failed for ${connection.name}: ${recoveryError.message}`);
      }
    }

    // If all recovery strategies fail, log the final error
    this.errors.push({
      timestamp: new Date().toISOString(),
      error: `All recovery strategies failed for ${connection.name}: ${error.message}`,
      severity: 'critical',
      component: 'PublishingExecutionService',
      resolved: false
    });
  }

  private async retryWithBackoff(request: APIRequest, connection: FrontendConnection): Promise<void> {
    const delays = [1000, 3000, 5000]; // 1s, 3s, 5s delays
    
    for (const delay of delays) {
      await new Promise(resolve => setTimeout(resolve, delay));
      
      try {
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: JSON.stringify(request.body),
          timeout: 30000
        });

        if (response.ok) {
          return;
        }
      } catch {
        // Continue to next delay
      }
    }
    
    throw new Error('Retry with backoff failed');
  }

  private async retryWithAlternativeAuth(request: APIRequest, connection: FrontendConnection): Promise<void> {
    // Try alternative authentication methods
    const alternativeAuths = [
      { type: 'api_key', header: 'X-API-Key' },
      { type: 'api_key', header: 'Authorization' },
      { type: 'jwt', header: 'Authorization' }
    ];

    for (const auth of alternativeAuths) {
      try {
        const headers = { ...request.headers };
        delete headers.Authorization; // Remove existing auth
        
        if (auth.header === 'Authorization') {
          headers.Authorization = `Bearer ${connection.credentials}`;
        } else {
          headers[auth.header] = connection.credentials;
        }

        const response = await fetch(request.url, {
          method: request.method,
          headers,
          body: JSON.stringify(request.body),
          timeout: 30000
        });

        if (response.ok) {
          return;
        }
      } catch {
        // Continue to next auth method
      }
    }
    
    throw new Error('Alternative authentication failed');
  }

  private async retryWithSimplifiedContent(request: APIRequest, connection: FrontendConnection): Promise<void> {
    // Create a simplified version of the request body
    const simplifiedBody: any = {};
    
    // Only include essential fields
    if (request.body) {
      const essentialFields = ['title', 'body', 'type', 'name', 'description'];
      essentialFields.forEach(field => {
        if (request.body[field]) {
          simplifiedBody[field] = request.body[field];
        }
      });
    }

    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: JSON.stringify(simplifiedBody),
        timeout: 30000
      });

      if (response.ok) {
        return;
      }
    } catch {
      throw new Error('Simplified content retry failed');
    }
  }

  getExecutionHistory(): ProcessingResult[] {
    return this.executionHistory;
  }

  getErrors(): SystemError[] {
    return this.errors;
  }

  clearErrors(): void {
    this.errors = [];
  }

  clearHistory(): void {
    this.executionHistory = [];
  }
}