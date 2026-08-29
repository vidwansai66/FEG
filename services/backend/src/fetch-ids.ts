async function run() {
  const eId = 'evt_003_arsenal_manchester_city';
  const mId = 'mkt_003_arsenal_manchester_city_match_result';
  const sId = 'sel_003_arsenal_manchester_city_match_result_home';
  
  const oddsRes = await fetch('http://localhost:3000/api/sports/odds', {
    method: 'POST',
    body: JSON.stringify({ selectionIds: [sId] }),
    headers: { 'Content-Type': 'application/json' }
  });
  const oddsData = await oddsRes.json();
  
  if (oddsData.status !== 'ok') {
    throw new Error(`Failed to fetch odds: ${JSON.stringify(oddsData)}`);
  }
  
  const odds = oddsData.odds[0].decimalOdds;
  const timestamp = oddsData.odds[0].timestamp;
  
  console.log(JSON.stringify({ event_id: eId, market_id: mId, selection_id: sId, accepted_odds: odds, odds_timestamp: timestamp }, null, 2));
}
run();
