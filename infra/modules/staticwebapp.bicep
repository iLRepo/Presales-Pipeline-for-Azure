@description('Static Web App name')
param name string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

resource swa 'Microsoft.Web/staticSites@2024-04-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    buildProperties: {
      appLocation: '/client'
      apiLocation: '/api'
      outputLocation: 'dist'
    }
  }
}

output name string = swa.name
output defaultHostname string = swa.properties.defaultHostname
output id string = swa.id
