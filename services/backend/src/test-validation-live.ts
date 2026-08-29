import { slipService } from './services/slipService.js';
import { slipValidationService } from './services/slipValidationService.js';

async function runLiveTest() {
  console.log('Starting Live Validation Test...');
  let slipId: string | null = null;
  let sessionId: string | null = null;
  let staleSlipId: string | null = null;

  try {
    console.log('1. Creating DRAFT slip...');
    const created = await slipService.createSlip({
      stake: 100,
      legs: [
        {
          eventId: 'evt_003_arsenal_manchester_city',
          marketId: 'mkt_003_arsenal_manchester_city_match_result',
          selectionId: 'sel_003_arsenal_manchester_city_match_result_home',
          acceptedOdds: 1.94,
          oddsTimestamp: new Date().toISOString(),
          eventLabel: 'Arsenal vs Manchester City',
          marketLabel: 'Match Result',
          selectionLabel: 'Arsenal'
        },
        {
          eventId: 'evt_004_manchester_united_newcastle',
          marketId: 'mkt_004_manchester_united_newcastle_match_result',
          selectionId: 'sel_004_manchester_united_newcastle_match_result_home',
          acceptedOdds: 4.00,
          oddsTimestamp: new Date().toISOString(),
          eventLabel: 'Manchester Utd vs Newcastle',
          marketLabel: 'Match Result',
          selectionLabel: 'Manchester Utd'
        }
      ]
    });
    slipId = created.id;
    sessionId = created.sessionId;
    console.log(`-> Created slip ${slipId} for session ${sessionId}`);

    if (!slipId) throw new Error('Slip creation failed');

    console.log('2. Running validation...');
    const result = await slipValidationService.validateSlip(slipId);
    
    console.log('-> Validation Result:');
    console.log(JSON.stringify(result, null, 2));

    if (result.status === 'VALIDATED') {
      console.log(`-> SUCCESS! totalOdds calculated as: ${result.totalOdds}`);
    } else {
      console.log(`-> FAILED VALIDATION! status: ${result.status}`);
    }

    // Force failure test by updating acceptedOdds to be wrong (stale odds)
    console.log('3. Running stale odds validation test...');
    const staleSlip = await slipService.createSlip({
      stake: 100,
      legs: [
        {
          eventId: 'evt_003_arsenal_manchester_city',
          marketId: 'mkt_003_arsenal_manchester_city_match_result',
          selectionId: 'sel_003_arsenal_manchester_city_match_result_home',
          acceptedOdds: 9.99, // WRONG ODDS
          oddsTimestamp: new Date().toISOString(),
          eventLabel: 'Arsenal vs Chelsea',
          marketLabel: 'Match Result',
          selectionLabel: 'Arsenal'
        }
      ]
    });
    staleSlipId = staleSlip.id;
    
    const staleResult = await slipValidationService.validateSlip(staleSlipId as string);
    console.log('-> Stale Validation Result:');
    console.log(JSON.stringify(staleResult, null, 2));

  } catch (error: any) {
    console.error('Test threw an error:', error.message || error);
  } finally {
    console.log('4. Cleaning up test data...');
    try {
      const { supabase } = await import('./config/supabase.js');
      // Delete slip bypassing slipService constraint if it ended in VALIDATED/INVALID
      if (slipId) await supabase.from('draft_slips').delete().eq('id', slipId);
      if (staleSlipId) await supabase.from('draft_slips').delete().eq('id', staleSlipId as string);
      console.log('-> Cleanup done.');
    } catch (e) {
      console.error('Cleanup failed', e);
    }
    process.exit(0);
  }
}

runLiveTest();
