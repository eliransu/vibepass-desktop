import { createSecretsClient } from '../../aws/secretsManager'
  
describe('aws client wiring', () => {
  test('createSecretsClient returns a client for region', () => {
    const client = createSecretsClient('us-east-1')
    // minimal structural assertion to avoid hitting network
    expect(typeof (client as any).send).toBe('function')
  })
})


