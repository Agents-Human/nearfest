mod rooms;
use near_sdk::{env, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseResult};
use near_sdk::collections::{LookupMap, Vector};
use near_sdk::json_types::U128;

const UNIT: u128 = 1_000_000_000_000_000_000_000_000;
const STORAGE: u128 = 30_000_000_000_000_000_000_000;
const WINDOW: u64 = 48 * 60 * 60 * 1000;
const REVIEW: u64 = 15 * 60 * 1000;
fn now() -> u64 { env::block_timestamp_ms() }
fn active(s: &str) -> bool { matches!(s, "matched" | "disputed" | "proposed") }
fn outcome_ok(s: &str) { require!(matches!(s, "creator" | "opponent" | "draw"), "Invalid outcome"); }

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Bet {
 pub id: u64, pub request_id: String, pub creator: AccountId, pub opponent: Option<AccountId>,
 pub invitee: Option<AccountId>, pub referee: Option<AccountId>, pub title: String, pub rules: String,
 pub category: String, pub side_a: String, pub side_b: String, pub resolver: String,
 pub resolver_config: String, pub stake: U128, pub join_before: u64, pub ends_at: u64,
 pub resolve_until: u64, pub created_at: u64, pub status: String,
 pub creator_vote: Option<String>, pub opponent_vote: Option<String>, pub outcome: Option<String>,
 pub proposed_outcome: Option<String>, pub challenge_until: Option<u64>, pub evidence_hash: Option<String>,
}
#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct SlotVend { bets: Vector<Bet>, credits: LookupMap<AccountId, u128>, pending: LookupMap<AccountId, u128>, requests: LookupMap<String, u64>, oracle: AccountId, rooms: LookupMap<String, rooms::Room>, funding_receipts: LookupMap<String,bool> }

#[near]
impl SlotVend {
 #[init]
 pub fn new(oracle: AccountId) -> Self { Self { bets: Vector::new(b"b"), credits: LookupMap::new(b"c"), pending: LookupMap::new(b"p"), requests: LookupMap::new(b"r"), rooms: LookupMap::new(b"g"), funding_receipts: LookupMap::new(b"f"), oracle } }
 pub fn get_config(&self) -> near_sdk::serde_json::Value { near_sdk::serde_json::json!({"oracle":self.oracle,"storage_fee":STORAGE.to_string(),"room_storage_fee":"100000000000000000000000","version":2,"review_ms":REVIEW,"resolution_ms":WINDOW,"network":"testnet"}) }
 pub fn get_bet(&self, id: u64) -> Option<Bet> { self.bets.get(id) }
 pub fn get_bets(&self, from: Option<u64>, limit: Option<u64>) -> Vec<Bet> {
  let end = self.bets.len().saturating_sub(from.unwrap_or(0));
  (end.saturating_sub(limit.unwrap_or(100).min(100))..end).rev().filter_map(|i|self.bets.get(i)).collect()
 }
 pub fn get_credit(&self, account_id: AccountId) -> U128 { U128(self.credits.get(&account_id).unwrap_or(0)) }
 pub fn get_pending(&self, account_id: AccountId) -> U128 { U128(self.pending.get(&account_id).unwrap_or(0)) }
 pub fn get_request(&self, account_id: AccountId, request_id: String) -> Option<u64> { self.requests.get(&format!("{}:{}",account_id,request_id)) }

 #[payable]
 pub fn create_bet(&mut self, request_id: String, title: String, rules: String, category: String, side_a: String, side_b: String, stake: U128, join_before: u64, ends_at: u64, invitee: Option<AccountId>, referee: Option<AccountId>, resolver: String, resolver_config: String) -> u64 {
  let creator = env::predecessor_account_id();
  require!(request_id.len()>=8 && request_id.len()<=64,"Invalid request ID");
  let key = format!("{}:{}",creator,request_id); require!(self.requests.get(&key).is_none(),"Request already created");
  require!(title.len()>=8 && title.len()<=120 && rules.len()>=20 && rules.len()<=500,"Invalid terms length");
  require!(!side_a.is_empty() && side_a.len()<=40 && !side_b.is_empty() && side_b.len()<=40 && side_a!=side_b,"Invalid sides");
  require!(matches!(category.as_str(),"Sports"|"Gaming"|"Life"|"Crypto"|"Facts"|"Science"|"Maths"),"Invalid category");
  require!(matches!(resolver.as_str(),"players"|"sports"|"crypto"|"maths"|"evidence") && resolver_config.len()<=512,"Invalid resolver");
  require!(stake.0>0,"Stake must be greater than zero");
  require!(env::attached_deposit().as_yoctonear()==stake.0.checked_add(STORAGE).expect("Deposit overflow"),"Attach the exact stake plus storage");
  require!(join_before>now() && ends_at>join_before && ends_at<=now()+90*24*60*60*1000,"Invalid deadlines");
  require!(invitee.as_ref()!=Some(&creator) && referee.as_ref()!=Some(&creator),"Players and referee must differ");
  if let Some(ref i)=invitee { require!(referee.as_ref()!=Some(i),"Referee cannot be opponent"); }
  let initial=env::storage_usage(); let id=self.bets.len();
  self.bets.push(&Bet { id,request_id,creator,opponent:None,invitee,referee,title,rules,category,side_a,side_b,resolver,resolver_config,stake,join_before,ends_at,resolve_until:ends_at+WINDOW,created_at:now(),status:"open".into(),creator_vote:None,opponent_vote:None,outcome:None,proposed_outcome:None,challenge_until:None,evidence_hash:None });
  self.requests.insert(&key,&id);
  require!((env::storage_usage()-initial+700) as u128*env::storage_byte_cost().as_yoctonear()<=STORAGE,"Terms exceed storage reserve");
  env::log_str(&format!("SLOTVEND:created:{}",id)); id
 }
 #[payable]
 pub fn accept_bet(&mut self,id:u64) {
  let mut b=self.bet(id);let actor=env::predecessor_account_id();
  require!(b.status=="open" && now()<b.join_before,"Bet is not open");
  require!(actor!=b.creator && b.referee.as_ref()!=Some(&actor),"Cannot accept your own bet or referee it");
  if let Some(i)=&b.invitee {require!(i==&actor,"This bet has an invited opponent");}
  require!(env::attached_deposit().as_yoctonear()==b.stake.0,"Match the exact stake");
  b.opponent=Some(actor);b.status="matched".into();self.save(b);
 }
 pub fn cancel_bet(&mut self,id:u64) {let mut b=self.bet(id);require!(b.status=="open" && b.creator==env::predecessor_account_id(),"Only creator can cancel an open bet");self.credit(&b.creator,b.stake.0);b.status="cancelled".into();self.save(b);}
 pub fn concede(&mut self,id:u64) {let b=self.bet(id);let actor=env::predecessor_account_id();require!(active(&b.status)&&now()<b.resolve_until,"Bet is not active");self.player(&b,&actor);let result=if actor==b.creator {"opponent"}else{"creator"};self.finish(b,result);}
 pub fn report_result(&mut self,id:u64,outcome:String) {
  outcome_ok(&outcome);let mut b=self.bet(id);let actor=env::predecessor_account_id();self.player(&b,&actor);
  require!(active(&b.status)&&now()>=b.ends_at&&now()<b.resolve_until,"Outside settlement window");
  if actor==b.creator {b.creator_vote=Some(outcome.clone());}else{b.opponent_vote=Some(outcome.clone());}
  if b.creator_vote.is_some()&&b.opponent_vote.is_some(){if b.creator_vote==b.opponent_vote {self.finish(b,&outcome);return;} b.status="disputed".into();}
  self.save(b);
 }
 pub fn referee_result(&mut self,id:u64,outcome:String) {outcome_ok(&outcome);let b=self.bet(id);require!(b.status=="disputed"&&b.referee.as_ref()==Some(&env::predecessor_account_id())&&now()<b.resolve_until,"Only the agreed referee can resolve this dispute");self.finish(b,&outcome);}
 pub fn propose_result(&mut self,id:u64,outcome:String,evidence_hash:String) {
  outcome_ok(&outcome);require!(env::predecessor_account_id()==self.oracle,"Oracle only");let mut b=self.bet(id);
  require!(b.resolver!="players"&&b.status=="matched"&&now()>=b.ends_at&&now()+REVIEW<b.resolve_until,"Cannot propose now");
  require!(evidence_hash.len()==64&&evidence_hash.bytes().all(|c|c.is_ascii_hexdigit()),"Invalid evidence hash");
  b.proposed_outcome=Some(outcome);b.evidence_hash=Some(evidence_hash);b.challenge_until=Some(now()+REVIEW);b.status="proposed".into();self.save(b);
 }
 pub fn challenge_result(&mut self,id:u64) {let mut b=self.bet(id);self.player(&b,&env::predecessor_account_id());require!(b.status=="proposed"&&now()<b.challenge_until.unwrap_or(0),"Challenge window closed");b.status="disputed".into();self.save(b);}
 pub fn finalize_result(&mut self,id:u64) {let b=self.bet(id);require!(b.status=="proposed"&&now()>=b.challenge_until.unwrap_or(u64::MAX)&&now()<b.resolve_until,"Verdict not finalizable");let result=b.proposed_outcome.clone().expect("No proposed outcome");self.finish(b,&result);}
 pub fn refund_expired(&mut self,id:u64) {let mut b=self.bet(id);if b.status=="open"&&now()>=b.join_before {self.credit(&b.creator,b.stake.0);b.status="cancelled".into();self.save(b);}else{require!(active(&b.status)&&now()>=b.resolve_until,"Refund not available yet");self.finish(b,"draw");}}
 pub fn withdraw(&mut self) -> Promise {
  let actor=env::predecessor_account_id();require!(self.pending.get(&actor).is_none(),"Withdrawal already pending");let value=self.credits.get(&actor).unwrap_or(0);require!(value>0,"Nothing to collect");
  self.credits.insert(&actor,&0);self.pending.insert(&actor,&value);
  Promise::new(actor.clone()).transfer(NearToken::from_yoctonear(value)).then(Promise::new(env::current_account_id()).function_call("on_withdraw".into(),near_sdk::serde_json::to_vec(&near_sdk::serde_json::json!({"account_id":actor})).unwrap(),NearToken::from_yoctonear(0),Gas::from_tgas(15)))
 }
 #[private]
 pub fn on_withdraw(&mut self,account_id:AccountId) -> bool {
  require!(env::promise_results_count()==1,"One transfer result required");let value=self.pending.remove(&account_id).expect("No pending withdrawal");
  if matches!(env::promise_result(0),PromiseResult::Successful(_)){true}else{self.credit(&account_id,value);false}
 }
}
impl SlotVend {
 fn bet(&self,id:u64)->Bet{self.bets.get(id).expect("Bet not found")}
 fn save(&mut self,b:Bet){self.bets.replace(b.id,&b);env::log_str(&format!("SLOTVEND:{}:{}",b.status,b.id));}
 fn player(&self,b:&Bet,a:&AccountId){require!(a==&b.creator||b.opponent.as_ref()==Some(a),"Players only");}
 fn credit(&mut self,a:&AccountId,n:u128){let old=self.credits.get(a).unwrap_or(0);self.credits.insert(a,&old.checked_add(n).expect("Credit overflow"));}
 fn finish(&mut self,mut b:Bet,result:&str){require!(active(&b.status),"Bet already settled");let opponent=b.opponent.as_ref().expect("No opponent");if result=="draw"{self.credit(&b.creator,b.stake.0);self.credit(opponent,b.stake.0);b.status="refunded".into();}else{self.credit(if result=="creator"{&b.creator}else{opponent},b.stake.0.checked_mul(2).expect("Pot overflow"));b.status="settled".into();}b.outcome=Some(result.into());self.save(b);}
}

#[cfg(test)]
mod tests {
 use super::*;
 use near_sdk::test_utils::{VMContextBuilder, testing_env_with_promise_results};
 use near_sdk::testing_env;
 fn account(s:&str)->AccountId{s.parse().unwrap()}
 fn context()->near_sdk::VMContext{VMContextBuilder::new().current_account_id(account("contract.testnet")).predecessor_account_id(account("contract.testnet")).build()}
 #[test]
 #[allow(deprecated)]
 fn failed_withdrawal_restores_pending_without_losing_new_credits(){
  testing_env!(context());let mut c=SlotVend::new(account("oracle.testnet"));let a=account("alice.testnet");
  c.pending.insert(&a,&(5*UNIT));c.credits.insert(&a,&(2*UNIT));
  testing_env_with_promise_results(context(),PromiseResult::Failed);
  assert!(!c.on_withdraw(a.clone()));assert_eq!(c.get_credit(a.clone()).0,7*UNIT);assert_eq!(c.get_pending(a).0,0);
 }
 #[test]
 #[allow(deprecated)]
 fn successful_withdrawal_preserves_credits_received_while_transfer_pending(){
  testing_env!(context());let mut c=SlotVend::new(account("oracle.testnet"));let a=account("alice.testnet");
  c.pending.insert(&a,&(5*UNIT));c.credits.insert(&a,&(2*UNIT));
  testing_env_with_promise_results(context(),PromiseResult::Successful(vec![]));
  assert!(c.on_withdraw(a.clone()));assert_eq!(c.get_credit(a.clone()).0,2*UNIT);assert_eq!(c.get_pending(a).0,0);
 }
}
