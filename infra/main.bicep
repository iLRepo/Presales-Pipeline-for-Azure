targetScope = 'resourceGroup'

@description('Environment name')
@allowed(['dev', 'prod'])
param environment string

@description('Azure region for resources')
param location string = resourceGroup().location

@description('PostgreSQL admin password')
@secure()
param pgAdminPassword string

@description('PostgreSQL admin username (Cosmos DB for PostgreSQL always uses citus)')
param pgAdminUser string = 'citus'

@description('Entra ID tenant ID for auth')
param entraIdTenantId string

@description('Entra ID client ID for auth')
param entraIdClientId string

var prefix = 'presales-${environment}'
var tags = {
  project: 'PresalesPipelineManager'
  environment: environment
  managedBy: 'bicep'
}

module postgres 'modules/postgres.bicep' = {
  name: 'postgres-${environment}'
  params: {
    name: '${prefix}-pg'
    location: location
    adminUser: pgAdminUser
    adminPassword: pgAdminPassword
    tags: tags
  }
}

module staticWebApp 'modules/staticwebapp.bicep' = {
  name: 'swa-${environment}'
  params: {
    name: '${prefix}-swa'
    location: location
    tags: tags
  }
}

module keyVault 'modules/keyvault.bicep' = {
  name: 'kv-${environment}'
  params: {
    name: replace('${prefix}-kv', '-', '')
    location: location
    tags: tags
    pgHost: postgres.outputs.fqdn
    pgDatabase: postgres.outputs.databaseName
    pgUser: pgAdminUser
    pgPassword: pgAdminPassword
    entraIdTenantId: entraIdTenantId
    entraIdClientId: entraIdClientId
  }
}

module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring-${environment}'
  params: {
    name: '${prefix}-insights'
    location: location
    tags: tags
  }
}

output staticWebAppName string = staticWebApp.outputs.name
output staticWebAppDefaultHostname string = staticWebApp.outputs.defaultHostname
output postgresServerName string = postgres.outputs.serverName
output postgresFqdn string = postgres.outputs.fqdn
output keyVaultName string = keyVault.outputs.name
output appInsightsConnectionString string = monitoring.outputs.connectionString
