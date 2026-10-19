'use strict';
// Design arithmetic only. Does not call the API, alter rules, or predict win rates.
const fs=require('node:fs'),path=require('node:path');
const rules={name:'skill-economy-draft-v1',status:'design-candidate-not-enabled',chasingSeconds:360,startCredits:20,creditEverySeconds:30,creditPerTick:5,activationCap:3,cooldownAfterEffectSeconds:45,incrementalTierPrices:[10,15,20],tierTotalPrices:[10,25,45],catBaselineClueRangeM:120,eagleRangeM:[180,240,300],eagleDurationSeconds:15,invisibleDurationSeconds:[15,25,35],goldenCandidateDurationSeconds:[10,16,20],goldenCandidateStartupSeconds:3,goldenEnabled:false};
function income(t){return rules.startCredits+rules.creditPerTick*Math.floor(Math.min(t,rules.chasingSeconds-1)/rules.creditEverySeconds);}
function earliest(cost){for(let t=0;t<rules.chasingSeconds;t++)if(income(t)>=cost)return t;return null;}
// All activations paid at their chosen tier before activation. Incremental
// mid-effect upgrades may have different timings; this is a declared model variant.
function optimise(durations,objective){
 const memo=new Map(),end=rules.chasingSeconds;
 const score=(t,d)=>objective==='hidden-seconds'?Math.min(d,end-t):Array.from({length:11},(_,i)=>(i+1)*30).filter(at=>at>t&&at<t+d).length;
 function solve(t,spent,used){
  if(t>=end||used===rules.activationCap)return {score:0,buys:[]};
  const key=[t,spent,used].join(':');if(memo.has(key))return memo.get(key);
  let best=solve(t+1,spent,used);
  for(let tier=0;tier<3;tier++){
   const cost=rules.tierTotalPrices[tier];if(spent+cost>income(t))continue;
   const d=durations[tier],next=solve(t+d+rules.cooldownAfterEffectSeconds,spent+cost,used+1),value=score(t,d)+next.score;
   if(value>best.score)best={score:value,buys:[{at:t,tier:tier+1,cost,effectSeconds:Math.min(d,end-t)},...next.buys]};
  }
  memo.set(key,best);return best;
 }
 return solve(0,0,0);
}
const compositions=[];
function mix(tiers=[]){if(tiers.length){const cost=tiers.reduce((n,t)=>n+rules.tierTotalPrices[t-1],0);if(cost<=income(359))compositions.push({tiers,cost,untruncatedInvisibleSeconds:tiers.reduce((n,t)=>n+rules.invisibleDurationSeconds[t-1],0)});}if(tiers.length<3)for(let i=1;i<=3;i++)mix([...tiers,i]);}mix();
const result={rules,assumptions:['8 people, 2 cats, 6 mice; 200m-radius candidate venue; baseline match lasts 6 chasing minutes','Participant remains uncaptured through the model horizon; no income at deadline; hiding/paused time excluded','No capture bonus, income transfers, objective rewards or currency carried to next match','Three activations maximum, cooldown begins after each effect; tier prices incremental 10/15/20, prepaid totals 10/25/45','Normal clue refreshes modelled at match-relative 30,60,...330 seconds; actual current server uses wall-clock buckets and would need changing','Only deterministic affordability, bounds and toy schedules; no runner speed, routes, GPS, network, cooperation, reaction time or human data','No win-rate inference; skill rules not installed in current service'],incomeTimeline:Array.from({length:12},(_,i)=>({chasingSecond:i*30,cumulativeCredits:income(i*30)})),earliestSingleActivationTier:rules.tierTotalPrices.map((price,i)=>({tier:i+1,totalPrice:price,earliestSecond:earliest(price)})),legacyCounterexamples:{goldenTwoPurchasesSeconds:180*2,chasingSeconds:360,legacyEagleThreeStackRadiusFactor:1.5**3,legacyEagleThreeStackAreaFactor:(1.5**3)**2},candidateEagleAreaFactors:rules.eagleRangeM.map(r=>(r/rules.catBaselineClueRangeM)**2),fullSurvivalCredits:income(359),affordableTierCompositions:compositions,hiddenTimeSchedule:optimise(rules.invisibleDurationSeconds,'hidden-seconds'),normalClueSuppressionSchedule:optimise(rules.invisibleDurationSeconds,'normal-refreshes'),mouseHiddenTimeUpperBoundFromBudget:Math.max(...compositions.map(c=>c.untruncatedInvisibleSeconds)),eagleDisplayTimeUpperBoundSeconds:rules.activationCap*rules.eagleDurationSeconds};
const target=path.join(__dirname,'arithmetic-results.json');fs.writeFileSync(target,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({fullSurvivalCredits:result.fullSurvivalCredits,earliestTiers:result.earliestSingleActivationTier,maxHiddenTimeSchedule:result.hiddenTimeSchedule,maxNormalClueSuppression:result.normalClueSuppressionSchedule,eagleDisplayTimeUpperBoundSeconds:result.eagleDisplayTimeUpperBoundSeconds,legacyCounterexamples:result.legacyCounterexamples}));
