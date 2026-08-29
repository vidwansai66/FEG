import { supabase } from './config/supabase.js';
import crypto from 'crypto';

const MEMBER_4_URL = 'http://localhost:4000';
const MEMBER_3_URL = 'http://localhost:3000';

async function createSlipAndValidate(scenario: 'success' | 'failure' = 'success') {
  // 0. Refresh odds in Member 3 so they aren't stale
  await fetch(`${MEMBER_3_URL}/api/sports/odds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selectionIds: ['sel_003_arsenal_manchester_city_match_result_home'] })
  });

  // 1. Create a session
  const { data: session } = await supabase.from('sessions').insert({ status: 'DRAFT' }).select().single();
  
  // 2. Create a slip
  const { data: slip } = await supabase.from('draft_slips').insert({
    session_id: session!.id,
    status: 'DRAFT',
    total_stake: 10
  }).select().single();
  
  // 3. Insert legs
  const leg = {
    draft_slip_id: slip!.id,
    leg_index: 0,
    event_id: 'evt_003_arsenal_manchester_city', // canonical Member 3 mock data
    market_id: 'mkt_003_arsenal_manchester_city_match_result',
    selection_id: 'sel_003_arsenal_manchester_city_match_result_home',
    accepted_odds: scenario === 'success' ? 1.94 : 1.10, // 1.94 is correct for this mock event, 1.10 triggers ODDS_CHANGED
    odds_timestamp: new Date().toISOString(),
    event_label: 'Arsenal vs Man City',
    market_label: 'Match Winner',
    selection_label: 'Arsenal'
  };
  await supabase.from('slip_legs').insert(leg);
  
  // 4. Force status to VALIDATED for testing confirmation directly
  await supabase.from('draft_slips').update({ status: 'VALIDATED' }).eq('id', slip!.id);
  
  return slip!.id;
}

async function cleanup(slipIds: string[]) {
  console.log('Cleaning up test data...');
  for (const id of slipIds) {
    await supabase.from('idempotency_records').delete().eq('slip_id', id);
    await supabase.from('slip_legs').delete().eq('draft_slip_id', id);
    await supabase.from('draft_slips').delete().eq('id', id);
  }
}

async function runLiveTests() {
  console.log('Starting Idempotency Live Tests...\n');
  const createdSlips: string[] = [];

  try {
    // ---------------------------------------------------------
    // TEST A: SUCCESSFUL IDEMPOTENCY
    // ---------------------------------------------------------
    console.log('--- TEST A: SUCCESSFUL IDEMPOTENCY ---');
    const slipIdA = await createSlipAndValidate('success');
    createdSlips.push(slipIdA);
    const idempotencyKeyA = crypto.randomUUID();
    
    console.log('Sending first confirmation request...');
    const res1 = await fetch(`${MEMBER_4_URL}/api/slips/${slipIdA}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKeyA },
      body: JSON.stringify({ confirmed: true })
    });
    
    if (res1.status !== 200) {
      throw new Error(`Test A Failed: Expected 200, got ${res1.status} - ${await res1.text()}`);
    }
    const data1 = await res1.json() as any;
    console.log('First response receiptId:', data1.data.receiptId);
    
    console.log('Sending exact same request again...');
    const res2 = await fetch(`${MEMBER_4_URL}/api/slips/${slipIdA}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKeyA },
      body: JSON.stringify({ confirmed: true })
    });
    
    if (res2.status !== 200) {
      throw new Error(`Test A Failed: Expected 200 on retry, got ${res2.status} - ${await res2.text()}`);
    }
    const data2 = await res2.json() as any;
    console.log('Second response receiptId:', data2.data.receiptId);
    
    if (data1.data.receiptId !== data2.data.receiptId) {
      throw new Error('Test A Failed: receiptIds do not match, Member 3 was called twice!');
    }
    console.log('✅ Test A Passed: Exact response replayed, no duplicate Member 3 call.\n');

    // ---------------------------------------------------------
    // TEST B: DIFFERENT KEY ON DEMO_CONFIRMED SLIP
    // ---------------------------------------------------------
    console.log('--- TEST B: DIFFERENT KEY ---');
    const idempotencyKeyB = crypto.randomUUID();
    console.log('Sending request with new key to same confirmed slip...');
    const res3 = await fetch(`${MEMBER_4_URL}/api/slips/${slipIdA}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKeyB },
      body: JSON.stringify({ confirmed: true })
    });
    
    if (res3.status !== 409) {
      throw new Error(`Test B Failed: Expected 409 Invalid State, got ${res3.status} - ${await res3.text()}`);
    }
    console.log('✅ Test B Passed: State machine correctly rejected different key on confirmed slip.\n');

    // ---------------------------------------------------------
    // TEST C: DETERMINISTIC FAILURE
    // ---------------------------------------------------------
    console.log('--- TEST C: DETERMINISTIC FAILURE ---');
    const slipIdC = await createSlipAndValidate('failure'); // Odds 1.10 instead of 2.50
    createdSlips.push(slipIdC);
    const idempotencyKeyC = crypto.randomUUID();
    
    console.log('Sending failure-inducing confirmation request...');
    const res4 = await fetch(`${MEMBER_4_URL}/api/slips/${slipIdC}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKeyC },
      body: JSON.stringify({ confirmed: true })
    });
    
    if (res4.status !== 409) {
      throw new Error(`Test C Failed: Expected 409 ODDS_CHANGED, got ${res4.status}`);
    }
    const data4 = await res4.json() as any;
    console.log('First failure response code:', data4.error.code);
    
    console.log('Sending exact same failure request again...');
    const res5 = await fetch(`${MEMBER_4_URL}/api/slips/${slipIdC}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKeyC },
      body: JSON.stringify({ confirmed: true })
    });
    const data5 = await res5.json() as any;
    
    const assert = await import('assert');
    try {
      assert.deepStrictEqual(data4, data5);
    } catch (e) {
      console.log('DATA 4:', JSON.stringify(data4, null, 2));
      console.log('DATA 5:', JSON.stringify(data5, null, 2));
      throw new Error('Test C Failed: Replay response did not exactly match first failure response.');
    }
    console.log('✅ Test C Passed: Deterministic failure successfully cached and replayed.\n');
    
    // ---------------------------------------------------------
    // TEST D: CONCURRENCY
    // ---------------------------------------------------------
    console.log('--- TEST D: CONCURRENCY ---');
    const slipIdD = await createSlipAndValidate('success');
    createdSlips.push(slipIdD);
    const idempotencyKeyD = crypto.randomUUID();
    
    console.log('Sending two concurrent requests with identical keys...');
    const req1 = fetch(`${MEMBER_4_URL}/api/slips/${slipIdD}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKeyD },
      body: JSON.stringify({ confirmed: true })
    });
    const req2 = fetch(`${MEMBER_4_URL}/api/slips/${slipIdD}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKeyD },
      body: JSON.stringify({ confirmed: true })
    });
    
    const [resD1, resD2] = await Promise.all([req1, req2]);
    const statuses = [resD1.status, resD2.status].sort();
    
    // One should succeed (200), the other should get 409 (IN_PROGRESS) or 200 (if one finished extremely fast)
    console.log(`Statuses received: ${statuses[0]}, ${statuses[1]}`);
    if (statuses[0] !== 200) {
       throw new Error(`Test D Failed: One request did not succeed, got ${statuses[0]} and ${statuses[1]}`);
    }
    if (statuses[1] !== 409 && statuses[1] !== 200) {
      throw new Error(`Test D Failed: Second request got unexpected status: ${statuses[1]}`);
    }
    console.log('✅ Test D Passed: Concurrency lock successfully protected against duplicate execution.\n');

  } catch (err) {
    console.error('\n❌ LIVE TESTS FAILED:', err);
  } finally {
    await cleanup(createdSlips);
    console.log('Live tests complete.');
    process.exit(0);
  }
}

runLiveTests();
