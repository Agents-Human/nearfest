use crate::*;
const ROOM_STORAGE:u128=100_000_000_000_000_000_000_000;
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Member{pub account_id:AccountId,pub amount:U128}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Vote{pub account_id:AccountId,pub approve:bool}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Claim{pub revision:u32,pub id:String,pub winner:AccountId,pub evidence_hash:String,pub votes:Vec<Vote>,pub status:String}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Room{pub claim_revision:u32,pub id:String,pub host:AccountId,pub kind:String,pub entry:U128,pub max_members:u8,pub join_until:u64,pub refund_at:u64,pub terms_hash:String,pub status:String,pub members:Vec<Member>,pub claim:Option<Claim>,pub evidence_hash:Option<String>,pub winners:Vec<AccountId>,pub payouts:Vec<Member>}
fn digest(s:&str){require!(s.len()==64&&s.bytes().all(|c|c.is_ascii_hexdigit()),"Invalid evidence hash");}
#[near]
impl SlotVend {
 pub fn get_room(&self,id:String)->Option<Room>{self.rooms.get(&id)}
 #[payable]
 pub fn create_room(&mut self,id:String,kind:String,entry:U128,max_members:u8,join_until:u64,refund_at:u64,terms_hash:String){
  require!(id.len()>=12&&id.len()<=80&&id.bytes().all(|c|c.is_ascii_alphanumeric()||c==b'-'),"Invalid room ID");require!(self.rooms.get(&id).is_none(),"Room already exists");
  require!(matches!(kind.as_str(),"game"|"pot"|"bounty"),"Invalid room kind");require!(entry.0>=UNIT/100&&entry.0<=100*UNIT,"Entry must be 0.01 to 100 NEAR");require!((2..=30).contains(&max_members),"Choose 2 to 30 members");
  require!(join_until>now()&&join_until<=now()+30*24*60*60*1000&&refund_at>join_until&&refund_at<=join_until+WINDOW,"Invalid room deadlines");digest(&terms_hash);
  require!(env::attached_deposit().as_yoctonear()==entry.0+ROOM_STORAGE,"Attach entry plus 0.1 NEAR storage reserve");let host=env::predecessor_account_id();
  self.rooms.insert(&id,&Room{claim_revision:0,id:id.clone(),host:host.clone(),kind,entry,max_members,join_until,refund_at,terms_hash,status:"open".into(),members:vec![Member{account_id:host,amount:entry}],claim:None,evidence_hash:None,winners:vec![],payouts:vec![]});
  env::log_str(&format!("NEARFEST:room_created:{}",id));
 }
 #[payable]
 pub fn contribute_room(&mut self,id:String,request_id:String,amount:U128){
  let mut r=self.room(&id);require!(r.status=="open"&&r.claim.is_none()&&now()<r.join_until,"Funding is closed");let actor=env::predecessor_account_id();require!(request_id.len()>=8&&request_id.len()<=64,"Invalid funding receipt");let receipt=format!("{}:{}:{}",id,actor,request_id);require!(self.funding_receipts.get(&receipt).is_none(),"Contribution already confirmed");let n=amount.0;require!(env::attached_deposit().as_yoctonear()==n+UNIT/100,"Attach contribution plus 0.01 NEAR storage");
  require!(n>=UNIT/100&&n<=100*UNIT,"Contribution must be 0.01 to 100 NEAR");if r.kind!="bounty"{require!(n==r.entry.0,"Match the exact entry");require!(!r.members.iter().any(|m|m.account_id==actor),"Already funded");}
  if let Some(m)=r.members.iter_mut().find(|m|m.account_id==actor){m.amount=U128(m.amount.0.checked_add(n).expect("Contribution overflow"));}else{require!(r.members.len()<(r.max_members as usize),"Room is full");r.members.push(Member{account_id:actor,amount:U128(n)});}
  self.funding_receipts.insert(&receipt,&true);self.save_room(r);
 }
 pub fn get_funding_receipt(&self,id:String,account_id:AccountId,request_id:String)->bool{self.funding_receipts.get(&format!("{}:{}:{}",id,account_id,request_id)).unwrap_or(false)}
 pub fn remove_player(&mut self,id:String,account_id:AccountId){let mut r=self.room(&id);require!(r.kind=="game"&&r.status=="open"&&env::predecessor_account_id()==r.host&&account_id!=r.host,"Only host can refund a waiting player");let i=r.members.iter().position(|m|m.account_id==account_id).expect("Player not found");let m=r.members.remove(i);self.credit(&m.account_id,m.amount.0);self.save_room(r);}
 pub fn leave_room(&mut self,id:String){let mut r=self.room(&id);let a=env::predecessor_account_id();require!(r.status=="open"&&r.claim.is_none()&&r.host!=a&&r.kind!="bounty","Cannot leave this room");let i=r.members.iter().position(|m|m.account_id==a).expect("Not a member");let m=r.members.remove(i);self.credit(&a,m.amount.0);self.save_room(r);}
 pub fn start_room(&mut self,id:String,participants:Vec<AccountId>){let mut r=self.room(&id);require!(env::predecessor_account_id()==r.host,"Host only");require!(r.kind!="bounty"&&r.status=="open"&&now()<r.join_until&&r.members.len()>=2,"Room cannot start");let mut expected:Vec<_>=r.members.iter().map(|m|m.account_id.clone()).collect();let mut actual=participants;expected.sort();actual.sort();require!(actual==expected,"Participants changed; refresh the lobby");r.status="active".into();self.save_room(r);}
 pub fn cancel_room(&mut self,id:String){let r=self.room(&id);let a=env::predecessor_account_id();require!((a==r.host&&r.status=="open"&&r.claim.is_none())||(a==self.oracle&&r.kind=="game"&&matches!(r.status.as_str(),"open"|"active")),"Cannot cancel this room");self.refund_game_room(r);}
 pub fn refund_room(&mut self,id:String){let r=self.room(&id);require!(now()>=r.refund_at&&matches!(r.status.as_str(),"open"|"active"|"review"),"Refund is not available");self.refund_game_room(r);}
 pub fn settle_game(&mut self,id:String,winners:Vec<AccountId>,evidence_hash:String){let mut r=self.room(&id);require!(env::predecessor_account_id()==self.oracle,"Result signer only");require!(r.kind=="game"&&r.status=="active"&&now()<r.refund_at,"Game cannot settle");digest(&evidence_hash);r.evidence_hash=Some(evidence_hash);if winners.is_empty(){self.refund_game_room(r);return;}let mut unique=winners.clone();unique.sort();unique.dedup();require!(unique.len()==winners.len()&&winners.iter().all(|a|r.members.iter().any(|m|&m.account_id==a)),"Invalid game winners");self.award_room(r,winners);}
 pub fn claim_room(&mut self,id:String,claim_id:String,winner:AccountId,evidence_hash:String){let mut r=self.room(&id);let a=env::predecessor_account_id();require!(r.kind!="game"&&now()<r.refund_at,"Cannot claim this room");require!(claim_id.len()>=8&&claim_id.len()<=64,"Invalid claim ID");digest(&evidence_hash);require!(r.claim.as_ref().map_or(true,|c|c.status=="rejected"),"A claim is already being reviewed");
  if r.kind=="bounty"{require!(r.status=="open"&&now()<r.join_until&&a==winner,"Claim your own completed bounty before the deadline");}else{require!(r.status=="active"&&r.members.iter().any(|m|m.account_id==a)&&r.members.iter().any(|m|m.account_id==winner),"Only participants can propose a participant");}
  require!(r.members.iter().any(|m|m.account_id!=winner),"Independent contributor required");r.claim_revision=r.claim_revision.checked_add(1).expect("Claim revision overflow");r.claim=Some(Claim{revision:r.claim_revision,id:claim_id,winner,evidence_hash,votes:vec![],status:"review".into()});r.status="review".into();self.save_room(r);
 }
 pub fn vote_room(&mut self,id:String,claim_id:String,claim_revision:u32,approve:bool){let mut r=self.room(&id);let a=env::predecessor_account_id();require!(r.status=="review"&&now()<r.refund_at&&r.members.iter().any(|m|m.account_id==a),"Only contributors can vote during review");let c=r.claim.as_mut().expect("No claim");require!(c.id==claim_id&&c.revision==claim_revision&&c.status=="review"&&c.winner!=a,"Cannot approve your own payout");if let Some(v)=c.votes.iter_mut().find(|v|v.account_id==a){v.approve=approve;}else{c.votes.push(Vote{account_id:a,approve});}let required=r.members.iter().filter(|m|m.account_id!=c.winner).count()/2+1;let yes=c.votes.iter().filter(|v|v.approve).count();let no=c.votes.len()-yes;
  if yes>=required{c.status="approved".into();let winner=c.winner.clone();self.award_room(r,vec![winner]);}else{if no>=required{c.status="rejected".into();r.status=if r.kind=="bounty"{"open"}else{"active"}.into();}self.save_room(r);}
 }
}
impl SlotVend{
 fn room(&self,id:&String)->Room{self.rooms.get(id).expect("Room not found")}
 fn save_room(&mut self,r:Room){self.rooms.insert(&r.id,&r);env::log_str(&format!("NEARFEST:room:{}:{}",r.id,r.status));}
 fn refund_game_room(&mut self,mut r:Room){require!(matches!(r.status.as_str(),"open"|"active"|"review"),"Room already settled");r.payouts=r.members.clone();for m in &r.members{self.credit(&m.account_id,m.amount.0);}r.status="refunded".into();self.save_room(r);}
 fn award_room(&mut self,mut r:Room,winners:Vec<AccountId>){let total=r.members.iter().fold(0u128,|n,m|n.checked_add(m.amount.0).expect("Pot overflow"));let count=winners.len()as u128;for(i,a)in winners.iter().enumerate(){let n=total/count+if(i as u128)<total%count{1}else{0};self.credit(a,n);r.payouts.push(Member{account_id:a.clone(),amount:U128(n)});}r.winners=winners;r.status="settled".into();self.save_room(r);}
}
