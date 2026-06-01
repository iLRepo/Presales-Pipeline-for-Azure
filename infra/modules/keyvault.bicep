@description('Key Vault name (alphanumeric, 3-24 chars)')
param name string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('PostgreSQL host FQDN')
param pgHost string

@description('PostgreSQL database name')
param pgDatabase string

@description('PostgreSQL admin username')
param pgUser string

@description('PostgreSQL admin password')
@secure()
param pgPassword string

@description('Entra ID tenant ID')
param entraIdTenantId string

@description('Entra ID client ID')
param entraIdClientId string

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
  }
}

resource pgHostSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'PGHOST'
  properties: { value: pgHost }
}

resource pgDbSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'PGDATABASE'
  properties: { value: pgDatabase }
}

resource pgUserSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'PGUSER'
  properties: { value: pgUser }
}

resource pgPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'PGPASSWORD'
  properties: { value: pgPassword }
}

resource tenantIdSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'AZURE-TENANT-ID'
  properties: { value: entraIdTenantId }
}

resource clientIdSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'AZURE-CLIENT-ID'
  properties: { value: entraIdClientId }
}

output name string = vault.name
output uri string = vault.properties.vaultUri
