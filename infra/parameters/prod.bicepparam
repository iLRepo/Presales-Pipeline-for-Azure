using '../main.bicep'

param environment = 'prod'
param location = 'eastus2'
param pgAdminUser = 'pgadmin'
param pgAdminPassword = readEnvironmentVariable('PG_ADMIN_PASSWORD', '')
param entraIdTenantId = readEnvironmentVariable('AZURE_TENANT_ID', '')
param entraIdClientId = readEnvironmentVariable('AZURE_CLIENT_ID', '')
