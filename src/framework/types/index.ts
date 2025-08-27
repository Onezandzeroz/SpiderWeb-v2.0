// Core types for the LLM-controlled headless backend framework

export interface EmailData {
  subject: string;
  body: string;
  attachments: string[]; // base64 encoded files
  sender: string;
  timestamp: string; // ISO 8601
}

export interface FrontendConnection {
  name: string;
  api_endpoint: string;
  auth_type: 'oauth2' | 'api_key' | 'jwt';
  credentials: string; // encrypted credentials
  api_schema: string; // openapi spec or URL
  is_active: boolean;
  last_used?: string;
}

export interface UserContext {
  id: string;
  permissions: string[];
  preferences: Record<string, any>;
}

export interface SystemState {
  active_connections: string[];
  recent_errors: SystemError[];
  total_processed: number;
  success_rate: number;
}

export interface SystemError {
  timestamp: string;
  error: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  resolved: boolean;
}

export interface FrameworkInput {
  email: EmailData;
  frontend_connections: FrontendConnection[];
  user_context: UserContext;
  system_state: SystemState;
}

export interface ContentMapping {
  email_field: string;
  frontend_field: string;
  transformations: string[];
}

export interface FrameworkAction {
  type: 'connect' | 'transform' | 'publish' | 'notify' | 'error';
  target: string;
  parameters: Record<string, any>;
  priority: 'high' | 'medium' | 'low';
  dependencies: string[];
  id: string;
}

export interface FrameworkOutput {
  actions: FrameworkAction[];
  content_mapping: ContentMapping[];
  status: {
    overall: 'success' | 'partial_success' | 'failure';
    details: string;
  };
  errors: SystemError[];
  next_steps: NextStep[];
}

export interface NextStep {
  action: string;
  trigger: string;
}

export interface ProcessedContent {
  type: 'article' | 'product' | 'update' | 'announcement' | 'other';
  intent: 'immediate' | 'scheduled' | 'draft';
  target_frontends: string[];
  content: Record<string, any>;
  media: MediaFile[];
}

export interface MediaFile {
  filename: string;
  content_type: string;
  data: string; // base64
  metadata: {
    alt_text?: string;
    caption?: string;
    size?: number;
    dimensions?: { width: number; height: number };
  };
}

export interface APIRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers: Record<string, string>;
  body?: any;
  auth: {
    type: 'oauth2' | 'api_key' | 'jwt';
    credentials: string;
  };
}

export interface TransformationRule {
  source_field: string;
  target_field: string;
  transformation: string;
  parameters?: Record<string, any>;
}

export interface FrontendSchema {
  name: string;
  version: string;
  endpoints: ApiEndpoint[];
  content_types: ContentType[];
}

export interface ApiEndpoint {
  path: string;
  method: string;
  description: string;
  parameters: Parameter[];
  request_body?: Schema;
  responses: Record<string, Schema>;
}

export interface Parameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'body';
  required: boolean;
  type: string;
  description?: string;
}

export interface Schema {
  type: string;
  properties: Record<string, Property>;
  required?: string[];
}

export interface Property {
  type: string;
  description?: string;
  format?: string;
  enum?: any[];
  items?: Property;
  properties?: Record<string, Property>;
}

export interface ContentType {
  name: string;
  fields: Field[];
  validations: Validation[];
}

export interface Field {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  constraints?: Record<string, any>;
}

export interface Validation {
  field: string;
  rule: string;
  message: string;
}

export interface ProcessingResult {
  success: boolean;
  processed_content: ProcessedContent;
  api_requests: APIRequest[];
  errors: SystemError[];
  execution_time: number;
}