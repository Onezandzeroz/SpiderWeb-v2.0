'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  errors: any[];
  stats: {
    total: number;
    resolved: number;
    unresolved: number;
    byComponent: Record<string, any>;
    bySeverity: Record<string, number>;
  };
}

interface SystemStatus {
  framework: {
    name: string;
    version: string;
    status: string;
    uptime: number;
    start_time: string;
  };
  performance: {
    memory_usage: any;
    cpu_usage: any;
    platform: string;
    arch: string;
    node_version: string;
  };
  processing: {
    total_processed: number;
    success_rate: number;
    error_count: number;
    recent_errors: any[];
  };
  health: {
    overall: string;
    components: Record<string, any>;
  };
  metrics: {
    requests_today: number;
    requests_this_hour: number;
    average_response_time: number;
    last_activity: string;
  };
}

interface Connection {
  name: string;
  api_endpoint: string;
  auth_type: string;
  is_active: boolean;
  last_used?: string;
}

export default function Dashboard() {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      const [healthResponse, statusResponse, connectionsResponse] = await Promise.all([
        fetch('/api/framework/health'),
        fetch('/api/framework/status'),
        fetch('/api/framework/connections')
      ]);

      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        setSystemHealth(healthData);
      }

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        setSystemStatus(statusData);
      }

      if (connectionsResponse.ok) {
        const connectionsData = await connectionsResponse.json();
        setConnections(connectionsData.connections || []);
      }

      setError(null);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard loading error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-yellow-500';
      case 'unhealthy':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low':
        return 'bg-blue-100 text-blue-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatUptime = (uptime: number) => {
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const formatMemory = (bytes: number) => {
    return `${Math.round(bytes / 1024 / 1024)}MB`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96 mt-2" />
            </div>
            <Skeleton className="h-10 w-24" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-2 w-full" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <Alert>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={loadDashboardData} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Framework Dashboard</h1>
            <p className="text-muted-foreground">
              Monitor and manage your LLM-controlled headless backend framework
            </p>
          </div>
          <Button onClick={loadDashboardData} variant="outline">
            Refresh
          </Button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Status</CardTitle>
              <div className={`h-3 w-3 rounded-full ${getStatusColor(systemHealth?.status || 'unknown')}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold capitalize">{systemHealth?.status || 'Unknown'}</div>
              <p className="text-xs text-muted-foreground">
                {systemStatus?.framework.uptime ? formatUptime(systemStatus.framework.uptime) : 'Loading...'} uptime
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Processed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{systemStatus?.processing.total_processed || 0}</div>
              <p className="text-xs text-muted-foreground">
                {systemStatus?.processing.success_rate || 0}% success rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{connections.filter(c => c.is_active).length}</div>
              <p className="text-xs text-muted-foreground">
                {connections.length} total connections
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unresolved Errors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{systemHealth?.stats.unresolved || 0}</div>
              <p className="text-xs text-muted-foreground">
                {systemHealth?.stats.total || 0} total errors
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="connections">Connections</TabsTrigger>
            <TabsTrigger value="errors">Errors</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Component Health */}
              <Card>
                <CardHeader>
                  <CardTitle>Component Health</CardTitle>
                  <CardDescription>Status of framework components</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {systemStatus?.health.components && Object.entries(systemStatus.health.components).map(([component, health]: [string, any]) => (
                    <div key={component} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`h-2 w-2 rounded-full ${getStatusColor(health.status)}`} />
                        <span className="text-sm font-medium capitalize">
                          {component.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={health.status === 'healthy' ? 'default' : 'destructive'}>
                          {health.error_count} errors
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest system events</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {systemStatus?.processing.recent_errors?.slice(0, 5).map((error, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className={`h-2 w-2 rounded-full mt-2 ${getStatusColor('unhealthy')}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium truncate">{error.component}</p>
                          <Badge className={getSeverityColor(error.severity)}>
                            {error.severity}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {error.error}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(error.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(!systemStatus?.processing.recent_errors || systemStatus.processing.recent_errors.length === 0) && (
                    <p className="text-sm text-muted-foreground">No recent activity</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="connections" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Frontend Connections</CardTitle>
                <CardDescription>Manage connections to frontend systems</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {connections.map((connection) => (
                    <div key={connection.name} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`h-3 w-3 rounded-full ${connection.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <div>
                          <h3 className="font-medium">{connection.name}</h3>
                          <p className="text-sm text-muted-foreground">{connection.api_endpoint}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={connection.is_active ? 'default' : 'secondary'}>
                          {connection.auth_type}
                        </Badge>
                        {connection.last_used && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(connection.last_used).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {connections.length === 0 && (
                    <p className="text-sm text-muted-foreground">No connections configured</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="errors" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Error Log</CardTitle>
                <CardDescription>System errors and issues</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {systemHealth?.errors?.slice(0, 10).map((error, index) => (
                    <div key={index} className="flex items-start space-x-3 p-4 border rounded-lg">
                      <div className={`h-2 w-2 rounded-full mt-2 ${getStatusColor('unhealthy')}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium">{error.component}</h3>
                          <div className="flex items-center space-x-2">
                            <Badge className={getSeverityColor(error.severity)}>
                              {error.severity}
                            </Badge>
                            <Badge variant={error.resolved ? 'default' : 'destructive'}>
                              {error.resolved ? 'Resolved' : 'Unresolved'}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {error.error}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(error.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(!systemHealth?.errors || systemHealth.errors.length === 0) && (
                    <p className="text-sm text-muted-foreground">No errors reported</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Memory Usage */}
              <Card>
                <CardHeader>
                  <CardTitle>Memory Usage</CardTitle>
                  <CardDescription>Current memory consumption</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {systemStatus?.performance.memory_usage && (
                    <>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Heap Used</span>
                          <span>{formatMemory(systemStatus.performance.memory_usage.heapUsed)}</span>
                        </div>
                        <Progress 
                          value={(systemStatus.performance.memory_usage.heapUsed / systemStatus.performance.memory_usage.heapTotal) * 100} 
                          className="h-2" 
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>External</span>
                          <span>{formatMemory(systemStatus.performance.memory_usage.external)}</span>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* System Information */}
              <Card>
                <CardHeader>
                  <CardTitle>System Information</CardTitle>
                  <CardDescription>Runtime environment details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {systemStatus?.performance && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>Platform</span>
                        <span>{systemStatus.performance.platform}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Architecture</span>
                        <span>{systemStatus.performance.arch}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Node Version</span>
                        <span>{systemStatus.performance.node_version}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Framework Version</span>
                        <span>{systemStatus.framework.version}</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}