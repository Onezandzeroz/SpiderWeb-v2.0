import { ProcessedContent, FrontendSchema, TransformationRule, ContentMapping, SystemError } from '../types';

export class ContentTransformationService {
  private errors: SystemError[] = [];
  private transformationRules: Map<string, TransformationRule[]> = new Map();

  constructor() {
    this.initializeDefaultRules();
  }

  async transformContent(
    processedContent: ProcessedContent,
    targetSchema: FrontendSchema
  ): Promise<{ transformedContent: Record<string, any>; mappings: ContentMapping[] }> {
    try {
      const transformedContent: Record<string, any> = {};
      const mappings: ContentMapping[] = [];

      // Find the appropriate content type in the schema
      const contentType = this.findContentType(targetSchema, processedContent.type);
      
      if (!contentType) {
        throw new Error(`No matching content type found for ${processedContent.type}`);
      }

      // Apply transformations for each field
      for (const field of contentType.fields) {
        const transformation = await this.transformField(
          processedContent,
          field.name,
          field.type,
          targetSchema.name
        );

        if (transformation.value !== undefined) {
          transformedContent[field.name] = transformation.value;
          mappings.push(transformation.mapping);
        }
      }

      // Handle media files
      if (processedContent.media.length > 0) {
        const mediaTransformation = await this.transformMedia(processedContent.media, targetSchema);
        if (mediaTransformation.value) {
          transformedContent.media = mediaTransformation.value;
          mappings.push(mediaTransformation.mapping);
        }
      }

      // Apply custom transformations based on frontend
      const customTransformations = this.applyCustomTransformations(
        transformedContent,
        targetSchema.name
      );

      return {
        transformedContent: { ...transformedContent, ...customTransformations },
        mappings
      };
    } catch (error) {
      this.errors.push({
        timestamp: new Date().toISOString(),
        error: `Content transformation failed: ${error.message}`,
        severity: 'high',
        component: 'ContentTransformationService',
        resolved: false
      });
      throw error;
    }
  }

  private findContentType(schema: FrontendSchema, contentType: string): any {
    // Try to find exact match
    let matchedType = schema.content_types.find(ct => ct.name === contentType);
    
    // If no exact match, try to find similar type
    if (!matchedType) {
      const typeMappings: Record<string, string[]> = {
        'article': ['post', 'content', 'blog'],
        'product': ['item', 'listing'],
        'update': ['news', 'announcement'],
        'announcement': ['news', 'update']
      };

      const similarTypes = typeMappings[contentType] || [];
      matchedType = schema.content_types.find(ct => 
        similarTypes.includes(ct.name)
      );
    }

    // If still no match, use the first available content type
    if (!matchedType && schema.content_types.length > 0) {
      matchedType = schema.content_types[0];
    }

    return matchedType;
  }

  private async transformField(
    processedContent: ProcessedContent,
    targetField: string,
    targetType: string,
    frontendName: string
  ): Promise<{ value: any; mapping: ContentMapping }> {
    const sourceField = this.mapSourceField(targetField, processedContent.type);
    const transformations = this.getTransformations(frontendName, sourceField, targetField);
    
    let value = this.extractFieldValue(processedContent, sourceField);
    
    // Apply transformations
    for (const transformation of transformations) {
      value = await this.applyTransformation(value, transformation);
    }

    // Convert to target type
    value = this.convertType(value, targetType);

    return {
      value,
      mapping: {
        email_field: sourceField,
        frontend_field: targetField,
        transformations: transformations.map(t => t.transformation)
      }
    };
  }

  private mapSourceField(targetField: string, contentType: string): string {
    const fieldMappings: Record<string, Record<string, string>> = {
      'article': {
        'title': 'title',
        'body': 'body',
        'content': 'body',
        'description': 'excerpt',
        'summary': 'excerpt',
        'author': 'author',
        'created_at': 'created_at',
        'published_at': 'created_at',
        'tags': 'tags',
        'categories': 'tags'
      },
      'product': {
        'name': 'title',
        'title': 'title',
        'description': 'body',
        'details': 'body',
        'price': 'metadata.price',
        'sku': 'metadata.sku',
        'category': 'metadata.category'
      },
      'update': {
        'title': 'title',
        'message': 'body',
        'content': 'body',
        'date': 'created_at'
      }
    };

    return fieldMappings[contentType]?.[targetField] || targetField;
  }

  private getTransformations(frontendName: string, sourceField: string, targetField: string): TransformationRule[] {
    const key = `${frontendName}:${sourceField}:${targetField}`;
    return this.transformationRules.get(key) || [];
  }

  private extractFieldValue(processedContent: ProcessedContent, fieldPath: string): any {
    if (fieldPath.includes('.')) {
      // Handle nested paths like 'metadata.price'
      const parts = fieldPath.split('.');
      let value = processedContent.content;
      
      for (const part of parts) {
        if (value && typeof value === 'object') {
          value = value[part];
        } else {
          return undefined;
        }
      }
      
      return value;
    } else {
      return processedContent.content[fieldPath];
    }
  }

  private async applyTransformation(value: any, rule: TransformationRule): Promise<any> {
    if (value === undefined || value === null) {
      return value;
    }

    switch (rule.transformation) {
      case 'uppercase':
        return typeof value === 'string' ? value.toUpperCase() : value;
      
      case 'lowercase':
        return typeof value === 'string' ? value.toLowerCase() : value;
      
      case 'capitalize':
        return typeof value === 'string' ? value.charAt(0).toUpperCase() + value.slice(1) : value;
      
      case 'truncate':
        const maxLength = rule.parameters?.maxLength || 100;
        return typeof value === 'string' && value.length > maxLength 
          ? value.substring(0, maxLength) + '...' 
          : value;
      
      case 'strip_html':
        return typeof value === 'string' ? value.replace(/<[^>]*>/g, '') : value;
      
      case 'format_date':
        return this.formatDate(value, rule.parameters?.format || 'ISO');
      
      case 'extract_urls':
        return typeof value === 'string' ? this.extractUrls(value) : value;
      
      case 'sanitize':
        return typeof value === 'string' ? this.sanitizeText(value) : value;
      
      case 'default':
        return value !== undefined ? value : rule.parameters?.defaultValue;
      
      default:
        return value;
    }
  }

  private convertType(value: any, targetType: string): any {
    if (value === undefined || value === null) {
      return value;
    }

    switch (targetType) {
      case 'string':
        return String(value);
      
      case 'number':
        const num = Number(value);
        return isNaN(num) ? 0 : num;
      
      case 'boolean':
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true' || value === '1';
        }
        return Boolean(value);
      
      case 'array':
        if (Array.isArray(value)) {
          return value;
        }
        if (typeof value === 'string') {
          return value.split(',').map(item => item.trim());
        }
        return [value];
      
      case 'object':
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            return { value };
          }
        }
        return typeof value === 'object' ? value : { value };
      
      default:
        return value;
    }
  }

  private async transformMedia(mediaFiles: any[], targetSchema: FrontendSchema): Promise<{ value: any; mapping: ContentMapping }> {
    // Transform media files based on frontend requirements
    const transformedMedia = mediaFiles.map(media => ({
      filename: media.filename,
      content_type: media.content_type,
      data: media.data,
      alt_text: media.metadata?.alt_text || '',
      caption: media.metadata?.caption || '',
      size: media.metadata?.size || 0
    }));

    return {
      value: transformedMedia,
      mapping: {
        email_field: 'attachments',
        frontend_field: 'media',
        transformations: ['extract_metadata', 'format_for_frontend']
      }
    };
  }

  private applyCustomTransformations(content: Record<string, any>, frontendName: string): Record<string, any> {
    const customContent: Record<string, any> = {};

    // Apply frontend-specific custom transformations
    switch (frontendName) {
      case 'main_site':
        customContent.status = 'published';
        customContent.featured = content.metadata?.priority === 'high';
        break;
      
      case 'developer_portal':
        customContent.technical = true;
        customContent.audience = 'developers';
        break;
      
      case 'blog':
        customContent.comments_enabled = true;
        customContent.shareable = true;
        break;
    }

    return customContent;
  }

  private formatDate(dateString: string, format: string): string {
    try {
      const date = new Date(dateString);
      
      switch (format) {
        case 'ISO':
          return date.toISOString();
        
        case 'readable':
          return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        
        case 'timestamp':
          return date.getTime().toString();
        
        default:
          return dateString;
      }
    } catch {
      return dateString;
    }
  }

  private extractUrls(text: string): string[] {
    const urlRegex = /https?:\/\/[^\s]+/g;
    return text.match(urlRegex) || [];
  }

  private sanitizeText(text: string): string {
    return text
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/[^\w\s\.\,\!\?\-\:\;\(\)\[\]\{\}\"\'\/\@\#\$\%\^\&\*\+\=\~\`]/g, '') // Keep safe characters
      .trim();
  }

  private initializeDefaultRules(): void {
    // Add default transformation rules for common scenarios
    const defaultRules: TransformationRule[] = [
      {
        source_field: 'title',
        target_field: 'title',
        transformation: 'sanitize',
        parameters: {}
      },
      {
        source_field: 'body',
        target_field: 'body',
        transformation: 'strip_html',
        parameters: {}
      },
      {
        source_field: 'excerpt',
        target_field: 'excerpt',
        transformation: 'truncate',
        parameters: { maxLength: 200 }
      },
      {
        source_field: 'created_at',
        target_field: 'published_at',
        transformation: 'format_date',
        parameters: { format: 'ISO' }
      }
    ];

    // Add rules for different frontends
    const frontends = ['main_site', 'developer_portal', 'blog'];
    
    frontends.forEach(frontend => {
      defaultRules.forEach(rule => {
        const key = `${frontend}:${rule.source_field}:${rule.target_field}`;
        if (!this.transformationRules.has(key)) {
          this.transformationRules.set(key, [rule]);
        }
      });
    });
  }

  addTransformationRule(frontendName: string, rule: TransformationRule): void {
    const key = `${frontendName}:${rule.source_field}:${rule.target_field}`;
    const existingRules = this.transformationRules.get(key) || [];
    existingRules.push(rule);
    this.transformationRules.set(key, existingRules);
  }

  getErrors(): SystemError[] {
    return this.errors;
  }

  clearErrors(): void {
    this.errors = [];
  }
}