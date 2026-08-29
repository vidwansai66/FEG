import { sportsClient } from './clients/sportsClient.js';

async function testIntegration() {
  console.log('Testing real integration with Member 3...');
  
  const result = await sportsClient.resolve({
    eventQuery: 'Arsenal',
    marketQuery: 'Match Result',
    selectionQuery: 'Arsenal'
  });

  if (result.ok) {
    console.log('Integration test SUCCESS');
    console.log(`HTTP Status: ${result.status}`);
    console.log(`Resolution Status: ${result.data?.status}`);
  } else {
    console.log('Integration test FAILED');
    console.log(`HTTP Status: ${result.status}`);
    console.log(`Error:`, result.error);
  }
}

testIntegration().catch(console.error);
