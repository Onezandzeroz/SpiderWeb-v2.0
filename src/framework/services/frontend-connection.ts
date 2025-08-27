import { FrontendConnection, FrontendSchema, SystemError, ApiEndpoint } from '../types';

export class FrontendConnectionService {
  private connections: Map<string, FrontendConnection> = new Map();
  private schemas: Map<string, FrontendSchema> = new Map();
  private errors: SystemError[] = [];

  async manageConnection(connection: FrontendConnection): Promise<boolean> {
    try {
      // Validate connection
      if (!this.validateConnection(connection)) {
        return false;
      }

      // Test connection
      const isConnected = await this.testConnection(connection);
      
      if (isConnected) {
        // Discover API schema
        const schema = await this.discoverAPISchema(connection);
        
        // Store connection and schema
        this.connections.set(connection.name, connection);
        this.schemas.set(connection.name, schema);
        
        // Update last used timestamp
        connection.last_used = new Date().toISOString();
        connection.is_active = true;
        
        return true;
      }
      
      return false;
    } catch (error) {
      this.errors.push({
        timestamp: new Date().toISOString(),
        error: `Connection management failed for ${connection.name}: ${error.message}`,
        severity: 'high',
        component: 'FrontendConnectionService',
        resolved: false
      });
      return false;
    }
  }

  private validateConnection(connection: FrontendConnection): boolean {
    const required = ['name', 'api_endpoint', 'auth_type', 'credentials'];
    
    for (const field of required) {
      if (!connection[field]) {
        this.errors.push({
          timestamp: new Date().toISOString(),
          error: `Missing required field: ${field}`,
          severity: 'high',
          component: 'FrontendConnectionService',
          resolved: false
        });
        return false;
      }
    }

    // Validate auth type
    const validAuthTypes = ['oauth2', 'api_key', 'jwt'];
    if (!validAuthTypes.includes(connection.auth_type)) {
      this.errors.push({
        timestamp: new Date().toISOString(),
        error: `Invalid auth type: ${connection.auth_type}`,
        severity: 'high',
        component: 'FrontendConnectionService',
        resolved: false
      });
      return false;
    }

    // Validate API endpoint URL
    try {
      new URL(connection.api_endpoint);
    } catch {
      this.errors.push({
        timestamp: new Date().toISOString(),
        error: `Invalid API endpoint URL: ${connection.api_endpoint}`,
        severity: 'high',
        component: 'FrontendConnectionService',
        resolved: false
      });
      return false;
    }

    return true;
  }

  private async testConnection(connection: FrontendConnection): Promise<boolean> {
    try {
      // Create authentication headers
      const headers = await this.createAuthHeaders(connection);
      
      // Test with a simple GET request to the API endpoint
      const response = await fetch(connection.api_endpoint, {
        method: 'GET',
        headers,
        timeout: 10000 // 10 second timeout
      });

      return response.ok;
    } catch (error) {
      this.errors.push({
        timestamp: new Date().toISOString(),
        error: `Connection test failed for ${connection.name}: ${error.message}`,
        severity: 'medium',
        component: 'FrontendConnectionService',
        resolved: false
      });
      return false;
    }
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
        // In a real implementation, this would handle OAuth2 token exchange
        headers['Authorization'] = `OAuth ${connection.credentials}`;
        break;
    }

    return headers;
  }

  private async discoverAPISchema(connection: FrontendConnection): Promise<FrontendSchema> {
    try {
      // Try to fetch OpenAPI spec if provided as URL
      if (connection.api_schema.startsWith('http')) {
        return await this.fetchOpenAPISchema(connection.api_schema);
      }
      
      // Parse OpenAPI spec if provided as string
      if (connection.api_schema.startsWith('{')) {
        return this.parseOpenAPISchema(connection.api_schema);
      }
      
      // Fallback: discover schema by probing common endpoints
      return await this.discoverSchemaByProbing(connection);
    } catch (error) {
      this.errors.push({
        timestamp: new Date().toISOString(),
        error: `Schema discovery failed for ${connection.name}: ${error.message}`,
        severity: 'medium',
        component: 'FrontendConnectionService',
        resolved: false
      });
      
      // Return default schema
      return this.createDefaultSchema(connection.name);
    }
  }

  private async fetchOpenAPISchema(schemaUrl: string): Promise<FrontendSchema> {
    const response = await fetch(schemaUrl);
    const openApiSpec = await response.json();
    return this.parseOpenAPISchema(JSON.stringify(openApiSpec));
  }

  private parseOpenAPISchema(openApiSpec: string): FrontendSchema {
    try {
      const spec = JSON.parse(openApiSpec);
      
      const endpoints: ApiEndpoint[] = [];
      
      // Parse OpenAPI 3.0 spec
      if (spec.paths) {
        Object.entries(spec.paths).forEach(([path, methods]: [string, any]) => {
          Object.entries(methods).forEach(([method, operation]: [string, any]) => {
            if (method !== 'parameters') {
              const endpoint = {
                path,
                method: method.toUpperCase(),
                description: operation.summary || operation.description || `${method.toUpperCase()} ${path}`,
                parameters: this.parseParameters(operation.parameters || []),
                request_body: operation.requestBody ? this.parseSchema(operation.requestBody.schema) : undefined,
                responses: this.parseResponses(operation.responses || {})
              };
              endpoints.push(endpoint);
            }
          });
        });
      }

      return {
        name: spec.info?.title || 'Unknown API',
        version: spec.info?.version || '1.0.0',
        endpoints,
        content_types: this.extractContentTypes(endpoints)
      };
    } catch (error) {
      throw new Error(`Failed to parse OpenAPI spec: ${error.message}`);
    }
  }

  private parseParameters(parameters: any[]): any[] {
    return parameters.map(param => ({
      name: param.name,
      in: param.in,
      required: param.required || false,
      type: param.schema?.type || 'string',
      description: param.description
    }));
  }

  private parseSchema(schema: any): any {
    if (!schema) return null;
    
    return {
      type: schema.type || 'object',
      properties: schema.properties || {},
      required: schema.required || []
    };
  }

  private parseResponses(responses: Record<string, any>): Record<string, any> {
    const parsedResponses: Record<string, any> = {};
    
    Object.entries(responses).forEach(([statusCode, response]: [string, any]) => {
      if (response.content && response.content['application/json']) {
        parsedResponses[statusCode] = this.parseSchema(response.content['application/json'].schema);
      } else {
        parsedResponses[statusCode] = { type: 'string' };
      }
    });
    
    return parsedResponses;
  }

  private extractContentTypes(endpoints: ApiEndpoint[]): any[] {
    // Extract common content types from endpoints
    const contentTypes = [];
    
    // Look for common patterns in endpoints
    const hasPosts = endpoints.some(e => e.method === 'POST');
    const hasArticles = endpoints.some(e => e.path.includes('article') || e.path.includes('post'));
    const hasProducts = endpoints.some(e => e.path.includes('product'));
    
    if (hasArticles) {
      contentTypes.push({
        name: 'article',
        fields: [
          { name: 'title', type: 'string', required: true },
          { name: 'body', type: 'string', required: true },
          { name: 'author', type: 'string', required: false },
          { name: 'published_at', type: 'string', required: false }
        ],
        validations: []
      });
    }
    
    if (hasProducts) {
      contentTypes.push({
        name: 'product',
        fields: [
          { name: 'name', type: 'string', required: true },
          { name: 'description', type: 'string', required: true },
          { name: 'price', type: 'number', required: true },
          { name: 'sku', type: 'string', required: false }
        ],
        validations: []
      });
    }
    
    return contentTypes;
  }

  private async discoverSchemaByProbing(connection: FrontendConnection): Promise<FrontendSchema> {
    const headers = await this.createAuthHeaders(connection);
    const baseUrl = connection.api_endpoint.replace(/\/$/, '');
    
    const endpoints: ApiEndpoint[] = [];
    
    // Probe common endpoints
    const commonEndpoints = [
      '/api/articles',
      '/api/posts',
      '/api/products',
      '/api/content',
      '/api/items'
    ];
    
    for (const endpoint of commonEndpoints) {
      try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'GET',
          headers,
          timeout: 5000
        });
        
        if (response.ok) {
          endpoints.push({
            path: endpoint,
            method: 'GET',
            description: `Get ${endpoint.split('/').pop()}`,
            parameters: [],
            responses: {
              '200': { type: 'array' }
            }
          });
          
          // Also add POST endpoint
          endpoints.push({
            path: endpoint,
            method: 'POST',
            description: `Create ${endpoint.split('/').pop()}`,
            parameters: [],
            responses: {
              '201': { type: 'object' }
            }
          });
        }
      } catch {
        // Skip failed endpoints
      }
    }
    
    return {
      name: connection.name,
      version: '1.0.0',
      endpoints,
      content_types: this.extractContentTypes(endpoints)
    };
  }

  private createDefaultSchema(name: string): FrontendSchema {
    return {
      name,
      version: '1.0.0',
      endpoints: [
        {
          path: '/api/content',
          method: 'POST',
          description: 'Create content',
          parameters: [],
          request_body: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              body: { type: 'string' },
              type: { type: 'string' }
            },
            required: ['title', 'body']
          },
          responses: {
            '201': { type: 'object' }
          }
        }
      ],
      content_types: [
        {
          name: 'content',
          fields: [
            { name: 'title', type: 'string', required: true },
            { name: 'body', type: 'string', required: true },
            { name: 'type', type: 'string', required: false }
          ],
          validations: []
        }
      ]
    };
  }

  getConnection(name: string): FrontendConnection | undefined {
    return this.connections.get(name);
  }

  getSchema(name: string): FrontendSchema | undefined {
    return this.schemas.get(name);
  }

  getActiveConnections(): FrontendConnection[] {
    return Array.from(this.connections.values()).filter(conn => conn.is_active);
  }

  async refreshConnection(name: string): Promise<boolean> {
    const connection = this.connections.get(name);
    if (!connection) {
      this.errors.push({
        timestamp: new Date().toISOString(),
        error: `Connection ${name} not found`,
        severity: 'medium',
        component: 'FrontendConnectionService',
        resolved: false
      });
      return false;
    }

    return await this.manageConnection(connection);
  }

  removeConnection(name: string): boolean {
    const deleted = this.connections.delete(name);
    this.schemas.delete(name);
    return deleted;
  }

  getErrors(): SystemError[] {
    return this.errors;
  }

  clearErrors(): void {
    this.errors = [];
  }
}