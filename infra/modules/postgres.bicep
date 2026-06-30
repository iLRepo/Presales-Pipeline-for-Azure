@description('Server name')
param name string

@description('Azure region')
param location string

@description('Administrator username (Cosmos DB for PostgreSQL always uses citus)')
param adminUser string

@description('Administrator password')
@secure()
param adminPassword string

@description('Resource tags')
param tags object

resource cluster 'Microsoft.DBforPostgreSQL/serverGroupsv2@2023-03-02-preview' = {
  name: name
  location: location
  tags: tags
  properties: {
    postgresqlVersion: '16'
    administratorLoginPassword: adminPassword
    coordinatorVCores: 2
    coordinatorStorageQuotaInMb: 32768
    coordinatorServerEdition: 'BurstableGeneralPurpose'
    coordinatorEnablePublicIpAccess: true
    nodeCount: 0
    enableHa: false
  }
}

resource firewallAzure 'Microsoft.DBforPostgreSQL/serverGroupsv2/firewallRules@2023-03-02-preview' = {
  parent: cluster
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

output serverName string = cluster.name
output fqdn string = cluster.properties.serverNames[0].fullyQualifiedDomainName
output databaseName string = 'citus'
